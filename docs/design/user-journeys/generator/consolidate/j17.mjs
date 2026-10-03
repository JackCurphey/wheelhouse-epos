// Journey 17, Reports and accounts — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'rp-home': keep(5),
  'rp-home-staff': into('rp-home', ''),
  'rp-report-menu': into('rp-home', ''),
  'rp-report-deleted': into('rp-home', ''),
  'rp-your-settings': into('your-settings', ''),
  'rp-sales': keep(5),
  'rp-sales-all': into('rp-sales', ''),
  'rp-sales-year': into('rp-sales', ''),
  'rp-sales-empty': into('rp-sales', ''),
  'rp-pick-dates': into('rp-sales', ''),
  'rp-change': keep(9), // inferred: the one box kept as its own screen
  'rp-changed': into('rp-sales', ''), // inferred
  'rp-save': into('rp-change', ''), // inferred
  'rp-save-taken': into('rp-change', ''), // inferred
  'rp-takings': keep(5),
  'rp-takings-all': into('rp-takings', ''),
  'rp-day': keep(5),
  'rp-reopen': into('rp-day', ''), // inferred
  'rp-takings-reopened': into('rp-takings', ''),
  'rp-vat': keep(5),
  'rp-vat-first': into('rp-vat', ''), // inferred
  'rp-vat-all': into('rp-vat', ''),
  'rp-vat-check-off': later('Issue #116 question 6: invoice check later'),
  'rp-margin': keep(5),
  'rp-workshop': keep(5),
  'rp-workshop-all': into('rp-workshop', ''),
  'rp-discounts': keep(5),
  'rp-discounts-staff': into('rp-discounts', ''),
  'rp-returning': keep(5),
  'rp-c2w': keep(5),
  'rp-accounts-connect': keep(1), // Settings › Your data › Accounts software: its own page (Reports and accounts 4)
  'rp-accounts-map': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-accounts-c2w': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-accounts-missing': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-accounts-log': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-accounts-lost': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-accounts-disconnect': into('rp-accounts-connect', 'Reports and accounts 4'),
  'rp-today-accounts': into('op-today', ''),
  'rp-person': into('set-staff-person', ''),
};

// Decisions drawn as lines, with no old drawing behind them ("Draw the
// decisions" spec, section 2: R2–R4).
export const lines = [
  { on: 'rp-home', text: 'Staff with Can see reports, without Can see costs and margin: no margin figure in the strip', who: 'Staff', decision: 'Reports and accounts 5; issue #116 question 1' },
  { on: 'rp-margin', text: 'Margin and stock value for all shops: a shop column', who: 'Owner', decision: 'Reports and accounts 8 (M13)' },
  { on: 'rp-discounts', text: 'Discounts and refunds for all shops: a shop column', who: 'Owner', decision: 'Reports and accounts 8 (M13)' },
];
