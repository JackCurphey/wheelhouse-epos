/**
 * Screen design id -> URL. One table, because five edge screens are entered
 * from outside the app entirely - an emailed link or a stale bookmark - and a
 * router that only knows in-flow navigation cannot serve them.
 * screen-index.json records no inbound branch for reschedule (44), cancel
 * (46), expired (50), preferences (62) or service-status (63).
 *
 * Each journey plan adds its screens here and nowhere else; nothing else in
 * the app writes a URL string. Keys must be screen-index.json ids or rooms
 * sidebar pages, and paths must sit under /workshop
 * (tests/screens/routes.test.js checks both).
 *
 * A .ts file, not .tsx: the tests load it straight into Node, which strips
 * types but cannot parse JSX.
 */
export const ROUTES = {
  // /workshop on its own sends each person to their own first page (decision A11).
  desk: '/workshop',
  // The rooms sidebar (src/staff/nav.ts) and Your settings, behind its footer.
  till: '/workshop/till',
  orders: '/workshop/orders',
  c2w: '/workshop/c2w',
  // A Cycle to Work order (cw-order-held) and its quote (cw-quote), from the list
  // (openspec/changes/cycle-to-work group 4).
  'cw-order-held': '/workshop/c2w/:id',
  'cw-quote': '/workshop/c2w/:id/quote',
  // What Cycle to Work providers owe (cw-owed), one provider's bikes owed (cw-owed-provider),
  // and the same list opened from Reports (cw-owed-reports); task 8's owed screens.
  'cw-owed': '/workshop/c2w/owed',
  'cw-owed-provider': '/workshop/c2w/owed/:id',
  'cw-owed-reports': '/workshop/reports/c2w-owed',
  customers: '/workshop/customers',
  messages: '/workshop/messages',
  diary: '/workshop/diary',
  overview: '/workshop/overview',
  stock: '/workshop/stock',
  deliveries: '/workshop/deliveries',
  stocktake: '/workshop/stocktake',
  today: '/workshop/today',
  // Moving from Citrus Lime (mv-start), the Owner's, after Today.
  moving: '/workshop/moving',
  reports: '/workshop/reports',
  // The Sales report (rp-sales), from the Reports page and its strip
  // (openspec/changes/reports-sales-and-takings); ?period= and from/to pick the period.
  'rp-sales': '/workshop/reports/sales',
  // Takings and cash-ups (rp-takings); ?day=[close id] opens that closed day's report (rp-day).
  'rp-takings': '/workshop/reports/takings',
  // Workshop (rp-workshop): jobs, workshop takings, quotes and how full each mechanic was.
  'rp-workshop': '/workshop/reports/workshop',
  // Margin and stock value (rp-margin): its stock half first, margin with part 2's PR 5.
  'rp-margin': '/workshop/reports/margin',
  // Returning customers (rp-returning): new and returning customers by month, and who hasn't been in lately.
  'rp-returning': '/workshop/reports/returning',
  // VAT (rp-vat): sales by VAT rate for the shop's VAT quarter; asks for the quarter the first time (rp-vat-first).
  'rp-vat': '/workshop/reports/vat',
  // Cycle to Work: owed and paid (rp-c2w): by provider, what's owed, paid and kept as commission (cycle-to-work task 10.3).
  'rp-c2w': '/workshop/reports/c2w',
  // A changed report (rp-changed), from "Change what's shown" on Sales or Takings and cash-ups
  // (openspec/changes/reports-your-own); its choices and period are in the address.
  'rp-changed': '/workshop/reports/changed',
  website: '/workshop/website',
  settings: '/workshop/settings',
  'your-settings': '/workshop/your-settings',
  // A customer's page (cs-page), from Customers and the header search.
  'cs-page': '/workshop/customers/:id',
  // The shop's privacy requests (cs-privacy), from "Privacy requests · [n]
  // open" on Customers (openspec/changes/delete-account).
  'cs-privacy': '/workshop/customers/privacy',
  // A bike's own page (cs-bike), from a customer's page and the header search.
  'cs-bike': '/workshop/bikes/:id',
  // A product's page (st-product), from Stock (openspec/changes/stock-list).
  'st-product': '/workshop/stock/:id',
  // A product with sizes' page (st-product-sizes), from its Stock row
  // (openspec/changes/product-page-sizes).
  'st-product-sizes': '/workshop/stock/sizes/:id',
  // New order (rs-order) and an order (rs-order-ordered), from Deliveries and
  // orders (openspec/changes/deliveries-orders).
  'rs-order': '/workshop/deliveries/new-order',
  'rs-order-ordered': '/workshop/deliveries/orders/:id',
  // The restock list (rs-restock), from Deliveries and orders and Today; ?show=low, fast or
  // customers picks the pill (openspec/changes/restock-list).
  'rs-restock': '/workshop/deliveries/restock',
  // Receive a delivery (rs-receive), from the hub and an order; ?order=[id]
  // picks the order (openspec/changes/receive-delivery).
  'rs-receive': '/workshop/deliveries/receive',
  // A booked-in delivery (rs-delivery), from Recent deliveries; Delivery booked
  // in (rs-booked), where Book in lands (openspec/changes/delivery-booked-in).
  'rs-delivery': '/workshop/deliveries/delivery/:id',
  'rs-booked': '/workshop/deliveries/delivery/:id/booked',
  // Close the day (eod-count), from the till after closing time
  // (openspec/changes/close-the-day).
  'eod-count': '/workshop/till/close',
  // Set up this till (till-setup), from Settings › Till › Tills; outside the
  // staff frame, as drawn (openspec/changes/till-setup).
  'till-setup': '/workshop/till/setup',
  // Counting in a stock take (tk-count), from Stock take's Join and Start the
  // count (openspec/changes/stock-take).
  'tk-count': '/workshop/stocktake/:id',
  // Check the count (tk-diff) and Count applied (tk-applied), from Stock
  // take's Check it and a finished count's Open.
  'tk-diff': '/workshop/stocktake/:id/check',
  'tk-applied': '/workshop/stocktake/:id/applied',
  // "You've signed out" (auth-signedout), where Sign out and WorkOS's sign-out
  // end (staff-signin-workos-screens design 5). StaffLayout draws it while
  // signed out; signed in, it goes on to /workshop.
  'auth-signedout': '/workshop/signed-out',
  // "Sign in to Wheelhouse" (staff-signin), staff-signin-google.
  'staff-signin': '/workshop/sign-in',
  reschedule: '/workshop/booking/:jobId/reschedule',
  cancel: '/workshop/booking/:jobId/cancel',
  expired: '/workshop/link-expired',
  preferences: '/workshop/preferences/:customerId',
  'service-status': '/workshop/service-status',
} as const;

export type ScreenId = keyof typeof ROUTES;
