// The totals check (openspec/changes/wp-1-6-sales-in-pence, design.md
// Decision 7). Run on any database before and after each step of the move to
// one sales record in pence; it reports each mismatch with the shop, the
// table, the record and both amounts, in pence:
//
//   1. Conversion: every row carrying both a pounds column and its _pence
//      twin has pounds × 100 = pence. A column with no pence twin yet is
//      listed as not converted yet, not skipped silently.
//   2. Orders (sale_documents): the lines add up to the subtotal, the total
//      is the subtotal less the discount, never below 0, and paid_pence (once
//      it exists) is the converted sale's total plus any till lines paying it.
//   3. Sales: the lines and the payments each add up to the total, in both
//      records (sales and till_sales). Two known kinds are reported apart and
//      don't fail the check: an old sale's group-discount rounding (total 1p
//      off, with a group discount) and createSale's 1p payment tolerance.
//   4. Days: each shop's per-day count and total of old sales, saved as a
//      baseline before step B, must still match afterwards. Till sales are
//      left out: a late offline sale can rightly add to a past day.
//
//   node scripts/ci/check-money-totals.mjs [--shop <id>]... [--save-baseline <file>] [--baseline <file>]
//
// Uses DATABASE_URL from .env. Exits 0 when there are no unknown mismatches,
// 1 when there are, and 2 when it couldn't run (reading no shops is an error,
// so pointing it at the wrong database can't pass).
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const KNOWN_KINDS = ['group_discount_rounding', 'payment_tolerance'];

// The pounds columns that gain a _pence twin in step A (design.md Decision 1),
// and the workshop's own in step A′ (task 2.1, migration 075).
export const CONVERTED = [
  { table: 'sale_documents', columns: ['subtotal', 'discount', 'total'] },
  { table: 'sale_document_items', columns: ['unit_price', 'line_total'] },
  { table: 'workshop_services', columns: ['price'] },
  { table: 'workshop_quote_lines', columns: ['unit_amount'] },
  { table: 'workshop_job_services', columns: ['booked_price'] },
];

// The shop's clock when it has no workshop settings row: the time_zone
// column's own default (migration 033).
const DEFAULT_TIME_ZONE = 'Europe/London';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (name) => {
  if (!IDENT.test(name)) throw new Error(`"${name}" is not a plain table or column name`);
  return name;
};

async function columnsOf(client, table) {
  const { rows } = await client.query(
    'SELECT attname FROM pg_attribute WHERE attrelid = to_regclass($1) AND attnum > 0 AND NOT attisdropped',
    [ident(table)]
  );
  return new Set(rows.map((r) => r.attname));
}

// An amount in pence: the _pence column once it exists (pence is the
// authority), otherwise the pounds column converted the contract's way.
function pence(alias, column, columns) {
  return columns.has(`${column}_pence`) ? `${alias}.${column}_pence` : `ROUND(${alias}.${column} * 100)::int`;
}

const pounds = (p) => `£${(p / 100).toFixed(2)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Runs fn with the shop's tenant setting, in a read-only transaction that is
// always rolled back. Every query also filters on shop_id, because a
// superuser connection bypasses row-level security.
async function asShop(client, shopId, fn) {
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shopId)]);
    return await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function shopTimeZone(client, shopId) {
  const { rows } = await client.query('SELECT time_zone FROM workshop_settings WHERE shop_id = $1 LIMIT 1', [shopId]);
  return rows[0]?.time_zone || DEFAULT_TIME_ZONE;
}

async function oldSaleDays(client, shopId, timeZone) {
  const { rows } = await client.query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count, COALESCE(SUM(ROUND(total * 100)), 0)::int AS total_pence
       FROM sales WHERE shop_id = $1 GROUP BY 1 ORDER BY 1`,
    [shopId, timeZone]
  );
  return Object.fromEntries(rows.map((r) => [r.day, { count: r.count, totalPence: r.total_pence }]));
}

// The day baseline for one shop: { timeZone, days: { 'YYYY-MM-DD': { count, totalPence } } }.
export async function dayTotals(client, shopId) {
  return asShop(client, shopId, async () => {
    const timeZone = await shopTimeZone(client, shopId);
    return { timeZone, days: await oldSaleDays(client, shopId, timeZone) };
  });
}

