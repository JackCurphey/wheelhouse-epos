// Journey 15, Customer service — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-11-15.md merge table.
import { keep, into, later } from './plan.mjs';

const PAGE = 'Customer service 5, 6, 12; walk-throughs 5 M5, 6 M3, 7 L3';

export default {
  // Customers and the customer page
  'cs-list': keep(3),
  'cs-page': keep(4),
  'cs-page-over': into('cs-page', PAGE),
  'cs-page-new': into('cs-page', PAGE),
  'cs-page-off': into('cs-page', PAGE),
  'cs-sale': into('till-sale-detail', 'Customer service 12; Till 13'),
  'cs-credit': keep(9),
  'cs-edit': into('cs-add', 'Customer service 3, 5, 12(4)'),
  'cs-add': keep(9),
  'cs-add-company': into('cs-add', 'Customer service 3, 5, 12(4)'),
  // A Cycle to Work order on her page
  'cs-page-c2w': into('cs-page', PAGE),
  'cs-page-c2w-collected': into('cs-page', PAGE),
  'cs-search-c2w': into('till-search', 'Walk-through 5 M5'), // journey A's search results
  // Accounts (pay later)
  'cs-account': keep(4),
  'cs-transfer': keep(9),
  // Customer groups
  'cs-groups': into('set-pay-ways', 'Customer service 8'),
  // Privacy requests
  'cs-privacy': keep(3),
  'cs-privacy-delete': into('cs-privacy', 'Customer service 9, 12(2)'),
  'cs-privacy-blocked': into('cs-privacy', 'Customer service 9, 12(2)'),
  // Possible duplicates
  'cs-add-match': into('cs-add', 'Customer service 3, 5, 12(4)'),
  'cs-page-dup': into('cs-page', PAGE),
  'cs-merge': keep(4), // inferred block: report calls the side-by-side compare a one-off, not a block; two detail pages side by side
  // At a Lightspeed shop
  'ls-customer-page': into('cs-page', PAGE),
};
