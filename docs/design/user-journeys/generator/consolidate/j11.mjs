// Journey 11, Selling at the till — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-11-15.md merge table.
import { keep, into, later } from './plan.mjs';

const SALE = 'Till 5, 11, 12; Customer service 10; walk-throughs 2 M6, 3 H1, 5 H1/H2';

export default {
  // A sale
  'till-sale': keep(19, { sizes: ['desktop', 'phone'] }), // rule 3: on a phone the basket becomes a bottom bar (till.mjs:23-25)
  'till-empty': into('till-sale', SALE),
  'till-noresults': into('till-sale', SALE),
  'till-held': into('till-sale', SALE),
  'till-held-job': into('till-sale', SALE),
  'till-line': keep(9),
  'till-discount': into('till-line', 'Till 3'),
  'till-discounted': into('till-sale', SALE),
  'till-customer': keep(21),
  'till-variant': keep(21),
  'till-serial': keep(21),
  'till-serial-held': into('till-serial', ''), // inferred: a warning on the frame box, like till-held on the till page
  // Taking payment
  'till-pay': keep(20),
  'till-pay-other': into('till-pay', 'Till 6, 15'),
  'till-card': keep(20),
  'till-card-discounted': into('till-card', 'Till 6'),
  'till-pay-discounted': into('till-pay', 'Till 6, 15'),
  'till-split-discounted': into('till-pay-split', ''),
  'till-card-declined': into('till-card', 'Till 6'),
  'till-pay-cash': keep(20),
  'till-pay-split': keep(20),
  'till-receipt': keep(20),
  // Other ways to pay
  'till-giftcard': keep(20),
  'till-account': keep(20),
  'till-loyalty': into('till-sale', SALE),
  'till-deposit': keep(20),
  // Other till jobs
  'till-park': keep(21),
  'till-find': keep(3),
  'till-find-customer': into('till-find', 'Till 13'),
  'till-sale-detail': keep(4),
  'till-refund': keep(9),
  'till-refund-older': into('till-refund', 'Till 9'),
  'till-refund-cash': into('till-refund', 'Till 9'),
  'till-refund-noreceipt': into('till-refund', 'Till 9'),
  'till-void': keep(8),
  'till-job': into('till-sale', SALE),
  'till-job-deposit': into('till-deposit', 'Till 11'),
  'till-job-balance': into('till-sale', SALE),
  'till-collect': keep(9),
  'till-book-in': keep(9), // walk-through 8 decision 8: two new till screens (Draw the decisions T1)
  'till-hand-over-job': keep(9), // walk-through 8 decision 8; the same layout as till-collect
  // Cycle to Work
  'till-c2w-pick': keep(21),
  'till-c2w': into('till-sale', SALE + '; Cycle to Work 5'),
  'till-c2w-pay': into('till-pay', 'Till 6, 15'),
  'till-c2w-extra': into('till-pay', 'Till 6, 15'),
  'till-c2w-paid': into('till-receipt', 'Till 7'),
  'till-c2w-deposit': into('till-sale', SALE + '; Cycle to Work 5'),
  // When the internet drops
  'till-offline': into('till-sale', SALE),
  'till-offline-long': into('till-sale', SALE),
  'till-needs-net': into('till-sale', 'Walk-through 2 M7'), // report: "Messages, not drawings"; shown on the till page
  'till-noted': into('till-sale', 'Walk-through 2 M7'), // report: "Messages, not drawings"
  'till-collect-offline': into('till-collect', 'Walk-through 2 M7'),
  'till-no-signout': into('till-sale', 'Walk-through 2 M7'), // report: "Messages, not drawings"
  'till-failed': keep(3), // report: a list layout of its own, for a manager
};
