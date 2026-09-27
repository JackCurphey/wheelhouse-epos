// Staff PINs for checking in at the till. The till verifies them offline in
// the browser, so the hash is PBKDF2-SHA256 (built into WebCrypto) rather than
// the scrypt used for passwords in auth.js. A 4-6 digit PIN is a presence
// check, not strong security: anyone holding the till's copy could work it
// out. It protects nothing beyond the till.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §4
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100000;
const PREFIX = 'pbkdf2-sha256';

export function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin);
}

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256');
  return `${PREFIX}$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;
  const [, iterations, saltHex, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), Number(iterations), expected.length, 'sha256');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
