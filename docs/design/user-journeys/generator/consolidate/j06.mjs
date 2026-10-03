// Journey 6, Cycle to Work — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-6-7.md merge table.
import { keep, into, later, same } from './plan.mjs';

const LIST = 'C2W 2, 7 (M2, M3); walk-through 5 M3, H2';
const ORDER = 'C2W 1, 3, 4';
const CERT = 'Walk-through 5 H4, M1, M3';
const PAY = 'C2W 5; walk-through 5 M7 (kept)';
const MSG = 'C2W 6; walk-through 5 M6';

export default {
  // The list and a new order
  'cw-list': keep(3),
  'cw-list-owner': into('cw-list', LIST, "Owner view: 'Owed by providers £[£] · 1 late' link; 'Mark paid' on collected rows"),
  'cw-first-use': into('cw-list', LIST, "Empty: 'No Cycle to Work orders yet', 'No scheme providers yet', 'Add providers'"),
  'cw-new': keep(9),
  'cw-new-not-in-stock': into('cw-new', 'C2W 7 (H5)', "Bike 'None at Bolton or [Second site]'; no hold tick; quote says ordered once applied"),
  'cw-quote': keep(41),
  'cw-quote-deposit': into('cw-quote', 'C2W 6, 7 (M9)', "Closing: order once a £[£] deposit is paid; adds the shop’s rule if not going ahead"),
  'cw-order-held': keep(4),
  // Waiting for the certificate
  'cw-hold-ending': keep(9), // inferred: not in the merge table; a box over the order
  'cw-applied': keep(9), // inferred: not in the merge table; a box over the order
  'cw-order-applied': into('cw-order-held', ORDER, "Bike not in stock; 'Next: order the bike' — 'Maya has applied', 'Order from [supplier]'"),
  'cw-ordered': into('cw-list', LIST, "List with toast 'Ordered [Customer]’s bike from [supplier].' and 'Undo'"),
  'cw-order-deposit': into('cw-order-held', ORDER, "Bike not in stock; 'Waiting for a £[£] deposit before ordering', 'Take the deposit at the till'"),
  'cw-order-anyway': keep(8), // inferred: not in the merge table; report lists "order anyway" under block 8
  'cw-order-deposit-paid': into('cw-order-held', ORDER, "'£[£] deposit paid and the bike ordered'; deposit refunded when the certificate is added"),
  'cw-order-deposit-counted': into('cw-order-held', ORDER, "'Deposit Maya has paid −£[£]' in Who pays what; nothing refunded"),
  'cw-list-hold-ended': into('cw-list', LIST, "Maya’s row 'Still held', 'Hold ended [date] — choose', with a 'Choose' button"),
  'cw-certificate': keep(9),
  'cw-certificate-diff': into('cw-certificate', CERT, "Certificate £[£ less]: 'Change the order to match' or 'Keep the order; Maya pays the £[£] difference'"),
  'cw-certificate-match': keep(9),
  'cw-certificate-more': into('cw-certificate', CERT, "Certificate £[£ more]: 'Keep the order as quoted' (chosen) or 'Change the order to match'"),
  'cw-certificate-late': into('cw-certificate', CERT, "Warning 'Quote ran out on [date] — check the price.'; amounts match"),
  'cw-certificate-released': into('cw-certificate', CERT, "Pop-up 'The bike was released': 'Hold another [Bike]' or 'Order one from [supplier]'"),
  // Collection and payment
  'cw-order-on-order': into('cw-order-held', ORDER, "Certificate received stage; 'Next: the bike arrives' — on order from [supplier], due [date]"),
  'cw-order-deposit-refund': into('cw-order-held', ORDER, "Certificate received; 'Next: refund the deposit' — 'Refund the £[£] deposit' at the till"),
  'cw-list-deposit-refund': into('cw-list', LIST, "Badge '1 deposit to refund'; Maya’s row 'Deposit to refund' with 'Refund the deposit'"),
  'cw-order-get-ready': into('cw-order-held', ORDER, "Certificate received; 'Next: get the bike ready' with 'Mark ready to collect'"),
  'cw-marked-ready': into('cw-order-held', ORDER, "Ready to collect stage; toast 'Marked ready to collect…' with 'Undo'"),
  'cw-order-ready': into('cw-order-held', ORDER, "Ready to collect stage; 'Next: hand over' with a 'Hand over' button"),
  'cw-hand-over': keep(9), // inferred: not in the merge table; checks are ticks inside a form box
  'cw-order-owed': into('cw-order-held', ORDER, "Collected stage; 'Expected £[£] from [Provider] by [date]' less commission, 'Mark paid'"),
  'cw-mark-paid': into('cw-record-payment', PAY, "One bike: 'Mark paid' pop-up over the list — amount, date, provider’s reference"),
  'cw-mark-paid-diff': into('cw-record-payment', PAY, "'£[£] less than expected': 'Save as part paid' or 'Close with a reason…'"),
  'cw-order-part-paid': into('cw-order-held', ORDER, "'£[£] of £[£] received'; 'Mark the rest paid' or 'Close with a reason…'"),
  'cw-order-paid': into('cw-order-held', ORDER, "Last stage; 'Paid' — '£[£] received from [Provider] on [date], as expected'"),
  'cw-owed': keep(3),
  'cw-owed-reports': into('cw-owed', 'Walk-through 5 L1', "Back link says 'Reports' instead of 'Cycle to Work'"),
  'cw-owed-provider': keep(3), // inferred: not in the merge table; one provider's bikes owed
  'cw-record-payment': keep(9),
  'cw-record-payment-more': into('cw-record-payment', PAY, "Received £[£ more]: '£[£] more than expected — check with [Provider]'; 'Save as paid'"),
  // Changes and cancelling
  'cw-more': into('cw-order-held', ORDER, "'More…' menu open: change bike, accessories, provider, 'Release the bike', 'Cancel the order…'"),
  'cw-quote-revised': into('cw-quote', 'C2W 6, 7 (M9)', "'Revised [date]', '[Different bike]'; 'Email the revised quote to Maya'"),
  'cw-cancel': keep(8),
  'cw-cancel-ordered': into('cw-cancel', 'Walk-through 5 M8', "Ordered after applying, with no deposit: 'Keep it as shop stock' or 'Send it back to [supplier]'; tell [Provider]"),
  'cw-cancel-ordered-deposit': into('cw-cancel', 'Walk-through 5 M8', "Ordered after a deposit: 'Deposit £[£] · kept, as your quote said.'"),
  // Today, the customer, settings and messages
  'cw-today': into('op-today', 'Opening the shop 3, 4', "Lines 'Maya Patel · Cycle to Work quote, no certificate yet' and '[Provider] payment is [n] days late'"),
  'cw-today-held': into('op-today', 'Opening the shop 3, 4', "Only the late-payment line; toast 'Maya Patel’s bike is held until [date]…' with 'Undo'"),
  'cw-today-choose': same('op-today-c2w'), // walk-through 5 L2: the same board as op-today-c2w
  'cw-customer-view': keep(37),
  'cw-customer-released': into('cw-customer-view', 'Walk-through 5 M3, M8', "Amber 'Your bike is no longer put aside.' in place of 'put aside until [date]'"),
  'cw-customer-cancelled': into('cw-customer-view', 'Walk-through 5 M3, M8', "'This order is cancelled.' deposit kept; no stages, no 'How to apply'"),
  'cw-email': keep(46),
  'cw-email-certificate-revised': into('cw-email', MSG, "'Certificate received' email: '[Accessory]' taken off, 'Revised quote' attached"),
  'cw-texts-certificate': into('cw-email', MSG, "Texts: 'Ready to collect', 'Certificate received', certificate-less, deposit-refund versions"),
  'cw-texts-hold': into('cw-email', MSG, "Texts: held until a new [date], or 'no longer put aside'"),
  'cw-texts-cancelled': into('cw-email', MSG, "Texts 'Your order is cancelled': deposit kept, deposit refunded, or no deposit"),
  'cw-settings': keep(1),
  'cw-settings-deposit': into('cw-settings', 'C2W 8', "Deposit and 'How to apply' sections open, instead of holding and ordering"),
  'cw-settings-provider': keep(9), // inferred: not in the merge table; a provider's form box
  'cw-messages': into('set-msg-list', 'C2W 8', "Scrolled to 'Cycle to Work messages': six rows from 'Your bike is put aside' on"),
};

