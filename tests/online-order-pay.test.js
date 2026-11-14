// Paying an online order, the server half (openspec/changes/website-buy-online,
// tasks 5.0d, 5.1–5.3 and 5.7; design 3; drawings on-confirmed,
// on-checkout-sold-out and on-checkout-declined in
// docs/design/user-journeys/generator/online.mjs). Pay takes the order made by
// checkout: in one transaction the stock comes off the collecting shop, the
// store credit is spent, one sale is recorded, the order gets its number and
// the card part is taken. Against the real server and the pretend provider;
// no real account is used. Names and emails are made-up test values.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { connectPayments } from './helpers/payments.js';
import { changeTable } from './helpers/table-change.js';
import { adminUrlFrom } from '../scripts/dev/new-db.mjs';
import { runWithShop, prepare, pool } from '../server/db.js';
import { signupCustomer, createCustomerSession } from '../server/customer-auth.js';
import { moneyBucket } from '../server/accounts/summary.js';
import { ORDER_TENDER, CREDIT_TENDER, CREDIT_SHORT, settleFailedTake } from '../server/online-orders/pay.js';
import { NOT_TAKING } from '../server/online-orders/basket.js';
import { discardPendingShopifyPushes, pendingShopifyPushes } from '../server/lib/sales.js';
import { Readable } from 'node:stream';
import { handleSiteRequest } from '../server/routes/site.js';
import { saveShopifyConnection } from '../server/shopify.js';

let server;
let north;
let bolton;
let visitor = 0;
const P = {};
const nextVisitor = () => `198.51.101.${++visitor}`;
const ACCEPTED = '4242424242424242';
const DECLINED_CARD = '4000000000000002';
// on-checkout-declined, word for word.
const DECLINED = 'Your card was declined — nothing has been taken. Try another card, or Apple Pay or Google Pay.';

const inNorth = (fn) => runWithShop(north.shop.id, fn);
const setStock = (productId, siteId, qty) => inNorth(() => prepare(
  'INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT (shop_id, site_id, product_id) DO UPDATE SET qty = EXCLUDED.qty RETURNING shop_id'
).run(siteId, productId, qty));
const stockAt = (productId, siteId) => inNorth(async () => (await prepare('SELECT qty FROM product_stock WHERE product_id = ? AND site_id = ?').get(productId, siteId))?.qty ?? 0);
const adminDatabaseUrl = () => { const u = new URL(adminUrlFrom(process.env)); u.pathname = new URL(process.env.DATABASE_URL).pathname; return u.href; };

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  north = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  await inNorth(async () => {
    await prepare("UPDATE sites SET name = 'Bolton', code = 'B'").run();
    bolton = (await prepare('SELECT id FROM sites').get()).id;
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Brakes', 'Brakes')").run();
    const add = async (key, name, sku, price) => {
      P[key] = (await prepare(
        "INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES (?, ?, 'Brakes', ?, 1, true, 1, now()) RETURNING id"
      ).get(sku, name, price)).id;
    };
    await add('pads', 'Shimano brake pads', 'B05S-RX', 28);
    await add('lever', '[Brake lever]', '[sku lever]', 40);
    await add('cable', '[Brake cable]', '[sku cable]', 6);
    await add('bell', '[Bell]', '[sku bell]', 5);
    await prepare("INSERT INTO online_order_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id").run();
    await prepare('UPDATE online_order_settings SET buying_online = true').run();
    await prepare('INSERT INTO payment_settings (store_credit_on) VALUES (true) ON CONFLICT (shop_id) DO UPDATE SET store_credit_on = true RETURNING shop_id').run();
  });
  await setStock(P.pads, bolton, 50);
  await setStock(P.lever, bolton, 1);
  await setStock(P.cable, bolton, 50);
  await setStock(P.bell, bolton, 50);
  assert.equal((await staffRequest(server.baseUrl, north.cookie, '/api/website')).status, 200);
  assert.equal((await staffRequest(server.baseUrl, north.cookie, '/api/website/turn-on', { method: 'POST' })).status, 200);
  await connectPayments(north.shop.id);
});

