// The review of delivery-booked-in (openspec/changes/delivery-booked-in, design
// 5 to 8): who a delivery names on a shared computer; Book in sent twice with
// one request key; order costs hidden from anyone but the Owner on the server
// (Reports decisions 5 and 9); what old deliveries show after a rename; and a
// failure part-way through booking in. The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
const shops = [];
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const inShop = (owner, fn) => runWithShop(owner.shop.id, fn);

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  owner.supplierId = await inShop(owner, async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid);
  return owner;
}
async function withPin(cookie) {
  const offer = await post(cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return offer.body.pin;
}
async function member(owner, name) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  return { cookie, pin: await withPin(cookie), loginId: made.body.loginId, employeeId: made.body.id ?? made.body.employeeId };
}
// A browser of its own, signed in as the Owner, keeping the cookies it's given.
function browser(owner) {
  const jar = new Map();
  let own = null;
  async function send(path, { method = 'GET', body } = {}) {
    own ??= await staffFreshCookie(owner.loginId);
    const cookie = [own, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, {
      method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  return { send, post: (path, b) => send(path, { method: 'POST', body: b }) };
}
const workshopComputer = async (owner) => {
  const b = browser(owner);
  assert.equal((await b.post('/api/till-setup/workshop', { siteId: owner.site.id, name: '' })).status, 201);
  return b;
};
const till = async (owner, number) => {
  const b = browser(owner);
  assert.equal((await b.post('/api/till-setup', { siteId: owner.site.id, number })).status, 201);
  return b;
};
const product = (owner, { name = '[Product]', cost = 12.5 } = {}) => inShop(owner, async () => {
  const sku = `[Supplier code]-${randomUUID().slice(0, 6)}`;
  return { id: (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, ?, 0, now())').run(sku, name, 'Parts', cost)).lastInsertRowid, sku };
});
async function order(owner, productId, qty = 4) {
  const made = await post(owner.cookie, '/api/purchase-orders', { supplierId: owner.supplierId, items: [{ productId, qty, unitCost: 19.99 }] });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const ordered = await post(owner.cookie, `/api/purchase-orders/${made.body.id}/mark-ordered`, {});
  assert.equal(ordered.status, 200);
  return ordered.body;
}
const stockOf = (owner, id) => inShop(owner, async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const deliveriesOf = (owner) => inShop(owner, async () => (await prepare('SELECT count(*) AS n FROM deliveries').get()).n);
const newKey = () => randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '').slice(0, 8);

// ---- 1. Who booked it in ----

test('a workshop computer signed in as the Owner: Jo checks in by PIN, and the delivery reads Jo Taylor', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const b = await workshopComputer(owner);
  assert.equal((await b.post('/api/till-checkin', { pin: jo.pin })).status, 201);
  const thing = await product(owner);
  const res = await b.post('/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const read = await call(owner.cookie, `/api/deliveries/booked-in/${res.body.deliveryId}`);
  assert.equal(read.body.bookedBy, 'Jo Taylor');
  assert.equal((await call(owner.cookie, '/api/deliveries')).body.deliveries[0].bookedBy, 'Jo Taylor');
  const row = await inShop(owner, () => prepare('SELECT booked_by_employee_id, booked_by_name FROM deliveries WHERE id = ?').get(res.body.deliveryId));
  assert.equal(row.booked_by_name, 'Jo Taylor');
  const jos = await inShop(owner, () => prepare('SELECT employee_id FROM logins WHERE id = ?').get(jo.loginId));
  assert.equal(row.booked_by_employee_id, jos.employee_id);
});

test('the old app’s order route names the person checked in too', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const b = await workshopComputer(owner);
  assert.equal((await b.post('/api/till-checkin', { pin: jo.pin })).status, 201);
  const thing = await product(owner);
  const o = await order(owner, thing.id, 2);
  assert.equal((await b.post(`/api/purchase-orders/${o.id}/receive`, { items: [{ itemId: o.items[0].id, qtyReceived: 1 }] })).status, 200);
  const list = (await call(owner.cookie, '/api/deliveries')).body.deliveries;
  assert.equal(list[0].bookedBy, 'Jo Taylor');
});

test('a till signed in as the Owner: the person checked in is named', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const b = await till(owner, 1);
  assert.equal((await b.post('/api/till-checkin', { pin: jo.pin })).status, 201);
  const thing = await product(owner);
  const res = await b.post('/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await call(owner.cookie, `/api/deliveries/booked-in/${res.body.deliveryId}`)).body.bookedBy, 'Jo Taylor');
});

for (const [where, make] of [['a workshop computer', workshopComputer], ['a till', (o) => till(o, 1)]]) {
  test(`${where} with nobody checked in books nothing in: it would name the wrong person`, async () => {
    const owner = await shop();
    const b = await make(owner);
    const thing = await product(owner);
    const res = await b.post('/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
    assert.deepEqual([res.status, res.body.code], [409, 'check_in_first']);
    assert.equal(await stockOf(owner, thing.id), 0);
    assert.equal(await deliveriesOf(owner), 0);
  });
}

test('an ordinary browser with nobody checked in names the sign-in’s person', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const thing = await product(owner);
  const asOwner = await post(owner.cookie, '/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  assert.equal((await call(owner.cookie, `/api/deliveries/booked-in/${asOwner.body.deliveryId}`)).body.bookedBy, 'Jack Lewis');
  const asJo = await post(jo.cookie, '/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  assert.equal(asJo.status, 200, JSON.stringify(asJo.body));
  const read = await call(owner.cookie, `/api/deliveries/booked-in/${asJo.body.deliveryId}`);
  assert.equal(read.body.bookedBy, 'Jo Taylor');
});

test('a person deleted later: the delivery keeps their name, and the delete goes through', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const thing = await product(owner);
  const res = await post(jo.cookie, '/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  const row = await inShop(owner, () => prepare('SELECT booked_by_employee_id AS id FROM deliveries WHERE id = ?').get(res.body.deliveryId));
  assert.ok(row.id);
  await inShop(owner, async () => {
    await prepare('UPDATE logins SET employee_id = NULL WHERE employee_id = ?').run(row.id);
    await prepare('DELETE FROM pin_checkins WHERE employee_id = ?').run(row.id);
    await prepare('DELETE FROM employees WHERE id = ?').run(row.id);
  });
  const after = await inShop(owner, () => prepare('SELECT booked_by_employee_id, booked_by_name FROM deliveries WHERE id = ?').get(res.body.deliveryId));
  assert.deepEqual(after, { booked_by_employee_id: null, booked_by_name: 'Jo Taylor' });
  assert.equal((await call(owner.cookie, `/api/deliveries/booked-in/${res.body.deliveryId}`)).body.bookedBy, 'Jo Taylor');
});

// ---- 2. The request key ----

test('Book in sent twice with one key, a line not on an order: stock rises once, one delivery, the same answer', async () => {
  const owner = await shop();
  const thing = await product(owner);
  const body = { requestKey: newKey(), supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 2 }] };
  const first = await post(owner.cookie, '/api/deliveries/receive', body);
  const second = await post(owner.cookie, '/api/deliveries/receive', body);
  assert.deepEqual([first.status, second.status], [200, 200], JSON.stringify(second.body));
  assert.equal(second.body.deliveryId, first.body.deliveryId);
  assert.equal(second.body.booked, 2);
  assert.equal(await stockOf(owner, thing.id), 2);
  assert.equal(await deliveriesOf(owner), 1);
  const moves = await inShop(owner, () => prepare('SELECT count(*) AS n FROM stock_movements WHERE product_id = ?').get(thing.id));
  assert.equal(moves.n, 1);
});

test('Book in sent twice with one key, a part-delivered order: stock and the order move once', async () => {
  const owner = await shop();
  const thing = await product(owner);
  const o = await order(owner, thing.id, 4);
  await post(owner.cookie, '/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: o.items[0].id, qty: 1 }] });
  const body = { requestKey: newKey(), supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: o.items[0].id, qty: 1 }], problems: [{ itemId: o.items[0].id, kind: 'damaged', qty: 1, note: '' }] };
  const first = await post(owner.cookie, '/api/deliveries/receive', body);
  const second = await post(owner.cookie, '/api/deliveries/receive', body);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.deliveryId, first.body.deliveryId);
  assert.deepEqual(second.body.orders.map((x) => [x.id, x.items[0].qtyReceived, x.items[0].outstanding]), [[o.id, 2, 1]]);
  assert.equal(await stockOf(owner, thing.id), 2);
  assert.equal(await deliveriesOf(owner), 2);
  const problems = await inShop(owner, () => prepare('SELECT count(*) AS n FROM delivery_problems WHERE product_id = ?').get(thing.id));
  assert.equal(problems.n, 1);
});

test('the same key at the same moment, for the last one on an order: both answered with the one delivery', async () => {
  const owner = await shop();
  const thing = await product(owner);
  const o = await order(owner, thing.id, 1);
  const body = { requestKey: newKey(), supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: o.items[0].id, qty: 1 }] };
  const both = await Promise.all([post(owner.cookie, '/api/deliveries/receive', body), post(owner.cookie, '/api/deliveries/receive', body)]);
  assert.deepEqual(both.map((r) => r.status), [200, 200], JSON.stringify(both.map((r) => r.body)));
  assert.equal(both[0].body.deliveryId, both[1].body.deliveryId);
  assert.equal(await stockOf(owner, thing.id), 1);
  assert.equal(await deliveriesOf(owner), 1);
});

