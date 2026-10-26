// The totals check (openspec/changes/wp-1-6-sales-in-pence, design.md
// Decision 7, task 1.1): every mismatch kind, the two known kinds, and a
// clean shop. Each test gets its own shop, so other test files' sales can't
// show up in its report.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { checkShop, dayTotals, checkMoneyTotals, formatReport, CONVERTED, KNOWN_KINDS } from '../scripts/ci/check-money-totals.mjs';

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

async function check(shopId, options) {
  const client = await pool.connect();
  try { return await checkShop(client, shopId, options); } finally { client.release(); }
}

// An old sale, in pounds, with labour lines (no product needed).
function oldSale({ subtotal, discount = 0, group = 0, total, cash = 0, card = 0, payments = [], lines = [], at = '2026-09-02T10:00:00Z' }) {
  return prepare(
    `INSERT INTO sales (created_at, subtotal, discount, group_discount_amount, total, payment_method, cash_amount, card_amount)
     VALUES (?, ?, ?, ?, ?, 'Cash', ?, ?) RETURNING id`
  ).get(at, subtotal, discount, group, total, cash, card).then(async ({ id }) => {
    for (const amount of lines) {
      await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Labour', ?, 1, ?, 'labour')").run(id, amount, amount);
    }
    for (const amount of payments) {
      await prepare("INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, 'Cyclescheme', ?)").run(id, amount);
    }
    return id;
  });
}

// An order, with pence written beside pounds as the routes write them from
// step A (Migration 073), and paid_pence the converted sale's total.
async function order({ subtotal, discount = 0, total, lines = [], status = 'open', convertedSaleId = null }) {
  const p = (pounds) => Math.round(pounds * 100);
  const { id } = await prepare(
    `INSERT INTO sale_documents (kind, status, subtotal, discount, total, converted_sale_id, subtotal_pence, discount_pence, total_pence, paid_pence)
     VALUES ('order', ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT ROUND(total * 100)::int FROM sales WHERE id = ?), 0)) RETURNING id`
  ).get(status, subtotal, discount, total, convertedSaleId, p(subtotal), p(discount), p(total), convertedSaleId);
  for (const amount of lines) {
    await prepare(
      "INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type, unit_price_pence, line_total_pence) VALUES (?, 'Labour', ?, 1, ?, 'labour', ?, ?)"
    ).run(id, amount, amount, p(amount), p(amount));
  }
  return id;
}

