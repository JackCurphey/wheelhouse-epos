// Adjusting stock, the server (openspec/changes/adjust-stock; st-adjust; stock
// control decisions 6 and 11): a reason that follows the sign, Other with a
// note, who made it, never below zero, and two adjustments at once both count.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  jo = await staffLogin(owner.shop.id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const adjust = (id, body, who) => staff(`/api/products/${id}/stock`, { method: 'POST', body: { type: 'adjustment', ...body } }, who);
const stockOf = async (id) => (await staff(`/api/products/${id}`)).body.stockQty;

// Shimano brake pads B05S-RX at £28.00, as drawn; the rest is placeholder.
let n = 0;
async function pads(stockQty = 6) {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, category: '[Category]', supplier: '[Supplier]', price: 28, cost: 14, stockQty } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('an adjustment records its reason, its note and who made it', async () => {
  const p = await pads();
  const res = await adjust(p.id, { change: -1, reason: 'damaged', note: '[note]' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stockQty, 5);
  const [line] = (await staff(`/api/products/${p.id}`)).body.history;
  assert.deepEqual({ type: line.type, change: line.change, reason: line.reason, note: line.note, who: line.who }, { type: 'adjustment', change: -1, reason: 'damaged', note: '[note]', who: 'Jack Lewis' });
});

test('the reasons follow the sign: Found going up, not going down', async () => {
  const p = await pads();
  assert.equal((await adjust(p.id, { change: 2, reason: 'found' })).status, 200);
  for (const reason of ['damaged', 'lost_stolen', 'used_workshop', 'faulty_return']) {
    const up = await adjust(p.id, { change: 1, reason });
    assert.equal(up.status, 400, `${reason} going up`);
  }
  assert.equal((await adjust(p.id, { change: -1, reason: 'found' })).status, 400, 'found going down');
  assert.equal(await stockOf(p.id), 8);
});

test('an adjustment needs a reason, a known one, and Other needs a note', async () => {
  const p = await pads();
  const none = await adjust(p.id, { change: -1 });
  assert.equal(none.status, 400);
  assert.equal(none.body.error, 'Pick a reason for the adjustment');
  assert.equal((await adjust(p.id, { change: -1, reason: 'bored' })).status, 400);
  const bare = await adjust(p.id, { change: -1, reason: 'other', note: '  ' });
  assert.equal(bare.status, 400);
  assert.equal(bare.body.error, 'Write a note for Other');
  assert.equal(await stockOf(p.id), 6, 'nothing changed');
  assert.equal((await adjust(p.id, { change: -1, reason: 'other', note: '[note]' })).status, 200);
  assert.equal(await stockOf(p.id), 5);
});

test('going down below zero is refused; going up from below zero is not', async () => {
  const p = await pads(1);
  const res = await adjust(p.id, { change: -2, reason: 'lost_stolen' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Stock cannot go below zero');
  assert.equal(await stockOf(p.id), 1);
  await runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = -2 WHERE id = ?').run(p.id));
  assert.equal((await adjust(p.id, { change: 1, reason: 'found' })).status, 200);
  assert.equal(await stockOf(p.id), -1);
});

// Five at once, not more: each request holds a pool connection and looks up
// its session on another (pool max 10), so ten at once would starve the pool.
test('adjustments at once all count (one atomic update)', async () => {
  const p = await pads(20);
  const all = await Promise.all(Array.from({ length: 5 }, () => adjust(p.id, { change: -1, reason: 'damaged' })));
  assert.deepEqual(all.map((r) => r.status), Array(5).fill(200), JSON.stringify(all.map((r) => r.body)));
  assert.equal(await stockOf(p.id), 15);
  const lines = (await staff(`/api/products/${p.id}`)).body.history.filter((h) => h.type === 'adjustment');
  assert.equal(lines.length, 5);
});

test('two adjustments at once never take stock below zero', async () => {
  const p = await pads(1);
  const both = await Promise.all([adjust(p.id, { change: -1, reason: 'damaged' }), adjust(p.id, { change: -1, reason: 'damaged' })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await stockOf(p.id), 0);
  assert.equal((await staff(`/api/products/${p.id}`)).body.history.filter((h) => h.type === 'adjustment').length, 1);
});

// Anyone with the Stock page adjusts, as long as who is recorded (Jack, 26 Oct:
// docs/decisions/2026-10-26-day-answers.md section 11; stock decision 6).
test('Staff can adjust, and the history records their name, the reason and when', async () => {
  const p = await pads();
  const before = Date.now();
  const res = await adjust(p.id, { change: -1, reason: 'lost_stolen' }, jo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(p.id), 5);
  const [line] = (await staff(`/api/products/${p.id}`, {}, jo)).body.history;
  assert.deepEqual([line.type, line.change, line.reason, line.who], ['adjustment', -1, 'lost_stolen', 'Staff']);
  const at = Date.parse(line.at);
  assert.ok(at >= before - 60_000 && at <= Date.now() + 60_000, `when it was made: ${line.at}`);
});

test('booking stock in (the old app) needs no reason, and records who', async () => {
  const p = await pads();
  const res = await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: 3, type: 'intake' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [line] = (await staff(`/api/products/${p.id}`)).body.history;
  assert.deepEqual([line.type, line.change, line.reason, line.who], ['intake', 3, null, 'Jack Lewis']);
});

// The review of adjust-stock (26 Oct): the input checks tightened.
const WHOLE = 'A non-zero whole-number "change" is required';
test('only an adjustment or booking in; booking in only adds', async () => {
  const p = await pads();
  const post = (body) => staff(`/api/products/${p.id}/stock`, { method: 'POST', body });
  for (const body of [{ change: -5 }, { change: -5, type: 'sale' }, { change: 2, type: 'bogus' }]) {
    const res = await post(body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const down = await post({ change: -5, type: 'intake' });
  assert.equal(down.status, 400);
  assert.equal(await stockOf(p.id), 6, 'nothing changed');
  assert.equal((await post({ change: 4, type: 'intake' })).status, 200, 'the old app’s Stock received still works');
  assert.equal(await stockOf(p.id), 10);
});

test('the change is a whole number of at most 100,000 either way', async () => {
  const p = await pads();
  for (const change of [1.9, true, '3', 1e12, 100001, -100001, null, 0]) {
    const res = await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change, type: 'intake' } });
    assert.equal(res.status, 400, `change ${JSON.stringify(change)}`);
    assert.equal(res.body.error, WHOLE, `change ${JSON.stringify(change)}`);
  }
  assert.equal(await stockOf(p.id), 6);
  assert.equal((await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: 100000, type: 'intake' } })).status, 200);
});

test('a note is at most 500 characters', async () => {
  const p = await pads();
  const long = await adjust(p.id, { change: -1, reason: 'other', note: 'x'.repeat(501) });
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'Keep the note to 500 characters');
  assert.equal(await stockOf(p.id), 6);
  assert.equal((await adjust(p.id, { change: -1, reason: 'other', note: 'x'.repeat(500) })).status, 200);
});
