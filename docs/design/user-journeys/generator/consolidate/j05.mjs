// Journey 5, Collect the bike and pay — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // The customer's link: the one customer job page, ready to collect
  'cp-summary': keep(37), // Quote 7 H4 keeps the two-column ready page as a drawing
  'cp-summary-said-yes': into('cp-summary', 'Quote 1'),
  'cp-summary-deposit': into('cp-summary', 'Quote 1'),
  'cp-pay': keep(39),
  'cp-pay-failed': into('cp-pay', 'Collect 2, 5 H1'),
  'cp-pay-balance': into('cp-pay', 'Collect 2, 5 H1'),
  'cp-paid': into('cp-pay', 'Collect 2, 5 H1'),
  'cp-paid-balance': into('cp-pay', 'Collect 2, 5 H1'),
  'cp-summary-paid': into('cp-summary', 'Quote 1'),
  'cp-summary-counter': into('cp-summary', 'Quote 1'),
  'cp-summary-inshop': into('cp-summary', 'Quote 1'),
  'cp-expired': into('cp-summary', 'Walk-through 1 M5'),
  // A Lightspeed shop
  'cp-summary-ls': into('cp-summary', 'Quote 1'),
  'cp-summary-ls-paid': into('cp-summary', 'Quote 1'),
  // At the counter: journey 12's job page and journey 11's till
  'cp-ready-unpaid': into('job-overview', 'Workshop day 20'),
  'cp-ready-deposit': into('job-overview', 'Workshop day 20'),
  'cp-till': into('till-sale', ''),
  'cp-ready-paid': into('job-overview', 'Workshop day 20'),
  'cp-ready-ticks': into('job-overview', 'Workshop day 20'),
  'cp-collected': into('job-overview', 'Workshop day 20'),
  // Not collected
  'cp-today-uncollected': into('op-today', ''),
  // Settings
  'cp-setting': into('bk-settings', 'Receiving 7'), // inferred — Settings › Workshop › Collection has no journey 8 owner; same Settings › Workshop page as bk-settings
  'cp-messages': into('set-msg-list', 'Receiving 7'),
  'cp-message-wording': into('set-msg-list', 'Receiving 7'),
  // The receipt
  'cp-receipt-email': keep(41),
  'cp-receipt-email-guest': into('cp-receipt-email', 'Leftover screens 1, 6 H1'),
  'cp-invoice-email': into('cp-receipt-email', 'Leftover screens 1, 6 H1'),
  'cp-receipt-email-till': into('cp-receipt-email', 'Leftover screens 1, 6 H1'),
  'cp-receipt-email-deposit': into('cp-receipt-email', 'Leftover screens 1, 6 H1'),
  'cp-receipt-text': keep(41),
  'cp-receipt-text-email': into('cp-receipt-text', 'Leftover screens 2'),
  'cp-receipt-address': keep(9),
  'cp-receipt-address-error': into('cp-receipt-address', 'Leftover screens 3'),
  'cp-receipt-address-save': into('cp-receipt-address', 'Leftover screens 3'),
  'cp-receipt-address-text': into('cp-receipt-address', 'Leftover screens 3'),
  'cp-receipt-address-customer': into('cp-receipt-address', 'Leftover screens 3'),
  'cp-receipt-address-offline': into('cp-receipt-address', 'Leftover screens 3'),
  // Also at collection: old Release 1 picture
  'ready': keep(37), // kept: Collect 6 — report says removing `ready` goes against Collect 6 (2026-09-30-collect-and-pay-review.md:83-85 keeps it)
};
