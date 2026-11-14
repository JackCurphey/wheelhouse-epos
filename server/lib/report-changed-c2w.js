// The Cycle to Work side of "Change what's shown" (openspec/changes/cycle-to-work,
// task 10.4's follow-up; rp-c2w's "Change what's shown"): the figures rp-c2w
// counts for a period, by Day, Week or Provider. Bikes collected counts each
// order on the shop day it was collected; Paid and Commission count on the day
// the payment was received (paid_on), as rp-c2w does (server/lib/report-c2w.js). Only is the
// shop's providers. Owed now and Late are right-now figures, not a period's, so
// they stay on the report and the Owed page. Read through the request's shop
// (row-level security).
import { prepare } from '../db.js';

const inRange = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;

// The shop's providers, for Only, retired ones included (a bike collected for one still counts).
export async function providerNames() {
  const rows = await prepare('SELECT name FROM c2w_providers GROUP BY name ORDER BY lower(name), name').all();
  return rows.map((r) => r.name);
}

export async function c2wRead({ measure, split, from, to, tz, only }) {
  const bikes = measure === 'bikes';
  // Bikes by the shop day collected; money by the day the payment was received (a date, so no time zone).
  const day = bikes ? 'o.collected_at AT TIME ZONE ?' : 'o.paid_on';
  const dayArgs = bikes ? [tz] : [];
  const [key, label, keyArgs] = split === 'provider'
    ? ['p.id::text', 'p.name', []]
    : split === 'week'
      ? [`to_char(date_trunc('week', ${day}), 'YYYY-MM-DD')`, null, dayArgs]
      : [`to_char(${day}, 'YYYY-MM-DD')`, null, dayArgs];
  const value = bikes
    ? 'count(*)::int AS qty, 0 AS pence'
    : measure === 'commission'
      ? '0 AS qty, COALESCE(sum(o.certificate_pence - o.expected_pence) FILTER (WHERE o.certificate_pence IS NOT NULL AND o.expected_pence IS NOT NULL), 0)::int AS pence'
      : '0 AS qty, COALESCE(sum(o.paid_pence), 0)::int AS pence';
  const where = bikes ? inRange('o.collected_at') : "o.stage = 'paid' AND o.paid_on >= ?::date AND o.paid_on <= ?::date";
  const whereArgs = bikes ? [from, tz, to, tz] : [from, to];
  const rows = await prepare(
    `SELECT ${key} AS key, ${label ?? 'NULL'} AS label, ${value}
       FROM c2w_orders o JOIN c2w_providers p ON p.id = o.provider_id
      WHERE ${where}${only.length ? ' AND p.name = ANY(?)' : ''}
      GROUP BY 1, 2`
  ).all(...keyArgs, ...whereArgs, ...(only.length ? [only] : []));
  return { groups: new Map(rows.map((r) => [String(r.key), { label: r.label ?? r.key, pence: r.pence, qty: r.qty }])) };
}

// The day Cycle to Work's own history starts: the first bike collected or paid for.
export async function firstC2wDay(tz) {
  const row = await prepare(
    `SELECT least(
       (SELECT to_char(min(collected_at) AT TIME ZONE ?, 'YYYY-MM-DD') FROM c2w_orders),
       (SELECT to_char(min(paid_on), 'YYYY-MM-DD') FROM c2w_orders WHERE stage = 'paid')) AS day`
  ).get(tz);
  return row?.day ?? null;
}
