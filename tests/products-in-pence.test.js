// Products in whole pence, the server (openspec/changes/products-in-pence): adding
// and saving in pence, what's refused, who is told, the readers that moved to pence,
// and a save that can't hang on a locked product. Prices are made up except the
// drawing's Shimano brake pads at £28.00.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { buildSnapshot } from '../server/till/snapshot.js';
import { penceToPounds, wholePence } from '../server/lib/pence.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  jo = await staffLogin(owner.shop.id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const stored = (id) => inShop(() => prepare('SELECT price::text AS price, cost::text AS cost, price_pence, cost_pence, description FROM products WHERE id = ?').get(id));

let n = 0;
async function pads(over = {}) {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, category: '[Category]', price: 28, cost: 14, ...over } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
const save = (id, body, who) => staff(`/api/products/${id}`, { method: 'PUT', body }, who);

test('pence to pounds is exact: every figure to £1,000.00, and the awkward ones', () => {
  for (let p = 0; p <= 100000; p += 1) {
    const pounds = penceToPounds(p);
    assert.equal(Number(pounds.replace('.', '')), p, pounds);
    assert.match(pounds, /^\d+\.\d\d$/);
  }
  assert.equal(penceToPounds(5), '0.05');
  assert.equal(penceToPounds(1999), '19.99');
  assert.equal(penceToPounds(2147483648), '21474836.48');
  assert.equal(penceToPounds(9999999999), '99999999.99');
});

test('only a whole number of pence, 0 to £99,999,999.99, is a figure', () => {
  for (const good of [0, 1, 2800, 9999999999]) assert.equal(wholePence(good), true, String(good));
  for (const bad of [-1, 28.5, 10000000000, Number.NaN, Infinity, '2800', true, null, undefined, {}, []]) assert.equal(wholePence(bad), false, String(bad));
});

test('a product reads its price and cost in pence as well as pounds', async () => {
  const p = await pads({ price: 19.99, cost: 4.35 });
  assert.equal(p.pricePence, 1999);
  assert.equal(p.costPence, 435);
  assert.equal(p.price, 19.99, 'the old app’s pounds are still there');
  assert.equal(p.cost, 4.35);
  const read = (await staff(`/api/products/${p.id}`)).body;
  assert.deepEqual([read.pricePence, read.costPence], [1999, 435]);
  const listed = (await staff(`/api/products?search=${p.sku}`)).body[0];
  assert.deepEqual([listed.pricePence, listed.costPence], [1999, 435]);
});

test('adding a product in pence', async () => {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, pricePence: 2800, costPence: 1999 } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual([res.body.pricePence, res.body.costPence, res.body.price, res.body.cost], [2800, 1999, 28, 19.99]);
  const row = await stored(res.body.id);
  assert.deepEqual([row.price, row.cost], ['28.00', '19.99']);
});

test('saving in pence: exact, and winning over pounds sent with it', async () => {
  const p = await pads();
  assert.equal((await save(p.id, { pricePence: 1999, costPence: 435 })).status, 200);
  let row = await stored(p.id);
  assert.deepEqual([row.price, row.cost, row.price_pence, row.cost_pence], ['19.99', '4.35', 1999, 435]);
  assert.equal((await save(p.id, { pricePence: 115, price: 999 })).status, 200);
  row = await stored(p.id);
  assert.deepEqual([row.price, row.price_pence], ['1.15', 115]);
  assert.equal((await save(p.id, { pricePence: 0 })).status, 200, 'nothing is a figure');
  assert.equal((await stored(p.id)).price_pence, 0);
  assert.equal((await save(p.id, { pricePence: 2147483647 })).status, 200, 'the most a sale line can carry');
  row = await stored(p.id);
  assert.deepEqual([row.price, row.price_pence], ['21474836.47', 2147483647]);
});

test('the old app’s save in pounds still works, and the pence follow', async () => {
  const p = await pads();
  const res = await save(p.id, { price: 8.2, cost: 1.15 });
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.pricePence, res.body.costPence, res.body.price, res.body.cost], [820, 115, 8.2, 1.15]);
});

