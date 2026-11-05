// A size on a count's line (openspec/changes/sizes-and-colours; tk-count-below, tk-diff:
// "[Product with sizes]" over "Size M · [Colour 1]"). Each size is its own product, so a
// count counts it as one: only its name and line change. Jack Lewis as drawn; the rest
// placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let m;
let l;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await runWithShop(owner.shop.id, async () => {
    const group = (await prepare("INSERT INTO product_groups (name, category) VALUES ('[Product with sizes]', '[Clothing]') RETURNING id").get()).id;
    const size = async (s, colour, key) => (await prepare(
      `INSERT INTO products (name, sku, barcode, category, price, cost, group_id, size, colour, updated_at)
       VALUES (?, ?, ?, '[Clothing]', 30, 10, ?, ?, ?, now()) RETURNING id`
    ).get(`[Product with sizes] ${s}`, `SZ-${key}`, `6000000${key}`, group, s, colour)).id;
    m = await size('M', '[Colour 1]', '01');
    l = await size('L', null, '02');
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const POST = (body = {}) => ({ method: 'POST', body });
const named = (r) => [r.name, r.size, r.colour];

test('a size is named by its product with sizes, and says its size and colour, wherever a count lists it', async () => {
  const take = (await staff('/api/stock-takes', POST({ kind: 'category', target: '[Clothing]' }))).body;
  assert.equal((await staff(`/api/stock-takes/${take.id}/join`, POST())).status, 200);
  // Scanning its barcode.
  const found = (await staff(`/api/stock-takes/${take.id}/products?search=600000001`)).body;
  assert.deepEqual(found.map(named), [['[Product with sizes]', 'M', '[Colour 1]']]);
  assert.equal((await staff(`/api/stock-takes/${take.id}/counts`, POST({ productId: m, qty: 2 }))).status, 200);
  // The counter's own lines.
  assert.deepEqual((await staff(`/api/stock-takes/${take.id}`)).body.mine.map(named), [['[Product with sizes]', 'M', '[Colour 1]']]);
  // The check: what differs, and what nobody counted.
  const check = (await staff(`/api/stock-takes/${take.id}/check`)).body;
  assert.deepEqual(check.rows.map(named), [['[Product with sizes]', 'M', '[Colour 1]']]);
  assert.deepEqual(check.notCounted.list.map(named), [['[Product with sizes]', 'L', null]]);
  // A recount asked for.
  assert.equal((await staff(`/api/stock-takes/${take.id}/recount`, POST({ productId: m }))).status, 200);
  assert.deepEqual((await staff(`/api/stock-takes/${take.id}/check`)).body.recountAsked.map(named), [['[Product with sizes]', 'M', '[Colour 1]']]);
  assert.equal((await staff(`/api/stock-takes/${take.id}/counts`, POST({ productId: m, qty: 2 }))).status, 200);
  // The download has a column for each.
  const res = await fetch(`${server.baseUrl}/api/stock-takes/${take.id}/download`, { headers: { cookie: owner.cookie } });
  const [head, row] = (await res.text()).trim().split('\n');
  assert.match(head, /^Product,Size,Colour,Supplier code,/);
  assert.match(row, /^\[Product with sizes\],M,\[Colour 1\],SZ-01,/);
  // Applied, its results say so too.
  assert.equal((await staff(`/api/stock-takes/${take.id}/apply`, POST())).status, 200);
  const applied = (await staff(`/api/stock-takes/${take.id}/check`)).body;
  assert.deepEqual(applied.rows.map(named), [['[Product with sizes]', 'M', '[Colour 1]']]);
});

test('a below-zero count’s still-to-find list names the size', async () => {
  await runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = -1 WHERE id = ? RETURNING id').get(l));
  await runWithShop(owner.shop.id, () => prepare('INSERT INTO product_stock (site_id, product_id, qty) SELECT id, ?, -1 FROM sites ORDER BY id LIMIT 1 RETURNING product_id').get(l));
  const take = (await staff('/api/stock-takes', POST({ kind: 'below_zero' }))).body;
  assert.deepEqual((await staff(`/api/stock-takes/${take.id}`)).body.stillToFind.map(named), [['[Product with sizes]', 'L', null]]);
});
