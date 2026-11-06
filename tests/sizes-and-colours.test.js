// Sizes and colours (openspec/changes/sizes-and-colours; stock control decision 4; Jack's
// answer 5): each size its own product, joined in a group. The new stock list's server
// and a group's page. Jack Lewis, Jo Taylor and Shimano brake pads as drawn; the product
// with sizes, its sizes, colours, prices and codes are placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { moveStock } from '../server/lib/stock.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
let group;
const sizes = {};
let pads;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  // Groups aren't made through a screen until product-editing (piece 6): made here as it will.
  await runWithShop(owner.shop.id, async () => {
    group = (await prepare("INSERT INTO product_groups (name, category) VALUES ('[Jersey]', '[Clothing]') RETURNING id").get()).id;
    const size = async (key, s, colour, price, stock, threshold = 0) => {
      const id = (await prepare(
        `INSERT INTO products (name, sku, barcode, category, price, cost, group_id, size, colour, low_stock_threshold, updated_at)
         VALUES (?, ?, ?, '[Clothing]', ?, 10, ?, ?, ?, ?, now()) RETURNING id`
      ).get(`[Jersey] ${s} ${colour}`, `JER-${key}`, `50000000${key}`, price, group, s, colour, threshold)).id;
      if (stock) {
        await dbExec('BEGIN');
        await moveStock([{ productId: id, change: stock, type: 'intake' }]);
        await dbExec('COMMIT');
      }
      sizes[key] = id;
    };
    await size('11', 'M', '[Red]', 30, 4);
    await size('12', 'L', '[Red]', 30, 2, 3);
    await size('13', 'M', '[Blue]', 35, -1, 3); // below zero, so not running low as well
    pads = (await prepare("INSERT INTO products (name, sku, barcode, category, price, cost, updated_at) VALUES ('Shimano brake pads', 'B05S-RX', '4524667000001', 'Brakes', 28, 14, now()) RETURNING id").get()).id;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path) => staffRequest(server.baseUrl, who.cookie, path);
const listOf = async (search = '', who = owner) => (await as(who, `/api/stock-list${search ? `?search=${encodeURIComponent(search)}` : ''}`)).body.rows;

test('the list: one row for the group with its total, sizes, colours and prices, and one for a product with none', async () => {
  const rows = await listOf();
  const jersey = rows.find((r) => r.kind === 'group');
  assert.deepEqual(
    [jersey.groupId, jersey.name, jersey.category, jersey.sizes, jersey.colours, jersey.stockQty, jersey.sizesBelowZero, jersey.sizesRunningLow, jersey.priceLowPence, jersey.priceHighPence],
    [group, '[Jersey]', '[Clothing]', 2, 2, 5, 1, 1, 3000, 3500]
  );
  const brake = rows.find((r) => r.kind === 'product');
  assert.deepEqual([brake.id, brake.name, brake.pricePence], [pads, 'Shimano brake pads', 2800]);
  assert.equal(rows.length, 2, 'no size has a row of its own');
});

test('searching a size finds that size in each colour; a size and colour finds the one', async () => {
  const m = await listOf('jersey M');
  assert.deepEqual(m.map((r) => [r.kind, r.id, r.name, r.size, r.colour]).sort((a, b) => a[1] - b[1]),
    [['size', sizes['11'], '[Jersey]', 'M', '[Red]'], ['size', sizes['13'], '[Jersey]', 'M', '[Blue]']]);
  // A size or colour is a whole name: "L" isn't in "[Blue]".
  assert.deepEqual((await listOf('jersey L')).map((r) => r.id), [sizes['12']]);
  const one = await listOf('m [blue] jersey');
  assert.deepEqual(one.map((r) => [r.id, r.stockQty, r.pricePence]), [[sizes['13'], -1, 3500]]);
});

test('a barcode or a code lands on its size; the name lands on the group', async () => {
  assert.deepEqual((await listOf('5000000012')).map((r) => [r.kind, r.id]), [['size', sizes['12']]]);
  assert.deepEqual((await listOf('jer-11')).map((r) => [r.kind, r.id]), [['size', sizes['11']]]);
  assert.deepEqual((await listOf('jers')).map((r) => [r.kind, r.groupId]), [['group', group]]);
  assert.deepEqual((await listOf('brake')).map((r) => [r.kind, r.id]), [['product', pads]]);
  assert.deepEqual(await listOf('jersey XL'), [], 'a size it hasn’t is nothing');
});

test('a group’s page: each size and colour with its own barcode, stock and price, in the order they were made', async () => {
  const page = (await as(owner, `/api/product-groups/${group}`)).body;
  assert.deepEqual([page.name, page.category, page.sizes, page.colours], ['[Jersey]', '[Clothing]', ['M', 'L'], ['[Red]', '[Blue]']]);
  assert.deepEqual(page.items.map((i) => [i.id, i.size, i.colour, i.barcode, i.stockQty, i.pricePence, i.costPence]), [
    [sizes['11'], 'M', '[Red]', '5000000011', 4, 3000, 1000],
    [sizes['12'], 'L', '[Red]', '5000000012', 2, 3000, 1000],
    [sizes['13'], 'M', '[Blue]', '5000000013', -1, 3500, 1000],
  ]);
});

test('staff see the list and a group, with no cost or margin', async () => {
  const jersey = (await listOf('', jo)).find((r) => r.kind === 'group');
  assert.ok(jersey.costLowPence === null && jersey.costHighPence === null);
  const page = (await as(jo, `/api/product-groups/${group}`)).body;
  assert.ok(page.items.every((i) => i.costPence === null));
});

test('another business sees none of it', async () => {
  assert.deepEqual(await listOf('', other), []);
  assert.equal((await as(other, `/api/product-groups/${group}`)).status, 404);
  assert.equal((await as(owner, '/api/product-groups/abc')).status, 404);
});

test('each size is still a product to everything else: its own row, sold and counted as it always was', async () => {
  const flat = (await as(owner, '/api/products')).body;
  const mine = flat.filter((p) => p.groupId === group).map((p) => [p.id, p.size, p.colour]);
  assert.deepEqual(mine.sort((a, b) => a[0] - b[0]), [[sizes['11'], 'M', '[Red]'], [sizes['12'], 'L', '[Red]'], [sizes['13'], 'M', '[Blue]']]);
  assert.ok(flat.find((p) => p.id === pads).groupId === null);
});

// ---- From the independent review ----

// A business of its own, so its list holds only what each test puts there.
async function shopWith(fill) {
  const shop = await staffSignup(server.baseUrl);
  await runWithShop(shop.shop.id, () => fill(prepare));
  return shop;
}
const sized = (prep, group, s, colour, { price = 10, stock = 0, threshold = 0, active = 1 } = {}) => prep(
  `INSERT INTO products (name, sku, category, price, stock_qty, group_id, size, colour, low_stock_threshold, active, updated_at)
   SELECT name, ?, category, ?, ?, id, ?, ?, ?, ?, now() FROM product_groups WHERE id = ? RETURNING id`
).get(`${group}-${s}-${colour}-${randomUUID().slice(0, 4)}`, price, stock, s, colour, threshold, active, group);

test('a size at exactly nothing isn’t below zero, and an off-sale size counts only with all', async () => {
  const shop = await shopWith(async (prep) => {
    const g = (await prep("INSERT INTO product_groups (name, category) VALUES ('[Gloves]', '[Clothing]') RETURNING id").get()).id;
    await sized(prep, g, 'S', '[Black]', { stock: 0 });
    await sized(prep, g, 'M', '[Black]', { stock: -2, threshold: 3 });
    await sized(prep, g, 'L', '[Black]', { stock: 5, price: 40, active: 0 });
  });
  try {
    const row = async (q = '') => (await as(shop, `/api/stock-list${q}`)).body.rows.find((r) => r.kind === 'group');
    const shown = await row();
    assert.deepEqual([shown.sizes, shown.stockQty, shown.sizesBelowZero, shown.sizesRunningLow, shown.priceHighPence], [2, -2, 1, 0, 1000]);
    const all = await row('?all=1');
    assert.deepEqual([all.sizes, all.stockQty, all.sizesBelowZero, all.priceHighPence], [3, 3, 1, 4000]);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

// The list's screen works out a margin as a product's page does, with its own VAT rate
// (openspec/changes/stock-list-categories-sizes); a product with sizes has one only when
// every size shares it.
test('each row carries its VAT rate; a product with sizes only when its sizes share one', async () => {
  const shop = await shopWith(async (prep) => {
    await prep("INSERT INTO products (name, category, price, vat_rate_bp, updated_at) VALUES ('[Child seat]', '[Cat]', 1, 500, now())").run();
    const same = (await prep("INSERT INTO product_groups (name, category) VALUES ('[Gloves]', '[Cat]') RETURNING id").get()).id;
    await sized(prep, same, 'S', null);
    await sized(prep, same, 'M', null);
    const mixed = (await prep("INSERT INTO product_groups (name, category) VALUES ('[Shorts]', '[Cat]') RETURNING id").get()).id;
    await sized(prep, mixed, 'S', null);
    const m = (await sized(prep, mixed, 'M', null)).id;
    await prep('UPDATE products SET vat_rate_bp = 0 WHERE id = ?').run(m);
  });
  try {
    const rows = (await as(shop, '/api/stock-list')).body.rows;
    assert.deepEqual(rows.map((r) => [r.name, r.vatRateBp]), [['[Child seat]', 500], ['[Gloves]', 2000], ['[Shorts]', null]]);
    const sizeRow = (await as(shop, `/api/stock-list?search=${encodeURIComponent('[Shorts] M')}`)).body.rows;
    assert.deepEqual(sizeRow.map((r) => [r.kind, r.vatRateBp]), [['size', 0]]);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

test('a product with sizes sits in its category and name order with the rest', async () => {
  const shop = await shopWith(async (prep) => {
    await prep("INSERT INTO products (name, category, price, updated_at) VALUES ('[Z product]', '[Cat Z]', 1, now()), ('[A product]', '[Cat A]', 1, now()) RETURNING id").all();
    const g = (await prep("INSERT INTO product_groups (name, category) VALUES ('[M group]', '[Cat M]') RETURNING id").get()).id;
    await sized(prep, g, 'M', null);
  });
  try {
    const rows = (await as(shop, '/api/stock-list')).body.rows;
    assert.deepEqual(rows.map((r) => r.name), ['[A product]', '[M group]', '[Z product]']);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

test('renaming or moving a category takes a product with sizes’ category with it', async () => {
  const shop = await staffSignup(server.baseUrl);
  try {
    const call = (path, method, body) => staffRequest(server.baseUrl, shop.cookie, path, { method, body });
    const kit = (await call('/api/product-categories', 'POST', { name: '[Kit]' })).body;
    const tops = (await call('/api/product-categories', 'POST', { name: '[Tops]', parentId: kit.id })).body;
    const other = (await call('/api/product-categories', 'POST', { name: '[Other]' })).body;
    await runWithShop(shop.shop.id, async () => {
      const g = (await prepare("INSERT INTO product_groups (name, category) VALUES ('[Jersey]', '[Kit] › [Tops]') RETURNING id").get()).id;
      await sized(prepare, g, 'M', null);
    });
    const category = async () => (await call('/api/stock-list', 'GET')).body.rows.find((r) => r.kind === 'group').category;
    assert.equal((await call(`/api/product-categories/${kit.id}`, 'PUT', { name: '[Clothes]' })).status, 200);
    assert.equal(await category(), '[Clothes] › [Tops]');
    assert.equal((await call(`/api/product-categories/${tops.id}`, 'PUT', { parentId: other.id })).status, 200);
    assert.equal(await category(), '[Other] › [Tops]');
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});
