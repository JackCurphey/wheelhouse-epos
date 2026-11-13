// Settings › Front desk › Online orders › Showing products, on the server
// (openspec/changes/website-buy-online, task 2.4; design 15; the drawing
// on-settings-show in docs/design/user-journeys/generator/online.mjs showOpen):
// a switch on each category that sets every product in it, new products
// following their category, the count of products set differently, and
// "Started with every product online on [date]" with Change, which asks
// set-up step 3's question again using setUp's own rule.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };

async function freshShop(t, name) {
  const s = await staffSignup(server.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(server.baseUrl, s.cookie, p, options);
  return { shop: s.shop, req };
}

// The drawn categories (Bearings, Drivetrain › Derailleurs) and one more, each
// product added through Stock's own route so its category is found or made.
async function addProducts(req) {
  const add = async (sku, category, price = 5) => ok(await req('/api/products', { method: 'POST', body: { name: '[Product]', sku, category, price, showOnline: true } }), 201);
  await add('[bearing 1]', 'Bearings');
  await add('[bearing 2]', 'Bearings');
  await add('[bearing 3]', 'Bearings');
  await add('[bearing no price]', 'Bearings', 0);
  await add('[drivetrain]', 'Drivetrain');
  await add('[derailleur]', 'Drivetrain › Derailleurs');
  await add('[tyre]', 'Tyres');
}
const switches = (shopId) => runWithShop(shopId, async () =>
  Object.fromEntries((await prepare('SELECT sku, show_online FROM products ORDER BY sku').all()).map((r) => [r.sku, r.show_online])));
const showing = async (req) => ok(await req('/api/website/showing'));
const categoryId = (state, path) => state.categories.find((c) => c.path === path).id;
const setCategory = async (req, state, path, on) => ok(await req(`/api/website/categories/${categoryId(state, path)}`, { method: 'PUT', body: { showOnline: on } }));
const SET_UP = { kind: 'wheelhouse', startWith: 'every', mainColour: '#1A3F66' };

test('Showing products lists each category, parents before their sub-categories, each On to begin with', async (t) => {
  const { req } = await freshShop(t, '[Showing shop]');
  await addProducts(req);
  const state = await showing(req);
  assert.deepEqual(state.categories.map((c) => [c.path, c.showOnline]), [['Bearings', true], ['Drivetrain', true], ['Drivetrain › Derailleurs', true], ['Tyres', true]]);
  assert.equal(state.differentCount, 0);
  assert.equal(state.startedWith, null, 'nothing to say before the website is set up');
  assert.equal(state.startedAt, null);
});

test('a category’s switch sets every product in it and in its sub-categories, and nothing else', async (t) => {
  const { shop, req } = await freshShop(t, '[Category switch shop]');
  await addProducts(req);
  const after = await setCategory(req, await showing(req), 'Drivetrain', false);
  assert.deepEqual(after.categories.map((c) => [c.path, c.showOnline]), [['Bearings', true], ['Drivetrain', false], ['Drivetrain › Derailleurs', false], ['Tyres', true]]);
  const now = await switches(shop.id);
  assert.equal(now['[drivetrain]'], false);
  assert.equal(now['[derailleur]'], false);
  assert.equal(now['[bearing 1]'], true);
  assert.equal(now['[tyre]'], true);
  const back = await setCategory(req, after, 'Drivetrain', true);
  assert.equal(back.categories.find((c) => c.path === 'Drivetrain › Derailleurs').showOnline, true);
  assert.equal((await switches(shop.id))['[derailleur]'], true);
});

test('two products switched off on their own pages count as set differently; unpriced and inactive ones don’t', async (t) => {
  const { shop, req } = await freshShop(t, '[Differently shop]');
  await addProducts(req);
  await runWithShop(shop.id, async () => {
    await prepare("UPDATE products SET show_online = false WHERE sku IN ('[bearing 1]', '[bearing 2]', '[bearing no price]')").run();
    await prepare("UPDATE products SET show_online = false, active = 0 WHERE sku = '[tyre]'").run();
  });
  assert.equal((await showing(req)).differentCount, 2);
});

test('Stock’s See them filter lists exactly the products set differently from their category', async (t) => {
  const { shop, req } = await freshShop(t, '[See them shop]');
  await addProducts(req);
  await runWithShop(shop.id, async () => {
    await prepare("UPDATE products SET show_online = false WHERE sku IN ('[bearing 1]', '[bearing 2]', '[bearing no price]')").run();
  });
  const rows = ok(await req('/api/stock-list?show=online-differs')).rows;
  assert.deepEqual(rows.map((r) => r.sku).sort(), ['[bearing 1]', '[bearing 2]']);
});

test('a new product follows its category; one sent with its own switch keeps it', async (t) => {
  const { shop, req } = await freshShop(t, '[New product shop]');
  await addProducts(req);
  await setCategory(req, await showing(req), 'Tyres', false);
  const add = async (sku, category, extra = {}) => ok(await req('/api/products', { method: 'POST', body: { name: '[Product]', sku, category, price: 5, ...extra } }), 201);
  assert.equal((await add('[new bearing]', 'Bearings')).showOnline, true);
  assert.equal((await add('[new tyre]', 'Tyres')).showOnline, false);
  assert.equal((await add('[new tyre on]', 'Tyres', { showOnline: true })).showOnline, true);
  assert.equal((await add('[new nothing]', '')).showOnline, false, 'Uncategorised has no switch: off until switched on, as before');
  // A new sub-category takes its parent's switch, and its products follow it.
  assert.equal((await add('[new tubeless]', 'Tyres › Tubeless')).showOnline, false);
  assert.equal((await showing(req)).categories.find((c) => c.path === 'Tyres › Tubeless').showOnline, false);
  assert.equal((await switches(shop.id))['[new bearing]'], true);
});

test('set-up “Every product online” says so with its date, and turns every category on', async (t) => {
  const { req } = await freshShop(t, '[Started every shop]');
  await addProducts(req);
  await setCategory(req, await showing(req), 'Tyres', false);
  ok(await req('/api/website/set-up', { method: 'POST', body: SET_UP }));
  const state = await showing(req);
  assert.equal(state.startedWith, 'every');
  assert.ok(!Number.isNaN(Date.parse(state.startedAt)));
  assert.ok(state.categories.every((c) => c.showOnline), 'every category on');
  assert.equal(state.differentCount, 0, 'the unpriced bearing stays off until priced, and isn’t counted');
});

test('set-up “Nothing online” turns every category off, and new top-level categories start off too', async (t) => {
  const { shop, req } = await freshShop(t, '[Started nothing shop]');
  await addProducts(req);
  ok(await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, startWith: 'nothing' } }));
  const state = await showing(req);
  assert.equal(state.startedWith, 'nothing');
  assert.ok(state.categories.every((c) => !c.showOnline));
  ok(await req('/api/products', { method: 'POST', body: { name: '[Product]', sku: '[new lights]', category: 'Lights', price: 5 } }), 201);
  assert.equal((await showing(req)).categories.find((c) => c.path === 'Lights').showOnline, false);
  assert.equal((await switches(shop.id))['[new lights]'], false);
});

