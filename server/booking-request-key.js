// The booking request key's pure parts (WP-0.2). The customer's client makes a
// key when the customer presses Send and repeats it on every retry, so the
// server accepts each booking request once. Optional until the screens send it.
// Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
import { createHash } from 'node:crypto';

// At least 32 characters: the booking's private link is worked out from the
// key (linkCode below), so the key must be as hard to guess as a link.
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// { value: null } when the body has no key, { value: { keyHash, bodyHash,
// linkCode } } for a good one, or { error }. The body hash covers everything
// but the key itself, so it tells a true retry from the same key sent with
// other details. The link code is worked out from the key, so every reply to
// the same request carries the same private link: a slow first request that
// replays after its retry can't change the link the customer is holding.
// Only its hash is stored (booking-link.js), as for any other link.
export function readRequestKey(body) {
  if (!Object.hasOwn(body, 'requestKey')) return { value: null };
  const { requestKey, ...rest } = body;
  if (typeof requestKey !== 'string' || !KEY_PATTERN.test(requestKey)) return { error: 'Invalid request key' };
  return {
    value: {
      keyHash: sha256(requestKey),
      bodyHash: sha256(JSON.stringify(rest)),
      linkCode: sha256(`booking-link:${requestKey}`),
    },
  };
}
