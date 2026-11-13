// The basket and checkout, server only (openspec/changes/website-buy-online,
// tasks 4.1–4.5a; design 2 and 3). Public routes on the shop's website: the
// shop comes from the address, as every website route's does. The pretend
// payment provider (PAYMENTS_PROVIDER=pretend, as liveServer sets). Example
// data from the drawings: Bolton, "[Second site]", Maya Patel, Shimano brake
// pads B05S-RX at £28.00; other products stay bracketed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, firstShopIsBolton, seedMechanic } from './helpers/staff.js';
import { readCookie } from './helpers/http.js';
import { CUSTOMER_SESSION_COOKIE } from '../server/customer-auth.js';
import { deleteTestShop } from './helpers/testShop.js';
import { connectPayments } from './helpers/payments.js';

let server;
const shops = [];
let ip = 0;
// Each test its own network, so one test's tries never use up another's limit
// (the server trusts the forwarded address here, as behind the gateway).
const network = () => `198.51.100.${++ip}`;
const key = () => randomBytes(32).toString('base64url');

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A shop taking online orders: its website on, payments connected, Buying
// online on, Bolton and (when asked) a second shop, and the brake pads.
async function shopTakingOrders({ second = false, buying = true, connected = true, credit = true, creditOnline = credit, creditShop = credit } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  shops.push(owner);
  const bolton = (await firstShopIsBolton(owner)).id;
  if (connected) await connectPayments(owner.shop.id);
  const made = await runWithShop(owner.shop.id, async () => {
    await prepare('INSERT INTO storefront_settings (enabled) VALUES (true) RETURNING id').get();
    await prepare('INSERT INTO online_order_settings (buying_online, store_credit_on) VALUES (?, ?) RETURNING shop_id').get(buying, creditOnline);
    await prepare('INSERT INTO payment_settings (store_credit_on) VALUES (?) RETURNING shop_id').get(creditShop);
    const other = second ? (await prepare("INSERT INTO sites (name, code) VALUES ('[Second site]', 'S') RETURNING id").get()).id : null;
    const pads = (await prepare(
      "INSERT INTO products (sku, name, category, price, stock_qty, show_online, active, updated_at) VALUES ('B05S-RX', 'Shimano brake pads', '[Category]', 28, 3, true, 1, now()) RETURNING id"
    ).get()).id;
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 3) RETURNING product_id').get(bolton, pads);
    return { other, pads };
  });
  return { owner, slug: owner.shop.slug, bolton, ...made };
}

const stockAt = (shop, site, product, qty) => runWithShop(shop.owner.shop.id, () => prepare(
  `INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?)
   ON CONFLICT (shop_id, site_id, product_id) DO UPDATE SET qty = EXCLUDED.qty RETURNING product_id`
).get(site, product, qty));
const inShop = (shop, sql, ...args) => runWithShop(shop.owner.shop.id, () => prepare(sql).all(...args));
const count = async (shop, table) => Number((await inShop(shop, `SELECT count(*) AS n FROM ${table}`))[0].n);

function site(shop, path, body, { from = network(), cookie } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': from };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${server.baseUrl}${path}?storefrontSlug=${shop.slug}`, { method: 'POST', headers, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
}
const basket = (shop, body, opts) => site(shop, '/api/site/basket', body, opts);
const checkout = (shop, body, opts) => site(shop, '/api/site/checkout', body, opts);
const maya = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test' };

// ---------- 4.1 The basket is priced by the shop ----------

test('the basket prices each line from the product, with the stock line at the chosen shop', async () => {
  const shop = await shopTakingOrders();
  const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.takingOrders, true);
  assert.deepEqual(r.body.lines, [{
    productId: shop.pads, name: 'Shimano brake pads', code: 'B05S-RX', qty: 2, unitPence: 2800, linePence: 5600,
    stockLine: 'Ready today at Bolton', change: null, message: null,
  }]);
  assert.equal(r.body.itemCount, 2);
  assert.equal(r.body.totalPence, 5600);
  assert.equal(r.body.collect, 'Collect from Bolton');
  assert.equal(r.body.canCheckout, true);
  assert.equal(r.body.changed, null);
});

