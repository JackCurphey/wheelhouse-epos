// Journey 10, Opening the shop and checking in — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

const TODAY = 'Opening 3, 4, 6, 7, 8; WT2 H1(a), L2; WT5 M3, H2; WT6 M1';

export default {
  'op-float-check': keep(9),
  'op-float-check-unclosed': into('op-float-check', 'Opening 2, 7; WT2 H1(b); WT4 M4', "Float 'plus Wednesday’s cash [£]'; 'Count it' only, no 'Looks right'"),
  'op-float-check-first': into('op-float-check', 'Opening 2, 7; WT2 H1(b); WT4 M4', "'first in on the first day on Wheelhouse'; 'Count it' only, no 'Looks right'"),
  'op-float-count': into('eod-count', 'Opening 2; Cash-up 3', "'Count the float' pop-up over the till; 'Back' and greyed 'Done counting'"), // the note-and-coin counter, drawn once with eod-count (j16)
  'op-float-matched': into('op-float-check', 'Opening 8 H1', "Pop-up gone; message 'Float checked · Till B1 · counted by Jo Taylor'"),
  'op-float-short': keep(9), // the difference box
  'op-float-over': into('op-float-short', 'Opening 8 H1; WT2 L3', "'The float is over'; difference reads '[£] over'"),
  'op-today': keep(6), // owner of Today (brief rule 6)
  'op-today-short': into('op-today', TODAY, "Till B1 tagged 'Float short'; Needs attention line 'float was [£] short' with 'Seen'"),
  'op-today-seen': into('op-today', TODAY, "Till B1 tagged 'Float short · seen by Jack Lewis'; the Needs attention line gone"),
  'op-today-waiting': into('op-today', TODAY, "Till B1 tagged '[n] sales waiting to send'; 'last in touch at [time]' line with 'Check again'"),
  'op-today-banked': into('op-today', TODAY, "Tills adds 'Wednesday counted and banked · waiting for [n] sales to send', 'Closes by itself'"),
  'op-today-unclosed': into('op-today', TODAY, "Needs attention: 'Wednesday 16 September wasn’t closed' with 'Close it'"),
  'op-close-yesterday': into('eod-count', 'Opening 8 H3; WT2 H1', "For Wednesday 16 September, opens at banking: 'Bank Wednesday’s cash'; count 'Counted this morning by Jo Taylor'"), // a situation of Close the day (j16)
  'op-today-two': into('op-today', TODAY, "'Needs attention · 2': the short float ('Seen') and Wednesday not closed ('Close it')"),
  'op-today-staff': into('op-today', TODAY, "Jo Taylor, Staff: only Who’s in and Workshop today; no Tills, no Needs attention"),
  'op-today-late': into('op-today', TODAY, "Who’s in: Alex Morgan 'Due in at [start time]', tagged 'Late'"),
  'op-today-practice': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'op-today-c2w': into('op-today', TODAY, "Needs attention: hold ended ('Hold longer', 'Release the bike') and 'Deposit to refund · [Customer]'"),
  'op-today-staff-lightspeed': into('op-today', TODAY, "Staff at a Lightspeed shop: '2 jobs need someone to look at Lightspeed', a Lightspeed 'Up to date' line; no Tills or Who’s in"),
  'desk': into('diary', '', "'Today’s workshop': three figure tiles, 'Arrivals · 3' tabs and an arrivals table, not the diary grid"), // inferred: link-only old journey 12 board "Today's workshop" (stage2.mjs:141)
};

// "Draw the answers" OP1: walk-through 2 second walk H1 (UX walk-through
// decisions 5, later change 3 Oct), shown to those who see Needs attention.
export const lines = [
  { on: 'op-today', text: '[n] refunds to finish · Finish: finishing one opens the refund with the sale and items filled in', who: 'Owner, Manager, or anyone with Can close the day', decision: 'UX walk-through decisions 5; 3 Oct (walk-through 2 H1)' },
  // Third walk, 3 Oct (walk-through 2 M2).
  { on: 'op-float-check', text: "Looks right: the till opens with 'Float checked · looked right · [Name]'; only a count says 'counted by'", who: 'Staff', decision: 'Opening the shop 2, 8 (H1); UX walk-through decisions 2 Oct; 3 Oct (third walk, walk-through 2 M2)' },
];
