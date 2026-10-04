// Journey 2, Buying online — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-B-1-2.md merge table.
import { keep, into, later, same } from './plan.mjs';

export default {
  'on-product': into('wb-product', 'Buy online 2, 8', "Journey 2’s simpler page: one photo and a description, no specifications; 'Ready today at Bolton · [n] in stock'"),
  'on-product-added': into('wb-product', 'Buy online 2, 8', "Quantity 2; basket shows 3 (with [Product] already in it); message 'Added 2 × Shimano brake pads' with 'View basket'"),
  'on-product-two-shops': into('wb-product', 'Buy online 2, 8', "Grey 'Ready at Bolton in [n] days — it’s at our [Second site] shop, and we’ll bring it over'"),
  'on-product-order-in': into('wb-product', 'Buy online 2, 8', "Grey 'Ready at Bolton in about [n] days — we order it in for you'"),
  'on-product-out': into('wb-product', 'Buy online 2, 8', "Amber 'Not in stock at Bolton'; no Add to basket — 'Ask the shop about it', phone and email"),
  'on-product-out-other': into('wb-product', 'Buy online 2, 8', "Amber 'Not in stock at Bolton — in stock at our [Second site] shop'; 'Collect from [Second site] instead'"),
  'on-product-no-shop': into('wb-product', 'Buy online 2, 8', "'Choose a shop to see when it’s ready'; note 'Add to basket asks which shop first'"),
  'on-choose-shop': into('wb-choose-shop', 'Buy online 8, audit M3', "Over the product page: 'We’ll add it to your basket, remember the shop…'"),
  'on-product-off': into('wb-product', 'Buy online later change', "Grey 'Not taking online orders right now. Ask in the shop, or call us'; no Add to basket"),
  'on-basket': keep(35),
  'on-basket-changed': into('on-basket', 'Buy online audit H1', "Amber 'Something in your basket changed'; 'Only 1 left'; an item no longer in stock; checkout off"),
  'on-basket-empty': into('on-basket', 'Buy online audit H1', "'Removed Shimano brake pads.' with Undo; 'Your basket is empty.'; 'Carry on shopping'"),
  'on-checkout': keep(35),
  'on-checkout-errors': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "'Check the 2 boxes marked below.'; 'Enter your name' and an email address error"),
  'on-checkout-credit': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Signed in as Maya; 'Use my store credit' ticked; 'Left to pay'; 'Pay £[£]'"),
  'on-checkout-covered': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Store credit covers it all: no card form; 'Place order'"),
  'on-checkout-gift-code': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Gift card code box: 'We don’t recognise that code.' with 'Use it'"),
  'on-checkout-gift': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Green 'Gift card … £[£] used' and '£[£] left on your gift card'; 'Pay £[£]'"),
  'on-checkout-paying': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Pay button greyed: 'Paying — please don’t close this page'"),
  'on-checkout-bank': keep(39), // the bank's check box the report keeps
  'on-checkout-declined': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "Card box in red; 'Your card was declined — nothing has been taken. Try another card'"),
  'on-checkout-unsure': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "No Pay button: 'We couldn’t confirm your payment. Don’t pay again'; an email within [n] minutes"),
  'on-checkout-sold-out': into('on-checkout', 'Buy online 5, 10; audit H2, M7', "'[Product] has just sold out at Bolton. Nothing has been taken.'; Pay greyed"),
  'on-confirmed': keep(40),
  'on-save-details': into('on-confirmed', 'Buy online 4', "Save box: 'We’ve sent a code', a 'Code from the email' box, 'Send a new code'"),
  'on-order': keep(4),
  'on-order-moving': into('on-order', 'Buy online 7, M4', "'Your order is on its way to Bolton'; step 'Coming from [Second site]'; 'arrives [day]'"),
  'on-order-ready': into('on-order', 'Buy online 7, M4', "'Your order is ready to collect'; big order number; 'Collect it' box with Receipt; no Cancel"),
  'on-order-collected': into('on-order', 'Buy online 7, M4', "'Collected — thank you'; 'Collected on [date] from Bolton.' with Receipt"),
  'on-order-cancel': into('on-order', 'Buy online 7, M4', "'Cancel this order?' box: refund the way you paid; 'Keep my order' or 'Cancel the order'"),
  'on-order-cancelled': into('on-order', 'Buy online 7, M4', "'Order cancelled', no steps; 'Your refund' box: back the way you paid"),
  'on-order-clash': into('on-order', 'Buy online 7, M4', "Ready, with red 'Sorry — your order has just been marked ready, so it can’t be cancelled here.'"),
  'on-order-shop-cancelled': into('on-order', 'Buy online 7, M4', "'Order cancelled': 'We cancelled this order because it wasn’t collected by [date]'; refund"),
  'on-order-cant-supply': into('on-order', 'Buy online 7, M4', "Amber 'Sorry — we couldn’t supply [Product].' with their reason; item 'Couldn’t supply · refunded'"),
  'on-email-ready': keep(46), // inferred: the only email in the journey; the report's count of 11 includes it
  'on-orders': keep(3),
  'on-orders-ready': into('on-orders', 'Buy online 6; H4, M1', "Message 'Ready. The email goes to [Customer] in [n] seconds' with Undo; 2 to get ready, 3 ready"),
  'on-orders-arrived': into('on-orders', 'Buy online 6; H4, M1', "Maya’s item 'Arrived from [Second site]'; 'Mark ready' in place of 'Waiting for 1 item'"),
  'on-orders-sold-at-till': into('on-orders', 'Buy online 6; H4, M1', "Pads 'Not on the shelf any more'; Mark ready off: 'Sold at the till. Open the order to sort it.'"),
  'on-orders-second': into('on-orders', 'Buy online 6; H4, M1', "At [Second site]: 'To send to another shop' with 'Send to Bolton'; nothing to get ready"),
  'on-order-staff': keep(4),
  'on-order-staff-ready': into('on-order-staff', 'H4, H5', "'Ready since [time] · emailed · waiting at [Shelf name]'; 'Hand over' and 'Not ready after all'"),
  'on-not-ready': into('on-order-staff', 'H4, H5', "'Not ready after all?' box: back to 'To get ready'; ticked 'Send Maya “Sorry, not ready yet”'"),
  'on-cant-supply': keep(9),
  'on-cancel-refund': into('on-cant-supply', 'Buy online 7, M2', "'Cancel and refund this order?' for the whole order; a reason Maya sees is needed"),
  'on-hand-over': same('till-collect'), // online.mjs draws it as till-collect itself
  'on-hand-over-refunded': into('till-collect', 'H5', "Hand-over adds: one item 'couldn’t be supplied and was refunded — nothing to hand over for it'"),
  'on-today': into('op-today', 'Buy online 6, 7', "A '[n] new online orders' line with 'Open Online orders'"),
  'on-today-uncollected': into('op-today', 'Buy online 6, 7', "Amber 'Order [order number] · Maya Patel — not collected' with 'Contacted' and 'Open'"),
  'on-settings': keep(1),
  'on-settings-order-in': into('on-settings', 'Buy online 2, 3', "'Also things we can order in' picked; 'Moving between shops takes' and 'Ordering in takes about'"),
  'on-settings-start': later('Dropped, not later: coverage walks answer 2 (4 Oct), the question is asked once, in the website’s set-up'),
  'on-settings-start-answered': later('Dropped, not later: coverage walks answer 2 (4 Oct), the question is asked once, in the website’s set-up'),
  'on-settings-show': into('on-settings', 'Buy online 2, 3', "'Showing products' open: a switch per category; 'Started with every product online on [date]' with Change"),
  'on-settings-pay': into('on-settings', 'Buy online 2, 3', "Paying open: 'Connected to [payment provider]', three switches; 'Remind the customer after', 'Keep orders for'"),
  'on-settings-keep': into('on-settings', 'Buy online 2, 3', "Scrolled to 'Keep orders for [n] days' and 'Shelf or spot' ([Shelf name])"),
  'on-messages': into('set-msg-list', 'M5', "Scrolled down to the online order messages"),
};

// Extra situation lines (Draw the answers, spec section 14: ON3).
export const lines = [
  { on: 'on-orders', text: 'Till only (no email): this page opens from the till, so a till-only worker can mark orders ready', who: 'Staff', decision: 'Walk-through 8 decision 8; 3 Oct (walk-through 10 M1)' },
];