test('a price sent with the basket is ignored: the shop’s own price is used', async () => {
  const shop = await shopTakingOrders();
  const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1, unitPence: 1, price: 0.01, linePence: 1 }], totalPence: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lines[0].unitPence, 2800);
  assert.equal(r.body.totalPence, 2800);
  // And at checkout: the order and its hold are at the shop's price.
  const c = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1, unitPence: 1 }], totalPence: 1, ...maya });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.totalPence, 2800);
  assert.equal(c.body.payment.amountPence, 2800);
  const [line] = await inShop(shop, 'SELECT l.unit_pence FROM online_order_lines l JOIN online_orders o ON o.id = l.order_id WHERE o.order_code = ?', c.body.orderCode);
  assert.equal(line.unit_pence, 2800);
});

test('with fewer left than asked for, the line is changed: "Only 1 left at Bolton — we’ve changed it to 1"', async () => {
  const shop = await shopTakingOrders();
  await stockAt(shop, shop.bolton, shop.pads, 1);
  const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lines[0].qty, 1);
  assert.equal(r.body.lines[0].change, 'fewer');
  assert.equal(r.body.lines[0].message, 'Only 1 left at Bolton — we’ve changed it to 1');
  assert.equal(r.body.totalPence, 2800);
  assert.equal(r.body.changed, 'Something in your basket changed. Sort the lines marked below before checking out.');
  assert.equal(r.body.canCheckout, false);
  // Sent again as changed, it is sorted.
  const again = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] });
  assert.equal(again.body.canCheckout, true);
});

test('a line in stock at no shop: "No longer in stock at Bolton or [Second site] — remove it to carry on"', async () => {
  const shop = await shopTakingOrders({ second: true });
  await stockAt(shop, shop.bolton, shop.pads, 0);
  const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lines[0].change, 'gone');
  assert.equal(r.body.lines[0].message, 'No longer in stock at Bolton or [Second site] — remove it to carry on');
  assert.equal(r.body.lines[0].linePence, 0);
  assert.equal(r.body.totalPence, 0);
  assert.equal(r.body.canCheckout, false);
  assert.equal(r.body.checkoutOff, 'Remove the item that’s no longer in stock first.');
});

test('the basket needs a shop chosen when there are two, and never prices another business’s product', async () => {
  const shop = await shopTakingOrders({ second: true });
  const none = await basket(shop, { lines: [{ productId: shop.pads, qty: 1 }] });
  assert.equal(none.status, 400);
  assert.equal(none.body.code, 'choose_shop');
  const theirs = await shopTakingOrders();
  const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: theirs.pads, qty: 1 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lines[0].change, 'gone');
  assert.equal(r.body.lines[0].name, null, 'another business’s product is never named');
  assert.equal(r.body.totalPence, 0);
  const elsewhere = await basket(shop, { shop: theirs.bolton, lines: [{ productId: shop.pads, qty: 1 }] });
  assert.equal(elsewhere.body.code, 'choose_shop', 'another business’s shop is no shop here');
});

// ---------- 4.2 Not taking online orders ----------

const NOT_TAKING = 'Not taking online orders right now. Ask in the shop, or call us, to buy this';

test('the basket and checkout say "not taking online orders" with Buying online off, no payments, or a Shopify website', async () => {
  const off = await shopTakingOrders({ buying: false });
  const unpaid = await shopTakingOrders({ connected: false });
  const shopify = await shopTakingOrders();
  await runWithShop(shopify.owner.shop.id, () => prepare("INSERT INTO website (kind, is_on, draft) VALUES ('shopify', true, '{}'::jsonb) RETURNING shop_id").get());
  for (const shop of [off, unpaid, shopify]) {
    const b = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.takingOrders, false);
    assert.equal(b.body.message, NOT_TAKING);
    assert.equal(b.body.lines, undefined, 'nothing priced');
    const c = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
    assert.equal(c.status, 409, JSON.stringify(c.body));
    assert.equal(c.body.code, 'not_taking_orders');
    assert.equal(c.body.error, NOT_TAKING);
    assert.equal(await count(shop, 'online_orders'), 0);
    assert.equal(await count(shop, 'online_payments'), 0);
  }
});

