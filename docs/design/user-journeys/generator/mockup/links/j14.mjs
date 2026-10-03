// Journey 14, Stock take and stock control — where each button goes in the
// mockup. From the Stock take and stock control decisions (1 Oct): a list
// whose rows open the product's page (2, 3), sizes on one page (4), counts
// a section at a time (5), adjust with a reason (6), prices in bulk with a
// preview (7), send then receive between shops (8), Count them on Today (9),
// each category's own details (10).
import { go, STAY, outside, notDrawn } from '../controls.mjs';

const EDIT_PRODUCT = notDrawn('Edit a product: its name, codes, photo, price and cost (Stock take and stock control 3)');
const EDIT_DETAILS = notDrawn('Edit a product’s details: its category’s measurements and specifications (Stock take and stock control 10)');
const OTHER_CATEGORY = (name) => notDrawn(`Editing the ${name} category (only Derailleurs is drawn)`);

export default {
  '*': {
    // The stock list: column headings sort in place, rows open the product
    Product: STAY, 'In stock': STAY, Price: STAY, Margin: STAY,
    'Inner diameter': STAY, 'Outer diameter': STAY, Height: STAY, 'Number of gears': STAY,
    '+ Add a product': go('rs-add-product'),
    'Shimano brake pads B05S-RX · [Category] · [Supplier] · £28.00': go('st-product'),
    'Shimano brake pads B05S-RX · [Category] · [Supplier]': go('st-product'),
    'Shimano brake pads B05S-RX · [Category] · [Supplier] · £[price]': go('st-product'),
    '[Product] [Supplier code] · [Category] · [Supplier] · £[price]': go('st-product'),
    '[Product] [Supplier code] · [Category] · [Supplier]': go('st-product'),
    'Trek Domane AL 3 [Category] · [n] bikes, each by frame number · £[price]': go('st-product-bike'),
    'Trek Domane AL 3 [Category] · [n] bikes, each by frame number': go('st-product-bike'),
    '[Product with sizes] [Category] · [n] sizes · [n] colours · 1 size below zero · £[price]': go('st-product-sizes'),
    '[Product with sizes] [Category] · [n] sizes · [n] colours · 1 size below zero': go('st-product-sizes'),
    '[Product with sizes] Size M · [Colour 1] · its own barcode · £[price]': go('st-product-sizes'),
    '[Product with sizes] Size M · [Colour 1] · its own barcode': go('st-product-sizes'),
    '[Bearing] [Supplier code] · [Supplier] · £[price]': go('st-product'),
    '[Bearing] [Supplier code] · [Supplier]': go('st-product'),
    '[Derailleur] [Supplier code] · [Supplier] · £[price]': go('st-product'),
    '[Derailleur] [Supplier code] · [Supplier]': go('st-product'),
    '[Bearing] Inner diameter [n] · Outer diameter 30 · Height [n] mm · £[price]': go('st-product'),
    '[Bearing] Inner diameter [n] · Outer diameter 30 · Height [n] mm': go('st-product'),
    'Remove the Bearings filter': go('st-list'),
    'Remove the Drivetrain › Derailleurs filter': go('st-list'),
    // The ticked bar
    'Change prices': go('st-prices'),
    'Print labels': outside('The label printer'),
    'Send to another shop': go('tr-send'),
    'Untick all': go('st-list'),
    // A product's page and its history
    Edit: EDIT_PRODUCT,
    'Edit details': EDIT_DETAILS,
    'Adjust stock': go('st-adjust'),
    // WH-1042 is in the workshop: its In the workshop page (third walk, walk-through 9 M1).
    'Open job WH-1042': go('job-mechanic', 'Showing the mechanic’s view of WH-1042 in the workshop: the Staff view of that stage isn’t drawn separately.'),
    'Open sale B1-[0000]': go('till-sale-detail'),
    'Open the delivery from [Supplier]': go('rs-delivery'),
    'Open the stock take of [Category]': go('tk-applied'),
    'Open transfer T-[0000]': go('tr-incoming'),
    '[Customer]': go('cs-page'),
    // Categories
    '+ Add a category': notDrawn('Add a category: a new, empty one (Settings › Stockroom › Categories)'),
    'Edit Derailleurs': go('st-category-edit'),
    'Edit Bearings': OTHER_CATEGORY('Bearings'),
    'Edit Drivetrain': OTHER_CATEGORY('Drivetrain'),
    'Edit [Category]': OTHER_CATEGORY('[Category]'),
    // Stock take
    'Start a count': go('tk-start'),
    'Start the count': go('tk-count'),
    'Check the count of [Area]': go('tk-diff'),
    'Open the count of [Area]': go('tk-count'),
    'Open the whole-shop count from [date]': go('tk-applied'),
    'I’ve finished my part': go('tk-hub'),
    // Receiving a transfer (journey 13's screens)
    'Book in [n] items': go('rs-booked'),
    'Problem with Shimano brake pads': go('tr-problem'),
    'Problem with [Product]': go('tr-problem'),
    // Today's lines
    'Book in': go('till-book-in'),
    'Open the diary': go('diary'),
  },
  'st-list-new': { 'Bring them from Citrus Lime': go('mv-start') },
  'st-list-none': { '+ Add “[what was typed]” as a product': go('rs-add-product') },
  'st-list-unknown': { 'Add this product': go('rs-add-product') },
  'st-prices': { 'Change 3 prices': go('st-prices-done'), 'Change prices': STAY },
  'st-prices-done': { Undo: go('st-list-ticked') },
  'st-adjust': { Adjust: go('st-product'), 'Adjust stock': STAY },
  'st-adjust-faulty': { Adjust: go('st-product'), 'Adjust stock': STAY },
  'st-product-sizes': {
    '+ Add a size or colour': notDrawn('Add a size or colour to a product'),
    '[Colour 1], size L: [n] in stock': STAY,
    '[Colour 1], size M: −1, below zero': STAY,
    '[Colour 1], size S: [n] in stock': STAY,
    '[Colour 1], size XL: [n] in stock': STAY,
    '[Colour 2], size L: none in stock': STAY,
    '[Colour 2], size M: [n] in stock': STAY,
    '[Colour 2], size S: [n] in stock': STAY,
    '[Colour 2], size XL: [n] in stock': STAY,
  },
  'st-category-edit': {
    'Add this detail': STAY,
    'Remove Number of gears': STAY,
    'Remove the choice [n]': STAY,
    'Undo removing [Detail]': STAY,
    'Change it on Drivetrain': OTHER_CATEGORY('Drivetrain'),
    Save: go('st-categories'),
  },
  'st-today-adjust': { Seen: STAY, '[Product]': go('st-product') },
  'st-today-below': { 'Count them': go('tk-count-below'), 'See them': go('st-list') },
  'tk-hub-staff': { 'Join the count of [Area]': go('tk-count') },
  'tk-diff': {
    'Apply to [n] products': go('tk-applied'),
    'Ask for Shimano brake pads to be recounted': STAY,
    'Ask for [Product with sizes] to be recounted': STAY,
    'Count them as none': STAY,
  },
  'tk-applied': { 'Download the count': outside('A spreadsheet download'), Undo: go('tk-diff') },
  'tr-send': { Send: go('tr-sites'), 'Send to another shop': STAY },
  'tr-incoming': {
    'Cancel transfer T-[0000] to [Second site]': notDrawn('Cancel a transfer while it’s on its way (Stock take and stock control 11)'),
    'Receive a delivery': go('rs-receive'),
    'Receive transfer T-[0000] from [Second site]': go('tr-receive'),
    'Send to [Second site]': go('tr-send'),
  },
  // Named per board: these are situations of journey 13's screens, whose own
  // map would otherwise answer first.
  'tr-receive': { 'Book in [n] items': go('rs-booked'), 'Problem with Shimano brake pads': go('tr-problem'), 'Problem with [Product]': go('tr-problem') },
  'tr-problem': { 'Mark as missing': go('tr-receive'), 'Book in [n] items': STAY, 'Problem with Shimano brake pads': STAY, 'Problem with [Product]': STAY },
  'tr-today-short': { Open: go('tr-incoming') },
  // Staff stay on the Staff pages: no cost or margin (Reports 5; third walk, walk-throughs 3 M1, 9 M2).
  'st-list-staff': Object.fromEntries(['Shimano brake pads B05S-RX · [Category] · [Supplier]', 'Shimano brake pads B05S-RX · [Category] · [Supplier] · £28.00', 'Shimano brake pads B05S-RX · [Category] · [Supplier] · £[price]', '[Product] [Supplier code] · [Category] · [Supplier] · £[price]', '[Product] [Supplier code] · [Category] · [Supplier]'].map((k) => [k, go('st-product-staff')])),
};
