// Journey 14, Stock take and stock control — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'st-list': keep(3),
  'st-list-staff': into('st-list', ''),
  'st-search-measure': into('st-list', ''),
  'st-filter-bearings': into('st-list', ''),
  'st-filter-derailleurs': into('st-list', ''),
  'st-search-size': into('st-list', ''),
  'st-list-none': into('st-list', ''),
  'st-list-unknown': into('st-list', ''),
  'st-list-new': into('st-list', ''),
  'st-categories': keep(1),
  'st-category-edit': keep(9),
  'st-product': keep(4),
  'st-product-staff': into('st-product', ''),
  'st-product-bike': into('st-product', ''),
  'st-product-sizes': into('st-product', ''), // inferred
  'st-list-ticked': into('st-list', ''),
  'st-prices': keep(9),
  'st-prices-done': into('st-prices', ''),
  'st-adjust': keep(9),
  'st-adjust-faulty': into('st-adjust', ''),
  'st-today-adjust': into('op-today', ''),
  'st-setting-adjust': into('st-categories', ''), // inferred: another section of Settings › Stockroom
  'st-today-below': into('op-today', ''),
  'tk-count-below': into('tk-count', ''),
  'tr-sites': into('st-product', ''), // inferred: a section of the product's page
  'tr-send': keep(9),
  'tr-incoming': into('rs-hub', ''),
  'tr-receive': into('rs-receive', ''),
  'tr-problem': into('rs-problem', ''),
  'tr-today-short': into('op-today', ''),
  'tk-hub': keep(3),
  'tk-hub-staff': into('tk-hub', ''),
  'tk-start': keep(9),
  'tk-start-category': into('tk-start', ''),
  'tk-count': keep(27),
  'tk-diff': into('tk-count', ''), // inferred: the check step of the same count
  'tk-applied': into('tk-count', ''),
};
