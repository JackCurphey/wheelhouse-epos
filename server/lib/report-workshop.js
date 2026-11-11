// The Workshop report's figures (openspec/changes/reports-ready-made,
// design 2; rp-workshop): counted only from what the diary and the job pages
// already save. Jobs booked in, finished (the job's latest sign-off) and
// collected; jobs finished by day; workshop takings split into labour and
// parts; quotes sent, by how they stand now; and how full each mechanic was.
// Everything is read through the request's shop (row-level security).
import { prepare } from '../db.js';
import { currentShopTimeZone, toCapacitySettings, toBlock, parseWorkingDays } from '../workshop/jobs.js';
import { computeCapacity, datesBetween, toMinutes } from '../capacity.js';
import { periodFor } from './report-periods.js';
import { csvOf } from './csv.js';

const BUCKET_SQL = {
  day: (col) => `to_char(${col} AT TIME ZONE ?, 'YYYY-MM-DD')`,
  month: (col) => `to_char(${col} AT TIME ZONE ?, 'YYYY-MM')`,
  hour: (col) => `extract(hour from ${col} AT TIME ZONE ?)::int`,
};
const inRange = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;

// Jobs whose timestamp falls between two shop days (inclusive).
async function countJobs(col, from, to, timeZone) {
  const row = await prepare(`SELECT count(*)::int AS n FROM workshop_jobs WHERE ${inRange(col)}`).get(from, timeZone, to, timeZone);
  return row.n;
}

async function finishedBy(unit, from, to, timeZone) {
  const rows = await prepare(
    `SELECT ${BUCKET_SQL[unit]('signed_off_at')} AS bucket, count(*)::int AS n
       FROM workshop_jobs WHERE ${inRange('signed_off_at')} GROUP BY 1`
  ).all(timeZone, from, timeZone, to, timeZone);
  return new Map(rows.map((r) => [String(r.bucket), r.n]));
}

// The average days from booked in to signed off, over jobs finished in the
// period that have both, to one decimal place; null with none.
async function bookedInToReady(from, to, timeZone) {
  const row = await prepare(
    `SELECT avg(extract(epoch from signed_off_at - booked_in_at) / 86400)::float8 AS days
       FROM workshop_jobs WHERE booked_in_at IS NOT NULL AND ${inRange('signed_off_at')}`
  ).get(from, timeZone, to, timeZone);
  return row.days === null ? null : Math.round(row.days * 10) / 10;
}

// Workshop takings: old-record sales converted from a job's order, made in
// the period. Each sale's labour and parts lines are shared out of what was
// taken in proportion, so a discount on the whole sale comes off both and
// the two add up to the sale's total.
async function takings(from, to, timeZone) {
  const rows = await prepare(
    `SELECT s.id, round(s.total * 100)::int AS total,
            COALESCE(sum(CASE WHEN i.line_type = 'labour' THEN round(i.line_total * 100) END), 0)::int AS labour,
            COALESCE(sum(CASE WHEN i.line_type = 'product' THEN round(i.line_total * 100) END), 0)::int AS parts
       FROM sales s
       JOIN sale_documents d ON d.converted_sale_id = s.id AND d.workshop_job_id IS NOT NULL
       LEFT JOIN sale_items i ON i.sale_id = s.id
      WHERE ${inRange('s.created_at')}
      GROUP BY s.id, s.total`
  ).all(from, timeZone, to, timeZone);
  let labour = 0;
  let total = 0;
  for (const r of rows) {
    const lines = r.labour + r.parts;
    labour += lines ? Math.round((r.total * r.labour) / lines) : 0;
    total += r.total;
  }
  return { labour, parts: total - labour, total };
}

// Quotes sent in the period, by how they stand now. Drafts, withdrawn and
// replaced quotes are left out.
const QUOTE_GROUPS = { approved: ['approved', 'partly_approved'], declined: ['declined'], noAnswer: ['sent', 'expired'] };
async function quotes(from, to, timeZone) {
  const rows = await prepare(
    `SELECT state, count(*)::int AS n FROM workshop_quotes WHERE ${inRange('sent_at')} GROUP BY state`
  ).all(from, timeZone, to, timeZone);
  const by = Object.fromEntries(rows.map((r) => [r.state, r.n]));
  return Object.fromEntries(Object.entries(QUOTE_GROUPS).map(([k, states]) => [k, states.reduce((n, s) => n + (by[s] ?? 0), 0)]));
}

