// The all_sales view (openspec/changes/wp-1-6-sales-in-pence, design.md
// Decision 3, task 3.2, step B): one row per sale in pence from both records,
// keyed by record and number. Each test gets its own shop.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

const shops = [];
after(async () => {
  for (const s of shops) await deleteTestShop(s.id);
  await pool.end();
});
async function newShop() {
  const shop = await createTestShop();
  shops.push(shop);
  return shop;
}

function oldSale({ id = null, total, at, customerId = null, cashierId = null }) {
  return prepare(
    `INSERT INTO sales (id, created_at, subtotal, total, payment_method, customer_id, cashier_id)
     VALUES (COALESCE(?::int, nextval('sales_id_seq')::int), ?, ?, ?, 'Cash', ?, ?) RETURNING id`
  ).get(id, at, total, total, customerId, cashierId);
}

let tillCount = 0;
async function tillSale({ id = null, totalPence, vatPence = 0, clockAt, receivedAt = clockAt, offline = false, customerId = null, employeeId = null }) {
  const site = (await prepare("SELECT id FROM sites WHERE code = 'B'").get())
    ?? (await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get());
  tillCount += 1;
  const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id')
    .get(site.id, `T${tillCount}`, 'Till', randomUUID());
  return prepare(
    `INSERT INTO till_sales (id, client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id, employee_id)
     VALUES (COALESCE(?::int, nextval('till_sales_id_seq')::int), ?, ?, ?, 7, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).get(id, randomUUID(), till.id, site.id, offline, clockAt, receivedAt, totalPence, vatPence, customerId, employeeId);
}

const rows = (tail = '') => prepare(`SELECT * FROM all_sales ${tail}`).all();

test('a day with one old sale and one till sale counts two, with the right total in pence', async () => {
  const shop = await newShop();
  const day = await runWithShop(shop.id, async () => {
    await oldSale({ total: '12.34', at: '2026-09-01T10:00:00Z' });
    await tillSale({ totalPence: 2500, clockAt: '2026-09-01T11:00:00Z' });
    return prepare(
      `SELECT COUNT(*)::int AS count, SUM(total_pence)::int AS total FROM all_sales
        WHERE made_at >= '2026-09-01T00:00:00Z' AND made_at < '2026-09-02T00:00:00Z'`
    ).get();
  });
  assert.deepEqual({ ...day }, { count: 2, total: 3734 });
});

test('an offline till sale counts on the day of the till\'s clock, not the day it arrived', async () => {
  const shop = await newShop();
  const [row] = await runWithShop(shop.id, async () => {
    await tillSale({ totalPence: 900, clockAt: '2026-08-30T15:00:00Z', receivedAt: '2026-09-01T08:00:00Z', offline: true });
    return rows();
  });
  assert.equal(new Date(row.made_at).toISOString(), '2026-08-30T15:00:00.000Z');
});

test('an old sale and a till sale with the same number stay two rows, told apart by source; old VAT is empty', async () => {
  const shop = await newShop();
  // The same number in both tables; ids are global, so pick one nothing else uses.
  const same = 1_000_000 + Math.floor(Math.random() * 1_000_000);
  const found = await runWithShop(shop.id, async () => {
    await oldSale({ id: same, total: 5, at: '2026-09-01T10:00:00Z' });
    await tillSale({ id: same, totalPence: 700, vatPence: 117, clockAt: '2026-09-01T10:05:00Z' });
    return rows('ORDER BY source');
  });
  assert.deepEqual(found.map((r) => [r.source, Number(r.id), r.total_pence, r.vat_pence]), [['old', same, 500, null], ['till', same, 700, 117]]);
});

test('each row carries the customer and the staff member, and a till sale its receipt number', async () => {
  const shop = await newShop();
  const found = await runWithShop(shop.id, async () => {
    const customer = (await prepare("INSERT INTO customers (name) VALUES ('Sam') RETURNING id").get()).id;
    const staff = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo', 1) RETURNING id").get()).id;
    await oldSale({ total: 5, at: '2026-09-01T10:00:00Z', customerId: customer, cashierId: staff });
    await tillSale({ totalPence: 700, clockAt: '2026-09-01T10:05:00Z', customerId: customer, employeeId: staff });
    return { customer, staff, rows: await rows('ORDER BY source') };
  });
  for (const r of found.rows) {
    assert.equal(r.customer_id, found.customer);
    assert.equal(r.employee_id, found.staff);
  }
  assert.deepEqual(found.rows.map((r) => r.receipt_number), [null, 7]);
});

test('a shop sees only its own sales through the view', async () => {
  const mine = await newShop();
  const other = await newShop();
  await runWithShop(other.id, () => oldSale({ total: 99, at: '2026-09-01T10:00:00Z' }));
  const found = await runWithShop(mine.id, () => rows());
  assert.deepEqual(found, []);
});