for (const [what, figure] of [['a fraction of a penny', 28.5], ['below nothing', -1], ['too much', 2147483648], ['text', '2800'], ['a price of nothing sent', null], ['true', true]]) {
  test(`a price in pence that is ${what} is refused, and nothing it came with is stored`, async () => {
    const p = await pads();
    const res = await save(p.id, { pricePence: figure, description: '[Changed]' });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /price/i);
    const row = await stored(p.id);
    assert.deepEqual([row.price, row.description], ['28.00', '']);
    assert.equal((await staff('/api/products', { method: 'POST', body: { name: '[Refused]', sku: `[Refused ${what}]`, pricePence: figure } })).status, 400);
    assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM products WHERE sku = ?').get(`[Refused ${what}]`))).n, 0);
  });
}

for (const [what, figure] of [['a fraction of a penny', 14.5], ['below nothing', -1], ['too much', 10000000000], ['text', 'none']]) {
  test(`a cost in pence that is ${what} is refused for the Owner`, async () => {
    const p = await pads();
    const res = await save(p.id, { costPence: figure, description: '[Changed]' });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /cost/i);
    const row = await stored(p.id);
    assert.deepEqual([row.cost, row.description], ['14.00', '']);
  });
}

test('a save with no cost in pence leaves the cost as it is', async () => {
  const p = await pads();
  for (const without of [{}, { costPence: null }, { costPence: '' }]) {
    assert.equal((await save(p.id, { description: '[Changed]', ...without })).status, 200, JSON.stringify(without));
    assert.equal((await stored(p.id)).cost_pence, 1400, JSON.stringify(without));
  }
});

test('Jo Taylor is sent no cost in pence, and can’t change one, whatever she sends', async () => {
  const p = await pads();
  const read = (await staff(`/api/products/${p.id}`, undefined, jo)).body;
  assert.ok(read.costPence === null);
  assert.equal(read.pricePence, 2800, 'she still sees the price');
  // Staff don't change products at all now (product-editing; decision 11).
  const res = await save(p.id, { costPence: 1, description: '[Changed]' }, jo);
  assert.deepEqual([res.status, res.body.code], [403, 'owner_only']);
  const row = await stored(p.id);
  assert.deepEqual([row.cost_pence, row.description], [1400, '']);
  n += 1;
  const added = await staff('/api/products', { method: 'POST', body: { name: '[Product]', sku: `[Jo ${n}]`, pricePence: 2800, costPence: 1400 } }, jo);
  assert.deepEqual([added.status, added.body.code], [403, 'owner_only'], 'nor add one');
});

test('the till’s snapshot reads pence, and survives a price already over what an INTEGER holds', async () => {
  const p = await pads();
  await inShop(() => prepare('UPDATE products SET price = 21474836.48 WHERE id = ?').run(p.id));
  const snapshot = await inShop(() => buildSnapshot({ id: 0, code: 'B1', name: '[Till]', site_id: null }));
  assert.equal(snapshot.products.find((x) => x.id === p.id).pricePence, 2147483648);
  // Leave nothing that would upset other tests' snapshots of this shop.
  await save(p.id, { pricePence: 2800 });
});

test('an adjustment’s value reads the cost in pence, exactly, at its size when negative', async () => {
  const p = await pads({ stockQty: 5, cost: 19.99 });
  const res = await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: -3, type: 'adjustment', reason: 'damaged' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const line = await inShop(() => prepare('SELECT value_pence FROM stock_movements WHERE product_id = ? AND type = ? ORDER BY id DESC LIMIT 1').get(p.id, 'adjustment'));
  assert.equal(line.value_pence, 5997);
  await inShop(() => prepare('UPDATE products SET cost = -19.99 WHERE id = ?').run(p.id));
  await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: -1, type: 'adjustment', reason: 'damaged' } });
  const negative = await inShop(() => prepare('SELECT value_pence FROM stock_movements WHERE product_id = ? AND type = ? ORDER BY id DESC LIMIT 1').get(p.id, 'adjustment'));
  assert.equal(negative.value_pence, 1999);
});