// ---------- 4.3 Checkout checks the details ----------

test('checkout answers each box’s message and the count, and makes nothing', async () => {
  const shop = await shopTakingOrders();
  const customers = await count(shop, 'customers');
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], name: '  ', phone: maya.phone, email: 'maya@example' });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(r.body.code, 'check_details');
  assert.equal(r.body.error, 'Check the 2 boxes marked below.');
  assert.equal(r.body.count, 2);
  assert.deepEqual(r.body.boxes, { name: 'Enter your name', email: 'Check your email address — it needs an @ and a dot, like name@example.com' });
  const one = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya, name: '' });
  assert.equal(one.body.count, 1);
  assert.deepEqual(one.body.boxes, { name: 'Enter your name' });
  assert.equal(await count(shop, 'online_orders'), 0);
  assert.equal(await count(shop, 'online_payments'), 0);
  assert.equal(await count(shop, 'customers'), customers);
});

test('checkout re-prices and re-checks stock: a changed basket makes nothing', async () => {
  const shop = await shopTakingOrders();
  await stockAt(shop, shop.bolton, shop.pads, 1);
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2, unitPence: 1 }], ...maya });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.code, 'basket_changed');
  assert.equal(r.body.basket.lines[0].message, 'Only 1 left at Bolton — we’ve changed it to 1');
  assert.equal(await count(shop, 'online_orders'), 0);
});

// ---------- 4.4 Who is buying, and their store credit ----------

async function signedInMaya(shop, creditPence) {
  // Each from its own network, under the sign-up limit (portal.js).
  const email = `maya-${randomBytes(4).toString('hex')}@example.test`;
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': network() }, body: JSON.stringify({ name: 'Maya Patel', email, password: 'password123' }),
  });
  assert.equal(res.status, 201);
  const login = { cookie: readCookie(res, CUSTOMER_SESSION_COOKIE), email, loginId: (await res.json()).id };
  const customerId = (await inShop(shop, 'SELECT customer_id FROM customer_logins WHERE id = ?', login.loginId))[0].customer_id;
  await inShop(shop, "UPDATE customers SET phone = '07700 900 142' WHERE id = ? RETURNING id", customerId);
  if (creditPence) await inShop(shop, "INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES (?, ?, 'added') RETURNING id", customerId, creditPence);
  return { ...login, customerId };
}

test('a signed-in customer’s details and store credit come from their account', async () => {
  const shop = await shopTakingOrders();
  const me = await signedInMaya(shop, 1000);
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }], name: 'Someone Else', email: 'else@example.test', phone: '[phone]' }, { cookie: me.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.totalPence, 5600);
  assert.equal(r.body.creditPence, 1000);
  assert.equal(r.body.cardPence, 4600);
  assert.equal(r.body.coversAll, false);
  assert.equal(r.body.payment.amountPence, 4600);
  const [order] = await inShop(shop, 'SELECT * FROM online_orders WHERE order_code = ?', r.body.orderCode);
  assert.equal(order.customer_id, me.customerId);
  assert.equal(order.name, 'Maya Patel');
  assert.equal(order.email, me.email);
  assert.equal(order.phone, '07700 900 142');
  const [{ s }] = await inShop(shop, 'SELECT sum(change_pence) AS s FROM store_credit_entries WHERE customer_id = ?', me.customerId);
  assert.equal(Number(s), 1000, 'credit is only used once the order is paid');
});