async function tillSale({ total, lines = [], payments = [] }) {
  const site = (await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get()).id;
  const till = (await prepare("INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, 'B1', 'Till', ?) RETURNING id").get(site, randomUUID())).id;
  const { id } = await prepare(
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, total_pence, vat_pence)
     VALUES (?, ?, ?, 1, false, '2026-09-02T10:00:00Z', ?, 0) RETURNING id`
  ).get(randomUUID(), till, site, total);
  for (const pence of lines) {
    await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Labour', 1, ?, ?, 0, 0)").run(id, pence, pence);
  }
  for (const pence of payments) {
    await prepare("INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, 'card', ?)").run(id, pence);
  }
  return id;
}

const only = (result, kind) => result.mismatches.filter((m) => m.kind === kind);

test('a clean shop reports no mismatches, and how many records it checked', async () => {
  const shop = await newShop();
  await runWithShop(shop.id, async () => {
    const sale = await oldSale({ subtotal: 30, discount: 5, total: 25, cash: 10, payments: [15], lines: [10, 20] });
    await order({ subtotal: 30, discount: 5, total: 25, lines: [10, 20] });
    await order({ subtotal: 12.5, total: 12.5, lines: [12.5], status: 'converted', convertedSaleId: sale });
    await tillSale({ total: 1250, lines: [1000, 250], payments: [1250] });
  });
  const result = await check(shop.id);
  assert.deepEqual(result.mismatches, []);
  // 2 orders and 3 order lines carry both pounds and pence.
  assert.deepEqual(result.checked, { orders: 2, oldSales: 1, tillSales: 1, conversion: 5, days: 0 });
  assert.match(formatReport(await reportFor(shop.id)), /No mismatches/);
});

test('an order whose lines add up to 1p more than its subtotal is named, with both amounts', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => order({ subtotal: 20, total: 20, lines: [10, 10.01] }));
  const [m] = only(await check(shop.id), 'order_lines');
  assert.deepEqual({ ...m }, { kind: 'order_lines', known: false, table: 'sale_documents', record: id, shopId: shop.id, expected: 2000, actual: 2001, detail: m.detail });
  assert.match(m.detail, /lines/);
});

test('an order whose total isn\'t its subtotal less the discount, never below 0, is named', async () => {
  const shop = await newShop();
  const { wrong, belowZero, floored } = await runWithShop(shop.id, async () => ({
    wrong: await order({ subtotal: 20, discount: 5, total: 16, lines: [20] }),
    belowZero: await order({ subtotal: 5, discount: 10, total: -5, lines: [5] }),
    floored: await order({ subtotal: 5, discount: 10, total: 0, lines: [5] }),
  }));
  const found = only(await check(shop.id), 'order_total');
  assert.deepEqual(found.map((m) => [m.record, m.expected, m.actual]), [[wrong, 1500, 1600], [belowZero, 0, -500]]);
  assert.ok(!found.some((m) => m.record === floored));
});

test('an old sale whose lines don\'t add up to its subtotal is named', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => oldSale({ subtotal: 20, total: 20, cash: 20, lines: [10, 9] }));
  const found = only(await check(shop.id), 'sale_lines');
  assert.deepEqual(found.map((m) => [m.table, m.record, m.expected, m.actual]), [['sales', id, 2000, 1900]]);
});

test('a till sale whose lines don\'t add up to its total is named', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => tillSale({ total: 1000, lines: [600, 300], payments: [1000] }));
  const found = only(await check(shop.id), 'sale_lines');
  assert.deepEqual(found.map((m) => [m.table, m.record, m.expected, m.actual]), [['till_sales', id, 1000, 900]]);
});

test('payments that don\'t add up to the total are named, in both records', async () => {
  const shop = await newShop();
  const { old, till } = await runWithShop(shop.id, async () => ({
    old: await oldSale({ subtotal: 20, total: 20, cash: 5, card: 5, payments: [5], lines: [20] }),
    till: await tillSale({ total: 1000, lines: [1000], payments: [400, 500] }),
  }));
  const found = only(await check(shop.id), 'payments');
  assert.deepEqual(found.map((m) => [m.table, m.record, m.expected, m.actual, m.known]), [['sales', old, 2000, 1500, false], ['till_sales', till, 1000, 900, false]]);
});

test('an old sale\'s total off by more than the group-discount rounding is a sale-total mismatch', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => oldSale({ subtotal: 20, discount: 2, group: 1, total: 18, cash: 18, lines: [20] }));
  const found = only(await check(shop.id), 'sale_total');
  assert.deepEqual(found.map((m) => [m.record, m.expected, m.actual, m.known]), [[id, 1700, 1800, false]]);
});

test('the two known kinds are reported but marked known: group-discount rounding and the 1p payment tolerance', async () => {
  const shop = await newShop();
  const { rounding, tolerance } = await runWithShop(shop.id, async () => ({
    // 10.00 less a 0.33 group discount is 9.67, stored as 9.66.
    rounding: await oldSale({ subtotal: 10, group: 0.33, total: 9.66, cash: 9.66, lines: [10] }),
    // createSale accepts payments within 1p of the total.
    tolerance: await oldSale({ subtotal: 10, total: 10, cash: 9.99, lines: [10] }),
  }));
  const result = await check(shop.id);
  assert.deepEqual(result.mismatches.map((m) => [m.kind, m.record, m.expected, m.actual, m.known]), [
    ['group_discount_rounding', rounding, 967, 966, true],
    ['payment_tolerance', tolerance, 1000, 999, true],
  ]);
  assert.deepEqual(KNOWN_KINDS, ['group_discount_rounding', 'payment_tolerance']);
});

test('a 1p total difference with no group discount is not the known rounding kind', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => oldSale({ subtotal: 10, total: 9.99, cash: 9.99, lines: [10] }));
  const found = (await check(shop.id)).mismatches;
  assert.deepEqual(found.map((m) => [m.kind, m.record, m.known]), [['sale_total', id, false]]);
});

test('conversion: every row with pounds and pence has pounds × 100 = pence; tables not converted yet are listed', async () => {
  const shop = await newShop();
  const client = await pool.connect();
  try {
    // A temporary table stands in for a converted one, so each case is
    // written directly rather than through Migration 073's columns.
    await client.query('CREATE TEMP TABLE money_fixture (id SERIAL PRIMARY KEY, shop_id INTEGER, amount NUMERIC(10,2), amount_pence INTEGER)');
    await client.query('INSERT INTO money_fixture (shop_id, amount, amount_pence) VALUES ($1, 12.34, 1234), ($1, 12.34, 1235), ($2, 1, 5)', [shop.id, -1]);
    const converted = [{ table: 'money_fixture', columns: ['amount'] }, { table: 'sale_documents', columns: ['nonexistent'] }];
    const result = await checkShop(client, shop.id, { converted });
    const found = only(result, 'conversion');
    assert.deepEqual(found.map((m) => [m.table, m.record, m.column, m.expected, m.actual]), [['money_fixture', 2, 'amount_pence', 1234, 1235]]);
    assert.equal(result.checked.conversion, 2);
    assert.deepEqual(result.notConvertedYet, ['sale_documents.nonexistent']);
  } finally {
    client.release(true);
  }
});

test('the converted columns are the ones design.md Decision 1 lists, and step A′’s (task 2.1)', () => {
  assert.deepEqual(CONVERTED, [
    { table: 'sale_documents', columns: ['subtotal', 'discount', 'total'] },
    { table: 'sale_document_items', columns: ['unit_price', 'line_total'] },
    { table: 'workshop_services', columns: ['price'] },
    { table: 'workshop_quote_lines', columns: ['unit_amount'] },
    { table: 'workshop_job_services', columns: ['booked_price'] },
  ]);
});

test('days: per-day old-sale totals are saved as a baseline, and a changed past day is named', async () => {
  const shop = await newShop();
  const changed = await runWithShop(shop.id, async () => {
    await oldSale({ subtotal: 10, total: 10, cash: 10, lines: [10], at: '2026-09-02T09:00:00Z' });
    // 23:30 UTC on 2 Sep is 00:30 on 3 Sep in London (summer time).
    const late = await oldSale({ subtotal: 5, total: 5, cash: 5, lines: [5], at: '2026-09-02T23:30:00Z' });
    await tillSale({ total: 700, lines: [700], payments: [700] });
    return late;
  });
  const client = await pool.connect();
  let baseline;
  try { baseline = { [shop.id]: await dayTotals(client, shop.id) }; } finally { client.release(); }
  assert.deepEqual(baseline[shop.id], {
    timeZone: 'Europe/London',
    days: { '2026-09-02': { count: 1, totalPence: 1000 }, '2026-09-03': { count: 1, totalPence: 500 } },
  });

  const clean = await check(shop.id, { baseline });
  assert.deepEqual(clean.mismatches, []);
  assert.equal(clean.checked.days, 2);

  await runWithShop(shop.id, () => prepare('UPDATE sales SET subtotal = 6, total = 6, cash_amount = 6 WHERE id = ?').run(changed));
  await runWithShop(shop.id, () => prepare("UPDATE sale_items SET unit_price = 6, line_total = 6 WHERE sale_id = ?").run(changed));
  const found = only(await check(shop.id, { baseline }), 'days');
  assert.deepEqual(found.map((m) => [m.record, m.expected, m.actual]), [['2026-09-03', 500, 600]]);
  assert.match(found[0].detail, /1 sale/);
});

test('days: a past day that lost a sale is named, with the counts', async () => {
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => oldSale({ subtotal: 10, total: 10, cash: 10, lines: [10] }));
  const client = await pool.connect();
  let baseline;
  try { baseline = { [shop.id]: await dayTotals(client, shop.id) }; } finally { client.release(); }
  await runWithShop(shop.id, async () => {
    await prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
    await prepare('DELETE FROM sales WHERE id = ?').run(id);
  });
  const found = only(await check(shop.id, { baseline }), 'days');
  assert.deepEqual(found.map((m) => [m.record, m.expected, m.actual]), [['2026-09-02', 1000, 0]]);
  assert.match(found[0].detail, /1 sale.*0 sales/);
});

async function reportFor(shopId) {
  const client = await pool.connect();
  try { return await checkMoneyTotals(client, { shopIds: [shopId] }); } finally { client.release(); }
}

test('the whole report: unknown mismatches fail it, known kinds alone don\'t', async () => {
  const known = await newShop();
  await runWithShop(known.id, () => oldSale({ subtotal: 10, total: 10, cash: 9.99, lines: [10] }));
  const knownReport = await reportFor(known.id);
  assert.equal(knownReport.ok, true);
  assert.match(formatReport(knownReport), /payment_tolerance/);

  const bad = await newShop();
  const id = await runWithShop(bad.id, () => order({ subtotal: 20, total: 20, lines: [10, 10.01] }));
  const badReport = await reportFor(bad.id);
  assert.equal(badReport.ok, false);
  const text = formatReport(badReport);
  assert.match(text, new RegExp(`sale_documents ${id}`));
  assert.match(text, /2000p/);
  assert.match(text, /2001p/);
});

test('reading no shops fails, so pointing it at the wrong database can\'t pass', async () => {
  const client = await pool.connect();
  try {
    await assert.rejects(checkMoneyTotals(client, { shopIds: [] }), /no shops/i);
  } finally { client.release(); }
});

test('naming a shop that isn\'t there fails, as reading no shops does', async () => {
  const client = await pool.connect();
  try {
    await assert.rejects(checkMoneyTotals(client, { shopIds: [2147483000] }), /No shop 2147483000/);
  } finally { client.release(); }
});

test('a mismatch in one shop doesn\'t show in another shop\'s check', async () => {
  const bad = await newShop();
  const clean = await newShop();
  await runWithShop(bad.id, () => order({ subtotal: 20, total: 20, lines: [10, 10.01] }));
  assert.deepEqual((await check(clean.id)).mismatches, []);
  assert.equal((await check(bad.id)).mismatches.length, 1);
});

test('paid_pence, once it exists, is the converted sale\'s total plus the till lines paying the order', async () => {
  const shop = await newShop();
  const client = await pool.connect();
  try {
    // Temporary tables of the same names come first on this connection's
    // search path, standing in for the column step D adds (paid_pence is
    // Migration 073's).
    for (const t of ['sales', 'sale_documents', 'sale_document_items', 'till_sale_lines']) {
      await client.query(`CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS)`);
    }
    await client.query('ALTER TABLE till_sale_lines ADD COLUMN order_id INTEGER');
    const s = shop.id;
    await client.query("INSERT INTO sales (id, shop_id, subtotal, total, payment_method, cash_amount) VALUES (1, $1, 20, 20, 'Cash', 20)", [s]);
    await client.query(
      `INSERT INTO sale_documents (id, shop_id, kind, status, subtotal, total, converted_sale_id, paid_pence) VALUES
         (1, $1, 'order', 'converted', 0, 0, 1, 2000),
         (2, $1, 'order', 'converted', 0, 0, 1, 1999),
         (3, $1, 'order', 'open', 0, 0, NULL, 0),
         (4, $1, 'order', 'cancelled', 0, 0, NULL, 100),
         (5, $1, 'order', 'open', 0, 0, NULL, 700)`, [s]);
    await client.query("INSERT INTO till_sale_lines (shop_id, till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence, order_id) VALUES ($1, 0, 'Labour', 1, 700, 700, 0, 0, 5)", [s]);
    const found = only(await checkShop(client, s), 'order_paid');
    assert.deepEqual(found.map((m) => [m.record, m.expected, m.actual]), [[2, 2000, 1999], [4, 0, 100]]);
  } finally {
    client.release(true);
  }
});

test('order lines saved at fractions of a penny, each rounded on its own, are reported as an order-lines mismatch', async () => {
  // 1.5 h at £12.25 is £18.375 a line: each line is stored as £18.38, but the
  // unrounded sum is stored as the subtotal, £36.75. Reported, not hidden:
  // whether this becomes a known kind is for Mark or Jack.
  const shop = await newShop();
  const id = await runWithShop(shop.id, () => order({ subtotal: 36.75, total: 36.75, lines: [18.38, 18.38] }));
  const found = (await check(shop.id)).mismatches;
  assert.deepEqual(found.map((m) => [m.kind, m.record, m.expected, m.actual, m.known]), [['order_lines', id, 3675, 3676, false]]);
});

test('days: a till sale arriving late for a past day leaves the old-record comparison clean', async () => {
  const shop = await newShop();
  await runWithShop(shop.id, () => oldSale({ subtotal: 10, total: 10, cash: 10, lines: [10], at: '2026-09-02T09:00:00Z' }));
  const client = await pool.connect();
  let baseline;
  try { baseline = { [shop.id]: await dayTotals(client, shop.id) }; } finally { client.release(); }
  await runWithShop(shop.id, () => tillSale({ total: 700, lines: [700], payments: [700] })); // its clock is 2 Sep
  const result = await check(shop.id, { baseline });
  assert.deepEqual(result.mismatches, []);
  assert.equal(result.checked.days, 1);
});
