// Making and changing a product with sizes and colours (openspec/changes/product-editing;
// stock control decision 4; Jack's answers 5 and 9: each size its own product, named with its
// size and colour, "Jersey M Blue", kept in step whenever the product, a size or a colour is
// renamed). Jack Lewis, Jo Taylor as drawn; Jersey M Blue is Jack's example; the rest
// placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId), loginId: made.body.loginId };
  const { rows: [{ employee_id: employeeId }] } = await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId]);
  jo.employeeId = employeeId;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, method = 'GET', body) => staffRequest(server.baseUrl, who.cookie, path, { method, body });
const code = () => randomUUID().slice(0, 6);
const rows = (group) => runWithShop(owner.shop.id, () => prepare('SELECT id, name, category, size, colour, sku, barcode, price_pence, cost_pence, stock_qty, active FROM products WHERE group_id = ? ORDER BY id').all(group));
const size = (s, colour, extra = {}) => ({ size: s, colour, sku: `JER-${code()}`, barcode: `7${randomUUID().replace(/\D/g, '').padEnd(12, '0').slice(0, 12)}`, pricePence: 3000, costPence: 1200, ...extra });

test('making one: each size its own product, named with its size and colour, in a category made for it', async () => {
  const res = await as(owner, '/api/product-groups', 'POST', {
    name: 'Jersey', category: '[Clothing] › [Tops]',
    sizes: [size('M', 'Blue', { stockQty: 3 }), size('L', 'Blue'), size('M', null), size(null, 'Red')],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const made = await rows(res.body.id);
  assert.deepEqual(made.map((r) => [r.name, r.category, r.size, r.colour, r.price_pence, r.cost_pence, r.stock_qty]), [
    ['Jersey M Blue', '[Clothing] › [Tops]', 'M', 'Blue', 3000, 1200, 3],
    ['Jersey L Blue', '[Clothing] › [Tops]', 'L', 'Blue', 3000, 1200, 0],
    ['Jersey M', '[Clothing] › [Tops]', 'M', null, 3000, 1200, 0],
    ['Jersey Red', '[Clothing] › [Tops]', null, 'Red', 3000, 1200, 0],
  ]);
  const tree = await runWithShop(owner.shop.id, () => prepare("SELECT path FROM product_categories WHERE path LIKE '[Clothing]%' ORDER BY path").all());
  assert.deepEqual(tree.map((c) => c.path), ['[Clothing]', '[Clothing] › [Tops]']);
  const line = await runWithShop(owner.shop.id, () => prepare('SELECT change_qty, note, who_name FROM stock_movements WHERE product_id = ?').get(made[0].id));
  assert.deepEqual([line.change_qty, line.note, line.who_name], [3, 'Initial stock', 'Jack Lewis']);
});

test('renaming it, or a size or colour, renames each size’s own product in the same go', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Shorts]', category: '[Clothing]', sizes: [size('S', '[Black]'), size('M', '[Black]')] })).body.id;
  const [s, m] = await rows(g);
  const res = await as(owner, `/api/product-groups/${g}`, 'PUT', {
    name: '[Bib shorts]', category: '[Clothing] › [Bottoms]',
    sizes: [{ id: s.id, size: 'XS', colour: '[Black]' }, { id: m.id, size: 'M', colour: '[Navy]', pricePence: 3500 }, size('L', '[Navy]')],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await rows(g)).map((r) => [r.name, r.category, r.price_pence]), [
    ['[Bib shorts] XS [Black]', '[Clothing] › [Bottoms]', 3000],
    ['[Bib shorts] M [Navy]', '[Clothing] › [Bottoms]', 3500],
    ['[Bib shorts] L [Navy]', '[Clothing] › [Bottoms]', 3000],
  ]);
  const group = (await as(owner, `/api/product-groups/${g}`)).body;
  assert.deepEqual([group.name, group.category], ['[Bib shorts]', '[Clothing] › [Bottoms]']);
});

test('a name typed by hand for one size goes the next time the product is saved (answer 9)', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Gloves]', category: '[Clothing]', sizes: [size('M', null)] })).body.id;
  const [m] = await rows(g);
  assert.equal((await as(owner, `/api/products/${m.id}`, 'PUT', { name: '[Typed by hand]' })).status, 200);
  assert.equal((await as(owner, `/api/product-groups/${g}`, 'PUT', { description: '[Description]' })).status, 200);
  assert.equal((await rows(g))[0].name, '[Gloves] M');
});

