// Changing prices in bulk (openspec/changes/bulk-price-change; st-prices, st-prices-done; stock
// control decisions 7 and 11): a preview, the change with each product's history line, and Undo.
// The Owner's, until roles. Real example data from the drawings: Shimano brake pads B05S-RX at
// £28.00. Everything else is a bracketed placeholder; the other figures are worked from £28.00.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { newPrices, roundTo } from '../server/lib/bulk-prices.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
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
const post = (path, body, as = asOwner) => as(path, { method: 'POST', body });

// A product of its own for each test. `price` and `cost` in pounds; cost null for none.
async function product({ name = '[Product]', price = 28, cost = 12.5, vat = 2000, active = 1, shop = owner.shop, groupId = null, size = null } = {}) {
  const sku = `[Supplier code]-${randomUUID().slice(0, 6)}`;
  const id = await inShop(async () => (await prepare(
    'INSERT INTO products (sku, name, category, price, cost, vat_rate_bp, active, group_id, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())'
  ).run(sku, name, 'Parts', price, cost, vat, active, groupId, size)).lastInsertRowid, shop);
  return { id, sku, name };
}
const priceOf = async (id) => Number((await inShop(() => prepare('SELECT price_pence FROM products WHERE id = ?').get(id))).price_pence);
const linesOf = (id) => inShop(() => prepare('SELECT field, was_pence, now_pence, who_name, batch_id FROM product_price_changes WHERE product_id = ? ORDER BY id').all(id));

// ---------- Working prices out (design 2) ----------

test('rounding to .99 takes the nearest, halfway up; .00 the nearest pound; £0.00 stays and nothing else becomes it', () => {
  assert.equal(roundTo(3080, '99'), 3099);
  assert.equal(roundTo(3040, '99'), 2999);
  assert.equal(roundTo(3049, '99'), 3099, 'halfway between £29.99 and £30.99 goes up');
  assert.equal(roundTo(3080, '00'), 3100);
  assert.equal(roundTo(3040, '00'), 3000);
  assert.equal(roundTo(3050, '00'), 3100, 'halfway goes up');
  assert.equal(roundTo(0, '99'), 0);
  assert.equal(roundTo(0, '00'), 0);
  assert.equal(roundTo(10, '99'), 99);
  assert.equal(roundTo(10, '00'), 100);
  assert.equal(roundTo(3080, 'leave'), 3080);
});

test('a percentage, a target margin and a new price for each, worked out from the product', () => {
  const pads = { id: 1, price_pence: 2800, cost_pence: 1250, vat_rate_bp: 2000 };
  const [up] = newPrices([pads], { how: 'percent', value: 10, ending: '99' });
  assert.deepEqual([up.nowPence, up.newPence], [2800, 3099]);
  const [down] = newPrices([pads], { how: 'percent', value: -10, ending: 'leave' });
  assert.equal(down.newPence, 2520);
  // 50% margin before VAT on a £12.50 cost: £25.00 net, £30.00 with VAT at 20%.
  const [margin] = newPrices([pads], { how: 'margin', value: 50, ending: 'leave' });
  assert.equal(margin.newPence, 3000);
  const [noCost] = newPrices([{ ...pads, cost_pence: null }], { how: 'margin', value: 50, ending: '99' });
  assert.deepEqual([noCost.newPence, noCost.noCost], [2800, true]);
  const [zeroCost] = newPrices([{ ...pads, cost_pence: 0 }], { how: 'margin', value: 50, ending: '99' });
  assert.equal(zeroCost.noCost, true, 'a cost of 0 is no cost, as the list counts it');
  const [each] = newPrices([pads], { how: 'each', prices: { 1: 2500 } });
  assert.equal(each.newPence, 2500);
  const [kept] = newPrices([pads], { how: 'each', prices: {} });
  assert.equal(kept.newPence, 2800, 'a product with no new price keeps its own');
  // £14.00 is £11.67 before VAT, under the £12.50 cost.
  const [cheap] = newPrices([pads], { how: 'each', prices: { 1: 1400 } });
  assert.equal(cheap.belowCost, true);
  assert.equal(up.belowCost, false);
});