after(async () => {
  if (north) await deleteTestShop(north.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function post(path, body, { cookie, from = nextVisitor() } = {}) {
  const base = new URL(server.baseUrl);
  const text = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: base.hostname, port: base.port, path: `/store/${north.shop.slug}/api/site${path}`, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text), 'x-forwarded-for': from, ...(cookie ? { cookie } : {}) },
    }, (res) => {
      let out = '';
      res.on('data', (c) => { out += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(out); } catch { parsed = out; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.end(text);
  });
}

async function signedIn({ credit = 0 } = {}) {
  const email = `maya-${randomUUID().slice(0, 8)}@example.test`;
  const { login } = await signupCustomer({ shopSlug: north.shop.slug, email, password: 'password123', name: 'Maya Patel' });
  await inNorth(async () => {
    await prepare("UPDATE customers SET phone = '07700 900 142' WHERE id = ?").run(login.customer_id);
    if (credit) await prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason) VALUES (?, ?, 'added', '[reason]')").run(login.customer_id, credit);
  });
  const token = await createCustomerSession(login.id);
  return { email, customerId: login.customer_id, cookie: `wh_customer_session=${token}` };
}

// An order made by checkout, as the website makes it.
async function order(lines, { who, useCredit = false } = {}) {
  const email = who?.email ?? `maya-${randomUUID().slice(0, 8)}@example.test`;
  const res = await post('/checkout', {
    shop: bolton, lines, name: 'Maya Patel', phone: '07700 900 142', email, useCredit, requestKey: randomUUID(),
  }, { cookie: who?.cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { ...res.body, email };
}
const pay = (ref, body = { card: ACCEPTED }) => post(`/orders/${ref}/pay`, body);

const orderRow = (ref) => inNorth(() => prepare('SELECT * FROM online_orders WHERE order_code = ?').get(ref));
const paymentRow = (orderId) => inNorth(() => prepare("SELECT * FROM online_payments WHERE online_order_id = ? AND purpose = 'order'").get(orderId));
const pretendStatus = (providerRef) => inNorth(async () => (await prepare('SELECT status FROM pretend_payments WHERE ref = ?').get(providerRef)).status);
const creditOf = (customerId) => inNorth(async () => Number((await prepare('SELECT COALESCE(sum(change_pence), 0) AS s FROM store_credit_entries WHERE customer_id = ?').get(customerId)).s));
const salesFor = (customerId) => inNorth(() => prepare('SELECT * FROM sales WHERE customer_id = ?').all(customerId));
const nextNumber = () => inNorth(async () => (await prepare('SELECT next_order_number FROM online_order_settings').get()).next_order_number);
const messagesTo = (email) => inNorth(() => prepare('SELECT template_key FROM customer_messages WHERE to_address = ? ORDER BY id').all(email));

// ---- 5.1 A card that works ------------------------------------------------

test('5.1 a card that works: stock off Bolton, credit spent, one sale with Paid online and Store credit, a number, To get ready, taken, Order confirmation', async () => {
  const maya = await signedIn({ credit: 1000 });
  const made = await order([{ productId: P.pads, qty: 2 }], { who: maya, useCredit: true });
  assert.deepEqual([made.totalPence, made.creditPence, made.cardPence], [5600, 1000, 4600]);
  const before = await stockAt(P.pads, bolton);

  const res = await pay(made.ref);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const row = await orderRow(made.ref);
  assert.equal(res.body.ref, made.ref);
  assert.equal(res.body.number, `[prefix]-${row.number}`);
  assert.deepEqual([res.body.totalPence, res.body.creditPence, res.body.cardPence], [5600, 1000, 4600]);

  assert.equal(row.stage, 'to_get_ready');
  assert.ok(row.number > 0 && row.paid_at !== null, 'numbered and paid');
  assert.equal(await stockAt(P.pads, bolton), before - 2, 'stock comes off the collecting shop');
  assert.equal(await creditOf(maya.customerId), 0, 'the credit is spent');
  const spent = await inNorth(() => prepare("SELECT change_pence, online_order_id FROM store_credit_entries WHERE customer_id = ? AND kind = 'spent'").all(maya.customerId));
  assert.deepEqual(spent.map((e) => [e.change_pence, e.online_order_id]), [[-1000, row.id]]);

  const sales = await salesFor(maya.customerId);
  assert.equal(sales.length, 1, 'one sale');
  assert.equal(row.sale_id, sales[0].id);
  assert.equal(Number(sales[0].total), 56);
  assert.equal(Number(sales[0].group_discount_amount), 0);
  const tenders = await inNorth(() => prepare('SELECT tender_type, amount FROM sale_payments WHERE sale_id = ? ORDER BY tender_type').all(sales[0].id));
  assert.deepEqual(tenders.map((t) => [t.tender_type, Number(t.amount)]), [[ORDER_TENDER, 46], [CREDIT_TENDER, 10]]);
  assert.deepEqual([ORDER_TENDER, CREDIT_TENDER], ['Paid online', 'Store credit']);
  const items = await inNorth(() => prepare('SELECT product_id, qty, unit_price FROM sale_items WHERE sale_id = ?').all(sales[0].id));
  assert.deepEqual(items.map((i) => [i.product_id, i.qty, Number(i.unit_price)]), [[P.pads, 2, 28]]);
  const moved = await inNorth(() => prepare("SELECT site_id, change_qty FROM stock_movements WHERE sale_id = ?").all(sales[0].id));
  assert.deepEqual(moved.map((m) => [m.site_id, m.change_qty]), [[bolton, -2]]);

  const payment = await paymentRow(row.id);
  assert.equal(payment.status, 'taken');
  assert.equal(await pretendStatus(payment.provider_ref), 'taken');
  assert.deepEqual((await messagesTo(made.email)).map((m) => m.template_key), ['order_confirmation']);
});

test('5.1 a customer in a group with a discount pays the total checkout showed, with no discount added at payment', async () => {
  const maya = await signedIn();
  await inNorth(async () => {
    const g = (await prepare("INSERT INTO customer_groups (name, discount_percent) VALUES ('[Group]', 10) RETURNING id").get()).id;
    await prepare('INSERT INTO customer_group_members (group_id, customer_id) VALUES (?, ?)').run(g, maya.customerId);
  });
  const made = await order([{ productId: P.cable, qty: 1 }], { who: maya });
  const res = await pay(made.ref);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [sale] = await salesFor(maya.customerId);
  assert.deepEqual([Number(sale.total), Number(sale.group_discount_amount)], [6, 0]);
});

test('5.1 Pay pressed again after it paid answers the paid order, and takes nothing more', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  const first = await pay(made.ref);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const again = await pay(made.ref);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual(again.body, first.body);
  const row = await orderRow(made.ref);
  assert.equal((await salesFor(row.customer_id)).length, 1);
  assert.deepEqual((await messagesTo(made.email)).map((m) => m.template_key), ['order_confirmation']);
});

test('5.1 two presses at once pay once', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  const [a, b] = await Promise.all([pay(made.ref), pay(made.ref)]);
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual(a.body, b.body);
  const row = await orderRow(made.ref);
  assert.equal((await salesFor(row.customer_id)).length, 1);
});

