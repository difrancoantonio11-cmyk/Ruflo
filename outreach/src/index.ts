#!/usr/bin/env node
/**
 * Outreach CLI.
 *
 *   outreach setup            create the five Notion databases (run once)
 *   outreach scout            find and qualify leads, write the new ones to Notion
 *   outreach digest           email the Gate A digest of leads waiting for a decision
 *   outreach serve            run the approval endpoint the digest buttons point at
 *   outreach kit <placeId>    rebuild one lead's construction kit by hand
 *   outreach suppress ...     add a contact to the global do-not-contact list
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { loadConfig, ConfigError, type Config } from './config.js';
import { NotionStore } from './storage/notion.js';
import { SeenIndex } from './storage/seen.js';
import { searchArea } from './scout/places.js';
import { qualify } from './scout/qualify.js';
import { buildKit } from './kit/builder.js';
import { renderDigest } from './mail/digest.js';
import { sendMail } from './mail/send.js';
import { startApprovalServer } from './approve/server.js';
import type { Lead, Place } from './types.js';

interface ScoutConfig {
  project: string;
  projectPageId?: string;
  area: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  categories: string[];
  maxPerCategory?: number;
  minScore?: number;
}

const NOTION_DB_VARS = [
  'NOTION_DB_PROJECTS',
  'NOTION_DB_LEADS',
  'NOTION_DB_TOUCHES',
  'NOTION_DB_APPOINTMENTS',
  'NOTION_DB_SUPPRESSION',
];

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'setup':
      return cmdSetup();
    case 'scout':
      return cmdScout(rest);
    case 'digest':
      return cmdDigest(rest);
    case 'serve':
      return cmdServe();
    case 'kit':
      return cmdKit(rest);
    case 'suppress':
      return cmdSuppress(rest);
    default:
      console.log(
        [
          'Uso: outreach <comando>',
          '',
          '  setup                  crea i 5 database su Notion (una volta sola)',
          '  scout [--config f]     cerca e qualifica lead, scrive i nuovi su Notion',
          '  digest [--limit 10]    manda la mail di approvazione (Cancello A)',
          '  serve                  avvia l\'endpoint che riceve i click della mail',
          '  kit <placeId>          ricostruisce a mano il kit di un lead',
          '  suppress --name X [--phone N] [--email E] --reason R',
        ].join('\n'),
      );
      process.exitCode = command ? 1 : 0;
  }
}

// --- setup -----------------------------------------------------------------

async function cmdSetup(): Promise<void> {
  const config = loadConfig(['NOTION_TOKEN', 'NOTION_PARENT_PAGE_ID']);
  console.log('creo i database su Notion...');
  const ids = await NotionStore.createSchema(config.notionToken, config.notionParentPageId);

  console.log('\nFatto. Incolla queste righe nel tuo .env:\n');
  console.log(`NOTION_DB_PROJECTS=${ids.projects}`);
  console.log(`NOTION_DB_LEADS=${ids.leads}`);
  console.log(`NOTION_DB_TOUCHES=${ids.touches}`);
  console.log(`NOTION_DB_APPOINTMENTS=${ids.appointments}`);
  console.log(`NOTION_DB_SUPPRESSION=${ids.suppression}`);
}

// --- scout -----------------------------------------------------------------

async function cmdScout(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string', default: 'outreach.config.json' },
      dry: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const required = ['GOOGLE_PLACES_API_KEY'];
  if (!values.dry) required.push('NOTION_TOKEN', ...NOTION_DB_VARS);
  const config = loadConfig(required);

  const scoutConfig = JSON.parse(await readFile(values.config as string, 'utf8')) as ScoutConfig;
  const minScore = scoutConfig.minScore ?? 0;
  const seen = await SeenIndex.open(config.dataDir);
  const store = values.dry ? undefined : new NotionStore(config.notionToken, config.db);

  let found = 0;
  let skipped = 0;
  let rejected = 0;
  let written = 0;

  for (const category of scoutConfig.categories) {
    process.stdout.write(`\n${category} — cerco... `);
    const places = await searchArea(
      config.googlePlacesApiKey,
      {
        query: `${category} ${scoutConfig.area}`,
        center: scoutConfig.center,
        radiusMeters: scoutConfig.radiusMeters,
      },
      scoutConfig.maxPerCategory ?? 40,
    );
    found += places.length;
    console.log(`${places.length} risultati`);

    const fresh = places.filter((p) => {
      if (!p.id || seen.has(p.id)) {
        skipped++;
        return false;
      }
      return true;
    });

    // Liveness checks dominate the runtime, so qualify in small batches.
    for (let i = 0; i < fresh.length; i += 5) {
      const batch = fresh.slice(i, i + 5);
      const verdicts = await Promise.all(batch.map((p) => qualify(p)));

      for (const [j, place] of batch.entries()) {
        const verdict = verdicts[j]!;
        const name = place.displayName?.text ?? place.id;

        if (!verdict.qualified || verdict.score < minScore) {
          seen.mark(place.id, 'rejected', name);
          rejected++;
          continue;
        }

        const lead = toLead(place, verdict.score, verdict.signals, scoutConfig);

        if (store) {
          if (await store.isSuppressed(lead.phone)) {
            seen.mark(place.id, 'rejected', name);
            rejected++;
            console.log(`  - ${name} — in lista esclusi, saltato`);
            continue;
          }
          await store.createLead(lead, scoutConfig.projectPageId);
        }

        seen.mark(place.id, 'written', name);
        written++;
        console.log(`  + ${name} (${verdict.score}/100) — ${verdict.reason}`);
      }
    }
  }

  await seen.save();
  console.log(
    `\nTrovati ${found} · già visti ${skipped} · scartati ${rejected} · ` +
      `${values.dry ? 'da scrivere' : 'scritti su Notion'} ${written}`,
  );
}

function toLead(place: Place, score: number, signals: Lead['signals'], scoutConfig: ScoutConfig): Lead {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? place.id,
    category: place.primaryTypeDisplayName?.text ?? place.primaryType ?? '',
    area: scoutConfig.area,
    address: place.formattedAddress ?? '',
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    mapsUrl: place.googleMapsUri,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    score,
    signals,
    project: scoutConfig.project,
  };
}

// --- digest ----------------------------------------------------------------

async function cmdDigest(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { limit: { type: 'string', default: '10' } },
    allowPositionals: false,
  });

  const config = loadConfig([
    'NOTION_TOKEN',
    ...NOTION_DB_VARS,
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'MAIL_TO',
    'APPROVAL_SECRET',
  ]);

  const store = new NotionStore(config.notionToken, config.db);
  const leads = await store.leadsByStatus('Da valutare', Number(values.limit));

  if (leads.length === 0) {
    console.log('nessun lead in attesa di valutazione — niente da mandare');
    return;
  }

  const message = renderDigest({ leads, secret: config.approvalSecret, baseUrl: config.publicBaseUrl });
  await sendMail(config, message);
  console.log(`digest inviato a ${config.mailTo} con ${leads.length} lead`);
}

// --- serve -----------------------------------------------------------------

async function cmdServe(): Promise<void> {
  const config = loadConfig([
    'NOTION_TOKEN',
    ...NOTION_DB_VARS,
    'APPROVAL_SECRET',
    'GOOGLE_PLACES_API_KEY',
  ]);
  startApprovalServer(config);
}

// --- kit -------------------------------------------------------------------

async function cmdKit(argv: string[]): Promise<void> {
  const placeId = argv[0];
  if (!placeId) throw new Error('uso: outreach kit <placeId>');
  const config = loadConfig(['GOOGLE_PLACES_API_KEY']);
  const { dir, kit } = await buildKit(config.googlePlacesApiKey, config.dataDir, placeId);
  console.log(`kit di ${kit.name}: ${dir} (${kit.photos.length} foto, ${kit.reviews.length} recensioni)`);
}

// --- suppress --------------------------------------------------------------

async function cmdSuppress(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      reason: { type: 'string', default: 'richiesta di non essere contattato' },
    },
    allowPositionals: false,
  });
  if (!values.name) throw new Error('serve --name');

  const config = loadConfig(['NOTION_TOKEN', ...NOTION_DB_VARS]);
  const store = new NotionStore(config.notionToken, config.db);
  await store.suppress({
    name: values.name as string,
    phone: values.phone as string | undefined,
    email: values.email as string | undefined,
    reason: values.reason as string,
  });
  console.log(`${values.name} aggiunto alla lista esclusi`);
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) console.error(`\n${err.message}\n`);
  else console.error(err);
  process.exitCode = 1;
});
