// A trip to an outside page and back (the payment provider's, Shopify's):
// single use, for the shop and Owner who started it, for 30 minutes. Held in
// memory, so a restart means pressing Connect again (logged in
// decided-while-building). Shared by server/routes/online-payments.js and
// server/routes/shopify-link.js.
import { randomBytes } from 'node:crypto';

const trips = new Map();
const TRIP_MS = 30 * 60 * 1000;

export function startTrip(trip) {
  const now = Date.now();
  for (const [key, t] of trips) if (t.expires < now) trips.delete(key);
  const state = randomBytes(24).toString('hex');
  trips.set(state, { ...trip, expires: now + TRIP_MS });
  return state;
}

/** The trip, without ending it: for a pretend page to show. */
export function peekTrip(state) {
  const trip = typeof state === 'string' ? trips.get(state) : null;
  return trip && trip.expires >= Date.now() ? trip : null;
}

export function endTrip(state, shopId, kind) {
  const trip = peekTrip(state);
  if (!trip || trip.shopId !== shopId || trip.kind !== kind) return null;
  trips.delete(state);
  return trip;
}

export function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

export function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}
