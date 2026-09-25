/**
 * Atlas screen id -> URL for the customer app, served at every /book address
 * (server/server.js). pending is also the private link the server issues
 * (server/booking-link.js linkPath), so a customer opening it cold lands here.
 *
 * Each journey plan adds its customer screens here and nowhere else. Keys must
 * be book-group ids in screen-index.json and paths must sit under /book
 * (tests/screens/customer-routes.test.js checks both).
 *
 * A .ts file, not .tsx: the tests load it straight into Node.
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */
export const CUSTOMER_ROUTES = {
  service: '/book/:shopSlug',
  'service-list': '/book/:shopSlug/services',
  problem: '/book/:shopSlug/problem',
  date: '/book/:shopSlug/date',
  details: '/book/:shopSlug/details',
  pending: '/book/:shopSlug/booking/:code',
} as const;

export type CustomerScreenId = keyof typeof CUSTOMER_ROUTES;