test('a key sent with other items is refused and changes nothing; a bad key is refused; a refused booking leaves its key free', async () => {
  const owner = await shop();
  const thing = await product(owner);
  const requestKey = newKey();
  await post(owner.cookie, '/api/deliveries/receive', { requestKey, supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] });
  const other = await post(owner.cookie, '/api/deliveries/receive', { requestKey, supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 5 }] });
  assert.deepEqual([other.status, other.body.code], [409, 'reused_key']);
  assert.equal(await stockOf(owner, thing.id), 1);
  assert.equal((await post(owner.cookie, '/api/deliveries/receive', { requestKey: 'short', supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 1 }] })).status, 400);
  assert.equal(await stockOf(owner, thing.id), 1);

  const o = await order(owner, thing.id, 1);
  const again = newKey();
  const refused = await post(owner.cookie, '/api/deliveries/receive', { requestKey: again, supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: o.items[0].id, qty: 2 }] });
  assert.equal(refused.status, 400);
  const fixed = await post(owner.cookie, '/api/deliveries/receive', { requestKey: again, supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: o.items[0].id, qty: 1 }] });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
});

// ---- 4. Costs ----

const hasCosts = (body) => /cost/i.test(JSON.stringify(body));
async function readsOrderCosts(send, orderId, thing, owner) {
  const list = await send('GET', '/api/purchase-orders');
  const one = await send('GET', `/api/purchase-orders/${orderId}`);
  const booked = await send('POST', '/api/deliveries/receive', { supplierId: owner.supplierId, items: [{ productId: thing.id, itemId: list.body.find((o) => o.id === orderId).items[0].id, qty: 1 }] });
  const old = await send('POST', `/api/purchase-orders/${orderId}/receive`, { items: [{ itemId: one.body.items[0].id, qtyReceived: 1 }] });
  const delivery = await send('GET', `/api/deliveries/booked-in/${booked.body.deliveryId}`);
  for (const r of [list, one, booked, old, delivery]) assert.equal(r.status, 200, JSON.stringify(r.body));
  return { list: hasCosts(list.body), one: hasCosts(one.body), booked: hasCosts(booked.body), old: hasCosts(old.body), delivery: hasCosts(delivery.body), body: one.body };
}
const NONE = { list: false, one: false, booked: false, old: false, delivery: false };
const ALL = { list: true, one: true, booked: true, old: true, delivery: true };
const flags = ({ body, ...f }) => f; // eslint-disable-line no-unused-vars

