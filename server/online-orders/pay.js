// Paying an online order (openspec/changes/website-buy-online, design 3, tasks
// 5.0d, 5.1–5.3 and 5.7; drawings on-confirmed, on-checkout-sold-out and
// on-checkout-declined). Checkout made the order at awaiting_payment with the
// card part held; Pay finishes it in one transaction: the card's answer, the
// collecting shop's stock checked and taken off, the store credit spent, one
// sale, the card part taken, the order's number (last, 5.0d) and Order
// confirmation queued. Nothing is taken when any of it fails: a failure after
// the take is let go or refunded once the transaction has rolled back.
import { dbExec, prepare } from '../db.js';
import { createSale } from '../lib/sales.js';
import { lockStock } from '../lib/stock.js';
import { creditOf, lockCustomer } from '../lib/customer-money.js';
import { payments, PaymentError } from '../payments/index.js';
import { ORDER_TENDER } from '../accounts/online-tenders.js';
import { nextOrderNumber, orderReference } from './numbers.js';
import { queueOrderMessage } from './messages.js';

export { ORDER_TENDER };
export const CREDIT_TENDER = 'Store credit';

// on-checkout-declined, word for word.
export const DECLINED = 'Your card was declined — nothing has been taken. Try another card, or Apple Pay or Google Pay.';
// on-checkout-sold-out, with the product and shop filled in.
const soldOutWords = (product, site) => `${product} has just sold out at ${site}. Nothing has been taken. Remove it from your order to carry on.`;
// Not drawn (decided while building, 14 Nov, paying).
export const CANT_PAY = 'This order can’t be paid now. Go back to your basket and try again.';
export const CREDIT_SHORT = 'Your store credit has changed since you checked out, so nothing has been taken. Go back to your basket and try again.';
export const NOT_FINISHED = 'Your payment couldn’t be finished, so nothing has been taken. Go back to your basket and try again.';
const FAILED_AFTER_TAKE = 'The order couldn’t be saved after the payment was taken';
const FAILED = 'The order couldn’t be saved';

const paidAnswer = (order) => ({
  ref: order.order_code,
  number: orderReference(order.number),
  totalPence: order.total_pence,
  creditPence: order.credit_pence,
  cardPence: order.card_pence,
  paid: true,
});

/**
 * POST /api/site/orders/:ref/pay: { card } for the card part, or nothing when
 * store credit covers it all (Place order). Answers { status, body }.
 * `pushes` collects Shopify stock pushes for the caller to fire after.
 */
