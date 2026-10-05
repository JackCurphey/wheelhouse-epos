// The booking request key's pure parts (WP-0.2). The customer's client makes a
// key when the customer presses Send and repeats it on every retry, so the
// server accepts each booking request once. Optional until the screens send it.
// Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
import { createHash } from 'node:crypto';

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// { value: null } when the body has no key, { value: { keyHash, bodyHash } }
// for a good one, or { error }. The body hash covers everything but the key
// itself, so it tells a true retry from the same key sent with other details.
export function readRequestKey(body) {
  if (!Object.hasOwn(body, 'requestKey')) return { value: null };
  const { requestKey, ...rest } = body;
  if (typeof requestKey !== 'string' || !KEY_PATTERN.test(requestKey)) return { error: 'Invalid request key' };
  return { value: { keyHash: sha256(requestKey), bodyHash: sha256(JSON.stringify(rest)) } };
}
