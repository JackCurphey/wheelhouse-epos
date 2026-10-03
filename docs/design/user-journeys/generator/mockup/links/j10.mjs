// Journey 10, Opening the shop and checking in — where each button goes in the mockup.
// Sources: Opening the shop decisions 2, 3, 7, 8 (H1, H3); Cycle to Work 3, 7
// (L7: "Hold longer" on Today holds at once); Lightspeed UI audit ("See the
// jobs" has no destination drawn).
import { go, STAY, notDrawn } from '../controls.mjs';

export default {
  '*': {
    'Refund [Customer]’s deposit': go('till-refund'),
    // The till behind the float check: quick buttons add to the sale; the
    // basket is empty, so Take payment is off.
    'Standard service Labour · 60 min £65.00': STAY,
    'Fit & adjust brakes Labour · 30 min £18.00': STAY,
    'Replace gear cable Labour £12.00': STAY,
    'Add a customer (optional)': go('till-customer'),
    'Take payment': STAY,
    // Today
    'Open the diary': go('diary'),
    'Book in': go('job-book-in'),
  },
  // The float check (decision 2; M1: Count it and Looks right are the only ways out)
  'op-float-check': { 'Count it': go('op-float-count'), 'Looks right': go('till-empty', 'Float checked · looked right · Jo Taylor') }, // third walk, walk-through 2 M2: only a count says "counted by"
  'op-float-check-first': { 'Count it': go('op-float-count') },
  'op-float-check-unclosed': { 'Count it': go('op-float-count') },
  'op-float-count': { 'Done counting': go('op-float-matched') },
  'op-float-short': { 'Count again': go('op-float-count'), 'Start the day': go('till-empty') },
  'op-float-over': { 'Count again': go('op-float-count'), 'Start the day': go('till-empty') },
  // Today's Needs attention (H3: Seen clears it; Close it lands on yesterday's close the day)
  'op-today-short': { Seen: go('op-today-seen') },
  'op-today-two': { Seen: go('op-today-unclosed'), 'Close it': go('op-close-yesterday') },
  'op-today-unclosed': { 'Close it': go('op-close-yesterday') },
  'op-today-waiting': { 'Check again': STAY },
  'op-today-c2w': {
    'Hold Maya Patel’s bike longer': go('cw-today-held'),
    'Release Maya Patel’s bike': go('cw-hold-ending'),
    'Refund Maya Patel’s deposit': go('till-refund'),
  },
  'op-today-staff-lightspeed': {
    'See the jobs that need someone to look at Lightspeed': notDrawn('The jobs waiting for someone to look at Lightspeed (the Lightspeed audit says where “See the jobs” goes isn’t drawn)'),
  },
  // Yesterday's close the day, at banking
  'op-close-yesterday': {
    'Serving: Jack Lewis — switch who’s serving': STAY,
    'Add a paid-out': go('eod-paidout'),
    'Banking bagged — next step': go('eod-finish'),
  },
};
