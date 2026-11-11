// Every stock line says who, why, which shop and what caused it, and every change
// goes through one function with a limit on waiting (openspec/changes/
// stock-movements-say-who; stock control decision 6). This file: the function, and the
// changes staff make themselves. tests/stock-movements-rest.test.js: the others.
// Jack Lewis, Jo Taylor, Bolton and Shimano brake pads as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { lockStock, moveStock } from '../server/lib/stock.js';
import { differenceRows } from '../server/lib/stock-take-differences.js';
import { removeShop } from '../server/remove-shop.js';
import { startLiveServer } from './helpers/liveServer.js';
import { firstShopIsBolton, staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let bolton;
let second;
let jo;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  bolton = await firstShopIsBolton(owner);
  second = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } })).body;
  owner.pin = await withPin(owner.cookie);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  const { rows: [{ employee_id: employeeId }] } = await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId]);
  jo = { cookie, pin: await withPin(cookie), employeeId, loginId: made.body.loginId };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);
async function withPin(cookie) {
  const offer = await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.equal((await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status, 200);
  return offer.body.pin;
}
// A browser of its own, keeping the cookies it's given.
function browser(signIn) {
  const jar = new Map();
  return async function send(path, { method = 'GET', body } = {}) {
    const cookie = [signIn, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}
const POST = (body = {}) => ({ method: 'POST', body });
let computers = 0;
// The Owner's computer made a till or workshop computer at a shop, then someone checked in.
async function computer(kind, site, pin) {
  const send = browser(await staffFreshCookie(owner.loginId));
  computers += 1;
  const made = kind === 'till'
    ? await send('/api/till-setup', POST({ siteId: site.id, number: computers }))
    : await send('/api/till-setup/workshop', POST({ siteId: site.id, name: `[Bench ${computers}]` }));
  assert.equal(made.status, 201, JSON.stringify(made.body));
  if (pin) assert.equal((await send('/api/till-checkin', POST({ pin }))).status, 201);
  return send;
}
const asOwner = () => browser(owner.cookie);
let n = 0;
// Its stock at Bolton unless said (stock-per-shop): a change at a till is that shop's.
const product = (stock = 6, cost = 14, site = bolton) => inShop(async () => {
  n += 1;
  const id = (await prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, 'Shimano brake pads', '[Category]', 28, ?, ?, now())").run(`B05S-RX-${n}`, cost, stock)).lastInsertRowid;
  await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').run(site.id, id, stock);
  return id;
});
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const linesOf = (id) => inShop(() => prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id').all(id));
const inTransaction = (fn) => inShop(async () => {
  await dbExec('BEGIN');
  try {
    const out = await fn();
    await dbExec('COMMIT');
    return out;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
});
const adjust = { change: -1, type: 'adjustment', reason: 'damaged' };

// ---- The function ----

test('moveStock writes the stock and a line saying who, why, which shop and what caused it', async () => {
  const id = await product();
  const out = await inTransaction(() => moveStock(
    [{ productId: id, change: -2, type: 'adjustment', note: '[Note]', reason: 'damaged', valuePence: 2800, toSee: true }],
    { loginId: owner.loginId, employeeId: jo.employeeId, name: 'Jo Taylor', siteId: second.id }
  ));
  assert.equal(out.products.get(id).stock_qty, 4);
  assert.equal(await stockOf(id), 4);
  const [line] = await linesOf(id);
  assert.equal(out.lineOf.get(id), line.id);
  assert.deepEqual(
    [line.change_qty, line.type, line.note, line.reason, line.value_pence, line.to_see, line.login_id, line.employee_id, line.who_name, line.site_id],
    [-2, 'adjustment', '[Note]', 'damaged', 2800, true, owner.loginId, jo.employeeId, 'Jo Taylor', second.id]
  );
});

test('moveStock: several lines on one product all count, each with its own line', async () => {
  const id = await product();
  const out = await inTransaction(() => moveStock([{ productId: id, change: -2, type: 'sale' }, { productId: id, change: -1, type: 'sale' }, { productId: id, change: 5, type: 'intake' }]));
  assert.equal(out.products.get(id).stock_qty, 8);
  assert.deepEqual((await linesOf(id)).map((l) => l.change_qty), [-2, -1, 5]);
});

test('moveStock refuses a change under zero when told to, writing nothing; going up always goes', async () => {
  const id = await product(1);
  const other2 = await product(9);
  const out = await inTransaction(() => moveStock([{ productId: other2, change: -1, type: 'sale' }, { productId: id, change: -2, type: 'sale' }], {}, { neverBelowZero: true }));
  assert.equal(out.refused.id, id);
  assert.deepEqual([await stockOf(id), await stockOf(other2), (await linesOf(id)).length, (await linesOf(other2)).length], [1, 9, 0, 0]);
  // Two lines that only go under zero together.
  const both = await inTransaction(() => moveStock([{ productId: id, change: -1, type: 'sale' }, { productId: id, change: -1, type: 'sale' }], {}, { neverBelowZero: true }));
  assert.equal(both.refused.id, id);
  const below = await product(-5);
  const up = await inTransaction(() => moveStock([{ productId: below, change: 1, type: 'adjustment' }], {}, { neverBelowZero: true }));
  assert.ok(up.refused === null);
  assert.equal(await stockOf(below), -4);
  // Without being told, it goes below zero: stock never blocks a sale.
  await inTransaction(() => moveStock([{ productId: id, change: -3, type: 'sale' }]));
  assert.equal(await stockOf(id), -2);
});

test('moveStock says which products no longer exist, gives them no line, and carries on with the rest', async () => {
  const id = await product();
  const out = await inTransaction(() => moveStock([{ productId: 2147483000, change: -1, type: 'sale' }, { productId: id, change: -1, type: 'sale' }]));
  assert.deepEqual(out.missing, [2147483000]);
  assert.equal(await stockOf(id), 5);
});

test('moveStock takes products in id order whatever order it’s given, so two changes can’t deadlock', async () => {
  const [a, b] = [await product(), await product()];
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => inTransaction(() => moveStock(
    (i % 2 ? [a, b] : [b, a]).map((productId) => ({ productId, change: -1, type: 'sale' }))
  ))));
  assert.equal(results.length, 12);
  assert.deepEqual([await stockOf(a), await stockOf(b)], [-6, -6]);
});

test('moveStock holds the lower product while it waits for the higher, whichever it was given first', async () => {
  const [low, high] = [await product(), await product()];
  const holder = await pool.connect();
  const other2 = await pool.connect();
  let moving;
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [high]);
    const { rows: [{ pid }] } = await holder.query('SELECT pg_backend_pid() AS pid');
    moving = inTransaction(() => moveStock([{ productId: high, change: -1, type: 'sale' }, { productId: low, change: -1, type: 'sale' }], {}, { wait: '5s' }));
    const deadline = Date.now() + 4000;
    for (;;) {
      const { rows } = await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
      if (rows.length) break;
      assert.ok(Date.now() < deadline, 'it never waited on the held product');
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    await other2.query('BEGIN');
    await other2.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await assert.rejects(other2.query('SELECT id FROM products WHERE id = $1 FOR NO KEY UPDATE NOWAIT', [low]), /could not obtain lock/, 'the lower product is already held');
    await other2.query('ROLLBACK');
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
    other2.release();
  }
  await moving;
  assert.deepEqual([await stockOf(low), await stockOf(high)], [5, 5]);
});

test('moveStock’s lock doesn’t stop a line being saved for that product', async () => {
  const id = await product();
  const other2 = await pool.connect();
  try {
    await inTransaction(async () => {
      await lockStock([id]);
      await other2.query('BEGIN');
      await other2.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
      // What a foreign-key check on the product takes.
      const { rows } = await other2.query('SELECT id FROM products WHERE id = $1 FOR KEY SHARE NOWAIT', [id]);
      assert.equal(rows.length, 1);
      await other2.query('ROLLBACK');
    });
  } finally {
    other2.release();
  }
});

test('changes at once never go under zero between them when they mustn’t', async () => {
  const id = await product(3);
  const results = await Promise.all(Array.from({ length: 8 }, () => inTransaction(() => moveStock([{ productId: id, change: -1, type: 'adjustment' }], {}, { neverBelowZero: true }))));
  assert.equal(results.filter((r) => r.refused).length, 5);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [0, 3]);
});

test('the lock limit ends with its transaction, and never stays on a connection another request reuses', async () => {
  await inShop(async () => {
    await dbExec('BEGIN');
    await lockStock([await (async () => (await prepare("INSERT INTO products (name, updated_at) VALUES ('[Product]', now()) RETURNING id").get()).id)()]);
    assert.equal((await prepare('SHOW lock_timeout').get()).lock_timeout, '2s', 'on during the transaction');
    await dbExec('COMMIT');
    // Back to what the connection opened with (pg_settings' reset_val), whatever that is:
    // none for a real server, a minute under test (server/db.js).
    const after = await prepare("SELECT setting, reset_val FROM pg_settings WHERE name = 'lock_timeout'").get();
    assert.equal(after.setting, after.reset_val, 'off again, as the connection opened');
  });
});

test('moveStock takes what the caller already holds, and doesn’t lock it again', async () => {
  const id = await product(6);
  // A figure only the caller's row could give: refused from it, not from the 6 stored.
  const out = await inTransaction(() => moveStock([{ productId: id, change: -1, type: 'sale' }], {}, { neverBelowZero: true, held: [{ id, name: '[Held]', stock_qty: 0 }] }));
  assert.equal(out.refused.name, '[Held]');
});

test('moveStock tells Shopify only the products it holds there, with the figure after', async () => {
  const [linked, plain] = [await product(), await product()];
  await inShop(() => prepare("UPDATE products SET shopify_inventory_item_id = '[item]' WHERE id = ?").run(linked));
  const out = await inTransaction(() => moveStock([{ productId: linked, change: -1, type: 'sale' }, { productId: plain, change: -1, type: 'sale' }]));
  assert.deepEqual(out.pushes.map((p) => [p.product.id, p.newQty]), [[linked, 5]]);
});

test('moveStock: a shop not given is the business’s oldest', async () => {
  const id = await product();
  await inTransaction(() => moveStock([{ productId: id, change: -1, type: 'sale' }]));
  assert.equal((await linesOf(id))[0].site_id, bolton.id);
});

test('another business can’t move or read this one’s stock', async () => {
  const id = await product();
  const out = await runWithShop(other.shop.id, async () => {
    await dbExec('BEGIN');
    const moved = await moveStock([{ productId: id, change: -1, type: 'sale' }]);
    await dbExec('COMMIT');
    return moved;
  });
  assert.deepEqual(out.missing, [id]);
  assert.equal(await stockOf(id), 6);
  await inTransaction(() => moveStock([{ productId: id, change: -1, type: 'sale' }], { name: 'Jo Taylor' }));
  const seen = await runWithShop(other.shop.id, () => prepare('SELECT count(*)::int AS n FROM stock_movements WHERE product_id = ?').get(id));
  assert.equal(seen.n, 0);
});

test('working out a very large count’s differences takes no time, however many lines it has', () => {
  // It blocks the server for every shop while it runs, under the products' locks.
  const SIZE = 50000;
  const counted = Array.from({ length: SIZE }, (_, i) => ({ product_id: i, counted: 9, name: '[Product]', sku: null, stock_qty: 10, cost_pence: 1400 }));
  const moved = Array.from({ length: SIZE }, (_, i) => ({ product_id: i, type: 'sale', change: -1 }));
  const by = Array.from({ length: SIZE }, (_, i) => ({ product_id: i, name: 'Jo Taylor', qty: 9 }));
  const started = Date.now();
  const rows = differenceRows(counted, moved, by);
  const took = Date.now() - started;
  assert.ok(took < 1000, `took ${took}ms`);
  assert.equal(rows.length, SIZE);
  // Sold 1 after the count: expected is what's here plus that, and 9 were counted.
  assert.deepEqual([rows[7].expected, rows[7].difference, rows[7].byCounter, rows[7].allowedFor], [11, -2, [{ name: 'Jo Taylor', qty: 9 }], [{ kind: 'sold', change: -1 }]]);
});

test('differences keep each product’s own rows, and none for a product nothing moved', () => {
  const counted = [{ product_id: 1, counted: 3, stock_qty: 5, cost_pence: 100 }, { product_id: 2, counted: 2, stock_qty: 2, cost_pence: 100 }];
  const rows = differenceRows(counted, [{ product_id: 1, type: 'sale', change: -1 }, { product_id: 1, type: 'intake', change: 4 }], [{ product_id: 1, name: 'Jo Taylor', qty: 1 }, { product_id: 1, name: 'Jack Lewis', qty: 2 }]);
  assert.deepEqual(rows.map((r) => [r.expected, r.difference, r.byCounter.length, r.allowedFor.length]), [[2, 1, 2, 2], [2, 0, 0, 0]]);
});

test('removing a shop clears its stock lines before what they point at', async () => {
  const shop = await staffSignup(server.baseUrl);
  const seen = [];
  const realConnect = pool.connect;
  pool.connect = async function connect() {
    const client = await realConnect.call(pool);
    const realQuery = client.query;
    client.query = function query(sql, ...rest) {
      if (typeof sql === 'string') seen.push(sql);
      return realQuery.call(client, sql, ...rest);
    };
    const realRelease = client.release;
    client.release = function release(...args) {
      client.query = realQuery;
      client.release = realRelease;
      return realRelease.apply(client, args);
    };
    return client;
  };
  try {
    await removeShop(shop.shop.id);
  } finally {
    pool.connect = realConnect;
  }
  const at = (table) => seen.findIndex((sql) => new RegExp(`^DELETE FROM ${table} WHERE shop_id`).test(sql));
  assert.ok(at('stock_movements') >= 0, 'stock lines are cleared');
  for (const table of ['sales', 'deliveries', 'employees', 'sites', 'purchase_orders', 'till_sales']) {
    assert.ok(at('stock_movements') < at(table), `before ${table}: ${at('stock_movements')} and ${at(table)}`);
  }
});

// ---- Adjusting ----

test('adjusting on the Owner’s own computer: the Owner, the oldest shop', async () => {
  const id = await product();
  assert.equal((await asOwner()(`/api/products/${id}/stock`, POST(adjust))).status, 200);
  const [line] = await linesOf(id);
  assert.deepEqual([line.login_id, line.who_name, line.site_id, line.reason], [owner.loginId, 'Jack Lewis', bolton.id, 'damaged']);
});

test('adjusting on Jo’s own sign-in names her', async () => {
  const id = await product();
  assert.equal((await browser(jo.cookie)(`/api/products/${id}/stock`, POST(adjust))).status, 200);
  const [line] = await linesOf(id);
  assert.deepEqual([line.login_id, line.employee_id, line.who_name], [jo.loginId, jo.employeeId, 'Jo Taylor']);
});

for (const kind of ['till', 'workshop']) {
  test(`adjusting at a ${kind} computer with Jo checked in names Jo, not the sign-in, and that computer’s shop`, async () => {
    const id = await product(6, 14, second);
    const send = await computer(kind, second, jo.pin);
    const res = await send(`/api/products/${id}/stock`, POST(adjust));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [line] = await linesOf(id);
    assert.deepEqual([line.login_id, line.employee_id, line.who_name, line.site_id], [owner.loginId, jo.employeeId, 'Jo Taylor', second.id]);
    // And the history says her, as Today does.
    assert.equal((await asOwner()(`/api/products/${id}`)).body.history[0].who, 'Jo Taylor');
  });

  test(`adjusting at a ${kind} computer with nobody checked in asks for a PIN and changes nothing`, async () => {
    const id = await product();
    const send = await computer(kind, bolton);
    const res = await send(`/api/products/${id}/stock`, POST(adjust));
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.code, 'check_in_first');
    assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [6, 0]);
  });
}

