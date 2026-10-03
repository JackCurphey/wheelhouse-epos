// Journey 7, Your account and reminders — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-6-7.md merge table.
import { keep, into, later } from './plan.mjs';

const ACCOUNT = 'Account 1, 4, 8';
const INBOX = 'Account 7, 9';

export default {
  // Your account
  'ac-account': keep(4),
  'ac-account-lower': into('ac-account', ACCOUNT),
  'ac-account-repairs': into('ac-account', ACCOUNT),
  'ac-account-new': into('ac-account', ACCOUNT),
  'ac-receipt': keep(41),
  'ac-receipt-sent': into('ac-receipt', 'Leftover screens 1–2'),
  // A Cycle to Work bike on her account
  'ac-account-c2w': into('ac-account', ACCOUNT),
  'ac-account-c2w-collected': into('ac-account', ACCOUNT),
  // Talking to the shop
  'ac-job-note': into('cp-summary', 'Account 3'),
  'ac-job-note-sent': into('cp-summary', 'Account 3'),
  'ac-job-note-answered': into('cp-summary', 'Account 3'),
  'ac-ask': keep(9), // inferred: not in the merge table; the "ask a question" box over the account
  'ac-account-question-sent': into('ac-account', ACCOUNT),
  'ac-question': keep(47),
  'ac-account-asked': into('ac-account', ACCOUNT),
  // The shop's side of messages
  'ac-inbox-list': into('ac-inbox', INBOX),
  'ac-inbox': keep(3),
  'ac-inbox-sent': into('ac-inbox', INBOX),
  'ac-inbox-all': into('ac-inbox', INBOX),
  'ac-inbox-empty': into('ac-inbox', INBOX),
  'ac-reply-text': into('ac-inbox', INBOX),
  'ac-today': into('op-today', 'Account 2, 4'),
  // Service reminders
  'ac-book-remind': into('bk-page', 'Account 2, 4'),
  'ac-collect-remind': into('cp-summary', 'Account 2, 4'),
  'ac-services': into('set-workshop-services', 'Owner setup 14'),
  'ac-service-edit': into('set-workshop-services', 'Owner setup 14'),
  'ac-messages': into('set-msg-list', 'Account 2'),
  'ac-reminder-wording': into('set-msg-list', 'Account 2'),
  'ac-reminder-landing': into('bk-page', 'Account 2, 4'),
  // Reviews and how we contact you
  'ac-review-first': into('ac-review-setting', 'Account 5'),
  'ac-review-setting': keep(9),
  'ac-contact': keep(9),
  'ac-contact-changed': into('ac-contact', 'Account 6, 8 (H2)'),
  'ac-stopped': keep(40),
  'ac-stopped-on': into('ac-stopped', 'Account 6'),
  // Your data
  'ac-download': into('ac-account', ACCOUNT),
  'ac-download-failed': into('ac-account', ACCOUNT),
  'ac-delete': keep(8),
  'ac-delete-blocked': into('ac-delete', 'Account 4'),
  'ac-delete-sent': into('ac-delete', 'Account 4'),
  'ac-account-delete-pending': into('ac-account', ACCOUNT),
  'ac-account-delete-cancelled': into('ac-account', ACCOUNT),
  // The report puts this on journey 15's Privacy requests page (cs-privacy), which is not
  // on the fixed owners list; the staff customer page is used instead.
  'ac-privacy-requests': into('cs-privacy', 'Account 2, 4'), // journey 15's Privacy requests page
  'ac-customer-delete': into('cs-page', 'Account 2, 4'),
};
