// Journey 21, Lightspeed (after the trading week) — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-12-21.md merge table. Consolidated like the rest
// (spec decision log): keep/into, not later.
import { keep, into } from './plan.mjs';

const STRIP = 'Lightspeed 2, 3, 6, 10 (H3), 12';

export default {
  // Connecting Lightspeed
  'ls-settings-off': into('ls-settings-on', 'Lightspeed 7'),
  'ls-connect-signin': keep(7),
  'ls-connect-shops': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)'),
  'ls-connect-shops-two': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)'),
  'ls-connect-checks': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)'),
  'ls-settings-on': keep(1),
  'ls-settings-manager': into('ls-settings-on', 'Lightspeed 7'),
  'ls-disconnect': into('ls-settings-on', 'Lightspeed 10 (L5)'), // report: shared "Are you sure?" box; no owner for it, so a line on the page it opens over
  'ls-reconnect': into('ls-settings-on', 'Lightspeed 7'),
  // Quote and approval
  'ls-today': into('op-today', 'Lightspeed 6, 10'),
  'ls-book-in': into('ls-customer-pick', 'Lightspeed 4; walk-through 6 M1'),
  'ls-job-not-connected': into('ls-job-sent', STRIP),
  'ls-part-search': keep(17),
  'ls-part-search-down': into('ls-part-search', 'Lightspeed 5, 11'),
  'ls-job-sent': keep(24), // the job page's Lightspeed strip, 14 lines
  'ls-job-changed': into('ls-job-sent', STRIP),
  'ls-job-price-changed': into('ls-job-sent', STRIP),
  'ls-job-price-asked': into('ls-job-sent', STRIP),
  'ls-job-cancelled': into('ls-job-sent', STRIP),
  'ls-job-pick': into('ls-job-sent', STRIP),
  'ls-customer-pick': keep(21),
  // When Lightspeed can't be reached
  'ls-job-waiting': into('ls-job-sent', STRIP),
  'ls-job-unsure': into('ls-job-sent', STRIP),
  'ls-job-check': keep(9),
  'ls-today-down': into('op-today', 'Lightspeed 6, 10'),
  'ls-today-person': into('op-today', 'Lightspeed 6, 10'), // repeats op-today-staff-lightspeed
  // Payment and collection
  'ls-job-ready-no-wo': into('ls-job-sent', STRIP),
  'ls-hand-over-no-wo': into('ls-job-check', 'Lightspeed 6; walk-through 6 H2'),
  'ls-job-unpaid': into('ls-job-sent', STRIP),
  'ls-hand-over-unpaid': keep(9),
  'ls-hand-over-found': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)'),
  'ls-hand-over-unreachable': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)'),
  'ls-job-paid': into('ls-job-sent', STRIP),
  'ls-job-fallback': into('ls-job-sent', STRIP),
  'ls-hand-over-unchecked': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)'),
  'ls-job-collected-unpaid': into('ls-job-sent', STRIP),
  'ls-job-sorted': keep(9), // "Mark it sorted" box, kept by the report
  'ls-today-unpaid': into('op-today', 'Lightspeed 6, 10'),
  // Settings and the customer
  'ls-messages': into('set-msg-list', 'Lightspeed 10 (M1, M2)'),
  'ls-office-data': into('ops-log', 'Lightspeed 10 (M1, M2)'), // Settings › Your data's activity log; owner list's activity log is ops-log
  'ls-workshop-settings': into('set-workshop-services', 'Lightspeed 10 (M1, M2)'), // Settings › Workshop page
  'ls-customer-ready': into('cp-summary', 'Walk-through 6 H1'), // report: same as j05's cp-summary-ls; owner list names cp-summary
};
