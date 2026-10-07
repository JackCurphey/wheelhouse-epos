// The workshop's staff routes (Workshop > diary, job window): /api/workshop-jobs
// and the helpers only they use. Staff routes: they run under the dispatcher's
// /api/ branch (server.js), so a handler gets (req, res, params, query,
// afterRelease, shopId) with the shop's row-level security already bound, and
// needs a staff session. Jack's file (split plan §3). Moved out of server.js
// unchanged (split plan §4.1, WP-0.4); the shared workshop helpers other areas
// call are in server/workshop/jobs.js.
import { prepare, dbExec, pool } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson, nowIso } from '../lib/http.js';
import { newLinkCode, hashLinkCode, linkPath } from '../booking-link.js';
import { readLegacyStatus } from '../workshop/state-machines.js';
import {
  SLOT_GONE, WORKSHOP_JOB_SELECT, capacityRefusal, checkJobSlot, createWorkshopJob, currentShopToday,
  parseWorkingDays, refusal, resolveJobMechanicId, resolveJobTimes, serializeWorkshopJob, withBookingLock,
} from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// 'pending' is a customer-submitted booking (see /api/portal/*) awaiting a
// mechanic's manual review before it counts as scheduled - it still occupies
// its diary slot like any other status, so a second booking can't silently
// double it up, but staff have to explicitly approve it first.
export const JOB_STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete'];

export function resolveJobStatus(raw, existing) {
  if (raw === undefined) return existing || 'scheduled';
  if (!JOB_STATUSES.includes(raw)) return null;
  return raw;
}

// ---- A job's parts: one per day it is worked (migration 037; Workshop day
// decision 52). Part 1 is the job's own date, times and mechanic, kept
// identical by triggers; later parts come from "Add another day" and from
// carry-over. Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
function serializePart(row) {
  return {
    id: row.id,
    position: row.position,
    date: row.part_date,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    mechanicId: row.mechanic_id ?? null,
    mechanicName: row.mechanic_name ?? null,
  };
}

// Adds each job's parts, in order, to serialized jobs.
export async function attachParts(jobs) {
  if (!jobs.length) return jobs;
  const rows = await db.prepare(
    `SELECT p.*, e.name AS mechanic_name FROM workshop_job_parts p
     LEFT JOIN employees e ON e.id = p.mechanic_id
     WHERE p.workshop_job_id = ANY(?::int[]) ORDER BY p.workshop_job_id, p.position`
  ).all(jobs.map((j) => j.id));
  const byJob = new Map();
  for (const r of rows) {
    if (!byJob.has(r.workshop_job_id)) byJob.set(r.workshop_job_id, []);
    byJob.get(r.workshop_job_id).push(serializePart(r));
  }
  return jobs.map((j) => ({ ...j, parts: byJob.get(j.id) ?? [] }));
}

export const addDaysIso = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// The first day on or after `from` that the shop opens and the mechanic works
// (any day the shop opens when there is no mechanic), within 60 days.
export async function nextWorkingDay(from, mechanicId) {
  const settings = await db.prepare('SELECT opening_days FROM workshop_settings LIMIT 1').get();
  const shopDays = settings ? parseWorkingDays(settings.opening_days) : null;
  let mechDays = null;
  if (mechanicId) {
    const m = await db.prepare('SELECT working_days FROM employees WHERE id = ?').get(mechanicId);
    mechDays = m ? parseWorkingDays(m.working_days) : null;
  }
  for (let i = 0; i < 60; i += 1) {
    const date = addDaysIso(from, i);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (Array.isArray(shopDays) && !shopDays.includes(weekday)) continue;
    if (Array.isArray(mechDays) && !mechDays.includes(weekday)) continue;
    return date;
  }
  return null;
}

// Carry-over (decision 52; Jack, 3 Oct): an unfinished job - the bike is in
// the shop and the work isn't finished - whose last day has passed gets a new
// part on the next working day from today, at the same time, with the same
// mechanic. Run when the jobs list is read (nothing runs at midnight). Not
// refused for overlapping another job: the diary shows the overlap.
// Idempotent: once a job has a part today or later it no longer qualifies,
// and a second reader racing the first is stopped by UNIQUE(job, position).
async function carryOverUnfinished() {
  const today = await currentShopToday();
  const late = await db.prepare(
    `SELECT w.id, w.shop_id, p.part_date, p.start_time, p.end_time, p.mechanic_id, p.position
       FROM workshop_jobs w
       JOIN workshop_job_parts p ON p.workshop_job_id = w.id
      WHERE w.custody_state = 'in_shop' AND w.work_state <> 'complete'
        AND w.booking_state IN ('scheduled', 'reschedule_requested')
        AND p.position = (SELECT max(position) FROM workshop_job_parts q WHERE q.workshop_job_id = w.id)
        AND p.part_date < ?`
  ).all(today);
  for (const last of late) {
    const date = await nextWorkingDay(today, last.mechanic_id);
    if (!date) continue;
    const added = await db.prepare(
      `INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workshop_job_id, position) DO NOTHING RETURNING id`
    ).get(last.shop_id, last.id, date, last.start_time, last.end_time, last.mechanic_id, last.position + 1);
    if (added) await db.prepare('UPDATE workshop_jobs SET version = version + 1, updated_at = now() WHERE id = ?').run(last.id);
  }
}

export async function resolveJobCustomerId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, customerId: existingId };
  if (rawId === null || rawId === '') return { ok: true, customerId: null };
  const customerId = Number(rawId);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
  if (!customer) return { ok: false };
  return { ok: true, customerId };
}

