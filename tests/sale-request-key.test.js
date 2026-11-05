// A sale or an order's payment sent twice counts once (openspec/changes/sale-request-key):
// the reviewer's proof first: send a sale, reset the connection once it's saved, send
// it again. Shimano brake pads and Jo Taylor as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let cashier;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  cashier = (await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId])).rows[0].employee_id;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function staff(path, options, who = owner) { return staffRequest(server.baseUrl, who.cookie, path, options); }
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const POST = (body) => ({ method: 'POST', body });
const key = () => randomBytes(24).toString('hex');
let n = 0;
const product = (stock = 10) => inShop(async () => {
  n += 1;
  return (await prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, 'Shimano brake pads', '[Category]', 28, 14, ?, now())").run(`B05S-RX-${n}`, stock)).lastInsertRowid;
});
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const linesOf = (id) => inShop(() => prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id').all(id));
const salesOf = (id) => inShop(async () => (await prepare('SELECT count(DISTINCT sale_id)::int AS c FROM sale_items WHERE product_id = ?').get(id)).c);
const sale = (id, requestKey, over = {}) => ({ items: [{ productId: id, qty: 1 }], cardAmount: 28, cashierId: cashier, ...(requestKey ? { requestKey } : {}), ...over });
const hashOf = (k) => createHash('sha256').update(k).digest('hex');

// Sends the request and cuts the connection the moment the sale is saved, so the
// answer is never read.
function sendThenReset(path, body) {
  const u = new URL(path, server.baseUrl);
  const raw = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { cookie: owner.cookie, 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } });
    req.on('error', () => {});
    req.on('response', (res) => { res.destroy(); });
    req.end(raw, async () => {
      const deadline = Date.now() + 5000;
      for (;;) {
        const made = await inShop(() => prepare('SELECT id FROM sales WHERE request_key_hash = ?').get(hashOf(body.requestKey)));
        if (made) { req.destroy(); resolve(made.id); return; }
        if (Date.now() > deadline) { req.destroy(); reject(new Error('the sale was never saved')); return; }
        await new Promise((r) => { setTimeout(r, 5); });
      }
    });
  });
}

test('a lost answer then a second press records the sale once: stock 10 to 9, one line', async () => {
  const id = await product(10);
  const body = sale(id, key());
  const first = await sendThenReset('/api/sales', body);
  const again = await staff('/api/sales', POST(body));
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.id, first);
  assert.ok(again.body.items.length === 1, 'the whole sale, as the first answer had it');
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesOf(id)], [9, 1, 1]);
});

test('sent again after an answer that arrived: the same sale, nothing more', async () => {
  const id = await product(10);
  const body = sale(id, key());
  const first = await staff('/api/sales', POST(body));
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const again = await staff('/api/sales', POST(body));
  assert.deepEqual([again.status, again.body.id, again.body.total], [201, first.body.id, first.body.total]);
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('the same key sent several times at once records one sale', async () => {
  const id = await product(10);
  const body = sale(id, key());
  const replies = await Promise.all(Array.from({ length: 6 }, () => staff('/api/sales', POST(body))));
  assert.deepEqual(replies.map((r) => r.status), Array(6).fill(201), 'each queues, then gets the one sale');
  assert.equal(new Set(replies.map((r) => r.body.id)).size, 1);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesOf(id)], [9, 1, 1]);
});

