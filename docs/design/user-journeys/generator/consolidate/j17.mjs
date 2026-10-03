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
  'rp-vat-check-off': into('rp-vat', ''),
  'rp-margin': keep(5),
  'rp-workshop': keep(5),
  'rp-workshop-all': into('rp-workshop', ''),
  'rp-discounts': keep(5),
  'rp-discounts-staff': into('rp-discounts', ''),
  'rp-returning': keep(5),
  'rp-c2w': keep(5),
  'rp-accounts-connect': into('set-data-export', ''),
  'rp-accounts-map': into('set-data-export', ''),
  'rp-accounts-c2w': into('set-data-export', ''),
  'rp-accounts-missing': into('set-data-export', ''),
  'rp-accounts-log': into('set-data-export', ''),
  'rp-accounts-lost': into('set-data-export', ''),
  'rp-accounts-disconnect': into('set-data-export', ''),
  'rp-today-accounts': into('op-today', ''),
  'rp-person': into('set-staff-person', ''),
};
