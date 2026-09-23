/**
 * Atlas screen id -> URL. One table, because five edge screens are entered
 * from outside the app entirely - an emailed link or a stale bookmark - and a
 * router that only knows in-flow navigation cannot serve them.
 * screen-index.json records no inbound branch for reschedule (44), cancel
 * (46), expired (50), preferences (62) or service-status (63).
 *
 * Each journey plan adds its screens here and nowhere else; nothing else in
 * the app writes a URL string. Keys must be screen-index.json ids and paths
 * must sit under /workshop (tests/screens/routes.test.js checks both).
 *
 * A .ts file, not .tsx: the tests load it straight into Node, which strips
 * types but cannot parse JSX.
 */
export const ROUTES = {
  desk: '/workshop',
  reschedule: '/workshop/booking/:jobId/reschedule',
  cancel: '/workshop/booking/:jobId/cancel',
  expired: '/workshop/link-expired',
  preferences: '/workshop/preferences/:customerId',
  'service-status': '/workshop/service-status',
} as const;

export type ScreenId = keyof typeof ROUTES;