test('Today names the person who adjusted, not the sign-in', async () => {
  const id = await product(6, 71823.57);
  await inShop(() => prepare('UPDATE shops SET stock_adjust_today_over_pence = 1 WHERE id = ?').run(owner.shop.id));
  const send = await computer('till', bolton, jo.pin);
  assert.equal((await send(`/api/products/${id}/stock`, POST(adjust))).status, 200);
  const today = await asOwner()('/api/needs-attention');
  const found = JSON.stringify(today.body);
  const at = found.indexOf(`"productId":${id}`);
  assert.ok(at >= 0, found.slice(0, 400));
  assert.match(found.slice(at, at + 300), /"byName":"Jo Taylor"/);
});

test('a line from before this keeps naming the sign-in it recorded', async () => {
  const id = await product();
  await inShop(() => prepare("INSERT INTO stock_movements (product_id, change_qty, type, login_id) VALUES (?, -1, 'adjustment', ?)").run(id, owner.loginId));
  assert.equal((await asOwner()(`/api/products/${id}`)).body.history[0].who, 'Jack Lewis');
});

test('a person deleted later is still named on their line', async () => {
  const id = await product();
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: '[Name]', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  const { rows: [{ employee_id: employeeId }] } = await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId]);
  await inTransaction(() => moveStock([{ productId: id, change: -1, type: 'adjustment' }], { employeeId, name: '[Name]' }));
  assert.equal((await linesOf(id))[0].employee_id, employeeId);
  await inShop(async () => {
    await prepare('UPDATE logins SET employee_id = NULL WHERE employee_id = ?').run(employeeId);
    await prepare('DELETE FROM employees WHERE id = ?').run(employeeId);
  });
  const [line] = await linesOf(id);
  assert.ok(line.employee_id === null);
  assert.equal(line.who_name, '[Name]');
});

