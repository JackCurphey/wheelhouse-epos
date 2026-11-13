// The stock list and a product's page, the server (openspec/changes/stock-list;
// st-list, st-product; stock control decisions 2, 3 and 11): a product's page
// reads the product and its stock history newest first, Staff get no cost,
// and the list's search finds a supplier and carries each VAT rate.
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
let other;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  jo = await staffLogin(owner.shop.id);
  other = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);

// Shimano brake pads B05S-RX at £28.00, as drawn; the cost, stock and
// supplier are bracketed placeholders.
let n = 0;
async function pads(over = {}) {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, category: '[Category]', supplier: '[Supplier]', price: 28, cost: 14, stockQty: 6, ...over } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('a product’s page: the product and its stock history, newest first', async () => {
  const p = await pads();
  await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: -1, type: 'adjustment', reason: 'damaged', note: 'Damaged' } });
  await runWithShop(owner.shop.id, () => prepare("INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, -2, 'till_sale', 'Till sale B1-[0000]')").run(p.id));
  const res = await staff(`/api/products/${p.id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.name, 'Shimano brake pads');
  assert.equal(res.body.stockQty, 5);
  assert.equal(res.body.cost, 14);
  assert.equal(res.body.vatRateBp, 2000);
  assert.deepEqual(res.body.history.map((h) => [h.type, h.change, h.note]), [
    ['till_sale', -2, 'Till sale B1-[0000]'],
    ['adjustment', -1, 'Damaged'],
    ['intake', 6, 'Initial stock'],
  ]);
  assert.ok(res.body.history.every((h) => Number.isInteger(h.id) && !Number.isNaN(Date.parse(h.at))));
});

test('Staff get no cost on a product’s page (stock decision 11)', async () => {
  const p = await pads();
  const res = await staff(`/api/products/${p.id}`, {}, jo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cost, null);
  assert.equal(res.body.price, 28);
});

test('a product taken off sale still opens; another shop’s, or none, is not found', async () => {
  const p = await pads();
  await staff(`/api/products/${p.id}`, { method: 'DELETE' });
  const gone = await staff(`/api/products/${p.id}`);
  assert.equal(gone.status, 200);
  assert.equal(gone.body.active, false);
  const theirs = await staff(`/api/products/${p.id}`, {}, other);
  assert.equal(theirs.status, 404);
  assert.equal(theirs.body.error, 'Product not found');
  assert.equal((await staff('/api/products/999999')).status, 404);
  assert.equal((await staff('/api/products/not-a-number')).status, 404);
});

test('the list’s search finds a supplier, and each product carries its VAT rate', async () => {
  await pads({ supplier: '[Second supplier]' });
  const res = await staff('/api/products?search=second%20supplier');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.supplier), ['[Second supplier]']);
  assert.equal(res.body[0].vatRateBp, 2000);
});

// The review of stock-list (26 Oct).
test('a product’s page sends its newest 200 stock movements, not every one ever', async () => {
  const p = await pads();
  await runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO stock_movements (product_id, type, change_qty, note, created_at) SELECT ?, 'sale', -1, '', now() - (g || ' minutes')::interval FROM generate_series(1, 250) g RETURNING id"
  ).all(p.id));
  const page = (await staff(`/api/products/${p.id}`)).body;
  assert.equal(page.history.length, 200);
});

test('% and _ in a search are plain characters, not wildcards', async () => {
  const plain = await pads({ name: 'Plain tube' });
  const odd = await pads({ name: 'Tube 50% off' });
  const found = async (q) => (await staff(`/api/products?search=${encodeURIComponent(q)}`)).body.map((x) => x.id);
  assert.equal((await found('_')).includes(plain.id), false, '_ matches only an underscore');
  assert.equal((await found('50%')).includes(odd.id), true);
  assert.equal((await found('%')).includes(plain.id), false, '% matches only a percent sign');
});

// Jack's answer to Q1 (12 Nov, docs/decisions/2026-11-12-website-defaults-taken.md): the Website
// page's See them opens Stock filtered to the products it counted (server/website.js
// productCounts and startCounts): no photo is priced with no photo; no price is a price of 0.
// online=1 keeps to the products switched to show on the website, as the Website page counts.
test('show=no-photo and show=no-price list just the products the Website page counts', async () => {
  const shown = await pads({ name: 'Website pads shown no photo' });
  const hidden = await pads({ name: 'Website pads hidden no photo', showOnline: false });
  const pictured = await pads({ name: 'Website pads with photo' });
  const free = await pads({ name: 'Website pads no price', price: 0 });
  await runWithShop(owner.shop.id, async () => {
    await prepare('UPDATE products SET show_online = true WHERE id = ANY(?::int[])').run([shown.id, pictured.id, free.id]);
    await prepare("UPDATE products SET photo_url = '/photos/[photo].jpg' WHERE id = ?").run(pictured.id);
  });
  const names = async (q) => {
    const res = await staff(`/api/stock-list?search=${encodeURIComponent('Website pads')}&${q}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.rows.map((r) => r.name).sort();
  };
  assert.deepEqual(await names('show=no-photo'), ['Website pads hidden no photo', 'Website pads shown no photo']);
  assert.deepEqual(await names('show=no-photo&online=1'), ['Website pads shown no photo']);
  assert.deepEqual(await names('show=no-price'), ['Website pads no price']);
  assert.deepEqual(await names('show=no-price&online=1'), ['Website pads no price']);
  assert.equal((await names('show=anything-else')).length, 4, 'an unknown show filters nothing');
});

// The review of PR #737: each product the Website page counts is one row, so the link's list is
// as long as the count beside it, including sizes of one product, an empty photo, a product taken
// off sale, one not shown online, and a price below zero (counted as neither).
test('show= lists one row per counted product, with the same edges as the counts', async () => {
  const sizeA = await pads({ name: 'Counted pads size A' });
  const sizeB = await pads({ name: 'Counted pads size B' });
  const blank = await pads({ name: 'Counted pads blank photo' });
  const gone = await pads({ name: 'Counted pads off sale' });
  const offline = await pads({ name: 'Counted pads offline free', price: 0, showOnline: false });
  const below = await pads({ name: 'Counted pads below zero' });
  await runWithShop(owner.shop.id, async () => {
    const g = await prepare("INSERT INTO product_groups (name, category) VALUES ('Counted pads sized', '[Category]') RETURNING id").get();
    await prepare("UPDATE products SET group_id = ?, size = CASE WHEN id = ? THEN 'S' ELSE 'M' END WHERE id = ANY(?::int[])").run(g.id, sizeA.id, [sizeA.id, sizeB.id]);
    await prepare("UPDATE products SET photo_url = '' WHERE id = ?").run(blank.id);
    await prepare('UPDATE products SET active = 0 WHERE id = ?').run(gone.id);
    await prepare('UPDATE products SET price = -1 WHERE id = ?').run(below.id);
  });
  const rows = async (q) => {
    const res = await staff(`/api/stock-list?search=${encodeURIComponent('Counted pads')}&${q}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.rows.map((r) => r.id ?? `group ${r.groupId}`).sort();
  };
  assert.deepEqual(await rows('show=no-photo'), [sizeA.id, sizeB.id, blank.id].sort(), 'both sizes, the empty photo; not off sale or below zero');
  assert.deepEqual(await rows('show=no-price'), [offline.id], 'a price below zero is not "no price"');
  assert.deepEqual(await rows('show=no-price&online=1'), [], 'not shown online');
});
