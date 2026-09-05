/**
 * Google Places API (New) client.
 *
 * Cost note: Places bills by field mask tier, not by call. The scout therefore
 * asks only for cheap fields (id, name, address, phone, website, ratings), and
 * the expensive ones (photos, reviews, opening hours, editorial summary) are
 * fetched later by `fetchPlaceDetails`, once per lead you actually approved.
 * Asking for everything up front would multiply the bill by the share of leads
 * you reject — which is most of them.
 */

import type { Place } from '../types.js';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

/** Cheap tier: everything the qualification rules need, nothing more. */
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

/** Expensive tier: only ever requested for an approved lead, to build its kit. */
const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'primaryTypeDisplayName',
  'googleMapsUri',
  'location',
  'regularOpeningHours',
  'editorialSummary',
  'photos',
  'reviews',
].join(',');

export interface SearchArea {
  /** Free-text query, e.g. "parrucchiere" — the area is applied separately. */
  query: string;
  /** Centre of the search circle. */
  center: { latitude: number; longitude: number };
  /** Radius in metres. Google caps this at 50000. */
  radiusMeters: number;
}

interface SearchResponse {
  places?: Place[];
  nextPageToken?: string;
}

async function post(apiKey: string, body: unknown, fieldMask: string): Promise<SearchResponse> {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Places searchText ${res.status}: ${detail.slice(0, 400)}`);
  }
  return (await res.json()) as SearchResponse;
}

/**
 * Runs a text search over an area and follows pagination.
 * Google returns at most 20 results per page and 60 in total for one query, so
 * covering a town means several narrower queries, not one big one.
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
        circle: {
          center: area.center,
          radius: Math.min(area.radiusMeters, 50000),
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const page = await post(apiKey, body, SCOUT_FIELDS);
    out.push(...(page.places ?? []));
    pageToken = page.nextPageToken;

    // Google needs a moment before a freshly issued page token is valid.
    if (pageToken && out.length < maxResults) await sleep(2000);
  } while (pageToken && out.length < maxResults);

  return out.slice(0, maxResults);
}

/** Full detail for one place — photos, reviews, hours. Used to build the kit. */
export async function fetchPlaceDetails(apiKey: string, placeId: string): Promise<Place> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Places details ${res.status}: ${detail.slice(0, 400)}`);
  }
  return (await res.json()) as Place;
}

/** Downloads one photo by its Places resource name. Returns the raw bytes. */
export async function fetchPhoto(apiKey: string, photoName: string, maxWidthPx = 1600): Promise<Buffer> {
  const url =
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Places photo ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
