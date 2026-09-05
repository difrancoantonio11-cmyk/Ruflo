/**
 * Build kit assembly.
 *
 * When a lead passes Gate A, this collects everything needed to build its demo
 * site into one folder: photos, hours, reviews, contact details, a description.
 * The point is that building the site should be design work, not data entry —
 * the difference between fifteen minutes and an hour per lead.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchPhoto, fetchPlaceDetails } from '../scout/places.js';
import type { Place } from '../types.js';

export interface Kit {
  placeId: string;
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  location?: { latitude: number; longitude: number };
  openingHours: string[];
  description?: string;
  reviews: Array<{ author?: string; rating?: number; when?: string; text?: string }>;
  photos: string[];
  builtAt: string;
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Fetches the expensive Places fields for one approved lead and writes the kit
 * to `<dataDir>/kits/<slug>/`. Photo failures are tolerated: a kit with four
 * photos is still useful, a crashed build is not.
 */
export async function buildKit(
  apiKey: string,
  dataDir: string,
  placeId: string,
  maxPhotos = 8,
): Promise<{ dir: string; kit: Kit }> {
  const place: Place = await fetchPlaceDetails(apiKey, placeId);
  const name = place.displayName?.text ?? placeId;
  const dir = join(dataDir, 'kits', slugify(name));
  await mkdir(dir, { recursive: true });

  const photos: string[] = [];
  for (const [i, photo] of (place.photos ?? []).slice(0, maxPhotos).entries()) {
    try {
      const bytes = await fetchPhoto(apiKey, photo.name);
      const file = `foto-${String(i + 1).padStart(2, '0')}.jpg`;
      await writeFile(join(dir, file), bytes);
      photos.push(file);
    } catch (err) {
      console.warn(`  foto ${i + 1} non scaricata: ${(err as Error).message}`);
    }
  }

  const kit: Kit = {
    placeId,
    name,
    category: place.primaryTypeDisplayName?.text,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
    website: place.websiteUri,
    mapsUrl: place.googleMapsUri,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    location: place.location,
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    description: place.editorialSummary?.text,
    reviews: (place.reviews ?? []).slice(0, 5).map((r) => ({
      author: r.authorAttribution?.displayName,
      rating: r.rating,
      when: r.relativePublishTimeDescription,
      text: r.text?.text,
    })),
    photos,
    builtAt: new Date().toISOString(),
  };

  await writeFile(join(dir, 'kit.json'), JSON.stringify(kit, null, 2), 'utf8');
  return { dir, kit };
}
