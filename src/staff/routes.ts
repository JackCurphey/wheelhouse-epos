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
  reschedule: '/workshop/booking/:jobId/reschedule',
  cancel: '/workshop/booking/:jobId/cancel',
  expired: '/workshop/link-expired',
  preferences: '/workshop/preferences/:customerId',
  'service-status': '/workshop/service-status',
} as const;

export type ScreenId = keyof typeof ROUTES;
