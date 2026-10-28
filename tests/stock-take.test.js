// Stock take, the counting half (openspec/changes/stock-take; tk-hub,
// tk-start, tk-count, tk-count-below; stock control decisions 5, 9 and 11):
// the Owner starts a count, anyone joins and counts blind, two scans at once
// both count, counting never touches stock, and each shop sees its own.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { hashPassword, createSession, SESSION_COOKIE } from '../server/auth.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let alex;
let other;
// A team member signed in as themselves, named as drawn.
async function person(shopId, name) {
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, password_hash, is_owner, active) VALUES ($1, $2, $3, $4, false, true) RETURNING id`,
    [shopId, name, `staff-${randomUUID().slice(0, 8)}@example.test`, hashPassword('not-used-in-tests')]
  );
  return { id: login.id, cookie: `${SESSION_COOKIE}=${await createSession(login.id)}` };
}
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  jo = await person(owner.shop.id, 'Jo Taylor');
  alex = await person(owner.shop.id, 'Alex Morgan');
  other = await staffSignup(server.baseUrl, { shopName: '[Second site]', ownerName: '[Owner]' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const start = (body, who) => staff('/api/stock-takes', { method: 'POST', body }, who);
const count = (id, body, who) => staff(`/api/stock-takes/${id}/counts`, { method: 'POST', body }, who);
const hub = async (who) => (await staff('/api/stock-takes', undefined, who)).body;
const page = async (id, who) => (await staff(`/api/stock-takes/${id}`, undefined, who)).body;

// Shimano brake pads B05S-RX at £28.00, as drawn; the rest is placeholder.
let n = 0;
async function product({ name = 'Shimano brake pads', category = 'Brakes', stockQty = 6 } = {}, who = owner) {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name, sku: `B05S-RX-${n}`, category, price: 28, cost: 14, stockQty } }, who);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
const setStock = (id, qty) => runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(qty, id));
const stockAndHistory = async (id) => {
  const p = (await staff(`/api/products/${id}`)).body;
  return { stock: p.stockQty, lines: p.history.length };
};

test('the Owner starts a count of an area, and it shows as in progress', async () => {
  const res = await start({ kind: 'area', target: 'Wall 3' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.label, 'Wall 3');
  assert.equal(res.body.startedBy, 'Jack Lewis');
  const h = await hub();
  assert.equal(h.canStart, true);
  const line = h.inProgress.find((t) => t.id === res.body.id);
  assert.ok(line, 'listed in progress');
  assert.deepEqual({ kind: line.kind, label: line.label, startedBy: line.startedBy, itemsCounted: line.itemsCounted }, { kind: 'area', label: 'Wall 3', startedBy: 'Jack Lewis', itemsCounted: 0 });
  assert.ok(h.areasUsed.includes('Wall 3'), 'offered as used before');
});

test('Staff can’t start a count, but see the counts in progress', async () => {
  const res = await start({ kind: 'whole_shop' }, jo);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'owner_only');
  const h = await hub(jo);
  assert.equal(h.canStart, false);
  assert.ok(Array.isArray(h.inProgress));
});

test('each kind is checked: an area needs a name, a category must be used, below zero needs something below zero', async () => {
  await product({ category: 'Drivetrain › Derailleurs', stockQty: 2 });
  assert.equal((await start({ kind: 'area', target: '  ' })).status, 400);
  assert.equal((await start({ kind: 'area', target: 'x'.repeat(61) })).status, 400);
  assert.equal((await start({ kind: 'cupboard' })).status, 400);
  const unknown = await start({ kind: 'category', target: '[Category nobody uses]' });
  assert.equal(unknown.status, 400);
  const cat = await start({ kind: 'category', target: 'Drivetrain › Derailleurs' });
  assert.equal(cat.status, 201);
  assert.equal(cat.body.label, 'Drivetrain › Derailleurs');
  const whole = await start({ kind: 'whole_shop', target: 'ignored' });
  assert.equal(whole.status, 201);
  assert.equal(whole.body.target, '', 'a whole-shop count has no target');
  assert.equal(whole.body.label, 'Whole shop');
});

test('anyone joins and counts: a scan adds one, a typed number sets it, 0 takes it off', async () => {
  const pads = await product();
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  assert.equal((await staff(`/api/stock-takes/${take.id}/join`, { method: 'POST' }, jo)).status, 200);
  const first = await count(take.id, { productId: pads.id, add: 1 }, jo);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.qty, 1);
  assert.equal((await count(take.id, { productId: pads.id, add: 1 }, jo)).body.qty, 2);
  assert.equal((await count(take.id, { productId: pads.id, qty: 7 }, jo)).body.qty, 7);
  let mine = await page(take.id, jo);
  assert.deepEqual(mine.mine.map((l) => [l.productId, l.qty]), [[pads.id, 7]]);
  assert.equal(mine.myItems, 7);
  assert.equal((await count(take.id, { productId: pads.id, qty: 0 }, jo)).body.qty, 0);
  mine = await page(take.id, jo);
  assert.deepEqual(mine.mine, []);
  for (const bad of [{ productId: pads.id, add: 2 }, { productId: pads.id, qty: -1 }, { productId: pads.id, qty: 1.5 }, { productId: pads.id, qty: 100001 }, { productId: pads.id }, { productId: 'x', add: 1 }]) {
    assert.equal((await count(take.id, bad, jo)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await count(take.id, { productId: 99999999, add: 1 }, jo)).status, 404);
  assert.equal((await count(99999999, { productId: pads.id, add: 1 }, jo)).status, 404);
});

test('counting is blind: nothing a counter reads carries the stock figure', async () => {
  const pads = await product({ stockQty: 98765 });
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  await count(take.id, { productId: pads.id, add: 1 }, jo);
  const res = await staff(`/api/stock-takes/${take.id}`, undefined, jo);
  assert.equal(res.status, 200);
  // Every key and number in what a counter reads, however deep.
  const seen = (v, out = []) => {
    if (Array.isArray(v)) v.forEach((x) => seen(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); seen(x, out); }
    else out.push(v);
    return out;
  };
  for (const body of [res.body, await hub(jo)]) {
    const all = seen(body);
    assert.ok(!all.includes(98765), 'the stock figure is not sent');
    assert.ok(!all.some((k) => typeof k === 'string' && /stock|expected/i.test(k) && k !== 'stillToFind'), 'no stock or expected field');
  }
});

test('two counters each have their own count, and each sees the other counting', async () => {
  const pads = await product();
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  await count(take.id, { productId: pads.id, add: 1 }, jo);
  await count(take.id, { productId: pads.id, qty: 3 }, alex);
  assert.equal((await page(take.id, jo)).mine[0].qty, 1);
  assert.equal((await page(take.id, alex)).mine[0].qty, 3);
  assert.deepEqual((await page(take.id, jo)).othersCounting, ['Alex Morgan']);
  const line = (await hub()).inProgress.find((t) => t.id === take.id);
  assert.deepEqual([...line.counting].sort(), ['Alex Morgan', 'Jo Taylor']);
  assert.equal(line.itemsCounted, 4);
});

test('twenty scans at once all count, and counting never changes stock or its history', async () => {
  const pads = await product();
  const was = await stockAndHistory(pads.id);
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  const all = await Promise.all(Array.from({ length: 20 }, () => count(take.id, { productId: pads.id, add: 1 }, jo)));
  assert.deepEqual([...new Set(all.map((r) => r.status))], [200]);
  assert.equal((await page(take.id, jo)).mine[0].qty, 20);
  assert.deepEqual(await stockAndHistory(pads.id), was);
});

test('a category count takes only its own products; a below-zero count only its list, with what’s still to find', async () => {
  const mech = await product({ name: '[Product]', category: 'Drivetrain › Derailleurs' });
  const pads = await product({ category: 'Brakes' });
  const cat = (await start({ kind: 'category', target: 'Drivetrain › Derailleurs' })).body;
  assert.equal((await count(cat.id, { productId: mech.id, add: 1 }, jo)).status, 200);
  const wrong = await count(cat.id, { productId: pads.id, add: 1 }, jo);
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, 'Shimano brake pads isn’t in Drivetrain › Derailleurs');

  // Earlier tests' products stay at their stock; only these two are below zero.
  const below1 = await product({ name: '[Product below zero]' });
  const below2 = await product({ name: '[Another below zero]' });
  await setStock(below1.id, -1);
  await setStock(below2.id, -2);
  const bz = await start({ kind: 'below_zero' });
  assert.equal(bz.status, 201, JSON.stringify(bz.body));
  assert.equal(bz.body.label, 'Below zero');
  let p = await page(bz.body.id, jo);
  assert.deepEqual(p.stillToFind.map((s) => s.productId).sort(), [below1.id, below2.id].sort());
  assert.deepEqual(Object.keys(p.stillToFind[0]).sort(), ['name', 'productId', 'sku'], 'still blind: names only, no numbers');
  const off = await count(bz.body.id, { productId: pads.id, add: 1 }, jo);
  assert.equal(off.status, 400);
  assert.equal(off.body.error, 'Shimano brake pads isn’t below zero');
  assert.equal((await count(bz.body.id, { productId: below1.id, add: 1 }, alex)).status, 200);
  p = await page(bz.body.id, jo);
  assert.deepEqual(p.stillToFind.map((s) => s.productId), [below2.id], 'found by anyone comes off the list');
  // Fixed when it started: a product going below zero later isn't added.
  await setStock(pads.id, -1);
  assert.equal((await count(bz.body.id, { productId: pads.id, add: 1 }, jo)).status, 400);
  await setStock(below1.id, 0);
  await setStock(below2.id, 0);
  await setStock(pads.id, 0);
  assert.equal((await start({ kind: 'below_zero' })).status, 400, 'nothing below zero');
  assert.equal((await page(cat.id, jo)).stillToFind, null, 'only a below-zero count has a list');
});

test('I’ve finished my part: everyone finished reads ready; counting again puts you back', async () => {
  const pads = await product();
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  await count(take.id, { productId: pads.id, add: 1 }, jo);
  await count(take.id, { productId: pads.id, add: 1 }, alex);
  const line = async () => (await hub()).inProgress.find((t) => t.id === take.id);
  assert.equal((await staff(`/api/stock-takes/${take.id}/finish`, { method: 'POST' }, jo)).status, 200);
  assert.equal((await line()).everyoneFinished, false);
  assert.deepEqual((await line()).finished, ['Jo Taylor']);
  await staff(`/api/stock-takes/${take.id}/finish`, { method: 'POST' }, alex);
  assert.equal((await line()).everyoneFinished, true);
  await count(take.id, { productId: pads.id, add: 1 }, jo);
  assert.equal((await line()).everyoneFinished, false, 'Jo is counting again');
  assert.deepEqual((await line()).counting, ['Jo Taylor']);
  // Nobody has joined: not ready.
  const empty = (await start({ kind: 'area', target: '[Area]' })).body;
  assert.equal((await hub()).inProgress.find((t) => t.id === empty.id).everyoneFinished, false);
});

test('each shop sees and counts only its own', async () => {
  const pads = await product();
  const take = (await start({ kind: 'area', target: '[Area]' })).body;
  const theirs = await hub(other);
  assert.ok(!theirs.inProgress.some((t) => t.id === take.id));
  assert.equal((await staff(`/api/stock-takes/${take.id}`, undefined, other)).status, 404);
  assert.equal((await count(take.id, { productId: pads.id, add: 1 }, other)).status, 404);
  const theirTake = (await start({ kind: 'area', target: '[Area]' }, other)).body;
  assert.equal((await count(theirTake.id, { productId: pads.id, add: 1 }, other)).status, 404, 'another shop’s product');
});

// ---------- Checking and applying (tk-diff, tk-applied) ----------
// Expected is measured at each product's last count; anything that moved
// after it is allowed for (decided here for Jack to overrule, 28 Oct).

const check = async (id, who) => (await staff(`/api/stock-takes/${id}/check`, undefined, who));
const act = (id, what, body = {}, who = owner) => staff(`/api/stock-takes/${id}/${what}`, { method: 'POST', body }, who);
const adjust = (id, change, reason) => staff(`/api/products/${id}/stock`, { method: 'POST', body: { type: 'adjustment', change, reason } });
const historyOf = async (id) => (await staff(`/api/products/${id}`)).body.history;
let cashier;
async function sell(productId, qty = 1, items = [{ productId, qty }]) {
  cashier ??= (await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body;
  // Every product here is £28.00, paid in cash exactly.
  const total = items.reduce((n, it) => n + 28 * it.qty, 0);
  return staff('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, items, cashAmount: total, cashTendered: total } });
}
const areaTake = async () => (await start({ kind: 'area', target: '[Area]' })).body;

test('checking shows expected, counted and the difference at cost, largest first; matches aren’t listed', async () => {
  const pads = await product({ stockQty: 6 });
  const tube = await product({ name: '[Product]', stockQty: 3 });
  const same = await product({ name: '[Product 2]', stockQty: 2 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 2 }, jo);
  await count(take.id, { productId: pads.id, qty: 1 }, alex);
  await count(take.id, { productId: tube.id, qty: 4 }, jo);
  await count(take.id, { productId: same.id, qty: 2 }, jo);
  const res = await check(take.id);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.deepEqual({ counted: d.productsCounted, match: d.productsMatching, differ: d.productsDiffering, value: d.valuePence }, { counted: 3, match: 1, differ: 2, value: -3 * 1400 + 1 * 1400 });
  assert.deepEqual(d.rows.map((r) => [r.productId, r.expected, r.counted, r.difference, r.valuePence]), [[pads.id, 6, 3, -3, -4200], [tube.id, 3, 4, 1, 1400]]);
  assert.deepEqual(d.rows[0].byCounter, [{ name: 'Jo Taylor', qty: 2 }, { name: 'Alex Morgan', qty: 1 }]);
  assert.equal(d.notCounted, null, 'an area count leaves what nobody scanned alone');
  assert.equal((await check(take.id, jo)).status, 403, 'checking is for the Owner');
});

test('stock that moved after a product’s last count is allowed for; before it, it’s already in the count', async () => {
  const before = await product({ stockQty: 6 });
  const after = await product({ name: '[Product]', stockQty: 6 });
  const take = await areaTake();
  assert.equal((await adjust(before.id, -1, 'damaged')).status, 200); // off the shelf before it was counted
  await count(take.id, { productId: before.id, qty: 5 }, jo);
  await count(take.id, { productId: after.id, qty: 6 }, jo);
  assert.equal((await sell(after.id, 2)).status, 201); // sold after it was counted
  assert.equal((await adjust(after.id, 1, 'found')).status, 200);
  const d = (await check(take.id)).body;
  assert.equal(d.productsDiffering, 0, 'both match');
  assert.equal(d.productsMatching, 2);
  const res = await act(take.id, 'apply');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.productsChanged, 0);
  assert.equal((await stockAndHistory(after.id)).stock, 5, 'the sale and the find stay');
  assert.equal((await stockAndHistory(before.id)).stock, 5);
  // The row lists what moved after the count.
  const pads = await product({ stockQty: 4 });
  const t2 = await areaTake();
  await count(t2.id, { productId: pads.id, qty: 3 }, jo);
  await sell(pads.id, 1);
  const row = (await check(t2.id)).body.rows.find((r) => r.productId === pads.id);
  assert.deepEqual([row.expected, row.counted, row.difference], [4, 3, -1]);
  assert.deepEqual(row.allowedFor, [{ kind: 'sold', change: -1 }]);
  // Counted, then one sold, then counted again: measured at the last count.
  const tube = await product({ name: '[Product 2]', stockQty: 6 });
  await count(t2.id, { productId: tube.id, qty: 3 }, jo);
  await sell(tube.id, 1);
  await count(t2.id, { productId: tube.id, qty: 2 }, jo);
  const again = (await check(t2.id)).body.rows.find((r) => r.productId === tube.id);
  assert.deepEqual([again.expected, again.counted, again.difference], [5, 2, -3]);
});

test('applying changes stock by the difference, with a “Counted” line saying who counted and who applied', async () => {
  const pads = await product({ stockQty: 6 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 4 }, jo);
  const was = (await stockAndHistory(pads.id)).lines;
  const res = await act(take.id, 'apply');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.status, res.body.appliedBy, res.body.productsChanged, res.body.valuePence], ['applied', 'Jack Lewis', 1, -2800]);
  const now = await stockAndHistory(pads.id);
  assert.deepEqual([now.stock, now.lines], [4, was + 1]);
  const [line] = await historyOf(pads.id);
  assert.deepEqual([line.type, line.change, line.who], ['count', -2, 'Jack Lewis']);
  assert.equal(line.note, 'Stock take of [Area] · counted 4, expected 6 · counted by Jo Taylor');
  // Applied: counting, joining and applying again are refused; it leaves the hub's in-progress list.
  assert.equal((await count(take.id, { productId: pads.id, add: 1 }, jo)).status, 409);
  assert.equal((await act(take.id, 'join', {}, jo)).status, 409);
  assert.equal((await act(take.id, 'apply')).status, 409);
  assert.equal((await stockAndHistory(pads.id)).stock, 4, 'applied once');
  const h = await hub();
  assert.ok(!h.inProgress.some((t) => t.id === take.id));
  const done = h.finished.find((t) => t.id === take.id);
  assert.deepEqual([done.appliedBy, done.productsChanged, done.valuePence], ['Jack Lewis', 1, -2800]);
  assert.equal((await hub(jo)).finished, undefined, 'Staff see no finished counts (no costs)');
  assert.equal((await act(take.id, 'apply', {}, jo)).status, 403);
});

test('Undo puts stock back with its own line, and the count back to counting', async () => {
  const pads = await product({ stockQty: 6 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 9 }, jo);
  await act(take.id, 'apply');
  await sell(pads.id, 1);
  assert.equal((await stockAndHistory(pads.id)).stock, 8);
  assert.equal((await act(take.id, 'undo', {}, jo)).status, 403);
  const res = await act(take.id, 'undo');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'counting');
  assert.equal((await stockAndHistory(pads.id)).stock, 5, 'the +3 taken off; the sale stays');
  const [line] = await historyOf(pads.id);
  assert.deepEqual([line.type, line.change, line.who, line.note], ['count_undone', -3, 'Jack Lewis', 'Undid the stock take of [Area]']);
  assert.equal((await act(take.id, 'undo')).status, 409, 'nothing to undo');
  assert.ok((await hub()).inProgress.some((t) => t.id === take.id));
});

test('Recount sends a line back: its counts go, counters are counting again, and the page asks for it', async () => {
  const pads = await product({ stockQty: 6 });
  const tube = await product({ name: '[Product]', stockQty: 1 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 2 }, jo);
  await count(take.id, { productId: tube.id, qty: 1 }, jo);
  await act(take.id, 'finish', {}, jo);
  assert.equal((await act(take.id, 'recount', { productId: pads.id }, jo)).status, 403);
  const res = await act(take.id, 'recount', { productId: pads.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = (await check(take.id)).body;
  assert.ok(!d.rows.some((r) => r.productId === pads.id));
  assert.deepEqual(d.recountAsked.map((r) => [r.productId, r.askedBy]), [[pads.id, 'Jack Lewis']]);
  const p = await page(take.id, jo);
  assert.deepEqual(p.mine.map((l) => l.productId), [tube.id]);
  assert.deepEqual(p.recountAsked.map((r) => [r.productId, r.askedBy]), [[pads.id, 'Jack Lewis']]);
  assert.equal((await hub()).inProgress.find((t) => t.id === take.id).everyoneFinished, false, 'back to counting');
  // Counted again, it leaves the recount list; applying leaves a recount nobody did as it is.
  await count(take.id, { productId: pads.id, qty: 5 }, alex);
  assert.deepEqual((await page(take.id, jo)).recountAsked, []);
  const t2 = await areaTake();
  await count(t2.id, { productId: tube.id, qty: 3 }, jo);
  await act(t2.id, 'recount', { productId: tube.id });
  await count(t2.id, { productId: pads.id, qty: 6 }, jo);
  assert.equal((await act(t2.id, 'apply')).status, 200);
  assert.equal((await stockAndHistory(tube.id)).stock, 1, 'not recounted: left as it is');
});

test('Count them as none: what nobody counted in a category goes to 0; an area count has no such list', async () => {
  const counted = await product({ category: '[Category]', stockQty: 2 });
  const missed = await product({ name: '[Product]', category: '[Category]', stockQty: 3 });
  const take = (await start({ kind: 'category', target: '[Category]' })).body;
  await count(take.id, { productId: counted.id, qty: 2 }, jo);
  let d = (await check(take.id)).body;
  assert.deepEqual([d.notCounted.products, d.notCounted.expected], [1, 3]);
  assert.equal((await act(take.id, 'none', {}, jo)).status, 403);
  assert.equal((await act(take.id, 'none')).status, 200);
  d = (await check(take.id)).body;
  assert.equal(d.notCounted.products, 0);
  assert.deepEqual(d.rows.map((r) => [r.productId, r.counted, r.difference]), [[missed.id, 0, -3]]);
  await act(take.id, 'apply');
  assert.equal((await stockAndHistory(missed.id)).stock, 0);
  const area = await areaTake();
  assert.equal((await act(area.id, 'none')).status, 400);
});

test('Download the count: a spreadsheet of what was counted', async () => {
  const pads = await product({ stockQty: 6 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 5 }, jo);
  await act(take.id, 'apply');
  const res = await fetch(`${server.baseUrl}/api/stock-takes/${take.id}/download`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="stock-take-\d+\.csv"/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.equal(lines[0], 'Product,Supplier code,Expected,Counted,Difference,At cost');
  assert.equal(lines[1], `Shimano brake pads,${pads.sku},6,5,-1,-14.00`);
  const staffRes = await fetch(`${server.baseUrl}/api/stock-takes/${take.id}/download`, { headers: { cookie: jo.cookie } });
  assert.equal(staffRes.status, 403);
});

test('two applies at once: one applies, the other is refused, and stock changes once', async () => {
  const pads = await product({ stockQty: 6 });
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 2 }, jo);
  const both = await Promise.all([act(take.id, 'apply'), act(take.id, 'apply')]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await stockAndHistory(pads.id)).stock, 2);
});

// A till sale on a product while its count is applied: whichever goes first,
// the other waits for its lock, and the sale is never lost or counted twice.
for (const first of ['sale', 'apply']) {
  test(`a sale while the count is applied (${first} first): both stand`, async () => {
    const pads = await product({ stockQty: 6 });
    const take = await areaTake();
    await count(take.id, { productId: pads.id, qty: 4 }, jo);
    const client = await pool.connect();
    let results;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
      await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [pads.id]);
      const a = first === 'sale' ? sell(pads.id, 1) : act(take.id, 'apply');
      await new Promise((resolve) => setTimeout(resolve, 200));
      const b = first === 'sale' ? act(take.id, 'apply') : sell(pads.id, 1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await client.query('COMMIT');
      results = await Promise.all([a, b]);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201], JSON.stringify(results.map((r) => r.body)));
    // Counted 4 on the shelf, then 1 sold: 3, whichever went first.
    assert.equal((await stockAndHistory(pads.id)).stock, 3);
  });
}

test('applying takes products in id order, so a sale of them in another order never deadlocks', async () => {
  for (let round = 0; round < 4; round += 1) {
    const p1 = await product({ stockQty: 9 });
    const p2 = await product({ name: '[Product]', stockQty: 9 });
    const take = await areaTake();
    await count(take.id, { productId: p1.id, qty: 5 }, jo);
    await count(take.id, { productId: p2.id, qty: 5 }, jo);
    const [sale, applied] = await Promise.all([sell(null, 0, [{ productId: p2.id, qty: 1 }, { productId: p1.id, qty: 1 }]), act(take.id, 'apply')]);
    assert.deepEqual([sale.status, applied.status], [201, 200], JSON.stringify([sale.body, applied.body]));
    assert.deepEqual([(await stockAndHistory(p1.id)).stock, (await stockAndHistory(p2.id)).stock], [4, 4]);
  }
});

test('another shop can’t check, apply, undo, recount or download this shop’s count', async () => {
  const pads = await product();
  const take = await areaTake();
  await count(take.id, { productId: pads.id, qty: 1 }, jo);
  assert.equal((await check(take.id, other)).status, 404);
  for (const what of ['apply', 'undo', 'none']) assert.equal((await act(take.id, what, {}, other)).status, 404, what);
  assert.equal((await act(take.id, 'recount', { productId: pads.id }, other)).status, 404);
});
