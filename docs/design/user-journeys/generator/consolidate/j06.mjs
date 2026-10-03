// Journey 6, Cycle to Work — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-6-7.md merge table.
import { keep, into, later } from './plan.mjs';

const LIST = 'C2W 2, 7 (M2, M3); walk-through 5 M3, H2';
const ORDER = 'C2W 1, 3, 4';
const CERT = 'Walk-through 5 H4, M1, M3';
const PAY = 'C2W 5; walk-through 5 M7 (kept)';
const MSG = 'C2W 6; walk-through 5 M6';

export default {
  // The list and a new order
  'cw-list': keep(3),
  'cw-list-owner': into('cw-list', LIST),
  'cw-first-use': into('cw-list', LIST),
  'cw-new': keep(9),
  'cw-new-not-in-stock': into('cw-new', 'C2W 7 (H5)'),
  'cw-quote': keep(41),
  'cw-quote-deposit': into('cw-quote', 'C2W 6, 7 (M9)'),
  'cw-order-held': keep(4),
  // Waiting for the certificate
  'cw-hold-ending': keep(9), // inferred: not in the merge table; a box over the order
  'cw-applied': keep(9), // inferred: not in the merge table; a box over the order
  'cw-order-applied': into('cw-order-held', ORDER),
  'cw-ordered': into('cw-list', LIST),
  'cw-order-deposit': into('cw-order-held', ORDER),
  'cw-order-anyway': keep(8), // inferred: not in the merge table; report lists "order anyway" under block 8
  'cw-order-deposit-paid': into('cw-order-held', ORDER),
  'cw-order-deposit-counted': into('cw-order-held', ORDER),
  'cw-list-hold-ended': into('cw-list', LIST),
  'cw-certificate': keep(9),
  'cw-certificate-diff': into('cw-certificate', CERT),
  'cw-certificate-match': keep(9),
  'cw-certificate-more': into('cw-certificate', CERT),
  'cw-certificate-late': into('cw-certificate', CERT),
  'cw-certificate-released': into('cw-certificate', CERT),
  // Collection and payment
  'cw-order-on-order': into('cw-order-held', ORDER),
  'cw-order-deposit-refund': into('cw-order-held', ORDER),
  'cw-list-deposit-refund': into('cw-list', LIST),
  'cw-order-get-ready': into('cw-order-held', ORDER),
  'cw-marked-ready': into('cw-order-held', ORDER),
  'cw-order-ready': into('cw-order-held', ORDER),
  'cw-hand-over': keep(9), // inferred: not in the merge table; checks are ticks inside a form box
  'cw-order-owed': into('cw-order-held', ORDER),
  'cw-mark-paid': into('cw-record-payment', PAY),
  'cw-mark-paid-diff': into('cw-record-payment', PAY),
  'cw-order-part-paid': into('cw-order-held', ORDER),
  'cw-order-paid': into('cw-order-held', ORDER),
  'cw-owed': keep(3),
  'cw-owed-reports': into('cw-owed', 'Walk-through 5 L1'),
  'cw-owed-provider': keep(3), // inferred: not in the merge table; one provider's bikes owed
  'cw-record-payment': keep(9),
  'cw-record-payment-more': into('cw-record-payment', PAY),
  // Changes and cancelling
  'cw-more': into('cw-order-held', ORDER),
  'cw-quote-revised': into('cw-quote', 'C2W 6, 7 (M9)'),
  'cw-cancel': keep(8),
  'cw-cancel-ordered': into('cw-cancel', 'Walk-through 5 M8'),
  'cw-cancel-ordered-deposit': into('cw-cancel', 'Walk-through 5 M8'),
  // Today, the customer, settings and messages
  'cw-today': into('op-today', 'Opening the shop 3, 4'),
  'cw-today-held': into('op-today', 'Opening the shop 3, 4'),
  'cw-today-choose': into('op-today', 'Opening the shop 3, 4'), // the same board as op-today-c2w
  'cw-customer-view': keep(37),
  'cw-customer-released': into('cw-customer-view', 'Walk-through 5 M3, M8'),
  'cw-customer-cancelled': into('cw-customer-view', 'Walk-through 5 M3, M8'),
  'cw-email': keep(46),
  'cw-email-certificate-revised': into('cw-email', MSG),
  'cw-texts-certificate': into('cw-email', MSG),
  'cw-texts-hold': into('cw-email', MSG),
  'cw-texts-cancelled': into('cw-email', MSG),
  'cw-settings': keep(1),
  'cw-settings-deposit': into('cw-settings', 'C2W 8'),
  'cw-settings-provider': keep(9), // inferred: not in the merge table; a provider's form box
  'cw-messages': into('set-msg-list', 'C2W 8'),
};

// Situation lines with no old drawing behind them (draw-the-decisions CW1).
export const lines = [
  { on: 'cw-customer-view', text: 'Certificate received: What you pay at collection £[£]', who: 'Customer', decision: 'Cycle to Work 6, 7; walk-through 5 H4' },
  { on: 'cw-customer-view', text: 'Ready to collect: What you pay at collection £[£]', who: 'Customer', decision: 'Cycle to Work 6, 7; walk-through 5 H4' },
];