// Situation lines with no old drawing behind them (draw-the-decisions CW1).
export const lines = [
  { on: 'cw-customer-view', text: 'Certificate received: What you pay at collection £[£]', who: 'Customer', decision: 'Cycle to Work 6, 7; walk-through 5 H4' },
  { on: 'cw-customer-view', text: 'Ready to collect: What you pay at collection £[£]', who: 'Customer', decision: 'Cycle to Work 6, 7; walk-through 5 H4' },
  // draw-the-answers CW2–CW4.
  { on: 'cw-cancel', text: 'Cancelling before the bike is ordered, with no deposit held: no deposit line; an in-stock bike goes back on sale at Bolton', who: 'Staff, Owner and Manager', decision: 'Cycle to Work 4, 7; 3 Oct (walk-through 5 L4); walk-through 5 M4' },
  { on: 'cw-order-held', text: 'More, as Staff: Cancel the order when it holds no deposit; with a deposit held, A deposit is held: ask a manager to cancel', who: 'Staff', decision: 'Cycle to Work 7; 3 Oct (walk-through 5 L4)' },
  { on: 'cw-customer-view', text: 'Collected: the bike and its frame number', who: 'Customer', decision: 'Cycle to Work 6, 7; walk-through 5 M2' },
  { on: 'cw-customer-view', text: 'Opened from the email\'s See your Cycle to Work bike: a private link, no sign-in, like a repair\'s; also in the website account when signed in', who: 'Customer', decision: 'Cycle to Work 7; 3 Oct (walk-through 12 M4)' },
  // The second walk's smaller questions, 3 Oct (answer 6).
  { on: 'cw-new', text: "Maya isn't a customer yet: + New customer under the Customer box, as on New job, opens Add a customer and puts her on the order; a number someone already has shows [Name] already has this number", who: 'Staff', decision: 'Workshop day 26; Customer service 3, 5; 3 Oct (second walk Q6)' },
  { on: 'cw-order-held', text: 'A bike back after the provider has paid: a manager chooses a refund to the provider or store credit to the customer, and the order reopens', who: 'Owner and Manager', decision: 'Cycle to Work 7 (money steps); 3 Oct (second walk, case 6d)' },
];
