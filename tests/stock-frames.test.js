// Bike frame numbers on stock (openspec/changes/frame-numbers; rs-frame, rs-frame-dup,
// rs-receive-marked, st-product-bike, st-list; receiving decision 5, stock control decision 3):
// booking a bike in records each frame number; one already in stock is refused; a bike's page
// and Stock read them. Real example data from the drawings: the Trek Domane AL 3. Frame numbers
// and everything else are bracketed placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { isBike } from '../server/lib/bikes.js';

let server;
let owner;
let other;
let jo;
let supplierId;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
const inShop = (fn, shop = owner.shop) => runWithShop(shop.id, fn);
const deliver = (body, as = asJo) => as('/api/deliveries/receive', { method: 'POST', body });
const frame = () => `[frame ${randomUUID().slice(0, 8)}]`;

async function bike({ name = 'Trek Domane AL 3', category = 'Bikes › Road bikes', shop = owner.shop } = {}) {
  const sku = `[Supplier code]-${randomUUID().slice(0, 6)}`;
  return inShop(async () => (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, 14, 0, now())').run(sku, name, category)).lastInsertRowid, shop);
}
const framesOf = (productId) => inShop(() => prepare(
  'SELECT frame_number, frame_key, state, site_id, delivery_id, delivery_line_id, stock_movement_id, received_by_name, sold_at, customer_id, customer_bike_id FROM stock_frames WHERE product_id = ? ORDER BY id'
).all(productId));
const stockOf = async (id) => (await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(id))).stock_qty;

test('which categories are bikes', () => {
  for (const c of ['Bikes', 'bikes', 'Road bikes', 'Bikes › E-bikes', 'Kids’ bikes', 'Bike', 'Second-hand › Mountain bikes']) assert.equal(isBike(c), true, c);
  for (const c of ['Bike parts', 'Bike lights', 'Parts', 'Uncategorised', '', null, 'Drivetrain › Derailleurs', 'Bikesheds']) assert.equal(isBike(c), false, String(c));
});

test('a product says whether it is a bike', async () => {
  const b = await bike();
  assert.equal((await asJo(`/api/products/${b}`)).body.isBike, true);
  const pads = await bike({ name: 'Shimano brake pads', category: 'Brakes' });
  assert.equal((await asJo(`/api/products/${pads}`)).body.isBike, false);
});