test('5.0d the order number is given last: a number is never spent on an order that wasn’t paid', async () => {
  const before = await inNorth(async () => (await prepare('SELECT next_order_number FROM online_order_settings').get()).next_order_number);
  const made = await order([{ productId: P.cable, qty: 1 }]);
  assert.equal((await pay(made.ref, { card: DECLINED_CARD })).status, 402);
  const after = await inNorth(async () => (await prepare('SELECT next_order_number FROM online_order_settings').get()).next_order_number);
  assert.equal(after, before, 'a declined card spends no number');
});

test('5.1 Place order: credit that covers it all pays with no card', async () => {
  const maya = await signedIn({ credit: 10000 });
  const made = await order([{ productId: P.cable, qty: 2 }], { who: maya, useCredit: true });
  assert.deepEqual([made.cardPence, made.payment], [0, null]);
  const res = await pay(made.ref, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await orderRow(made.ref)).stage, 'to_get_ready');
  assert.equal(await creditOf(maya.customerId), 10000 - 1200);
  const [sale] = await salesFor(maya.customerId);
  const tenders = await inNorth(() => prepare('SELECT tender_type, amount FROM sale_payments WHERE sale_id = ?').all(sale.id));
  assert.deepEqual(tenders.map((t) => [t.tender_type, Number(t.amount)]), [[CREDIT_TENDER, 12]]);
});

// ---- 5.2 Sold out just before paying ---------------------------------------

