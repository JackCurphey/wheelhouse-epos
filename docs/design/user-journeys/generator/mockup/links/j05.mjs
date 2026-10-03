// Journey 5, Collect the bike and pay — where each button goes in the mockup.
// Sources: docs/decisions/2026-09-30-collect-and-pay-review.md,
// consolidate/j05.mjs, walk-throughs 1, 6 and 8.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

// Settings › Messages: each row's Edit opens that message's wording.
const WORDING = ['Bike ready', 'Booking cancelled', 'Booking confirmed', 'Certificate received', 'Date change answered', 'Item we couldn’t supply', 'New ready date', 'New time offered', 'Order cancelled', 'Order confirmation', 'Order not ready after all', 'Order ready to collect', 'Order still waiting', 'Quote reminder', 'Quote to approve', 'Ready to collect', 'Request declined', 'Request received', 'Work added within your limit', 'Your answers', 'Your bike is no longer put aside', 'Your bike is put aside', 'Your hold ends on [date]', 'Your order is cancelled'];
const messages = {
  ...Object.fromEntries(WORDING.map((m) => [`Edit the wording of ${m}`, go('set-msg-edit')])),
  'Edit the wording of Bike still waiting': go('cp-message-wording'),
  'Edit the wording of Service reminder': go('ac-reminder-wording'),
  'Edit the wording of Review request': go('ac-review-setting'),
  '+ Add your own message': go('set-msg-new'),
  Payments: go('set-pay-ways'),
  'End of day': go('set-eod'),
};

export default {
  '*': {
    // The customer's ready page and paying online
    'Pay £111.00 now': go('cp-pay'),
    'Pay £[rest] now': go('cp-pay-balance'),
    'Add a note for the shop': go('ac-job-note'),
    Change: go('ac-contact'),
    'Photo of Shimano brake pads: rear pads worn — open larger photo': notDrawn('The pads photo enlarged, over the ready-to-collect page'),
    'Pay with Apple Pay': outside('Apple Pay, on Maya’s phone'),
    'Pay with Google Pay': outside('Google Pay, on Maya’s phone'),
    'Pay £111.00': go('cp-paid'),
    'Pay £[rest]': go('cp-paid-balance'),
    'Back to the summary': go('cp-summary'),
    'Try again': go('cp-pay'),
    // The staff job page at the counter (journey 12's)
    'Take payment': go('cp-till'),
    'Hand over': go('cp-collected'),
    Undo: go('cp-ready-paid'),
    'Add item': STAY,
    'Scan barcode': STAY,
    Notes: STAY,
    'Message Maya Patel': go('ac-inbox'),
    'Email Maya Patel': outside('An email to maya@example.test'),
    'Full service checklist 8 of 10 done · 1 note': go('job-checklist'),
    // The till (journey 11's)
    'Maya Patel · workshop job WH-1042': go('cp-ready-unpaid'),
    'Standard service Labour · 60 min · agreed on the job': STAY,
    'Shimano brake pads Part · B05S-RX · agreed on the job': STAY,
    'Fit & adjust brakes Labour · 30 min · agreed on the job': STAY,
    'Standard service Labour · 60 min £65.00': STAY,
    'Fit & adjust brakes Labour · 30 min £18.00': STAY,
    'Replace gear cable Labour £12.00': STAY,
    'Shimano brake pads Part · B05S-RX': STAY,
    'Fit & adjust brakes Labour · 30 min': STAY,
    'Take payment · £111.00': go('till-pay'),
    'Take payment · £74.00': go('till-pay'),
    'Add a customer (optional)': go('till-customer'),
    // Sending the receipt from the till
    Email: go('cp-receipt-address'),
    Text: go('cp-receipt-address-text'),
    'No receipt': go('till-sale'),
    // The till sale's email: the discounted sale (third walk, walk-through 2 H1).
    'Send receipt': go('cp-receipt-email-till'),
    'Send when back online': go('till-sale'),
    'Add the customer': go('till-sale'),
    // The receipt the customer gets
    'Download receipt (PDF)': outside('The receipt as a PDF download'),
    'Email it to me': go('cp-receipt-text-email'),
    Send: go('cp-receipt-email-guest'),
    // From an email the customer isn't signed in yet: sign in first (Signing in;
    // walk-throughs 1 and 12: cust-signin, cust-code, then the account).
    'See it in your account': go('cust-signin'),
    // "Call us": the number opens the phone app, as on the website (walk-through 12 M2).
    '[shop phone]': outside('The phone app, calling the shop'),
    // Today
    Contacted: STAY,
    'Book in': go('job-book-in'),
    'Open the diary': go('diary'),
    // Settings › Workshop › Collection
    'edit it in Messages': go('cp-messages'),
    // The wording pop-up: fill-ins go into the wording where the cursor is
    '+ Amount to pay': STAY,
    '+ Bike': STAY,
    '+ Customer’s first name': STAY,
    '+ Job number': STAY,
    '+ Link to the job': STAY,
    '+ Opening hours': STAY,
    '+ Shop name': STAY,
    'Go back to Wheelhouse’s wording': STAY,
  },
  'cp-ready-deposit': { 'Take payment': go('till-job-balance') },
  'cp-ready-paid': { 'Hand over': go('cp-collected') },
  'cp-pay-balance': { 'Back to the summary': go('cp-summary-deposit') },
  'cp-pay-failed': { 'Back to the summary': go('cp-summary') },
  // Maya is on the sale, so her receipt email has the account link.
  'cp-receipt-address-customer': { 'Send receipt': go('cp-receipt-email') },
  'cp-receipt-address-text': { 'Send receipt': go('cp-receipt-text') },
  'cp-receipt-address-error': { 'Send receipt': STAY }, // the address is wrong: nothing sends
  'cp-receipt-address-save': { 'Add the customer': go('till-sale') },
  'cp-messages': messages,
  'cp-message-wording': messages,
};