// How full each mechanic was: the diary time of their jobs and job blocks on
// the period's days (cancelled, declined and expired bookings left out), against
// the hours they are in: the workshop's hours on each of their working days,
// less their time away. Jobs with no mechanic are the shared queue.
const LEFT_OUT = "('cancelled', 'declined', 'expired')";
async function howFull(from, to) {
  const settings = toCapacitySettings(await prepare('SELECT * FROM workshop_settings LIMIT 1').get());
  const mechanics = await prepare(
    'SELECT id, name, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name'
  ).all();
  const blocks = (await prepare(
    "SELECT * FROM workshop_unavailability WHERE kind = 'weekly' OR (start_date <= ? AND end_date >= ?)"
  ).all(to, from)).map(toBlock);
  const days = computeCapacity({
    settings,
    mechanics: mechanics.map((m) => ({ id: m.id, workingDays: parseWorkingDays(m.working_days) })),
    blocks, jobs: [], dates: datesBetween(from, to),
  });
  const available = new Map();
  for (const day of days) {
    for (const m of day.mechanics) {
      const minutes = m.availableWindows.reduce((n, [s, e]) => n + (e - s), 0);
      available.set(m.mechanicId, (available.get(m.mechanicId) ?? 0) + minutes);
    }
  }
  // Only a job's first block speaks for untimed planned minutes, as the diary counts them.
  const parts = await prepare(
    `SELECT p.mechanic_id, p.start_time, p.end_time, CASE WHEN p.position = 1 THEN w.planned_minutes END AS planned_minutes
       FROM workshop_job_parts p JOIN workshop_jobs w ON w.id = p.workshop_job_id
      WHERE p.part_date >= ? AND p.part_date <= ? AND w.booking_state NOT IN ${LEFT_OUT}`
  ).all(from, to);
  const booked = new Map();
  for (const p of parts) {
    const minutes = p.start_time && p.end_time ? toMinutes(p.end_time) - toMinutes(p.start_time) : (p.planned_minutes || 0);
    const key = p.mechanic_id ?? null;
    booked.set(key, (booked.get(key) ?? 0) + minutes);
  }
  const hours = (minutes) => Math.round(minutes / 60);
  return {
    mechanics: mechanics.map((m) => {
      const have = available.get(m.id) ?? 0;
      const used = booked.get(m.id) ?? 0;
      return {
        id: m.id, name: m.name, bookedHours: hours(used), availableHours: hours(have),
        percent: have ? Math.round((used / have) * 100) : null, noSetHours: have === 0,
      };
    }),
    sharedQueue: { bookedHours: hours(booked.get(null) ?? 0) },
  };
}

// The period's own column name and the one before it, as the drawing words them.
const NOW_COLUMN = {
  today: 'Today so far', 'this-week': 'This week so far', 'this-month': 'This month so far', 'last-month': 'Last month',
  'last-12-months': 'Last 12 months', dates: 'These dates',
};
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function workshopReport(choice, today) {
  const timeZone = await currentShopTimeZone();
  const period = periodFor({ ...choice, today });
  const { from, through } = period;
  const b = period.before;
  const figure = (count, beforeCount) => ({ count, beforeCount, diff: count - beforeCount });

  const now = await finishedBy(period.unit, from, through, timeZone);
  const prev = await finishedBy(period.unit, b.from, b.to, timeZone);
  const rows = period.buckets.map((k) => ({
    key: k.key, label: k.label, notReached: k.notReached,
    finished: k.notReached ? null : now.get(String(k.key)) ?? 0,
    beforeFinished: prev.get(String(k.beforeKey)) ?? 0,
  }));
  const sumOf = (m) => [...m.values()].reduce((n, v) => n + v, 0);

  const ready = await bookedInToReady(from, through, timeZone);
  const readyBefore = await bookedInToReady(b.from, b.to, timeZone);
  const money = await takings(from, through, timeZone);
  const moneyBefore = await takings(b.from, b.to, timeZone);
  const q = await quotes(from, through, timeZone);
  const qBefore = await quotes(b.from, b.to, timeZone);
  const bookedIn = figure(await countJobs('booked_in_at', from, through, timeZone), await countJobs('booked_in_at', b.from, b.to, timeZone));

  return {
    period: {
      period: period.period, from, to: period.to, through, soFar: period.soFar,
      unit: period.unit, label: period.label, against: period.against,
    },
    before: b,
    columns: { now: NOW_COLUMN[period.period], before: capital(period.against.replace(/^the /, '')) },
    figures: {
      bookedIn,
      finished: figure(sumOf(now), sumOf(prev)),
      collected: figure(await countJobs('collected_at', from, through, timeZone), await countJobs('collected_at', b.from, b.to, timeZone)),
      bookedInToReady: {
        days: ready, beforeDays: readyBefore,
        diff: ready === null || readyBefore === null ? null : Math.round((ready - readyBefore) * 10) / 10,
      },
    },
    rows,
    takings: Object.fromEntries(['labour', 'parts', 'total'].map((k) => [k, { pence: money[k], beforePence: moneyBefore[k] }])),
    quotes: Object.fromEntries(Object.keys(QUOTE_GROUPS).map((k) => [k, { count: q[k], beforeCount: qBefore[k] }])),
    ...(await howFull(from, through)),
  };
}

// The spreadsheet: the report's three tables as shown, each under its title,
// a blank row between them (design 9).
const pounds = (pence) => (pence / 100).toFixed(2);
export function workshopCsv(report) {
  const { now, before } = report.columns;
  const t = report.takings;
  const q = report.quotes;
  return csvOf([
    ['Workshop takings'],
    ['Money', now, before],
    ['Labour', pounds(t.labour.pence), pounds(t.labour.beforePence)],
    ['Parts', pounds(t.parts.pence), pounds(t.parts.beforePence)],
    ['Total', pounds(t.total.pence), pounds(t.total.beforePence)],
    [],
    ['Quotes'],
    ['Quote', now, before],
    ['Approved', q.approved.count, q.approved.beforeCount],
    ['Declined', q.declined.count, q.declined.beforeCount],
    ['No answer', q.noAnswer.count, q.noAnswer.beforeCount],
    [],
    ['How full each mechanic was'],
    ['Mechanic', 'Hours booked', 'Hours they are in', 'Full'],
    ...report.mechanics.map((m) => [m.name, m.bookedHours, m.noSetHours ? 'no set hours' : m.availableHours, m.noSetHours ? '—' : `${m.percent}%`]),
    ['Shared queue', report.sharedQueue.bookedHours, 'no set hours', '—'],
  ]);
}
