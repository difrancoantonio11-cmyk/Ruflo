/**
 * The only file in this project that talks to Notion.
 *
 * Everything else deals in domain types. If Notion ever stops being the right
 * home for this data, this file is what gets rewritten — nothing else should
 * need to know where the rows live.
 */

import type { Channel, Lead, LeadStatus, StoredLead } from '../types.js';
import { LEAD_STATUSES, SIGNALS, CHANNELS } from '../types.js';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/** Notion allows ~3 requests/second averaged; one call per 350ms stays under it. */
const MIN_INTERVAL_MS = 350;

export interface DatabaseIds {
  projects: string;
  leads: string;
  touches: string;
  appointments: string;
  suppression: string;
}

export class NotionStore {
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(
    private readonly token: string,
    private readonly db: DatabaseIds,
  ) {}

  // --- transport -----------------------------------------------------------

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    // Serialise every call and space them out; Notion answers 429 otherwise.
    const run = async (): Promise<T> => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCall);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();

      const res = await fetch(`${NOTION_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Notion ${init.method ?? 'GET'} ${path} -> ${res.status}: ${detail.slice(0, 400)}`);
      }
      return (await res.json()) as T;
    };

    this.queue = this.queue.then(run, run);
    return this.queue as Promise<T>;
  }

  // --- schema --------------------------------------------------------------

  /**
   * Creates the five databases under a parent page and returns their ids.
   * Run once; the ids go into .env so later runs just use them.
   */
  static async createSchema(token: string, parentPageId: string): Promise<DatabaseIds> {
    const bare = new NotionStore(token, {
      projects: '',
      leads: '',
      touches: '',
      appointments: '',
      suppression: '',
    });
    const parent = { type: 'page_id', page_id: parentPageId };

    const projects = await bare.createDatabase(parent, 'Progetti', {
      Nome: { title: {} },
      Offerta: { rich_text: {} },
      ICP: { rich_text: {} },
      'Tono di voce': { rich_text: {} },
      Attivo: { checkbox: {} },
    });

    const leads = await bare.createDatabase(parent, 'Lead', {
      Nome: { title: {} },
      Progetto: { relation: { database_id: projects, single_property: {} } },
      Categoria: { rich_text: {} },
      Zona: { rich_text: {} },
      Telefono: { phone_number: {} },
      Email: { email: {} },
      Social: { url: {} },
      'ID esterno': { rich_text: {} },
      Fonte: { select: { options: [{ name: 'google' }, { name: 'osm' }] } },
      Stato: { select: { options: LEAD_STATUSES.map((name, i) => ({ name, color: statusColor(i) })) } },
      Punteggio: { number: { format: 'number' } },
      Segnali: { multi_select: { options: SIGNALS.map((name) => ({ name })) } },
      'Sito rilevato': { url: {} },
      Maps: { url: {} },
      Recensioni: { number: { format: 'number' } },
      Valutazione: { number: { format: 'number' } },
      'Trovato il': { date: {} },
      Note: { rich_text: {} },
    });

    const touches = await bare.createDatabase(parent, 'Contatti', {
      Riferimento: { title: {} },
      Lead: { relation: { database_id: leads, single_property: {} } },
      Canale: { select: { options: CHANNELS.map((name) => ({ name })) } },
      Direzione: { select: { options: [{ name: 'uscita' }, { name: 'entrata' }] } },
      Testo: { rich_text: {} },
      Data: { date: {} },
      Esito: {
        select: {
          options: [
            { name: 'inviato', color: 'blue' },
            { name: 'nessuna risposta', color: 'gray' },
            { name: 'risposta positiva', color: 'green' },
            { name: 'risposta negativa', color: 'red' },
            { name: 'non contattabile', color: 'orange' },
          ],
        },
      },
    });

    const appointments = await bare.createDatabase(parent, 'Appuntamenti', {
      Appuntamento: { title: {} },
      Lead: { relation: { database_id: leads, single_property: {} } },
      Quando: { date: {} },
      'Report pre-call': { rich_text: {} },
      Esito: {
        select: {
          options: [
            { name: 'da fare', color: 'yellow' },
            { name: 'fatto', color: 'blue' },
            { name: 'vinto', color: 'green' },
            { name: 'perso', color: 'red' },
            { name: 'rimandato', color: 'gray' },
          ],
        },
      },
    });

    const suppression = await bare.createDatabase(parent, 'Esclusi', {
      Contatto: { title: {} },
      Telefono: { phone_number: {} },
      Email: { email: {} },
      Motivo: { rich_text: {} },
      Data: { date: {} },
    });

    return { projects, leads, touches, appointments, suppression };
  }

  private async createDatabase(
    parent: unknown,
    title: string,
    properties: Record<string, unknown>,
  ): Promise<string> {
    const res = await this.request<{ id: string }>('/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent,
        title: [{ type: 'text', text: { content: title } }],
        properties,
      }),
    });
    return res.id;
  }

  // --- leads ---------------------------------------------------------------

  async createLead(lead: Lead, projectPageId?: string): Promise<string> {
    const properties: Record<string, unknown> = {
      Nome: { title: [{ text: { content: lead.name.slice(0, 200) } }] },
      Categoria: text(lead.category),
      Zona: text(lead.area),
      'ID esterno': text(lead.externalId),
      Fonte: { select: { name: lead.source } },
      Stato: { select: { name: 'Da valutare' satisfies LeadStatus } },
      Punteggio: { number: lead.score },
      Segnali: { multi_select: lead.signals.map((name) => ({ name })) },
      'Trovato il': { date: { start: new Date().toISOString().slice(0, 10) } },
      Note: text(lead.address),
    };
    if (lead.phone) properties.Telefono = { phone_number: lead.phone };
    if (lead.email) properties.Email = { email: lead.email };
    if (lead.social) properties.Social = { url: lead.social };
    if (lead.website) properties['Sito rilevato'] = { url: lead.website };
    if (lead.mapsUrl) properties.Maps = { url: lead.mapsUrl };
    if (typeof lead.reviewCount === 'number') properties.Recensioni = { number: lead.reviewCount };
    if (typeof lead.rating === 'number') properties.Valutazione = { number: lead.rating };
    if (projectPageId) properties.Progetto = { relation: [{ id: projectPageId }] };

    const res = await this.request<{ id: string }>('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: this.db.leads }, properties }),
    });
    return res.id;
  }

  async setLeadStatus(pageId: string, status: LeadStatus, note?: string): Promise<void> {
    const properties: Record<string, unknown> = { Stato: { select: { name: status } } };
    if (note) properties.Note = text(note);
    await this.request(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async getLead(pageId: string): Promise<StoredLead | undefined> {
    try {
      const page = await this.request<NotionPage>(`/pages/${pageId}`);
      return toStoredLead(page);
    } catch {
      return undefined;
    }
  }

  async leadsByStatus(status: LeadStatus, limit = 25): Promise<StoredLead[]> {
    const res = await this.request<{ results: NotionPage[] }>(`/databases/${this.db.leads}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Stato', select: { equals: status } },
        sorts: [{ property: 'Punteggio', direction: 'descending' }],
        page_size: Math.min(limit, 100),
      }),
    });
    return res.results.map(toStoredLead);
  }

  // --- suppression ---------------------------------------------------------

  /**
   * The global do-not-contact list. Checked before a lead is ever written, so
   * someone who told you no cannot resurface through another project.
   */
  async isSuppressed(phone?: string, email?: string): Promise<boolean> {
    const or: unknown[] = [];
    if (phone) or.push({ property: 'Telefono', phone_number: { equals: phone } });
    if (email) or.push({ property: 'Email', email: { equals: email } });
    if (or.length === 0) return false;

    const res = await this.request<{ results: unknown[] }>(`/databases/${this.db.suppression}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter: { or }, page_size: 1 }),
    });
    return res.results.length > 0;
  }

  async suppress(contact: { name: string; phone?: string; email?: string; reason: string }): Promise<void> {
    const properties: Record<string, unknown> = {
      Contatto: { title: [{ text: { content: contact.name.slice(0, 200) } }] },
      Motivo: text(contact.reason),
      Data: { date: { start: new Date().toISOString().slice(0, 10) } },
    };
    if (contact.phone) properties.Telefono = { phone_number: contact.phone };
    if (contact.email) properties.Email = { email: contact.email };
    await this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: this.db.suppression }, properties }),
    });
  }

  // --- touches -------------------------------------------------------------

  async addTouch(touch: {
    leadPageId: string;
    leadName: string;
    channel: Channel;
    direction: 'uscita' | 'entrata';
    body: string;
    outcome?: string;
  }): Promise<void> {
    const properties: Record<string, unknown> = {
      Riferimento: { title: [{ text: { content: `${touch.leadName} — ${touch.channel}`.slice(0, 200) } }] },
      Lead: { relation: [{ id: touch.leadPageId }] },
      Canale: { select: { name: touch.channel } },
      Direzione: { select: { name: touch.direction } },
      Testo: text(touch.body),
      Data: { date: { start: new Date().toISOString() } },
    };
    if (touch.outcome) properties.Esito = { select: { name: touch.outcome } };
    await this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: this.db.touches }, properties }),
    });
  }
}