test('store credit that covers it all: no card part and no payment', async () => {
  const shop = await shopTakingOrders();
  const me = await signedInMaya(shop, 9000);
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }] }, { cookie: me.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.coversAll, true);
  assert.equal(r.body.creditPence, 5600);
  assert.equal(r.body.cardPence, 0);
  assert.equal(r.body.payment, null);
  assert.equal(await count(shop, 'online_payments'), 0);
});

test('no store credit online when the shop doesn’t allow it, nor when the customer unticks it', async () => {
  const shop = await shopTakingOrders({ credit: false });
  const me = await signedInMaya(shop, 1000);
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] }, { cookie: me.cookie });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.creditPence, 0);
  assert.equal(r.body.cardPence, 2800);
  const allowed = await shopTakingOrders();
  const her = await signedInMaya(allowed, 1000);
  const unticked = await checkout(allowed, { requestKey: key(), shop: allowed.bolton, lines: [{ productId: allowed.pads, qty: 1 }], useCredit: false }, { cookie: her.cookie });
  assert.equal(unticked.body.creditPence, 0);
});

test('a guest gets a new customer of their own, never matched on typed details', async () => {
  const shop = await shopTakingOrders();
  // The shop already has Maya, with the same name, phone and email, given by her.
  const [existing] = await inShop(shop,
    "INSERT INTO customers (name, phone, email, email_from_customer, updated_at) VALUES ('Maya Patel', '07700 900 142', 'maya@example.test', true, now()) RETURNING id");
  await inShop(shop, "INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES (?, 5000, 'added') RETURNING id", existing.id);
  const before = await count(shop, 'customers');
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.creditPence, 0, 'a guest never spends anyone’s credit');
  const [order] = await inShop(shop, 'SELECT * FROM online_orders WHERE order_code = ?', r.body.orderCode);
  assert.notEqual(order.customer_id, null);
  assert.notEqual(order.customer_id, existing.id);
  assert.equal(await count(shop, 'customers'), before + 1);
  const [made] = await inShop(shop, 'SELECT name, phone, email, email_from_customer FROM customers WHERE id = ?', order.customer_id);
  assert.deepEqual(made, { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', email_from_customer: true });
});

// ---------- 4.5 One order and one held payment per request key ----------

test('checkout makes one order awaiting payment and one held payment; no money, sale, stock or number', async () => {
  const shop = await shopTakingOrders();
  const sales = await count(shop, 'sales');
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 2 }], ...maya });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stage, 'awaiting_payment');
  assert.equal(r.body.number, undefined, 'the number comes at payment');
  assert.match(r.body.orderCode, /^[0-9a-f]{64}$/);
  const [order] = await inShop(shop, 'SELECT * FROM online_orders WHERE order_code = ?', r.body.orderCode);
  assert.equal(order.stage, 'awaiting_payment');
  assert.equal(order.number, null);
  assert.equal(order.paid_at, null);
  assert.equal(order.sale_id, null);
  assert.equal(order.site_id, shop.bolton);
  assert.equal(order.total_pence, 5600);
  assert.deepEqual(await inShop(shop, 'SELECT product_id, qty, unit_pence FROM online_order_lines WHERE order_id = ?', order.id), [{ product_id: shop.pads, qty: 2, unit_pence: 2800 }]);
  const payments = await inShop(shop, 'SELECT * FROM online_payments');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].purpose, 'order');
  assert.equal(payments[0].online_order_id, order.id);
  assert.equal(payments[0].amount_pence, 5600);
  assert.equal(payments[0].status, 'waiting');
  assert.equal(payments[0].provider_ref, r.body.payment.ref);
  const [held] = await inShop(shop, 'SELECT status, amount_pence FROM pretend_payments WHERE ref = ?', r.body.payment.ref);
  assert.deepEqual(held, { status: 'waiting', amount_pence: 5600 }, 'held, never taken');
  assert.equal(await count(shop, 'sales'), sales, 'no sale');
  const [{ qty }] = await inShop(shop, 'SELECT qty FROM product_stock WHERE product_id = ?', shop.pads);
  assert.equal(qty, 3, 'stock unmoved');
});

