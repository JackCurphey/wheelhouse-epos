// The website's basket and checkout, the server half (openspec/changes/
// website-buy-online, tasks 4.1–4.5; design 2 and 3; drawings on-basket,
// on-basket-changed, on-checkout, on-checkout-errors, on-checkout-credit,
// on-checkout-credit-all). The basket is only "which and how many": every
// price, total and stock line is worked out here. Checkout checks the details
// and works out store credit, and makes the order and its held payment (task 4.5).
import '../server/load-env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { connectPayments } from './helpers/payments.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { signupCustomer, createCustomerSession } from '../server/customer-auth.js';

let server;
let north;
let south;
let bolton;
let bury;
let visitor = 0;
const P = {};
const nextVisitor = () => `198.51.100.${++visitor}`;

const NOT_TAKING = 'Not taking online orders right now. Ask in the shop, or call us, to buy this';
const CHANGED = 'Something in your basket changed. Sort the lines marked below before checking out.';
const REMOVE_FIRST = 'Remove the item that’s no longer in stock first.';
const EMAIL_BAD = 'Check your email address — it needs an @ and a dot, like name@example.com';
const COVERS = 'Your store credit covers the whole order — nothing to pay by card.';

const inNorth = (fn) => runWithShop(north.shop.id, fn);
const setStock = (productId, siteId, qty) => inNorth(() => prepare(
  'INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT (shop_id, site_id, product_id) DO UPDATE SET qty = EXCLUDED.qty RETURNING shop_id'
).run(siteId, productId, qty));
const settings = (fields) => inNorth(async () => {
  await prepare('INSERT INTO online_order_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id').run();
  for (const [k, v] of Object.entries(fields)) await prepare(`UPDATE online_order_settings SET ${k} = ?`).run(v);
});

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  north = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  south = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });
  await inNorth(async () => {
    await prepare("UPDATE sites SET name = 'Bolton', code = 'B'").run();
    bolton = (await prepare('SELECT id FROM sites').get()).id;
    bury = (await prepare("INSERT INTO sites (name, code) VALUES ('[Second site]', 'S') RETURNING id").get()).id;
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Brakes', 'Brakes')").run();
    const add = async (key, name, sku, price, { online = true, active = 1 } = {}) => {
      P[key] = (await prepare(
        "INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES (?, ?, 'Brakes', ?, 1, ?, ?, now()) RETURNING id"
      ).get(sku, name, price, online, active)).id;
    };
    await add('pads', 'Shimano brake pads', 'B05S-RX', 28);
    await add('lever', '[Brake lever]', '[sku lever]', 40);
    await add('cable', '[Brake cable]', '[sku cable]', 6);
    await add('hidden', '[Not online]', '[sku hidden]', 9, { online: false });
    await add('tube', '[Inner tube]', '[sku tube]', 7);
    const group = (await prepare("INSERT INTO product_groups (name, photo_url) VALUES ('[Jersey]', '/photos/[jersey].jpg') RETURNING id").get()).id;
    await add('jersey', '[Jersey] M', '[sku jersey M]', 50);
    await prepare("UPDATE products SET group_id = ?, size = 'M', colour = '[Red]' WHERE id = ?").run(group, P.jersey);
  });
  await setStock(P.pads, bolton, 5);
  await setStock(P.lever, bolton, 1);
  await setStock(P.lever, bury, 4);
  await setStock(P.cable, bolton, 0);
  await setStock(P.cable, bury, 0);
  await setStock(P.hidden, bolton, 3);
  await setStock(P.tube, bolton, 0);
  await setStock(P.tube, bury, 2);
  await setStock(P.jersey, bolton, 1);
  for (const shop of [north, south]) {
    assert.equal((await staffRequest(server.baseUrl, shop.cookie, '/api/website')).status, 200);
    assert.equal((await staffRequest(server.baseUrl, shop.cookie, '/api/website/turn-on', { method: 'POST' })).status, 200);
  }
  await connectPayments(north.shop.id);
  await settings({ buying_online: true });
});

