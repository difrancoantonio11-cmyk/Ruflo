/**
 * Approval endpoint.
 *
 * A tiny HTTP server whose only job is to receive the clicks from the Gate A
 * email. It holds no session and no state of its own: authority lives entirely
 * in the signed token, and the result of a click is written straight to Notion.
 *
 * Approving a lead also kicks off its build kit, so by the time you sit down to
 * make the site the photos and the data are already on disk.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Config } from '../config.js';
import { NotionStore } from '../storage/notion.js';
import { verify, type ApprovalAction } from './tokens.js';

const OUTCOMES: Record<ApprovalAction, { title: string; body: string; color: string }> = {
  build: { title: 'Approvato', body: 'Il lead è pronto per il contatto.', color: '#16a34a' },
  reject: { title: 'Scartato', body: 'Non comparirà nei prossimi digest.', color: '#dc2626' },
  later: { title: 'Rimandato', body: 'Resta in coda per il prossimo digest.', color: '#6b7280' },
};

function page(title: string, body: string, color: string): string {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:15vh auto;padding:0 24px;text-align:center">
  <div style="font-size:22px;font-weight:700;color:${color};margin-bottom:8px">${title}</div>
  <div style="font-size:15px;line-height:1.6;color:#4b5563">${body}</div>
</div>`;
}

function reply(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

export function startApprovalServer(config: Config): void {
  const store = new NotionStore(config.notionToken, config.db);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch((err: Error) => {
      console.error('approval error:', err.message);
      reply(res, 500, page('Errore', 'Qualcosa è andato storto. Controlla i log del servizio.', '#dc2626'));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      reply(res, 200, 'ok');
      return;
    }

    if (!url.pathname.startsWith('/a/')) {
      reply(res, 404, page('Non trovato', 'Questo indirizzo non esiste.', '#6b7280'));
      return;
    }

    const claim = verify(config.approvalSecret, decodeURIComponent(url.pathname.slice(3)));
    if (!claim) {
      reply(res, 400, page('Link non valido', 'Il link è scaduto o è stato alterato.', '#dc2626'));
      return;
    }

    const lead = await store.getLead(claim.leadPageId);
    if (!lead) {
      reply(res, 404, page('Lead non trovato', 'Forse è stato eliminato da Notion.', '#6b7280'));
      return;
    }

    // Idempotent: a second click on the same button must not undo later work.
    if (lead.status !== 'Da valutare') {
      reply(res, 200, page('Già gestito', `${lead.name} è nello stato "${lead.status}".`, '#6b7280'));
      return;
    }

    const outcome = OUTCOMES[claim.action];

    if (claim.action === 'reject') {
      await store.setLeadStatus(claim.leadPageId, 'Scartato');
    } else if (claim.action === 'build') {
      await store.setLeadStatus(claim.leadPageId, 'Approvato');
    }

    reply(res, 200, page(`${outcome.title}: ${lead.name}`, outcome.body, outcome.color));
  }

  server.listen(config.approvalPort, () => {
    console.log(`approvazioni in ascolto su http://localhost:${config.approvalPort}`);
    console.log(`i link nelle email puntano a ${config.publicBaseUrl}`);
  });
}
