// Journey B, Signing in — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'workos-signin': keep(42), // inferred: real screen; closest block is a sign-in page
  'auth-site': keep(13), // inferred: real screen, choosing the shop
  'auth-signedout': keep(40),
  'auth-expired': into('auth-signedout', ''), // Walk-through 8 M4: decision 3 is the workshop computer's PIN screen (on till-checkin), not an email sign-out
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
  'till-checkin-practice': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'cust-signin': keep(42),
  'cust-code': keep(42),
  'cust-code-expired': into('cust-code', 'Signing in 5, 9'),
  'pending': keep(40),
  'expired': into('pending', 'Signing in 10'),
};

// Decisions drawn as lines, with no old drawing behind them
// ("Draw the decisions" spec, section 6: N2, N3, N4).
export const lines = [
  { on: 'till-setup', text: 'Make this computer a workshop computer: it stays signed in as the shop, and each person takes over by typing their PIN', who: 'Owner', decision: 'Walk-through 8, decision 1' },
  { on: 'till-checkin', text: 'A workshop computer: Enter your PIN, and what you do is recorded under your name and role', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 1' },
  { on: 'till-checkin', text: 'A workshop computer left alone for 10 minutes: back to Enter your PIN, nothing lost', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 3; build plan Q6' },
  { on: 'till-checkin', text: 'A till with nobody checked in: only the PIN screen', who: 'Staff', decision: 'Walk-through 8, fix M6 part 1' },
  { on: 'auth-site', text: 'Staff at two shops (Jo Taylor): their two shops, no All shops; the counts only for people who can close the day', who: 'Staff', decision: 'Multiple sites 9; Opening the shop 3 and 4' },
];
