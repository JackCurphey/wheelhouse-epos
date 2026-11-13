// Buying online's routes on the shop's website (openspec/changes/website-buy-online,
// design 2 and 3): POST /api/site/basket and POST /api/site/checkout, answered
// through routes/site.js like the website's other routes. server.js limits the
// visitor (the website's 300 a minute), reads the body and looks up the
// signed-in customer before runWithShop, and finds the shop from the address.
import { readJsonBody, sendJson, makeRateLimiter, badRequest } from '../lib/http.js';
import { clientIp } from '../proxy-trust.js';
import { currentCustomerSession } from '../lib/session.js';
import { takingOrders, readLines, collectingShop, priceBasket, NOT_TAKING, CHOOSE_SHOP } from '../online-orders/basket.js';
import { checkout } from '../online-orders/checkout.js';

// A checkout makes an order and a hold, so beside the website's limit it has a
// booking deposit's (30 an hour per address), counted as a deposit's is: only
// tries whose details pass (routes/deposit-payments.js), so a customer's
// typing mistakes don't use it up.
const checkoutLimiter = makeRateLimiter(30, 60 * 60 * 1000);

// The body as sent: an object, or null after answering it isn't one.
async function readBody(req, res) {
  let body;
  try {
    body = (await readJsonBody(req)) ?? {};
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    badRequest(res, 'Invalid request body');
    return null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    badRequest(res);
    return null;
  }
  return body;
}

// screens: on-basket, on-basket-changed, on-basket-empty
async function basketAnswer(req, res) {
  const body = await readBody(req, res);
  if (!body) return;
  if (!(await takingOrders())) return sendJson(res, 200, { takingOrders: false, message: NOT_TAKING });
  const lines = readLines(body.lines);
  if (!lines) return badRequest(res);
  const where = await collectingShop(body.shop);
  if (!where) return sendJson(res, 400, { error: CHOOSE_SHOP, code: 'choose_shop' });
  sendJson(res, 200, await priceBasket(lines, where.site, where.sites));
}

// screens: on-checkout, on-checkout-errors, on-checkout-credit, on-checkout-covered
async function checkoutAnswer(req, res, shop) {
  const body = await readBody(req, res);
  if (!body) return;
  if (!(await takingOrders())) return sendJson(res, 409, { error: NOT_TAKING, code: 'not_taking_orders' });
  // The signed-in customer, only when the sign-in is this shop's.
  const ctx = await currentCustomerSession(req, res);
  const login = ctx && ctx.shop.id === shop.id ? ctx.login : null;
  const { status, body: answer } = await checkout(body, login, { allowed: () => checkoutLimiter.check(clientIp(req)) });
  sendJson(res, status, answer);
}

/** The website's POST routes for buying online, by path: (req, res, shop) => answered. */
export const SITE_ORDER_POSTS = {
  '/api/site/basket': basketAnswer,
  '/api/site/checkout': checkoutAnswer,
};