after(async () => {
  for (const shop of [north, south]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A POST as the website's pages send it, from one visitor address.
function post(shop, path, body, { cookie, from = nextVisitor(), raw } = {}) {
  const base = new URL(server.baseUrl);
  const text = raw ?? JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: base.hostname, port: base.port, path: `/store/${shop.shop.slug}/api/site${path}`, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text), 'x-forwarded-for': from, ...(cookie ? { cookie } : {}) },
    }, (res) => {
      let out = '';
      res.on('data', (c) => { out += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(out); } catch { parsed = out; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end(text);
  });
}
const basket = (body, opts) => post(north, '/basket', body, opts);
const checkout = (body, opts) => post(north, '/checkout', body, opts);
const ok = (res) => { assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body; };
const counts = () => inNorth(async () => ({
  orders: (await prepare('SELECT count(*)::int AS n FROM online_orders').get()).n,
  payments: (await prepare('SELECT count(*)::int AS n FROM online_payments').get()).n,
  customers: (await prepare('SELECT count(*)::int AS n FROM customers').get()).n,
}));

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

const guest = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test' };

// ---- 4.1 The basket is priced here -------------------------------------------

test('4.1 each line is priced from the product, never from what the browser sends; the total and the stock line at the chosen shop', async () => {
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 2, pricePence: 1 }] }));
  assert.equal(answer.taking, true);
  assert.deepEqual(answer.shop, { id: bolton, name: 'Bolton' });
  assert.equal(answer.lines.length, 1);
  const [line] = answer.lines;
  assert.equal(line.productId, P.pads);
  assert.equal(line.name, 'Shimano brake pads');
  assert.equal(line.code, 'B05S-RX');
  assert.equal(line.pricePence, 2800, 'the shop’s price, not the 1p sent');
  assert.equal(line.qty, 2);
  assert.equal(line.linePence, 5600);
  assert.deepEqual(line.stock, { line: 'ready', shop: 'Bolton', qty: 5 });
  assert.equal(line.note, null);
  assert.equal(line.gone, false);
  assert.equal(answer.count, 2);
  assert.equal(answer.totalPence, 5600);
  assert.equal(answer.changed, null);
  assert.equal(answer.blocked, null);
  assert.equal(line.size, null);
  assert.equal(line.photo, null);
});

test('4.1 a size of a product is named as the website names it: the group’s name and photo, its size and colour', async () => {
  const res = await basket({ shop: bolton, lines: [{ productId: P.jersey, qty: 1 }] });
  assert.equal(res.headers['cache-control'], 'no-store');
  const [line] = ok(res).lines;
  assert.equal(line.name, '[Jersey]');
  assert.equal(line.size, 'M');
  assert.equal(line.colour, '[Red]');
  assert.equal(line.photo, '/photos/[jersey].jpg');
});

test('4.1 with one shop, that shop is the one collected from', async () => {
  const answer = ok(await post(south, '/basket', { lines: [] }));
  assert.equal(typeof answer.shop?.id, 'number');
});

test('4.1 fewer left at the chosen shop changes the line to what is left and says so', async () => {
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.lever, qty: 2 }, { productId: P.pads, qty: 1 }] }));
  const lever = answer.lines.find((l) => l.productId === P.lever);
  assert.equal(lever.qty, 1);
  assert.equal(lever.note, 'Only 1 left at Bolton — we’ve changed it to 1');
  assert.equal(lever.gone, false);
  assert.equal(answer.count, 2);
  assert.equal(answer.totalPence, 4000 + 2800);
  assert.equal(answer.changed, CHANGED);
  assert.equal(answer.blocked, null, 'changed to what is left, so nothing more to sort');
});

test('4.1 a line in stock at no shop says so and holds checkout back', async () => {
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.cable, qty: 1 }, { productId: P.pads, qty: 1 }] }));
  const cable = answer.lines.find((l) => l.productId === P.cable);
  assert.equal(cable.gone, true);
  assert.equal(cable.note, 'No longer in stock at Bolton or [Second site] — remove it to carry on');
  assert.equal(answer.changed, CHANGED);
  assert.equal(answer.blocked, REMOVE_FIRST);
  assert.equal(answer.totalPence, 2800, 'a gone line counts for nothing');
  assert.equal(answer.count, 2, 'on-basket-changed: "2 items" with one line gone');
});

test('4.1 a line in stock only at the other shop says where, and holds checkout back', async () => {
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.tube, qty: 1 }] }));
  assert.equal(answer.lines[0].gone, true);
  assert.equal(answer.lines[0].note, 'Sold out at Bolton — in stock at our [Second site] shop');
  assert.equal(answer.blocked, REMOVE_FIRST);
  const there = ok(await basket({ shop: bury, lines: [{ productId: P.tube, qty: 1 }] }));
  assert.equal(there.lines[0].gone, false);
  assert.deepEqual(there.lines[0].stock, { line: 'ready', shop: '[Second site]', qty: 2 });
});

