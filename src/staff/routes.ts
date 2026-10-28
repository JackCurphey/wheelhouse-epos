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
  customers: '/workshop/customers',
  messages: '/workshop/messages',
  diary: '/workshop/diary',
  overview: '/workshop/overview',
  stock: '/workshop/stock',
  deliveries: '/workshop/deliveries',
  stocktake: '/workshop/stocktake',
  today: '/workshop/today',
  reports: '/workshop/reports',
  website: '/workshop/website',
  settings: '/workshop/settings',
  'your-settings': '/workshop/your-settings',
  // A customer's page (cs-page), from Customers and the header search.
  'cs-page': '/workshop/customers/:id',
  // A bike's own page (cs-bike), from a customer's page and the header search.
  'cs-bike': '/workshop/bikes/:id',
  // A product's page (st-product), from Stock (openspec/changes/stock-list).
  'st-product': '/workshop/stock/:id',
  // New order (rs-order) and an order (rs-order-ordered), from Deliveries and
  // orders (openspec/changes/deliveries-orders).
  'rs-order': '/workshop/deliveries/new-order',
  'rs-order-ordered': '/workshop/deliveries/orders/:id',
  // Receive a delivery (rs-receive), from the hub and an order; ?order=[id]
  // picks the order (openspec/changes/receive-delivery).
  'rs-receive': '/workshop/deliveries/receive',
  // Close the day (eod-count), from the till after closing time
  // (openspec/changes/close-the-day).
  'eod-count': '/workshop/till/close',
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
