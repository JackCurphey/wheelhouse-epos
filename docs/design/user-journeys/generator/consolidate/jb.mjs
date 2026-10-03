// Journey B, Signing in — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'workos-signin': keep(42), // inferred: real screen; closest block is a sign-in page
  'auth-site': keep(13), // inferred: real screen, choosing the shop
  'auth-signedout': keep(40),
  'auth-expired': into('auth-signedout', 'Walk-through 8, decision 3'),
  'auth-noaccess': into('staff-app', ''),
  'till-setup': keep(1),
  'till-checkin': keep(43),
  'till-checkin-offline': into('till-checkin', 'Leftover 4, Signing in 9'),
  'till-checkin-stale': into('till-checkin', 'Leftover 4, Signing in 9'),
  'till-pin-wrong': into('till-checkin', 'Leftover 4, Signing in 9'),
  'pin-change': keep(43),
  'pin-first': into('pin-change', 'Signing in 6–7, Walk-through 4 H1'),
  'pin-cleared': into('pin-change', 'Signing in 6–7, Walk-through 4 H1'),
  'till-give-pin': into('pin-change', 'Signing in 6–7, Walk-through 4 H1'),
  'till-checkin-practice': later('Issue #116 question 4: practice mode dropped'),
  'cust-signin': keep(42),
  'cust-code': keep(42),
  'cust-code-expired': into('cust-code', 'Signing in 5, 9'),
  'pending': keep(40),
  'expired': into('pending', 'Signing in 10'),
};
