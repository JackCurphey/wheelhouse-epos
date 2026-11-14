// The website's checkout (openspec/changes/website-buy-online, design 2 and 3;
// drawings on-checkout, on-checkout-errors, on-checkout-credit,
// on-checkout-credit-all). It checks the details, prices the basket and checks
// its stock again, works out the store credit used, and makes the order at
// awaiting_payment with its lines and, for the card part, its held payment
// (task 4.5). Paying it is server/online-orders/pay.js.
import { randomBytes, randomUUID } from 'node:crypto';
import { EMAIL_RE } from '../auth.js';
import { readRequestKey } from '../booking-request-key.js';
import { resolveGuestCustomer } from '../customer-auth.js';
import { dbExec, prepare } from '../db.js';
import { payments } from '../payments/index.js';
import { BasketError, CHANGED, NOT_TAKING, basketAnswer, linesFrom } from './basket.js';

export const EMAIL_BAD = 'Check your email address — it needs an @ and a dot, like name@example.com';
// What an order keeps (migration 154): a name and phone of 60, an email of 254.
const LONGEST = { name: 60, phone: 60, email: 254 };

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
  else if (details.name.length > LONGEST.name) fields.name = 'That name is too long';
  if (!details.phone) fields.phone = 'Enter your phone number';
  else if (details.phone.length > LONGEST.phone) fields.phone = 'That phone number is too long';
  if (!EMAIL_RE.test(details.email) || details.email.length > LONGEST.email) fields.email = EMAIL_BAD;
  const n = Object.keys(fields).length;
  if (n) throw new CheckoutRefused(400, { error: n === 1 ? 'Check the box marked below.' : `Check the ${n} boxes marked below.`, fields });
  return details;
}

/**
 * POST /api/site/checkout: { shop, lines, name, phone, email, useCredit, requestKey }.
 * Answers { ref, totalPence, creditPence, cardPence, payment: { provider, ref } | null }.
 */
export async function checkout({ req, res, shop, body }) {
  const key = readRequestKey(body);
  if (key.error || !key.value) throw new BasketError('That checkout can’t be read — refresh the page and try again');
  const lines = linesFrom(body.lines);
  if (!lines.length) throw new BasketError('Your basket is empty');
  const { answer: basket, customer } = await basketAnswer({ req, res, shop, lines, shopId: body.shop });
  if (!basket.taking) throw new CheckoutRefused(409, { error: NOT_TAKING });
  // "Pay SHALL check the details first" (spec, Checkout).
  const details = detailsFrom(body, customer);
  if (!basket.shop) throw new BasketError('Choose which shop to collect from');
  // What the customer saw is what they pay for: any line changed sends the basket back.
  if (basket.changed) throw new CheckoutRefused(409, { error: CHANGED, basket });
  const creditPence = body.useCredit === true && basket.credit ? basket.credit.usePence : 0;
  const cardPence = basket.totalPence - creditPence;
  const provider = payments();
  if (cardPence > 0 && !provider) throw new CheckoutRefused(409, { error: NOT_TAKING });
  return makeOrder({ keyHash: key.value.keyHash, basket, customer, details, creditPence, cardPence, provider });
}

const answerFor = (order, payment) => ({
  ref: order.order_code,
  totalPence: order.total_pence,
  creditPence: order.credit_pence,
  cardPence: order.card_pence,
  payment: payment ? { provider: payment.provider, ref: payment.provider_ref } : null,
});

// One order per Pay (design 3): the order, its lines, a guest's own customer
// and the card part's hold, in one transaction. Pay pressed again with the
// same key gets the order the first press made, as it stands.
async function makeOrder({ keyHash, basket, customer, details, creditPence, cardPence, provider }) {
  let made = null; // a hold made in this transaction, let go if it doesn't commit
  await dbExec('BEGIN');
  try {
    const order = await prepare(
      `INSERT INTO online_orders (site_id, customer_id, name, email, phone, total_pence, credit_pence, card_pence, order_code, request_key_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shop_id, request_key_hash) DO NOTHING RETURNING *`
    ).get(basket.shop.id, customer?.id ?? null, details.name, details.email, details.phone, basket.totalPence, creditPence, cardPence,
      randomBytes(32).toString('hex'), keyHash);
    if (!order) {
      await dbExec('ROLLBACK');
      const was = await prepare('SELECT * FROM online_orders WHERE request_key_hash = ?').get(keyHash);
      const payment = await prepare("SELECT * FROM online_payments WHERE online_order_id = ? AND purpose = 'order' ORDER BY id DESC LIMIT 1").get(was.id);
      return answerFor(was, payment);
    }
    // A guest gets a customer of their own, never matched on what was typed.
    if (!customer) {
      const guest = await resolveGuestCustomer({ name: details.name, phone: details.phone });
      await prepare('UPDATE online_orders SET customer_id = ? WHERE id = ? RETURNING id').get(guest.id, order.id);
    }
    for (const line of basket.lines) {
      await prepare('INSERT INTO online_order_lines (order_id, product_id, qty, unit_pence) VALUES (?, ?, ?, ?) RETURNING id')
        .get(order.id, line.productId, line.qty, line.pricePence);
    }
    let payment = null;
    if (cardPence > 0) {
      const { ref } = await provider.hold({ amountPence: cardPence, key: `${keyHash}:${randomUUID()}` });
      made = ref;
      payment = await prepare(
        `INSERT INTO online_payments (provider, provider_ref, amount_pence, request_key_hash, purpose, online_order_id)
         VALUES (?, ?, ?, ?, 'order', ?) RETURNING *`
      ).get(provider.name, ref, cardPence, keyHash, order.id);
    }
    await dbExec('COMMIT');
    made = null;
    return answerFor(order, payment);
  } catch (err) {
    await dbExec('ROLLBACK');
    if (made) await provider.release(made).catch((e) => console.error('order hold not recorded, and couldn’t be let go', e));
    throw err;
  }
}
