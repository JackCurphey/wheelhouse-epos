// Journey B, Signing in — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'workos-signin': keep(42), // inferred: real screen; closest block is a sign-in page
  'auth-site': keep(13), // inferred: real screen, choosing the shop
  'auth-signedout': keep(40),
  'auth-expired': into('auth-signedout', '', "Lock icon; 'Please sign in again' after being signed out 'after a while without activity'"), // Walk-through 8 M4: decision 3 is the workshop computer's PIN screen (on till-checkin), not an email sign-out
  'auth-noaccess': into('staff-app', '', "'Reports aren’t part of your role' card for Jo Taylor (Staff), with 'Go to Today'"),
  'till-setup': keep(1),
  'till-checkin': keep(43),
  'till-checkin-offline': into('till-checkin', 'Leftover 4, Signing in 9', "Amber line 'Offline · [n] sales waiting to send'; the till bar shows offline"),
  'till-checkin-stale': into('till-checkin', 'Leftover 4, Signing in 9', "Amber line 'Online · prices and stock last updated [time] · [n] sales still sending'"),
  'till-pin-wrong': into('till-checkin', 'Leftover 4, Signing in 9', "Dots cleared; 'That PIN isn’t anyone’s — try again'"),
  'pin-change': keep(43),
  'pin-first': into('pin-change', 'Signing in 6–7, Walk-through 4 H1', "First-time version: 'Welcome to North Street Cycles, Jo'; no close; adds 'Skip for now'"),
  'pin-cleared': into('pin-change', 'Signing in 6–7, Walk-through 4 H1', "'Your old PIN was cleared, so here’s a new one'; no close; adds 'Skip for now'"),
  'till-give-pin': into('pin-change', 'Signing in 6–7, Walk-through 4 H1', "'[Name]’s till PIN' over the till: 'Turn the screen to [Name]'"),
  'till-checkin-practice': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'cust-signin': keep(42),
  'cust-code': keep(42),
  'cust-code-expired': into('cust-code', 'Signing in 5, 9', "All six digits in red; 'That code has expired — send a new one'"),
  'pending': keep(40),
  'expired': into('pending', 'Signing in 10', "'This request has expired.' with 'Find a new day' or 'Contact the shop'"),
};

// Decisions drawn as lines, with no old drawing behind them
// ("Draw the decisions" spec, section 6: N2, N3, N4).
export const lines = [
  { on: 'till-setup', text: 'Make this computer a workshop computer: it stays signed in as the shop, and each person takes over by typing their PIN', who: 'Owner', decision: 'Walk-through 8, decision 1' },
  { on: 'till-checkin', text: 'A workshop computer: Enter your PIN, and what you do is recorded under your name and role', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 1' },
  { on: 'till-checkin', text: 'A workshop computer left alone for 10 minutes: back to Enter your PIN, nothing lost', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 3; build plan Q6' },
  { on: 'till-checkin', text: 'A till with nobody checked in: only the PIN screen', who: 'Staff', decision: 'Walk-through 8, fix M6 part 1' },
  { on: 'auth-site', text: 'Staff at two shops (Jo Taylor): their two shops, no All shops; the counts only for people who can close the day', who: 'Staff', decision: 'Multiple sites 9; Opening the shop 3 and 4' },
  // "Draw the answers" spec, section 4: N5, N6.
  { on: 'till-checkin', text: 'While running alongside Citrus Lime: Sales start on switch-over day, [date] · keep using Citrus Lime until then; check-in, search, customers and jobs still work', who: 'Staff', decision: 'Moving from Citrus Lime, 3 Oct (walk-through 4 H2)' },
  { on: 'till-checkin', text: 'Forgotten PIN: the owner or a manager gives a one-time PIN from their phone, read out over a call; you change it here at check-in', who: 'Staff', decision: 'Signing in, 3 Oct (walk-through 10 M2)' },
  { on: 'till-checkin', text: "The keyboard's number keys work too", who: 'Staff', decision: 'Walk-through 10 L1' },
  { on: 'till-checkin', text: 'Taking over a workshop computer announces "Now working: [name]" to a screen reader', who: 'Staff and Mechanic', decision: 'Second walk, 3 Oct, answer 10 (walk-through 8 H1)' },
  { on: 'cust-signin', text: 'From a booking: you come straight back to your booking', who: 'Customer', decision: 'Book a repair 6, 9; walk-through 12 L6' },
];
