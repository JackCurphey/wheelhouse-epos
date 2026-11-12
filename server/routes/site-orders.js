// Buying online's public routes on the shop's website (openspec/changes/website-buy-online,
// design 2 and 3): POST /api/site/basket and POST /api/site/checkout. Like the
// website's other routes, the shop comes from the address: server.js finds it
// with resolveStorefrontShop, reads the body first, and calls
// handleSiteOrderRequest inside runWithShop. Not in ROUTE_AREAS: they are
// public, never found from a staff session. When WP-6.2's /api/site router
// (server/routes/site.js) is in, these join its POST routes.
import { readJsonBody, sendJson, makeRateLimiter, badRequest } from '../lib/http.js';
import { clientIp } from '../proxy-trust.js';
import { currentCustomerSession } from '../lib/session.js';
import { takingOrders, readLines, collectingShop, priceBasket, NOT_TAKING, CHOOSE_SHOP } from '../online-orders/basket.js';
import { checkout } from '../online-orders/checkout.js';

const BASKET = '/api/site/basket';
const CHECKOUT = '/api/site/checkout';

// Per visitor address, before any database work. The basket is asked for as a
// page opens, so it has WP-6.2's website limit (300 a minute); a checkout
// makes an order and a hold, so it has a booking deposit's (30 an hour,
// routes/deposit-payments.js).
const limiters = {
  [BASKET]: makeRateLimiter(300, 60 * 1000),
  [CHECKOUT]: makeRateLimiter(30, 60 * 60 * 1000),
};

/** The website path asked for, /store/<slug> taken off; null when it isn't one of these. */
export function siteOrderPath(req, pathname, slug) {
  const prefix = `/store/${slug}`;
  const path = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
  return req.method === 'POST' && Object.hasOwn(limiters, path) ? path : null;
}

/** Turns a visitor away past the limit; true when it answered. */
export function siteOrderLimited(req, res, path) {
  if (limiters[path].check(clientIp(req))) return false;
  sendJson(res, 429, { error: 'Too many tries from this network - please try again later.' });
  return true;
}

/** Answers a basket or checkout for the shop whose website this is. */
export async function handleSiteOrderRequest(req, res, path, shop) {
  // An answer about this visitor's basket: never kept by anything in between.
  res.setHeader('Cache-Control', 'no-store');
  let body;
  try {
    body = (await readJsonBody(req)) ?? {};
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return badRequest(res, 'Invalid request body');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res);

  if (path === BASKET) {
    // screens: on-basket, on-basket-changed, on-basket-empty
    if (!(await takingOrders())) return sendJson(res, 200, { takingOrders: false, message: NOT_TAKING });
    const lines = readLines(body.lines);
    if (!lines) return badRequest(res);
    const where = await collectingShop(body.shop);
    if (!where) return sendJson(res, 400, { error: CHOOSE_SHOP, code: 'choose_shop' });
    return sendJson(res, 200, await priceBasket(lines, where.site, where.sites));
  }

  // screens: on-checkout, on-checkout-errors, on-checkout-credit, on-checkout-covered
  if (!(await takingOrders())) return sendJson(res, 409, { error: NOT_TAKING, code: 'not_taking_orders' });
  // The signed-in customer, only when the sign-in is this shop's.
  const ctx = await currentCustomerSession(req, res);
  const login = ctx && ctx.shop.id === shop.id ? ctx.login : null;
  const { status, body: answer } = await checkout(body, login);
  sendJson(res, status, answer);
}
