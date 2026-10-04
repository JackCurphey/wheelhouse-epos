// Journey 1, Browsing the website — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'wb-home': keep(16),
  'wb-home-lower': into('wb-home', 'Find the shop 1 (now fixed), M1', "Scrolled down: 'Book a repair' with its services, 'Our shops' cards, the shop’s own words"),
  'wb-home-one-shop': into('wb-home', 'Find the shop 1 (now fixed), M1', "One shop: 'Find us' in place of 'Our shops'; no 'Collecting from' chip"),
  'wb-first-visit': into('wb-home', 'Find the shop 1 (now fixed), M1', "Nothing chosen: 'Choose a shop' chip; product cards have no 'Ready today' lines"),
  'wb-choose-shop': keep(33),
  'wb-shop': keep(31), // inferred: real screen, every category
  'wb-category': keep(31),
  'wb-category-filtered': keep(31), // the phone filter panel the report keeps
  'wb-category-empty': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "'Nothing matches': names the filters; 'Show ones ready in [n] days', 'Clear all filters'"),
  'wb-category-parent': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "Drivetrain: its types as links under the heading; only Availability, Brand and Price filters"),
  'wb-category-child': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "Derailleurs: 'Shop › Drivetrain › Derailleurs' trail; a 'Number of gears' filter"),
  'wb-category-no-shop': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "No shop chosen: 'Choose a shop' chip; no ready lines on the cards"),
  'wb-product': keep(32),
  'wb-product-sizes': into('wb-product', 'Find the shop 3', "Colour and Size choices; 'Choose a colour and size to see when it’s ready'"),
  'wb-product-size-other': into('wb-product', 'Find the shop 3', "M struck through; amber 'M isn’t in stock at Bolton'; 'Collect from [Second site] instead'; no Add to basket"),
  'wb-product-photos': keep(32), // inferred: a box over the page (rule 1); the report's count of 15 includes it
  'wb-product-held': into('wb-product', 'Find the shop 3', "'[Bike]' says 'Sold out at Bolton'; no Add to basket, only 'Ask the shop about this'"),
  'wb-search-typing': keep(17),
  'wb-search-no-suggestions': into('wb-search-typing', 'Find the shop 4', "'No suggestions for “[what they typed]” — press Enter to search.'"),
  'wb-search-results': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "'Results for “brake”': 'Repairs for “brake”' strip above, 'Best match' sort, Category filter"),
  'wb-search-measure': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "'Results for “bearing 30mm”': Bearings filters with 'Inner diameter: 30 mm' already ticked"),
  'wb-search-none': into('wb-category', 'Find the shop 2, 4, 7 (H2, M4)', "'No results for “[what they typed]”': spelling tips, 'Book a repair', both shops’ phone and email"),
  'wb-shops': keep(34), // inferred: real screen, a card per shop
  'wb-shop-page': keep(34),
  'wb-shop-collect': into('wb-shop-page', 'Find the shop 5, M2', "Green 'Collecting from Bolton — what you see now shows when it’s ready here.'; no 'Collect from here'"),
  'wb-find-us': into('wb-shop-page', 'Find the shop 5, M2', "One shop: headed 'Find us', no trail, no 'Collect from here'"),
  'wb-not-found': keep(40),
  'wb-off': into('wb-not-found', 'Find the shop 6, M13', "Plain white page, no shop header or search: 'This website isn’t available'"),
  'wb-off-preview': keep(44),
  'wb-off-preview-product': into('wb-off-preview', 'Find the shop M14, later change', "The staff banner on a product page, not the home page"),
  'wb-off-preview-ask': into('wb-off-preview', 'Find the shop M14, later change', "Banner says 'Ask Jack Lewis to turn it on.'; no 'Turn it on' or 'Edit this page'"),
  'wb-turned-on': into('wb-off-preview', 'Find the shop M14, later change', "Green banner 'Your website is on. Customers can see it now.' with 'Turn off'"),
  'wb-cookies-banner': keep(45),
  'wb-cookies-choose': keep(45),
  'wb-cookies-saved': into('wb-cookies-banner', 'Find the shop 6, H3', "Banner gone; 'Your cookie choices are saved' message; 'Cookie choices' in the footer"),
  'wb-cookies-page': keep(45),
  'wb-cookies-page-plain': into('wb-cookies-page', '', "No tracking tool: 'This website doesn’t use any other cookies, so there’s nothing for you to choose.'"),
};

// The coverage walks (4 Oct, docs/design/user-journeys/walk-4/): Jack's answers and the walks' fixes drawn as lines.
export const lines = [
  { on: 'wb-off-preview', text: "While moving from Citrus Lime: the banner reads 'Your website goes on during switch-over morning'; no 'Turn it on' (owner) and no 'Ask Jack Lewis to turn it on' (staff)", who: 'Owner and Staff', decision: 'Walk-through 4 H2; Moving from Citrus Lime, later change 3 Oct; 4 Oct (coverage walk 4 H1)' },
];