test('the same key with a different basket or payment is refused, saying which sale, and records nothing', async () => {
  const id = await product(10);
  const requestKey = key();
  const first = await staff('/api/sales', POST(sale(id, requestKey)));
  for (const over of [{ items: [{ productId: id, qty: 2 }], cardAmount: 56 }, { cardAmount: 0, cashAmount: 28 }]) {
    const res = await staff('/api/sales', POST(sale(id, requestKey, over)));
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.deepEqual([res.body.code, res.body.saleId], ['reused_key', first.body.id]);
    assert.match(res.body.error, /already recorded/);
  }
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('a refused sale keeps no key: fixed, the same key goes through', async () => {
  const id = await product(10);
  const requestKey = key();
  const refused = await staff('/api/sales', POST(sale(id, requestKey, { cardAmount: 1 })));
  assert.equal(refused.status, 400, JSON.stringify(refused.body));
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS c FROM sales WHERE request_key_hash = ?').get(hashOf(requestKey)))).c, 0);
  const fixed = await staff('/api/sales', POST(sale(id, requestKey)));
  assert.equal(fixed.status, 201, JSON.stringify(fixed.body));
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('a sale of a held product answers busy and keeps no key: the same key then sells it once', async () => {
  const id = await product(10);
  const body = sale(id, key());
  const holder = await pool.connect();
  let res;
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id]);
    res = await Promise.race([staff('/api/sales', POST(body)), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(await stockOf(id), 10);
  assert.equal((await staff('/api/sales', POST(body))).status, 201);
  assert.equal((await staff('/api/sales', POST(body))).status, 201);
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('a repeat gets its first answer even if its cashier has since gone', async () => {
  const id = await product(10);
  const made = await staff('/api/team', POST({ name: '[Name]', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' }));
  const gone = (await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId])).rows[0].employee_id;
  const body = sale(id, key(), { cashierId: gone });
  const first = await staff('/api/sales', POST(body));
  assert.equal(first.status, 201, JSON.stringify(first.body));
  await inShop(() => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(gone));
  const again = await staff('/api/sales', POST(body));
  assert.deepEqual([again.status, again.body.id], [201, first.body.id]);
});

test('a send waiting behind another of its own key gives up after 2 seconds, and sells nothing', async () => {
  const id = await product(10);
  const requestKey = key();
  const holder = await pool.connect();
  let res;
  let waited;
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [hashOf(requestKey)]);
    const started = Date.now();
    res = await Promise.race([staff('/api/sales', POST(sale(id, requestKey))), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    waited = Date.now() - started;
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
  assert.equal(await stockOf(id), 10);
});

test('a bad key is refused; no key at all still works, and each sends its own sale', async () => {
  const id = await product(10);
  assert.equal((await staff('/api/sales', POST(sale(id, 'short')))).status, 400);
  assert.equal(await stockOf(id), 10);
  assert.equal((await staff('/api/sales', POST(sale(id)))).status, 201);
  assert.equal((await staff('/api/sales', POST(sale(id)))).status, 201);
  assert.deepEqual([await stockOf(id), await salesOf(id)], [8, 2]);
});

test('a key says nothing across businesses: another shop with the same key makes its own sale', async () => {
  const requestKey = key();
  const id = await product(10);
  const first = await staff('/api/sales', POST(sale(id, requestKey)));
  const theirs = await runWithShop(other.shop.id, async () => (await prepare("INSERT INTO products (sku, name, price, stock_qty, updated_at) VALUES ('[Code]', '[Product]', 28, 10, now())").run()).lastInsertRowid);
  const theirCashier = await staff('/api/team', POST({ name: '[Name]', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' }), other);
  const employee = (await pool.query('SELECT employee_id FROM logins WHERE id = $1', [theirCashier.body.loginId])).rows[0].employee_id;
  const res = await staff('/api/sales', POST({ items: [{ productId: theirs, qty: 1 }], cardAmount: 28, cashierId: employee, requestKey }), other);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.notEqual(res.body.id, first.body.id);
});

// ---- An order's payment ----

async function order(id) {
  const made = await staff('/api/sale-documents', POST({ kind: 'order', items: [{ lineType: 'product', productId: id, qty: 1 }] }));
  assert.ok(made.body.id, JSON.stringify(made.body));
  return made.body.id;
}
const pay = (requestKey, over = {}) => ({ cardAmount: 28, cashierId: cashier, sellPastStock: true, ...(requestKey ? { requestKey } : {}), ...over });

test('an order’s payment with a lost answer: the second press gets the first sale, once', async () => {
  const id = await product(10);
  const orderId = await order(id);
  const body = pay(key());
  const first = await sendThenReset(`/api/sale-documents/${orderId}/convert`, body);
  const again = await staff(`/api/sale-documents/${orderId}/convert`, POST(body));
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.id, first);
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('another till’s payment, or this one with different details, is told it’s already paid and which sale', async () => {
  const id = await product(10);
  const orderId = await order(id);
  const requestKey = key();
  const first = await staff(`/api/sale-documents/${orderId}/convert`, POST(pay(requestKey)));
  assert.equal(first.status, 201, JSON.stringify(first.body));
  for (const [what, body] of [['another key', pay(key())], ['no key', pay()], ['this key, paid differently', pay(requestKey, { cardAmount: 0, cashAmount: 28 })]]) {
    const res = await staff(`/api/sale-documents/${orderId}/convert`, POST(body));
    assert.equal(res.status, 400, what);
    assert.deepEqual([res.body.code, res.body.saleId], ['already_converted', first.body.id], what);
  }
  assert.deepEqual([await stockOf(id), await salesOf(id)], [9, 1]);
});

test('a repeat of a job’s payment repeats the first answer’s warning, and doesn’t finish the job again', async () => {
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  let job = (await staff('/api/workshop-jobs', POST({ title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex }))).body;
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, POST({ version: job.version }))).body;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  await inShop(() => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(alex));
  const body = { cardAmount: 65, cashierId: cashier, signedOffBy: alex, requestKey: key() };
  const first = await staff(`/api/sale-documents/${job.orderId}/convert`, POST(body));
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.match(first.body.jobWarning, /not signed off/);
  const version = (await staff(`/api/workshop-jobs/${job.id}`)).body.version;
  const again = await staff(`/api/sale-documents/${job.orderId}/convert`, POST(body));
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.deepEqual([again.body.id, again.body.jobWarning], [first.body.id, first.body.jobWarning]);
  assert.equal((await staff(`/api/workshop-jobs/${job.id}`)).body.version, version, 'the job didn’t move');
});

test('a bad key on an order’s payment is refused, and pays nothing', async () => {
  const id = await product(10);
  const orderId = await order(id);
  assert.equal((await staff(`/api/sale-documents/${orderId}/convert`, POST(pay('short')))).status, 400);
  assert.equal(await stockOf(id), 10);
});
