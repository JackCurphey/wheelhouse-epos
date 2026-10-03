// Journey 1, Browsing the website — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'wb-home': keep(16),
  'wb-home-lower': into('wb-home', 'Find the shop 1 (now fixed), M1'),
  'wb-home-one-shop': into('wb-home', 'Find the shop 1 (now fixed), M1'),
  'wb-first-visit': into('wb-home', 'Find the shop 1 (now fixed), M1'),
  'wb-choose-shop': keep(33),
  'wb-shop': keep(31), // inferred: real screen, every category
  'wb-category': keep(31),
  'wb-category-filtered': keep(31), // the phone filter panel the report keeps
  'wb-category-empty': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-category-parent': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-category-child': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-category-no-shop': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-product': keep(32),
  'wb-product-sizes': into('wb-product', 'Find the shop 3'),
  'wb-product-size-other': into('wb-product', 'Find the shop 3'),
  'wb-product-photos': keep(32), // inferred: a box over the page (rule 1); the report's count of 15 includes it
  'wb-product-held': into('wb-product', 'Find the shop 3'),
  'wb-search-typing': keep(17),
  'wb-search-no-suggestions': into('wb-search-typing', 'Find the shop 4'),
  'wb-search-results': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-search-measure': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-search-none': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)'),
  'wb-shops': keep(34), // inferred: real screen, a card per shop
  'wb-shop-page': keep(34),
  'wb-shop-collect': into('wb-shop-page', 'Find the shop 5, M2'),
  'wb-find-us': into('wb-shop-page', 'Find the shop 5, M2'),
  'wb-not-found': keep(40),
  'wb-off': into('wb-not-found', 'Find the shop 6, M13'),
  'wb-off-preview': keep(44),
  'wb-off-preview-product': into('wb-off-preview', 'Find the shop M14, later change'),
  'wb-off-preview-ask': into('wb-off-preview', 'Find the shop M14, later change'),
  'wb-turned-on': into('wb-off-preview', 'Find the shop M14, later change'),
  'wb-cookies-banner': keep(45),
  'wb-cookies-choose': keep(45),
  'wb-cookies-saved': into('wb-cookies-banner', 'Find the shop 6, H3'),
  'wb-cookies-page': keep(45),
  'wb-cookies-page-plain': into('wb-cookies-page', ''),
};
