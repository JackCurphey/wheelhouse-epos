// Journey 4, Drop off and approve the quote — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // While the bike is in: the one customer job page (Quote 1)
  'dq-in-shop': into('bk-page', 'Quote 1', "tracker at 'In the shop', 'booked in Thu 17 Sep at [time]'; no change or cancel"),
  'dq-waiting-part': into('bk-page', 'Quote 1', "tracker warns 'Waiting for a part — we’ll update you.'; ready Sat 19 Sep 16:00"),
  'dq-ready': into('cp-summary', 'Quote 1', "drawn from cp-summary itself — nothing differs"),
  // The quote: the customer job page with a quote to answer
  'dq-quote': keep(38),
  'dq-quote-photo': into('dq-quote', 'Quote 1', "'Shimano brake pads' pop-up with the photo enlarged, 'Close'"),
  'dq-quote-untick': into('dq-quote', 'Quote 1', "'Replace gear cable' ticked too: total and button 'Approve £123.00'"),
  'dq-quote-decline': into('dq-quote', 'Quote 1', "all unticked: 'Alex recommends this.' warning; button 'Decline the extra work'"),
  'dq-quote-deposit': into('dq-quote', 'Quote 1', "adds 'Deposit paid £[deposit]' and 'Still to pay when you collect £[balance]'"),
  'dq-quote-reminded': into('dq-quote', 'Quote 1', "sent line adds '· we sent a reminder at [time]'"),
  'dq-quote-newer': into('dq-quote', 'Quote 1', "'Alex has added to the quote': earlier answers kept, one '[New line]' to answer"),
  'dq-withdrawn': into('dq-quote', 'Quote 1', "grey 'Quote withdrawn' — 'Nothing to answer.'; no tick lines"),
  'dq-within-limit': into('dq-quote', 'Quote 1', "green 'Work added': '£58.00 — within your £200 limit'; no ticks, total £123.00"),
  // Answered
  'dq-answered': into('dq-quote', 'Quote 1', "'Answered': 'Thanks, Maya — Alex is carrying on'; gear cable 'no thanks', £111.00"),
  'dq-answered-declined': into('dq-quote', 'Quote 1', "'Answered': all three extra lines 'no thanks'; total £65.00"),
  'dq-answered-deposit': into('dq-quote', 'Quote 1', "'Answered', plus 'Deposit paid £[deposit]' and 'Still to pay when you collect'"),
  'dq-answered-by-phone': into('dq-quote', 'Quote 1', "'Your answers, from your call' — 'answered by phone with Jo Taylor at [time]'"),
  // A Lightspeed shop
  'dq-quote-ls': into('dq-quote', 'Quote 1', "the same quote at a Lightspeed shop; no Basket in the header"),
  'dq-quote-price-ls': into('dq-quote', 'Quote 1', "'A price has gone up since you agreed': 'Approve £[new total]' or 'No thanks — keep to £111.00'"),
  'dq-answered-price-no-ls': into('dq-quote', 'Quote 1', "'you said no to the new price' — agreed price stays £111.00"),
  // The shop's side
  'dq-job-quote': into('job-overview', 'Workshop day 20', "'In the workshop'; new lines 'Quoting', Needed or Optional, pads photo; 'Send quote'"),
  'dq-job-sent': into('job-overview', 'Workshop day 20', "'Quoting' with 'Sending the quote to Maya by text in 1 minute' and 'Undo'"),
  'dq-diary-waiting': into('diary', '', "WH-1042 in the 'Waiting for the customer' colour"),
  'dq-today-no-answer': into('op-today', '', "'WH-1042 · Maya Patel — no answer to the quote yet' with 'Record their answer'"),
  'dq-record-answer': keep(9),
  'dq-job-withdraw': into('job-overview', 'Quote 7', "'Withdraw this quote?' pop-up: 'Keep the quote' or 'Withdraw quote'"), // staff withdraw the quote on the job page; its "Are you sure?" is a line there
  'dq-job-answered': into('job-overview', 'Workshop day 20', "'Approved £111.00', gear cable 'Declined'; 'Start work'"),
  'dq-job-within': into('job-overview', 'Workshop day 20', "'Customer OK up to £200', every line Approved; 'Save and tell Maya'"),
  'dq-job-waiting': into('job-overview', 'Workshop day 20', "amber 'Waiting for parts', diary Sat 19 Sep 16:00; 'Mark ready for collection'"),
  'dq-messages': into('set-msg-list', 'Receiving 7', "same page; the 'Quote to approve' row and its 'Reminder if there’s no answer'"),
  // Also in this journey: old Release 1 pictures
  'customer-message': into('cp-summary', '', "Release 1 picture 'Customer follows up' (Customer · phone)"), // old Release 1 picture; replaced by journey 7's job note (ac-job-note), itself a line on cp-summary
  'preferences': into('ac-contact', '', "Release 1 picture 'Change customer update channels' (Customer · phone)"), // old Release 1 picture; replaced by journey 7's ac-contact
};

export const lines = [
  // The second walk's smaller questions, 3 Oct (answer 1).
  { on: 'dq-quote', text: "From a Not sure what's wrong? booking: every line is the mechanic's, each Needed or Optional with its reason; a deposit paid shows as Deposit paid £[deposit] and Still to pay when you collect £[balance]", who: 'Customer', decision: 'Booking mode 2026-09-04 §7.4; Book a repair 12 (H3); Quote 2, 7; 3 Oct (second walk Q1)' },
  { on: 'dq-quote', text: "From a Not sure what's wrong? booking: no charge for looking at the bike; every line on the quote is new", who: 'Customer', decision: '3 Oct (second walk, case 1c)' },
];