test('Change asks set-up step 3’s question again, with the same rule for products, and a new date', async (t) => {
  const { shop, req } = await freshShop(t, '[Change start shop]');
  await addProducts(req);
  ok(await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, startWith: 'nothing' } }));
  const first = (await showing(req)).startedAt;
  await runWithShop(shop.id, () => prepare("UPDATE website SET started_with_at = now() - interval '2 days'").run());
  const state = ok(await req('/api/website/start-with', { method: 'POST', body: { startWith: 'every' } }));
  assert.equal(state.startedWith, 'every');
  assert.ok(Date.parse(state.startedAt) > Date.parse(first) - 60_000, 'the date the question was answered');
  assert.ok(state.categories.every((c) => c.showOnline));
  // setUp's rule: active products with a price on, the unpriced one off until priced.
  const now = await switches(shop.id);
  assert.equal(now['[bearing 1]'], true);
  assert.equal(now['[bearing no price]'], false);
  assert.equal(now['[derailleur]'], true);
  ok(await req('/api/website/start-with', { method: 'POST', body: { startWith: 'nothing' } }));
  assert.ok(Object.values(await switches(shop.id)).every((on) => on === false));
});

test('Change is refused before set-up and without a choice; a category switch needs a real category and On or Off', async (t) => {
  const { req } = await freshShop(t, '[Refused shop]');
  await addProducts(req);
  ok(await req('/api/website/start-with', { method: 'POST', body: { startWith: 'every' } }), 409);
  ok(await req('/api/website/set-up', { method: 'POST', body: SET_UP }));
  ok(await req('/api/website/start-with', { method: 'POST', body: { startWith: 'some' } }), 400);
  ok(await req('/api/website/categories/999999999', { method: 'PUT', body: { showOnline: false } }), 404);
  const state = await showing(req);
  ok(await req(`/api/website/categories/${categoryId(state, 'Bearings')}`, { method: 'PUT', body: { showOnline: 'no' } }), 400);
  assert.equal((await showing(req)).categories.find((c) => c.path === 'Bearings').showOnline, true);
});

test('only the Owner reads or changes Showing products', async (t) => {
  const { shop, req } = await freshShop(t, '[Owner only shop]');
  await addProducts(req);
  const made = ok(await req('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } }), 201);
  const cookie = await staffFreshCookie(made.loginId);
  const asJo = (p, options) => staffRequest(server.baseUrl, cookie, p, options);
  const state = await showing(req);
  ok(await asJo('/api/website/showing'), 403);
  ok(await asJo(`/api/website/categories/${categoryId(state, 'Bearings')}`, { method: 'PUT', body: { showOnline: false } }), 403);
  ok(await asJo('/api/website/start-with', { method: 'POST', body: { startWith: 'nothing' } }), 403);
  assert.equal((await switches(shop.id))['[bearing 1]'], true);
});

test('the website’s start choice holds only every or nothing', async (t) => {
  const { shop, req } = await freshShop(t, '[Check shop]');
  ok(await req('/api/website'));
  await assert.rejects(runWithShop(shop.id, () => prepare("UPDATE website SET started_with = 'some'").run()), /check/i);
});
