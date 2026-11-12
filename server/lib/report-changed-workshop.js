// The Workshop side of "Change what's shown" (openspec/changes/reports-your-own, design 2 and 3):
// Jobs (finished, as the Workshop report counts them: the job's latest sign-off in the period) and Hours
// (diary time, as "how full each mechanic was" counts it: a job's blocks on the period's days, cancelled,
// declined and expired bookings left out), by Day, Week, Staff member (the mechanic) and Service. Only is
// the workshop's service categories: a job counts if one of its services is in one. A job with several
// services counts under each in Jobs by Service (the total counts it once) and shares its hours between
// them in Hours by Service, so the hours add up. Read through the request's shop (row-level security).
import { prepare } from '../db.js';
import { toMinutes } from '../capacity.js';
import { addDays } from './report-periods.js';

const inRange = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;
const LEFT_OUT = "('cancelled', 'declined', 'expired')";
const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

// The workshop's service categories, for Only.
export async function serviceCategoryNames() {
  const rows = await prepare('SELECT name FROM workshop_service_categories ORDER BY lower(name), name').all();
  return rows.map((r) => r.name);
}

// Jobs whose services include one in a chosen category.
const hasService = (only) => (only.length
  ? ` AND EXISTS (SELECT 1 FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
                    JOIN workshop_service_categories c ON c.id = s.category_id WHERE js.workshop_job_id = w.id AND c.name = ANY(?))`
  : '');

async function jobs(split, from, to, tz, only) {
  const range = [from, tz, to, tz];
  const onlyArgs = only.length ? [only] : [];
  const total = (await prepare(`SELECT count(*)::int AS n FROM workshop_jobs w WHERE ${inRange('w.signed_off_at')}${hasService(only)}`).get(...range, ...onlyArgs)).n;
  let rows;
  if (split === 'day' || split === 'week') {
    const key = split === 'day' ? "to_char(w.signed_off_at AT TIME ZONE ?, 'YYYY-MM-DD')" : "to_char(date_trunc('week', w.signed_off_at AT TIME ZONE ?), 'YYYY-MM-DD')";
    rows = await prepare(`SELECT ${key} AS key, ${key} AS label, count(*)::int AS qty FROM workshop_jobs w WHERE ${inRange('w.signed_off_at')}${hasService(only)} GROUP BY 1, 2`)
      .all(tz, tz, ...range, ...onlyArgs);
  } else if (split === 'staff') {
    rows = await prepare(
      `SELECT COALESCE(w.mechanic_id::text, 'none') AS key, COALESCE(e.name, 'Shared queue') AS label, count(*)::int AS qty
         FROM workshop_jobs w LEFT JOIN employees e ON e.id = w.mechanic_id
        WHERE ${inRange('w.signed_off_at')}${hasService(only)} GROUP BY 1, 2`
    ).all(...range, ...onlyArgs);
  } else {
    rows = await prepare(
      `SELECT COALESCE(s.id::text, 'none') AS key, COALESCE(s.name, 'No service') AS label, count(DISTINCT w.id)::int AS qty
         FROM workshop_jobs w LEFT JOIN workshop_job_services js ON js.workshop_job_id = w.id
         LEFT JOIN workshop_services s ON s.id = js.service_id LEFT JOIN workshop_service_categories c ON c.id = s.category_id
        WHERE ${inRange('w.signed_off_at')}${only.length ? ' AND c.name = ANY(?)' : ''} GROUP BY 1, 2`
    ).all(...range, ...onlyArgs);
  }
  return { groups: new Map(rows.map((r) => [String(r.key), { label: r.label, pence: 0, qty: r.qty }])), total };
}

async function hours(split, from, to, only) {
  const parts = await prepare(
    `SELECT p.part_date, p.mechanic_id, p.start_time, p.end_time, CASE WHEN p.position = 1 THEN w.planned_minutes END AS planned_minutes, w.id AS job_id
       FROM workshop_job_parts p JOIN workshop_jobs w ON w.id = p.workshop_job_id
      WHERE p.part_date >= ? AND p.part_date <= ? AND w.booking_state NOT IN ${LEFT_OUT}${hasService(only)}`
  ).all(from, to, ...(only.length ? [only] : []));
  const minutesOf = (p) => (p.start_time && p.end_time ? toMinutes(p.end_time) - toMinutes(p.start_time) : (p.planned_minutes || 0));
  const groups = new Map();
  const add = (key, label, minutes) => {
    const g = groups.get(key) ?? { label, pence: 0, qty: 0 };
    g.qty += minutes / 60;
    groups.set(key, g);
  };
  let total = 0;
  if (split === 'staff') {
    const names = new Map((await prepare('SELECT id, name FROM employees').all()).map((e) => [e.id, e.name]));
    for (const p of parts) add(String(p.mechanic_id ?? 'none'), p.mechanic_id === null ? 'Shared queue' : names.get(p.mechanic_id) ?? 'Not recorded', minutesOf(p));
  } else if (split === 'service') {
    const ids = [...new Set(parts.map((p) => p.job_id))];
    const services = new Map();
    if (ids.length) {
      const rows = await prepare(
        `SELECT js.workshop_job_id AS job_id, s.id, s.name, c.name AS category
           FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
           LEFT JOIN workshop_service_categories c ON c.id = s.category_id WHERE js.workshop_job_id = ANY(?)`
      ).all(ids);
      for (const r of rows) services.set(r.job_id, [...(services.get(r.job_id) ?? []), r]);
    }
    for (const p of parts) {
      const chosen = (services.get(p.job_id) ?? []).filter((s) => !only.length || only.includes(s.category));
      const list = chosen.length ? chosen.map((s) => [String(s.id), s.name]) : [['none', 'No service']];
      for (const [key, label] of list) add(key, label, minutesOf(p) / list.length);
    }
  } else {
    for (const p of parts) {
      const key = split === 'week' ? mondayOf(p.part_date) : p.part_date;
      add(key, key, minutesOf(p));
    }
  }
  for (const g of groups.values()) total += g.qty;
  return { groups, total };
}

// The groups for a measure and split between two shop days, and the total counted once.
export function workshopRead({ measure, split, from, to, tz, only }) {
  return measure === 'hours' ? hours(split, from, to, only) : jobs(split, from, to, tz, only);
}