test('a rule that goes past what a price can be, or isn’t a figure, is refused', () => {
  const pads = { id: 1, name: 'Shimano brake pads', price_pence: 2_000_000_000, cost_pence: 1250, vat_rate_bp: 2000 };
  assert.throws(() => newPrices([pads], { how: 'percent', value: 10, ending: 'leave' }), /Shimano brake pads/);
  assert.throws(() => newPrices([pads], { how: 'percent', value: -100, ending: 'leave' }), /percentage/i);
  assert.throws(() => newPrices([pads], { how: 'percent', value: 10.005, ending: 'leave' }), /percentage/i);
  assert.throws(() => newPrices([pads], { how: 'margin', value: 100, ending: 'leave' }), /margin/i);
  assert.throws(() => newPrices([pads], { how: 'each', prices: { 1: 28.5 } }), /price/i);
  assert.throws(() => newPrices([pads], { how: 'sideways' }), /how/i);
  assert.throws(() => newPrices([pads], { how: 'percent', value: 10, ending: '95' }), /end/i);
});

// ---------- The routes (design 3) ----------

test('the preview shows each product’s new price and changes nothing', async () => {
  const pads = await product({ name: 'Shimano brake pads' });
  const res = await post('/api/stock/prices/preview', { productIds: [pads.id], how: 'percent', value: 10, ending: '99' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.products.length, 1);
  const p = res.body.products[0];
  assert.deepEqual({ id: p.id, name: p.name, sku: p.sku, now: p.nowPence, new: p.newPence, cost: p.costPence, below: p.belowCost },
    { id: pads.id, name: 'Shimano brake pads', sku: pads.sku, now: 2800, new: 3099, cost: 1250, below: false });
  assert.equal(await priceOf(pads.id), 2800);
});

test('a product with sizes ticked as one brings every size; another business’s and an off-sale product are left out', async () => {
  const groupId = await inShop(async () => (await prepare("INSERT INTO product_groups (name, category) VALUES ('[Product with sizes]', 'Parts')").run()).lastInsertRowid);
  const s = await product({ name: '[Product with sizes]', groupId, size: 'S' });
  const m = await product({ name: '[Product with sizes]', groupId, size: 'M' });
  const off = await product({ active: 0 });
  const theirs = await product({ shop: other.shop });
  const res = await post('/api/stock/prices/preview', { productIds: [off.id, theirs.id], groupIds: [groupId], how: 'percent', value: 10, ending: 'leave' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.products.map((p) => [p.id, p.size]).sort(), [[s.id, 'S'], [m.id, 'M']].sort());
  const changed = await post('/api/stock/prices', { productIds: [theirs.id], groupIds: [groupId], how: 'percent', value: 10, ending: 'leave' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.changed, 2);
  assert.equal(await priceOf(theirs.id).catch(() => null), null, 'not even readable from here');
  assert.equal(Number((await runWithShop(other.shop.id, () => prepare('SELECT price_pence FROM products WHERE id = ?').get(theirs.id))).price_pence), 2800);
});

test('the change writes each new price with one history line, the batch and who; an unchanged one writes none', async () => {
  const pads = await product({ name: 'Shimano brake pads' });
  const res = await post('/api/stock/prices', { productIds: [pads.id], how: 'percent', value: 10, ending: '99' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changed, 1);
  assert.equal(await priceOf(pads.id), 3099);
  const lines = await linesOf(pads.id);
  assert.equal(lines.length, 1);
  assert.deepEqual({ ...lines[0], was_pence: Number(lines[0].was_pence), now_pence: Number(lines[0].now_pence) },
    { field: 'price', was_pence: 2800, now_pence: 3099, who_name: 'Jack Lewis', batch_id: res.body.batchId });
  const page = await asOwner(`/api/products/${pads.id}`);
  assert.equal(page.body.history[0].type, 'price_change');
  assert.deepEqual([page.body.history[0].was, page.body.history[0].now], [2800, 3099]);
});

test('one product unchanged in a change of several writes no line for it', async () => {
  const a = await product({ price: 28 });
  const b = await product({ price: 25 });
  const res = await post('/api/stock/prices', { productIds: [a.id, b.id], how: 'each', prices: { [a.id]: 2800, [b.id]: 2600 } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changed, 1);
  assert.equal((await linesOf(a.id)).length, 0);
  assert.equal(await priceOf(b.id), 2600);
});

test('a change that changes nothing is refused', async () => {
  const pads = await product();
  const res = await post('/api/stock/prices', { productIds: [pads.id], how: 'percent', value: 0, ending: 'leave' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'None of these prices would change');
});

test('Undo puts each price back with its own line, leaves one edited since and counts it, and only once', async () => {
  const a = await product({ name: 'Shimano brake pads' });
  const b = await product();
  const c = await product();
  const made = await post('/api/stock/prices', { productIds: [a.id, b.id, c.id], how: 'percent', value: 10, ending: '99' });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal(made.body.changed, 3);
  const edited = await asOwner(`/api/products/${c.id}`, { method: 'PUT', body: { pricePence: 3500 } });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  const undone = await post(`/api/stock/prices/${made.body.batchId}/undo`, {});
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.deepEqual(undone.body, { undone: 2, leftAlone: 1 });
  assert.equal(await priceOf(a.id), 2800);
  assert.equal(await priceOf(b.id), 2800);
  assert.equal(await priceOf(c.id), 3500);
  const lines = await linesOf(a.id);
  assert.deepEqual(lines.map((l) => [Number(l.was_pence), Number(l.now_pence), l.batch_id === null]), [[2800, 3099, false], [3099, 2800, true]]);
  const again = await post(`/api/stock/prices/${made.body.batchId}/undo`, {});
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'These prices have already been put back');
  assert.equal((await post('/api/stock/prices/999999/undo', {})).status, 404);
});

test('Jo is refused on all three, and no price changes', async () => {
  const pads = await product();
  const body = { productIds: [pads.id], how: 'percent', value: 10, ending: '99' };
  for (const path of ['/api/stock/prices/preview', '/api/stock/prices']) {
    const res = await post(path, body, asJo);
    assert.equal(res.status, 403, path);
    assert.equal(res.body.error, 'Only the shop’s owner can add or change products');
  }
  const made = await post('/api/stock/prices', body);
  assert.equal((await post(`/api/stock/prices/${made.body.batchId}/undo`, {}, asJo)).status, 403);
  assert.equal(await priceOf(pads.id), 3099);
});

test('another business can’t undo this one’s change', async () => {
  const pads = await product();
  const made = await post('/api/stock/prices', { productIds: [pads.id], how: 'percent', value: 10, ending: '99' });
  const res = await staffRequest(server.baseUrl, other.cookie, `/api/stock/prices/${made.body.batchId}/undo`, { method: 'POST', body: {} });
  assert.equal(res.status, 404);
  assert.equal(await priceOf(pads.id), 3099);
});

test('nothing ticked, or too many, is refused', async () => {
  const none = await post('/api/stock/prices/preview', { productIds: [], how: 'percent', value: 10, ending: '99' });
  assert.equal(none.status, 400);
  const many = await post('/api/stock/prices/preview', { productIds: Array.from({ length: 2001 }, (_, i) => i + 1), how: 'percent', value: 10, ending: '99' });
  assert.equal(many.status, 400);
  const bad = await post('/api/stock/prices/preview', { productIds: ['x'], how: 'percent', value: 10, ending: '99' });
  assert.equal(bad.status, 400);
});

test('a change with one product held by something else answers busy after its 2 seconds, and changes nothing', async () => {
  const a = await product();
  const b = await product();
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [b.id]);
    const res = await Promise.race([
      post('/api/stock/prices', { productIds: [a.id, b.id], how: 'percent', value: 10, ending: '99' }),
      new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); }),
    ]);
    assert.equal(res.status, 503, JSON.stringify(res.body));
    assert.equal(res.body.code, 'busy');
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  assert.equal(await priceOf(a.id), 2800);
  assert.equal((await linesOf(a.id)).length, 0);
});
