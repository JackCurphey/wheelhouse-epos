// Journey 13, Receiving stock and purchase orders — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'rs-hub': keep(3),
  'rs-hub-empty': into('rs-hub', ''),
  'rs-hub-staff': into('rs-hub', ''),
  'rs-receive': keep(27),
  'rs-add-product': keep(9),
  'rs-problem': keep(9),
  'rs-frame': into('rs-receive', ''), // inferred: a one-field step while scanning
  'rs-frame-dup': into('rs-receive', ''), // inferred
  'rs-receive-marked': into('rs-receive', ''),
  'rs-book-blocked': into('rs-receive', ''),
  'rs-problem-missing': into('rs-problem', ''),
  'rs-booked': into('rs-delivery', ''), // inferred: the delivery's page just after booking in
  'rs-booked-staff': into('rs-delivery', ''), // inferred
  'rs-booked-job-waiting': into('rs-delivery', ''), // inferred
  'rs-labels': into('rs-delivery', ''), // inferred: a box over the booked-in delivery
  'rs-receive-c2w': into('rs-receive', ''),
  'rs-frame-c2w': into('rs-receive', ''), // inferred
  'rs-booked-c2w': into('rs-delivery', ''), // inferred
  'rs-receive-staff': into('rs-receive', ''),
  'rs-receive-staff-left': into('rs-receive', ''),
  'rs-add-left': into('rs-add-product', ''),
  'rs-today-to-add': into('op-today', ''),
  'rs-job-arrived': into('job-overview', ''),
  'rs-part-sold': into('job-overview', ''),
  'rs-part-missing': into('job-overview', ''),
  'rs-part-damaged': into('job-overview', ''),
  'rs-part-order-closed': into('job-overview', ''),
  'rs-diary-arrived': into('diary', ''),
  'rs-overview-arrived': into('overview', ''), // journey 12's Workshop overview
  'rs-delivery': keep(4),
  'rs-invoice': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-checked': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-diff': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-cost': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-queried': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-accepted': later('Issue #116 question 6: invoice check later'),
  'rs-delivery-staff': into('rs-delivery', ''),
  'rs-invoice-setting': later('Issue #116 question 6: invoice check later'),
  'rs-order': keep(4),
  'rs-order-ordered': into('rs-order', ''),
  'rs-order-close': into('rs-order', ''),
  'rs-restock': keep(3),
  'rs-restock-customers': into('rs-restock', ''),
  'rs-today-restock': into('op-today', ''),
  'po-suppliers': later('Build plan: held back'),
  'po-feed': later('Build plan: held back'),
  'po-send': later('Build plan: held back'),
};
