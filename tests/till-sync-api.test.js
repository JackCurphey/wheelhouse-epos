// tests/till-sync-api.test.js
// The sync endpoint: a till's sales recorded exactly once, in pence with VAT,
// never refused and never discarded.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §3, §5, §8, §9
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server; let owner; let b1; let alex; let receipt = 0;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
  alex = await runWithShop(owner.shop.id, async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Alex', 1)").run()).lastInsertRowid);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const sync = (items, pendingCount = 0, token = b1.token) =>
  tillRequest(server.baseUrl, owner.shop.slug, token, '/sync', { method: 'POST', body: { pendingCount, items } });
const inShop = (fn) => runWithShop(owner.shop.id, fn);

function sale(productId, { qty = 1, unitPricePence = 699, vatRateBp = 2000, payments, ...rest } = {}) {
  const total = qty * unitPricePence;
  return {
    kind: 'sale', clientId: randomUUID(), receiptNumber: ++receipt, tillClockAt: '2026-09-01T09:30:00.000Z',
    madeOffline: true, employeeId: alex,
    lines: [{ productId, description: 'Inner tube', qty, unitPricePence, vatRateBp }],
    payments: payments || [{ method: 'cash', amountPence: total }],
    ...rest,
  };
}

test('a sale is recorded in pence with VAT per line, and stock goes down', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 5 });
  const item = sale(tube, { qty: 2 });
  const res = await sync([item]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results, [{ clientId: item.clientId, status: 'recorded', attention: [] }]);
  const row = await inShop(() => prepare('SELECT * FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 1398);
  assert.equal(row.vat_pence, 233);
  assert.equal(row.made_offline, true);
  assert.equal(row.till_id, b1.till.id);
  const line = await inShop(() => prepare('SELECT * FROM till_sale_lines WHERE till_sale_id = ?').get(row.id));
  assert.deepEqual([line.qty, line.line_total_pence, line.vat_rate_bp, line.vat_pence], [2, 1398, 2000, 233]);
  const product = await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube));
  assert.equal(product.stock_qty, 3);
  const move = await inShop(() => prepare("SELECT * FROM stock_movements WHERE product_id = ? AND type = 'till_sale'").get(tube));
  assert.equal(move.change_qty, -2);
  assert.equal(move.note, `Till sale B1-${String(item.receiptNumber).padStart(4, '0')}`);
});

test('the same sale sent twice is recorded once', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 5 });
  const item = sale(tube);
  await sync([item]);
  const again = await sync([item]);
  assert.equal(again.body.results[0].status, 'duplicate');
  const { n } = await inShop(() => prepare('SELECT COUNT(*)::int AS n FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(n, 1);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 4);
});

test('an empty batch is a heartbeat: last seen and waiting count are stored', async () => {
  await sync([], 14);
  const tills = (await staffRequest(server.baseUrl, owner.cookie, '/api/tills')).body;
  const t = tills.find((x) => x.code === 'B1');
  assert.equal(t.pendingCount, 14);
  assert.ok(t.lastSeenAt);
});

test('a malformed batch is refused whole', async () => {
  const tube = await seedProduct(owner.shop.id);
  const good = sale(tube);
  const res = await sync([good, { kind: 'sale', clientId: 'not-a-uuid' }]);
  assert.equal(res.status, 400);
  assert.equal(await inShop(() => prepare('SELECT 1 FROM till_sales WHERE client_id = ?').get(good.clientId)), undefined);
});
