// Journey 10, Opening the shop and checking in — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

const TODAY = 'Opening 3, 4, 6, 7, 8; WT2 H1(a), L2; WT5 M3, H2; WT6 M1';

export default {
  'op-float-check': keep(9),
  'op-float-check-unclosed': into('op-float-check', 'Opening 2, 7; WT2 H1(b); WT4 M4'),
  'op-float-check-first': into('op-float-check', 'Opening 2, 7; WT2 H1(b); WT4 M4'),
  'op-float-count': into('eod-count', 'Opening 2; Cash-up 3'), // the note-and-coin counter, drawn once with eod-count (j16)
  'op-float-matched': into('op-float-check', 'Opening 8 H1'),
  'op-float-short': keep(9), // the difference box
  'op-float-over': into('op-float-short', 'Opening 8 H1; WT2 L3'),
  'op-today': keep(6), // owner of Today (brief rule 6)
  'op-today-short': into('op-today', TODAY),
  'op-today-seen': into('op-today', TODAY),
  'op-today-waiting': into('op-today', TODAY),
  'op-today-banked': into('op-today', TODAY),
  'op-today-unclosed': into('op-today', TODAY),
  'op-close-yesterday': into('eod-count', 'Opening 8 H3; WT2 H1'), // a situation of Close the day (j16)
  'op-today-two': into('op-today', TODAY),
  'op-today-staff': into('op-today', TODAY),
  'op-today-late': into('op-today', TODAY),
  'op-today-practice': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'op-today-c2w': into('op-today', TODAY),
  'op-today-staff-lightspeed': into('op-today', TODAY),
  'desk': into('diary', ''), // inferred: link-only old journey 12 board "Today's workshop" (stage2.mjs:141)
};
