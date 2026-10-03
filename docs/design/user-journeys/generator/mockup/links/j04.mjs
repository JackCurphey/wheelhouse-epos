// Journey 4, Drop off and approve the quote — where each button goes in the mockup.
// Sources: docs/decisions/2026-10-01-drop-off-and-quote-review.md,
// consolidate/j04.mjs, walk-throughs 1, 6 and 8.
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
    // The customer's job page
    'Add a note for the shop': go('ac-job-note'),
    'Photo of Shimano brake pads: rear pads worn — open larger photo': go('dq-quote-photo'),
    'Approve £111.00': go('dq-answered'),
    'Approve £123.00': go('dq-answered'),
    'Approve £[total]': go('dq-answered'),
    'Approve £[new total]': go('dq-answered'),
    'Decline the extra work': go('dq-answered-declined'),
    'No thanks — keep to £111.00': go('dq-answered-price-no-ls'),
    'Pay £111.00 now': go('cp-pay'),
    // The staff job page (journey 12's, at the quote)
    'Send quote': go('dq-job-sent'),
    Undo: go('dq-job-quote'),
    'See what Maya sees': go('dq-quote'),
    'Record their answer': go('dq-record-answer'),
    'Save: yes to 2 lines, no thanks to 1': go('dq-job-answered'),
    'Withdraw quote': go('dq-job-withdraw'),
    'Keep the quote': BACK,
    'Save and tell Maya': go('dq-within-limit'),
    'Start work': go('job-mechanic'),
    'Mark ready for collection': go('cp-ready-unpaid'),
    'Add item': STAY,
    'Scan barcode': STAY,
    Notes: STAY,
    'Message Maya Patel': go('ac-inbox'),
    'Email Maya Patel': outside('An email to maya@example.test'),
    'Full service checklist 0 of 10 done · 0 notes': go('job-checklist'),
    'Full service checklist 8 of 10 done · 1 note': go('job-checklist'),
    '1 photo — view or add for Shimano brake pads': notDrawn('The staff job page: a line’s photos, to view or add'),
    'Add photo for Fit & adjust brakes': outside('The tablet’s camera or photo library'),
    'Add photo for Replace gear cable': outside('The tablet’s camera or photo library'),
    // Today and the diary
    '07700 900 142': outside('A phone call to Maya'),
    'Open the diary': go('diary'),
    'Showing Everyone. Change whose jobs are shown': STAY,
  },
  // The confirm button in the "Withdraw this quote?" box: Maya's page then says withdrawn.
  'dq-job-withdraw': { 'Withdraw quote': go('dq-withdrawn') },
  // On the ready page (journey 5's cp-summary) no enlarged photo is drawn.
  'dq-ready': { 'Photo of Shimano brake pads: rear pads worn — open larger photo': notDrawn('The pads photo enlarged, over the ready-to-collect page') },
  'dq-messages': messages,
};
