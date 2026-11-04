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
  assert.equal((await save(p.id, { pricePence: 9999999999 })).status, 200, 'the most the pounds can hold');
  row = await stored(p.id);
  assert.deepEqual([row.price, row.price_pence], ['99999999.99', 9999999999]);
});

test('the old app’s save in pounds still works, and the pence follow', async () => {
  const p = await pads();
  const res = await save(p.id, { price: 8.2, cost: 1.15 });
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.pricePence, res.body.costPence, res.body.price, res.body.cost], [820, 115, 8.2, 1.15]);
});

for (const [what, figure] of [['a fraction of a penny', 28.5], ['below nothing', -1], ['too much', 10000000000], ['text', '2800'], ['a price of nothing sent', null], ['true', true]]) {
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
  const res = await save(p.id, { costPence: 1, description: '[Changed]' }, jo);
  assert.equal(res.status, 200);
  assert.ok(res.body.costPence === null);
  const row = await stored(p.id);
  assert.deepEqual([row.cost_pence, row.description], [1400, '[Changed]']);
  // Bad figures are ignored too: she was never going to set one.
  assert.equal((await save(p.id, { costPence: -1 }, jo)).status, 200);
  assert.equal((await stored(p.id)).cost_pence, 1400);
  n += 1;
  const added = await staff('/api/products', { method: 'POST', body: { name: '[Product]', sku: `[Jo ${n}]`, pricePence: 2800, costPence: 1400 } }, jo);
  assert.equal(added.status, 201);
  assert.equal((await stored(added.body.id)).cost_pence, 0, 'a product she adds starts with no cost');
});

test('the till’s snapshot reads pence, and survives a price over what an INTEGER holds', async () => {
  const p = await pads({ pricePence: 2147483648 });
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

test('a save of a product held by something else answers busy within seconds, and stores nothing', async () => {
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
    assert.ok(Date.now() - started < 8000);
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  const row = await stored(p.id);
  assert.deepEqual([row.price, row.description], ['28.00', '']);
  // Once it's free, the same save goes straight through.
  assert.equal((await save(p.id, { pricePence: 1 })).status, 200);
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
