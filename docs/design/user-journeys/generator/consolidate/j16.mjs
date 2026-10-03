// Journey 16, Close the day — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

const CLOSE = 'Cash-up 2–6; WT2 H1, L5';

export default {
  'eod-entry': into('till-sale', 'Cash-up 5', "'Close the day' button in the till bar, Jack Lewis serving; phone: 'It’s after [closing time]' strip"), // a till-bar control hidden by role and time (j11)
  'eod-waiting': into('eod-count', CLOSE, "Till bar offline; step 1 '[n] sales waiting' with 'Check again'; count 'To do · you can count now'"),
  'eod-waiting-banked': into('eod-count', CLOSE, "Counted and 'Bagged'; report step 'Waiting for [n] sales to send' with 'Check again'"),
  'eod-attention': into('eod-count', CLOSE, "Needs attention open, '[n] to check': flagged sales ('Check'), basket and parked sale ('Resume', 'Clear')"),
  'eod-check': keep(9), // opens a box over the page
  'eod-count': keep(7), // the one Close the day page (steps that fold); holds the note-and-coin counter (block 18)
  'eod-count-shown': into('eod-count', CLOSE, "'The till expects [£ expected]' shown before counting; button 'Done counting'"),
  'eod-count-result': into('eod-count', CLOSE, "Counted vs expected, 'How the till worked it out', difference, optional reason; 'Keep this count and go on'"),
  'eod-count-exact': into('eod-count', CLOSE, "Counted equals expected: green 'Spot on' £0.00; 'Keep this count and go on'"),
  'eod-banking': into('eod-count', CLOSE, "Banking open: a paid-out line, 'Leave in the drawer [£ float]', 'Bank [£ counted − float]'"),
  'eod-banking-none': into('eod-count', CLOSE, "Banking open with 'No cash taken out today.' in place of a paid-out"),
  'eod-paidout': keep(9), // opens a box over the page
  'eod-card': into('eod-count', CLOSE, "Card step 'Doesn’t match': both totals, difference, 'On the card machine only' with 'Match to a sale'"),
  'eod-finish': into('eod-count', CLOSE, "Steps 1–5 done; report step 'Ready' with 'Close the day and show the report'"),
  'eod-z': keep(5),
};
