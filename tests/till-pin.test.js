import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPin, hashPin, verifyPin } from '../server/till/pin.js';

test('a PIN is 4 to 6 digits', () => {
  for (const ok of ['1234', '00000', '987654']) assert.equal(isValidPin(ok), true, ok);
  for (const bad of ['123', '1234567', '12a4', '', null, 1234, ' 1234']) assert.equal(isValidPin(bad), false, String(bad));
});

test('a hashed PIN verifies, a wrong PIN does not', () => {
  const stored = hashPin('4821');
  assert.match(stored, /^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(verifyPin('4821', stored), true);
  assert.equal(verifyPin('4822', stored), false);
  assert.equal(verifyPin('4821', 'garbage'), false);
});

test('two hashes of one PIN differ (salted)', () => {
  assert.notEqual(hashPin('4821'), hashPin('4821'));
});

// The till checks PINs offline in the browser, where only WebCrypto exists.
// Node ships the same WebCrypto, so this proves the browser can verify.
test('WebCrypto reproduces the stored hash', async () => {
  const stored = hashPin('4821');
  const [, iterations, saltHex, hashHex] = stored.split('$');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('4821'), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(saltHex, 'hex'), iterations: Number(iterations) },
    key,
    256
  );
  assert.equal(Buffer.from(bits).toString('hex'), hashHex);
});
