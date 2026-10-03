// Journey 18, Website management — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ws-start-which': keep(24),
  'ws-start-look': keep(18), // step 2 of the set-up, its own step
  'ws-start-products': into('ws-start-which', ''),
  'ws-start-products-answered': into('ws-start-which', ''),
  'ws-editor-first': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-page': keep(1), // inferred block: the Website page, on/off and publishing
  'ws-page-on': into('ws-page', ''),
  'ws-page-changes': into('ws-page', ''),
  'ws-no-access': into('ws-page', ''),
  'ws-no-settings': into('ws-page', ''),
  'ws-page-moving': into('ws-page', ''),
  'ws-editor-moving': later('Issue #116 question 2: fixed website design, editor later'),
  'ws-pay-tested-moving': into('ws-pay-none', ''),
  'ws-address-moving': later('Issue #116 question 3: own web address frozen'),
  'ws-page-switch-over': into('ws-page', ''),
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
  'ws-published': into('ws-page', ''),
  'ws-published-off': into('ws-page', ''),
  'ws-discard': into('ws-page', ''),
  'ws-history': keep(14), // inferred block
  'ws-pages': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-pages-new': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-page-settings': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-page-returns': later('Issue #116 question 2: fixed website design, pages later'),
  'ws-tracking': keep(1),
  'ws-tracking-on': into('ws-tracking', ''),
  'ws-tracking-error': into('ws-tracking', ''),
  'ws-address': later('Issue #116 question 3: own web address frozen'),
  'ws-address-typo': later('Issue #116 question 3: own web address frozen'),
  'ws-address-steps': later('Issue #116 question 3: own web address frozen'),
  'ws-address-waiting': later('Issue #116 question 3: own web address frozen'),
  'ws-address-done': later('Issue #116 question 3: own web address frozen'),
  'ws-pay-none': keep(1),
  'ws-pay-connected': into('ws-pay-none', ''),
  'ws-pay-tested': into('ws-pay-none', ''),
  'ws-pay-failed': into('ws-pay-none', ''),
  'ws-pay-more': into('ws-pay-none', ''),
  'ws-today-pay-more': into('op-today', ''),
  'ws-start-shopify': into('ws-start-which', ''),
  'ws-shopify-connect': keep(9), // inferred: which Shopify screen stays a board
  'ws-shopify-failed': into('ws-shopify-connect', ''), // inferred
  'ws-shopify-check': into('ws-shopify-connect', ''), // inferred
  'ws-shopify-sending': into('ws-shopify-connect', ''), // inferred
  'ws-shopify-on': into('ws-page', ''),
  'ws-shopify-problem': into('ws-shopify-connect', ''), // inferred
  'ws-shopify-switch': into('ws-shopify-connect', ''), // inferred
  'ws-pay-shopify': into('ws-pay-none', ''),
  'ws-shopify-order': into('on-orders', ''), // journey 2's Online orders
};