test('4.1 with two shops and none chosen, the basket says nothing per line and checkout asks for a shop', async () => {
  const answer = ok(await basket({ lines: [{ productId: P.pads, qty: 1 }] }));
  assert.equal(answer.shop, null);
  assert.deepEqual(answer.lines[0].stock, { line: 'none' });
  assert.equal(answer.lines[0].gone, false);
  assert.equal(answer.blocked, null);
  const res = await checkout({ lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey: randomUUID() });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Choose which shop to collect from');
});

test('4.1 a product taken off the website, or another shop’s, is gone and shows none of its details', async () => {
  const theirs = await runWithShop(south.shop.id, () => prepare(
    "INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES ('[s]', '[South product]', 'x', 5, 1, true, 1, now()) RETURNING id"
  ).get());
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.hidden, qty: 1 }, { productId: theirs.id, qty: 1 }] }));
  assert.equal(answer.lines.length, 2);
  for (const line of answer.lines) {
    assert.equal(line.gone, true);
    assert.equal(line.name, null);
    assert.equal(line.pricePence, null);
  }
  assert.ok(!JSON.stringify(answer).includes('[Not online]') && !JSON.stringify(answer).includes('[South product]'));
  assert.equal(answer.blocked, REMOVE_FIRST);
});

test('4.1 a basket that isn’t ids and counts is refused; the same product twice is one line', async () => {
  for (const lines of ['x', [{ productId: 'a', qty: 1 }], [{ productId: P.pads, qty: 0 }], [{ productId: P.pads, qty: 1.5 }], [{ productId: P.pads, qty: 100 }],
    [{ productId: 3_000_000_000, qty: 1 }], Array.from({ length: 51 }, (_, i) => ({ productId: i + 1, qty: 1 }))]) {
    const res = await basket({ shop: bolton, lines });
    assert.equal(res.status, 400, JSON.stringify(lines).slice(0, 40));
  }
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }, { productId: P.pads, qty: 2 }] }));
  assert.equal(answer.lines.length, 1);
  assert.equal(answer.lines[0].qty, 3);
  const capped = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 60 }, { productId: P.pads, qty: 60 }] }));
  assert.equal(capped.lines[0].qty, 5, 'merged to 99, then to the 5 left');
  // A shop id too large to be one is no shop, not a server error.
  assert.equal(ok(await basket({ shop: 3_000_000_000, lines: [] })).shop, null);
});

test('4.1 a basket too large, or not JSON, is refused in words', async () => {
  const big = await basket(null, { raw: JSON.stringify({ shop: bolton, lines: [], pad: 'x'.repeat(21_000) }) });
  assert.equal(big.status, 413);
  assert.equal(big.body.error, 'That basket can’t be read');
  const bad = await basket(null, { raw: '{"lines": [' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'That basket can’t be read');
  const list = await checkout(null, { raw: '[]' });
  assert.equal(list.status, 400);
});

// ---- 4.2 Not taking orders ---------------------------------------------------

test('4.2 buying online off, payments not connected, or a Shopify website: not taking online orders', async () => {
  await settings({ buying_online: false });
  try {
    const off = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }));
    assert.equal(off.taking, false);
    assert.equal(off.notTaking, NOT_TAKING);
    const sent = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', requestKey: randomUUID() });
    assert.equal(sent.status, 409);
    assert.equal(sent.body.error, NOT_TAKING);
  } finally { await settings({ buying_online: true }); }

  await connectPayments(north.shop.id, { status: 'failed' });
  try {
    const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }));
    assert.equal(answer.taking, false);
    assert.equal(answer.notTaking, NOT_TAKING);
    const sent = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey: randomUUID() });
    assert.equal(sent.status, 409);
    assert.equal(sent.body.error, NOT_TAKING);
  } finally { await connectPayments(north.shop.id); }

  await inNorth(() => prepare("UPDATE website SET kind = 'shopify'").run());
  try {
    const res = await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'This website isn’t available');
    const sent = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey: randomUUID() });
    assert.equal(sent.status, 404);
  } finally { await inNorth(() => prepare("UPDATE website SET kind = 'wheelhouse'").run()); }

  // South never connected payments.
  const theirs = ok(await post(south, '/basket', { lines: [] }));
  assert.equal(theirs.taking, false);
});

