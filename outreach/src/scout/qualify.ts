/**
 * Qualification rules.
 *
 * These are deliberately plain rules and not a model call: the criterion is
 * objective ("does this business have a working website of its own?"), it runs
 * on hundreds of places per scout, and a rule you can read is a rule you can
 * argue with when a lead turns out wrong.
 */

import type { Place, Qualification, Signal } from '../types.js';

/**
 * Hosts that are a social profile or a link-in-bio page rather than a website.
 * A business whose "website" is one of these is the *best* lead in the set: it
 * already decided it needs to be online and is using the wrong tool for it.
 *
 * `business.site` is Google Business Profile's own website builder, which was
 * shut down in 2024 — those links no longer serve a site at all.
 */
const SOCIAL_HOSTS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  'tiktok.com',
  'linktr.ee',
  'beacons.ai',
  'taplink.cc',
  'linkin.bio',
  'wa.me',
  'business.site',
  'sites.google.com',
  'yelp.com',
  'tripadvisor.it',
  'tripadvisor.com',
  'thefork.it',
  'justeat.it',
  'deliveroo.it',
  'paginegialle.it',
];

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function isSocialHost(host: string): boolean {
  return SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Checks whether a URL actually serves something. Uses GET rather than HEAD
 * because a meaningful share of small-business hosts reject HEAD outright.
 * Any failure is treated as "dead", which is the answer that matters here:
 * a site the owner's customers cannot reach is a site the owner does not have.
 */
export async function isAlive(url: string, timeoutMs = 8000): Promise<{ alive: boolean; finalUrl?: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; outreach-scout/0.1)' },
    });
    return { alive: res.status < 400, finalUrl: res.url };
  } catch {
    return { alive: false };
  }
}

/**
 * Applies the rules to one place.
 * `checkLiveness` is injected so the scout can run it in parallel and so tests
 * do not need the network.
 */
export async function qualify(
  place: Place,
  checkLiveness: (url: string) => Promise<{ alive: boolean; finalUrl?: string }> = isAlive,
): Promise<Qualification> {
  const signals: Signal[] = [];

  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    return { qualified: false, score: 0, signals, reason: `attività ${place.businessStatus}` };
  }

  const website = place.websiteUri?.trim();
  let siteVerdict: 'none' | 'social' | 'dead' | 'alive';

  if (!website) {
    siteVerdict = 'none';
    signals.push('nessun-sito');
  } else {
    const host = hostOf(website);
    if (host && isSocialHost(host)) {
      siteVerdict = 'social';
      if (host.includes('facebook') || host.includes('fb.')) signals.push('solo-Facebook');
      else if (host.includes('instagram')) signals.push('solo-Instagram');
      else signals.push('solo-social');
    } else {
      const { alive, finalUrl } = await checkLiveness(website);
      const finalHost = finalUrl ? hostOf(finalUrl) : undefined;
      if (alive && finalHost && isSocialHost(finalHost)) {
        // The domain still resolves but only forwards to a social page.
        siteVerdict = 'social';
        signals.push('solo-social');
      } else if (alive) {
        siteVerdict = 'alive';
      } else {
        siteVerdict = 'dead';
        signals.push('sito-morto');
      }
    }
  }

  if (siteVerdict === 'alive') {
    return { qualified: false, score: 0, signals, reason: 'ha già un sito funzionante' };
  }

  const reviews = place.userRatingCount ?? 0;
  if (reviews >= 10) signals.push('molte-recensioni');
  // The phone number is the channel most of these businesses actually answer on,
  // so its presence is worth showing next to the rest.
  if (place.nationalPhoneNumber) signals.push('ha-telefono');

  // Base score by how badly they need the offer, weighted so that a business
  // already investing effort online outranks one that is simply absent.
  let score = siteVerdict === 'social' ? 45 : siteVerdict === 'none' ? 40 : 35;

  // Liveness signals: reviews are the cheapest proxy for "this place is busy".
  if (reviews >= 50) score += 25;
  else if (reviews >= 20) score += 20;
  else if (reviews >= 10) score += 15;
  else if (reviews >= 3) score += 8;

  if ((place.rating ?? 0) >= 4.0) score += 10;
  if (place.nationalPhoneNumber) score += 10;

  const reason =
    siteVerdict === 'social'
      ? 'presente sui social ma senza sito proprio'
      : siteVerdict === 'dead'
        ? 'il sito indicato non risponde'
        : 'nessun sito indicato';

  return { qualified: true, score: Math.min(100, score), signals, reason };
}
