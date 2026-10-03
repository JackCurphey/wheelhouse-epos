// Journey 19, Multiple sites — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ms-switch-open': keep(13),
  'ms-switched': into('ms-switch-open', ''),
  'ms-today-all': into('op-today', ''),
  'ms-pick-shop': into('diary', ''),
  'ms-till-other': into('till-sale', ''),
  'ms-one-shop': into('ms-switch-open', ''),
  'ms-service-price': keep(28),
  'ms-service-not-offered': into('ms-service-price', ''),
  'ms-services-differs': into('set-workshop-services', ''),
  'ms-product-price': keep(28),
  'ms-person': into('set-staff-person', ''),
  'ms-book-shop': into('bk-service', ''), // journey 3's booking, first step
  'ms-book-shop-chosen': into('bk-service', ''), // as above
  'ms-book-shop-change': into('bk-service', ''), // as above
  'ms-job-other-shop': into('diary', ''), // inferred: drawn from diary.mjs
  'ms-request-from-shop': into('diary', ''), // inferred: drawn from diary.mjs
  'ms-request-answered': into('diary', ''), // inferred: the diary's Waiting for you
  'ms-sites': into('set-shop-details', ''),
  'ms-sites-manager': into('set-shop-details', ''),
  'ms-add-shop': keep(9),
  'ms-add-shop-error': into('ms-add-shop', ''),
  'ms-today-new': into('op-today', ''),
  'ms-tills': into('set-till-quick', ''),
  'ms-till-move': keep(9),
  'ms-till-setup': into('till-setup', ''), // journey B's till setup
};

// "Draw the decisions" SI1: a decision drawn as a line (spec B0). It goes on
// ms-switch-open, not op-today, because op-today stays a one-shop board.
export const lines = [
  { on: 'ms-switch-open', text: 'While [Second site] is being set up: [Second site] · [n] steps to get it ready', who: 'Owner', decision: 'Walk-through 7 H1 (as taken)' },
];
