/**
 * Google Places API (New) client.
 *
 * Only the cheap field tier is ever requested: name, address, phone, website,
 * ratings. Photos, reviews and opening hours sit in the expensive tiers and
 * nothing in this pipeline needs them.
 */

import type { Place } from '../types.js';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const SCOUT_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.location',
  'nextPageToken',
].join(',');

export interface SearchArea {
  /** Free-text query, e.g. "parrucchiere Caselle Torinese". */
  query: string;
  center: { latitude: number; longitude: number };
  /** Radius in metres. Google caps this at 50000. */
  radiusMeters: number;
}

interface SearchResponse {
  places?: Place[];
  nextPageToken?: string;
}

/**
 * Runs a text search over an area, following pagination.
 * Google returns at most 20 results per page and 60 per query, so covering a
 * town means several narrow queries rather than one broad one.
 */
export async function searchArea(apiKey: string, area: SearchArea, maxResults = 60): Promise<Place[]> {
  const out: Place[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      textQuery: area.query,
      languageCode: 'it',
      regionCode: 'IT',
      maxResultCount: Math.min(20, maxResults - out.length),
      locationRestriction: {
        circle: { center: area.center, radius: Math.min(area.radiusMeters, 50000) },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': SCOUT_FIELDS,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Places searchText ${res.status}: ${detail.slice(0, 400)}`);
    }

    const page = (await res.json()) as SearchResponse;
    out.push(...(page.places ?? []));
    pageToken = page.nextPageToken;

    // A freshly issued page token needs a moment before Google accepts it.
    if (pageToken && out.length < maxResults) await new Promise((r) => setTimeout(r, 2000));
  } while (pageToken && out.length < maxResults);

  return out.slice(0, maxResults);
}
