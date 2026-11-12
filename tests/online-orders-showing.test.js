// Showing products: a switch on each category (openspec/changes/website-buy-online,
// task 2.4; specs/settings "Showing products is switched on each category"; design,
// decided while planning 15; drawing on-settings-show). A category's switch sets
// every product in it, and in the categories under it; a new product follows its
// category; Settings counts the products set differently, and Stock's See them
// lists them. The website's set-up asks step 3 through the same code.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
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
  const add = async (productName, category, over = {}) => ok(await req('/api/products', { method: 'POST', body: { name: productName, category, pricePence: 1299, ...over } }), 201).id;
  const shown = async (id) => (await runWithShop(s.shop.id, () => prepare('SELECT show_online FROM products WHERE id = ?').get(id))).show_online;
  const showing = async () => ok(await req('/api/online-orders-settings')).showing;
  const category = async (path) => (await showing()).categories.find((c) => c.path === path);
  const turn = async (path, showOnline) => req(`/api/online-orders-settings/categories/${(await category(path)).id}`, { method: 'PUT', body: { showOnline } });
  return { ...s, req, add, shown, showing, category, turn };
}

test('every category is listed with its switch, on to start, in the order of its path', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  await shop.add('[Product one]', 'Drivetrain › Derailleurs');
  await shop.add('[Product two]', 'Bearings');
  const { categories, setDifferently } = await shop.showing();
  assert.deepEqual(categories.map((c) => [c.path, c.showOnline]), [['Bearings', true], ['Drivetrain', true], ['Drivetrain › Derailleurs', true]]);
  assert.equal(setDifferently, 0);
});

test('a category switched off takes every product in it off the website, and the categories under it; on puts them back', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  const chain = await shop.add('[Chain]', 'Drivetrain');
  const mech = await shop.add('[Rear mech]', 'Drivetrain › Derailleurs');
  const bearing = await shop.add('[Bearing]', 'Bearings');
  // A category whose name starts the same, but isn't under it.
  const other = await shop.add('[Other]', 'Drivetrainers');
  for (const id of [chain, mech, bearing, other]) assert.equal(await shop.shown(id), true, 'a new product follows its category, which starts on');

  const body = ok(await shop.turn('Drivetrain', false));
  assert.deepEqual(body.showing.categories.map((c) => [c.path, c.showOnline]),
    [['Bearings', true], ['Drivetrain', false], ['Drivetrain › Derailleurs', false], ['Drivetrainers', true]]);
  assert.deepEqual([await shop.shown(chain), await shop.shown(mech), await shop.shown(bearing), await shop.shown(other)], [false, false, true, true]);
  assert.equal(body.showing.setDifferently, 0, 'set by their category, so none differs');

  ok(await shop.turn('Drivetrain', true));
  assert.deepEqual([await shop.shown(chain), await shop.shown(mech)], [true, true]);
});

test('a category switch needs on or off, and a category that isn’t the shop’s is not found', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  await shop.add('[Bearing]', 'Bearings');
  const res = await shop.turn('Bearings', 'yes');
  assert.equal(res.status, 400);
  assert.equal((await shop.category('Bearings')).showOnline, true, 'nothing saved');

  const another = await freshShop(t, '[Another shop]');
  await another.add('[Their bearing]', 'Bearings');
  const theirs = (await another.category('Bearings')).id;
  assert.equal((await shop.req(`/api/online-orders-settings/categories/${theirs}`, { method: 'PUT', body: { showOnline: false } })).status, 404);
  assert.equal((await another.category('Bearings')).showOnline, true);
});

test('a new product follows its category: off in a category that is off, on in one that is on', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  await shop.add('[Bearing]', 'Bearings');
  await shop.add('[Chain]', 'Drivetrain');
  ok(await shop.turn('Bearings', false));
  assert.equal(await shop.shown(await shop.add('[New bearing]', 'Bearings')), false);
  assert.equal(await shop.shown(await shop.add('[New chain]', 'Drivetrain')), true);
  // A new sub-category starts as the category above it.
  assert.equal(await shop.shown(await shop.add('[New cup]', 'Bearings › Cups')), false);
  assert.equal((await shop.category('Bearings › Cups')).showOnline, false);
  // So does a new size and colour group's product.
  const group = ok(await shop.req('/api/product-groups', { method: 'POST', body: { name: '[Jersey]', category: 'Bearings', sizes: [{ size: 'M', pricePence: 3000 }] } }), 201);
  const size = await runWithShop(shop.shop.id, () => prepare('SELECT id FROM products WHERE group_id = ?').get(group.id));
  assert.equal(await shop.shown(size.id), false);
});

test('an item imported from a supplier’s catalogue follows its category too', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  await shop.add('[Bearing]', 'Bearings');
  ok(await shop.turn('Bearings', false));
  const item = await runWithShop(shop.shop.id, async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run();
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, '[CODE-1]', '[Catalogue item]', 14, 0, 'new')").run(supplier.lastInsertRowid)).lastInsertRowid;
  });
  const imported = ok(await shop.req(`/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 28, category: 'Bearings' } }), 201);
  assert.equal(await shop.shown(imported.id), false);
});

test('two products switched off on their own are counted as set differently, and Stock’s See them lists them', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  const a = await shop.add('[Bearing A]', 'Bearings');
  const b = await shop.add('[Bearing B]', 'Bearings');
  await shop.add('[Bearing C]', 'Bearings');
  // No price: off until priced (the set-up's rule), so not counted as set differently.
  const unpriced = await shop.add('[Bearing D]', 'Bearings', { pricePence: 0 });
  await runWithShop(shop.shop.id, () => prepare('UPDATE products SET show_online = false WHERE id = ?').run(unpriced));
  for (const id of [a, b]) ok(await shop.req(`/api/products/${id}`, { method: 'PUT', body: { showOnline: false } }));
  assert.equal((await shop.showing()).setDifferently, 2);
  const listed = ok(await shop.req('/api/stock-list?show=set-differently')).rows.map((r) => r.id).sort();
  assert.deepEqual(listed, [a, b].sort());
  // One switched on in a category that is off counts too.
  ok(await shop.turn('Bearings', false));
  ok(await shop.req(`/api/products/${a}`, { method: 'PUT', body: { showOnline: true } }));
  assert.equal((await shop.showing()).setDifferently, 1);
});

test('the website’s set-up asks step 3 through the same code: nothing online switches every category off too, so new products stay off', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  const bearing = await shop.add('[Bearing]', 'Bearings');
  ok(await shop.req('/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'nothing', mainColour: '#2B2B2B' } }));
  assert.equal(await shop.shown(bearing), false);
  assert.equal((await shop.category('Bearings')).showOnline, false);
  assert.equal(await shop.shown(await shop.add('[New bearing]', 'Bearings')), false);
  assert.equal((await shop.showing()).setDifferently, 0);
});

test('every product online: categories on, priced products on, and none counted as set differently', async (t) => {
  const shop = await freshShop(t, '[Showing shop]');
  const bearing = await shop.add('[Bearing]', 'Bearings');
  await shop.add('[Unpriced]', 'Bearings', { pricePence: 0 });
  ok(await shop.turn('Bearings', false));
  ok(await shop.req('/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'every', mainColour: '#2B2B2B' } }));
  assert.equal((await shop.category('Bearings')).showOnline, true);
  assert.equal(await shop.shown(bearing), true);
  assert.equal((await shop.showing()).setDifferently, 0);
});
