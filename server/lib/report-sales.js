// The Sales report's figures (openspec/changes/reports-sales-and-takings,
// design 3): every sale from both records (the all_sales view), grouped by
// the shop's day, month or hour in its own time zone, for a period and for
// the period before it. One set of grouped rows feeds the headline figures,
// the graph and the table, so they can't disagree.
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { periodFor } from './report-periods.js';

const BUCKET_SQL = {
  day: "to_char(made_at AT TIME ZONE ?, 'YYYY-MM-DD')",
  month: "to_char(made_at AT TIME ZONE ?, 'YYYY-MM')",
  hour: 'extract(hour from made_at AT TIME ZONE ?)::int',
};

// Sales and their money for each bucket between two shop days (inclusive).
async function grouped(unit, from, to, timeZone) {
  const rows = await prepare(
    `SELECT ${BUCKET_SQL[unit]} AS bucket, count(*)::int AS sales, COALESCE(sum(total_pence), 0)::bigint::float8 AS pence
       FROM all_sales
      WHERE made_at >= (?::date)::timestamp AT TIME ZONE ? AND made_at < (?::date + 1)::timestamp AT TIME ZONE ?
      GROUP BY 1`
  ).all(timeZone, from, timeZone, to, timeZone);
  return new Map(rows.map((r) => [String(r.bucket), r]));
}

// Whole pence, half up.
const average = (pence, count) => (count ? Math.floor((pence * 2 + count) / (count * 2)) : null);

// The shop's first sale's day, or null.
async function firstSaleDay(timeZone) {
  const row = await prepare("SELECT to_char(min(made_at) AT TIME ZONE ?, 'YYYY-MM-DD') AS day FROM all_sales").get(timeZone);
  return row?.day ?? null;
}

// The shop's opening hours as whole hours: 09:00 to 17:30 is 9 to 18.
async function openingHours() {
  const row = await prepare('SELECT opening_time, closing_time FROM workshop_settings LIMIT 1').get();
  const [closeH, closeM] = row.closing_time.split(':').map(Number);
  return { open: parseInt(row.opening_time, 10), close: closeH + (closeM > 0 ? 1 : 0) };
}

export async function salesReport(choice, today) {
  const timeZone = await currentShopTimeZone();
  let hours = {};
  if (choice.period === 'today') {
    const { open, close } = await openingHours();
    hours = { openingHour: open, closingHour: close };
    // Sales outside the opening hours still get their hour.
    const early = await grouped('hour', today, today, timeZone);
    for (const key of early.keys()) {
      const h = Number(key);
      hours.openingHour = Math.min(hours.openingHour, h);
      hours.closingHour = Math.max(hours.closingHour, h + 1);
    }
  }
  const period = periodFor({ ...choice, today, ...hours });
  const unit = period.unit;
  const now = await grouped(unit, period.from, period.through, timeZone);
  const before = await grouped(unit, period.before.from, period.before.to, timeZone);

  const rows = period.buckets.map((b) => {
    const cur = now.get(String(b.key));
    const prev = before.get(String(b.beforeKey));
    const takingsPence = b.notReached ? null : cur?.pence ?? 0;
    const sales = b.notReached ? null : cur?.sales ?? 0;
    return {
      key: b.key, label: b.label, notReached: b.notReached,
      takingsPence, sales, averagePence: b.notReached ? null : average(takingsPence, sales),
      beforeTakingsPence: prev?.pence ?? 0, beforeSales: prev?.sales ?? 0,
    };
  });
  const sum = (list, k) => list.reduce((n, r) => n + (r[k] ?? 0), 0);
  const takings = sum(rows, 'takingsPence');
  const count = sum(rows, 'sales');
  // The period before is added up from everything it holds, not from the rows,
  // so a sale outside the opening hours or a month the rows don't line up with
  // still counts in the comparison (review).
  const beforeTakings = [...before.values()].reduce((n, r) => n + r.pence, 0);
  const beforeCount = [...before.values()].reduce((n, r) => n + r.sales, 0);

  const firstSaleOn = await firstSaleDay(timeZone);
  const nothingBefore = !firstSaleOn || firstSaleOn >= period.from;
  const diff = (a, b) => (nothingBefore ? null : a - b);
  const beforeAverage = average(beforeTakings, beforeCount);
  const thisAverage = average(takings, count);

  return {
    period: {
      period: period.period, from: period.from, to: period.to, through: period.through, soFar: period.soFar,
      unit, label: period.label, against: period.against,
    },
    before: period.before,
    figures: {
      takings: { pence: takings, beforePence: beforeTakings, diffPence: diff(takings, beforeTakings) },
      sales: { count, beforeCount, diff: diff(count, beforeCount) },
      average: {
        pence: thisAverage, beforePence: beforeAverage,
        diffPence: nothingBefore || thisAverage === null || beforeAverage === null ? null : thisAverage - beforeAverage,
      },
    },
    rows,
    total: {
      label: period.period === 'last-12-months' ? '12 months' : period.soFar ? 'So far' : 'Total',
      takingsPence: takings, sales: count, averagePence: thisAverage,
    },
    empty: count === 0,
    nothingBefore,
    firstSaleOn,
  };
}
