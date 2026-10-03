// Journey 13, Receiving stock — where each button goes in the mockup.
// From the Receiving stock decisions (30 Sep): Deliveries and orders as the
// Stockroom's hub, scan each item, an unknown barcode added with its
// measurements, a problem marked on the line, booked in with the waiting job
// flagged, labels only for what needs one, the restock list by supplier.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

const BASKET = outside('A download for the supplier’s website basket');

// The job's page (journey 12's board), as these situations show it
const job = (extra = {}) => ({
  'Add item': STAY,
  'Scan barcode': STAY,
  Notes: STAY,
  'Email Maya Patel': outside('The email app'),
  'Message Maya Patel': go('ac-inbox'),
  'Full service checklist 8 of 10 done · 1 note': go('job-checklist'),
  'Mark ready for collection': go('job-finished'),
  ...extra,
});

export default {
  '*': {
    // Deliveries and orders
    '+ New order': go('rs-order'),
    'Receive a delivery': go('rs-receive'),
    'Add this product: barcode [barcode]': go('rs-add-left'),
    'Open the delivery from [Supplier], [date]': go('rs-delivery'),
    'Open the delivery from [Supplier 2], [date]': go('rs-delivery'),
    'Open the draft order for [Supplier 2]': go('rs-order'),
    'Open the order from [Supplier], ordered [date]': go('rs-order-ordered'),
    'Returned: [Product], damaged': STAY,
    'Returned: [Product], wrong item': STAY,
    'See the list of products for customers': go('rs-restock-customers'),
    'See the list of products running low': go('rs-restock'),
    'See the list of products selling fast': go('rs-restock'),
    // Receiving: each line
    'Add this product': go('rs-add-product'),
    'Book in [n] items': go('rs-booked'),
    'Problem with Shimano brake pads': go('rs-problem'),
    'Problem with [Product]': go('rs-problem'),
    'Problem with [Bike name]': go('rs-problem'),
    'Problem with [Bike]': go('rs-problem'),
    'Count this bike': go('rs-receive-marked'),
    // Booked in
    'Open job WH-1042': go('rs-job-arrived'),
    'Open the order from [Supplier]': go('rs-order-ordered'),
    'Print labels': go('rs-labels'),
    'Receive another delivery': go('rs-receive'),
    'See what’s to return to [Supplier]': go('rs-hub'),
    // Restock list
    'Add to an order': go('rs-order'),
    'Download for [Supplier]’s basket': BASKET,
    'Download for [Supplier 2]’s basket': BASKET,
    // Today's lines
    'Book in': go('till-book-in'),
    'Open the diary': go('diary'),
  },
  // An unknown barcode still on the list: Book in asks first
  'rs-receive': { 'Book in [n] items': go('rs-book-blocked') },
  'rs-receive-staff': { 'Book in [n] items': go('rs-book-blocked'), 'Leave it for [Owner or manager]: barcode [barcode]': go('rs-receive-staff-left') },
  'rs-receive-staff-left': { 'Book in [n] items': go('rs-booked-staff'), 'Undo leaving barcode [barcode]': go('rs-receive-staff') },
  'rs-receive-c2w': { 'Book in [n] items': go('rs-booked-c2w'), 'Problem with [Bike]': go('rs-problem') },
  'rs-receive-marked': { 'Book in [n] items': go('rs-booked') },
  'rs-book-blocked': { 'Book in [n] items': STAY },
  // A box open over the list: the list behind stays put
  'rs-frame': { 'Book in [n] items': STAY },
  'rs-frame-dup': { 'Book in [n] items': STAY, 'Count this bike': STAY },
  'rs-frame-c2w': { 'Book in [n] items': STAY, 'Count this bike': go('rs-receive-c2w') },
  'rs-add-product': { 'Add and count 1': go('rs-receive'), 'Book in [n] items': STAY },
  'rs-add-left': { 'Add and count 1': go('rs-labels') },
  'rs-problem': { 'Mark as damaged': go('rs-receive-marked'), 'Book in [n] items': STAY },
  'rs-problem-missing': { 'Mark as missing': go('rs-receive-marked'), 'Book in [n] items': STAY },
  // Booked in
  'rs-booked-job-waiting': { 'Open job WH-1042': go('rs-part-missing') },
  'rs-booked-c2w': { 'Open Maya Patel’s Cycle to Work order': go('cw-order-get-ready') },
  'rs-labels': { 'Print [n] labels': outside('The label printer'), 'Change the label printer': notDrawn('Choosing the label printer (Settings › Stockroom)'), 'Print labels': STAY },
  // Orders
  'rs-order': { 'Mark as ordered': go('rs-order-ordered'), 'Save as draft': go('rs-hub'), 'Remove Shimano brake pads': STAY, 'Remove [Product]': STAY },
  'rs-order-ordered': { 'Close the order': go('rs-order-close'), 'Receive against this order': go('rs-receive') },
  'rs-order-close': { 'Close the order': go('rs-hub'), 'Keep it open': go('rs-order-ordered'), 'Receive against this order': STAY },
  // Today
  'rs-today-restock': { 'Open the restock list': go('rs-restock') },
  'rs-today-to-add': { 'Add this product': go('rs-add-left') },
  // The job's page and the workshop
  'rs-job-arrived': job({ 'Carry on with the work': go('job-mechanic') }),
  'rs-part-sold': job(),
  'rs-part-missing': job(),
  'rs-part-damaged': job(),
  'rs-part-order-closed': job(),
  'rs-overview-arrived': { 'Open job': go('rs-job-arrived') },
  'rs-diary-arrived': {
    'Showing Everyone. Change whose jobs are shown': STAY,
    // The arrived block opens its job, showing Part arrived (walk-through 3, step 3).
    'Trek Domane AL 3, Standard service, Maya Patel, WH-1042, Waiting for parts, part arrived, 16:00–17:30 · waiting for parts': go('rs-job-arrived'),
    'Trek Domane AL 3, Standard service, Maya Patel, WH-1042, Waiting for parts, part arrived, 16:00–17:30 · waiting for parts. Press and hold for more.': go('rs-job-arrived'),
  },
};