// ---- 4.3 Checkout checks the details -----------------------------------------

test('4.3 checkout answers each box’s message and the count, and makes nothing', async () => {
  const before = await counts();
  const res = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], name: '  ', phone: '07700 900 142', email: 'maya@example', requestKey: randomUUID() });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Check the 2 boxes marked below.');
  assert.deepEqual(res.body.fields, { name: 'Enter your name', email: EMAIL_BAD });
  const one = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, phone: '', requestKey: randomUUID() });
  assert.equal(one.status, 400);
  assert.equal(one.body.error, 'Check the box marked below.');
  assert.deepEqual(one.body.fields, { phone: 'Enter your phone number' });
  const long = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], name: 'x'.repeat(201), phone: '1'.repeat(201), email: `${'x'.repeat(250)}@example.test`, requestKey: randomUUID() });
  assert.deepEqual(long.body.fields, { name: 'That name is too long', phone: 'That phone number is too long', email: EMAIL_BAD });
  // The details first (spec: "Pay SHALL check the details first"), then the basket.
  const both = await checkout({ shop: bolton, lines: [{ productId: P.cable, qty: 1 }], ...guest, name: '', requestKey: randomUUID() });
  assert.equal(both.status, 400);
  assert.deepEqual(both.body.fields, { name: 'Enter your name' });
  assert.deepEqual(await counts(), before);
});

test('4.3 checkout prices and checks stock again: a changed basket is sent back, and nothing is made', async () => {
  const before = await counts();
  const res = await checkout({ shop: bolton, lines: [{ productId: P.cable, qty: 1 }], ...guest, requestKey: randomUUID() });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, CHANGED);
  assert.equal(res.body.basket.blocked, REMOVE_FIRST);
  const fewer = await checkout({ shop: bolton, lines: [{ productId: P.lever, qty: 3 }], ...guest, requestKey: randomUUID() });
  assert.equal(fewer.status, 409, 'what the customer saw is not what they would pay for');
  assert.equal(fewer.body.basket.lines[0].qty, 1);
  const empty = await checkout({ shop: bolton, lines: [], ...guest, requestKey: randomUUID() });
  assert.equal(empty.status, 400);
  const noKey = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest });
  assert.equal(noKey.status, 400);
  assert.deepEqual(await counts(), before);
});

test('4.3 a name or phone longer than an order keeps is refused by its box, before anything is made', async () => {
  const before = await counts();
  const res = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, name: 'x'.repeat(61), phone: '1'.repeat(61), requestKey: randomUUID() });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body.fields, { name: 'That name is too long', phone: 'That phone number is too long' });
  assert.deepEqual(await counts(), before);
});

// ---- 4.5 Checkout makes the order and its held payment ----------------------

const creditOn = () => inNorth(() => prepare('INSERT INTO payment_settings (store_credit_on) VALUES (true) ON CONFLICT (shop_id) DO UPDATE SET store_credit_on = true RETURNING shop_id').run());
const orderOf = (ref) => inNorth(async () => {
  const order = await prepare('SELECT * FROM online_orders WHERE order_code = ?').get(ref);
  return order && {
    order,
    lines: await prepare('SELECT product_id, qty, unit_pence FROM online_order_lines WHERE order_id = ? ORDER BY id').all(order.id),
    payments: await prepare('SELECT * FROM online_payments WHERE online_order_id = ?').all(order.id),
    customer: order.customer_id && await prepare('SELECT id, name, phone FROM customers WHERE id = ?').get(order.customer_id),
  };
});