test('booking in three bikes records each frame, in stock, at the shop, with the delivery, the line and who', async () => {
  const b = await bike();
  const frames = [frame(), frame(), frame()];
  const res = await deliver({ supplierId, items: [{ productId: b, qty: 3, frames }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(b), 3);
  const rows = await framesOf(b);
  assert.deepEqual(rows.map((r) => r.frame_number), frames);
  const line = await inShop(() => prepare('SELECT id FROM delivery_lines WHERE delivery_id = ? AND product_id = ?').get(res.body.deliveryId, b));
  const move = await inShop(() => prepare('SELECT id, site_id FROM stock_movements WHERE product_id = ?').get(b));
  for (const r of rows) {
    assert.deepEqual({ state: r.state, delivery: r.delivery_id, line: r.delivery_line_id, move: r.stock_movement_id, site: r.site_id, who: r.received_by_name, sold: r.sold_at, customer: r.customer_id, bike: r.customer_bike_id },
      { state: 'in_stock', delivery: res.body.deliveryId, line: line.id, move: move.id, site: move.site_id, who: 'Jo Taylor', sold: null, customer: null, bike: null });
  }
});

test('a bike without its frames, too few, or one twice is refused, and nothing is booked in', async () => {
  const b = await bike();
  const one = frame();
  for (const [items, words] of [
    [[{ productId: b, qty: 1 }], 'Each bike needs its frame number: Trek Domane AL 3'],
    [[{ productId: b, qty: 2, frames: [frame()] }], 'Each bike needs its frame number: Trek Domane AL 3'],
    [[{ productId: b, qty: 2, frames: [one, one.toUpperCase()] }], `Frame ${one.toUpperCase()} is in this delivery twice`],
    [[{ productId: b, qty: 1, frames: [''] }], 'A frame number is 1 to 60 characters'],
    [[{ productId: b, qty: 1, frames: ['x'.repeat(61)] }], 'A frame number is 1 to 60 characters'],
  ]) {
    const res = await deliver({ supplierId, items });
    assert.equal(res.status, 400, JSON.stringify(items));
    assert.equal(res.body.error, words);
  }
  assert.equal(await stockOf(b), 0);
  assert.equal((await framesOf(b)).length, 0);
});

test('a frame already in stock is refused with its date, compared without capitals or spaces', async () => {
  const b = await bike();
  const f = frame();
  assert.equal((await deliver({ supplierId, items: [{ productId: b, qty: 1, frames: [f] }] })).status, 200);
  const again = await deliver({ supplierId, items: [{ productId: b, qty: 1, frames: [` ${f.toUpperCase().replace(' ', '  ')} `] }] });
  assert.equal(again.status, 400);
  assert.match(again.body.error, /^Frame .+ is already in stock — booked in \d{1,2} [A-Z][a-z]{2} \d{4}$/);
  assert.equal(await stockOf(b), 1);
  const check = await asJo(`/api/stock-frames/check?number=${encodeURIComponent(f.toUpperCase())}`);
  assert.equal(check.status, 200);
  assert.equal(check.body.inStock.frameNumber, f);
  assert.equal(check.body.inStock.productName, 'Trek Domane AL 3');
  assert.ok(check.body.inStock.bookedInAt);
  assert.deepEqual((await asJo(`/api/stock-frames/check?number=${encodeURIComponent(frame())}`)).body, { inStock: null });
  assert.equal((await asJo('/api/stock-frames/check')).status, 400);
});

test('a product that isn’t a bike can’t have frame numbers', async () => {
  const pads = await bike({ name: 'Shimano brake pads', category: 'Brakes' });
  const res = await deliver({ supplierId, items: [{ productId: pads, qty: 1, frames: [frame()] }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Only a bike has frame numbers');
});

test('two deliveries with the same frame at the same moment: one books it in', async () => {
  const b = await bike();
  const f = frame();
  const both = await Promise.all([1, 2].map(() => deliver({ supplierId, items: [{ productId: b, qty: 1, frames: [f] }] })));
  assert.equal(both.filter((r) => r.status === 200).length, 1, JSON.stringify(both.map((r) => [r.status, r.body])));
  assert.ok(both.some((r) => [400, 409].includes(r.status) && /already in stock/.test(r.body.error)), JSON.stringify(both.map((r) => r.body)));
  assert.equal(await stockOf(b), 1);
  assert.equal((await framesOf(b)).length, 1);
});

test('sent twice with its request key books the frames once', async () => {
  const b = await bike();
  const requestKey = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '').slice(0, 8);
  const body = { requestKey, supplierId, items: [{ productId: b, qty: 1, frames: [frame()] }] };
  assert.equal((await deliver(body)).status, 200);
  assert.equal((await deliver(body)).status, 200);
  assert.equal((await framesOf(b)).length, 1);
});

test('another business’s frames are never seen and never clash', async () => {
  const mine = await bike();
  const theirs = await bike({ shop: other.shop });
  const f = frame();
  const res = await staffRequest(server.baseUrl, other.cookie, '/api/deliveries/receive', { method: 'POST', body: { supplierId: null, items: [{ productId: theirs, qty: 1, frames: [f] }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await asJo(`/api/stock-frames/check?number=${encodeURIComponent(f)}`)).body, { inStock: null });
  assert.equal((await deliver({ supplierId, items: [{ productId: mine, qty: 1, frames: [f] }] })).status, 200);
});

test('a bike’s page lists its frames, and its received line says the delivery and how many frames', async () => {
  const b = await bike();
  const frames = [frame(), frame()];
  const res = await deliver({ supplierId, items: [{ productId: b, qty: 2, frames }] });
  const page = (await asJo(`/api/products/${b}`)).body;
  assert.deepEqual(page.frames.map((f) => [f.frameNumber, f.state, f.supplierName, f.deliveryId]).sort(),
    frames.map((f) => [f, 'in_stock', '[Supplier]', res.body.deliveryId]).sort());
  assert.ok(page.frames.every((f) => f.bookedInAt));
  const received = page.history.find((h) => h.type === 'intake');
  assert.deepEqual([received.delivery, received.frames], [{ id: res.body.deliveryId, supplierName: '[Supplier]' }, 2]);
  const pads = await bike({ name: 'Shimano brake pads', category: 'Brakes' });
  await deliver({ supplierId, items: [{ productId: pads, qty: 1 }] });
  const padsPage = (await asJo(`/api/products/${pads}`)).body;
  assert.equal(padsPage.frames, undefined, 'only a bike has frames');
  assert.deepEqual([padsPage.history[0].delivery?.supplierName, padsPage.history[0].frames], ['[Supplier]', 0]);
});

test('Stock’s row for a bike says how many frames are in stock', async () => {
  const b = await bike({ name: `Trek Domane AL 3 ${randomUUID().slice(0, 4)}` });
  await deliver({ supplierId, items: [{ productId: b, qty: 2, frames: [frame(), frame()] }] });
  const rows = (await asJo(`/api/stock-list?search=${encodeURIComponent('Trek Domane')}`)).body.rows;
  assert.equal(rows.find((r) => r.id === b).framesInStock, 2);
});

test('the old app’s receive route still books a bike in, with no frames', async () => {
  const b = await bike();
  const made = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: [{ productId: b, qty: 1, unitCost: 14 }] } });
  await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, { method: 'POST', body: {} });
  const res = await asOwner(`/api/purchase-orders/${made.body.id}/receive`, { method: 'POST', body: { items: [{ itemId: made.body.items[0].id, qtyReceived: 1 }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(b), 1);
});

test('a bike on an order books in with its frames, and a set-aside one isn’t recorded', async () => {
  const b = await bike();
  const made = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: [{ productId: b, qty: 3, unitCost: 14 }] } });
  const ordered = await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, { method: 'POST', body: {} });
  const itemId = ordered.body.items[0].id;
  const frames = [frame(), frame()];
  const res = await deliver({ supplierId, items: [{ productId: b, itemId, qty: 2, frames }], problems: [{ itemId, kind: 'damaged', qty: 1, note: '' }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(b), 2);
  assert.deepEqual((await framesOf(b)).map((r) => r.frame_number), frames);
});
