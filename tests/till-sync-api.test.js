// tests/till-sync-api.test.js
// The sync endpoint: a till's sales recorded exactly once, in pence with VAT,
// never refused and never discarded.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §3, §5, §8, §9
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
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

test('a bad receiptNumber with a valid clientId is not a 400 - it fails alone', async () => {
  const tube = await seedProduct(owner.shop.id);
  const bad = sale(tube, { receiptNumber: -1 });
  const res = await sync([bad]);
  assert.equal(res.status, 200);
  assert.equal(res.body.results[0].status, 'failed');
  assert.ok(res.body.results[0].reason);
});

test('a bad item fails alone and the rest of the batch is recorded', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 100 });
  const goodA = sale(tube);
  const badItem = sale(tube, { qty: 2147483648 });
  const goodB = sale(tube);
  const res = await sync([goodA, badItem, goodB]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results.map((r) => r.status), ['recorded', 'failed', 'recorded']);
  assert.ok(res.body.results[1].reason, 'the failed item should carry a reason');
  const [rowA, rowBad, rowB] = await Promise.all([goodA, badItem, goodB].map((it) =>
    inShop(() => prepare('SELECT 1 FROM till_sales WHERE client_id = ?').get(it.clientId))));
  assert.ok(rowA);
  assert.equal(rowBad, undefined);
  assert.ok(rowB);
});

// saleProblem's own bounds checking (receiptNumber/qty/unitPricePence/
// amountPence within int4, per-line and sale-total overflow, tillClockAt
// year, a NUL in description) catches every bad value reachable through the
// sync API before a transaction is even opened - so there is no longer a
// value this test can send that reaches the database and gets rejected
// there. This test pins the fallback itself: a sale whose two lines are each
// within int4 but whose *sum* overflows it is still caught pre-database (by
// the sale-total check in saleProblem), so it is reported 'failed' without a
// transaction ever starting - and the surrounding items are unaffected. The
// catch-and-continue path in processSyncItems (a value saleProblem does NOT
// pre-check, that only the database rejects) was separately exercised as a
// break-on-purpose: see task-7-8-report.md.
test('a sale whose lines overflow the database only when summed fails alone, not the batch', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 100 });
  const goodA = sale(tube);
  const overflow = sale(tube, {
    lines: [
      { productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 2000000000, vatRateBp: 2000 },
      { productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 2000000000, vatRateBp: 2000 },
    ],
    payments: [{ method: 'cash', amountPence: 2000000000 }],
  });
  const goodB = sale(tube);
  const res = await sync([goodA, overflow, goodB]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results.map((r) => r.status), ['recorded', 'failed', 'recorded']);
  assert.ok(res.body.results[1].reason);
  assert.equal(await inShop(() => prepare('SELECT 1 FROM till_sales WHERE client_id = ?').get(overflow.clientId)), undefined);
});

test('a null line or payment entry fails that sale alone, never the whole batch', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 100 });
  const goodA = sale(tube);
  const nullLine = sale(tube, { lines: [null] });
  const goodB = sale(tube);
  const nullPayment = sale(tube, { payments: [null] });
  const res = await sync([goodA, nullLine, goodB, nullPayment]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results.map((r) => r.status), ['recorded', 'failed', 'recorded', 'failed']);
  assert.equal(res.body.results[1].reason, 'Every line must be an object');
  assert.equal(res.body.results[3].reason, 'Every payment must be an object');
});

test('staff, customer or product ids beyond the database range are treated as not found', async () => {
  const tube = await seedProduct(owner.shop.id);
  const res = await sync([sale(tube, { employeeId: 2147483648 })]);
  assert.equal(res.body.results[0].status, 'recorded');
  assert.ok(res.body.results[0].attention.includes('unknown_employee'));
  const both = await sync([sale(2147483648, { customerId: -2147483649 })]);
  assert.equal(both.body.results[0].status, 'recorded');
  assert.deepEqual(both.body.results[0].attention.sort(), ['unknown_customer', 'unknown_product']);
});