test('a price stops at what a sale line can carry, £21,474,836.47, in pence and in pounds; a cost doesn’t', async () => {
  const p = await pads();
  assert.equal((await save(p.id, { pricePence: 2147483647 })).status, 200);
  assert.equal((await stored(p.id)).price_pence, 2147483647);
  assert.equal((await save(p.id, { price: 21474836.47 })).status, 200);
  for (const over of [{ pricePence: 2147483648 }, { price: 21474836.48 }, { price: '21474836.48' }, { price: 100000000 }, { price: -100000000 }, { price: 'Infinity' }]) {
    const res = await save(p.id, { ...over, description: '[Changed]' });
    assert.equal(res.status, 400, `${JSON.stringify(over)}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /price/i);
    n += 1;
    assert.equal((await staff('/api/products', { method: 'POST', body: { name: '[Refused]', sku: `[Over ${n}]`, ...over } })).status, 400, JSON.stringify(over));
  }
  const row = await stored(p.id);
  assert.deepEqual([row.price_pence, row.description], [2147483647, '']);
  assert.equal((await save(p.id, { costPence: 9999999999 })).status, 200, 'a cost can be as much as its column holds');
  assert.equal((await stored(p.id)).cost_pence, 9999999999);
});

test('a product already priced over the limit still opens, and saves when its price isn’t sent', async () => {
  const p = await pads();
  await inShop(() => prepare('UPDATE products SET price = 30000000 WHERE id = ?').run(p.id));
  assert.equal((await staff(`/api/products/${p.id}`)).body.pricePence, 3000000000);
  assert.equal((await save(p.id, { description: '[Changed]' })).status, 200);
  const row = await stored(p.id);
  assert.deepEqual([row.price_pence, row.description], [3000000000, '[Changed]']);
  await inShop(() => prepare('UPDATE products SET price = 28 WHERE id = ?').run(p.id));
});

test('importing a supplier’s item at a price over the limit is refused', async () => {
  const item = await inShop(async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run();
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, ?, 14, 0, 'new')").run(supplier.lastInsertRowid, '[Supplier code]', '[Catalogue item]')).lastInsertRowid;
  });
  const res = await staff(`/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 21474836.48, category: '[Category]' } });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  const fine = await staff(`/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 21474836.47, category: '[Category]' } });
  assert.equal(fine.status, 201, JSON.stringify(fine.body));
  assert.equal(fine.body.pricePence, 2147483647);
});

test('a cost over what an INTEGER holds counts, applies, shows and undoes in a stock take', async () => {
  const p = await pads({ stockQty: 2, costPence: 2147483649 });
  const take = (await staff('/api/stock-takes', { method: 'POST', body: { kind: 'area', target: '[Area]' } })).body;
  assert.equal((await staff(`/api/stock-takes/${take.id}/join`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await staff(`/api/stock-takes/${take.id}/counts`, { method: 'POST', body: { productId: p.id, qty: 1 } })).status, 200);
  const applied = await staff(`/api/stock-takes/${take.id}/apply`, { method: 'POST', body: {} });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  const result = await inShop(() => prepare('SELECT cost_pence, difference FROM stock_take_results WHERE stock_take_id = ?').get(take.id));
  assert.deepEqual([result.cost_pence, result.difference], [2147483649, -1]);
  assert.equal(applied.body.valuePence, -2147483649, 'its value at cost, exact');
  assert.equal((await staff('/api/stock-takes')).status, 200, 'the list of counts opens');
  const undone = await staff(`/api/stock-takes/${take.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal((await staff(`/api/products/${p.id}`)).body.stockQty, 2);
});

test('a save of a product held by something else answers busy after its 2 seconds, and stores nothing', async () => {
  const p = await pads();
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [p.id]);
    const started = Date.now();
    const res = await Promise.race([
      save(p.id, { pricePence: 1, description: '[Changed]' }),
      new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); }),
    ]);
    assert.equal(res.status, 503, JSON.stringify(res.body));
    assert.equal(res.body.code, 'busy');
    // The 2 seconds itself: long enough to ride out a normal wait, short enough not to starve the pool.
    const waited = Date.now() - started;
    assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  const row = await stored(p.id);
  assert.deepEqual([row.price, row.description], ['28.00', '']);
  // Once it's free, the same save goes straight through.
  assert.equal((await save(p.id, { pricePence: 1 })).status, 200);
  // The refused save closed its own transaction: the server's safety net for one
  // left open says so here, just after the reply, and must have had nothing to do.
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.ok(!server.stderr.includes('request finished with a transaction still open'), server.stderr.slice(-500));
});

test('a delivery’s lines send the price in pence, for its labels', async () => {
  const p = await pads({ price: 19.99 });
  const made = await inShop(async () => {
    const d = await prepare("INSERT INTO deliveries (booked_in_at) VALUES (now()) RETURNING id").get();
    await prepare('INSERT INTO delivery_lines (delivery_id, product_id, product_name, product_sku, qty, unit_cost) VALUES (?, ?, ?, ?, 1, 14)').run(d.id, p.id, p.name, p.sku);
    return d.id;
  });
  const res = await staff(`/api/deliveries/booked-in/${made}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.lines[0].pricePence, 1999);
});
