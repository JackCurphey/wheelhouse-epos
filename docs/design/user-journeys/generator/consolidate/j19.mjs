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
