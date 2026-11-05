// The category tree (openspec/changes/category-tree): a product's text category is always
// a category's whole path, and wherever it's written the categories in it are found or
// made. Drivetrain › Derailleurs, Bearings, Jack Lewis and Shimano brake pads as drawn;
// the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { tidyCategory } from '../server/lib/categories.js';
import { ROW_APPLIERS } from '../server/move/bring-across.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const inShop = (fn, who = owner) => runWithShop(who.shop.id, fn);
const tree = (who = owner) => inShop(() => prepare(`SELECT c.name, c.path, p.path AS parent FROM product_categories c
  LEFT JOIN product_categories p ON p.id = c.parent_id ORDER BY c.path COLLATE "C"`).all(), who);
const textOf = async (id) => (await inShop(() => prepare('SELECT category FROM products WHERE id = ?').get(id))).category;
let n = 0;
const add = async (category, who = owner) => {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, category, price: 28 } }, who);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
};

test('tidying: split on ›, each part trimmed, empty parts dropped; nothing left is Uncategorised', () => {
  assert.equal(tidyCategory('Drivetrain › Derailleurs'), 'Drivetrain › Derailleurs');
  assert.equal(tidyCategory('  Drivetrain ›Derailleurs  '), 'Drivetrain › Derailleurs');
  assert.equal(tidyCategory('Drivetrain › › Derailleurs ›'), 'Drivetrain › Derailleurs');
  assert.equal(tidyCategory(' › '), 'Uncategorised');
  assert.equal(tidyCategory(''), 'Uncategorised');
  assert.equal(tidyCategory('Uncategorised'), 'Uncategorised');
  assert.equal(tidyCategory('bearings'), 'bearings', 'its case kept');
});

test('adding a product makes the categories in its path, and saves the path tidied', async () => {
  const id = await add('  Drivetrain ›Derailleurs ');
  assert.equal(await textOf(id), 'Drivetrain › Derailleurs');
  assert.deepEqual(await tree(), [
    { name: 'Drivetrain', path: 'Drivetrain', parent: null },
    { name: 'Derailleurs', path: 'Drivetrain › Derailleurs', parent: 'Drivetrain' },
  ]);
  await add('Drivetrain');
  assert.equal((await tree()).length, 2, 'one already there is used');
});

test('a product with no category, or Uncategorised, makes none', async () => {
  const before = (await tree()).length;
  assert.equal(await textOf(await add('')), 'Uncategorised');
  assert.equal(await textOf(await add('Uncategorised')), 'Uncategorised');
  assert.equal((await tree()).length, before);
});

