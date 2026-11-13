// The website's checkout (openspec/changes/website-buy-online, design 2 and 3;
// drawings on-checkout, on-checkout-errors, on-checkout-credit,
// on-checkout-credit-all). It checks the details, prices the basket and checks
// its stock again, and works out the store credit used. Making the order and
// its held payment (task 4.5) waits for paying to be built (tasks 5.0b–e and
// Jack's answer 9), so a checkout that passes every check stops there and
// makes nothing.
import { EMAIL_RE } from '../auth.js';
import { readRequestKey } from '../booking-request-key.js';
import { BasketError, CHANGED, NOT_TAKING, basketAnswer, linesFrom } from './basket.js';

export const EMAIL_BAD = 'Check your email address — it needs an @ and a dot, like name@example.com';
const LONGEST = 200;

export class CheckoutRefused extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// Each box's message, as on-checkout-errors draws them. A signed-in customer's
// details come from their account; a detail the account hasn't got is taken
// from what was typed.
function detailsFrom(body, customer) {
  const details = {
    name: customer?.name || text(body.name),
    phone: customer?.phone || text(body.phone),
    email: customer?.email || text(body.email),
  };
  const fields = {};
  if (!details.name) fields.name = 'Enter your name';
  else if (details.name.length > LONGEST) fields.name = 'That name is too long';
  if (!details.phone) fields.phone = 'Enter your phone number';
  else if (details.phone.length > LONGEST) fields.phone = 'That phone number is too long';
  if (!EMAIL_RE.test(details.email) || details.email.length > LONGEST) fields.email = EMAIL_BAD;
  const n = Object.keys(fields).length;
  if (n) throw new CheckoutRefused(400, { error: n === 1 ? 'Check the box marked below.' : `Check the ${n} boxes marked below.`, fields });
  return details;
}

/** POST /api/site/checkout: { shop, lines, name, phone, email, useCredit, requestKey }. */
export async function checkout({ req, res, shop, body }) {
  const key = readRequestKey(body);
  if (key.error || !key.value) throw new BasketError('That checkout can’t be read — refresh the page and try again');
  const lines = linesFrom(body.lines);
  if (!lines.length) throw new BasketError('Your basket is empty');
  const { answer: basket, customer } = await basketAnswer({ req, res, shop, lines, shopId: body.shop });
  if (!basket.taking) throw new CheckoutRefused(409, { error: NOT_TAKING });
  // "Pay SHALL check the details first" (spec, Checkout).
  detailsFrom(body, customer);
  if (!basket.shop) throw new BasketError('Choose which shop to collect from');
  // What the customer saw is what they pay for: any line changed sends the basket back.
  if (basket.changed) throw new CheckoutRefused(409, { error: CHANGED, basket });
  const creditPence = body.useCredit === true && basket.credit ? basket.credit.usePence : 0;
  throw new CheckoutRefused(501, {
    error: 'Paying online isn’t ready yet',
    code: 'paying_not_built',
    totalPence: basket.totalPence,
    creditPence,
    leftToPayPence: basket.totalPence - creditPence,
  });
}
