// An online order's payment shares online_payments with booking deposits
// (website-buy-online migration 154, tasks 5.0a–c and 5.0e): the deposit code
// that settles, refunds and takes the pretend card must leave an order's
// payment alone. The pretend provider only; no real account.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { connectPayments } from './helpers/payments.js';
import { pretend } from '../server/payments/pretend.js';

let server;
let owner;
let previousProvider;
let orders = 0;

before(async () => {
  // settleDeposits and refundOwed run in this process, so it uses the pretend provider too.
  previousProvider = process.env.PAYMENTS_PROVIDER;
  process.env.PAYMENTS_PROVIDER = 'pretend';
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Order Guard Cycles' });
  await connectPayments(owner.shop.id);
});
after(async () => {
  if (previousProvider === undefined) delete process.env.PAYMENTS_PROVIDER;
  else process.env.PAYMENTS_PROVIDER = previousProvider;
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const pretendStatus = (ref) => inShop(async () => (await prepare('SELECT status FROM pretend_payments WHERE ref = ?').get(ref)).status);
const paymentRow = (id) => inShop(() => prepare('SELECT status, refund_due_reason FROM online_payments WHERE id = ?').get(id));

/** An order awaiting payment, its pretend payment moved to `status`, and the online_payments row for it. */
async function orderPayment(status, { refundDue = null } = {}) {
  orders += 1;
  return inShop(async () => {
    const site = (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get())?.id
      ?? (await prepare("INSERT INTO sites (name, code) VALUES ('[Site]', 'S') RETURNING id").get()).id;
    const order = await prepare(
      `INSERT INTO online_orders (site_id, name, email, total_pence, card_pence, order_code, request_key_hash)
       VALUES (?, 'Maya Patel', 'maya@example.test', 2500, 2500, ?, ?) RETURNING id`
    ).get(site, `[order code ${orders}]`, `[order key ${orders}]`);
    const { ref } = await pretend.hold({ amountPence: 2500, key: `guard-order-${orders}` });
    if (status !== 'waiting') await pretend.card(ref, '4242424242424242');
    if (status === 'taken') await pretend.take(ref);
    const row = await prepare(
      `INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, purpose, online_order_id, refund_due_reason, updated_at)
       VALUES ('pretend', ?, 2500, ?, ?, 'order', ?, ?, now() - interval '2 hours') RETURNING id`
    ).get(ref, status, `[payment key ${orders}]`, order.id, refundDue);
    return { id: row.id, ref };
  });
}

test('5.0a: settling deposits leaves a held order payment held (no job, over an hour old)', async () => {
  const { settleDeposits } = await import('../server/payments/settle.js');
  const p = await orderPayment('held');
  await inShop(() => settleDeposits());
  assert.equal(await pretendStatus(p.ref), 'held');
  assert.equal((await paymentRow(p.id)).status, 'held');
});

test('5.0b: making owed deposit refunds leaves an order payment marked owed alone', async () => {
  const { refundOwed } = await import('../server/payments/refund.js');
  const p = await orderPayment('taken', { refundDue: '[reason]' });
  await inShop(() => refundOwed());
  assert.equal(await pretendStatus(p.ref), 'taken');
  assert.deepEqual({ ...(await paymentRow(p.id)) }, { status: 'taken', refund_due_reason: '[reason]' });
});

test('5.0e: the pretend card route is for deposits: an order payment’s ref is not found, and neither record moves', async () => {
  const p = await orderPayment('waiting');
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/pretend-payments/${p.ref}/card`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardNumber: '4242424242424242' }),
  });
  await res.text();
  assert.equal(res.status, 404);
  assert.equal((await paymentRow(p.id)).status, 'waiting');
  assert.equal(await pretendStatus(p.ref), 'waiting', 'the provider’s own record is left as it was too');
});
