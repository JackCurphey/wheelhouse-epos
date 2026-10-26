// WP-0.4: the online booking pages' customer accounts and the routes they read
// live in server/routes/portal.js, Mark's file (split plan §4.1), with the
// customer cookie helpers and the sign-in limiters only they use. Bookings,
// booking links and the portal quote routes followed, with their helpers and
// limiters. The booking link's quote answer followed last (24 Oct, Jack taking
// WP-0.4 over), so server.js registers no route of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'server/routes/portal.js';

const ROUTES = [
  "'POST', '/api/portal/:shopSlug/signup'", "'POST', '/api/portal/:shopSlug/login'",
  "'POST', '/api/portal/:shopSlug/logout'", "'GET', '/api/portal/:shopSlug/me'",
  "'GET', '/api/portal/:shopSlug/mechanics'", "'GET', '/api/portal/:shopSlug/services'",
  "'GET', '/api/portal/:shopSlug/terms'", "'GET', '/api/portal/:shopSlug/availability'",
  "'GET', '/api/portal/:shopSlug/bikes'", "'POST', '/api/portal/:shopSlug/bikes'",
  "'GET', '/api/portal/:shopSlug/bookings'", "'POST', '/api/portal/:shopSlug/bookings'",
  "'GET', '/api/portal/:shopSlug/booking-links/:code'", "'GET', '/api/portal/:shopSlug/booking-links/:code/quote'",
  "'POST', '/api/portal/:shopSlug/booking-links/:code/cancel'", "'POST', '/api/portal/:shopSlug/booking-links/:code/change'",
  "'POST', '/api/portal/:shopSlug/booking-links/:code/withdraw-change'",
  "'GET', '/api/portal/:shopSlug/quotes/:id'", "'POST', '/api/portal/:shopSlug/quotes/:id/lines/:lineId/decision'",
  "'POST', '/api/portal/:shopSlug/quotes/:id/approve'", "'POST', '/api/portal/:shopSlug/booking-links/:code/quote/answer'",
];
// setCustomerSessionCookie moved to server/lib/session.js on 26 Oct, shared
// by sign-in and the 30 days from the last visit (ask-the-shop-server design 6).
const HELPERS = [
  'clearCustomerSessionCookie', 'portalLoginLimiter', 'portalSignupLimiter',
  'portalGuestBookingLimiter', 'bookingLinkLimiter', 'CUSTOMER_ACTIONABLE', 'customerTooLate', 'customerCanAct',
  'serializePortalBooking', 'CUSTOMER_REFUSALS', 'customerActionRefusal', 'bookedServices', 'answerNoteLine',
  'bookingNotes', 'checkCustomerTime', 'REUSED_KEY', 'replayBookingRequest', 'resolveBookingLink',
  'bookingLinkView', 'changeBookingTime', 'withdrawRequest',
];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/routes/portal.js registers the customer account and read routes', () => {
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  const portal = read(FILE);
  assert.deepEqual(ROUTES.filter((r) => !portal.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => !defines(portal, name)), []);
  assert.ok(defines(read('server/lib/session.js'), 'setCustomerSessionCookie'), 'the customer cookie is set in one place');
});

test('server/server.js keeps none of them', () => {
  const server = read('server/server.js');
  assert.deepEqual(ROUTES.filter((r) => server.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => defines(server, name)), []);
});

test('the portal routes are registered, and import nothing from server.js', () => {
  assert.match(read('server/routes/index.js'), /import \* as portal from '\.\/portal\.js'/);
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(read(FILE)), 'portal.js imports ../server.js');
});

test('server.js registers no route of its own: every one is in server/routes/ (WP-0.4)', () => {
  const calls = read('server/server.js').match(/^\s*route\(/gm) ?? [];
  assert.deepEqual(calls, []);
});
