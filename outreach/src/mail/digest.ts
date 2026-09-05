/**
 * Gate A digest.
 *
 * This email is the whole product from your side: ten leads, thirty seconds of
 * reading each, three buttons. Everything here is chosen to be readable on a
 * phone with one thumb — no images, no external CSS, buttons big enough to hit
 * without zooming, and the deciding facts above the fold of each card.
 */

import type { StoredLead } from '../types.js';
import { sign } from '../approve/tokens.js';

export interface DigestOptions {
  leads: StoredLead[];
  secret: string;
  baseUrl: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  'nessun-sito': 'nessun sito',
  'solo-Facebook': 'solo Facebook',
  'solo-Instagram': 'solo Instagram',
  'solo-social': 'solo social',
  'sito-morto': 'sito non raggiungibile',
  'molte-recensioni': 'molte recensioni',
  'ha-foto': 'ha foto',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function button(href: string, label: string, bg: string): string {
  return (
    `<a href="${href}" style="display:inline-block;padding:11px 16px;margin:0 6px 6px 0;` +
    `background:${bg};color:#fff;text-decoration:none;border-radius:6px;` +
    `font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif">${label}</a>`
  );
}

function card(lead: StoredLead, opts: DigestOptions): string {
  const link = (action: 'build' | 'reject' | 'later') =>
    `${opts.baseUrl}/a/${sign(opts.secret, { leadPageId: lead.pageId, action })}`;

  const signals = lead.signals
    .map((s) => SIGNAL_LABELS[s] ?? s)
    .map(
      (s) =>
        `<span style="display:inline-block;padding:3px 8px;margin:0 4px 4px 0;background:#eef2ff;` +
        `color:#3730a3;border-radius:99px;font-size:12px">${escapeHtml(s)}</span>`,
    )
    .join('');

  const stats = [
    lead.reviewCount ? `${lead.reviewCount} recensioni` : undefined,
    lead.rating ? `${lead.rating.toFixed(1)}★` : undefined,
    lead.phone ? escapeHtml(lead.phone) : 'nessun telefono',
  ]
    .filter(Boolean)
    .join(' · ');

  return `
<table role="presentation" width="100%" style="border:1px solid #e5e7eb;border-radius:10px;margin:0 0 14px;background:#fff">
  <tr><td style="padding:16px">
    <div style="font:700 17px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
      ${escapeHtml(lead.name)}
      <span style="float:right;font:600 13px/1.3 sans-serif;color:#6b7280">${lead.score}/100</span>
    </div>
    <div style="font:400 13px/1.5 sans-serif;color:#6b7280;margin:4px 0 8px">
      ${escapeHtml(lead.category)}${lead.area ? ` · ${escapeHtml(lead.area)}` : ''}<br>
      ${escapeHtml(lead.address)}
    </div>
    <div style="font:400 13px/1.5 sans-serif;color:#374151;margin-bottom:8px">${stats}</div>
    <div style="margin-bottom:12px">${signals}</div>
    ${
      lead.mapsUrl
        ? `<div style="margin-bottom:12px"><a href="${lead.mapsUrl}" style="font:400 13px sans-serif;color:#2563eb">apri su Google Maps →</a></div>`
        : ''
    }
    ${
      lead.website
        ? `<div style="margin-bottom:12px;font:400 13px sans-serif;color:#6b7280">rilevato: ${escapeHtml(lead.website)}</div>`
        : ''
    }
    ${button(link('build'), 'COSTRUISCI', '#16a34a')}
    ${button(link('reject'), 'SCARTA', '#dc2626')}
    ${button(link('later'), 'PIÙ TARDI', '#6b7280')}
  </td></tr>
</table>`;
}

export function renderDigest(opts: DigestOptions): { subject: string; html: string; text: string } {
  const { leads } = opts;
  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  const html = `
<div style="background:#f9fafb;padding:20px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto">
    <div style="font:700 20px/1.3 sans-serif;color:#111827;margin-bottom:4px">
      ${leads.length} lead da valutare
    </div>
    <div style="font:400 14px/1.5 sans-serif;color:#6b7280;margin-bottom:20px">
      ${today} · ordinati per punteggio. Costruisci solo quelli che approvi.
    </div>
    ${leads.map((l) => card(l, opts)).join('')}
    <div style="font:400 12px/1.5 sans-serif;color:#9ca3af;margin-top:8px">
      I link scadono fra 14 giorni. "Più tardi" lascia il lead in coda per il prossimo digest.
    </div>
  </div>
</div>`;

  const text = leads
    .map(
      (l, i) =>
        `${i + 1}. ${l.name} (${l.score}/100) — ${l.category}, ${l.address}\n` +
        `   ${l.signals.join(', ')}${l.phone ? ` · ${l.phone}` : ''}`,
    )
    .join('\n');

  return {
    subject: `${leads.length} lead da valutare — ${today}`,
    html,
    text,
  };
}