test('5.2 sold out just before paying: the hold is released, nothing taken from card or credit, no sale, and the answer names the product and shop', async () => {
  const maya = await signedIn({ credit: 500 });
  await setStock(P.lever, bolton, 1);
  const made = await order([{ productId: P.lever, qty: 1 }], { who: maya, useCredit: true });
  // The last one sells at the till.
  await setStock(P.lever, bolton, 0);
  const numberBefore = await nextNumber();

  const res = await pay(made.ref);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(await nextNumber(), numberBefore, 'a sold-out order spends no number');
  assert.equal(res.body.error, '[Brake lever] has just sold out at Bolton. Nothing has been taken. Remove it from your order to carry on.');
  assert.deepEqual(res.body.soldOut, { productId: P.lever, name: '[Brake lever]', site: 'Bolton' });

  const row = await orderRow(made.ref);
  assert.equal(row.stage, 'not_paid');
  assert.ok(row.number === null && row.sale_id === null);
  const payment = await paymentRow(row.id);
  assert.equal(payment.status, 'released');
  assert.equal(await pretendStatus(payment.provider_ref), 'released');
  assert.equal(await creditOf(maya.customerId), 500, 'credit untouched');
  assert.equal((await salesFor(maya.customerId)).length, 0);
  assert.equal(await stockAt(P.lever, bolton), 0);
  assert.deepEqual(await messagesTo(made.email), []);
});

test('5.2 a product taken off sale since checkout is sold out too: the hold let go, nothing taken', async () => {
  const made = await order([{ productId: P.bell, qty: 1 }]);
  await inNorth(() => prepare('UPDATE products SET active = 0 WHERE id = ? RETURNING id').get(P.bell));
  let res;
  try {
    res = await pay(made.ref);
  } finally {
    await inNorth(() => prepare('UPDATE products SET active = 1 WHERE id = ? RETURNING id').get(P.bell));
  }
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, '[Bell] has just sold out at Bolton. Nothing has been taken. Remove it from your order to carry on.');
  const row = await orderRow(made.ref);
  assert.equal(row.stage, 'not_paid');
  const payment = await paymentRow(row.id);
  assert.equal(payment.status, 'released');
  assert.equal(await pretendStatus(payment.provider_ref), 'released');
  assert.equal((await salesFor(row.customer_id)).length, 0);
});

test('5.2 store credit spent at the till since checkout: the hold let go, nothing taken from card or credit, no sale, no number', async () => {
  const maya = await signedIn({ credit: 500 });
  const made = await order([{ productId: P.bell, qty: 2 }], { who: maya, useCredit: true });
  assert.equal(made.creditPence, 500);
  // Some of the credit is spent at the till before Pay is pressed.
  await inNorth(() => prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason) VALUES (?, -200, 'spent', '[reason]')").run(maya.customerId));
  const numberBefore = await nextNumber();
  const stockBefore = await stockAt(P.bell, bolton);

  const res = await pay(made.ref);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, CREDIT_SHORT);
  assert.equal(await nextNumber(), numberBefore, 'no number spent');
  const row = await orderRow(made.ref);
  assert.equal(row.stage, 'not_paid');
  assert.ok(row.number === null && row.sale_id === null);
  const payment = await paymentRow(row.id);
  assert.equal(payment.status, 'released');
  assert.equal(await pretendStatus(payment.provider_ref), 'released');
  assert.equal(await creditOf(maya.customerId), 300, 'only the till spend is gone');
  assert.equal((await salesFor(maya.customerId)).length, 0);
  assert.equal(await stockAt(P.bell, bolton), stockBefore);
});

test('pay when the shop has stopped taking orders since checkout: the hold let go, nothing taken', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  await inNorth(() => prepare('UPDATE online_order_settings SET buying_online = false RETURNING shop_id').get());
  let res;
  try {
    res = await pay(made.ref);
  } finally {
    await inNorth(() => prepare('UPDATE online_order_settings SET buying_online = true RETURNING shop_id').get());
  }
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, NOT_TAKING);
  const row = await orderRow(made.ref);
  assert.equal(row.stage, 'not_paid');
  assert.ok(row.number === null && row.sale_id === null);
  const payment = await paymentRow(row.id);
  assert.equal(payment.status, 'released');
  assert.equal(await pretendStatus(payment.provider_ref), 'released');
  assert.equal((await salesFor(row.customer_id)).length, 0);
});

// ---- 5.3 Declined ------------------------------------------------------------

