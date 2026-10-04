// Journey 7, Your account and reminders — where each button goes in the mockup.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

const PRIVACY = notDrawn('The shop’s Privacy page (Words and photos, Website 3 Oct)');
const RECEIPT = go('ac-receipt');
const JOB_IN_SHOP = go('dq-in-shop'); // the job's page, journey 4 (Account 1)
const NOTE_ANSWERED = go('ac-job-note-answered');
const QUESTION = go('ac-question');
const QUESTION_WAITING = notDrawn('The question’s own page before the shop replies (only the answered page, ac-question, is drawn)');

// Settings › Messages: each row's Edit opens its wording box.
const WORDING = Object.fromEntries([
  'Bike ready', 'Booking cancelled', 'Booking confirmed', 'Certificate received', 'Date change answered',
  'Item we couldn’t supply', 'New ready date', 'New time offered', 'Order cancelled', 'Order confirmation',
  'Order not ready after all', 'Order ready to collect', 'Order still waiting', 'Quote reminder', 'Quote to approve',
  'Ready to collect', 'Request declined', 'Request received', 'Work added within your limit', 'Your answers',
  'Your bike is no longer put aside', 'Your bike is put aside', 'Your hold ends on [date]', 'Your order is cancelled',
].map((m) => [`Edit the wording of ${m}`, go('set-msg-edit')]));