test('stock is updated in product id order whatever order the lines came in', async () => {
  const low = await seedProduct(owner.shop.id, { stock: 10 });
  const high = await seedProduct(owner.shop.id, { stock: 10 });
  assert.ok(low < high);
  const item = sale(high, {
    lines: [
      { productId: high, description: 'High', qty: 1, unitPricePence: 100, vatRateBp: 2000 },
      { productId: low, description: 'Low', qty: 1, unitPricePence: 100, vatRateBp: 2000 },
    ],
    payments: [{ method: 'cash', amountPence: 200 }],
  });
  await sync([item]);
  const label = `Till sale B1-${String(item.receiptNumber).padStart(4, '0')}`;
  const moves = await inShop(() => prepare('SELECT product_id FROM stock_movements WHERE note = ? ORDER BY id').all(label));
  assert.deepEqual(moves.map((m) => m.product_id), [low, high]);
  const row = await inShop(() => prepare('SELECT id FROM till_sales WHERE client_id = ?').get(item.clientId));
  const lines = await inShop(() => prepare('SELECT description FROM till_sale_lines WHERE till_sale_id = ? ORDER BY id').all(row.id));
  assert.deepEqual(lines.map((l) => l.description), ['High', 'Low'], 'lines keep the till\'s order');
});

// A real deadlock: this test holds the lock on `high`, the server's sale
// locks `low` then waits on `high`, then this test asks for `low`. Postgres
// breaks the cycle by cancelling the server's transaction (it waited first,
// so its deadlock check fires first). That is a passing condition, not a bad
// sale: the request answers 503 and the till re-sends.
test('a deadlock answers 503 so the till re-sends, and nothing is lost or doubled', async () => {
  const low = await seedProduct(owner.shop.id, { stock: 10 });
  const high = await seedProduct(owner.shop.id, { stock: 10 });
  const first = sale(low);
  const locked = sale(low, {
    lines: [
      { productId: low, description: 'Low', qty: 1, unitPricePence: 100, vatRateBp: 2000 },
      { productId: high, description: 'High', qty: 1, unitPricePence: 100, vatRateBp: 2000 },
    ],
    payments: [{ method: 'cash', amountPence: 200 }],
  });
  let pending;
  await inShop(async () => {
    await dbExec('BEGIN');
    try {
      await prepare('UPDATE products SET stock_qty = stock_qty WHERE id = ?').run(high);
      pending = sync([first, locked]);
      await new Promise((r) => setTimeout(r, 400));
      await prepare('UPDATE products SET stock_qty = stock_qty WHERE id = ?').run(low);
    } finally {
      await dbExec('ROLLBACK');
    }
  });
  const res = await pending;
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { error: 'Busy - try again' });
  const again = await sync([first, locked]);
  assert.deepEqual(again.body.results.map((r) => r.status), ['duplicate', 'recorded']);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(low))).stock_qty, 8);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(high))).stock_qty, 9);
});

test('a multi-line sale records VAT at each line\'s own rate', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const zeroRated = await seedProduct(owner.shop.id, { stock: 10 });
  const item = sale(tube, {
    lines: [
      { productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 1200, vatRateBp: 2000 },
      { productId: zeroRated, description: 'Repair manual', qty: 1, unitPricePence: 500, vatRateBp: 0 },
    ],
    payments: [{ method: 'cash', amountPence: 1700 }],
  });
  const res = await sync([item]);
  assert.equal(res.body.results[0].status, 'recorded');
  const row = await inShop(() => prepare('SELECT * FROM till_sales WHERE client_id = ?').get(item.clientId));
  const lines = await inShop(() => prepare('SELECT * FROM till_sale_lines WHERE till_sale_id = ? ORDER BY id').all(row.id));
  assert.equal(lines[0].vat_pence, 200);
  assert.equal(lines[1].vat_pence, 0);
  assert.equal(row.vat_pence, 200);
  assert.equal(row.total_pence, 1700);
});