test('5.3 declined: nothing taken and credit unchanged; another card then pays once', async () => {
  const maya = await signedIn({ credit: 300 });
  const made = await order([{ productId: P.pads, qty: 1 }], { who: maya, useCredit: true });

  const declined = await pay(made.ref, { card: DECLINED_CARD });
  assert.equal(declined.status, 402, JSON.stringify(declined.body));
  assert.equal(declined.body.error, DECLINED);
  let row = await orderRow(made.ref);
  assert.equal(row.stage, 'awaiting_payment');
  assert.equal((await paymentRow(row.id)).status, 'declined');
  assert.equal(await creditOf(maya.customerId), 300);
  assert.equal((await salesFor(maya.customerId)).length, 0);

  const paid = await pay(made.ref);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  row = await orderRow(made.ref);
  assert.equal(row.stage, 'to_get_ready');
  assert.equal((await paymentRow(row.id)).status, 'taken');
  assert.equal(await creditOf(maya.customerId), 0);
  assert.equal((await salesFor(maya.customerId)).length, 1);
});

test('5.3 a card number that isn’t a test card, or none, is refused in words and takes nothing', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  for (const body of [{ card: '1234' }, {}]) {
    const res = await pay(made.ref, body);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Check the card number.');
  }
  assert.equal((await orderRow(made.ref)).stage, 'awaiting_payment');
});

test('pay for an order that isn’t there is not found', async () => {
  const res = await pay('0'.repeat(64));
  assert.equal(res.status, 404, JSON.stringify(res.body));
});

// ---- 5.7 A commit that fails after the take ------------------------------

test('5.7 a commit that fails after the take leaves no sale and no number, and the payment let go once with the reason kept', async () => {
  const maya = await signedIn({ credit: 200 });
  const made = await order([{ productId: P.cable, qty: 1 }], { who: maya, useCredit: true });
  const before = await stockAt(P.cable, bolton);
  const db = new pg.Client({ connectionString: adminDatabaseUrl() });
  await db.connect();
  const fn = `fail_paid_${randomUUID().slice(0, 8)}`;
  await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.order_code = '${made.ref}' AND NEW.paid_at IS NOT NULL THEN RAISE EXCEPTION 'refused at commit for this test'; END IF; RETURN NEW; END $$`);
  await changeTable(db, `CREATE CONSTRAINT TRIGGER ${fn} AFTER UPDATE ON online_orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  let res;
  try {
    res = await pay(made.ref);
  } finally {
    await changeTable(db, `DROP TRIGGER ${fn} ON online_orders`);
    await db.query(`DROP FUNCTION ${fn}()`);
    await db.end();
  }
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error, 'Your payment couldn’t be finished, so nothing has been taken. Go back to your basket and try again.');
  const row = await orderRow(made.ref);
  assert.equal(row.stage, 'not_paid');
  assert.ok(row.number === null && row.sale_id === null);
  assert.equal((await salesFor(maya.customerId)).length, 0);
  assert.equal(await creditOf(maya.customerId), 200);
  assert.equal(await stockAt(P.cable, bolton), before);
  const payment = await paymentRow(row.id);
  // The pretend provider's take was in the same transaction, so it rolled back to held: let go, not refunded.
  assert.equal(payment.status, 'released');
  assert.equal(payment.refund_due_reason, null);
  assert.equal(payment.refund_reason, 'The order couldn’t be saved after the payment was taken');
  assert.equal(await pretendStatus(payment.provider_ref), 'released');
  // Pay again finds an order that can't be paid, and takes nothing.
  const again = await pay(made.ref);
  assert.equal(again.status, 409, JSON.stringify(again.body));
});

test('5.7 a refund owed on a taken payment is made once, however many times it is settled', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  const row = await orderRow(made.ref);
  const payment = await paymentRow(row.id);
  await inNorth(() => prepare("UPDATE online_payments SET refund_due_reason = 'The order couldn’t be saved after the payment was taken' WHERE id = ?").run(payment.id));
  const calls = [];
  const provider = {
    name: 'pretend',
    status: async () => ({ status: 'taken', amountPence: payment.amount_pence }),
    refund: async (ref, pence) => { calls.push(['refund', ref, pence]); },
    release: async (ref) => { calls.push(['release', ref]); },
  };
  await inNorth(() => settleFailedTake(payment.id, provider));
  await inNorth(() => settleFailedTake(payment.id, provider));
  assert.deepEqual(calls, [['refund', payment.provider_ref, payment.amount_pence]]);
  const after = await paymentRow(row.id);
  assert.equal(after.status, 'refunded');
  assert.equal(after.refund_due_reason, null);
  assert.ok(after.refunded_at !== null);
});

