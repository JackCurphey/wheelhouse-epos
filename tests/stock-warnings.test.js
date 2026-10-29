// Today's stock warnings, the server (openspec/changes/stock-warnings-on-today;
// st-today-adjust, st-setting-adjust, st-today-below; stock control decisions
// 6 and 9). The amount set in Settings › Stockroom, in whole pence; an
// adjustment's value at cost, kept on its line; one worth more than the
// amount on the Owner's Needs attention until Seen; and the products below
// zero, with the below-zero count already counting.
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
  server = await startLiveServer();
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const call = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const SETTINGS = '/api/stockroom-settings';
const setAmount = (who, pence) => call(who, SETTINGS, { method: 'PUT', body: { adjustTodayOverPence: pence } });

// A shop of its own for each test, with Jo Taylor on the team (not the Owner).
async function shop({ over = null } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const made = await call(owner, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  owner.jo = { cookie: await staffFreshCookie(made.body.loginId) };
  if (over !== null) assert.equal((await setAmount(owner, over)).status, 200);
  return owner;
}
// Shimano brake pads B05S-RX at £28.00, as drawn; the cost is the test's own.
let n = 0;
async function product(owner, { cost = 14, stockQty = 6, name = 'Shimano brake pads' } = {}) {
  n += 1;
  const res = await call(owner, '/api/products', { method: 'POST', body: { name, sku: `B05S-RX-${n}`, category: '[Category]', price: 28, cost, stockQty } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
const adjust = async (who, id, body) => {
  const res = await call(who, `/api/products/${id}/stock`, { method: 'POST', body: { type: 'adjustment', ...body } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const attention = async (owner) => {
  const res = await call(owner, '/api/needs-attention');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.items;
};
const adjusted = async (owner) => (await attention(owner)).filter((i) => i.kind === 'stock_adjusted');
const belowZero = async (owner) => (await attention(owner)).filter((i) => i.kind === 'below_zero');
const seen = (who, id) => call(who, `/api/stock-adjustments/${id}/seen`, { method: 'POST', body: {} });
const setStock = (owner, id, qty) => runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(qty, id));

test('the Owner sets the amount in whole pence; until then it is not set', async () => {
  const owner = await shop();
  assert.deepEqual((await call(owner, SETTINGS)).body, { adjustTodayOverPence: null });
  const saved = await setAmount(owner, 5000);
  assert.deepEqual([saved.status, saved.body], [200, { adjustTodayOverPence: 5000 }]);
  assert.deepEqual((await call(owner, SETTINGS)).body, { adjustTodayOverPence: 5000 });
  for (const bad of [12.5, -1, '5000', null, true, 10_000_001]) {
    const res = await setAmount(owner, bad);
    assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${JSON.stringify(res.body)}`);
  }
  assert.equal((await setAmount(owner, 0)).status, 200);
  assert.equal((await setAmount(owner, 10_000_000)).status, 200);
  // Jo reads it, as anyone signed in, and can't change it.
  const refused = await setAmount(owner.jo, 100);
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  assert.deepEqual((await call(owner.jo, SETTINGS)).body, { adjustTodayOverPence: 10_000_000 });
});

test('saves at once each write the amount whole', async () => {
  const owner = await shop();
  const amounts = Array.from({ length: 10 }, (_, i) => 1000 + i);
  const results = await Promise.all(amounts.map((p) => setAmount(owner, p)));
  assert.deepEqual(results.map((r) => r.status), amounts.map(() => 200));
  assert.ok(amounts.includes((await call(owner, SETTINGS)).body.adjustTodayOverPence));
});

test('an adjustment worth more than the amount, at cost, goes on Needs attention with who, why and its value', async () => {
  const owner = await shop({ over: 2500 });
  const pads = await product(owner, { cost: 14 });
  await adjust(owner.jo, pads.id, { change: -2, reason: 'damaged' });
  const [line, ...rest] = await adjusted(owner);
  assert.deepEqual(rest, []);
  assert.ok(Number.isInteger(line.movementId));
  assert.ok(!Number.isNaN(Date.parse(line.at)));
  assert.deepEqual({ ...line, movementId: 0, at: 0 }, {
    kind: 'stock_adjusted', movementId: 0, productId: pads.id, productName: 'Shimano brake pads', change: -2,
    valuePence: 2800, reason: 'damaged', note: '', byName: 'Jo Taylor', at: 0,
  });
});

test('worth exactly the amount, or less, stays off Today; it is still in the history', async () => {
  const owner = await shop({ over: 2800 });
  const pads = await product(owner, { cost: 14 });
  await adjust(owner, pads.id, { change: -2, reason: 'damaged' });
  await adjust(owner, pads.id, { change: -1, reason: 'lost_stolen' });
  assert.deepEqual(await adjusted(owner), []);
  assert.equal((await call(owner, `/api/products/${pads.id}`)).body.history.filter((h) => h.type === 'adjustment').length, 2);
});

test('with no amount set, nothing goes on Today', async () => {
  const owner = await shop();
  const pads = await product(owner, { cost: 500 });
  await adjust(owner, pads.id, { change: -6, reason: 'lost_stolen' });
  assert.deepEqual(await adjusted(owner), []);
});

test('going up counts as well as going down, and a cost in pence is kept whole', async () => {
  const owner = await shop({ over: 1000 });
  const pads = await product(owner, { cost: 3.33 });
  await adjust(owner, pads.id, { change: 4, reason: 'found' });
  const [line] = await adjusted(owner);
  assert.deepEqual([line.change, line.valuePence, line.reason], [4, 1332, 'found']);
});

test('a note follows the line; oldest first', async () => {
  const owner = await shop({ over: 0 });
  const a = await product(owner, { cost: 2 });
  const b = await product(owner, { cost: 3, name: '[Product]' });
  await adjust(owner, a.id, { change: -1, reason: 'other', note: '[note]' });
  await adjust(owner, b.id, { change: -1, reason: 'damaged' });
  const lines = await adjusted(owner);
  assert.deepEqual(lines.map((l) => [l.productName, l.note]), [['Shimano brake pads', '[note]'], ['[Product]', '']]);
});

test('the value is the one when it was made; changing the amount later adds or takes off nothing', async () => {
  const owner = await shop({ over: 5000 });
  const pads = await product(owner, { cost: 14 });
  await adjust(owner, pads.id, { change: -1, reason: 'damaged' }); // £14, under
  await setAmount(owner, 1000);
  await adjust(owner, pads.id, { change: -1, reason: 'damaged' }); // £14, over £10
  // The cost goes up and the amount goes up: the line stands, at £14.
  assert.equal((await call(owner, `/api/products/${pads.id}`, { method: 'PUT', body: { cost: 100 } })).status, 200);
  await setAmount(owner, 9000);
  const lines = await adjusted(owner);
  assert.deepEqual(lines.map((l) => l.valuePence), [1400]);
});

test('stock received is never a warning, however much it is worth', async () => {
  const owner = await shop({ over: 0 });
  const pads = await product(owner, { cost: 14 });
  assert.equal((await call(owner, `/api/products/${pads.id}/stock`, { method: 'POST', body: { type: 'intake', change: 50 } })).status, 200);
  assert.deepEqual(await adjusted(owner), []);
  // Nor marked for later: it has no value and isn't to see.
  const lines = await runWithShop(owner.shop.id, () => prepare("SELECT value_pence, to_see FROM stock_movements WHERE product_id = ? AND type = 'intake' AND note = ''").all(pads.id));
  assert.deepEqual(lines, [{ value_pence: null, to_see: false }]);
});

test('Seen takes the line off, records who and when, and is the Owner’s only', async () => {
  const owner = await shop({ over: 0 });
  const pads = await product(owner, { cost: 14 });
  await adjust(owner.jo, pads.id, { change: -1, reason: 'damaged' });
  const [line] = await adjusted(owner);
  const refused = await seen(owner.jo, line.movementId);
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  assert.equal((await adjusted(owner)).length, 1);
  const res = await seen(owner, line.movementId);
  assert.deepEqual([res.status, res.body], [200, { ok: true }]);
  assert.deepEqual(await adjusted(owner), []);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT seen_at, seen_by_login_id FROM stock_movements WHERE id = ?').get(line.movementId));
  assert.equal(row.seen_by_login_id, owner.loginId);
  assert.ok(row.seen_at instanceof Date);
  // Again, or a line that never went to Today: refused, nothing written.
  const again = await seen(owner, line.movementId);
  assert.deepEqual([again.status, again.body.code], [409, 'not_to_see']);
  await setAmount(owner, 100000);
  await adjust(owner, pads.id, { change: -1, reason: 'damaged' });
  const [small] = (await call(owner, `/api/products/${pads.id}`)).body.history;
  assert.deepEqual([(await seen(owner, small.id)).status], [409]);
  assert.equal((await seen(owner, 'abc')).status, 404);
});

test('each shop sees and clears only its own', async () => {
  const north = await shop({ over: 0 });
  const other = await shop({ over: 0 });
  const pads = await product(other, { cost: 14 });
  await adjust(other, pads.id, { change: -1, reason: 'damaged' });
  await setStock(other, pads.id, -3);
  assert.deepEqual(await adjusted(north), []);
  assert.deepEqual(await belowZero(north), []);
  const [line] = await adjusted(other);
  assert.equal((await seen(north, line.movementId)).status, 409);
  assert.equal((await adjusted(other)).length, 1);
});

test('products below zero: one line with how many, and the below-zero count already counting', async () => {
  const owner = await shop();
  const a = await product(owner);
  const b = await product(owner, { name: '[Product]' });
  const gone = await product(owner, { name: '[Product taken off sale]' });
  assert.deepEqual(await belowZero(owner), [], 'nothing below zero, no line');
  await setStock(owner, a.id, -1);
  await setStock(owner, b.id, -2);
  // A product taken off sale isn't counted, as the below-zero count leaves it out.
  await setStock(owner, gone.id, -1);
  assert.equal((await call(owner, `/api/products/${gone.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual(await belowZero(owner), [{ kind: 'below_zero', count: 2, takeId: null }]);
  const take = await call(owner, '/api/stock-takes', { method: 'POST', body: { kind: 'below_zero' } });
  assert.equal(take.status, 201, JSON.stringify(take.body));
  // Another kind of count doesn't count.
  assert.equal((await call(owner, '/api/stock-takes', { method: 'POST', body: { kind: 'whole_shop' } })).status, 201);
  assert.deepEqual(await belowZero(owner), [{ kind: 'below_zero', count: 2, takeId: take.body.id }]);
  // The line goes when none are below zero.
  await setStock(owner, a.id, 0);
  await setStock(owner, b.id, 1);
  assert.deepEqual(await belowZero(owner), []);
});
