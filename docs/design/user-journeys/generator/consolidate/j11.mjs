// Journey 11, Selling at the till — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-11-15.md merge table.
import { keep, into, later } from './plan.mjs';

const SALE = 'Till 5, 11, 12; Customer service 10; walk-throughs 2 M6, 3 H1, 5 H1/H2';

export default {
  // A sale
  'till-sale': keep(19, { sizes: ['desktop', 'phone'] }), // rule 3: on a phone the basket becomes a bottom bar (till.mjs:23-25)
  'till-empty': into('till-sale', SALE, "Basket empty: 'Nothing in the sale yet', £0.00 total"),
  'till-noresults': into('till-sale', SALE, "Left side shows 'Nothing matches “[what was typed]”' and search tips, no quick buttons"),
  'till-held': into('till-sale', SALE, "Pads line warns '[n] held for online orders — sold anyway'"),
  'till-held-job': into('till-sale', SALE, "Pads line warns '1 held for job WH-1042 — selling it leaves Maya's job waiting for parts'"),
  'till-line': keep(9),
  'till-discount': into('till-line', 'Till 3', "Whole-sale discount dialog: 'Sale total £74.00 · 3 items', 'New total' £70.00, 'Remove discount'"),
  'till-discounted': into('till-sale', SALE, "Basket has a 'Discount · [reason]' line −£4.00; total and 'Take payment · £70.00'"),
  'till-customer': keep(21),
  'till-variant': keep(21),
  'till-serial': keep(21),
  'till-serial-held': into('till-serial', '', "Warning 'Sell anyway? Maya’s order loses its bike.' and button 'Sell anyway · add to sale'"), // inferred: a warning on the frame box, like till-held on the till page
  // Taking payment
  'till-pay': keep(20),
  'till-pay-other': into('till-pay', 'Till 6, 15', "'Other ways to pay' opened: Finance, Cycle to Work, Payment link, [Shop’s own]"),
  'till-card': keep(20),
  'till-card-discounted': into('till-card', 'Till 6', "Discount line −£4.00 in the basket; card machine asks for £70.00, not £74.00"),
  'till-pay-discounted': into('till-pay', 'Till 6, 15', "Discount line −£4.00 in the basket; payment dialog and 'Card · £70.00' from the new total"),
  'till-split-discounted': into('till-pay-split', '', "Split from the discounted £70.00: £50.00 left, 'Card · £50.00'"),
  'till-card-declined': into('till-card', 'Till 6', "'Card declined', nothing taken: 'Try the card again' or 'Pay another way'"),
  'till-pay-cash': keep(20),
  'till-pay-split': keep(20),
  'till-receipt': keep(20),
  // Other ways to pay
  'till-giftcard': keep(20),
  'till-account': keep(20),
  'till-loyalty': into('till-sale', SALE, "Maya Patel in the basket with '[£ amount] store credit', 'Earned on past purchases', 'Use it'"),
  'till-deposit': keep(20),
  // Other till jobs
  'till-park': keep(21),
  'till-find': keep(3),
  'till-find-customer': into('till-find', 'Till 13', "Maya Patel picked ('Change'); list of 'Maya Patel’s sales', each with 'Refund'"),
  'till-sale-detail': keep(4),
  'till-refund': keep(9),
  'till-refund-older': into('till-refund', 'Till 9', "Header reads 'Maya Patel · [date] · paid by card' instead of today"),
  'till-refund-cash': into('till-refund', 'Till 9', "Cash sale: 'Give back in cash', drawer opens; 'Refund £28.00 · open the drawer'"),
  'till-refund-noreceipt': into('till-refund', 'Till 9', "'No receipt or record': pick items, needs a [Customer]; 'Add [£] to store credit'"),
  'till-void': keep(8),
  'till-job': into('till-sale', SALE, "Basket is job WH-1042's agreed lines for Maya Patel, 'Bike collected when paid', £111.00"),
  'till-job-deposit': into('till-deposit', 'Till 11', "Deposit on job WH-1042: £27.75 now, £83.25 at collection; 'Bike stays in.'"),
  'till-job-balance': into('till-sale', SALE, "Job WH-1042 basket with 'Deposit paid' −£27.75 line; 'Take payment · £83.25'"),
  'till-collect': keep(9),
  'till-book-in': keep(9), // walk-through 8 decision 8: two new till screens (Draw the decisions T1)
  'till-hand-over-job': keep(9), // walk-through 8 decision 8; the same layout as till-collect
  // Cycle to Work
  'till-c2w-pick': keep(21),
  'till-c2w': into('till-sale', SALE + '; Cycle to Work 5', "Basket is Maya's Cycle to Work order: bike with held frame, accessories 'on the order', all £[£]"),
  'till-c2w-pay': into('till-pay', 'Till 6, 15', "Payment dialog for the order: 'Cycle to Work · [Provider]' first, then Card"),
  'till-c2w-extra': into('till-pay', 'Till 6, 15', "Accessory 'added at the counter'; certificate covers the order, 'Maya pays' it by card"),
  'till-c2w-paid': into('till-receipt', 'Till 7', "Paid by 'Cycle to Work · [Provider] and card'; bike collected with frame on her record"),
  'till-c2w-deposit': into('till-sale', SALE + '; Cycle to Work 5', "One line 'Deposit · Maya Patel’s Cycle to Work order'; note it's refunded when the certificate arrives"),
  // When the internet drops
  'till-offline': into('till-sale', SALE, "Bar shows 'Offline · [n] waiting to send' with a 'No internet — keep selling' notice"),
  'till-offline-long': into('till-sale', SALE, "Bigger notice: 'Offline for over 4 hours — prices and customer details may be out of date'"),
  'till-needs-net': into('till-sale', 'Walk-through 2 M7', "Offline till, dialog 'Refunds need the internet' with 'OK' or 'Note it for later'"), // report: "Messages, not drawings"; shown on the till page
  'till-noted': into('till-sale', 'Walk-through 2 M7', "Offline till, dialog 'Noted for later': the refund from B1-[0000] on the list to finish"), // report: "Messages, not drawings"
  'till-collect-offline': into('till-collect', 'Walk-through 2 M7', "Offline note on the hand-over: 'its own copy of the order', marked 'To send'"),
  'till-no-signout': into('till-sale', 'Walk-through 2 M7', "Offline till, dialog 'Can’t sign this till out yet' — '[n] sales are still waiting to send'"), // report: "Messages, not drawings"
  'till-failed': keep(3), // report: a list layout of its own, for a manager
};

