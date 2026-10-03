// Journey 7, Your account and reminders — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-6-7.md merge table.
import { keep, into, later } from './plan.mjs';

const ACCOUNT = 'Account 1, 4, 8';
const INBOX = 'Account 7, 9';

export default {
  // Your account
  'ac-account': keep(4),
  'ac-account-lower': into('ac-account', ACCOUNT, "Scrolled down: 'How we contact you' and 'Your data' in view"),
  'ac-account-repairs': into('ac-account', ACCOUNT, "History filter 'Repairs' chosen: repairs only"),
  'ac-account-new': into('ac-account', ACCOUNT, "Empty: 'No bikes yet', 'Nothing here yet', no store credit, reminders and reviews Off"),
  'ac-receipt': keep(41),
  'ac-receipt-sent': into('ac-receipt', 'Leftover screens 1–2', "Green 'Sent to maya@example.test' under the receipt"),
  // A Cycle to Work bike on her account
  'ac-account-c2w': into('ac-account', ACCOUNT, "History 'Now' row '[Bike] · Waiting for the certificate', 'What you pay at collection: £[£]'"),
  'ac-account-c2w-collected': into('ac-account', ACCOUNT, "'[Bike] · [Size]' in Your bikes with 'Frame [frame number]'; '[Bike] · Collected' in history"),
  // Talking to the shop
  'ac-job-note': into('bk-page', 'Account 3', "The job’s page with 'Notes with the shop': 'Add a note for the shop', 'Send note'"),
  'ac-job-note-sent': into('bk-page', 'Account 3', "Maya’s note in the thread; 'Sent. North Street Cycles will reply here…'"),
  'ac-job-note-answered': into('bk-page', 'Account 3', "Maya’s note and 'Jo Taylor, North Street Cycles' reply; a 'Reply' box"),
  'ac-ask': keep(9), // inferred: not in the merge table; the "ask a question" box over the account
  'ac-account-question-sent': into('ac-account', ACCOUNT, "Banner 'Question sent. We’ll text you…'; history row badged 'Sent'"),
  'ac-question': keep(47),
  'ac-account-asked': into('ac-account', ACCOUNT, "History: 'Note on WH-1042' and the question, both 'Replied'"),
  // The shop's side of messages
  'ac-inbox-list': into('ac-inbox', INBOX, "Phone: the conversation list alone, 'Needs a reply · 2'"),
  'ac-inbox': keep(3),
  'ac-inbox-sent': into('ac-inbox', INBOX, "'You (Jo Taylor)' reply shown; 'Sent to Maya by text…', 'Reply again'"),
  'ac-inbox-all': into('ac-inbox', INBOX, "'All' filter: every conversation, unanswered ones marked 'Needs a reply'"),
  'ac-inbox-empty': into('ac-inbox', INBOX, "Empty list: 'Nothing needs a reply. Every conversation is under All.'"),
  'ac-reply-text': into('ac-inbox', INBOX, "Pop-up 'What Maya gets': the reply as a text, 'reply on your page: [link]'"),
  'ac-today': into('op-today', 'Account 2, 4', "Lines '2 messages need a reply' and '[Customer name] asked us to delete their account'"),
  // Service reminders
  'ac-book-remind': into('bk-page', 'Account 2, 4', "Booking step 4 details, with 'Remind me when my bike is due its next service' unticked"),
  'ac-collect-remind': into('cp-summary', 'Account 2, 4', "Ready-to-collect page with the 'Remind me when my bike is due its next service' tick"),
  'ac-services': into('set-workshop-services', 'Owner setup 14', "'Full service' group open: 'Standard service' with 'reminder after [n] months'"),
  'ac-service-edit': into('set-workshop-services', 'Owner setup 14', "Pop-up 'Standard service': 'Remind customers it’s due after [n] months'"),
  'ac-messages': into('set-msg-list', 'Account 2', "Scrolled to the 'Service reminder' and review request rows; each ends 'Stop these: [link]'"),
  'ac-reminder-wording': into('set-msg-list', 'Account 2', "'Service reminder' wording pop-up; fixed 'Stop these: [link]' line and a preview"),
  'ac-reminder-landing': into('bk-when', 'Account 2, 4', "Booking step 3: 'From your reminder: booking the next Standard service…', details filled in"),
  // Reviews and how we contact you
  'ac-review-first': into('ac-review-setting', 'Account 5', "Switch off and disabled: 'Add your review page first, then switch this on.'"),
  'ac-review-setting': keep(9),
  'ac-contact': keep(9),
  'ac-contact-changed': into('ac-contact', 'Account 6, 8 (H2)', "'Service reminders are off' confirmation; that switch now Off"),
  'ac-stopped': keep(40),
  'ac-stopped-on': into('ac-stopped', 'Account 6', "'Service reminders are on again'; no 'Turn them back on' button"),
  // Your data
  'ac-download': into('ac-account', ACCOUNT, "Banner 'Your data is downloading as one file, [file name].zip…'"),
  'ac-download-failed': into('ac-account', ACCOUNT, "Amber banner 'The download didn’t start.' with 'Try again'"),
  'ac-delete': keep(8),
  'ac-delete-blocked': into('ac-delete', 'Account 4', "'We can delete your account once your bike has been collected.'; only 'OK'"),
  'ac-delete-sent': into('ac-delete', 'Account 4', "'Request sent' — deleted 'by [date] at the latest'; only 'OK'"),
  'ac-account-delete-pending': into('ac-account', ACCOUNT, "Amber banner 'You asked us to delete your account on [date]…' with 'Cancel my request'"),
  'ac-account-delete-cancelled': into('ac-account', ACCOUNT, "Banner 'Request cancelled — your account stays as it is.'"),
  // The report puts this on journey 15's Privacy requests page (cs-privacy), which is not
  // on the fixed owners list; the staff customer page is used instead.
  'ac-privacy-requests': into('cs-privacy', 'Account 2, 4', "Row 'Maya Patel · Delete their details' from the website; delete disabled, 'Still in the way'"), // journey 15's Privacy requests page
  'ac-customer-delete': into('cs-page', 'Account 2, 4', "Amber line 'Asked to delete their account on [date]'; bike WH-1042 and store credit in the way"),
};
