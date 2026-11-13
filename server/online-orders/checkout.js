// Checkout (openspec/changes/website-buy-online, design 3; drawings
// on-checkout, on-checkout-errors, on-checkout-credit, on-checkout-covered):
// checks the details, prices and checks the basket again, works out store
// credit for a signed-in customer, and makes one order at awaiting_payment with
// one held card payment per request key. It never takes money, records a sale,
// moves stock or gives the order its number: all of that happens at payment
// (pull request 5). Runs inside the shop the website's address names.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prepare, dbExec } from '../db.js';
import { EMAIL_RE } from '../auth.js';
import { payments } from '../payments/index.js';
import { creditOf } from '../lib/customer-money.js';
import { readLines, collectingShop, priceBasket, EMPTY, CHOOSE_SHOP } from './basket.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
// A hold a retry can carry on with: not yet answered, or a card that can be tried again.
const REUSABLE = ['waiting', 'held', 'declined'];
const BOXES = {
  name: 'Enter your name',
  email: 'Check your email address — it needs an @ and a dot, like name@example.com',
};

/**
 * The request key's hash for an order. A key of its own kind: a booking's
 * deposit hashes the bare key (booking-request-key.js) into the same
 * online_payments column, so an order's hash is scoped, and the same key sent
 * to both can never make one answer for the other (PR 1 review; task 4.5a).
 */
export const orderKeyHash = (requestKey) => createHash('sha256').update(`online-order:${requestKey}`).digest('hex');

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const answer = (status, body) => ({ status, body });

// The details as checkout keeps them, and each box's message.
function checkDetails({ name, email, phone }) {
  const boxes = {};
  if (!name) boxes.name = BOXES.name;
  if (!(email.length <= 254 && EMAIL_RE.test(email))) boxes.email = BOXES.email;
  const n = Object.keys(boxes).length;
  if (n) return answer(400, { error: `Check the ${n} ${n === 1 ? 'box' : 'boxes'} marked below.`, code: 'check_details', count: n, boxes });
  // Past what any form sends (the order's own limits, migration 154): no box to mark.
  if (name.length > 60 || phone.length > 60) return answer(400, { error: 'Bad request' });
  return null;
}

// What the order is for, to tell a retry from the same key sent with something
// else: the shop and lines, and whose it is. A signed-in customer's by their
// customer, so an account edited between tries still finds its order; a
// guest's by what was typed.
const sameRequest = (order, lines, wanted) => order.site_id === wanted.siteId
  && (wanted.customerId
    ? order.customer_id === wanted.customerId
    : order.email === wanted.email && order.name === wanted.name && (order.phone ?? '') === wanted.phone)
  && JSON.stringify(lines) === JSON.stringify([...wanted.lines].sort((a, b) => a.productId - b.productId).map((l) => [l.productId, l.qty]));

/**
 * One checkout. `login` is the signed-in customer's login (from the
 * session, already checked to be this shop's), or null for a guest.
 * `allowed()` is the network's limit, asked only once the details pass, as a
 * deposit's hold asks it (routes/deposit-payments.js). Returns { status, body }.
 */