export default {
  '*': {
    // The account page (and boxes over it)
    '+ Add a bike': notDrawn('Add a bike, on the customer’s website account'),
    'Edit your details': notDrawn('Edit your details, on the customer’s website account'),
    'Ask the shop a question': go('ac-ask'),
    'Change how we contact you': go('ac-contact'),
    'Download a copy of your data': go('ac-download'),
    'Ask us to delete your account': go('ac-delete'),
    'Privacy notice': PRIVACY,
    'privacy notice': PRIVACY,
    'Show more': STAY,
    'Book a repair for your [Bike]': go('bk-service'),
    'Cancel my request': go('ac-account-delete-cancelled'),
    // History rows, desktop and phone wordings
    'Repair WH-1042 · Trek Domane AL 3 · Standard service Booked in Thu 17 Sep · expected ready Thu 17 Sep In the shop ›': JOB_IN_SHOP,
    'WH-1042 · Trek Domane AL 3 · Standard service Repair · Booked in Thu 17 Sep · expected ready Thu 17 Sep In the shop ›': JOB_IN_SHOP,
    'Repair WH-[0000] · Trek Domane AL 3 · [Work done] [date] · collected · receipt £[total] ›': RECEIPT,
    'WH-[0000] · Trek Domane AL 3 · [Work done] Repair · [date] · collected · receipt £[total] ›': RECEIPT,
    'Purchase B1-[0000] · [Items bought] [date] · in the shop · receipt £[total] ›': RECEIPT,
    'B1-[0000] · [Items bought] Purchase · [date] · in the shop · receipt £[total] ›': RECEIPT,
    'Purchase Order [order number] · [Items bought] [date] · online · receipt £[total] ›': RECEIPT,
    'Order [order number] · [Items bought] Purchase · [date] · online · receipt £[total] ›': RECEIPT,
    'Cycle to Work [Bike] · Collected Quote [quote number] · collected [date] · receipt ›': go('cw-customer-view'),
    '[Bike] · Collected Cycle to Work · Quote [quote number] · collected [date] · receipt ›': go('cw-customer-view'),
    'Message Note on WH-1042 [date] · North Street Cycles replied Replied ›': NOTE_ANSWERED,
    'Note on WH-1042 Message · [date] · North Street Cycles replied Replied ›': NOTE_ANSWERED,
    'Message [The first line of Maya’s question] [date] · North Street Cycles replied Replied ›': QUESTION,
    '[The first line of Maya’s question] Message · [date] · North Street Cycles replied Replied ›': QUESTION,
    'Message [The first line of Maya’s question] [date] · waiting for a reply Sent ›': QUESTION_WAITING,
    '[The first line of Maya’s question] Message · [date] · waiting for a reply Sent ›': QUESTION_WAITING,
    // Notes on a job's page
    'Add a note for the shop': go('ac-job-note'),
    // Staff Messages inbox
    '07700 900 142': outside('The phone, calling Maya Patel'),
    'Customer page': go('cs-page'),
    'Open the job': go('job-overview'),
    'Needs a reply: Maya Patel': go('ac-inbox'),
    'Maya Patel': go('ac-inbox-sent'),
    // Coverage walks, answer 3: Maya's question from her account is a line on Messages.
    'Needs a reply: Maya Patel · Question from her account': go('ac-inbox', 'Showing Maya’s job note: her question from her account reads the same, with no bike or job, and the reply says “Sent to Maya by text, with a link to her question” (see the lines below).'),
    '[Customer name]': notDrawn('Another customer’s answered question, opened in Messages'),
    'Oliver Chen': notDrawn('Oliver Chen’s answered conversation, opened in Messages'),
    'Messages · needs a reply 2': go('ac-inbox-list'),
    'Messages · needs a reply 1': go('ac-inbox-list'),
    'Send reply': go('ac-inbox-sent'),
    'See the text Maya gets': go('ac-reply-text'),
    // Settings › Messages (and its wording boxes)
    ...WORDING,
    'Edit the wording of Service reminder': go('ac-reminder-wording'),
    'Edit the wording of Review request': go('ac-review-first'), // its row is Off (coverage walk 11 M1)
    'Edit the wording of Bike still waiting': go('cp-message-wording'),
    '+ Add your own message': go('set-msg-new'),
    Payments: go('set-pay-ways'),
    'End of day': go('set-eod'),
    '+ Customer’s first name': STAY, '+ Shop name': STAY, '+ Bike': STAY, '+ Service': STAY,
    '+ Link to book': STAY, '+ Link to review': STAY,
    'Go back to Wheelhouse’s wording': STAY,
    Save: go('set-msg-list'),
    // Settings › Workshop › Services
    '+ Add a service': notDrawn('Add a service, in Settings › Workshop › Services'),
    'Move Standard service — drag, or use the arrow keys': STAY,
    'Move Brake service — drag, or use the arrow keys': STAY,
    'Move Gear adjustment — drag, or use the arrow keys': STAY,
    'Move Safety check — drag, or use the arrow keys': STAY,
    'Sign in to your account': go('cust-signin'),
  },
  'ac-ask': { 'Send question': go('ac-account-question-sent') },
  'ac-question': { Send: STAY },
  'ac-job-note': { 'Send note': go('ac-job-note-sent') },
  'ac-job-note-sent': { Send: STAY },
  'ac-job-note-answered': { Send: STAY },
  // The receipt opens from the account's history; Close goes back to the account.
  'ac-receipt': { Close: go('ac-account'), 'Download receipt (PDF)': outside('The receipt as a PDF file'), 'Email it to me': go('ac-receipt-sent') },
  'ac-receipt-sent': { 'Download receipt (PDF)': outside('The receipt as a PDF file'), 'Email it to me': STAY },
  'ac-download': { 'Not started? Download it again': STAY },
  'ac-download-failed': { 'Try again': go('ac-download') },
  'ac-delete': { 'Ask to delete': go('ac-delete-sent'), 'Keep my account': BACK },
  // Coverage walks, answer 4: she can still ask; it waits for the bike.
  'ac-delete-blocked': { 'Ask to delete': go('ac-delete-sent'), 'Keep my account': BACK },
  // Coverage walk 11 L3: Save says it worked.
  'ac-review-first': { Save: go('set-msg-list', 'Review request is now On.') },
  'ac-delete-sent': { OK: go('ac-account-delete-pending') },
  'ac-stopped': { 'Turn them back on': go('ac-stopped-on') },
  'ac-today': { 'Open Messages': go('ac-inbox'), 'Open the diary': go('diary'), Open: go('ac-privacy-requests') },
  'ac-services': { Edit: go('ac-service-edit'), Remove: notDrawn('Remove a service, in Settings › Workshop › Services') },
  'ac-service-edit': { Edit: go('ac-service-edit'), Remove: notDrawn('Remove a service, in Settings › Workshop › Services'), Save: go('ac-services') },
  // Booking step 4, with the reminder tick
  'ac-book-remind': {
    'Change bike': go('bk-bike'),
    'Change service': go('bk-service'),
    'Change when': go('bk-when'),
    'Send booking request': go('bk-request'),
    'Sign in to use your saved bikes and details': go('cust-signin'),
    'booking terms': notDrawn('The shop’s booking terms page'),
  },
  // Ready to collect, with the reminder tick
  'ac-collect-remind': {
    'Pay £111.00 now': go('cp-pay'),
    'Photo of Shimano brake pads: rear pads worn — open larger photo': go('dq-quote-photo'),
  },
  // The reminder's link: booking step 3
  'ac-reminder-landing': {
    'Book this time': go('bk-details'),
    'Next: your details': go('bk-details'),
    'Later weeks ›': STAY,
    'Change bike': go('bk-bike'),
    'Change service': go('bk-service'),
    Change: go('bk-details'),
  },
  // Privacy requests, staff side
  'ac-privacy-requests': {
    '+ Log a request': notDrawn('Log a privacy request, on Customers › Privacy requests'),
    'Delete their details': go('cs-privacy-delete'),
    'Send the copy': notDrawn('A copy of their data sent, on Customers › Privacy requests'),
  },
  // The staff customer page with the deletion request
  'ac-customer-delete': {
    Edit: go('cs-edit'),
    '+ Add': notDrawn('Add a bike, on the staff customer page'),
    'New job': go('new-job'),
    'Show all ([n])': STAY,
    'Trek Domane AL 3 Green · black mudguards · bought here [date] Under warranty · [n] months left': notDrawn('A customer’s bike opened from the staff customer page'),
    'WH-1042 Standard service Thu 17 Sep · 11:30 · Alex Morgan In the workshop': go('job-overview'),
    'WH-1056 Standard service Tue 15 Sep · 13:00 · Alex Morgan Finished': go('job-overview'),
    'WH-1062 Standard service Wed 16 Sep · 11:00 · Alex Morgan Expected': go('job-overview'),
    'WH-1077 Standard service Sat 19 Sep · 13:00 · Alex Morgan Expected': go('job-overview'),
    'Refund Refund · Till B1 [date] · [what came back] −[£]': go('till-sale-detail'),
    'Credit Store credit added [date] · [reason] · by [name] +[£]': notDrawn('A store credit entry opened from the customer’s history'),
    'Text Bike ready [date] · sent to 07700 900 142': notDrawn('A sent text opened from the customer’s history'),
  },
};