// A bike belongs to exactly one customer, so a job can only be linked to a
// bike when it's also linked to that same bike's owner. When bikeId isn't
// explicitly provided (e.g. a drag/resize that only moves the time), the
// existing link is kept unless it no longer matches the resolved customer,
// in which case it's silently dropped rather than rejecting the request.
export async function resolveJobBikeId(rawId, existingId, resolvedCustomerId) {
  if (rawId === undefined) {
    if (!existingId) return { ok: true, bikeId: null };
    const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(existingId);
    if (!bike || !resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
      return { ok: true, bikeId: null };
    }
    return { ok: true, bikeId: existingId };
  }
  if (rawId === null || rawId === '') return { ok: true, bikeId: null };
  const bikeId = Number(rawId);
  const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ? AND active = 1').get(bikeId);
  if (!bike) return { ok: false, error: 'Bike not found or inactive' };
  if (!resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
    return { ok: false, error: "That bike doesn't belong to the selected customer" };
  }
  return { ok: true, bikeId };
}

// A job's length when it has no times: whole minutes, 1 to 720, or null.
export function resolvePlannedMinutes(input, fallback) {
  if (input === undefined) return { value: fallback ?? null };
  if (input === null || input === '') return { value: null };
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 720) {
    return { error: 'The planned length must be a whole number of minutes between 1 and 720' };
  }
  return { value: n };
}

export function register(route) {
  route('GET', '/api/workshop-jobs', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    await carryOverUnfinished();
    let sql = WORKSHOP_JOB_SELECT + ' WHERE 1=1';
    const args = [];
    // A job is in the range when any of its days is (a job over several days).
    if (start || end) {
      sql += ` AND EXISTS (SELECT 1 FROM workshop_job_parts p WHERE p.workshop_job_id = w.id
      AND (?::text IS NULL OR p.part_date >= ?) AND (?::text IS NULL OR p.part_date <= ?))`;
      args.push(start || null, start || null, end || null, end || null);
    }
    const status = query.get('status');
    if (status) {
      sql += ' AND w.status = ?';
      args.push(status);
    }
    sql += ' ORDER BY w.job_date, w.start_time';
    const rows = await db.prepare(sql).all(...args);
    sendJson(res, 200, await attachParts(rows.map(serializeWorkshopJob)));
  });

  route('GET', '/api/workshop-jobs/:id', async (req, res, params) => {
    const id = Number(params.id);
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
    if (!row) return notFound(res, 'Job not found');
    sendJson(res, 200, (await attachParts([serializeWorkshopJob(row)]))[0]);
  });

  // A new booking link for a job: the old one stops working at once, because a
  // job holds one hash. Returned once; staff text it or read it out.
  // Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
  // Staff handlers get (req, res, params, query, afterRelease, shopId); the slug
  // for the path comes from shops, which is outside row-level security.
  // screens: expired
  route('POST', '/api/workshop-jobs/:id/private-link', async (req, res, params, query, afterRelease, shopId) => {
    const job = await db.prepare('SELECT id, customer_id FROM workshop_jobs WHERE id = ?').get(Number(params.id));
    if (!job) return notFound(res, 'Job not found');
    if (!job.customer_id) return badRequest(res, 'This job has no customer to send a link to');
    const code = newLinkCode();
    await db.prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashLinkCode(code), nowIso(), job.id);
    const { rows: [shop] } = await pool.query('SELECT slug FROM shops WHERE id = $1', [shopId]);
    sendJson(res, 201, { privateLink: linkPath(shop.slug, code) });
  });

  route('POST', '/api/workshop-jobs', async (req, res) => {
    const body = await readJsonBody(req);
    const title = (body.title || '').trim();
    if (!title) return badRequest(res, 'Job title is required');
    const jobDate = (body.jobDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const notes = (body.notes || '').trim();

    const times = resolveJobTimes((body.startTime || '').trim(), (body.endTime || '').trim());
    if (times.error) return badRequest(res, times.error);

    const resolved = await resolveJobCustomerId(body.customerId, null);
    if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

    const bikeResolved = await resolveJobBikeId(body.bikeId, null, resolved.customerId);
    if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

    const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
    if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

    // A walk-in for the shared queue carries a length and no mechanic or time.
    const planned = resolvePlannedMinutes(body.plannedMinutes, null);
    if (planned.error) return badRequest(res, planned.error);

    const status = resolveJobStatus(body.status, null);
    if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);
    // The staff diary still sends a legacy status and will until Phase 4 replaces
    // it. Translating here rather than changing the request contract is what
    // keeps public/app.js working untouched through this phase.
    const created = readLegacyStatus(status);

    // Staff are held to the shop's rules, never to capacity: no calculator here.
    // The only capacity answer is the 024 index firing on a stale pre-2b hold,
    // which rolls the whole write back.
    let out;
    try {
      out = await withBookingLock([jobDate], async () => {
        const slotError = await checkJobSlot({
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          mechanicId: mechResolved.mechanicId,
        });
        if (slotError) return refusal(slotError.error);

        const jobId = await createWorkshopJob({
          title,
          customerId: resolved.customerId,
          bikeId: bikeResolved.bikeId,
          mechanicId: mechResolved.mechanicId,
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          bookingState: created.booking,
          workState: created.work,
          custodyState: created.custody ?? 'expected',
          notes,
          skipAutoOrder: !!body.skipAutoOrder,
          plannedMinutes: planned.value,
        });
        const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
        return { status: 201, body: serializeWorkshopJob(row) };
      });
    } catch (err) {
      if (err.code === '23505') out = capacityRefusal(SLOT_GONE);
      else throw err;
    }
    if (out.status === 201) out.body = (await attachParts([out.body]))[0];
    sendJson(res, out.status, out.body);
  });
}
