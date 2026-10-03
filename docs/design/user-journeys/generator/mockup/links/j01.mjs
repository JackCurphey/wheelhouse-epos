// Journey 1, Find the shop and browse the website — where each button goes in the mockup.
// Sources: Find the shop decisions (2 Oct, with the later Website management
// change), browse-ui-audit.md H5 ("Ask the shop" opens journey 2's phone and
// email block in place), Buy online 8 (the shop is chosen once).
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

const PHONE = outside('The phone app, calling the shop');
const EMAIL = outside('The customer’s email app, writing to the shop');
const MAPS = outside('The customer’s maps app, with directions to the shop');

// Product and category cards, as on the home page once a shop is chosen.
const cards = {
  '[Photo for Bearings] Bearings [n] products': go('wb-category'),
  '[Photo for Drivetrain] Drivetrain Derailleurs and [n] more': go('wb-category-parent'),
  '[Photo for [Category]] [Category] [n] products': go('wb-category'),
  '[Photo of Shimano brake pads B05S-RX] Shimano brake pads B05S-RX £28.00 Ready today at Bolton': go('wb-product'),
  '[Photo of [Product]] [Product] £[price] Ready today at Bolton': go('wb-product'),
  '[Product] [Product] £[price] Ready today at Bolton': go('wb-product'),
  '[Photo of [Product]] [Product] £[price] Ready at Bolton in [n] days': go('on-product-two-shops'),
};
// Before a shop is chosen: the category and product pages without ready lines.
const noShopCards = {
  '[Photo for Bearings] Bearings [n] products': go('wb-category-no-shop'),
  '[Photo of Shimano brake pads B05S-RX] Shimano brake pads B05S-RX £28.00': go('on-product-no-shop'),
  '[Photo of [Product]] [Product] £[price]': go('on-product-no-shop'),
  '[Product] [Product] £[price]': go('on-product-no-shop'),
};
const SECOND_SITE_CHOSEN = notDrawn('The website collecting from [Second site] (only Bolton chosen is drawn)');

export default {
  '*': {
    ...cards,
    'Collecting from Bolton Change': go('wb-choose-shop'),
    'Collecting from North Street Cycles, Bolton — change the shop': go('wb-choose-shop'),
    'Choose a shop to collect from': go('wb-choose-shop'),
    'All categories': go('wb-shop'),
    'All shops': go('wb-shops'),
    Bolton: go('wb-shop-page'),
    '[Second site]': notDrawn('[Second site]’s own shop page (only Bolton’s is drawn)'),
    'Book a repair here': go('bk-service'),
    'Directions to Bolton (opens your maps app)': MAPS,
    'Directions to [Second site] (opens your maps app)': MAPS,
    'Directions to North Street Cycles (opens your maps app)': MAPS,
    Directions: MAPS,
    '[shop phone]': PHONE,
    '[shop email]': EMAIL,
    // Categories and filters
    Filter: go('wb-category-filtered'),
    'Show more': STAY,
    'Clear all': go('wb-category'),
    'Clear all filters': go('wb-category'),
    'Remove filter Ready today at Bolton': STAY,
    'Remove filter Inner diameter: [n] mm': STAY,
    'Remove filter Height: [n] mm': STAY,
    'Show ones ready in [n] days': STAY,
    '[Photo of [Bearing]] [Bearing] [n] × [n] × [n] mm £[price] Ready today at Bolton': go('wb-product'),
    '[Bearing] [Bearing] [n] × [n] × [n] mm £[price] Ready today at Bolton': go('wb-product'),
    '[Photo of [Bearing]] [Bearing] [n] × [n] × [n] mm £[price] Ready at Bolton in [n] days': go('on-product-two-shops'),
    '[Photo of [Bearing]] [Bearing] [n] × [n] × [n] mm £[price]': go('on-product-no-shop'),
    '[Photo of [Derailleur]] [Derailleur] [n] gears £[price] Ready today at Bolton': go('wb-product'),
    '[Photo of [Derailleur]] [Derailleur] [n] gears £[price] Ready at Bolton in [n] days': go('on-product-two-shops'),
    Derailleurs: go('wb-category-child'),
    Drivetrain: go('wb-category-parent'),
    '[Category]': go('wb-category'),
    // A product
    'Add to basket': go('on-product-added'),
    'Ask the shop about this': go('on-product-out'),
    'One fewer Shimano brake pads B05S-RX': STAY,
    'One more Shimano brake pads B05S-RX': STAY,
    'One fewer [Product with sizes]': STAY,
    'One more [Product with sizes]': STAY,
    'Open larger photo 1 of 4': go('wb-product-photos'),
    'Show photo 1 of 4': STAY, 'Show photo 2 of 4': STAY, 'Show photo 3 of 4': STAY, 'Show photo 4 of 4': STAY,
    'Collect from [Second site] instead': notDrawn('The product page collecting from [Second site]'),
    // Cookies
    'Cookie choices': go('wb-cookies-choose'),
    'Change cookie choices': go('wb-cookies-choose'),
    'About cookies': go('wb-cookies-page'),
    'Accept all': go('wb-cookies-saved'),
    'Reject all': go('wb-cookies-saved'),
    Choose: go('wb-cookies-choose'),
    'Save my choices': go('wb-cookies-saved'),
    // The staff banner while the website is off (decisions M14, later change)
    'Back to Wheelhouse': go('ws-page'),
    'Edit this page': go('ws-editor'),
    'Turn it on': go('wb-turned-on'),
    'Turn off': go('wb-off-preview'),
    // One shop
    'Find us': go('wb-find-us'),
    'North Street Cycles': go('wb-find-us'),
    'Go to the home page': go('wb-home'),
  },
  'wb-first-visit': { ...noShopCards },
  'wb-choose-shop': {
    ...noShopCards,
    'Bolton [Shop address] · open [opening hours]': go('wb-home'),
    '[Second site] [Shop address] · open [opening hours]': SECOND_SITE_CHOSEN,
  },
  'wb-category-no-shop': { 'Show more': STAY },
  'wb-category-empty': {
    'Ask the shop about it': notDrawn('The shop’s phone and email opened in place on an empty category (browse audit H5)'),
  },
  'wb-category-filtered': {
    Filter: STAY,
    'Close filters': BACK,
    'Show [n] products': notDrawn('The filtered Bearings list on a phone, Filter panel closed'),
  },
  'wb-search-measure': {
    'Clear all': STAY,
    'Remove filter Category: Bearings': STAY,
    'Remove filter Inner diameter: 30 mm': STAY,
  },
  'wb-search-results': {
    'Brake service [£ price]': go('bk-service-chosen'),
    'Page: Collection and returns': notDrawn('The shop’s Collection and returns page (Words and photos, Website 3 Oct)'),
  },
  'wb-product-sizes': { 'Add to basket': STAY },
  'wb-product-photos': { 'Next photo': STAY, 'Previous photo': STAY, 'Close photos': BACK },
  'wb-find-us': { 'Find us': STAY },
  'wb-shop-page': { 'Collect from here': go('wb-shop-collect') },
  'wb-turned-on': { 'Back to Wheelhouse': go('ws-page-on') },
};