test('order costs: the Owner on their own browser gets them, staff don’t, on every route', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const thing = await product(owner);
  const o = await order(owner, thing.id, 10);
  const asOwner = await readsOrderCosts((m, p, body) => call(owner.cookie, p, m === 'POST' ? { method: 'POST', body } : undefined), o.id, thing, owner);
  assert.deepEqual(flags(asOwner), ALL);
  assert.equal(asOwner.body.items[0].unitCost, 19.99);
  assert.equal(asOwner.body.totalCost, 199.9);
  const asJo = await readsOrderCosts((m, p, body) => call(jo.cookie, p, m === 'POST' ? { method: 'POST', body } : undefined), o.id, thing, owner);
  assert.deepEqual(flags(asJo), NONE);
  // What Receive a delivery needs is still there without them.
  assert.equal(asJo.body.items[0].name, '[Product]');
  assert.equal(asJo.body.items[0].qtyOrdered, 10);
  assert.ok(Number.isInteger(asJo.body.items[0].outstanding));
});

test('order costs on a workshop computer signed in as the Owner: only with the Owner checked in', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const ownerPin = await withPin(owner.cookie);
  const thing = await product(owner);
  const o = await order(owner, thing.id, 10);
  const b = await workshopComputer(owner);
  const send = (m, p, body) => b.send(p, m === 'POST' ? { method: 'POST', body } : {});

  // Nobody checked in: nothing about costs, and no booking in either.
  assert.ok(!hasCosts((await send('GET', '/api/purchase-orders')).body));
  assert.ok(!hasCosts((await send('GET', `/api/purchase-orders/${o.id}`)).body));

  assert.equal((await b.post('/api/till-checkin', { pin: jo.pin })).status, 201);
  assert.deepEqual(flags(await readsOrderCosts(send, o.id, thing, owner)), NONE);
  assert.equal((await b.post('/api/till-checkin/end', {})).status, 200);

  assert.equal((await b.post('/api/till-checkin', { pin: ownerPin })).status, 201);
  assert.deepEqual(flags(await readsOrderCosts(send, o.id, thing, owner)), ALL);
});