// Extra situation lines (Draw the answers, spec section 6: T5, T6, T7).
export const lines = [
  // T5 — the sale
  { on: 'till-sale', text: 'A refund noted while offline, still to finish: Past sales carries the count', who: 'Staff', decision: 'UX walk-through decisions 5; 3 Oct (walk-through 2 H1)' },
  { on: 'till-sale', text: 'While running alongside Citrus Lime: Take payment is off until switch-over day', who: 'Staff', decision: 'Moving from Citrus Lime, 3 Oct (walk-through 4 H2)' },
  { on: 'till-sale', text: "A job already paid online can't go in the basket; it says Paid online · [date]", who: 'Staff', decision: 'Collect and pay 5 (H3); walk-through 10 H2' },
  { on: 'till-sale', text: "After closing time, for someone who can't close the day: Closing up? [Name] closes the day. If nobody who can is in, just check out; the drawer is counted when the shop next opens", who: 'Staff', decision: 'Cash-up 5; Opening the shop 7; walk-through 10 M3' },
  // T6 — a refund
  { on: 'till-refund', text: 'Finishing a noted refund: the sale and items already filled in', who: 'Staff', decision: 'UX walk-through decisions 5; 3 Oct (walk-through 2 H1)' },
  // T7 — handing over an online order
  { on: 'till-collect', text: 'Handed over: Handed over · Undo for a few minutes', who: 'Staff', decision: 'Collect and pay 5 (M4); walk-through 10 L2' },
];
