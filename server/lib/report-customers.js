// Returning customers' figures (openspec/changes/reports-ready-made, design 3;
// rp-returning). A visit is a sale with the customer on it, from either
// record, or a repair collected; one a day at most, on the shop's day.
// Sales with no customer, and deleted customers, never count. Everything is
// read through the request's shop (row-level security).
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { ValidationError } from './http.js';
import { periodFor, addMonths, monthBuckets } from './report-periods.js';
import { csvOf } from './csv.js';

// Every customer's visits, one row per customer per day, with the day before
// it (prev) and their first visit ever (first).
const VISITS = `
  WITH days AS (
    SELECT DISTINCT v.customer_id, v.day FROM (
      SELECT customer_id, (made_at AT TIME ZONE ?)::date AS day FROM all_sales WHERE customer_id IS NOT NULL
      UNION ALL
      SELECT customer_id, (collected_at AT TIME ZONE ?)::date FROM workshop_jobs WHERE customer_id IS NOT NULL AND collected_at IS NOT NULL
    ) v JOIN customers c ON c.id = v.customer_id AND c.deleted_at IS NULL
  ), visits AS (
    SELECT customer_id, day,
           lag(day) OVER (PARTITION BY customer_id ORDER BY day) AS prev,
           min(day) OVER (PARTITION BY customer_id) AS first
      FROM days
  )`;

// Customers, New, and Came back within 12 months, for the days from..to. Came
// back is judged on each customer's first visit in the period: of those who
// had been in before it, the share whose gap was 12 months or less.
async function figuresFor(from, to, timeZone) {
  const row = await prepare(
    `${VISITS}
     , firsts AS (
       SELECT DISTINCT ON (customer_id) customer_id, day, prev, first
         FROM visits WHERE day >= ?::date AND day <= ?::date
        ORDER BY customer_id, day
     )
     SELECT count(*)::int AS customers,
            count(*) FILTER (WHERE first >= ?::date)::int AS new,
            count(*) FILTER (WHERE prev IS NOT NULL)::int AS been_before,
            count(*) FILTER (WHERE prev IS NOT NULL AND day <= prev + interval '12 months')::int AS came_back
       FROM firsts`
  ).get(timeZone, timeZone, from, to, from);
  return {
    customers: row.customers,
    new: row.new,
    percent: row.been_before ? Math.round((row.came_back / row.been_before) * 100) : null,
  };
}

// New and returning customers in each month of from..to: new when their first
// visit ever is in that month and in the period (a month part-way into Pick
// dates starts on From).
async function byMonth(from, to, timeZone) {
  const rows = await prepare(
    `${VISITS}
     SELECT to_char(day, 'YYYY-MM') AS month,
            count(DISTINCT customer_id) FILTER (WHERE first >= greatest(date_trunc('month', day)::date, ?::date))::int AS new,
            count(DISTINCT customer_id) FILTER (WHERE first < greatest(date_trunc('month', day)::date, ?::date))::int AS returning
       FROM visits WHERE day >= ?::date AND day <= ?::date GROUP BY 1`
  ).all(timeZone, timeZone, from, from, from, to);
  return new Map(rows.map((r) => [r.month, r]));
}

// Customers whose latest visit is before the cutoff, most recently seen first,
// with what they spent in the period (both records' sales with them on).
async function notSeenSince(cutoff, from, to, timeZone) {
  const rows = await prepare(
    `${VISITS}
     , latest AS (SELECT customer_id, max(day) AS last FROM visits GROUP BY customer_id)
     SELECT c.id, c.name, to_char(l.last, 'YYYY-MM-DD') AS last_visit, c.marketing_permission,
            COALESCE((SELECT sum(s.total_pence) FROM all_sales s
                       WHERE s.customer_id = c.id
                         AND (s.made_at AT TIME ZONE ?)::date >= ?::date AND (s.made_at AT TIME ZONE ?)::date <= ?::date), 0)::int AS spent
       FROM latest l JOIN customers c ON c.id = l.customer_id
      WHERE l.last < ?::date
      ORDER BY l.last DESC, c.name`
  ).all(timeZone, timeZone, timeZone, from, timeZone, to, cutoff);
  return rows.map((r) => ({ id: r.id, name: r.name, lastVisit: r.last_visit, spentPence: r.spent, happyToHear: r.marketing_permission === true }));
}

