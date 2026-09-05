/**
 * Environment configuration.
 *
 * Every command declares the variables it needs and fails loudly at startup
 * if one is missing, rather than half-running and leaving the pipeline in a
 * state nobody can reason about.
 */

export interface Config {
  googlePlacesApiKey: string;
  notionToken: string;
  notionParentPageId: string;
  db: {
    projects: string;
    leads: string;
    touches: string;
    appointments: string;
    suppression: string;
  };
  smtp: { host: string; port: number; user: string; pass: string };
  mailFrom: string;
  mailTo: string;
  approvalSecret: string;
  approvalPort: number;
  publicBaseUrl: string;
  dataDir: string;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export class ConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Variabili d'ambiente mancanti: ${missing.join(', ')}\n` +
        `Copia .env.example in .env e riempi i campi, poi rilancia.`,
    );
    this.name = 'ConfigError';
  }
}

/**
 * Loads config, requiring only the variables the current command needs.
 * `require` names are the env var names, checked before anything else runs.
 */
export function loadConfig(require: string[] = []): Config {
  const missing = require.filter((name) => env(name) === undefined);
  if (missing.length > 0) throw new ConfigError(missing);

  return {
    googlePlacesApiKey: env('GOOGLE_PLACES_API_KEY') ?? '',
    notionToken: env('NOTION_TOKEN') ?? '',
    notionParentPageId: env('NOTION_PARENT_PAGE_ID') ?? '',
    db: {
      projects: env('NOTION_DB_PROJECTS') ?? '',
      leads: env('NOTION_DB_LEADS') ?? '',
      touches: env('NOTION_DB_TOUCHES') ?? '',
      appointments: env('NOTION_DB_APPOINTMENTS') ?? '',
      suppression: env('NOTION_DB_SUPPRESSION') ?? '',
    },
    smtp: {
      host: env('SMTP_HOST') ?? '',
      port: Number(env('SMTP_PORT') ?? '465'),
      user: env('SMTP_USER') ?? '',
      pass: env('SMTP_PASS') ?? '',
    },
    mailFrom: env('MAIL_FROM') ?? 'outreach@localhost',
    mailTo: env('MAIL_TO') ?? '',
    approvalSecret: env('APPROVAL_SECRET') ?? '',
    approvalPort: Number(env('APPROVAL_PORT') ?? '8787'),
    publicBaseUrl: (env('PUBLIC_BASE_URL') ?? 'http://localhost:8787').replace(/\/+$/, ''),
    dataDir: new URL('../.data/', import.meta.url).pathname,
  };
}
