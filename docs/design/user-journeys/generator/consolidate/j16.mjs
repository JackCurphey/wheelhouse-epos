// Journey 16, Close the day — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

const CLOSE = 'Cash-up 2–6; WT2 H1, L5';

export default {
  'eod-entry': into('till-sale', 'Cash-up 5'), // a till-bar control hidden by role and time (j11)
  'eod-waiting': into('eod-count', CLOSE),
  'eod-waiting-banked': into('eod-count', CLOSE),
  'eod-attention': into('eod-count', CLOSE),
  'eod-check': keep(9), // opens a box over the page
  'eod-count': keep(7), // the one Close the day page (steps that fold); holds the note-and-coin counter (block 18)
  'eod-count-shown': into('eod-count', CLOSE),
  'eod-count-result': into('eod-count', CLOSE),
  'eod-count-exact': into('eod-count', CLOSE),
  'eod-banking': into('eod-count', CLOSE),
  'eod-banking-none': into('eod-count', CLOSE),
  'eod-paidout': keep(9), // opens a box over the page
  'eod-card': into('eod-count', CLOSE),
  'eod-finish': into('eod-count', CLOSE),
  'eod-z': keep(5),
};
