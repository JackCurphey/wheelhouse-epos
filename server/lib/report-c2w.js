// Cycle to Work: owed and paid (openspec/changes/cycle-to-work, task 10.3;
// rp-c2w in generator/reports.mjs; UX walk-through 5 H3, option 1): by
// provider, the bikes collected, what's owed now, what was paid and the
// commission kept, and the late bikes, for a period and the one before it.
// Defaults logged in docs/decisions/decided-while-building/2026-11-jack.md
// ("Cycle to Work on Today and in Reports"). Read through the request's shop
// (row-level security).
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { owedOrders } from '../c2w/money.js';
import { periodFor } from './report-periods.js';
import { csvOf } from './csv.js';

const inRange = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;
const byProvider = (rows) => new Map(rows.map((r) => [r.provider_id, r]));

// Paid and commission are counted on the day each order is marked paid (the
// drawing's note): orders marked paid with paid_on in the period. Commission is
// the certificate less what the provider was expected to pay, over orders that
// have both; on a paid order that is also what it paid, since any extra is
// noted apart (server/c2w/money.js). A part-paid order counts nowhere until it
// is marked paid.
async function paid(from, to) {
  return byProvider(await prepare(
    `SELECT provider_id, COALESCE(sum(paid_pence), 0)::int AS paid,
            COALESCE(sum(certificate_pence - expected_pence) FILTER (WHERE certificate_pence IS NOT NULL AND expected_pence IS NOT NULL), 0)::int AS commission
       FROM c2w_orders WHERE stage = 'paid' AND paid_on >= ?::date AND paid_on <= ?::date GROUP BY provider_id`
  ).all(from, to));
}

async function collected(from, to, timeZone) {
  return byProvider(await prepare(
    `SELECT provider_id, count(*)::int AS n FROM c2w_orders WHERE ${inRange('collected_at')} GROUP BY provider_id`
  ).all(from, timeZone, to, timeZone));
}

// A shortfall closed with a reason counts on the day it was closed (its line in
// "What's happened"), as what was expected less what was paid.
async function shortfalls(from, to, timeZone) {
  return (await prepare(
    `SELECT count(*)::int AS orders, COALESCE(sum(o.expected_pence - COALESCE(o.paid_pence, 0)), 0)::int AS pence
       FROM c2w_orders o
      WHERE o.stage = 'closed' AND EXISTS (SELECT 1 FROM c2w_order_events e WHERE e.order_id = o.id AND e.kind = 'shortfall_closed' AND ${inRange('e.created_at')})`
  ).get(from, timeZone, to, timeZone));
}

// The period's own column name and the one before it, as Workshop words them.
const NOW_COLUMN = {
  today: 'Today so far', 'this-week': 'This week so far', 'this-month': 'This month so far', 'last-month': 'Last month',
  'last-12-months': 'Last 12 months', dates: 'These dates',
};
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const COLS = ['bikesCollected', 'owedPence', 'paidPence', 'beforePaidPence', 'commissionPence', 'late'];

export async function c2wReport(choice, today) {
  const timeZone = await currentShopTimeZone();
  const period = periodFor({ ...choice, today });
  const { from, through } = period;
  const b = period.before;
  const now = await paid(from, through);
  const prev = await paid(b.from, b.to);
  const bikes = await collected(from, through, timeZone);
  // What's owed now is the Owed page's rule, whatever the period (cw-owed).
  const owed = new Map();
  for (const o of await owedOrders(timeZone)) {
    const p = owed.get(o.providerId) ?? { bikes: 0, pence: 0, late: 0 };
    p.bikes += 1;
    p.pence += o.owedPence;
    if (o.lateDays !== null) p.late += 1;
    owed.set(o.providerId, p);
  }
  const all = await prepare('SELECT id, name, retired_at FROM c2w_providers ORDER BY id').all();
  const providers = all.map((p) => ({
    id: p.id, name: p.name,
    bikesCollected: bikes.get(p.id)?.n ?? 0,
    owedPence: owed.get(p.id)?.pence ?? 0,
    paidPence: now.get(p.id)?.paid ?? 0,
    beforePaidPence: prev.get(p.id)?.paid ?? 0,
    commissionPence: now.get(p.id)?.commission ?? 0,
    late: owed.get(p.id)?.late ?? 0,
    retired: p.retired_at !== null,
  // Every current provider has its row, as Settings lists them; a retired one only with something to show.
  })).filter((p) => !p.retired || COLS.some((k) => p[k] !== 0)).map(({ retired, ...p }) => p);
  const sum = (k) => providers.reduce((s, p) => s + p[k], 0);
  const total = { label: 'All providers', ...Object.fromEntries(COLS.map((k) => [k, sum(k)])) };
  const beforeCommission = [...prev.values()].reduce((s, r) => s + r.commission, 0);
  const owedAll = [...owed.values()];
  const short = await shortfalls(from, through, timeZone);
  return {
    period: {
      period: period.period, from, to: period.to, through, soFar: period.soFar,
      unit: period.unit, label: period.label, against: period.against,
    },
    before: b,
    columns: { now: NOW_COLUMN[period.period], before: capital(period.against.replace(/^the /, '')) },
    figures: {
      owedNow: { pence: owedAll.reduce((s, p) => s + p.pence, 0), bikes: owedAll.reduce((s, p) => s + p.bikes, 0), late: owedAll.reduce((s, p) => s + p.late, 0) },
      paid: { pence: total.paidPence, beforePence: total.beforePaidPence, diffPence: total.paidPence - total.beforePaidPence },
      commission: { pence: total.commissionPence, beforePence: beforeCommission, diffPence: total.commissionPence - beforeCommission },
      shortfalls: { pence: short.pence, orders: short.orders },
    },
    providers,
    total,
  };
}

// The spreadsheet: the by-provider table as shown, under its title (design 9 of reports-ready-made).
const pounds = (pence) => (pence / 100).toFixed(2);
export function c2wCsv(report) {
  const line = (p, name) => [name, p.bikesCollected, pounds(p.owedPence), pounds(p.paidPence), pounds(p.commissionPence), p.late];
  return csvOf([
    ['Cycle to Work by provider'],
    ['Provider', 'Bikes collected', 'Owed now', 'Paid', 'Commission', 'Late'],
    ...report.providers.map((p) => line(p, p.name)),
    line(report.total, report.total.label),
  ]);
}