// ---- Adding a product with stock ----

test('adding a product with stock writes its line with who; with nobody checked in on a till it asks for a PIN', async () => {
  const add = (send, stockQty) => { n += 1; return send('/api/products', POST({ name: '[Product]', sku: `[Add ${n}]`, price: 28, stockQty })); };
  const made = await add(asOwner(), 4);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.stockQty, 4);
  const [line] = await linesOf(made.body.id);
  assert.deepEqual([line.change_qty, line.type, line.note, line.who_name, line.site_id], [4, 'intake', 'Initial stock', 'Jack Lewis', bolton.id]);

  const till = await computer('till', bolton);
  const refused = await add(till, 4);
  assert.equal(refused.status, 409, JSON.stringify(refused.body));
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS c FROM products WHERE sku = ?').get(`[Add ${n}]`))).c, 0);
  // With no stock too, now: changing products is the Owner's, who must be the one there
  // (product-editing; decision 11).
  const none = await add(till, 0);
  assert.deepEqual([none.status, none.body.code], [409, 'check_in_first']);
});

test('a code already in use adds no product and no stock line', async () => {
  n += 1;
  const sku = `[Add ${n}]`;
  assert.equal((await asOwner()('/api/products', POST({ name: '[Product]', sku, stockQty: 1 }))).status, 201);
  const again = await asOwner()('/api/products', POST({ name: '[Product]', sku, stockQty: 1 }));
  assert.equal(again.status, 400);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS c FROM products WHERE sku = ?').get(sku))).c, 1);
});

