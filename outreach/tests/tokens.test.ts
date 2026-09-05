import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../src/approve/tokens.js';

const SECRET = 'secret-di-prova-abbastanza-lungo';

test('un token valido torna la stessa richiesta', () => {
  const token = sign(SECRET, { leadPageId: 'abc123', action: 'build' });
  assert.deepEqual(verify(SECRET, token), { leadPageId: 'abc123', action: 'build' });
});

test('un token firmato con un altro segreto viene rifiutato', () => {
  const token = sign('altro-segreto', { leadPageId: 'abc123', action: 'reject' });
  assert.equal(verify(SECRET, token), undefined);
});

test('non si puo cambiare il lead o l azione senza rifare la firma', () => {
  const token = sign(SECRET, { leadPageId: 'abc123', action: 'reject' });
  const [payload, sig] = token.split('.');
  const forged = Buffer.from('vittima|build|' + (Date.now() + 1000), 'utf8').toString('base64url');
  assert.equal(verify(SECRET, `${forged}.${sig}`), undefined);
  assert.notEqual(payload, forged);
});

test('un token scaduto viene rifiutato', () => {
  const token = sign(SECRET, { leadPageId: 'abc123', action: 'build' }, -1);
  assert.equal(verify(SECRET, token), undefined);
});

test('spazzatura non fa esplodere il verificatore', () => {
  for (const junk of ['', '.', 'a.b.c', 'non-un-token', '....']) {
    assert.equal(verify(SECRET, junk), undefined);
  }
});
