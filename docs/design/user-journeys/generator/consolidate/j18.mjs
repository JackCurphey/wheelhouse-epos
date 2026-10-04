// Journey 18, Website management — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ws-start-which': keep(24),
  'ws-start-look': keep(24), // step 2 of the set-up, its own step
  'ws-start-products': into('ws-start-which', '', "Step 3 of 3: 'Every product online' or 'Nothing online'; counts with no photo or no price; 'Make my website'"),
  'ws-start-products-answered': later('Dropped, not later: coverage walks answer 2 (4 Oct), the question is asked once, in the website’s set-up'),
  'ws-editor-first': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-page': keep(1), // inferred block: the Website page, on/off and publishing
  'ws-page-on': into('ws-page', '', "'Your website is on' with 'Turn off'; '3 unpublished changes'; payments connected"),
  'ws-page-changes': into('ws-page', '', "The 3 unpublished changes listed, with 'Publish', 'Discard changes', 'Review in the editor'"),
  'ws-no-access': into('ws-page', '', "No 'Can edit the website': 'Only some people can change the website' — ask Jack Lewis"),
  'ws-no-settings': into('ws-page', '', "Can edit, not settings: selling and payments 'are in Settings, which you can’t change. Ask Jack Lewis'"),
  'ws-page-moving': into('ws-page', '', "Moving: 'Your website goes on during switch-over morning'; 'Ready for switch-over · 1 of 2'"),
  'ws-editor-moving': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-pay-tested-moving': into('ws-pay-none', '', "Test payment worked, plus 'Customers can buy once your website goes on, during switch-over morning'"),
  'ws-address-moving': later('Issue #116 question 3: own web address frozen'),
  'ws-page-switch-over': into('ws-page', '', "'Your website is ready': 'Switch-over morning: turn your website on now'; '2 of 2'"),
  'ws-editor': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-section': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-add': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-drag': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-moved': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-removed': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-header': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-on-phone': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-bigger': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-pages-menu': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-saving': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-editor-taken': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-theme': later('Issue #116 question 2: fixed website design, theme later'),
  'ws-theme-contrast': later('Issue #116 question 2: fixed website design, theme later'),
  'ws-theme-publish': later('Issue #116 question 2: fixed website design, theme later'),
  'ws-theme-product': later('Issue #116 question 2: fixed website design, theme later'),
  'ws-theme-fonts': later('Issue #116 question 2: fixed website design, theme later'),
  'ws-published': into('ws-page', '', "Toast: 'Published — customers see it now' with 'View website'"),
  'ws-published-off': into('ws-page', '', "Toast: 'Published. Customers will see it once you turn the website on' with 'View it'"),
  'ws-discard': into('ws-page', '', "'Discard your 3 unpublished changes?' box: kept in History for [n] days; 'Keep editing' or 'Discard changes'"),
  'ws-history': keep(14), // inferred block
  'ws-pages': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-pages-new': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-page-settings': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-page-returns': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-tracking': keep(1),
  'ws-tracking-on': into('ws-tracking', '', "Google Analytics 'On' with its ID; cookie question and 'Cookie choices' come when you publish"),
  'ws-tracking-error': into('ws-tracking', '', "ID error: 'That doesn’t look like a Google Analytics ID. It starts with G-'"),
  'ws-address': later('Issue #116 question 3: own web address frozen'),
  'ws-address-typo': later('Issue #116 question 3: own web address frozen'),
  'ws-address-steps': later('Issue #116 question 3: own web address frozen'),
  'ws-address-waiting': later('Issue #116 question 3: own web address frozen'),
  'ws-address-done': later('Issue #116 question 3: own web address frozen'),
  'ws-pay-none': keep(1),
  'ws-pay-connected': into('ws-pay-none', '', "Just connected: 'Make a test payment before customers use it' — £1.00, refunded"),
  'ws-pay-tested': into('ws-pay-none', '', "'Test payment worked. £1.00 taken and refunded.' and where payouts go"),
  'ws-pay-failed': into('ws-pay-none', '', "'Not connected. [payment provider] didn’t finish connecting, so nothing has changed.' with 'Try again'"),
  'ws-pay-more': into('ws-pay-none', '', "Warning: '[payment provider] needs more details from you by [date], or online payments will stop'"),
  'ws-today-pay-more': into('op-today', '', "Card: '[payment provider] needs more details by [date]' with 'Add the details'"),
  'ws-start-shopify': into('ws-start-which', '', "Shopify step 2 of 3: what happens to products and orders; 'Your Shopify address' and 'Connect'"),
  'ws-shopify-connect': keep(9), // inferred: which Shopify screen stays a board
  'ws-shopify-failed': into('ws-shopify-connect', '', "'Couldn’t connect. Shopify didn’t find [your-shop].myshopify.com, or the approval was cancelled.'"), // inferred
  'ws-shopify-check': into('ws-shopify-connect', '', "'Ready to send to Shopify': how many products change; 'Send [n] products' or 'Not now'"), // inferred
  'ws-shopify-sending': into('ws-shopify-connect', '', "'Sending to your Shopify shop': '[n] of [n] products sent. You can leave this page'"), // inferred
  'ws-shopify-on': into('ws-page', '', "Website page when on Shopify: 'Connected to your Shopify shop', 'Pause sending', 'Open Shopify'"),
  'ws-shopify-problem': into('ws-shopify-connect', '', "'3 products couldn’t be sent to Shopify', each with its reason; 'Try sending again'"), // inferred
  'ws-shopify-switch': into('ws-shopify-connect', '', "'Switch to Wheelhouse’s website?' box: Wheelhouse stops sending to Shopify; Shopify shop stays"), // inferred
  'ws-pay-shopify': into('ws-pay-none', '', "Shopify takes website payments; [Payment provider] only for 'Pay now' on repairs"),
  'ws-shopify-order': into('on-orders', '', "Order row says 'From Shopify'"), // journey 2's Online orders
};

// "Draw the answers" W2: Jack's 3 Oct answer drawn as a line (spec B0).
export const lines = [
  { on: 'ws-page', text: 'Edit on a Words and photos row: a form box with that part\'s words or photo; a row with starting wording says Check this until it\'s saved once', who: 'Owner', decision: 'Website management, 3 Oct (walk-through 4 H3)' },
// The coverage walks (4 Oct, docs/design/user-journeys/walk-4/): Jack's answers and the walks' fixes drawn as lines.
  { on: 'ws-page', text: "Moving from Citrus Lime before payments are connected: the Taking payments row reads 'Not connected · customers can look but not buy · open to connect [payment provider]', as here", who: 'Owner', decision: 'Website management 5, 8, 12 H5; 4 Oct (coverage walk 5 M1)' },
];