export async function payOrder({ req, ref, body, pushes }) {
  const provider = payments();
  let payment = null;
  let cardHeld = false; // the provider holds (or has taken) the card part
  let took = false;
  await dbExec('BEGIN');
  try {
    const order = await prepare('SELECT * FROM online_orders WHERE order_code = ? FOR UPDATE').get(ref);
    if (!order) return await done('ROLLBACK', 404, { error: 'That order wasn’t found' });
    // Pay pressed again after it paid: the paid order, and nothing more taken.
    if (order.paid_at) return await done('ROLLBACK', 200, paidAnswer(order));
    if (order.stage !== 'awaiting_payment') return await done('ROLLBACK', 409, { error: CANT_PAY });

    if (order.card_pence > 0) {
      payment = await prepare("SELECT * FROM online_payments WHERE online_order_id = ? AND purpose = 'order' ORDER BY id DESC LIMIT 1 FOR UPDATE").get(order.id);
      if (!payment || !provider || payment.provider !== provider.name || payment.amount_pence !== order.card_pence) {
        return await done('ROLLBACK', 409, { error: CANT_PAY });
      }
      let state = await provider.status(payment.provider_ref);
      // The pretend card form; a real provider's form answers on its own side.
      if (provider.card && (state.status === 'waiting' || state.status === 'declined')) {
        try {
          await provider.card(payment.provider_ref, body?.card);
        } catch (err) {
          if (err instanceof PaymentError && err.code === 'bad_card') return await done('ROLLBACK', 400, { error: err.message });
          throw err;
        }
        state = await provider.status(payment.provider_ref);
      }
      if (state.status === 'declined') {
        await setPayment(payment.id, 'declined');
        return await done('COMMIT', 402, { error: DECLINED, code: 'card_declined' });
      }
      if (state.status !== 'held' || state.amountPence !== order.card_pence) return await done('ROLLBACK', 409, { error: CANT_PAY });
      cardHeld = true;
      await setPayment(payment.id, 'held');
    }

    // The collecting shop's own stock, not the business's (design 3).
    const lines = await prepare(
      'SELECT l.product_id, l.qty, l.unit_pence, p.name FROM online_order_lines l JOIN products p ON p.id = l.product_id WHERE l.order_id = ? ORDER BY l.id'
    ).all(order.id);
    await lockStock(lines.map((l) => l.product_id));
    const wanted = new Map();
    for (const l of lines) wanted.set(l.product_id, (wanted.get(l.product_id) ?? 0) + l.qty);
    const here = new Map((await prepare('SELECT product_id, qty FROM product_stock WHERE site_id = ? AND product_id = ANY(?::int[])')
      .all(order.site_id, [...wanted.keys()])).map((r) => [r.product_id, r.qty]));
    const short = lines.find((l) => (here.get(l.product_id) ?? 0) < wanted.get(l.product_id));
    if (short) {
      const site = (await prepare('SELECT name FROM sites WHERE id = ?').get(order.site_id))?.name ?? '';
      await letGoInTransaction(order, payment, provider, cardHeld);
      cardHeld = false;
      return await done('COMMIT', 409, { error: soldOutWords(short.name, site), soldOut: { productId: short.product_id, name: short.name, site } });
    }

    if (order.credit_pence > 0) {
      const customer = await lockCustomer(order.customer_id);
      if (!customer || (await creditOf(order.customer_id)) < order.credit_pence) {
        await letGoInTransaction(order, payment, provider, cardHeld);
        cardHeld = false;
        return await done('COMMIT', 409, { error: CREDIT_SHORT });
      }
      await prepare(
        "INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason, online_order_id) VALUES (?, ?, 'spent', 'Online order', ?) RETURNING id"
      ).get(order.customer_id, -order.credit_pence, order.id);
    }

    // Priced at checkout with no group discount, so none is added here (gap log).
    const saleId = await createSale({
      customerId: order.customer_id,
      cashierId: null,
      items: lines.map((l) => ({ productId: l.product_id, qty: l.qty, unitPrice: l.unit_pence / 100 })),
      discount: 0,
      cashAmount: 0,
      cardAmount: 0,
      cashTendered: null,
      payments: [{ tenderType: ORDER_TENDER, amount: order.card_pence / 100 }, { tenderType: CREDIT_TENDER, amount: order.credit_pence / 100 }],
      note: 'Online order',
      // The collecting shop's stock was checked above; moveStock's check is the business's.
      sellPastStock: true,
      movedBy: { siteId: order.site_id },
      noGroupDiscount: true,
    }, { deferShopifyPushesTo: pushes });

    if (cardHeld) {
      await provider.take(payment.provider_ref);
      took = true;
      await setPayment(payment.id, 'taken');
    }
    // The number last, with no provider call after it: its row lock holds the
    // shop's settings until the commit (5.0d).
    const number = await nextOrderNumber();
    const paid = await prepare(
      "UPDATE online_orders SET number = ?, paid_at = now(), stage = 'to_get_ready', sale_id = ?, updated_at = now() WHERE id = ? RETURNING *"
    ).get(number, saleId, order.id);
    await prepare('UPDATE sales SET note = ? WHERE id = ? RETURNING id').get(`Online order ${orderReference(number)}`, saleId);
    await queueOrderMessage(order.id, 'order_confirmation', { req });
    await dbExec('COMMIT');
    return { status: 200, body: paidAnswer(paid) };
  } catch (err) {
    await dbExec('ROLLBACK');
    // The sale rolled back, so its stock pushes mustn't go to Shopify.
    if (pushes) { pushes._pendingPushSettle?.(); pushes.length = 0; }
    console.error('an online order couldn’t be paid', err);
    await notPaid(ref);
    if (cardHeld) {
      await prepare('UPDATE online_payments SET refund_due_reason = ?, updated_at = now() WHERE id = ? AND refund_due_reason IS NULL RETURNING id')
        .get(took ? FAILED_AFTER_TAKE : FAILED, payment.id);
      await settleFailedTake(payment.id, provider).catch((e) => console.error(`order payment ${payment.id}: couldn’t be let go yet`, e));
    }
    return { status: 503, body: { error: NOT_FINISHED } };
  }
}

async function done(verb, status, body) {
  await dbExec(verb);
  return { status, body };
}

const setPayment = (id, status) => prepare('UPDATE online_payments SET status = ?, updated_at = now() WHERE id = ? RETURNING id').get(status, id);

const notPaid = (ref) => prepare("UPDATE online_orders SET stage = 'not_paid', updated_at = now() WHERE order_code = ? AND stage = 'awaiting_payment' RETURNING id").get(ref);

// Sold out or credit short: the hold let go and the order not paid, in the
// transaction, which then commits.
async function letGoInTransaction(order, payment, provider, cardHeld) {
  if (cardHeld) {
    await provider.release(payment.provider_ref);
    await setPayment(payment.id, 'released');
  }
  await prepare("UPDATE online_orders SET stage = 'not_paid', updated_at = now() WHERE id = ? RETURNING id").get(order.id);
}

/**
 * A payment whose order failed after the card was held or taken: taken is
 * refunded in full, held is let go, once (the row is locked, and the reason
 * cleared in the same transaction). As refundOwed does for deposits.
 */
export async function settleFailedTake(paymentId, provider = payments()) {
  await dbExec('BEGIN');
  try {
    const p = await prepare(
      "SELECT id, provider_ref, amount_pence FROM online_payments WHERE id = ? AND purpose = 'order' AND refund_due_reason IS NOT NULL FOR UPDATE"
    ).get(paymentId);
    if (!p || !provider) return await done('COMMIT');
    const { status } = await provider.status(p.provider_ref);
    let to = status;
    if (status === 'taken') {
      await provider.refund(p.provider_ref, p.amount_pence);
      to = 'refunded';
    } else if (status === 'waiting' || status === 'held') {
      await provider.release(p.provider_ref);
      to = 'released';
    }
    await prepare(
      `UPDATE online_payments SET status = ?, refund_reason = refund_due_reason, refund_due_reason = NULL, refunded_at = now(), updated_at = now()
        WHERE id = ? RETURNING id`
    ).get(to, p.id);
    await dbExec('COMMIT');
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}
