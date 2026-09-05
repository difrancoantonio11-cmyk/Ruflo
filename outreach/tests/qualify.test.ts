import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualify } from '../src/scout/qualify.js';
import type { Place } from '../src/types.js';

const alive = async () => ({ alive: true, finalUrl: 'https://esempio.it/' });
const dead = async () => ({ alive: false });

function place(over: Partial<Place> = {}): Place {
  return { id: 'p1', displayName: { text: 'Test' }, businessStatus: 'OPERATIONAL', ...over };
}

test('nessun sito indicato -> qualificato', async () => {
  const v = await qualify(place(), alive);
  assert.equal(v.qualified, true);
  assert.ok(v.signals.includes('nessun-sito'));
});

test('un sito vero e funzionante -> scartato', async () => {
  const v = await qualify(place({ websiteUri: 'https://esempio.it' }), alive);
  assert.equal(v.qualified, false);
  assert.equal(v.score, 0);
});

test('sito che non risponde -> qualificato come sito-morto', async () => {
  const v = await qualify(place({ websiteUri: 'https://rotto.it' }), dead);
  assert.equal(v.qualified, true);
  assert.ok(v.signals.includes('sito-morto'));
});

test('pagina Facebook come sito -> qualificato e vale piu di chi non ha nulla', async () => {
  const social = await qualify(place({ websiteUri: 'https://www.facebook.com/pizzeria' }), alive);
  const none = await qualify(place(), alive);
  assert.equal(social.qualified, true);
  assert.ok(social.signals.includes('solo-Facebook'));
  assert.ok(social.score > none.score, 'un lead social deve superare un lead senza nulla');
});

test('business.site (builder Google dismesso) conta come assenza di sito', async () => {
  const v = await qualify(place({ websiteUri: 'https://pizzeria.business.site' }), alive);
  assert.equal(v.qualified, true);
});

test('dominio che redirige su Instagram -> trattato come social', async () => {
  const redirect = async () => ({ alive: true, finalUrl: 'https://www.instagram.com/negozio' });
  const v = await qualify(place({ websiteUri: 'https://negozio.it' }), redirect);
  assert.equal(v.qualified, true);
  assert.ok(v.signals.includes('solo-social'));
});

test('attivita chiusa -> mai qualificata', async () => {
  const v = await qualify(place({ businessStatus: 'CLOSED_PERMANENTLY' }), alive);
  assert.equal(v.qualified, false);
});

test('attivita viva e senza sito prende il punteggio piu alto', async () => {
  const busy = await qualify(
    place({ userRatingCount: 80, rating: 4.6, nationalPhoneNumber: '0775 123456' }),
    alive,
  );
  const quiet = await qualify(place({ userRatingCount: 1 }), alive);
  assert.ok(busy.score > quiet.score);
  assert.ok(busy.score <= 100, 'il punteggio non deve sforare 100');
});