test('5.7 the money paid online is online money, not the till’s', () => {
  assert.equal(moneyBucket(ORDER_TENDER), 'online');
});

test('5.7 a payment whose order did pay (a commit that answered with an error but went through) is never refunded', async () => {
  const made = await order([{ productId: P.cable, qty: 1 }]);
  assert.equal((await pay(made.ref)).status, 200);
  const row = await orderRow(made.ref);
  const payment = await paymentRow(row.id);
  await inNorth(() => prepare("UPDATE online_payments SET refund_due_reason = 'The order couldn’t be saved after the payment was taken' WHERE id = ? RETURNING id").get(payment.id));
  const calls = [];
  const provider = {
    name: 'pretend',
    status: async () => ({ status: 'taken', amountPence: payment.amount_pence }),
    refund: async (ref, pence) => { calls.push(['refund', ref, pence]); },
    release: async (ref) => { calls.push(['release', ref]); },
  };
  await inNorth(() => settleFailedTake(payment.id, provider));
  assert.deepEqual(calls, [], 'a paid order’s payment is not refunded');
  const after = await paymentRow(row.id);
  assert.equal(after.status, 'taken');
  assert.equal(after.refund_due_reason, null);
  assert.equal(after.refunded_at, null);
});

test('a sale that rolled back sends none of its stock pushes, and frees its place in the shutdown wait', () => {
  let settled = 0;
  const pushes = [{ product: {}, newQty: 1 }, { product: {}, newQty: 2 }];
  pushes._pendingPushSettle = () => { settled += 1; };
  discardPendingShopifyPushes(pushes);
  assert.equal(pushes.length, 0);
  assert.equal(settled, 1);
  assert.equal(pushes._pendingPushSettle, undefined);
});

// ---- Shopify stock pushes after Pay ----------------------------------------

// A Pay request driven in-process, as server.js's website branch runs it: inside
// the shop's own database scope, with a list for work to run once it is released.
function payInProcess(ref, afterRelease) {
  const text = JSON.stringify({ card: ACCEPTED });
  const req = Object.assign(Readable.from([Buffer.from(text)]), {
    method: 'POST', url: `/api/site/orders/${ref}/pay`, socket: { remoteAddress: nextVisitor() },
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) },
  });
  const res = {
    headersSent: false, destroyed: false, setHeader() {},
    writeHead(status) { this.statusCode = status; this.headersSent = true; },
    end(body) { this.body = body; },
  };
  return { req, res, run: () => handleSiteRequest(req, res, req.url, north.shop, null, afterRelease) };
}

test('a paid order’s Shopify stock push runs once the request’s database connection is back, never on it', async () => {
  const calls = [];
  const original = globalThis.fetch;
  const provider = process.env.PAYMENTS_PROVIDER;
  // The pretend provider, as the live server has it (liveServer.js).
  process.env.PAYMENTS_PROVIDER = 'pretend';
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/locations.json')) return { ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await inNorth(() => saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' }));
    await inNorth(() => prepare("UPDATE products SET shopify_inventory_item_id = '888' WHERE id = ? RETURNING id").get(P.bell));
    const made = await order([{ productId: P.bell, qty: 1 }]);
    calls.length = 0;
    const afterRelease = [];
    const { res, run } = payInProcess(made.ref, afterRelease);
    await inNorth(async () => {
      await run();
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(afterRelease.length, 1, 'the push waits for the connection to be released');
    });
    assert.deepEqual(calls, [], 'nothing reached Shopify while the request held its connection');
    for (const work of afterRelease) work();
    await Promise.all([...pendingShopifyPushes]);
    assert.ok(calls.some((u) => u.includes('inventory_levels/set.json')), JSON.stringify(calls));
  } finally {
    globalThis.fetch = original;
    if (provider === undefined) delete process.env.PAYMENTS_PROVIDER; else process.env.PAYMENTS_PROVIDER = provider;
    await inNorth(async () => {
      await prepare('UPDATE products SET shopify_inventory_item_id = NULL WHERE id = ? RETURNING id').get(P.bell);
      await prepare('DELETE FROM shopify_connections RETURNING shop_id').get();
    });
  }
});