test('4.5 checkout makes one order at awaiting_payment, its lines at today’s price, a new customer for a guest, and the card part held', async () => {
  const before = await counts();
  const answer = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 2 }, { productId: P.jersey, qty: 1 }], ...guest, requestKey: randomUUID() }));
  assert.equal(typeof answer.ref, 'string');
  assert.ok(answer.ref.length >= 32, 'the order’s private link can’t be guessed');
  assert.equal(answer.totalPence, 10600);
  assert.equal(answer.creditPence, 0);
  assert.equal(answer.cardPence, 10600);
  assert.equal(answer.payment.provider, 'pretend');
  assert.match(answer.payment.ref, /^pretend_/);
  assert.ok(!('customer' in answer) && !('id' in answer));
  assert.deepEqual(await counts(), { orders: before.orders + 1, payments: before.payments + 1, customers: before.customers + 1 });

  const { order, lines, payments, customer } = await orderOf(answer.ref);
  assert.equal(order.stage, 'awaiting_payment');
  assert.equal(order.number, null, 'the number is given when it’s paid');
  assert.equal(order.paid_at, null);
  assert.equal(order.site_id, bolton);
  assert.deepEqual([order.name, order.email, order.phone], [guest.name, guest.email, guest.phone]);
  assert.deepEqual([order.total_pence, order.credit_pence, order.card_pence], [10600, 0, 10600]);
  assert.deepEqual(lines, [{ product_id: P.pads, qty: 2, unit_pence: 2800 }, { product_id: P.jersey, qty: 1, unit_pence: 5000 }]);
  assert.deepEqual(customer, { id: order.customer_id, name: guest.name, phone: guest.phone });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].purpose, 'order');
  assert.equal(payments[0].status, 'waiting');
  assert.equal(payments[0].amount_pence, 10600);
  assert.equal(payments[0].provider_ref, answer.payment.ref);
  const held = await inNorth(() => prepare('SELECT status, amount_pence FROM pretend_payments WHERE ref = ?').get(answer.payment.ref));
  assert.deepEqual(held, { status: 'waiting', amount_pence: 10600 });
});

test('4.5 Pay sent twice gives the same order and hold; a guest is never matched on typed details', async () => {
  const requestKey = randomUUID();
  const before = await counts();
  const first = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey }));
  const again = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey }));
  assert.deepEqual(again, first);
  assert.deepEqual(await counts(), { orders: before.orders + 1, payments: before.payments + 1, customers: before.customers + 1 });
  const other = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey: randomUUID() }));
  assert.notEqual(other.ref, first.ref);
  const [a, b] = [await orderOf(first.ref), await orderOf(other.ref)];
  assert.notEqual(a.order.customer_id, b.order.customer_id, 'the same typed details make a second customer, never a match');
});

test('4.5 two presses at once make one order and one hold', async () => {
  const requestKey = randomUUID();
  const before = await counts();
  const heldBefore = await inNorth(() => prepare('SELECT count(*)::int AS n FROM pretend_payments').get());
  const body = { shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey };
  const [a, b] = await Promise.all([checkout(body), checkout(body)]);
  assert.deepEqual(ok(a), ok(b));
  assert.deepEqual(await counts(), { orders: before.orders + 1, payments: before.payments + 1, customers: before.customers + 1 });
  const heldAfter = await inNorth(() => prepare('SELECT count(*)::int AS n FROM pretend_payments').get());
  assert.equal(heldAfter.n, heldBefore.n + 1, 'one hold on the card, not two');
});

test('4.5 Pay pressed again after the last one sold at the till still gets its order', async () => {
  await setStock(P.tube, bolton, 1);
  const requestKey = randomUUID();
  const body = { shop: bolton, lines: [{ productId: P.tube, qty: 1 }], ...guest, requestKey };
  const first = ok(await checkout(body));
  await setStock(P.tube, bolton, 0);
  assert.deepEqual(ok(await checkout(body)), first);
});

test('4.5 a request key a deposit already used still makes the order', async () => {
  const requestKey = 'k'.repeat(40);
  const keyHash = createHash('sha256').update(requestKey).digest('hex');
  await inNorth(() => prepare("INSERT INTO online_payments (provider, provider_ref, amount_pence, request_key_hash) VALUES ('pretend', '[deposit ref]', 2000, ?) RETURNING id").get(keyHash));
  const answer = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey }));
  assert.equal(answer.cardPence, 2800);
  assert.equal((await orderOf(answer.ref)).payments.length, 1);
});

test('4.5 a signed-in customer’s order is theirs, with the credit part recorded and only the rest held', async () => {
  await creditOn();
  const maya = await signedIn({ credit: 1000 });
  const before = await counts();
  const answer = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], name: '[typed]', useCredit: true, requestKey: randomUUID() }, { cookie: maya.cookie }));
  assert.deepEqual([answer.totalPence, answer.creditPence, answer.cardPence], [2800, 1000, 1800]);
  assert.deepEqual(await counts(), { orders: before.orders + 1, payments: before.payments + 1, customers: before.customers });
  const { order, payments } = await orderOf(answer.ref);
  assert.equal(order.customer_id, maya.customerId);
  assert.deepEqual([order.name, order.email], ['Maya Patel', maya.email]);
  assert.equal(payments[0].amount_pence, 1800);
  const held = await inNorth(() => prepare('SELECT amount_pence FROM pretend_payments WHERE ref = ?').get(answer.payment.ref));
  assert.equal(held.amount_pence, 1800, 'only the card part is held on the card');
  const balance = await inNorth(() => prepare('SELECT COALESCE(sum(change_pence), 0)::int AS n FROM store_credit_entries WHERE customer_id = ?').get(maya.customerId));
  assert.equal(balance.n, 1000, 'credit is spent when it’s paid, not at checkout');
});

