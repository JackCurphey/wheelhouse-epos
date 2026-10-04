// Journey 6, Cycle to Work — where each button goes in the mockup.
// Sources: docs/decisions/2026-10-02-cycle-to-work-review.md (and its two
// "Later change" notes), consolidate/j06.mjs, walk-through 5.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

// Settings › Messages: each row's Edit opens that message's wording.
const WORDING = ['Bike ready', 'Booking cancelled', 'Booking confirmed', 'Certificate received', 'Date change answered', 'Item we couldn’t supply', 'New ready date', 'New time offered', 'Order cancelled', 'Order confirmation', 'Order not ready after all', 'Order ready to collect', 'Order still waiting', 'Quote reminder', 'Quote to approve', 'Ready to collect', 'Request declined', 'Request received', 'Work added within your limit', 'Your answers', 'Your bike is no longer put aside', 'Your bike is put aside', 'Your hold ends on [date]', 'Your order is cancelled'];
const messages = {
  ...Object.fromEntries(WORDING.map((m) => [`Edit the wording of ${m}`, go('set-msg-edit')])),
  'Edit the wording of Bike still waiting': go('cp-message-wording'),
  'Edit the wording of Service reminder': go('ac-reminder-wording'),
  'Edit the wording of Review request': go('ac-review-setting'),
  '+ Add your own message': go('set-msg-new'),
};

