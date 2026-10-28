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
