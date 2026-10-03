// Journey 13, Receiving stock and purchase orders — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'rs-hub': keep(3),
  'rs-hub-empty': into('rs-hub', '', "No orders: 'Shops that order on the supplier’s website can ignore this'"),
  'rs-hub-staff': into('rs-hub', '', "Staff: no orders, returns or restock list — 'for people who can order stock'"),
  'rs-receive': keep(27),
  'rs-add-product': keep(9),
  'rs-problem': keep(9),
  'rs-frame': into('rs-receive', '', "Bike scanned: a 'Frame number' step, 'Cancel' or 'Count this bike'"), // inferred: a one-field step while scanning
  'rs-frame-dup': into('rs-receive', '', "Frame step says 'This frame number is already in stock — booked in [date]'"), // inferred
  'rs-receive-marked': into('rs-receive', '', "List shows 'Damaged · 1, set aside' and the bike's frame numbers; 'items to book in · 1 set aside'"),
  'rs-book-blocked': into('rs-receive', '', "Book in stopped: 'Add [barcode] first, or remove it — then book in'"),
  'rs-problem-missing': into('rs-problem', '', "Missing part, no order: 'job WH-1042 is waiting for 1 · not on an order'; 'Mark as missing'"),
  'rs-booked': into('rs-delivery', '', "Just booked: '1 held for WH-1042 — put it with the bike on Hook 3'; 'Print labels', 'Receive another delivery'"), // inferred: the delivery's page just after booking in
  'rs-booked-staff': into('rs-delivery', '', "Staff, just booked: 'Print labels' first; damaged item '[Owner] will return it', no costs"), // inferred
  'rs-booked-job-waiting': into('rs-delivery', '', "'Job WH-1042 · still waiting — the pads were damaged'; the job stays waiting for parts"), // inferred
  'rs-labels': into('rs-delivery', '', "Print labels box: only items with no barcode or new; counts with − / +; 'Print [n] labels'"), // inferred: a box over the booked-in delivery
  'rs-receive-c2w': into('rs-receive', '', "Scanned bike line: 'for Maya Patel · Cycle to Work — put it aside'"),
  'rs-frame-c2w': into('rs-receive', '', "Frame step: 'This frame becomes the frame on Maya Patel’s Cycle to Work order'"), // inferred
  'rs-booked-c2w': into('rs-delivery', '', "Booked: bike 'put aside for Maya Patel — not for sale'; 'her order moves to Ready to collect'"), // inferred
  'rs-receive-staff': into('rs-receive', '', "Staff: 'only people who can add products can add it'; 'Leave it for [Owner or manager]'"),
  'rs-receive-staff-left': into('rs-receive', '', "'Left for [Owner or manager] · stays on the delivery as 1 product to add' with 'Undo'"),
  'rs-add-left': into('rs-add-product', '', "Opened from Products to add: 'left by Jo Taylor'; adding counts it into stock, then offers its label"),
  'rs-today-to-add': into('op-today', '', "Card: '1 product to add from a delivery', 'Left by Jo Taylor at [time]'; 'Add this product'"),
  'rs-job-arrived': into('job-overview', '', "Waiting for parts: 'Part arrived' banner; 'Carry on with the work'"),
  'rs-part-sold': into('job-overview', '', "Banner: held pads 'were sold at the till · reorder them, or tell Maya'"),
  'rs-part-missing': into('job-overview', '', "Banner: 'Not in the delivery on [date] · still on order'; the part line says 'On order'"),
  'rs-part-damaged': into('job-overview', '', "Banner: pads 'came damaged … set aside, not added to stock · reorder them, or tell Maya'"),
  'rs-part-order-closed': into('job-overview', '', "Banner: 'The order was closed on [date] before the … pads came · reorder them, or tell Maya'"),
  'rs-diary-arrived': into('diary', '', "The job's block in the diary shows 'Part arrived'"),
  'rs-overview-arrived': into('overview', '', "The job's row shows 'waiting for parts' and 'Part arrived'"), // journey 12's Workshop overview
  'rs-delivery': keep(4),
  'rs-invoice': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-checked': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-diff': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-cost': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-queried': later('Issue #116 question 6: invoice check later'),
  'rs-invoice-accepted': later('Issue #116 question 6: invoice check later'),
  'rs-delivery-staff': into('rs-delivery', '', "Staff and mechanics: no costs — 'Costs are for people who can order stock.'"),
  'rs-invoice-setting': later('Issue #116 question 6: invoice check later'),
  'rs-order': keep(4),
  'rs-order-ordered': into('rs-order', '', "Ordered, 'Partly delivered': arrived counts per line; 'Close the order', 'Receive against this order'"),
  'rs-order-close': into('rs-order', '', "'Close the order?' box: a job's pads still to come; 'Keep it open'"),
  'rs-restock': keep(3),
  'rs-restock-customers': into('rs-restock', '', "'For customers' view: each line says which job or online order and when it's promised"),
  'rs-today-restock': into('op-today', '', "Card: '[n] new products running low, selling fast or for customers' with 'Open'"),
  'po-suppliers': later('Build plan: held back'),
  'po-feed': later('Build plan: held back'),
  'po-send': later('Build plan: held back'),
};

// Decisions drawn as lines, with no old drawing behind them ("Draw the
// answers" spec, section 17: V1–V3).
export const lines = [
  { on: 'rs-delivery', text: "Booked in, as someone who can order stock: each line has Cost went up? Change it, and the product's cost and history record it", who: 'Owner and Manager', decision: 'Receiving stock, 3 Oct (walk-through 3 M3)' },
  { on: 'rs-restock', text: 'For customers: a part added to a job with no free stock is on the list by itself, not yet ordered', who: 'Owner', decision: 'Receiving stock, 3 Oct (walk-through 3 M7)' },
  // Read from the old phone drawing, rs-receive-phone.
  { on: 'rs-receive', text: 'On a phone: Scan the box at the top, the list fills the screen, Book in [n] items at the bottom', who: 'Staff', decision: 'Stock control 5, 12; walk-through 3 M5' },
  // Third walk, 3 Oct (walk-through 3 M2).
  { on: 'rs-order', text: "Just ordered: every line 'ordered [n] · arrived 0', 'Waiting for the delivery'; job WH-1042's line now reads On order", who: 'Owner', decision: 'Receiving stock, 3 Oct (walk-through 3 M7); 3 Oct (third walk, walk-through 3 M2)' },
];
