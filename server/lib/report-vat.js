// VAT (openspec/changes/reports-ready-made, designs 4 and 5; rp-vat): the
// new till's sale lines by VAT rate, Sales before VAT (the line's total less
// its VAT) and VAT charged, against the quarter before; sales from the old
// record, which kept no VAT, on a row of their own with their takings. The
// rows serve the screen and the download alike.
//
// The quarter follows the shop's vat_quarter_start_month (1, 2 or 3); while
// the shop hasn't said, calendar quarters, and needsQuarter asks.
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { ValidationError } from './http.js';
import { periodFor } from './report-periods.js';
import { csvOf } from './csv.js';

const PERIODS = ['this-vat-quarter', 'last-vat-quarter', 'dates'];
// The three rates named as drawn, shown even when nothing was sold at them.
const NAMED = { 2000: 'Standard 20%', 500: 'Reduced rate 5%', 0: 'Zero rate 0%' };
const rateLabel = (bp) => NAMED[bp] ?? `${bp / 100}%`;

// On the shop's days from–to: from, timeZone, to, timeZone.
const inDays = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;

// Sales before VAT and VAT charged, by rate, for the shop's days from–to.
async function byRate(from, to, timeZone) {
  const rows = await prepare(
    `SELECT l.vat_rate_bp AS rate, SUM(l.line_total_pence - l.vat_pence) AS sales, SUM(l.vat_pence) AS vat
       FROM till_sale_lines l JOIN till_sales t ON t.id = l.till_sale_id
      WHERE ${inDays('t.till_clock_at')}
      GROUP BY l.vat_rate_bp`
  ).all(from, timeZone, to, timeZone);
  // SUM gives a bigint, which comes back as a string: a quarter's pence can pass 2^31.
  return new Map(rows.map((r) => [r.rate, { sales: Number(r.sales), vat: Number(r.vat) }]));
}

// The old record's takings, including VAT: it never kept the split.
async function notRecorded(from, to, timeZone) {
  const row = await prepare(
    `SELECT COALESCE(SUM(total_pence), 0) AS takings FROM all_sales WHERE source = 'old' AND ${inDays('made_at')}`
  ).get(from, timeZone, to, timeZone);
  return Number(row.takings);
}

export async function vatReport({ period = 'this-vat-quarter', from, to }, today) {
  if (!PERIODS.includes(period)) throw new ValidationError('Choose This VAT quarter, Last VAT quarter or Pick dates');
  const shop = await prepare("SELECT vat_quarter_start_month FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  const quarterStartMonth = shop?.vat_quarter_start_month ?? null;
  const timeZone = await currentShopTimeZone();
  const p = periodFor({ period, from, to, today, quarterStartMonth });

  const now = await byRate(p.from, p.through, timeZone);
  const before = await byRate(p.before.from, p.before.to, timeZone);
  const rates = new Set([2000, 500, 0, ...now.keys(), ...before.keys()]);
  const rows = [...rates].sort((a, b) => b - a).map((rateBp) => ({
    rateBp, label: rateLabel(rateBp),
    salesPence: now.get(rateBp)?.sales ?? 0,
    vatPence: now.get(rateBp)?.vat ?? 0,
    beforeVatPence: before.get(rateBp)?.vat ?? 0,
  }));
  const sum = (key) => rows.reduce((total, r) => total + r[key], 0);

  return {
    period: { period, from: p.from, to: p.to, through: p.through, soFar: p.soFar, label: p.label, against: p.against },
    before: p.before,
    quarterStartMonth,
    needsQuarter: quarterStartMonth === null,
    rows,
    total: { label: 'Total', salesPence: sum('salesPence'), vatPence: sum('vatPence'), beforeVatPence: sum('beforeVatPence') },
    notRecorded: {
      label: 'VAT not recorded',
      takingsPence: await notRecorded(p.from, p.through, timeZone),
      beforeTakingsPence: await notRecorded(p.before.from, p.before.to, timeZone),
    },
  };
}

// Said under the old record's row, on screen and in the download.
const NOT_RECORDED_LINE = 'These sales were made before Wheelhouse kept VAT on each sale. Take their VAT from your accounts software or ask your accountant.';

const pounds = (pence) => (pence / 100).toFixed(2);

export function vatCsv(report) {
  const t = report.total;
  const n = report.notRecorded;
  return csvOf([
    ['VAT on sales by rate'],
    ['Rate', 'Sales before VAT', 'VAT charged', 'Quarter before'],
    ...report.rows.map((r) => [r.label, pounds(r.salesPence), pounds(r.vatPence), pounds(r.beforeVatPence)]),
    [t.label, pounds(t.salesPence), pounds(t.vatPence), pounds(t.beforeVatPence)],
    [],
    ['Sales without their VAT', 'Takings including VAT', 'Quarter before'],
    [n.label, pounds(n.takingsPence), pounds(n.beforeTakingsPence)],
    [NOT_RECORDED_LINE],
  ]);
}
