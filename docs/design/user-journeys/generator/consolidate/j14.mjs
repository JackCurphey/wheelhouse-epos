// Journey 14, Stock take and stock control — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'st-list': keep(3),
  'st-list-staff': into('st-list', '', "Staff: no 'Margin' column and no '+ Add a product'"),
  'st-search-measure': into('st-list', '', "Search 'bearing 30 mm': '2 bearings with 30 mm', each showing its measurements"),
  'st-filter-bearings': into('st-list', '', "Bearings picked: 'Bearings details' filters (Inner diameter, Outer diameter, Height) and those as columns"),
  'st-filter-derailleurs': into('st-list', '', "Derailleurs picked: a 'Number of gears' filter; '2 derailleurs with [n] gears'"),
  'st-search-size': into('st-list', '', "Search finds one size: '1 size and colour', 'Size M · [Colour 1] · its own barcode'"),
  'st-list-none': into('st-list', '', "'Nothing matches “[what was typed]”' with '+ Add “[what was typed]” as a product'"),
  'st-list-unknown': into('st-list', '', "'Barcode [barcode] isn’t in Wheelhouse yet' with 'Add this product'"),
  'st-list-new': into('st-list', '', "'No products yet' with 'Bring them from Citrus Lime'"),
  'st-categories': keep(1),
  'st-category-edit': keep(9),
  'st-product': keep(4),
  'st-product-staff': into('st-product', '', "Staff: no 'Edit', no cost or margin, no 'Show on website'"),
  'st-product-bike': into('st-product', '', "Bike: 'Bikes by frame number' — each one in stock, 'Held' for a customer, or sold with warranty date"),
  'st-product-sizes': into('st-product', '', "'Sizes and colours' grid of stock, '+ Add a size or colour'; each has its own barcode"), // inferred
  'st-list-ticked': into('st-list', '', "'3 ticked' bar: 'Untick all', 'Print labels', 'Send to another shop', 'Change prices'"),
  'st-prices': keep(9),
  'st-prices-done': into('st-prices', '', "Toast: 'Prices changed · 3 products' with 'Undo'"),
  'st-adjust': keep(9),
  'st-adjust-faulty': into('st-adjust', '', "Faulty picked: 'Takes it out of stock and puts it on To return to [Supplier]'"),
  'st-today-adjust': into('op-today', '', "Card: 'Stock adjusted: [Product] · −[n] · £[value] · Damaged · by Jo Taylor' with 'Seen'"),
  'st-setting-adjust': into('st-categories', '', "Setting: 'Show on Today when an adjustment is worth more than' [£], at cost"), // inferred: another section of Settings › Stockroom
  'st-today-below': into('op-today', '', "Card: '[n] products below zero' with 'See them' and 'Count them'"),
  'tk-count-below': into('tk-count', '', "'Counting: below zero' — 'Find and scan these', 'Still to find · [n]'; started from Today"),
  'tr-sites': into('st-product', '', "Stock at each shop and 'On its way to [Second site]'; history line 'Sent to [Second site] · transfer T-[0000]'"), // inferred: a section of the product's page
  'tr-send': keep(9),
  'tr-incoming': into('rs-hub', '', "Sections 'On its way from another shop' ('Receive it') and 'On its way to other shops' ('Cancel this send')"),
  'tr-receive': into('rs-receive', '', "'Receive transfer T-[0000] · From [Second site]': 'sent [n]' per line; '1 missing — [Second site] will be told'"),
  'tr-problem': into('rs-problem', '', "Transfer line marked missing: 'Missing items are flagged to both shops.'"),
  'tr-today-short': into('op-today', '', "Card: 'Transfer T-[0000] from [Second site] arrived with 1 missing' with 'Open'"),
  'tk-hub': keep(3),
  'tk-hub-staff': into('tk-hub', '', "Staff: 'Join' only; 'Starting a count, and checking and applying it, are for managers.'"),
  'tk-start': keep(9),
  'tk-start-category': into('tk-start', '', "'Which category': 'Everything in this category — and nothing else — is compared.'"),
  'tk-count': keep(27),
  'tk-diff': keep(3), // its own step: a list of differences, largest first
  'tk-applied': into('tk-diff', '', "'Count applied · [Category] · [n] products corrected' with 'Undo'; 'Download the count'"),
};