// The period's words as the drawing has them: "the last 12 months", the
// total row and the spend column named for it.
const WORDS = {
  'last-12-months': { label: 'the last 12 months', total: 'All 12 months', spent: 'Spent in the last 12 months' },
  'last-24-months': { label: 'the last 24 months', total: 'All 24 months', spent: 'Spent in the last 24 months' },
  dates: { total: 'All these dates', spent: 'Spent between these dates' },
};

function monthsAsked(raw) {
  if (raw === null || raw === undefined || raw === '') return 6;
  if (!/^\d{1,4}$/.test(raw) || Number(raw) < 1 || Number(raw) > 1200) throw new ValidationError('"Not seen for" needs a whole number of months, from 1 to 1200');
  return Number(raw);
}

export async function returningReport({ period = 'last-12-months', from, to, months }, today) {
  if (!WORDS[period]) throw new ValidationError('Choose Last 12 months, Last 24 months or Pick dates');
  const n = monthsAsked(months);
  const timeZone = await currentShopTimeZone();
  const p = periodFor({ period, from, to, today });
  const words = WORDS[period];
  // Returning customers always goes by month, Pick dates too.
  const buckets = p.unit === 'month' ? p.buckets : monthBuckets(p.from, p.to, p.through, p.before.from);

  const now = await figuresFor(p.from, p.through, timeZone);
  const before = await figuresFor(p.before.from, p.before.to, timeZone);
  const months12 = await byMonth(p.from, p.through, timeZone);
  const rows = buckets.map((b) => {
    const r = months12.get(b.key) ?? { new: 0, returning: 0 };
    return { key: b.key, label: b.label, notReached: b.notReached, returning: r.returning, new: r.new, all: r.returning + r.new };
  });
  // The total row counts each customer once, as the Customers figure does.
  const total = { label: words.total, returning: now.customers - now.new, new: now.new, all: now.customers };
  // "More than [n] months before today": the same day n months back.
  const [, , day] = today.split('-');
  const cutoff = `${addMonths(today, -n).slice(0, 8)}${day}`;

  return {
    period: {
      period, from: p.from, to: p.to, through: p.through, soFar: p.soFar, unit: 'month',
      label: words.label ?? p.label, against: p.against,
    },
    before: p.before,
    figures: {
      customers: { count: now.customers, beforeCount: before.customers, diff: now.customers - before.customers },
      new: { count: now.new, beforeCount: before.new, diff: now.new - before.new },
      cameBack: {
        percent: now.percent, beforePercent: before.percent,
        diff: now.percent === null || before.percent === null ? null : now.percent - before.percent,
      },
    },
    rows,
    total,
    notSeen: { months: n, column: words.spent, customers: await notSeenSince(validDay(cutoff), p.from, p.through, timeZone) },
  };
}

// The 31st n months back may not exist: take that month's last day.
function validDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 8)}${String(Math.min(d, last)).padStart(2, '0')}`;
}

// The spreadsheet: the two tables as shown, each under its title, a blank
// row between them (design 9).
const pounds = (pence) => (pence / 100).toFixed(2);
export function returningCsv(report) {
  const t = report.total;
  return csvOf([
    ['New and returning customers by month'],
    ['Month', 'Returning', 'New', 'All'],
    ...report.rows.map((r) => [r.label, r.returning, r.new, r.all]),
    [t.label, t.returning, t.new, t.all],
    [],
    ['Not seen lately'],
    ['Customer', 'Last bought or collected', report.notSeen.column, 'Happy to hear about offers'],
    ...report.notSeen.customers.map((c) => [c.name, c.lastVisit, pounds(c.spentPence), c.happyToHear ? 'Yes' : 'No']),
  ]);
}
