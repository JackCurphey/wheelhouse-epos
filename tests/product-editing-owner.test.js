// Who adds and changes a product (openspec/changes/product-editing; stock control decision
// 11: "Staff ... can't change prices, edit or add products"). The Owner only, until "Can
// order stock" exists (WP-1.1). Staff still adjust and count stock, and receive deliveries.
// Jack Lewis, Jo Taylor and Shimano brake pads as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const REFUSED = 'Only the shop’s owner can add or change products';
let server;
let owner;
let jo;
let pads;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId), loginId: made.body.loginId };
  pads = (await staffRequest(server.baseUrl, owner.cookie, '/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: 'B05S-RX', category: 'Brakes', price: 28, cost: 14, stockQty: 6 } })).body;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, method = 'GET', body) => staffRequest(server.baseUrl, who.cookie, path, { method, body });
const row = (id) => runWithShop(owner.shop.id, () => prepare('SELECT name, price, cost, active, photo_url FROM products WHERE id = ?').get(id));
const refused = (res, what) => {
  assert.equal(res.status, 403, `${what}: ${JSON.stringify(res.body)}`);
  assert.deepEqual([res.body.error, res.body.code], [REFUSED, 'owner_only'], what);
};

test('staff can’t add a product, change one, its price or cost, take it off sale, or give it a photo', async () => {
  const before = await row(pads.id);
  refused(await as(jo, '/api/products', 'POST', { name: '[Product]', price: 1 }), 'add');
  refused(await as(jo, `/api/products/${pads.id}`, 'PUT', { name: '[Renamed]' }), 'rename');
  refused(await as(jo, `/api/products/${pads.id}`, 'PUT', { pricePence: 100 }), 'price');
  refused(await as(jo, `/api/products/${pads.id}`, 'PUT', { cost: 1 }), 'cost');
  refused(await as(jo, `/api/products/${pads.id}`, 'PUT', { active: true }), 'back on sale');
  refused(await as(jo, `/api/products/${pads.id}`, 'DELETE'), 'off sale');
  refused(await as(jo, `/api/products/${pads.id}/photo`, 'POST', { dataBase64: 'aGk=', contentType: 'image/png' }), 'photo');
  assert.deepEqual(await row(pads.id), before, 'nothing changed');
  assert.equal((await runWithShop(owner.shop.id, () => prepare("SELECT count(*)::int AS n FROM products WHERE name = '[Product]'").get())).n, 0);
});

test('staff can’t bring a supplier’s item in as a product', async () => {
  const item = await runWithShop(owner.shop.id, async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run();
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, '[Catalogue item]', 14, 0, 'new')").run(supplier.lastInsertRowid, `CAT-${randomUUID().slice(0, 6)}`)).lastInsertRowid;
  });
  refused(await as(jo, `/api/catalogue-items/${item}/import`, 'POST', { price: 28, category: 'Brakes' }), 'import');
  assert.equal((await as(owner, `/api/catalogue-items/${item}/import`, 'POST', { price: 28, category: 'Brakes' })).status, 201);
});

test('the Owner’s sign-in with Jo checked in on a till is Jo: refused', async () => {
  const offer = async (cookie) => {
    const o = await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
    assert.equal((await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: o.body.pin } })).status, 200);
    return o.body.pin;
  };
  const pin = await offer(jo.cookie);
  const jar = new Map();
  const send = async (path, method = 'GET', body) => {
    const cookie = [owner.cookie, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) { const [pair] = line.split(';'); const at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const site = (await as(owner, '/api/sites')).body[0];
  assert.equal((await send('/api/till-setup', 'POST', { siteId: site.id, number: 5 })).status, 201);
  // Nobody checked in: it could be anyone, so it asks for a PIN, as changing stock there does.
  const empty = await send(`/api/products/${pads.id}`, 'PUT', { pricePence: 100 });
  assert.deepEqual([empty.status, empty.body.code], [409, 'check_in_first']);
  assert.equal((await send('/api/till-checkin', 'POST', { pin })).status, 201);
  refused(await send(`/api/products/${pads.id}`, 'PUT', { pricePence: 100 }), 'price at a till');
  assert.equal((await row(pads.id)).price, 28, 'nothing changed');
});

test('the Owner adds and changes; staff still adjust and receive, as before', async () => {
  assert.equal((await as(owner, `/api/products/${pads.id}`, 'PUT', { pricePence: 2900 })).status, 200);
  assert.equal((await row(pads.id)).price, 29);
  assert.equal((await as(jo, `/api/products/${pads.id}/stock`, 'POST', { change: -1, type: 'adjustment', reason: 'damaged' })).status, 200);
  const booked = await as(jo, '/api/deliveries/receive', 'POST', { requestKey: randomUUID(), items: [{ productId: pads.id, qty: 2 }] });
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
});