test('a size taken off sale stays, and comes back', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Socks]', category: '[Clothing]', sizes: [size('S', null), size('M', null)] })).body.id;
  const [s] = await rows(g);
  assert.equal((await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: s.id, size: 'S', colour: null, active: false }] })).status, 200);
  assert.deepEqual((await rows(g)).map((r) => r.active), [0, 1]);
});

test('what doesn’t fit is refused, saying why, and nothing is made', async () => {
  const before = (await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM products').get())).n;
  const refused = async (body, why, status = 400) => {
    const res = await as(owner, '/api/product-groups', 'POST', body);
    assert.equal(res.status, status, JSON.stringify(res.body));
    assert.match(res.body.error, why);
  };
  await refused({ name: '', category: 'x', sizes: [size('M', null)] }, /needs a name/);
  await refused({ name: 'x'.repeat(61), category: 'x', sizes: [size('M', null)] }, /60/);
  await refused({ name: '[P]', category: 'x', sizes: [] }, /at least one size or colour/);
  await refused({ name: '[P]', category: 'x', sizes: [size(null, null)] }, /a size or a colour/);
  await refused({ name: '[P]', category: 'x', sizes: [size('M', 'Blue'), size('m', 'blue')] }, /M Blue is there twice/);
  await refused({ name: '[P]', category: 'x', sizes: [size('x'.repeat(21), null)] }, /20/);
  await refused({ name: '[P]', category: 'x', sizes: [size('M', null, { pricePence: 1.5 })] }, /whole number of pence/);
  const taken = size('M', null);
  await as(owner, '/api/product-groups', 'POST', { name: '[First]', category: 'x', sizes: [taken] });
  await refused({ name: '[P]', category: 'x', sizes: [size('M', null, { barcode: taken.barcode })] }, new RegExp(`Barcode "${taken.barcode}" is already in use`), 409);
  assert.equal((await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM products').get())).n, before + 1, 'only [First] was made');
});

test('staff can’t make or change one; another business can’t reach it', async () => {
  const res = await as(jo, '/api/product-groups', 'POST', { name: '[P]', category: 'x', sizes: [size('M', null)] });
  assert.deepEqual([res.status, res.body.error], [403, 'Only the shop’s owner can add or change products']);
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Mine]', category: 'x', sizes: [size('M', null)] })).body.id;
  assert.equal((await as(jo, `/api/product-groups/${g}`, 'PUT', { name: '[X]' })).status, 403);
  assert.equal((await as(other, `/api/product-groups/${g}`, 'PUT', { name: '[X]' })).status, 404);
  const [m] = await rows(g);
  const stranger = (await as(owner, '/api/product-groups', 'POST', { name: '[Another]', category: 'x', sizes: [size('L', null)] })).body.id;
  assert.equal((await as(owner, `/api/product-groups/${stranger}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: null }] })).status, 400, 'a size of another product');
});

test('a save waits at most its limit for a held size, then answers busy, and nothing changes', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Held]', category: 'x', sizes: [size('M', null), size('L', null)] })).body.id;
  const [m] = await rows(g);
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [m.id]);
    const started = Date.now();
    const res = await Promise.race([as(owner, `/api/product-groups/${g}`, 'PUT', { name: '[Renamed]' }), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    const waited = Date.now() - started;
    await holder.query('ROLLBACK');
    assert.equal(res.status, 503, JSON.stringify(res.body));
    assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
    assert.deepEqual((await rows(g)).map((r) => r.name), ['[Held] M', '[Held] L']);
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
  }
});

test('a sale’s saved line says the size: “Jersey M Blue”, at the longest a name can be too', async () => {
  const long = { name: 'x'.repeat(60), size: 'y'.repeat(20), colour: 'z'.repeat(30) };
  const g = (await as(owner, '/api/product-groups', 'POST', { name: long.name, category: 'x', sizes: [size(long.size, long.colour), size('M', 'Blue')] })).body.id;
  const g2 = (await as(owner, '/api/product-groups', 'POST', { name: 'Jersey', category: 'x', sizes: [size('M', 'Blue', { barcode: null, sku: null })] })).body.id;
  const [longest] = await rows(g);
  const [jersey] = await rows(g2);
  assert.equal(longest.name.length, 112);
  for (const p of [longest, jersey]) {
    const sold = await as(owner, '/api/sales', 'POST', { items: [{ productId: p.id, qty: 1 }], cardAmount: 30, cashierId: jo.employeeId, sellPastStock: true });
    assert.equal(sold.status, 201, JSON.stringify(sold.body));
    const line = await runWithShop(owner.shop.id, () => prepare('SELECT name FROM sale_items WHERE sale_id = ?').get(sold.body.id));
    assert.equal(line.name, p.name);
  }
  assert.equal(jersey.name, 'Jersey M Blue');
});

test('a save racing a rename of its category: both go through, and the sizes say the new path', async () => {
  const cat = (await as(owner, '/api/product-categories', 'POST', { name: `[Race ${code()}]` })).body;
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Race jersey]', category: cat.path, sizes: [size('M', null)] })).body.id;
  const [m] = await rows(g);
  const holder = await pool.connect();
  let answers;
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [m.id]);
    const saving = as(owner, `/api/product-groups/${g}`, 'PUT', { description: '[Saved]', category: cat.path });
    const waiting = async (pattern) => {
      for (const until = Date.now() + 3000; Date.now() < until;) {
        if ((await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1", [pattern])).rows.length) return true;
        await new Promise((r) => { setTimeout(r, 20); });
      }
      return false;
    };
    assert.ok(await waiting('%FROM products WHERE group_id = %FOR UPDATE%'), 'the save holds its category and waits on its size');
    const renaming = as(owner, `/api/product-categories/${cat.id}`, 'PUT', { name: `[Renamed ${code()}]` });
    await Promise.race([renaming, waiting('%FROM product_categories ORDER BY id FOR UPDATE%')]);
    await holder.query('ROLLBACK');
    answers = await Promise.all([saving, renaming]);
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
  }
  assert.deepEqual(answers.map((a) => a.status), [200, 200], JSON.stringify(answers.map((a) => a.body)));
  const now = (await as(owner, `/api/product-groups/${g}`)).body.category;
  assert.match(now, /^\[Renamed /);
  assert.deepEqual((await rows(g)).map((r) => r.category), [now]);
});

// ---- From the review ----

test('a price in pounds is taken as a product’s is: making, adding and saving a size', async () => {
  const pounds = (s, colour, price) => ({ ...size(s, colour), pricePence: undefined, price });
  const made = await as(owner, '/api/product-groups', 'POST', { name: '[Pounds]', category: 'x', sizes: [pounds('M', null, 30)] });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const [m] = await rows(made.body.id);
  assert.equal(m.price_pence, 3000, 'made at £30');
  assert.equal((await as(owner, `/api/product-groups/${made.body.id}`, 'PUT', { sizes: [pounds('L', null, 31)] })).status, 200);
  assert.equal((await rows(made.body.id))[1].price_pence, 3100, 'added at £31');
  assert.equal((await as(owner, `/api/product-groups/${made.body.id}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: null, price: 45 }] })).status, 200);
  assert.equal((await rows(made.body.id))[0].price_pence, 4500, 'saved at £45');
  const tooMuch = await as(owner, '/api/product-groups', 'POST', { name: '[Too much]', category: 'x', sizes: [pounds('M', null, 21474836.48)] });
  assert.equal(tooMuch.status, 400, 'the same limit as a product’s price');
});

