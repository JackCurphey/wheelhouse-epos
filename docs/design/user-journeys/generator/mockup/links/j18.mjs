// Journey 18, Website management — where each button goes in the mockup.
// Sources: Website management decisions and the 3 Oct later changes
// (docs/decisions/2026-10-02-website-management-review.md; issue #116
// questions 2 and 3), consolidate/j18.mjs and its ws-page line, walk-through 4
// (second walk) H3 and M2.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

const editor = (what) => notDrawn(`${what} — later (issue #116 question 2)`);
const section = editor('A section’s settings in the website editor');
const move = editor('Moving a section in the website editor');
const wordsBox = notDrawn('The form box for one Words and photos part, its words or photo (Website, 3 Oct — walk-through 4 H3; a line on ws-page)');

export default {
  '*': {
    // Settings › Front desk areas, on the Online orders settings boards.
    Payments: go('set-pay-ways'),
    'End of day': go('set-eod'),
    // The Website page.
    '[shop-name].wheelhouseepos.com': go('wb-home'),
    'Turn it on': go('ws-published'), // "This also publishes your website as it is now"
    'Turn off': go('ws-page'),
    'Edit words and photos: opens the Words and photos list': STAY,
    'Edit: Headline': wordsBox, 'Edit: A line about the shop': wordsBox, 'Edit: The big photo': wordsBox,
    'Edit: The workshop’s words': wordsBox, 'Edit: The shop’s own words and photo': wordsBox,
    'Edit: Collection and returns': wordsBox, 'Edit: Privacy': wordsBox,
    'See the products with no photo, in Stock': go('st-list'),
    'See the products with no price, in Stock': go('st-list'),
    'Open Online orders settings': go('on-settings'),
    'Taking payments Not connected · customers can look but not buy · open to connect [payment provider] · in Settings › Front desk › Online orders Not connected': go('ws-pay-none'),
    'Taking payments Connected to [payment provider] · test payment done · in Settings › Front desk › Online orders': go('ws-pay-tested'),
    'Pages Home, About us, Contact us, Collection and returns, Privacy, Cookies': editor('Pages'),
    'Tracking tools None — so there’s no cookie choice': go('ws-tracking'),
    'Web address [shop-name].wheelhouseepos.com · your free address · Wheelhouse sets up your own address for you': notDrawn('Web address — later (issue #116 question 3)'),
    'Wheelhouse’s website or Shopify Wheelhouse’s website': go('ws-shopify-connect'),
    // The Website page on Shopify.
    'Pause sending': STAY,
    'Open Shopify': outside('Shopify’s own admin'),
    'Orders from Shopify In Front desk › Online orders, with your other orders': go('ws-shopify-order'),
    'What’s sent to Shopify “Show on website” on each category and product, in Stock': go('st-list'),
    'Taking payments Shopify’s checkout · Wheelhouse’s for “Pay now” on repairs': go('ws-pay-shopify'),
    'Wheelhouse’s website or Shopify Your Shopify shop · switch to Wheelhouse’s website': go('ws-shopify-switch'),
    Connect: outside('Shopify, to approve the connection'),
    // Publishing boards, still drawn over the editor (issue #116 question 2).
    'Back to Website': go('ws-page'),
    History: go('ws-history'),
    '3 online orders waiting': go('on-orders'),
    '3 orders waiting': go('on-orders'),
    'Skip to the sections list': STAY,
    Bigger: editor('The bigger preview in the website editor'),
    '+ Add section': editor('+ Add section in the website editor'),
    Header: section, 'Big photo and headline': section, 'Shop by category': section,
    'Featured products': section, 'Our shops': section, 'Words and a picture': section, Footer: section,
    'Move Big photo and headline up': move, 'Move Big photo and headline down': move,
    'Move Shop by category up': move, 'Move Shop by category down': move,
    'Move Featured products up': move, 'Move Featured products down': move,
    'Move Book a repair up': move, 'Move Book a repair down': move,
    'Move Our shops up': move, 'Move Our shops down': move,
    'Move Words and a picture up': move, 'Move Words and a picture down': move,
    // The website preview on those boards: the customer's pages (journey 1).
    'All categories': go('wb-shop'),
    '[Photo for Bearings] Bearings [n] products': go('wb-category'),
    '[Photo for Drivetrain] Drivetrain Derailleurs and [n] more': go('wb-category-parent'),
    '[Photo for [Category]] [Category] [n] products': go('wb-category'),
    '[Photo of Shimano brake pads B05S-RX] Shimano brake pads B05S-RX £28.00 Ready today at Bolton': go('wb-product'),
    '[Photo of [Product]] [Product] £[price] Ready today at Bolton': go('wb-product'),
    '[Product] [Product] £[price] Ready today at Bolton': go('wb-product'),
    '[Photo of [Product]] [Product] £[price] Ready at Bolton in [n] days': go('on-product-two-shops'),
    'Collecting from North Street Cycles, Bolton — change the shop': go('wb-choose-shop'),
    'All shops': go('wb-shops'),
    Bolton: go('wb-shop-page'),
    '[Second site]': go('wb-shop-page'),
    '[shop phone]': outside('The phone, calling the shop'),
    'Book a repair here': go('bk-service'),
    'Directions to Bolton (opens your maps app)': outside('The maps app'),
    'Directions to [Second site] (opens your maps app)': outside('The maps app'),
  },
  // Set-up steps 1–3 (Website 1–3).
  'ws-start-which': { Next: go('ws-start-look') },
  'ws-start-look': {
    Next: go('ws-start-products'),
    'Change logo': outside('This computer’s files, to choose the logo'),
    'Choose another colour': notDrawn('Choosing another main colour in set-up step 2'),
  },
  'ws-start-products': { 'Make my website': go('ws-page') },
  'ws-start-products-answered': { 'Make my website': go('ws-page'), 'Change what your website started with': go('ws-start-products') },
  'ws-start-shopify': { Next: go('ws-shopify-check') },
  // The Website page's situations.
  'ws-page-changes': {
    'Add it': wordsBox,
    Publish: go('ws-published'),
    'Discard changes': go('ws-discard'),
    'Review in the editor': editor('The website editor'),
  },
  'ws-no-access': { 'Back to Today': go('op-today') },
  'ws-no-settings': { 'Taking payments Connected to [payment provider] · test payment done': STAY, 'Taking payments Connected to [payment provider] · test payment done · in Settings › Front desk › Online orders': STAY },
  'ws-page-moving': { 'Turn it on': STAY, 'Open the switch-over checklist': go('mv-ready') }, // Turn it on waits for switch-over morning
  'ws-published': { Publish: STAY, 'View website': go('wb-home') },
  'ws-published-off': { Publish: STAY, 'View it': go('wb-home'), 'check them': go('ws-page') },
  'ws-discard': { Publish: go('ws-published'), 'Discard changes': notDrawn('The Website page after discarding: no unpublished changes') },
  'ws-history': {
    View: notDrawn('An earlier version of the website, to look at'),
    'Go back to this': go('ws-page-changes'),
  },
  'ws-tracking-on': { Undo: go('ws-tracking') },
  // Paying online (Online orders settings).
  'ws-pay-none': { 'Connect [payment provider]': outside('[payment provider]’s own page, to sign up or sign in') },
  'ws-pay-connected': { 'Make a test payment': go('ws-pay-tested') },
  'ws-pay-failed': { 'Try again': outside('[payment provider]’s own page, to sign up or sign in') },
  'ws-pay-more': { 'Add the details at [payment provider]': outside('[payment provider]’s own page') },
  'ws-today-pay-more': { 'Add the details': go('ws-pay-more'), 'Open the diary': go('diary'), 'Book in': go('till-book-in') },
  // Shopify.
  'ws-shopify-check': {
    'See the list of products': notDrawn('The list of products that will change in Shopify'),
    'Send [n] products': go('ws-shopify-sending'),
  },
  'ws-shopify-problem': { 'Fix [Product] in Stock': go('st-product'), 'Try sending again': go('ws-shopify-sending') },
  'ws-shopify-switch': { Switch: go('ws-page') },
  'ws-shopify-order': {
    'Online orders 3 to get ready': go('on-orders'),
    'Maya Patel Order [order number] · paid [time]': go('on-order-staff'),
    '[Customer] Order [order number] · paid [time]': go('on-order-staff'),
    '[Customer] Order [order number] · paid [time] · From Shopify': go('on-order-staff'),
    '[Customer] Order [order number] · ready since [time] Email didn’t arrive · [phone]': go('on-order-staff-ready'),
    '[Customer] Order [order number] · ready since [date] Not collected · [n] days': go('on-order-staff-ready'),
    '[Customer] Order [order number] · collected [time]': go('on-order-staff'),
    'Mark ready': go('on-orders-ready'),
    'Hand over [Customer]’s order': go('till-collect'),
  },
};
