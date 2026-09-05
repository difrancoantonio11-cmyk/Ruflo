/**
 * Domain types for the outreach engine.
 *
 * The pipeline is a state machine. A lead only ever moves forward through
 * `LeadStatus`, except into the terminal states, and every transition is
 * recorded in Notion so the dashboard is always the truth of "where is this".
 */

/** Lead pipeline states. The order here is the order shown in Notion. */
export const LEAD_STATUSES = [
  'Da valutare', // scout wrote it, waiting for Gate A
  'Approvato', // Gate A passed — build the demo site
  'Demo pronta', // demo URL filled in, waiting for Gate B
  'Da inviare', // Gate B passed
  'Contattato',
  'Ha risposto',
  'Appuntamento',
  'Cliente',
  'Perso',
  'Ricontattare',
  'Scartato', // Gate A rejected
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Qualification signals. These are what you actually read at Gate A, so they
 * are deliberately few and blunt — a signal that needs explaining is useless
 * in a two-minute triage on a phone.
 */
export const SIGNALS = [
  'nessun-sito',
  'solo-Facebook',
  'solo-Instagram',
  'solo-social',
  'sito-morto',
  'molte-recensioni',
  'ha-foto',
] as const;
export type Signal = (typeof SIGNALS)[number];

export const CHANNELS = ['telefono', 'whatsapp', 'email', 'instagram', 'facebook', 'di persona'] as const;
export type Channel = (typeof CHANNELS)[number];

/** A place as returned by Google Places, narrowed to the fields we ask for. */
export interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  location?: { latitude: number; longitude: number };
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }>;
  editorialSummary?: { text?: string };
}

/** The verdict of the qualification rules for one place. */
export interface Qualification {
  qualified: boolean;
  score: number; // 0-100
  signals: Signal[];
  reason: string; // human-readable, shown in the digest when rejected
}

/** A qualified lead, ready to be written to Notion. */
export interface Lead {
  placeId: string;
  name: string;
  category: string;
  area: string;
  address: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  score: number;
  signals: Signal[];
  project: string;
}

/** A lead as read back from Notion (carries the page id we need to update). */
export interface StoredLead extends Lead {
  pageId: string;
  status: LeadStatus;
}