test('one size saved on its own keeps its product with sizes’ category, saying where to change it', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Caps]', category: '[Clothing]', sizes: [size('M', null)] })).body.id;
  const [m] = await rows(g);
  const moved = await as(owner, `/api/products/${m.id}`, 'PUT', { category: '[Elsewhere]' });
  assert.equal(moved.status, 400);
  assert.equal(moved.body.error, '[Caps] M is a size of [Caps]. Change the category on [Caps], and every size follows.');
  assert.equal((await rows(g))[0].category, '[Clothing]');
  // The old app's form sends the category it shows: the same one goes through.
  assert.equal((await as(owner, `/api/products/${m.id}`, 'PUT', { category: '[Clothing]', description: '[Note]' })).status, 200);
});

test('swapping two sizes’ labels in one save works: M and L', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Swap]', category: 'x', sizes: [size('M', null), size('L', null)] })).body.id;
  const [m, l] = await rows(g);
  const res = await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: m.id, size: 'L', colour: null }, { id: l.id, size: 'M', colour: null }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await rows(g)).map((r) => [r.id, r.size, r.name]), [[m.id, 'L', '[Swap] L'], [l.id, 'M', '[Swap] M']]);
});

// ---- From the re-check ----

test('a size can be called anything a swap might pass through, and the swap still works', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Tilde]', category: 'x', sizes: [size('M', null), size('X', null)] })).body.id;
  const [m, x] = await rows(g);
  assert.equal((await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: x.id, size: `~${m.id}`, colour: null }] })).status, 200);
  const res = await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: m.id, size: 'S', colour: null }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await rows(g)).map((r) => r.size), ['S', `~${m.id}`]);
});