export default {
  '*': {
    'Refund [Customer]’s deposit': go('till-refund'),
    // The sidebar item, with its count (decision 2)
    'Cycle to Work 3 due or late': go('cw-list'),
    // Settings › Front desk tabs
    Payments: go('set-pay-ways'),
    'End of day': go('set-eod'),
    // The list's rows
    '+ New Cycle to Work order': go('cw-new'),
    'Open Maya Patel’s order': go('cw-order-held'),
    'Open [Customer]’s order': go('cw-order-held'),
    'Open [Customer]’s late order': go('cw-order-owed'),
    'Open [Customer]’s paid order': go('cw-order-paid'),
    'Add Maya Patel’s certificate': go('cw-certificate'),
    'Add [Customer]’s certificate': go('cw-certificate'),
    'Order [Customer]’s bike from [supplier]': go('cw-ordered'),
    'Hand over [Customer]’s bike': go('cw-hand-over'),
    'Owed by providers £[£] · 1 late': go('cw-owed'),
    'Mark paid: [Customer] · [Provider]': go('cw-mark-paid'),
    'Mark paid: Maya Patel · [Provider]': go('cw-mark-paid'),
    'Choose what to do with Maya Patel’s hold': go('cw-hold-ending'),
    'Refund Maya Patel’s £[£] deposit': go('till-refund'),
    // The order page
    'More for Maya Patel’s order': go('cw-more'),
    'Add the certificate': go('cw-certificate'),
    'Hold longer': go('cw-hold-ending'),
    'Release the bike': go('cw-hold-ending'),
    'Mark as applied': go('cw-applied'),
    'Order from [supplier]': go('cw-ordered'),
    'Order now anyway…': go('cw-order-anyway'),
    'Take the deposit at the till': go('till-c2w-deposit'),
    'Refund Maya Patel’s £[£] deposit at the till': go('till-refund'),
    'Mark Maya Patel’s bike ready to collect': go('cw-marked-ready'),
    'Hand over': go('cw-hand-over'),
    'Hand over at the till': go('till-c2w'),
    'Mark paid': go('cw-mark-paid'),
    'Mark the rest paid': go('cw-mark-paid'),
    'Close with a reason…': notDrawn('Close a provider’s payment with a reason — the reason box (decision 7, H4)'),
    'Open the supplier order for Maya’s bike': go('rs-order-ordered'),
    'Email the quote again': go('cw-email'),
    'Print the quote': outside('The printer — the quote'),
    'Maya Patel': go('cs-page-c2w'),
    'Change Maya’s application details': go('cw-applied'),
    // More…
    'Change the bike or size': go('cw-quote-revised'),
    'Change the accessories': go('cw-quote-revised'),
    'Change the provider': go('cw-quote-revised'),
    'Cancel the order…': go('cw-cancel'),
    'Cancel the order': notDrawn('The order’s page for staff once it is cancelled'),
    'Keep the order': BACK,
    // The certificate
    'Next: what to take off': go('cw-certificate-match'),
    'Save and email Maya': go('cw-order-ready'),
    'Decide later': BACK,
    // New order and the quote
    'Maya Patel · 07700 900 142': STAY,
    '[Provider]': STAY,
    '[Bike] · [Size]': STAY,
    '[Accessory] · [Accessory]': STAY,
    'Make the quote': go('cw-quote'),
    'Email to Maya': go('cw-email'),
    'Email the revised quote to Maya': go('cw-email'),
    'Maya Patel · Cycle to Work': go('cw-order-held'),
    // Order now anyway
    'Order now': go('cw-ordered'),
    // Owed by providers
    'Download as spreadsheet': outside('A spreadsheet download of what providers owe'),
    Download: outside('A spreadsheet download of what providers owe'),
    '[Provider]: bikes owed and Record a payment': go('cw-owed-provider'),
    'Owed by Cycle to Work providers': go('cw-owed'),
    'Record a payment': go('cw-record-payment'),
    '[Customer]': go('cw-order-owed'),
    'Save as paid': go('cw-owed-provider'),
    'Save as part paid': go('cw-order-part-paid'),
    // Today
    'Hold Maya Patel’s bike longer': go('cw-today-held'),
    'Open [Provider]’s late payment': go('cw-order-owed'),
    'Release Maya Patel’s bike': go('cw-hold-ending'),
    'Refund Maya Patel’s deposit': go('till-refund'),
    'Open the diary': go('diary'),
    'Book in': go('job-book-in'),
    // First use and Settings
    'Add providers': go('cw-settings-provider'),
    'Set how bikes are held and ordered': go('cw-settings'),
    '+ Add a provider': go('cw-settings-provider'),
    'Edit [Provider]': go('cw-settings-provider'),
    'Retire [Provider]': notDrawn('Retiring a scheme provider — what it asks first'),
    // The customer's side
    // Maya's link opens the quote itself, the PDF the email attaches (third walk, walk-through 5 M1).
    'See your quote': outside('The quote as a PDF, the one the email attaches'),
    'Ask the shop a question': go('ac-ask'),
    'See your Cycle to Work bike': go('cw-customer-view'),
  },
  'cw-owed': { '[Provider]': go('cw-owed-provider') },
  'cw-owed-reports': { '[Provider]': go('cw-owed-provider') },
  'cw-mark-paid': { 'Mark paid': go('cw-order-paid') },
  'cw-applied': { Save: go('cw-order-applied') },
  'cw-hold-ending': { Save: go('cw-order-held') }, // Hold longer is the chosen option
  'cw-certificate': { Save: go('cw-order-ready') }, // "The bike is ready" ticked
  'cw-certificate-late': { Save: go('cw-order-ready') },
  'cw-certificate-more': { Save: go('cw-order-ready') }, // "Keep the order as quoted" chosen
  'cw-certificate-released': { Save: go('cw-order-get-ready') }, // "Hold another" chosen: put aside, not yet ready
  'cw-record-payment': { Save: go('cw-owed-provider'), 'Maya Patel': go('cw-order-owed') },
  'cw-record-payment-more': { 'Maya Patel': go('cw-order-owed') },
  'cw-owed-provider': { 'Maya Patel': go('cw-order-owed') },
  'cw-settings-provider': { Save: go('cw-settings') },
  'cw-ordered': { Undo: go('cw-order-applied') },
  'cw-marked-ready': { Undo: go('cw-order-get-ready') },
  'cw-today-held': { Undo: go('cw-today') },
  'cw-messages': messages,
};