test('sent twice with the same key, checkout gives the same order and the same hold', async () => {
  const shop = await shopTakingOrders();
  const body = { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya };
  const customers = await count(shop, 'customers');
  const [a, b] = await Promise.all([checkout(shop, body), checkout(shop, body)]);
  const c = await checkout(shop, body);
  for (const r of [a, b, c]) assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(a.body.orderCode, b.body.orderCode);
  assert.equal(a.body.orderCode, c.body.orderCode);
  assert.equal(a.body.payment.ref, c.body.payment.ref);
  assert.equal(await count(shop, 'online_orders'), 1);
  assert.equal(await count(shop, 'online_payments'), 1);
  assert.equal(await count(shop, 'pretend_payments'), 1);
  assert.equal(await count(shop, 'customers'), customers + 1, 'one guest customer, not one per try');
  const other = await checkout(shop, { ...body, lines: [{ productId: shop.pads, qty: 2 }] });
  assert.equal(other.status, 409, JSON.stringify(other.body));
  assert.equal(other.body.code, 'reused_key');
});

test('checkout is rate limited per network, counting only tries whose details pass', async () => {
  const shop = await shopTakingOrders();
  const from = network();
  const body = { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya };
  // Mistakes in the details don't use up the limit (as a deposit's hold counts only good tries).
  for (let i = 0; i < 35; i++) assert.equal((await checkout(shop, { ...body, name: '' }, { from })).status, 400, `mistake ${i + 1}`);
  for (let i = 0; i < 30; i++) assert.equal((await checkout(shop, body, { from })).status, 200, `try ${i + 1}`);
  const r = await checkout(shop, body, { from });
  assert.equal(r.status, 429);
  assert.equal(await count(shop, 'online_orders'), 1);
  assert.equal((await checkout(shop, { ...body, requestKey: key() })).status, 200, 'another network is not held up');
});

// ---------- 4.5a A checkout key never meets a booking's ----------

test('the same key used for a checkout and a booking deposit: each is its own, neither answers "already booked"', async () => {
  const shop = await shopTakingOrders();
  await seedMechanic(shop.owner.shop.id, { name: 'Sam' });
  const service = (await inShop(shop,
    "INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Service]', 65, 6500, 60, 1, 1, now()) RETURNING id"))[0].id;
  await staffRequest(server.baseUrl, shop.owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositKind: 'percent', depositPercent: 20, depositCancelHours: 24 } });
  const shared = key();
  const order = await checkout(shop, { requestKey: shared, shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
  assert.equal(order.status, 200, JSON.stringify(order.body));
  const deposit = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/deposit-holds`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceIds: [service], requestKey: shared }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal(deposit.status, 200, JSON.stringify(deposit.body));
  assert.equal(deposit.body.depositPence, 1300);
  const [orderRow] = await inShop(shop, 'SELECT request_key_hash FROM online_orders');
  assert.notEqual(orderRow.request_key_hash, createHash('sha256').update(shared).digest('hex'));
  // And the other way round: a key a deposit used first still checks out.
  const first = key();
  const held = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/deposit-holds`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceIds: [service], requestKey: first }),
  });
  assert.equal(held.status, 200);
  const after = await checkout(shop, { requestKey: first, shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
  assert.equal(after.status, 200, JSON.stringify(after.body));
  assert.equal(await count(shop, 'online_orders'), 2);
});

// ---------- 5.0a An order's hold is not a deposit left behind ----------