const PRICE_WORDS = 'A price is a number of pounds, from nothing up to £21,474,836.47';

test('a price in pounds must be a number of pounds: on a size, made, added or saved', async () => {
  const g = (await as(owner, '/api/product-groups', 'POST', { name: '[Priced]', category: 'x', sizes: [size('M', null)] })).body.id;
  const [m] = await rows(g);
  for (const price of ['abc', '', null, true, -5, '12abc']) {
    const made = await as(owner, '/api/product-groups', 'POST', { name: '[Bad]', category: 'x', sizes: [{ ...size('M', null), pricePence: undefined, price }] });
    assert.deepEqual([made.status, made.body.error], [400, PRICE_WORDS], `made at ${JSON.stringify(price)}`);
    const added = await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ ...size('L', null), pricePence: undefined, price }] });
    assert.deepEqual([added.status, added.body.error], [400, PRICE_WORDS], `added at ${JSON.stringify(price)}`);
    const saved = await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: null, price }] });
    assert.deepEqual([saved.status, saved.body.error], [400, PRICE_WORDS], `saved at ${JSON.stringify(price)}`);
  }
  assert.equal((await rows(g))[0].price_pence, 3000, 'nothing changed');
  assert.equal((await as(owner, `/api/product-groups/${g}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: null, price: '28.50' }] })).status, 200);
  assert.equal((await rows(g))[0].price_pence, 2850, 'a number written as text is pounds too');
});

test('a plain product’s price in pounds the same: added or saved; the old app’s forms still save', async () => {
  const stored = async (id) => (await runWithShop(owner.shop.id, () => prepare('SELECT price_pence, cost_pence FROM products WHERE id = ?').get(id)));
  for (const price of ['abc', '', null, true, -5]) {
    const added = await as(owner, '/api/products', 'POST', { name: '[Bad]', price });
    assert.deepEqual([added.status, added.body.error], [400, PRICE_WORDS], `added at ${JSON.stringify(price)}`);
  }
  // As the old app's form sends it: a typed price and cost, then a blank cost (left out).
  const form = { name: '[Old form]', sku: `OF-${code()}`, barcode: '', category: 'Brakes', price: 28, cost: 14, lowStockThreshold: 3, supplier: '' };
  const made = await as(owner, '/api/products', 'POST', { ...form, stockQty: 0 });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.deepEqual(await stored(made.body.id), { price_pence: 2800, cost_pence: 1400 });
  const { cost, ...blankCost } = form;
  void cost;
  assert.equal((await as(owner, `/api/products/${made.body.id}`, 'PUT', { ...blankCost, price: 29.99 })).status, 200);
  assert.deepEqual(await stored(made.body.id), { price_pence: 2999, cost_pence: 1400 }, 'a blank cost leaves the cost');
  for (const price of ['abc', null, true, -5]) {
    const saved = await as(owner, `/api/products/${made.body.id}`, 'PUT', { price });
    assert.deepEqual([saved.status, saved.body.error], [400, PRICE_WORDS], `saved at ${JSON.stringify(price)}`);
  }
  assert.equal((await stored(made.body.id)).price_pence, 2999);
  // A supplier's item brought in, as the old app's import sends it.
  const item = await runWithShop(owner.shop.id, async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(`[Supplier ${code()}]`);
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, '[Item]', 14, 0, 'new')").run(supplier.lastInsertRowid, `CI-${code()}`)).lastInsertRowid;
  });
  const bad = await as(owner, `/api/catalogue-items/${item}/import`, 'POST', { category: 'Brakes', price: true });
  assert.equal(bad.status, 400);
  assert.equal((await as(owner, `/api/catalogue-items/${item}/import`, 'POST', { category: 'Brakes', price: 28 })).status, 201);
});