test('stock is allowed below zero and flagged once per product', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 1 });
  const first = await sync([sale(tube, { qty: 2 })]);
  assert.deepEqual(first.body.results[0].attention, ['stock_below_zero']);
  const second = await sync([sale(tube)]);
  assert.deepEqual(second.body.results[0].attention, []);
  const open = await inShop(() => prepare(
    "SELECT COUNT(*)::int AS n FROM till_attention WHERE kind = 'stock_below_zero' AND product_id = ? AND resolved_at IS NULL"
  ).get(tube));
  assert.equal(open.n, 1);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, -2);
});

test('a sale of a product the server no longer has is recorded and flagged', async () => {
  const item = sale(2147483000);
  const res = await sync([item]);
  assert.equal(res.body.results[0].status, 'recorded');
  assert.deepEqual(res.body.results[0].attention, ['unknown_product']);
  const row = await inShop(() => prepare('SELECT total_pence FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 699);
});

test('the price charged at the till stands', async () => {
  const tube = await seedProduct(owner.shop.id, { price: '9.99' });
  const item = sale(tube, { unitPricePence: 500 });
  await sync([item]);
  const row = await inShop(() => prepare('SELECT total_pence FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 500);
});

test('payments that do not add up, or an unhandled method, are recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  const short = await sync([sale(tube, { payments: [{ method: 'cash', amountPence: 600 }] })]);
  assert.deepEqual(short.body.results[0].attention, ['payments_do_not_match']);
  const account = await sync([sale(tube, { payments: [{ method: 'account', amountPence: 699 }] })]);
  assert.deepEqual(account.body.results[0].attention, ['unsupported_payment_method']);
});

test('an unknown staff member or customer is recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  const res = await sync([sale(tube, { employeeId: 2147483000, customerId: 2147483000 })]);
  assert.deepEqual(res.body.results[0].attention.sort(), ['unknown_customer', 'unknown_employee']);
});

test('a customer added offline is created once, and a sale can point at it', async () => {
  const tube = await seedProduct(owner.shop.id);
  const cust = { kind: 'customer', clientId: randomUUID(), name: 'Sam Spokes', email: 'sam@example.test', phone: '07700 900123' };
  const item = { ...sale(tube), customerClientId: cust.clientId };
  const res = await sync([cust, item]);
  assert.deepEqual(res.body.results.map((r) => r.status), ['recorded', 'recorded']);
  assert.equal((await sync([cust])).body.results[0].status, 'duplicate');
  const c = await inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(cust.clientId));
  const s = await inShop(() => prepare('SELECT customer_id FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(s.customer_id, c.id);
});

test('a customer who may already exist is flagged, not merged', async () => {
  await inShop(() => prepare("INSERT INTO customers (name, email, phone) VALUES ('Sam S', 'SAM2@example.test', '07700 900999')").run());
  const byEmail = { kind: 'customer', clientId: randomUUID(), name: 'Sam', email: 'sam2@example.test' };
  const byPhone = { kind: 'customer', clientId: randomUUID(), name: 'Samuel', phone: '07700900999' };
  const res = await sync([byEmail, byPhone]);
  assert.deepEqual(res.body.results.map((r) => r.attention), [['possible_duplicate_customer'], ['possible_duplicate_customer']]);
  const [byEmailRow, byPhoneRow, existing] = await Promise.all([
    inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(byEmail.clientId)),
    inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(byPhone.clientId)),
    inShop(() => prepare("SELECT id FROM customers WHERE name = 'Sam S' AND email = 'SAM2@example.test'").get()),
  ]);
  assert.ok(byEmailRow, 'the by-email customer should have been created, not merged');
  assert.ok(byPhoneRow, 'the by-phone customer should have been created, not merged');
  assert.ok(existing, 'the pre-existing customer should be untouched');
});

test('a sale pointing at a customer the server never received is recorded without one', async () => {
  const tube = await seedProduct(owner.shop.id);
  const res = await sync([{ ...sale(tube), customerClientId: randomUUID() }]);
  assert.deepEqual(res.body.results[0].attention, ['unknown_customer']);
});

test('a check-in is recorded once', async () => {
  const item = { kind: 'checkin', clientId: randomUUID(), employeeId: alex, checkedInAt: '2026-09-01T08:55:00.000Z' };
  assert.equal((await sync([item])).body.results[0].status, 'recorded');
  assert.equal((await sync([item])).body.results[0].status, 'duplicate');
  const rows = await inShop(() => prepare('SELECT till_id FROM staff_checkins WHERE client_id = ?').all(item.clientId));
  assert.deepEqual(rows.map((r) => r.till_id), [b1.till.id]);
});

test('a check-in for an unknown staff member fails and is not stored', async () => {
  const item = { kind: 'checkin', clientId: randomUUID(), employeeId: 2147483000, checkedInAt: '2026-09-01T08:55:00.000Z' };
  const res = await sync([item]);
  assert.equal(res.body.results[0].status, 'failed');
  const row = await inShop(() => prepare('SELECT 1 FROM staff_checkins WHERE client_id = ?').get(item.clientId));
  assert.equal(row, undefined);
});

test('a customer item with no name fails alone', async () => {
  const tube = await seedProduct(owner.shop.id);
  const badCustomer = { kind: 'customer', clientId: randomUUID(), name: '' };
  const goodSale = sale(tube);
  const res = await sync([badCustomer, goodSale]);
  assert.deepEqual(res.body.results.map((r) => r.status), ['failed', 'recorded']);
});

test('sales arriving out of order are all recorded with their own receipt numbers', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const s1 = sale(tube); const s2 = sale(tube); const s3 = sale(tube);
  await sync([s3, s1]);
  await sync([s2]);
  const rows = await inShop(() => prepare(
    'SELECT receipt_number FROM till_sales WHERE client_id IN (?, ?, ?) ORDER BY receipt_number'
  ).all(s1.clientId, s2.clientId, s3.clientId));
  assert.deepEqual(rows.map((r) => r.receipt_number), [s1.receiptNumber, s2.receiptNumber, s3.receiptNumber]);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 7);
});