test('4.5 credit that covers it all makes the order with no card payment', async () => {
  await creditOn();
  const maya = await signedIn({ credit: 10000 });
  const before = await counts();
  const answer = ok(await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], useCredit: true, requestKey: randomUUID() }, { cookie: maya.cookie }));
  assert.deepEqual([answer.totalPence, answer.creditPence, answer.cardPence, answer.payment], [2800, 2800, 0, null]);
  assert.deepEqual(await counts(), { ...before, orders: before.orders + 1 });
  const { order, payments } = await orderOf(answer.ref);
  assert.equal(order.stage, 'awaiting_payment');
  assert.equal(payments.length, 0);
});

// ---- 4.4 A signed-in customer -------------------------------------------------

test('4.4 a signed-in customer’s details and store credit come from their account', async () => {
  await inNorth(() => prepare('INSERT INTO payment_settings (store_credit_on) VALUES (true) ON CONFLICT (shop_id) DO UPDATE SET store_credit_on = true RETURNING shop_id').run());
  const maya = await signedIn({ credit: 1000 });
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }, { cookie: maya.cookie }));
  assert.deepEqual(answer.you, { name: 'Maya Patel', email: maya.email, phone: '07700 900 142' });
  assert.ok(!('customer' in answer), 'the customer’s own id stays on the server');
  assert.deepEqual(answer.credit, { availablePence: 1000, usePence: 1000, leftToPayPence: 1800, coversAll: null });
  // Typed details are ignored for her; credit can be left unticked.
  const res = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], name: '', email: 'x', phone: '', useCredit: true, requestKey: randomUUID() }, { cookie: maya.cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.creditPence, 1000);
  assert.equal(res.body.cardPence, 1800);
  assert.ok(!('customer' in res.body));
  const without = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], useCredit: false, requestKey: randomUUID() }, { cookie: maya.cookie });
  assert.equal(without.body.creditPence, 0);
  assert.equal(without.body.cardPence, 2800);
});

test('4.4 credit that covers the whole order says so, and uses only what the order needs', async () => {
  const maya = await signedIn({ credit: 10000 });
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }, { cookie: maya.cookie }));
  assert.deepEqual(answer.credit, { availablePence: 10000, usePence: 2800, leftToPayPence: 0, coversAll: COVERS });
});

test('4.4 no credit offered when the shop has store credit off, or off for online orders, or for another shop’s sign-in', async () => {
  const maya = await signedIn({ credit: 1000 });
  await settings({ store_credit_on: false });
  try {
    const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }, { cookie: maya.cookie }));
    assert.equal(answer.credit, null);
    const res = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], useCredit: true, requestKey: randomUUID() }, { cookie: maya.cookie });
    assert.equal(res.body.creditPence, 0);
  } finally { await settings({ store_credit_on: true }); }
  await inNorth(() => prepare('UPDATE payment_settings SET store_credit_on = false').run());
  try {
    assert.equal(ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }, { cookie: maya.cookie })).credit, null);
  } finally { await inNorth(() => prepare('UPDATE payment_settings SET store_credit_on = true').run()); }
  // Her sign-in is North's: at South she is a guest.
  const there = ok(await post(south, '/basket', { lines: [] }, { cookie: maya.cookie }));
  assert.equal(there.you, null);
  assert.equal(there.credit, null);
});

test('4.4 a guest has no details or credit filled in', async () => {
  const answer = ok(await basket({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }] }));
  assert.equal(answer.you, null);
  assert.equal(answer.credit, null);
});

test('checkout has its own limit per visitor address', async () => {
  const from = nextVisitor();
  let last;
  for (let i = 0; i < 31; i++) last = await checkout({ shop: bolton, lines: [{ productId: P.pads, qty: 1 }], ...guest, requestKey: randomUUID() }, { from });
  assert.equal(last.status, 429);
});