async function checkConversion(client, shopId, converted, out) {
  for (const { table, columns } of converted) {
    const present = await columnsOf(client, table);
    const pairs = columns.filter((c) => present.has(c) && present.has(`${c}_pence`));
    for (const c of columns) if (!pairs.includes(c)) out.notConvertedYet.push(`${table}.${c}`);
    if (pairs.length === 0) continue;
    const t = ident(table);
    const { rows: [{ n }] } = await client.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE shop_id = $1`, [shopId]);
    out.checked.conversion += n;
    for (const c of pairs.map(ident)) {
      const { rows } = await client.query(
        `SELECT id, ROUND(${c} * 100)::int AS expected, ${c}_pence AS actual FROM ${t}
          WHERE shop_id = $1 AND ${c}_pence IS DISTINCT FROM ROUND(${c} * 100) ORDER BY id`,
        [shopId]
      );
      for (const r of rows) {
        out.add({ kind: 'conversion', table, record: r.id, column: `${c}_pence`, expected: r.expected, actual: r.actual,
          detail: `${c} is ${pounds(r.expected)} but ${c}_pence is ${r.actual}p` });
      }
    }
  }
}

async function checkOrders(client, shopId, out) {
  const doc = await columnsOf(client, 'sale_documents');
  const item = await columnsOf(client, 'sale_document_items');
  const tillLine = await columnsOf(client, 'till_sale_lines');
  const hasPaid = doc.has('paid_pence');
  const paidByTill = hasPaid && tillLine.has('order_id')
    ? `+ (SELECT COALESCE(SUM(l.line_total_pence), 0) FROM till_sale_lines l WHERE l.order_id = d.id AND l.shop_id = d.shop_id)`
    : '';
  const { rows } = await client.query(
    `SELECT d.id, ${pence('d', 'subtotal', doc)} AS subtotal, ${pence('d', 'discount', doc)} AS discount, ${pence('d', 'total', doc)} AS total,
            (SELECT COALESCE(SUM(${pence('i', 'line_total', item)}), 0)::int FROM sale_document_items i
              WHERE i.document_id = d.id AND i.shop_id = d.shop_id) AS lines
            ${hasPaid ? `, d.paid_pence AS paid,
            (COALESCE((SELECT ROUND(s.total * 100) FROM sales s WHERE s.id = d.converted_sale_id AND s.shop_id = d.shop_id), 0) ${paidByTill})::int AS paid_expected` : ''}
       FROM sale_documents d WHERE d.shop_id = $1 ORDER BY d.id`,
    [shopId]
  );
  out.checked.orders += rows.length;
  for (const r of rows) {
    const base = { table: 'sale_documents', record: r.id };
    if (r.lines !== r.subtotal) {
      out.add({ ...base, kind: 'order_lines', expected: r.subtotal, actual: r.lines,
        detail: `the lines add up to ${pounds(r.lines)}, the subtotal is ${pounds(r.subtotal)}` });
    }
    const total = Math.max(0, r.subtotal - r.discount);
    if (r.total !== total) {
      out.add({ ...base, kind: 'order_total', expected: total, actual: r.total,
        detail: `${pounds(r.subtotal)} less ${pounds(r.discount)} discount is ${pounds(total)} (never below £0.00), the total is ${pounds(r.total)}` });
    }
    if (hasPaid && r.paid !== r.paid_expected) {
      out.add({ ...base, kind: 'order_paid', expected: r.paid_expected, actual: r.paid,
        detail: `the sales paying it come to ${pounds(r.paid_expected)}, paid_pence is ${r.paid}p` });
    }
  }
}

async function checkOldSales(client, shopId, out) {
  const { rows } = await client.query(
    `SELECT s.id, ROUND(s.subtotal * 100)::int AS subtotal, ROUND(s.discount * 100)::int AS discount,
            ROUND(s.group_discount_amount * 100)::int AS group_discount, ROUND(s.total * 100)::int AS total,
            (SELECT COALESCE(SUM(ROUND(i.line_total * 100)), 0)::int FROM sale_items i WHERE i.sale_id = s.id AND i.shop_id = s.shop_id) AS lines,
            (ROUND(s.cash_amount * 100) + ROUND(s.card_amount * 100)
              + (SELECT COALESCE(SUM(ROUND(p.amount * 100)), 0) FROM sale_payments p WHERE p.sale_id = s.id AND p.shop_id = s.shop_id))::int AS paid
       FROM sales s WHERE s.shop_id = $1 ORDER BY s.id`,
    [shopId]
  );
  out.checked.oldSales += rows.length;
  for (const r of rows) {
    const base = { table: 'sales', record: r.id };
    if (r.lines !== r.subtotal) {
      out.add({ ...base, kind: 'sale_lines', expected: r.subtotal, actual: r.lines,
        detail: `the lines add up to ${pounds(r.lines)}, the subtotal is ${pounds(r.subtotal)}` });
    }
    const total = Math.max(0, r.subtotal - r.discount - r.group_discount);
    if (r.total !== total) {
      const rounding = r.group_discount > 0 && Math.abs(r.total - total) <= 1;
      out.add({ ...base, kind: rounding ? 'group_discount_rounding' : 'sale_total', expected: total, actual: r.total,
        detail: `${pounds(r.subtotal)} less ${pounds(r.discount)} discount and ${pounds(r.group_discount)} group discount is ${pounds(total)}, the total is ${pounds(r.total)}` });
    }
    if (r.paid !== r.total) {
      const tolerance = Math.abs(r.paid - r.total) <= 1;
      out.add({ ...base, kind: tolerance ? 'payment_tolerance' : 'payments', expected: r.total, actual: r.paid,
        detail: `the payments add up to ${pounds(r.paid)}, the total is ${pounds(r.total)}` });
    }
  }
}

async function checkTillSales(client, shopId, out) {
  const { rows } = await client.query(
    `SELECT t.id, t.total_pence AS total,
            (SELECT COALESCE(SUM(l.line_total_pence), 0)::int FROM till_sale_lines l WHERE l.till_sale_id = t.id AND l.shop_id = t.shop_id) AS lines,
            (SELECT COALESCE(SUM(p.amount_pence), 0)::int FROM till_sale_payments p WHERE p.till_sale_id = t.id AND p.shop_id = t.shop_id) AS paid
       FROM till_sales t WHERE t.shop_id = $1 ORDER BY t.id`,
    [shopId]
  );
  out.checked.tillSales += rows.length;
  for (const r of rows) {
    const base = { table: 'till_sales', record: r.id };
    if (r.lines !== r.total) {
      out.add({ ...base, kind: 'sale_lines', expected: r.total, actual: r.lines,
        detail: `the lines add up to ${r.lines}p, the total is ${r.total}p` });
    }
    if (r.paid !== r.total) {
      out.add({ ...base, kind: 'payments', expected: r.total, actual: r.paid,
        detail: `the payments add up to ${r.paid}p, the total is ${r.total}p` });
    }
  }
}

async function checkDays(client, shopId, saved, out) {
  if (!saved) return;
  // Decision 7.4: after step B the view's old-record rows must match the
  // baseline. Until this reads them (task 3.4), refuse rather than pass by
  // comparing the old table with itself.
  const { rows: [{ view }] } = await client.query("SELECT to_regclass('all_sales') IS NOT NULL AS view");
  if (view) throw new Error("all_sales exists, but the day check still reads sales: point it at the view's old rows (task 3.4)");
  const now = await oldSaleDays(client, shopId, saved.timeZone);
  for (const [day, was] of Object.entries(saved.days)) {
    out.checked.days += 1;
    const is = now[day] || { count: 0, totalPence: 0 };
    if (is.count !== was.count || is.totalPence !== was.totalPence) {
      out.add({ kind: 'days', table: 'sales', record: day, expected: was.totalPence, actual: is.totalPence,
        detail: `the baseline had ${plural(was.count, 'sale')} for ${pounds(was.totalPence)}, now ${plural(is.count, 'sale')} for ${pounds(is.totalPence)}` });
    }
  }
}

// One shop's check. baseline is { [shopId]: dayTotals(...) }, from
// --save-baseline; without it the day comparison is skipped.
export async function checkShop(client, shopId, { converted = CONVERTED, baseline } = {}) {
  const out = {
    shopId,
    checked: { orders: 0, oldSales: 0, tillSales: 0, conversion: 0, days: 0 },
    mismatches: [],
    notConvertedYet: [],
    add(m) { this.mismatches.push({ kind: m.kind, known: KNOWN_KINDS.includes(m.kind), shopId, ...m }); },
  };
  await asShop(client, shopId, async () => {
    await checkConversion(client, shopId, converted, out);
    await checkOrders(client, shopId, out);
    await checkOldSales(client, shopId, out);
    await checkTillSales(client, shopId, out);
    await checkDays(client, shopId, baseline?.[shopId], out);
  });
  delete out.add;
  return out;
}

// Every shop, or the ones named. ok is false when any mismatch isn't a known kind.
export async function checkMoneyTotals(client, { shopIds, converted, baseline } = {}) {
  const ids = shopIds ?? (await client.query('SELECT id FROM shops ORDER BY id')).rows.map((r) => r.id);
  if (ids.length === 0) throw new Error('Read no shops: wrong database?');
  const { rows: found } = await client.query('SELECT id FROM shops WHERE id = ANY($1::int[])', [ids]);
  const missing = ids.filter((id) => !found.some((r) => Number(r.id) === Number(id)));
  if (missing.length) throw new Error(`No shop ${missing.join(', ')} here: wrong database?`);
  const shops = [];
  for (const id of ids) shops.push(await checkShop(client, id, { converted, baseline }));
  const checked = { orders: 0, oldSales: 0, tillSales: 0, conversion: 0, days: 0 };
  for (const s of shops) for (const k of Object.keys(checked)) checked[k] += s.checked[k];
  const mismatches = shops.flatMap((s) => s.mismatches);
  return {
    ok: mismatches.every((m) => m.known),
    shops,
    checked,
    mismatches,
    notConvertedYet: [...new Set(shops.flatMap((s) => s.notConvertedYet))],
  };
}

export function formatReport(report) {
  const c = report.checked;
  const lines = [
    `Money totals check: ${plural(report.shops.length, 'shop')}; checked ${plural(c.orders, 'order')}, ${plural(c.oldSales, 'old sale')}, ` +
      `${plural(c.tillSales, 'till sale')}, ${plural(c.conversion, 'converted row')} and ${plural(c.days, 'baseline day')}.`,
  ];
  if (report.notConvertedYet.length) lines.push(`Not converted yet (no _pence column): ${report.notConvertedYet.join(', ')}.`);
  const line = (m) => `  ${m.kind}: shop ${m.shopId}, ${m.table} ${m.record}${m.column ? ` (${m.column})` : ''}: expected ${m.expected}p, found ${m.actual}p; ${m.detail}`;
  const unknown = report.mismatches.filter((m) => !m.known);
  const known = report.mismatches.filter((m) => m.known);
  if (unknown.length) lines.push(`Mismatches (${unknown.length}), which stop the step:`, ...unknown.map(line));
  if (known.length) lines.push(`Known kinds (${known.length}), reported but not stopping the step:`, ...known.map(line));
  if (!unknown.length) lines.push(known.length ? 'No unknown mismatches.' : 'No mismatches.');
  return lines.join('\n');
}

const USAGE = 'Usage: check-money-totals.mjs [--shop <id>]... [--save-baseline <file>] [--baseline <file>]';

function parseArgs(argv) {
  const args = { shopIds: undefined, saveBaseline: null, baseline: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--shop', '--save-baseline', '--baseline'].includes(flag)) throw new Error(`Unknown option ${flag}. ${USAGE}`);
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === '--shop') {
      if (!/^\d+$/.test(value)) throw new Error(`--shop ${value}: give a shop id`);
      (args.shopIds ??= []).push(Number(value));
    } else if (flag === '--save-baseline') args.saveBaseline = value;
    else args.baseline = value;
    i += 1;
  }
  return args;
}

// Compared as real paths, so a symlinked path still runs the script.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    const args = parseArgs(process.argv.slice(2));
    await import('../../server/load-env.js');
    if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL (in .env) to the database to check');
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const baseline = args.baseline ? JSON.parse(readFileSync(args.baseline, 'utf8')).shops : undefined;
    const report = await checkMoneyTotals(client, { shopIds: args.shopIds, baseline });
    if (args.saveBaseline) {
      const shops = {};
      for (const s of report.shops) shops[s.shopId] = await dayTotals(client, s.shopId);
      writeFileSync(args.saveBaseline, `${JSON.stringify({ savedAt: new Date().toISOString(), shops }, null, 2)}\n`);
      console.log(`Saved the day baseline for ${plural(report.shops.length, 'shop')} to ${args.saveBaseline}.`);
    }
    console.log(formatReport(report));
    process.exitCode = report.ok ? 0 : 1;
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
  } finally {
    if (client) await client.end();
  }
}
