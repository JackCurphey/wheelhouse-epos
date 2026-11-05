// Stock per shop through the routes (openspec/changes/stock-per-shop): a count belongs to
// the shop it was started at, Adjust works on this shop's figure, a product's page says
// each shop's, and every writer lands on the right shop. North Street Cycles, Jack Lewis,
// Jo Taylor and Shimano brake pads as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { moveStock } from '../server/lib/stock.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { registerTill, tillRequest } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let first;
let second;
let jo;
let till;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  first = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites')).body[0];
  second = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } })).body;
  till = await registerTill(server.baseUrl, owner, { siteCode: 'S' });
  owner.pin = await withPin(owner.cookie);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const { rows: [{ employee_id: employeeId }] } = await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId]);
  jo = { employeeId, cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);
async function withPin(cookie) {
  const offer = await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.equal((await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status, 200);
  return offer.body.pin;
}
function browser(signIn) {
  const jar = new Map();
  return async function send(path, { method = 'GET', body } = {}) {
    const cookie = [signIn, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}
const POST = (body = {}) => ({ method: 'POST', body });
let tills = 10;
async function tillAtSecond() {
  const send = browser(await staffFreshCookie(owner.loginId));
  tills += 1;
  const made = await send('/api/till-setup', POST({ siteId: second.id, number: tills }));
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal((await send('/api/till-checkin', POST({ pin: owner.pin }))).status, 201);
  return send;
}
const office = () => browser(owner.cookie);
let n = 0;
// A product with this much at the first shop and at the second.
const product = (atFirst, atSecond = 0) => inShop(async () => {
  n += 1;
  const id = (await prepare("INSERT INTO products (sku, name, category, price, cost, updated_at) VALUES (?, 'Shimano brake pads', '[Category]', 28, 14, now())").run(`B05S-RX-${n}`)).lastInsertRowid;
  await dbExec('BEGIN');
  if (atFirst) await moveStock([{ productId: id, change: atFirst, type: 'intake' }], { siteId: first.id });
  if (atSecond) await moveStock([{ productId: id, change: atSecond, type: 'intake' }], { siteId: second.id });
  await dbExec('COMMIT');
  return id;
});
const figures = (id) => inShop(async () => ({
  total: (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty,
  first: (await prepare('SELECT qty FROM product_stock WHERE product_id = ? AND site_id = ?').get(id, first.id))?.qty ?? 0,
  second: (await prepare('SELECT qty FROM product_stock WHERE product_id = ? AND site_id = ?').get(id, second.id))?.qty ?? 0,
}));
const newestLine = (id) => inShop(() => prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(id));
async function startArea(send) {
  n += 1;
  const started = await send('/api/stock-takes', POST({ kind: 'area', target: `[Area ${n}]` }));
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal((await send(`/api/stock-takes/${started.body.id}/join`, POST())).status, 200);
  return started.body.id;
}
const count = (send, take, productId, qty) => send(`/api/stock-takes/${take}/counts`, POST({ productId, qty }));

// ---- A count ----

test('a count started at a till is that shop’s: expected, Apply and Undo leave the other shop alone', async () => {
  const id = await product(5, 3);
  const send = await tillAtSecond();
  const take = await startArea(send);
  assert.equal((await count(send, take, id, 2)).status, 200);
  const check = await send(`/api/stock-takes/${take}/check`);
  assert.equal(check.status, 200, JSON.stringify(check.body));
  assert.deepEqual(check.body.rows.map((r) => [r.expected, r.counted, r.difference]), [[3, 2, -1]]);
  assert.equal((await send(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 7, first: 5, second: 2 });
  assert.equal((await newestLine(id)).site_id, second.id);
  assert.equal((await send(`/api/stock-takes/${take}/undo`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 8, first: 5, second: 3 });
  assert.equal((await newestLine(id)).site_id, second.id);
});

test('a count started on an ordinary browser is the oldest shop’s, wherever it’s applied from', async () => {
  const id = await product(5, 3);
  const send = office();
  const take = await startArea(send);
  assert.equal((await count(send, take, id, 4)).status, 200);
  const elsewhere = await tillAtSecond();
  assert.equal((await elsewhere(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 7, first: 4, second: 3 });
  assert.equal((await newestLine(id)).site_id, first.id);
  assert.equal((await elsewhere(`/api/stock-takes/${take}/undo`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 8, first: 5, second: 3 });
  assert.equal((await newestLine(id)).site_id, first.id);
});

test('what moved during a count is allowed for only if it moved at that shop', async () => {
  const id = await product(5, 3);
  const send = office();
  const take = await startArea(send);
  assert.equal((await count(send, take, id, 4)).status, 200);
  const elsewhere = await tillAtSecond();
  // Gone at the other shop after the count: nothing to do with what was counted here.
  assert.equal((await elsewhere(`/api/products/${id}/stock`, POST({ change: -1, type: 'adjustment', reason: 'damaged' }))).status, 200);
  let check = await send(`/api/stock-takes/${take}/check`);
  assert.deepEqual(check.body.rows.map((r) => [r.expected, r.counted, r.difference, r.allowedFor]), [[5, 4, -1, []]]);
  // Gone here after the count: allowed for.
  assert.equal((await send(`/api/products/${id}/stock`, POST({ change: -2, type: 'adjustment', reason: 'damaged' }))).status, 200);
  check = await send(`/api/stock-takes/${take}/check`);
  assert.deepEqual(check.body.rows.map((r) => [r.expected, r.counted, r.difference, r.allowedFor]), [[5, 4, -1, [{ kind: 'adjusted', change: -2 }]]]);
  assert.equal((await send(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 4, first: 2, second: 2 });
});

test('what nobody counted is expected at that shop, and Count them as none leaves the other', async () => {
  const send = await tillAtSecond();
  // Its own category, so the count covers only this.
  const id = await product(5, 3);
  n += 1;
  const category = `[Category ${n}]`;
  await inShop(() => prepare('UPDATE products SET category = ? WHERE id = ?').run(category, id));
  const started = await send('/api/stock-takes', POST({ kind: 'category', target: category }));
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const take = started.body.id;
  assert.equal((await send(`/api/stock-takes/${take}/join`, POST())).status, 200);
  const check = await send(`/api/stock-takes/${take}/check`);
  assert.deepEqual([check.body.notCounted.products, check.body.notCounted.expected], [1, 3]);
  assert.equal((await send(`/api/stock-takes/${take}/none`, POST())).status, 200);
  assert.equal((await send(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  assert.deepEqual(await figures(id), { total: 5, first: 5, second: 0 });
});

// ---- Adjust ----

test('Adjust works on this shop’s figure: nothing here can’t go down, whatever the other shop has', async () => {
  const id = await product(5);
  const send = await tillAtSecond();
  const refused = await send(`/api/products/${id}/stock`, POST({ change: -1, type: 'adjustment', reason: 'damaged' }));
  assert.equal(refused.status, 400, JSON.stringify(refused.body));
  assert.equal(refused.body.error, 'Stock cannot go below zero');
  assert.deepEqual(await figures(id), { total: 5, first: 5, second: 0 });
  assert.equal((await send(`/api/products/${id}/stock`, POST({ change: 2, type: 'adjustment', reason: 'found' }))).status, 200);
  assert.equal((await send(`/api/products/${id}/stock`, POST({ change: -2, type: 'adjustment', reason: 'damaged' }))).status, 200);
  assert.deepEqual(await figures(id), { total: 5, first: 5, second: 0 });
  assert.equal((await office()(`/api/products/${id}/stock`, POST({ change: -5, type: 'adjustment', reason: 'damaged' }))).status, 200);
  assert.deepEqual(await figures(id), { total: 0, first: 0, second: 0 });
});

// ---- A product's page ----

test('a product’s page says each shop’s stock, oldest first, and which is here', async () => {
  const id = await product(5);
  const page = await office()(`/api/products/${id}`);
  assert.deepEqual(page.body.stockAtShops, [
    { id: first.id, name: first.name, qty: 5, here: true },
    { id: second.id, name: '[Second site]', qty: 0, here: false },
  ]);
  assert.equal(page.body.stockQty, 5, 'the total stays');
  const atTill = await (await tillAtSecond())(`/api/products/${id}`);
  assert.deepEqual(atTill.body.stockAtShops.map((s) => [s.qty, s.here]), [[5, false], [0, true]]);
});

test('staff see each shop’s count too; another business doesn’t find the product', async () => {
  const id = await product(5, 3);
  const asJo = await staffRequest(server.baseUrl, jo.cookie, `/api/products/${id}`);
  assert.deepEqual(asJo.body.stockAtShops.map((s) => s.qty), [5, 3]);
  assert.ok(asJo.body.costPence === null || asJo.body.costPence === undefined, 'still no cost');
  assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/products/${id}`)).status, 404);
});

// ---- Each writer lands on the right shop ----

test('the old till’s sale at a till is that shop’s, and goes through on the total as it always has', async () => {
  const id = await product(5);
  const send = await tillAtSecond();
  const sold = await send('/api/sales', POST({ items: [{ productId: id, qty: 1 }], cardAmount: 28, cashierId: jo.employeeId }));
  assert.equal(sold.status, 201, JSON.stringify(sold.body));
  assert.deepEqual(await figures(id), { total: 4, first: 5, second: -1 });
});

test('the till’s sync is the till’s shop', async () => {
  const id = await product(5, 3);
  const res = await tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { pendingCount: 0, items: [{
    kind: 'sale', clientId: randomUUID(), receiptNumber: 1, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: true,
    lines: [{ productId: id, description: 'Shimano brake pads', qty: 1, unitPricePence: 2800, vatRateBp: 2000 }],
    payments: [{ method: 'cash', amountPence: 2800 }],
  }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await figures(id), { total: 7, first: 5, second: 2 });
});

test('adding a product with stock on an ordinary browser is the oldest shop’s, at a till that shop’s', async () => {
  const add = async (send) => {
    n += 1;
    const made = await send('/api/products', POST({ name: 'Shimano brake pads', sku: `ADD-${n}`, category: '[Category]', stockQty: 4, price: 28 }));
    assert.equal(made.status, 201, JSON.stringify(made.body));
    return made.body.id;
  };
  assert.deepEqual(await figures(await add(office())), { total: 4, first: 4, second: 0 });
  assert.deepEqual(await figures(await add(await tillAtSecond())), { total: 4, first: 0, second: 4 });
});

test('a delivery booked in at a till is that shop’s', async () => {
  const id = await product(1);
  const send = await tillAtSecond();
  const booked = await send('/api/deliveries/receive', POST({ requestKey: randomUUID(), items: [{ productId: id, qty: 2 }] }));
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
  assert.deepEqual(await figures(id), { total: 3, first: 1, second: 2 });
});
