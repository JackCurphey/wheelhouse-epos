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