// The till sent a batch, the server recorded it, and the reply was lost. The
// till re-sends the whole batch plus a new sale: nothing doubles, nothing is lost.
test('a batch re-sent after a lost reply neither doubles nor loses a sale', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const a = sale(tube); const b = sale(tube); const c = sale(tube);
  await sync([a, b]);
  const res = await sync([a, b, c]);
  assert.deepEqual(res.body.results.map((r) => r.status), ['duplicate', 'duplicate', 'recorded']);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 7);
});

test('two tills can use the same running number without clashing', async () => {
  const b2 = await registerTill(server.baseUrl, owner, { number: 2 });
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const onB1 = { ...sale(tube), receiptNumber: 9001 };
  const onB2 = { ...sale(tube), receiptNumber: 9001 };
  await sync([onB1]);
  const res = await sync([onB2], 0, b2.token);
  assert.deepEqual(res.body.results[0].attention, []);
  const moves = await inShop(() => prepare(
    "SELECT note FROM stock_movements WHERE product_id = ? ORDER BY id"
  ).all(tube));
  assert.deepEqual(moves.map((m) => m.note), ['Till sale B1-9001', 'Till sale B2-9001']);
});

test('the same till reusing a receipt number is recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  await sync([{ ...sale(tube), receiptNumber: 8001 }]);
  const res = await sync([{ ...sale(tube), receiptNumber: 8001 }]);
  assert.deepEqual(res.body.results[0].attention, ['receipt_number_reused']);
});

test('the snapshot tells a replaced till where its numbers got to', async () => {
  const tube = await seedProduct(owner.shop.id);
  await sync([{ ...sale(tube), receiptNumber: 9500 }]);
  const res = await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/snapshot');
  assert.equal(res.body.lastReceiptNumber, 9500);
});