// ---- Receiving ----

async function orderedOrder(productId, qty = 2) {
  const supplierId = await inShop(async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(`[Supplier ${randomUUID().slice(0, 6)}]`)).lastInsertRowid);
  const made = await asOwner()('/api/purchase-orders', POST({ supplierId, items: [{ productId, qty, unitCost: 14 }] }));
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const ordered = await asOwner()(`/api/purchase-orders/${made.body.id}/mark-ordered`, POST());
  assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
  return { ...ordered.body, supplierId };
}

test('booking a delivery in: the person checked in, that shop, the order and the delivery', async () => {
  const id = await product(0);
  const order = await orderedOrder(id);
  const send = await computer('till', second, jo.pin);
  const res = await send('/api/deliveries/receive', POST({ supplierId: order.supplierId, items: [{ itemId: order.items[0].id, qty: 2 }] }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [line] = await linesOf(id);
  assert.deepEqual(
    [line.change_qty, line.type, line.login_id, line.employee_id, line.who_name, line.site_id, line.purchase_order_id, line.delivery_id],
    [2, 'po_receipt', owner.loginId, jo.employeeId, 'Jo Taylor', second.id, order.id, res.body.deliveryId]
  );
  assert.equal(await stockOf(id), 2);
});

test('booking in with no order: its delivery, and no order', async () => {
  const id = await product(0);
  const res = await asOwner()('/api/deliveries/receive', POST({ items: [{ productId: id, qty: 3 }] }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [line] = await linesOf(id);
  assert.deepEqual([line.type, line.who_name, line.delivery_id, line.purchase_order_id], ['intake', 'Jack Lewis', res.body.deliveryId, null]);
});

// ---- A count ----

async function countOneUnder(id, send = asOwner()) {
  n += 1;
  const started = await send('/api/stock-takes', POST({ kind: 'area', target: `[Area ${n}]` }));
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal((await send(`/api/stock-takes/${started.body.id}/join`, POST())).status, 200);
  assert.equal((await send(`/api/stock-takes/${started.body.id}/counts`, POST({ productId: id, qty: (await stockOf(id)) - 1 }))).status, 200);
  return started.body.id;
}

test('applying and undoing a count: the person checked in, that shop, the count', async () => {
  const id = await product(6, 14, second);
  const send = await computer('till', second, owner.pin);
  const take = await countOneUnder(id, send);
  const applied = await send(`/api/stock-takes/${take}/apply`, POST());
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  const undone = await send(`/api/stock-takes/${take}/undo`, POST());
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  const [one, two] = await linesOf(id);
  assert.deepEqual([one.change_qty, one.type, one.who_name, one.site_id, one.stock_take_id], [-1, 'count', 'Jack Lewis', second.id, take]);
  assert.deepEqual([two.change_qty, two.type, two.who_name, two.site_id, two.stock_take_id], [1, 'count_undone', 'Jack Lewis', second.id, take]);
  assert.equal(await stockOf(id), 6);
});

test('a count applied in one go holds every product’s line and result, however many', async () => {
  const ids = [];
  for (let i = 0; i < 25; i += 1) ids.push(await product(5));
  const send = asOwner();
  n += 1;
  const take = (await send('/api/stock-takes', POST({ kind: 'area', target: `[Area ${n}]` }))).body.id;
  await send(`/api/stock-takes/${take}/join`, POST());
  for (const id of ids) assert.equal((await send(`/api/stock-takes/${take}/counts`, POST({ productId: id, qty: 4 }))).status, 200);
  assert.equal((await send(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  const results = await inShop(() => prepare('SELECT r.product_id, r.stock_movement_id, m.id AS line FROM stock_take_results r JOIN stock_movements m ON m.id = r.stock_movement_id WHERE r.stock_take_id = ?').all(take));
  assert.equal(results.length, 25);
  for (const id of ids) assert.equal(await stockOf(id), 4);
});

test('applying or undoing a count at a till with nobody checked in asks for a PIN and changes nothing', async () => {
  const id = await product(6);
  const take = await countOneUnder(id, asOwner());
  const empty = await computer('till', bolton);
  const refused = await empty(`/api/stock-takes/${take}/apply`, POST());
  assert.deepEqual([refused.status, refused.body.code], [409, 'check_in_first']);
  assert.equal(await stockOf(id), 6);
  assert.equal((await asOwner()(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  const noUndo = await empty(`/api/stock-takes/${take}/undo`, POST());
  assert.deepEqual([noUndo.status, noUndo.body.code], [409, 'check_in_first']);
  assert.equal(await stockOf(id), 5);
});

// ---- Waiting ----

async function whileHeld(id, ask) {
  const holder = await pool.connect();
  let res;
  let waited;
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id]);
    const started = Date.now();
    res = await Promise.race([ask(), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    waited = Date.now() - started;
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  return { res, waited };
}
function isBusy({ res, waited }, what) {
  assert.equal(res.status, 503, `${what}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.code, 'busy');
  assert.ok(waited >= 1900 && waited < 4500, `${what} waited ${waited}ms`);
}

test('adjusting a held product answers busy after its 2 seconds and changes nothing; then it goes through', async () => {
  const id = await product();
  isBusy(await whileHeld(id, () => asOwner()(`/api/products/${id}/stock`, POST(adjust))), 'adjust');
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [6, 0]);
  assert.equal((await asOwner()(`/api/products/${id}/stock`, POST(adjust))).status, 200);
  assert.equal(await stockOf(id), 5);
});

test('booking in a held product answers busy, books nothing, and the same key then books it once', async () => {
  const id = await product(0);
  const requestKey = randomUUID().replaceAll('-', '').padEnd(48, '0');
  const send = asOwner();
  const body = { items: [{ productId: id, qty: 1 }], requestKey };
  isBusy(await whileHeld(id, () => send('/api/deliveries/receive', POST(body))), 'receive');
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [0, 0]);
  assert.equal((await send('/api/deliveries/receive', POST(body))).status, 200);
  assert.equal((await send('/api/deliveries/receive', POST(body))).status, 200);
  assert.equal(await stockOf(id), 1);
});

test('the order route’s booking in of a held product answers busy too', async () => {
  const id = await product(0);
  const order = await orderedOrder(id);
  const send = asOwner();
  const body = { items: [{ itemId: order.items[0].id, qtyReceived: 1 }] };
  isBusy(await whileHeld(id, () => send(`/api/purchase-orders/${order.id}/receive`, POST(body))), 'order receive');
  assert.equal(await stockOf(id), 0);
});

test('applying a count of a held product answers busy and stays counting; so does Undo once applied', async () => {
  const id = await product(6);
  const send = asOwner();
  const take = await countOneUnder(id, send);
  isBusy(await whileHeld(id, () => send(`/api/stock-takes/${take}/apply`, POST())), 'apply');
  assert.equal(await stockOf(id), 6);
  assert.equal((await send(`/api/stock-takes/${take}/apply`, POST())).status, 200);
  isBusy(await whileHeld(id, () => send(`/api/stock-takes/${take}/undo`, POST())), 'undo');
  assert.equal(await stockOf(id), 5);
  assert.equal((await send(`/api/stock-takes/${take}/undo`, POST())).status, 200);
  assert.equal(await stockOf(id), 6);
});

test('a deadlock broken by the database answers busy, not a fault, and changes nothing', async () => {
  const [low, high] = [await product(6), await product(6)];
  const send = asOwner();
  n += 1;
  const take = (await send('/api/stock-takes', POST({ kind: 'area', target: `[Area ${n}]` }))).body.id;
  await send(`/api/stock-takes/${take}/join`, POST());
  for (const id of [low, high]) assert.equal((await send(`/api/stock-takes/${take}/counts`, POST({ productId: id, qty: 5 }))).status, 200);
  const holder = await pool.connect();
  let reply;
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    const { rows: [{ pid }] } = await holder.query('SELECT pg_backend_pid() AS pid');
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [high]);
    reply = send(`/api/stock-takes/${take}/apply`, POST());
    // Once Apply holds the lower and waits on the higher, for half the database's
    // deadlock check, ask for the lower: it's the server's check that then finds it.
    const deadline = Date.now() + 1800;
    for (;;) {
      const { rows } = await pool.query(
        `SELECT 1 FROM pg_stat_activity a WHERE $1 = ANY(pg_blocking_pids(a.pid)) AND EXISTS (
           SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND NOT l.granted AND clock_timestamp() - l.waitstart >= current_setting('deadlock_timeout')::interval / 2)`, [pid]
      );
      if (rows.length) break;
      assert.ok(Date.now() < deadline, 'Apply never waited on the held product');
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [low]);
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  const res = await reply;
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.code, 'busy');
  assert.deepEqual([await stockOf(low), await stockOf(high)], [6, 6]);
});

// What's locked ahead of the products has the same limit.
async function whileRowHeld(table, id, ask) {
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
    const started = Date.now();
    const res = await Promise.race([ask(), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    return { res, waited: Date.now() - started };
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
}

test('booking in against a held order answers busy, booking nothing', async () => {
  const id = await product(0);
  const order = await orderedOrder(id);
  const send = asOwner();
  isBusy(await whileRowHeld('purchase_orders', order.id, () => send(`/api/purchase-orders/${order.id}/receive`, POST({ items: [{ itemId: order.items[0].id, qtyReceived: 1 }] }))), 'a held order');
  assert.equal(await stockOf(id), 0);
});

test('applying a held count answers busy, changing nothing', async () => {
  const id = await product(6);
  const send = asOwner();
  const take = await countOneUnder(id, send);
  isBusy(await whileRowHeld('stock_takes', take, () => send(`/api/stock-takes/${take}/apply`, POST())), 'a held count');
  assert.equal(await stockOf(id), 6);
});

test('none of those left a transaction for the server’s safety net to close', async () => {
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.ok(!server.stderr.includes('request finished with a transaction still open'), server.stderr.slice(-500));
});
