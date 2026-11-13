// The provider's money (openspec/changes/cycle-to-work, design 6 and 7; tasks
// 8.1–8.4; drawings cw-mark-paid, cw-mark-paid-diff, cw-record-payment,
// cw-record-payment-more, cw-owed, cw-owed-provider in c2w.mjs). Runs inside the
// staff route's transaction and the shop's row-level security.
//
// A payment is a row in c2w_payments, linked to each order it covers with the
// amount put on that order. What an order is still owed is what the provider is
// expected to pay less what it has paid. A difference is never hidden: a payment
// for a different amount than is owed is refused with the difference until
// someone says what to do with it (part paid, close with a reason, or paid with
// the extra noted).
import { prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { Refused, WRONG_STAGE, takeStep } from './orders.js';

const NOT_FOUND = { error: 'Not found' };
const NOT_OWED = { error: 'Some of the ticked bikes aren’t owed by this provider any more. Refresh to see what’s owed now.', code: 'not_owed' };
const LOCK = 'SELECT id, stage, provider_id, expected_pence, paid_pence, provider_reference, collected_at, expected_by FROM c2w_orders';

export const owedOf = (r) => Math.max(0, (r.expected_pence ?? 0) - (r.paid_pence ?? 0));
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
export const lateDaysOf = (expectedBy, today) => (expectedBy && expectedBy < today ? daysBetween(expectedBy, today) : null);

async function newPayment(providerId, { amountPence, receivedOn, reference }) {
  return (await prepare('INSERT INTO c2w_payments (provider_id, amount_pence, received_on, reference) VALUES (?, ?, ?, ?) RETURNING id')
    .get(providerId, amountPence, receivedOn, reference)).id;
}
const linkPayment = (paymentId, orderId, put) => prepare('INSERT INTO c2w_payment_orders (payment_id, order_id, amount_pence) VALUES (?, ?, ?) RETURNING id')
  .get(paymentId, orderId, put);

// Puts `put` of a payment on one locked order as the step named, and adds its line.
async function applyToOrder(row, step, who, { put, paymentId, payment, extraPence = 0, reason = null }) {
  if (paymentId) await linkPayment(paymentId, row.id, put);
  const detail = { amountPence: put, receivedOn: payment.receivedOn, ...(payment.reference ? { reference: payment.reference } : {}), ...(paymentId ? { paymentId } : {}) };
  if (paymentId && payment.amountPence !== put) detail.paymentPence = payment.amountPence;
  if (extraPence > 0) detail.extraPence = extraPence;
  if (step === 'shortfall_closed') detail.shortfallPence = owedOf(row) - put;
  await takeStep(row.id, step, who, () => ({
    paid_pence: (row.paid_pence ?? 0) + put,
    provider_reference: payment.reference ?? row.provider_reference,
    ...(step === 'paid' ? { paid_on: payment.receivedOn } : {}),
    ...(step === 'shortfall_closed' ? { close_reason: reason } : {}),
  }), { detail, reason });
}

/**
 * Mark paid on one order (cw-mark-paid). `as` says what to do with a difference:
 * none for exactly what's owed; 'part' or 'close' (with a reason) for less;
 * 'paid' for more, the extra noted. Anything else is refused with the difference
 * (409 `difference`) or as a mistake (Refused 400).
 */
export async function markPaid(orderId, who, payment, { as = null, reason = null } = {}) {
  const row = Number.isInteger(orderId) ? await prepare(`${LOCK} WHERE id = ? FOR UPDATE`).get(orderId) : null;
  if (!row) throw new Refused(404, NOT_FOUND);
  if (row.stage !== 'collected') throw new Refused(409, WRONG_STAGE);
  const owed = owedOf(row);
  const diff = payment.amountPence - owed;
  const wrong = (error) => new Refused(400, { error });
  let step = 'paid';
  if (as === null) {
    if (diff !== 0) throw new Refused(409, { error: `£${(Math.abs(diff) / 100).toFixed(2)} ${diff < 0 ? 'less' : 'more'} than expected.`, code: 'difference', differencePence: diff, owedPence: owed });
  } else if (as === 'paid') {
    if (diff < 0) throw wrong('That’s less than expected: save it as part paid, or close it with a reason');
  } else if (as === 'part' || as === 'close') {
    if (diff >= 0) throw wrong('That isn’t less than expected: mark it paid instead');
    if (as === 'part' && payment.amountPence === 0) throw wrong('Enter the amount received');
    if (as === 'close' && !reason) throw wrong('Say why it’s being closed');
    step = as === 'part' ? 'part_paid' : 'shortfall_closed';
  } else throw wrong('Choose what to do about the difference');
  const put = step === 'paid' ? owed : payment.amountPence;
  const paymentId = payment.amountPence > 0 ? await newPayment(row.provider_id, payment) : null;
  await applyToOrder(row, step, who, { put, paymentId, payment, extraPence: Math.max(0, diff), reason });
}

/**
 * Record a payment (cw-record-payment): one payment over the ticked collected
 * bikes of one provider, put on the oldest collected first. Each bike it fully
 * covers is paid; one it covers in part is saved as part paid; one it doesn't
 * reach is left as it was. Anything over what the ticked bikes are owed is
 * noted on the payment and on each paid bike's line.
 */
export async function recordPayment(providerId, who, payment, orderIds) {
  if (!Number.isInteger(providerId) || !(await prepare('SELECT id FROM c2w_providers WHERE id = ?').get(providerId))) throw new Refused(404, NOT_FOUND);
  const rows = await prepare(`${LOCK} WHERE id = ANY(?::int[]) ORDER BY id FOR UPDATE`).all(orderIds);
  if (rows.length !== orderIds.length || rows.some((r) => r.provider_id !== providerId || r.stage !== 'collected')) throw new Refused(409, NOT_OWED);
  rows.sort((a, b) => (new Date(a.collected_at) - new Date(b.collected_at)) || String(a.expected_by).localeCompare(String(b.expected_by)) || a.id - b.id);
  const expectedPence = rows.reduce((s, r) => s + owedOf(r), 0);
  const extraPence = Math.max(0, payment.amountPence - expectedPence);
  const paymentId = payment.amountPence > 0 ? await newPayment(providerId, payment) : null;
  let left = payment.amountPence;
  for (const row of rows) {
    const owed = owedOf(row);
    const put = Math.min(owed, left);
    left -= put;
    if (put === owed) await applyToOrder(row, 'paid', who, { put, paymentId, payment, extraPence });
    else if (put > 0) await applyToOrder(row, 'part_paid', who, { put, paymentId, payment });
  }
  return { expectedPence, receivedPence: payment.amountPence, differencePence: payment.amountPence - expectedPence };
}

// The collected orders still owed for, oldest expected first, with their days late.
export async function owedOrders(tz, providerId = null) {
  const today = shopToday(tz);
  const rows = await prepare(`SELECT o.id, o.provider_id, p.name AS provider_name, c.name AS customer_name, o.collected_at,
      o.certificate_number, o.expected_pence, o.paid_pence, to_char(o.expected_by, 'YYYY-MM-DD') AS expected_by
    FROM c2w_orders o JOIN c2w_providers p ON p.id = o.provider_id JOIN customers c ON c.id = o.customer_id
    WHERE o.stage = 'collected'${providerId === null ? '' : ' AND o.provider_id = ?'}
    ORDER BY o.expected_by NULLS LAST, o.id`).all(...(providerId === null ? [] : [providerId]));
  return rows.map((r) => ({
    id: r.id, providerId: r.provider_id, providerName: r.provider_name, customerName: r.customer_name,
    collectedOn: r.collected_at ? shopToday(tz, new Date(r.collected_at)) : null, certificateNumber: r.certificate_number,
    expectedPence: r.expected_pence, paidPence: r.paid_pence, owedPence: owedOf(r), expectedBy: r.expected_by, lateDays: lateDaysOf(r.expected_by, today),
  }));
}

// Owed by Cycle to Work providers (cw-owed): one line per provider with bikes owed, in
// Settings' order, and the total. Late is what's owed on bikes past their expected
// date, with the days the oldest of them is late.
export function owedByProvider(orders) {
  const byId = new Map();
  for (const o of orders) {
    const p = byId.get(o.providerId) ?? { id: o.providerId, name: o.providerName, bikes: 0, owedPence: 0, latePence: 0, lateDays: null };
    p.bikes += 1;
    p.owedPence += o.owedPence;
    if (o.lateDays !== null) {
      p.latePence += o.owedPence;
      p.lateDays = Math.max(p.lateDays ?? 0, o.lateDays);
    }
    byId.set(o.providerId, p);
  }
  const providers = [...byId.values()].sort((a, b) => a.id - b.id);
  const sum = (k) => providers.reduce((s, p) => s + p[k], 0);
  return { providers, total: { bikes: sum('bikes'), owedPence: sum('owedPence'), latePence: sum('latePence') } };
}