export async function checkout(body, login, { allowed = () => true } = {}) {
  if (typeof body.requestKey !== 'string' || !KEY_PATTERN.test(body.requestKey)) return answer(400, { error: 'Invalid request key' });
  const lines = readLines(body.lines);
  if (!lines) return answer(400, { error: 'Bad request' });
  if (lines.length === 0) return answer(400, { error: EMPTY, code: 'empty' });
  const where = await collectingShop(body.shop);
  if (!where) return answer(400, { error: CHOOSE_SHOP, code: 'choose_shop' });
  const keyHash = orderKeyHash(body.requestKey);
  const provider = payments();

  let made = null; // a hold made in this transaction, let go if it doesn't commit
  await dbExec('BEGIN');
  try {
    // Signed in: the sign-in's customer read again and held, as a booking
    // holds it, so a deletion or merge either finished first or waits.
    let me = null;
    if (login) {
      me = await prepare(
        `SELECT c.id, c.name, c.phone, l.email FROM customer_logins l JOIN customers c ON c.id = l.customer_id
          WHERE l.id = ? AND l.active = 1 AND c.active = 1 AND c.deleted_at IS NULL AND c.merged_into_id IS NULL
          FOR NO KEY UPDATE OF c`
      ).get(login.id);
      if (!me) {
        await dbExec('ROLLBACK');
        return answer(401, { error: 'Please sign in again.', code: 'signed_out' });
      }
    }
    // The account's details, and what's typed only where the account has none.
    const details = {
      name: text(me?.name) || text(body.name),
      email: (text(me?.email) || text(body.email)).toLowerCase(),
      phone: text(me?.phone) || text(body.phone),
    };
    const wanted = { ...details, customerId: me?.id ?? null, siteId: where.site.id, lines };
    const bad = checkDetails(details);
    if (bad || !allowed()) {
      await dbExec('ROLLBACK');
      return bad ?? answer(429, { error: 'Too many tries from this network - please try again later.' });
    }

    // Sent before: the same order (design 3: "Pay pressed twice gives the same order").
    let order = await prepare('SELECT * FROM online_orders WHERE request_key_hash = ? FOR UPDATE').get(keyHash);
    if (!order) {
      const basket = await priceBasket(lines, where.site, where.sites);
      if (!basket.canCheckout) {
        await dbExec('ROLLBACK');
        return answer(409, { error: basket.changed ?? EMPTY, code: 'basket_changed', basket });
      }
      // Store credit, for a signed-in customer, when the shop takes it at all
      // and online, unless they unticked it. Only spent once the order is paid.
      let creditPence = 0;
      if (me && body.useCredit !== false) {
        const allowed = await prepare(
          `SELECT (SELECT store_credit_on FROM online_order_settings) AS online, (SELECT store_credit_on FROM payment_settings) AS shop`
        ).get();
        if (allowed.online && allowed.shop) creditPence = Math.max(0, Math.min(basket.totalPence, await creditOf(me.id)));
      }
      // The order first, with no customer: of two tries at once only one makes
      // it, and only that one makes a guest's customer.
      order = await prepare(
        `INSERT INTO online_orders (site_id, name, email, phone, total_pence, credit_pence, card_pence, order_code, request_key_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shop_id, request_key_hash) DO NOTHING RETURNING *`
      ).get(where.site.id, details.name, details.email, details.phone || null, basket.totalPence, creditPence,
        basket.totalPence - creditPence, randomBytes(32).toString('hex'), keyHash);
      if (order) {
        // A guest gets a new customer of their own, never one matched on what
        // was typed (resolveGuestCustomer); the email is one they gave, so a
        // code sign-in with it can join them (design, decided while planning 10).
        const customerId = me?.id ?? (await prepare(
          'INSERT INTO customers (name, phone, email, email_from_customer, updated_at) VALUES (?, ?, ?, true, now()) RETURNING id'
        ).get(details.name, details.phone || null, details.email)).id;
        order = await prepare('UPDATE online_orders SET customer_id = ? WHERE id = ? RETURNING *').get(customerId, order.id);
        for (const l of basket.lines) {
          await prepare('INSERT INTO online_order_lines (order_id, product_id, qty, unit_pence) VALUES (?, ?, ?, ?) RETURNING id')
            .get(order.id, l.productId, l.qty, l.unitPence);
        }
      } else {
        order = await prepare('SELECT * FROM online_orders WHERE request_key_hash = ? FOR UPDATE').get(keyHash);
      }
    }
    const ordered = (await prepare('SELECT product_id, qty FROM online_order_lines WHERE order_id = ? ORDER BY product_id').all(order.id))
      .map((l) => [l.product_id, l.qty]);
    if (!sameRequest(order, ordered, wanted)) {
      await dbExec('ROLLBACK');
      return answer(409, { error: 'This order was already sent with different details', code: 'reused_key' });
    }

    // The card part, held once per key (as a deposit's hold): made again only
    // when the last one has gone (let go), never two at once.
    let payment = null;
    if (order.card_pence > 0 && order.stage === 'awaiting_payment') {
      await prepare(
        `INSERT INTO online_payments (provider, provider_ref, amount_pence, request_key_hash, purpose, online_order_id)
         VALUES (?, '', ?, ?, 'order', ?) ON CONFLICT (shop_id, request_key_hash) DO NOTHING RETURNING id`
      ).get(provider.name, order.card_pence, keyHash, order.id);
      const row = await prepare("SELECT * FROM online_payments WHERE request_key_hash = ? AND purpose = 'order' AND online_order_id = ? FOR UPDATE").get(keyHash, order.id);
      let ref = row.provider_ref;
      // A new hold only when there's none yet, or the last was let go, or an
      // open one is for another amount (let go first, as a deposit's is).
      // One the provider is checking, can't answer for, has taken or refunded
      // is left exactly as it is: its reference is never overwritten.
      const open = REUSABLE.includes(row.status);
      if (!ref || row.status === 'released' || (open && row.amount_pence !== order.card_pence)) {
        if (ref && open && row.status !== 'declined') await provider.release(ref);
        ({ ref } = await provider.hold({ amountPence: order.card_pence, key: `${keyHash}:${randomUUID()}` }));
        made = ref;
        await prepare("UPDATE online_payments SET provider = ?, provider_ref = ?, amount_pence = ?, status = 'waiting', updated_at = now() WHERE id = ? RETURNING id")
          .get(provider.name, ref, order.card_pence, row.id);
      }
      payment = { paymentId: row.id, provider: provider.name, ref, amountPence: order.card_pence };
    }
    await dbExec('COMMIT');
    made = null;
    const orderLines = await prepare('SELECT product_id, qty, unit_pence FROM online_order_lines WHERE order_id = ? ORDER BY id').all(order.id);
    return answer(200, {
      orderCode: order.order_code,
      stage: order.stage,
      totalPence: order.total_pence,
      creditPence: order.credit_pence,
      cardPence: order.card_pence,
      coversAll: order.card_pence === 0,
      lines: orderLines.map((l) => ({ productId: l.product_id, qty: l.qty, unitPence: l.unit_pence })),
      payment,
    });
  } catch (err) {
    await dbExec('ROLLBACK');
    if (made) await provider.release(made).catch((e) => console.error('order hold not recorded, and couldn’t be let go', e));
    throw err;
  }
}