// --- mapping helpers -------------------------------------------------------

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

function text(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}

function readText(prop: any): string {
  return (prop?.rich_text ?? []).map((r: any) => r.plain_text ?? '').join('');
}

function readTitle(prop: any): string {
  return (prop?.title ?? []).map((r: any) => r.plain_text ?? '').join('');
}

function toStoredLead(page: NotionPage): StoredLead {
  const p = page.properties;
  return {
    pageId: page.id,
    externalId: readText(p['ID esterno']),
    source: (p.Fonte?.select?.name ?? 'google') as StoredLead['source'],
    name: readTitle(p.Nome),
    category: readText(p.Categoria),
    area: readText(p.Zona),
    address: readText(p.Note),
    phone: p.Telefono?.phone_number ?? undefined,
    email: p.Email?.email ?? undefined,
    social: p.Social?.url ?? undefined,
    website: p['Sito rilevato']?.url ?? undefined,
    mapsUrl: p.Maps?.url ?? undefined,
    rating: p.Valutazione?.number ?? undefined,
    reviewCount: p.Recensioni?.number ?? undefined,
    score: p.Punteggio?.number ?? 0,
    signals: (p.Segnali?.multi_select ?? []).map((s: any) => s.name),
    project: '',
    status: (p.Stato?.select?.name ?? 'Da valutare') as LeadStatus,
  };
}

function statusColor(index: number): string {
  const colors = ['yellow', 'blue', 'purple', 'blue', 'orange', 'pink', 'purple', 'green', 'red', 'brown', 'gray'];
  return colors[index] ?? 'default';
}