test('settling deposits leaves an order’s payment alone', async () => {
  const shop = await shopTakingOrders();
  const service = (await inShop(shop,
    "INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Service]', 65, 6500, 60, 1, 1, now()) RETURNING id"))[0].id;
  await staffRequest(server.baseUrl, shop.owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositKind: 'percent', depositPercent: 20, depositCancelHours: 24 } });
  const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await inShop(shop, "UPDATE online_payments SET updated_at = now() - interval '2 hours' WHERE purpose = 'order' RETURNING id");
  // Holding a deposit settles the ones left part-way first.
  const deposit = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/deposit-holds`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceIds: [service], requestKey: key() }),
  });
  assert.equal(deposit.status, 200);
  const [pay] = await inShop(shop, "SELECT status FROM online_payments WHERE purpose = 'order'");
  assert.equal(pay.status, 'waiting');
  const [held] = await inShop(shop, 'SELECT status FROM pretend_payments WHERE ref = ?', r.body.payment.ref);
  assert.equal(held.status, 'waiting');
});

// ---------- Review fixes (PR 4 code and risky-area reviews) ----------

test('a retry never makes a new hold over a payment the provider is checking, or has taken', async () => {
  for (const status of ['checking', 'taken']) {
    const shop = await shopTakingOrders();
    const body = { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya };
    const first = await checkout(shop, body);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    await inShop(shop, "UPDATE online_payments SET status = ? WHERE purpose = 'order' RETURNING id", status);
    const again = await checkout(shop, body);
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.payment.ref, first.body.payment.ref, `${status}: the same payment`);
    assert.equal(await count(shop, 'pretend_payments'), 1, `${status}: no new hold`);
    const [pay] = await inShop(shop, "SELECT status, provider_ref FROM online_payments WHERE purpose = 'order'");
    assert.deepEqual(pay, { status, provider_ref: first.body.payment.ref }, `${status}: left as it was`);
  }
  // A hold that was let go is made again.
  const shop = await shopTakingOrders();
  const body = { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya };
  const first = await checkout(shop, body);
  await inShop(shop, "UPDATE online_payments SET status = 'released' WHERE purpose = 'order' RETURNING id");
  const again = await checkout(shop, body);
  assert.notEqual(again.body.payment.ref, first.body.payment.ref);
});

test('a product not on the website is never named or priced in the basket, nor in checkout’s answer', async () => {
  for (const hide of ['UPDATE products SET show_online = false WHERE id = ? RETURNING id', 'UPDATE products SET active = 0 WHERE id = ? RETURNING id']) {
    const shop = await shopTakingOrders();
    await inShop(shop, hide, shop.pads);
    const r = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const [line] = r.body.lines;
    assert.equal(line.change, 'gone');
    assert.deepEqual([line.name, line.code, line.unitPence], [null, null, null], hide);
    const c = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya });
    assert.equal(c.status, 409, JSON.stringify(c.body));
    assert.deepEqual([c.body.basket.lines[0].name, c.body.basket.lines[0].code, c.body.basket.lines[0].unitPence], [null, null, null]);
  }
});

test('quantities, line counts and names past what a form sends are refused as bad requests', async () => {
  const shop = await shopTakingOrders();
  const many = Array.from({ length: 51 }, (_, i) => ({ productId: 1_000_000 + i, qty: 1 }));
  for (const lines of [[{ productId: shop.pads, qty: 0 }], [{ productId: shop.pads, qty: -5 }], [{ productId: shop.pads, qty: 1.5 }], [{ productId: shop.pads, qty: 1000 }], many]) {
    const b = await basket(shop, { shop: shop.bolton, lines });
    assert.equal(b.status, 400, `basket ${JSON.stringify(lines).slice(0, 60)}`);
    const c = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines, ...maya });
    assert.equal(c.status, 400, `checkout ${JSON.stringify(lines).slice(0, 60)}`);
  }
  const long = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya, name: 'M'.repeat(61) });
  assert.equal(long.status, 400, JSON.stringify(long.body));
  assert.equal(await count(shop, 'online_orders'), 0);
});

test('store credit needs both switches: off online only, or off for the shop only, uses none', async () => {
  for (const off of [{ creditOnline: false }, { creditShop: false }]) {
    const shop = await shopTakingOrders(off);
    const me = await signedInMaya(shop, 1000);
    const r = await checkout(shop, { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] }, { cookie: me.cookie });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.creditPence, 0, JSON.stringify(off));
    assert.equal(r.body.cardPence, 2800);
  }
});

test('a signed-in customer who changes their account between tries still gets the same order', async () => {
  const shop = await shopTakingOrders();
  const me = await signedInMaya(shop, 0);
  const body = { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] };
  const first = await checkout(shop, body, { cookie: me.cookie });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  await inShop(shop, "UPDATE customers SET name = 'Maya P', phone = '[phone]' WHERE id = ? RETURNING id", me.customerId);
  const again = await checkout(shop, body, { cookie: me.cookie });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.orderCode, first.body.orderCode);
  // The same key from someone else is not their order.
  const guest = await checkout(shop, { ...body, ...maya });
  assert.equal(guest.status, 409, JSON.stringify(guest.body));
  assert.equal(guest.body.code, 'reused_key');
});

test('stock counts frame-numbered bikes by frames in stock, and less Cycle to Work holds', async () => {
  const shop = await shopTakingOrders();
  const [bike] = await inShop(shop,
    "INSERT INTO products (sku, name, category, price, stock_qty, show_online, active, updated_at) VALUES ('[Code]', '[Product]', '[Category]', 500, 2, true, 1, now()) RETURNING id");
  await stockAt(shop, shop.bolton, bike.id, 2);
  await inShop(shop, "INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key, state) VALUES (?, ?, '[frame 1]', '[FRAME1]', 'in_stock'), (?, ?, '[frame 2]', '[FRAME2]', 'sold') RETURNING id", bike.id, shop.bolton, bike.id, shop.bolton);
  const framed = await basket(shop, { shop: shop.bolton, lines: [{ productId: bike.id, qty: 2 }] });
  assert.equal(framed.body.lines[0].message, 'Only 1 left at Bolton — we’ve changed it to 1');
  // Pads: 3 on the shelf, one held for a Cycle to Work order.
  const [customer] = await inShop(shop, "INSERT INTO customers (name, updated_at) VALUES ('[Customer]', now()) RETURNING id");
  const [provider] = await inShop(shop, "INSERT INTO c2w_providers (name) VALUES ('[Provider]') RETURNING id");
  await inShop(shop,
    `INSERT INTO c2w_orders (customer_id, provider_id, site_id, product_id, quote_number, quote_given_at, valid_until, hold_wanted, accessories, total_pence, customer_code, held_at)
     VALUES (?, ?, ?, ?, 1, now(), current_date + 30, true, '[]'::jsonb, 2800, ?, now()) RETURNING id`,
    customer.id, provider.id, shop.bolton, shop.pads, randomBytes(32).toString('hex'));
  const held = await basket(shop, { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 3 }] });
  assert.equal(held.body.lines[0].message, 'Only 2 left at Bolton — we’ve changed it to 2');
});

// ---------- On the website's own routes (routes/site.js) ----------

test('at /store/<slug>/, the basket answers customers; a switched-off website takes no order, even from the shop’s own staff', async () => {
  const shop = await shopTakingOrders();
  const post = (path, body, cookie) => fetch(`${server.baseUrl}/store/${shop.slug}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': network(), ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const b = await post('/api/site/basket', { shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }] });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.totalPence, 2800);
  await inShop(shop, 'UPDATE storefront_settings SET enabled = false RETURNING id');
  const c = await post('/api/site/checkout', { requestKey: key(), shop: shop.bolton, lines: [{ productId: shop.pads, qty: 1 }], ...maya }, shop.owner.cookie);
  assert.equal(c.status, 404, JSON.stringify(c.body));
  assert.equal(c.body.error, 'This website isn’t available');
  assert.equal(await count(shop, 'online_orders'), 0);
});
