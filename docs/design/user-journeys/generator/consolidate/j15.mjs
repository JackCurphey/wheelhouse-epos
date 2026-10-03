// Journey 15, Customer service — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-11-15.md merge table.
import { keep, into, later } from './plan.mjs';

const PAGE = 'Customer service 5, 6, 12; walk-throughs 5 M5, 6 M3, 7 L3';

export default {
  // Customers and the customer page
  'cs-list': keep(3),
  'cs-page': keep(4),
  'cs-page-over': into('cs-page', PAGE, "Shows 'Over her limit by [£]' instead of 'Owes [£ owed]'"),
  'cs-page-new': into('cs-page', PAGE, "History empty: 'Nothing yet — Jobs, sales and messages show here, newest first.'"),
  'cs-page-off': into('cs-page', PAGE, "No 'Owes' line and no 'Owes on account' — accounts switched off"),
  'cs-sale': into('till-sale-detail', 'Customer service 12; Till 13', "Sale opened over her page: lines, 'Paid by', 'Print the receipt' and 'Refund at the till'"),
  'cs-credit': keep(9),
  'cs-edit': into('cs-add', 'Customer service 3, 5, 12(4)', "'Edit Maya Patel’s details' over her page, filled in; 'Save changes'"),
  'cs-add': keep(9),
  'cs-add-company': into('cs-add', 'Customer service 3, 5, 12(4)', "Company or club: 'Company or club name', 'Contact name', 'VAT number', 'Send invoices to'"),
  // A Cycle to Work order on her page
  'cs-page-c2w': into('cs-page', PAGE, "History has 'Cycle to Work · [Bike] · Waiting for the certificate' order, quote and held-until date"),
  'cs-page-c2w-collected': into('cs-page', PAGE, "Bikes shows '[Bike] · [Size]' with frame number; order line reads 'Collected' with its sale"),
  'cs-search-c2w': into('till-search', 'Walk-through 5 M5', "Search results group 'Cycle to Work orders' with 'Open the order'; found by quote or certificate number"), // journey A's search results
  // Accounts (pay later)
  'cs-account': keep(4),
  'cs-transfer': keep(9),
  // Customer groups
  'cs-groups': into('set-pay-ways', 'Customer service 8', "Customer groups list: '[n] customers', '[n]% off', 'Edit', '+ Add a group'"),
  // Privacy requests
  'cs-privacy': keep(3),
  'cs-privacy-delete': into('cs-privacy', 'Customer service 9, 12(2)', "Confirm 'Delete [Customer]’s details?' — sales and jobs stay without the name; 'Keep their details'"),
  'cs-privacy-blocked': into('cs-privacy', 'Customer service 9, 12(2)', "'Settle up first': account owed, store credit, bike WH-1042 still open; 'OK'"),
  // Possible duplicates
  'cs-add-match': into('cs-add', 'Customer service 3, 5, 12(4)', "Warns 'Maya Patel already has this number' with 'Use Maya Patel'"),
  'cs-page-dup': into('cs-page', PAGE, "Flag 'Might be the same person as Maya P. · same phone number' with 'Check'"),
  'cs-merge': keep(4), // inferred block: report calls the side-by-side compare a one-off, not a block; two detail pages side by side
  // At a Lightspeed shop
  'ls-customer-page': into('cs-page', PAGE, "Line 'In Lightspeed: Maya Patel' with link date and 'Change'; no till or stock rooms"),
};
