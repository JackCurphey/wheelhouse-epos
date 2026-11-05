// Stock per shop (openspec/changes/stock-per-shop; Release 2 rule 3). Every business has a
// first shop; moveStock keeps each shop's figure and the business's total together, so
// the two can't drift. North Street Cycles, Bolton, Jack Lewis and Shimano brake pads as
// drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { moveStock, oldestSite } from '../server/lib/stock.js';
import { removeShop } from '../server/remove-shop.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let first;
let second;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  first = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites')).body[0];
  second = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } })).body;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn, shopId = owner.shop.id) => runWithShop(shopId, fn);
const inTransaction = (fn, shopId) => inShop(async () => {
  await dbExec('BEGIN');
  try {
    const out = await fn();
    await dbExec('COMMIT');
    return out;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}, shopId);
const product = (shopId) => inShop(async () => (await prepare("INSERT INTO products (name, updated_at) VALUES ('Shimano brake pads', now())").run()).lastInsertRowid, shopId);
const figures = (id, shopId) => inShop(async () => ({
  total: (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty,
  shops: Object.fromEntries((await prepare('SELECT site_id, qty FROM product_stock WHERE product_id = ?').all(id)).map((r) => [r.site_id, r.qty])),
}), shopId);
const move = (id, change, who = {}, options = {}) => inTransaction(() => moveStock([{ productId: id, change, type: 'adjustment' }], who, options));

test('signing up gives a business its first shop, named after it, with its first letter', () => {
  assert.equal(first.name, owner.shop.name);
  assert.match(first.name, /^North Street Cycles/);
  assert.equal(first.code, 'N');
});

test('a name with no letter still gets a code', async () => {
  const shop = await createTestShop({ name: '123 ☆' });
  try {
    await inTransaction(async () => moveStock([{ productId: await product(shop.id), change: 1, type: 'intake' }]), shop.id);
    assert.deepEqual(await inShop(() => prepare('SELECT name, code FROM sites').all(), shop.id), [{ name: '123 ☆', code: 'A' }]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('Till setup offers the first shop, its own numbers free', async () => {
  const setup = await staffRequest(server.baseUrl, owner.cookie, '/api/till-setup');
  assert.deepEqual(setup.body.sites.map((s) => [s.name, s.code, s.taken]), [[owner.shop.name, 'N', []], ['[Second site]', 'S', []]]);
});

test('a change goes on the shop it’s for and the total; a shop not given is the oldest', async () => {
  const id = await product();
  await move(id, 5);
  assert.deepEqual(await figures(id), { total: 5, shops: { [first.id]: 5 } });
  await move(id, 3, { siteId: second.id });
  assert.deepEqual(await figures(id), { total: 8, shops: { [first.id]: 5, [second.id]: 3 } });
  await move(id, -4, { siteId: second.id });
  assert.deepEqual(await figures(id), { total: 4, shops: { [first.id]: 5, [second.id]: -1 } });
});

test('several lines on one product count once each, at the one shop', async () => {
  const id = await product();
  await inTransaction(() => moveStock([{ productId: id, change: 2, type: 'intake' }, { productId: id, change: 3, type: 'intake' }], { siteId: second.id }));
  assert.deepEqual(await figures(id), { total: 5, shops: { [second.id]: 5 } });
});

test('a refused change or a rollback leaves both figures', async () => {
  const id = await product();
  await move(id, 1);
  const out = await move(id, -2, {}, { neverBelowZero: true });
  assert.equal(out.refused.id, id);
  assert.deepEqual(await figures(id), { total: 1, shops: { [first.id]: 1 } });
  await inShop(async () => {
    await dbExec('BEGIN');
    await moveStock([{ productId: id, change: 9, type: 'intake' }], { siteId: second.id });
    await dbExec('ROLLBACK');
  });
  assert.deepEqual(await figures(id), { total: 1, shops: { [first.id]: 1 } });
});

test('never below zero at this shop looks at this shop, not the total', async () => {
  const id = await product();
  await move(id, 5);
  const here = await move(id, -1, { siteId: second.id }, { neverBelowZero: 'here' });
  assert.equal(here.refused?.id, id, 'the other shop’s stock isn’t here');
  assert.deepEqual(await figures(id), { total: 5, shops: { [first.id]: 5 } });
  assert.ok((await move(id, 2, { siteId: second.id }, { neverBelowZero: 'here' })).refused === null, 'going up is always allowed');
  assert.ok((await move(id, -2, { siteId: second.id }, { neverBelowZero: 'here' })).refused === null, 'down to nothing is');
  // The old till's check stays the total: it keeps working at any shop.
  assert.ok((await move(id, -1, { siteId: second.id }, { neverBelowZero: true })).refused === null);
  assert.deepEqual(await figures(id), { total: 4, shops: { [first.id]: 5, [second.id]: -1 } });
});

test('many moves at once on a product at two shops all count, and the figures agree', async () => {
  const id = await product();
  const runs = [];
  for (let i = 0; i < 20; i += 1) runs.push(move(id, 1, i % 2 ? { siteId: second.id } : {}));
  await Promise.all(runs);
  assert.deepEqual(await figures(id), { total: 20, shops: { [first.id]: 10, [second.id]: 10 } });
});

test('a business with no shop yet gets its first when stock moves, once, however many at once', async () => {
  const shop = await createTestShop({ name: 'Bolton Bikes' });
  try {
    assert.ok((await inShop(() => oldestSite(), shop.id)) === null, 'starts with none');
    const ids = [await product(shop.id), await product(shop.id), await product(shop.id), await product(shop.id)];
    await Promise.all(ids.map((id) => inTransaction(() => moveStock([{ productId: id, change: 1, type: 'intake' }]), shop.id)));
    const sites = await inShop(() => prepare('SELECT id, name, code FROM sites').all(), shop.id);
    assert.deepEqual(sites.map((s) => [s.name, s.code]), [['Bolton Bikes', 'B']]);
    assert.deepEqual(await figures(ids[0], shop.id), { total: 1, shops: { [sites[0].id]: 1 } });
    const line = await inShop(() => prepare('SELECT site_id FROM stock_movements WHERE product_id = ?').get(ids[3]), shop.id);
    assert.equal(line.site_id, sites[0].id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('another business can’t see or reach this one’s stock at each shop', async () => {
  const id = await product();
  await move(id, 2);
  const shop = await createTestShop();
  try {
    await inShop(async () => {
      assert.deepEqual(await prepare('SELECT * FROM product_stock WHERE product_id = ?').all(id), []);
      await dbExec('BEGIN');
      assert.equal((await moveStock([{ productId: id, change: 1, type: 'intake' }])).missing[0], id);
      await dbExec('COMMIT');
    }, shop.id);
    assert.deepEqual(await figures(id), { total: 2, shops: { [first.id]: 2 } });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('removing a business takes its stock at each shop and leaves another’s', async () => {
  const gone = await createTestShop();
  const id = await product(gone.id);
  await inTransaction(() => moveStock([{ productId: id, change: 1, type: 'intake' }]), gone.id);
  const mine = await product();
  await move(mine, 1);
  await removeShop(gone.id);
  const { rows } = await pool.query('SELECT 1 FROM shops WHERE id = $1', [gone.id]);
  assert.equal(rows.length, 0);
  assert.deepEqual(await figures(mine), { total: 1, shops: { [first.id]: 1 } });
});

// ---- Renaming the business ----

const details = (who, body) => staffRequest(server.baseUrl, who.cookie, '/api/shop-details', { method: 'PUT', body });
const sitesOf = async (who) => (await staffRequest(server.baseUrl, who.cookie, '/api/sites')).body.sort((a, b) => a.id - b.id);

test('renaming the business renames the shop named after it; its code stays, and another shop’s name', async () => {
  const made = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  try {
    const added = await staffRequest(server.baseUrl, made.cookie, '/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } });
    assert.equal(added.status, 201);
    const res = await details(made, { name: '[New name]' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.name, '[New name]');
    assert.deepEqual((await sitesOf(made)).map((s) => [s.name, s.code]), [['[New name]', 'N'], ['[Second site]', 'S']]);
  } finally {
    await deleteTestShop(made.shop.id);
  }
});

test('renaming the business keeps a shop named something else', async () => {
  const made = await staffSignup(server.baseUrl);
  try {
    await inShop(() => prepare("UPDATE sites SET name = 'Bolton', code = 'B' RETURNING id").get(), made.shop.id);
    assert.equal((await details(made, { name: '[New name]' })).status, 200);
    assert.deepEqual((await sitesOf(made)).map((s) => [s.name, s.code]), [['Bolton', 'B']]);
  } finally {
    await deleteTestShop(made.shop.id);
  }
});

test('saving other details, or the same name, leaves the shop alone', async () => {
  const made = await staffSignup(server.baseUrl);
  try {
    assert.equal((await details(made, { phone: '[Phone]' })).status, 200);
    assert.equal((await details(made, { name: made.shop.name })).status, 200);
    assert.deepEqual((await sitesOf(made)).map((s) => s.name), [made.shop.name]);
  } finally {
    await deleteTestShop(made.shop.id);
  }
});

test('three renames at once: the shop ends on whichever the business did', async () => {
  const made = await staffSignup(server.baseUrl);
  try {
    const answers = await Promise.all(['[One]', '[Two]', '[Three]'].map((name) => details(made, { name })));
    assert.deepEqual(answers.map((a) => a.status), [200, 200, 200]);
    const { rows: [{ name }] } = await pool.query('SELECT name FROM shops WHERE id = $1', [made.shop.id]);
    assert.deepEqual((await sitesOf(made)).map((s) => s.name), [name]);
  } finally {
    await deleteTestShop(made.shop.id);
  }
});

test('a rename and its shop go together: a held shop answers busy after its limit, and neither changes', async () => {
  const made = await staffSignup(server.baseUrl);
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(made.shop.id)]);
    await holder.query('SELECT id FROM sites FOR UPDATE');
    const started = Date.now();
    const res = await Promise.race([details(made, { name: '[New name]' }), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    const waited = Date.now() - started;
    await holder.query('ROLLBACK');
    assert.equal(res.status, 503, JSON.stringify(res.body));
    assert.equal(res.body.code, 'busy');
    assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
    const { rows: [{ name }] } = await pool.query('SELECT name FROM shops WHERE id = $1', [made.shop.id]);
    assert.equal(name, made.shop.name);
    assert.deepEqual((await sitesOf(made)).map((s) => s.name), [made.shop.name]);
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
    await deleteTestShop(made.shop.id);
  }
});