test('saving a product’s category makes its path too', async () => {
  const id = await add('Bearings');
  const res = await staff(`/api/products/${id}`, { method: 'PUT', body: { category: 'Bearings › [Sealed] ' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await textOf(id), 'Bearings › [Sealed]');
  assert.ok((await tree()).some((c) => c.path === 'Bearings › [Sealed]' && c.parent === 'Bearings'));
});

test('a supplier’s item imported into a category makes it', async () => {
  const item = await inShop(async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run();
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, '[Catalogue item]', 14, 0, 'new')").run(supplier.lastInsertRowid, `CAT-${randomUUID().slice(0, 6)}`)).lastInsertRowid;
  });
  const res = await staff(`/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 28, category: '[Wheels] ›  [Hubs]' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await textOf(res.body.id), '[Wheels] › [Hubs]');
  assert.ok((await tree()).some((c) => c.path === '[Wheels] › [Hubs]'));
});

test('a Citrus Lime row makes its Department › Category', async () => {
  const sku = `CL-${randomUUID().slice(0, 6)}`;
  await inShop(async () => {
    await dbExec('BEGIN');
    const done = await ROW_APPLIERS.price_list({ 'Item Lookup Code': sku, Description: 'Shimano brake pads', Price: '28', Department: '[Brakes] ', Category: ' [Pads]' }, { sent_by_login_id: owner.loginId }, { firstStore: '' });
    assert.equal(done.state, 'in');
    await dbExec('COMMIT');
  });
  const { category } = await inShop(() => prepare('SELECT category FROM products WHERE sku = ?').get(sku));
  assert.equal(category, '[Brakes] › [Pads]');
  assert.ok((await tree()).some((c) => c.path === '[Brakes] › [Pads]' && c.parent === '[Brakes]'));
});

test('many products into one new path at once make it once', async () => {
  n += 100;
  const base = n;
  const answers = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `RACE-${base + i}`, category: '[Race] › [Same]', price: 28 } })));
  assert.deepEqual(answers.map((a) => a.status), [201, 201, 201, 201, 201, 201]);
  assert.deepEqual((await tree()).filter((c) => c.path.startsWith('[Race]')).map((c) => c.path), ['[Race]', '[Race] › [Same]']);
});

test('another business’s categories are its own', async () => {
  await add('Bearings', other);
  assert.deepEqual((await tree(other)).map((c) => c.path), ['Bearings']);
  assert.ok((await tree()).every((c) => c.path !== undefined));
  const mine = await inShop(() => prepare("SELECT id FROM product_categories WHERE path = 'Bearings'").get());
  const seen = await inShop(() => prepare('SELECT id FROM product_categories WHERE id = ?').get(mine.id), other);
  assert.ok(seen === undefined || seen === null);
});

// ---- From the independent review ----

test('"Uncategorised" inside a path isn’t a category: the rest of the path is', async () => {
  assert.equal(tidyCategory('Uncategorised › Tyres'), 'Tyres');
  assert.equal(tidyCategory('[Wheels] › Uncategorised'), '[Wheels]');
  assert.equal(tidyCategory(' Uncategorised › Uncategorised '), 'Uncategorised');
  const id = await add('Uncategorised › [Thing]');
  assert.equal(await textOf(id), '[Thing]');
  assert.ok(!(await tree()).some((c) => c.name === 'Uncategorised'));
});

test('a Citrus Lime row already here makes no category: the old names don’t come back after a rename', async () => {
  const sku = `CL-AGAIN-${randomUUID().slice(0, 6)}`;
  const row = { 'Item Lookup Code': sku, Description: 'Shimano brake pads', Price: '28', Department: '[Again]', Category: '[Old name]' };
  const bring = () => inShop(async () => {
    await dbExec('BEGIN');
    const done = await ROW_APPLIERS.price_list(row, { sent_by_login_id: owner.loginId }, { firstStore: '' });
    await dbExec('COMMIT');
    return done.state;
  });
  assert.equal(await bring(), 'in');
  await inShop(async () => {
    await prepare("UPDATE product_categories SET name = '[New name]', path = '[Again] › [New name]' WHERE path = '[Again] › [Old name]' RETURNING id").get();
    await prepare('UPDATE products SET category = ? WHERE sku = ? RETURNING id').get('[Again] › [New name]', sku);
  });
  assert.equal(await bring(), 'same');
  assert.deepEqual((await tree()).filter((c) => c.path.startsWith('[Again]')).map((c) => c.path), ['[Again]', '[Again] › [New name]']);
});

test('a count can be started on a category whose path is longer than 60 characters', async () => {
  const path = 'Components › Drivetrain › Derailleurs › Rear derailleurs › 12-speed';
  assert.ok(path.length > 60);
  await add(path);
  const res = await staff('/api/stock-takes', { method: 'POST', body: { kind: 'category', target: path } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.label, path);
  const area = await staff('/api/stock-takes', { method: 'POST', body: { kind: 'area', target: 'x'.repeat(61) } });
  assert.equal(area.status, 400, 'an area’s name still stops at 60');
});

test('every kind of space is trimmed, and Uncategorised in any case isn’t a category', async () => {
  for (const [written, tidy] of [
    ['Brakes\t', 'Brakes'], ['Brakes\u00A0', 'Brakes'], ['\u3000Brakes\u2003', 'Brakes'], ['Brakes \u2003›\u00A0Pads', 'Brakes › Pads'],
    ['uncategorised › Tyres', 'Tyres'], ['UNCATEGORISED', 'Uncategorised'], ['Tyres › unCategorised', 'Tyres'],
  ]) assert.equal(tidyCategory(written), tidy, JSON.stringify(written));
  const before = (await tree()).length;
  assert.equal(await textOf(await add('uncategorised')), 'Uncategorised');
  assert.equal((await tree()).length, before);
});