test('order costs on a till signed in as the Owner: a staff member checked in doesn’t get them', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const thing = await product(owner);
  const o = await order(owner, thing.id, 10);
  const b = await till(owner, 1);
  const send = (m, p, body) => b.send(p, m === 'POST' ? { method: 'POST', body } : {});
  assert.equal((await b.post('/api/till-checkin', { pin: jo.pin })).status, 201);
  assert.deepEqual(flags(await readsOrderCosts(send, o.id, thing, owner)), NONE);
});

// ---- 5. Renames ----

test('a product and a supplier renamed later: an old delivery still shows what they were called', async () => {
  const owner = await shop();
  const thing = await product(owner, { name: 'Shimano brake pads' });
  const res = await post(owner.cookie, '/api/deliveries/receive', {
    supplierId: owner.supplierId, items: [{ productId: thing.id, qty: 2 }], problems: [{ productId: thing.id, kind: 'damaged', qty: 1, note: '' }],
  });
  await inShop(owner, async () => {
    await prepare("UPDATE products SET name = '[Renamed]', sku = '[Renamed code]' WHERE id = ?").run(thing.id);
    await prepare("UPDATE suppliers SET name = '[Renamed supplier]' WHERE id = ?").run(owner.supplierId);
  });
  const { body } = await call(owner.cookie, `/api/deliveries/booked-in/${res.body.deliveryId}`);
  assert.equal(body.supplierName, '[Supplier]');
  assert.deepEqual([body.lines[0].name, body.lines[0].sku], ['Shimano brake pads', thing.sku]);
  assert.equal(body.setAside[0].name, 'Shimano brake pads');
  assert.equal((await call(owner.cookie, '/api/deliveries')).body.deliveries[0].supplierName, '[Supplier]');
});

// ---- A failure part-way ----

test('a failure after the stock update takes everything back: stock, order, history and the delivery', async () => {
  const owner = await shop();
  const thing = await product(owner);
  const o = await order(owner, thing.id, 4);
  const marker = `[force failure ${randomUUID().slice(0, 8)}]`;
  // Problems are written after the stock update. This one note, and only this
  // one, fails, so other test files writing to the table aren't touched.
  const fn = `force_fail_${randomUUID().replaceAll('-', '')}`;
  await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger AS $$ BEGIN IF NEW.note = '${marker}' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await pool.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON delivery_problems FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const res = await post(owner.cookie, '/api/deliveries/receive', {
      supplierId: owner.supplierId,
      items: [{ productId: thing.id, itemId: o.items[0].id, qty: 2 }],
      problems: [{ itemId: o.items[0].id, kind: 'damaged', qty: 1, note: marker }],
    });
    assert.equal(res.status, 500, JSON.stringify(res.body));
  } finally {
    await pool.query(`DROP TRIGGER ${fn} ON delivery_problems`);
    await pool.query(`DROP FUNCTION ${fn}()`);
  }
  assert.equal(await stockOf(owner, thing.id), 0);
  assert.equal(await deliveriesOf(owner), 0);
  await inShop(owner, async () => {
    assert.equal((await prepare('SELECT count(*) AS n FROM delivery_lines').get()).n, 0);
    assert.equal((await prepare('SELECT count(*) AS n FROM stock_movements WHERE product_id = ?').get(thing.id)).n, 0);
    assert.equal((await prepare('SELECT qty_received FROM purchase_order_items WHERE id = ?').get(o.items[0].id)).qty_received, 0);
    assert.equal((await prepare('SELECT status FROM purchase_orders WHERE id = ?').get(o.id)).status, 'ordered');
  });
});
