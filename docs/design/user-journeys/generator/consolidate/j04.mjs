// Journey 4, Drop off and approve the quote — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // While the bike is in: the one customer job page (Quote 1)
  'dq-in-shop': into('bk-page', 'Quote 1'),
  'dq-waiting-part': into('bk-page', 'Quote 1'),
  'dq-ready': into('cp-summary', 'Quote 1'),
  // The quote: the customer job page with a quote to answer
  'dq-quote': keep(38),
  'dq-quote-photo': into('dq-quote', 'Quote 1'),
  'dq-quote-untick': into('dq-quote', 'Quote 1'),
  'dq-quote-decline': into('dq-quote', 'Quote 1'),
  'dq-quote-deposit': into('dq-quote', 'Quote 1'),
  'dq-quote-reminded': into('dq-quote', 'Quote 1'),
  'dq-quote-newer': into('dq-quote', 'Quote 1'),
  'dq-withdrawn': into('dq-quote', 'Quote 1'),
  'dq-within-limit': into('dq-quote', 'Quote 1'),
  // Answered
  'dq-answered': into('dq-quote', 'Quote 1'),
  'dq-answered-declined': into('dq-quote', 'Quote 1'),
  'dq-answered-deposit': into('dq-quote', 'Quote 1'),
  'dq-answered-by-phone': into('dq-quote', 'Quote 1'),
  // A Lightspeed shop
  'dq-quote-ls': into('dq-quote', 'Quote 1'),
  'dq-quote-price-ls': into('dq-quote', 'Quote 1'),
  'dq-answered-price-no-ls': into('dq-quote', 'Quote 1'),
  // The shop's side
  'dq-job-quote': into('job-overview', 'Workshop day 20'),
  'dq-job-sent': into('job-overview', 'Workshop day 20'),
  'dq-diary-waiting': into('diary', ''),
  'dq-today-no-answer': into('op-today', ''),
  'dq-record-answer': keep(9),
  'dq-job-withdraw': into('job-overview', 'Quote 7'), // staff withdraw the quote on the job page; its "Are you sure?" is a line there
  'dq-job-answered': into('job-overview', 'Workshop day 20'),
  'dq-job-within': into('job-overview', 'Workshop day 20'),
  'dq-job-waiting': into('job-overview', 'Workshop day 20'),
  'dq-messages': into('set-msg-list', 'Receiving 7'),
  // Also in this journey: old Release 1 pictures
  'customer-message': into('cp-summary'), // old Release 1 picture; replaced by journey 7's job note (ac-job-note), itself a line on cp-summary
  'preferences': into('ac-contact'), // old Release 1 picture; replaced by journey 7's ac-contact
};
