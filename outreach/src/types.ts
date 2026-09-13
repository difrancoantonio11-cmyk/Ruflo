/**
 * Domain types.
 *
 * The pipeline is short on purpose: find a business without a website, find an
 * email for it where one exists, contact it, record what came back. Leads with
 * only a phone number stay in the same store but are worked by hand.
 */

export const LEAD_STATUSES = [
  'Da valutare', // the scout wrote it
  'Approvato', // cleared for contact
  'Contattato',
  'Ha risposto',
  'Cliente',
  'Perso',
  'Scartato',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** What makes a lead qualified, in the form you read at a glance. */
export const SIGNALS = [
  'nessun-sito',
  'solo-Facebook',
  'solo-Instagram',
  'solo-social',
  'sito-morto',
  'molte-recensioni',
  'ha-telefono',
  'ha-email',
] as const;
export type Signal = (typeof SIGNALS)[number];

export const CHANNELS = ['telefono', 'whatsapp', 'email', 'instagram', 'facebook', 'di persona'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Where a lead came from. Sources are interchangeable behind this shape. */
export type SourceName = 'google' | 'osm';

/**
 * One business.
 *
 * `externalId` is the source's own identifier and is what de-duplication keys
 * on. `email` decides which lane a lead belongs to: with one the system can
 * work it end to end, without one it becomes a call to make by hand.
 */
export interface Lead {
  externalId: string;
  source: SourceName;
  name: string;
  category: string;
  area: string;
  address: string;
  phone?: string;
  email?: string;
  social?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  score: number;
  signals: Signal[];
  project: string;
}

/** A lead read back from Notion, carrying the page id needed to update it. */
export interface StoredLead extends Lead {
  pageId: string;
  status: LeadStatus;
}

/** The verdict of the qualification rules for one candidate. */
export interface Qualification {
  qualified: boolean;
  score: number;
  signals: Signal[];
  reason: string;
}

/** A business as returned by Google Places, narrowed to the fields requested. */
export interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  location?: { latitude: number; longitude: number };
}
