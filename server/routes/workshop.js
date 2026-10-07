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
import { readLegacyStatus, bookingRequest, custody, work } from '../workshop/state-machines.js';
import { applyEvent } from '../workshop/transitions.js';
import {
  CLEAR_REQUEST, SLOT_GONE, WORKSHOP_JOB_SELECT, capacityRefusal, checkJobSlot, createWorkshopJob,
  currentShopToday, parseWorkingDays, refusal, requestedOf, resolveJobMechanicId, resolveJobTimes,
  serializeWorkshopJob, syncJobHold, timeToMinutes, withBookingLock, withJobBookingLock, applyLocked,
} from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// 'pending' is a customer-submitted booking (see /api/portal/*) awaiting a
// mechanic's manual review before it counts as scheduled - it still occupies
// its diary slot like any other status, so a second booking can't silently
// double it up, but staff have to explicitly approve it first.
export const JOB_STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete'];

function resolveJobStatus(raw, existing) {
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
async function attachParts(jobs) {
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

const addDaysIso = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// The first day on or after `from` that the shop opens and the mechanic works
// (any day the shop opens when there is no mechanic), within 60 days.
async function nextWorkingDay(from, mechanicId) {
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

async function resolveJobCustomerId(rawId, existingId) {
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
async function resolveJobBikeId(rawId, existingId, resolvedCustomerId) {
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
function resolvePlannedMinutes(input, fallback) {
  if (input === undefined) return { value: fallback ?? null };
  if (input === null || input === '') return { value: null };
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 720) {
    return { error: 'The planned length must be a whole number of minutes between 1 and 720' };
  }
  return { value: n };
}

const VERSION_REQUIRED = 'version is required - send the version you last read';

// The words applyEvent uses for a lost race (server/workshop/transitions.js).
const staleRefusal = {
  status: 409,
  body: { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' },
};

// ---- A job's later days (Jack, 3 Oct: "Add another day" on the job page) ----
// Each changes the job, so each needs the version the caller saw and bumps
// it. Day 1 is the job's own date and is moved with PUT /api/workshop-jobs/:id.
// Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
async function sendJobWithParts(res, id) {
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  if (!row) return notFound(res, 'Job not found');
  sendJson(res, 200, (await attachParts([serializeWorkshopJob(row)]))[0]);
}

const bumpJobVersion = (id) => db.prepare('UPDATE workshop_jobs SET version = version + 1, updated_at = now() WHERE id = ?').run(id);

const lastPartOf = (id) => db.prepare('SELECT * FROM workshop_job_parts WHERE workshop_job_id = ? ORDER BY position DESC LIMIT 1').get(id);

// Staff answer a customer's change request (piece 12). Under the booking lock
// for both days; the version is the one staff last read.
async function answerChangeRequest(req, res, id, answer) {
  const body = await readJsonBody(req);
  if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
  const requestedGone = { status: 409, body: { error: 'The requested time is no longer free', code: 'capacity' } };
  let out;
  try {
    out = await withJobBookingLock(id, [], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const requested = requestedOf(job);
      if (!requested) {
        return { status: 409, body: { error: `There's no change request to ${answer}`, code: 'illegal' } };
      }
      if (answer === 'accept') {
        // The shop's slot rules, the job itself left out; never the capacity
        // calculator - staff are never refused for capacity (decision log D14).
        const slotError = await checkJobSlot({
          jobDate: requested.jobDate, startTime: requested.startTime, endTime: requested.endTime,
          mechanicId: requested.mechanicId, ignoreJobId: id,
        });
        if (slotError) return requestedGone;
        await applyLocked(job, 'accept');
        await db.prepare(
          `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, ${CLEAR_REQUEST}, updated_at = now()
           WHERE id = ?`
        ).run(requested.jobDate, requested.mechanicId, requested.startTime, requested.endTime, id);
        // The requested hold becomes the booking's own; the old one goes.
        await db.prepare(
          `UPDATE workshop_capacity_holds SET state = 'released'
           WHERE workshop_job_id = ? AND purpose = 'booking' AND state IN ('held', 'confirmed')`
        ).run(id);
        await db.prepare(
          `UPDATE workshop_capacity_holds SET purpose = 'booking'
           WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed')`
        ).run(id);
      } else {
        await applyLocked(job, 'decline');
        await db.prepare(
          `UPDATE workshop_jobs SET ${CLEAR_REQUEST}, change_declined_at = now(), updated_at = now() WHERE id = ?`
        ).run(id);
      }
      await syncJobHold(id);
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
      return { status: 200, body: serializeWorkshopJob(row) };
    });
  } catch (err) {
    // The 024 index: another live hold sits on the requested slot.
    if (err.code !== '23505') throw err;
    out = requestedGone;
  }
  if (out?.gone) return notFound(res, 'Job not found');
  sendJson(res, out.status, out.body);
}

// One item of "Waiting for you" (decision log D12).
function waitingItem(row) {
  const kind = row.booking_state === 'pending' ? 'new_booking'
    : row.booking_state === 'reschedule_requested' ? 'change_request' : 'customer_cancelled';
  const slot = (jobDate, startTime, endTime, mechanicId, mechanicName) => ({
    jobDate, startTime: startTime || '', endTime: endTime || '', mechanicId, mechanicName: mechanicName ?? null,
  });
  const current = slot(row.job_date, row.start_time, row.end_time, row.mechanic_id, row.mechanic_name);
  return {
    kind,
    jobId: row.id,
    reference: row.reference,
    ...current,
    customerName: row.customer_name ?? null,
    serviceNames: row.service_names,
    services: row.services,
    arrivedAt: { new_booking: row.created_at, change_request: row.requested_at, customer_cancelled: row.cancelled_at }[kind],
    ...(kind === 'change_request'
      ? {
        from: current,
        to: slot(row.requested_job_date, row.requested_start_time, row.requested_end_time, row.requested_mechanic_id, row.requested_mechanic_name),
      }
      : {}),
  };
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

  // screens: diary, week
  route('POST', '/api/workshop-jobs/:id/parts', async (req, res, params) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const last = await lastPartOf(id);
    if (!last) return notFound(res, 'Job not found');
    const date = await nextWorkingDay(addDaysIso(last.part_date, 1), last.mechanic_id);
    if (!date) return badRequest(res, 'There is no working day for this mechanic in the next 60 days');
    const out = await withJobBookingLock(id, [date], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const now = await lastPartOf(id);
      if (now.id !== last.id || now.part_date !== last.part_date) return staleRefusal;
      const slot = await checkJobSlot({ jobDate: date, startTime: last.start_time, endTime: last.end_time, mechanicId: last.mechanic_id, ignoreJobId: id });
      if (slot) return refusal(slot.error);
      await db.prepare(
        `INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(job.shop_id, id, date, last.start_time, last.end_time, last.mechanic_id, last.position + 1);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  // screens: diary, week
  route('PUT', '/api/workshop-jobs/:id/parts/:partId', async (req, res, params) => {
    const id = Number(params.id);
    const partId = Number(params.partId);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const part = await db.prepare('SELECT * FROM workshop_job_parts WHERE id = ? AND workshop_job_id = ?').get(partId, id);
    if (!part) return notFound(res, 'That day of the job was not found');
    if (part.position === 1) return badRequest(res, "Move a job's first day by moving the job itself");
    const jobDate = body.jobDate !== undefined ? String(body.jobDate).trim() : part.part_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const times = resolveJobTimes(
      body.startTime !== undefined ? String(body.startTime).trim() : part.start_time,
      body.endTime !== undefined ? String(body.endTime).trim() : part.end_time,
    );
    if (times.error) return badRequest(res, times.error);
    const mech = await resolveJobMechanicId(body.mechanicId, part.mechanic_id);
    if (!mech.ok) return badRequest(res, 'Mechanic not found or inactive');
    const out = await withJobBookingLock(id, [part.part_date, jobDate], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const slot = await checkJobSlot({ jobDate, startTime: times.startTime, endTime: times.endTime, mechanicId: mech.mechanicId, ignoreJobId: id });
      if (slot) return refusal(slot.error);
      await db.prepare('UPDATE workshop_job_parts SET part_date = ?, start_time = ?, end_time = ?, mechanic_id = ? WHERE id = ?')
        .run(jobDate, times.startTime, times.endTime, mech.mechanicId, partId);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  // screens: diary, week
  route('DELETE', '/api/workshop-jobs/:id/parts/:partId', async (req, res, params) => {
    const id = Number(params.id);
    const partId = Number(params.partId);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const part = await db.prepare('SELECT * FROM workshop_job_parts WHERE id = ? AND workshop_job_id = ?').get(partId, id);
    if (!part) return notFound(res, 'That day of the job was not found');
    if (part.position === 1) return badRequest(res, "A job's first day can't be removed");
    const out = await withJobBookingLock(id, [part.part_date], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      await db.prepare('DELETE FROM workshop_job_parts WHERE id = ?').run(partId);
      // Close up the positions after it, in two steps so UNIQUE(job, position)
      // never sees two parts at the same position mid-update.
      await db.prepare('UPDATE workshop_job_parts SET position = -position WHERE workshop_job_id = ? AND position > ?').run(id, part.position);
      await db.prepare('UPDATE workshop_job_parts SET position = -position - 1 WHERE workshop_job_id = ? AND position < 0').run(id);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  route('PUT', '/api/workshop-jobs/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Job not found');
    const body = await readJsonBody(req);
    // The old diary now sends the version it last read (staff diary piece).
    // Optional, so a caller that doesn't send one keeps the old behaviour.
    if (body.version !== undefined && !Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) return badRequest(res, 'Job title is required');
    const jobDate = body.jobDate !== undefined ? String(body.jobDate).trim() : existing.job_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;

    const startTimeInput = body.startTime !== undefined ? String(body.startTime).trim() : existing.start_time;
    const endTimeInput = body.endTime !== undefined ? String(body.endTime).trim() : existing.end_time;
    const times = resolveJobTimes(startTimeInput, endTimeInput);
    if (times.error) return badRequest(res, times.error);

    const resolved = await resolveJobCustomerId(body.customerId, existing.customer_id);
    if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

    const bikeResolved = await resolveJobBikeId(body.bikeId, existing.bike_id, resolved.customerId);
    if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

    const mechResolved = await resolveJobMechanicId(body.mechanicId, existing.mechanic_id);
    if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

    const planned = resolvePlannedMinutes(body.plannedMinutes, existing.planned_minutes);
    if (planned.error) return badRequest(res, planned.error);
    // A timed job's length is its times; planned_minutes only speaks for untimed work.
    const plannedMinutes = times.startTime
      ? Math.max(0, timeToMinutes(times.endTime) - timeToMinutes(times.startTime))
      : planned.value;

    // The staff diary still changes a job's state by PUTting a legacy status
    // (public/app.js approveJob() and the complete/reopen toggle), and will until
    // Phase 4 replaces it. This translates that into the state columns.
    //
    // Deliberately NOT routed through applyEvent: some of its moves are not
    // single machine events, and this is the unguarded legacy path - the reason
    // the action endpoints exist beside it rather than instead of it. It dies
    // with public/app.js. The old diary now sends the version it last read
    // (staff diary piece), checked above when present, and every save through
    // this route bumps it - so it does take part in the optimistic-concurrency
    // contract even though it isn't routed through applyEvent.
    //
    // custody_state is left alone. The old status never expressed custody (Phase
    // 1: readLegacyStatus('complete') returns custody: null), so deriving one
    // here would reset a bike that is in the shop back to 'expected'.
    let legacyStates = null;
    if (body.status !== undefined) {
      const requested = resolveJobStatus(body.status, null);
      if (requested === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);
      const { booking, work: workState } = readLegacyStatus(requested);
      legacyStates = { booking, workState };
    }

    // A complete job is a record of work already done, so its details are
    // frozen - the browser disables every field on the form. Changing status
    // is the one edit that stays open, because that is how a job is reopened.
    // Was `existing.status === 'complete'`. The derived column now also reads
    // 'complete' for a cancelled, declined or expired booking, and freezing those
    // against edits is a behaviour change nobody asked for. This guard was always
    // about finished work.
    if (existing.work_state === 'complete') {
      const changesBeyondStatus =
        title !== existing.title ||
        jobDate !== existing.job_date ||
        notes !== existing.notes ||
        times.startTime !== existing.start_time ||
        times.endTime !== existing.end_time ||
        resolved.customerId !== existing.customer_id ||
        bikeResolved.bikeId !== existing.bike_id ||
        mechResolved.mechanicId !== existing.mechanic_id;
      if (changesBeyondStatus) {
        return badRequest(res, 'This job is complete - reopen it before making changes.');
      }
    }

    // Both days are locked: the one the job leaves and the one it joins, and the
    // day a customer asked to move to (piece 12). The UPDATE and its hold commit
    // or roll back together.
    let out;
    try {
      out = await withBookingLock([existing.job_date, jobDate, existing.requested_job_date].filter(Boolean), async () => {
        // A customer's change request (piece 12), read again under the lock.
        // The old diary knows nothing of requests and sends 'scheduled' for one,
        // so an ordinary save keeps it; dropping the job onto exactly the
        // requested time answers it - the change is accepted; a status that
        // takes the job anywhere else ends it. Request columns left on a job
        // that is no longer a request are cleared on any save.
        const current = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ? FOR UPDATE').get(id);
        if (body.version !== undefined && current && current.version !== body.version) return staleRefusal;

        const slotError = await checkJobSlot({
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          mechanicId: mechResolved.mechanicId,
          ignoreJobId: id,
        });
        if (slotError) return refusal(slotError.error);

        const request = current ? requestedOf(current) : null;
        let bookingState = legacyStates?.booking ?? null;
        let clearRequest = Boolean(current?.requested_job_date) && !request;
        if (request) {
          // Same day, start and mechanic answers the request whatever the
          // length (staff diary piece): the drop is the staff member's answer.
          const onRequested = jobDate === request.jobDate && times.startTime === request.startTime
            && mechResolved.mechanicId === request.mechanicId;
          if (onRequested && (bookingState === null || bookingState === 'scheduled')) {
            bookingState = 'scheduled';
            clearRequest = true;
          } else if (bookingState === 'scheduled') {
            bookingState = null;
          } else if (bookingState !== null) {
            clearRequest = true;
          }
        }

        await db.prepare(
          `UPDATE workshop_jobs SET title = ?, customer_id = ?, bike_id = ?, mechanic_id = ?, job_date = ?, start_time = ?, end_time = ?, notes = ?, planned_minutes = ?, updated_at = ?,
           version = version + 1,
           booking_state = COALESCE(?, booking_state), work_state = COALESCE(?, work_state)${clearRequest ? `, ${CLEAR_REQUEST}` : ''}
         WHERE id = ?`
        ).run(
          title,
          resolved.customerId,
          bikeResolved.bikeId,
          mechResolved.mechanicId,
          jobDate,
          times.startTime,
          times.endTime,
          notes,
          plannedMinutes,
          nowIso(),
          bookingState,
          legacyStates?.workState ?? null,
          id
        );
        await syncJobHold(id);
        const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
        return { status: 200, body: serializeWorkshopJob(row) };
      });
    } catch (err) {
      // Only a stale pre-2b hold can trip the 024 index for staff.
      if (err.code === '23505') out = capacityRefusal(SLOT_GONE);
      else throw err;
    }
    sendJson(res, out.status, out.body);
  });

  // ---------- Workshop job actions ----------
  //
  // One endpoint per thing a person does, not a status field on the job's PUT
  // (server/routes/workshop.js).
  // The URL names what happened, so the access log, the screen trace and any
  // future per-action permission all read the path instead of the body.
  //
  // Every one of these carries a `screens:` comment naming the screen designs it
  // serves. scripts/ci/assert-screen-trace.mjs fails the build if a workshop
  // route has no such comment or names an id that is not in screen-index.json -
  // the design's "an endpoint no screen consumes is not built" rule, made into a
  // check that runs rather than a promise in a document.
  function jobActionRoute(action, machine, event) {
    route('POST', `/api/workshop-jobs/:id/${action}`, async (req, res, params) => {
      const id = Number(params.id);
      const body = await readJsonBody(req);
      // The caller must say which version it saw. Defaulting it would turn every
      // racing write into a silent last-one-wins, which is the bug the version
      // column exists to prevent.
      if (!Number.isInteger(body.version)) {
        return badRequest(res, VERSION_REQUIRED);
      }
      // A customer's change request is answered with accept-change or
      // decline-change (piece 12): plain accept/decline would return the job to
      // scheduled without moving it or telling the customer.
      if (machine === bookingRequest && (event === 'accept' || event === 'decline')) {
        const current = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
        if (current && requestedOf(current)) {
          return sendJson(res, 409, {
            error: 'This booking has a change request from the customer - accept or decline the change instead', code: 'illegal',
          });
        }
      }
      const result = await applyEvent({ jobId: id, machine, event, expectedVersion: body.version });
      if (!result.ok) {
        if (result.code === 'not_found') return notFound(res, 'Job not found');
        // `code` is what a screen branches on: 'stale' means reload and look
        // again, 'illegal' means the move was never allowed and retrying cannot
        // help. The message is for people and may be reworded; the code may not.
        return sendJson(res, 409, { error: result.message, code: result.code });
      }
      if (machine === bookingRequest) {
        // No staff booking event keeps a customer's request (accept and decline
        // of one are refused above), so any request columns left on the job go -
        // a staff request_reschedule must never hold a time nobody checked
        // (piece 12). Only if nothing has written the job since this event: a
        // customer's request made after it is theirs to keep.
        await db.prepare(`UPDATE workshop_jobs SET ${CLEAR_REQUEST} WHERE id = ? AND version = ?`).run(id, result.job.version);
      }
      // A staff cancellation never shows in "Waiting for you" (piece 12), and
      // the link no longer speaks of a declined change.
      if (machine === bookingRequest && event === 'cancel') {
        await db.prepare(
          "UPDATE workshop_jobs SET cancelled_by = 'staff', cancelled_at = now(), change_declined_at = NULL WHERE id = ?"
        ).run(id);
      }
      // A hold that outlives its booking is capacity the diary is still promising
      // away, released in the same request rather than on a timer - but a
      // reschedule declined back onto a still-live booking (scheduled) must keep
      // its hold. syncJobHold decides from the job's current state, not from
      // which event fired, so it releases only when the job is no longer live
      // and otherwise keeps (or realigns) the one hold a live job holds.
      await syncJobHold(id);
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
      sendJson(res, 200, serializeWorkshopJob(row));
    });
  }

  // screens: requests, review
  jobActionRoute('accept', bookingRequest, 'accept');

  // screens: reject, rejected
  jobActionRoute('decline', bookingRequest, 'decline');

  // screens: reschedule, change-pending
  jobActionRoute('request-reschedule', bookingRequest, 'request_reschedule');

  // screens: cancel, cancelled
  jobActionRoute('cancel', bookingRequest, 'cancel');

  // screens: expired
  jobActionRoute('expire', bookingRequest, 'expire');

  // screens: change-pending, diary
  route('POST', '/api/workshop-jobs/:id/accept-change', async (req, res, params) =>
    answerChangeRequest(req, res, Number(params.id), 'accept'));

  // screens: change-pending, diary
  route('POST', '/api/workshop-jobs/:id/decline-change', async (req, res, params) =>
    answerChangeRequest(req, res, Number(params.id), 'decline'));

  // Staff saw a customer's cancellation (piece 12, decision 5): it leaves
  // "Waiting for you". Keeps the first time it was seen; still needs the version.
  // screens: cancelled, diary
  route('POST', '/api/workshop-jobs/:id/cancellation-seen', async (req, res, params) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const job = await db.prepare('SELECT id, cancelled_by FROM workshop_jobs WHERE id = ?').get(id);
    if (!job) return notFound(res, 'Job not found');
    if (job.cancelled_by !== 'customer') {
      return sendJson(res, 409, { error: "Only a customer's cancellation can be marked as seen", code: 'illegal' });
    }
    const { changes } = await db.prepare(
      `UPDATE workshop_jobs SET cancellation_seen_at = COALESCE(cancellation_seen_at, now()), version = version + 1, updated_at = now()
     WHERE id = ? AND version = ?`
    ).run(id, body.version);
    if (changes === 0) return sendJson(res, staleRefusal.status, staleRefusal.body);
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
    sendJson(res, 200, serializeWorkshopJob(row));
  });

  // "Waiting for you" (piece 12, decision 3): new online bookings (only the
  // portal sets terms_accepted_at), customers' change requests and customers'
  // cancellations not yet seen - oldest first by when each arrived.
  // screens: requests, diary
  route('GET', '/api/workshop-waiting', async (req, res) => {
    const rows = await db.prepare(
      `SELECT w.*, c.name AS customer_name, m.name AS mechanic_name, rm.name AS requested_mechanic_name,
            (SELECT coalesce(json_agg(s.name ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS service_names,
            (SELECT coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS services
     FROM workshop_jobs w
     LEFT JOIN customers c ON c.id = w.customer_id
     LEFT JOIN employees m ON m.id = w.mechanic_id
     LEFT JOIN employees rm ON rm.id = w.requested_mechanic_id
     WHERE (w.booking_state = 'pending' AND w.terms_accepted_at IS NOT NULL)
        OR (w.booking_state = 'reschedule_requested' AND w.requested_job_date IS NOT NULL)
        OR (w.booking_state = 'cancelled' AND w.cancelled_by = 'customer' AND w.cancellation_seen_at IS NULL)`
    ).all();
    const items = rows.map(waitingItem)
      .sort((a, b) => (new Date(a.arrivedAt) - new Date(b.arrivedAt)) || (a.jobId - b.jobId));
    sendJson(res, 200, { count: items.length, items });
  });

  // screens: intake, scan
  jobActionRoute('book-in', custody, 'book_in');

  // screens: collection, closed
  jobActionRoute('collect', custody, 'collect');

  // The action is reopen-custody, not reopen, because the work machine has a
  // reopen event too and they are different acts: one is a bike coming back
  // through the door, the other is a final check that failed. One URL for both
  // would be the same conflation the single status column produced.
  // screens: reopen
  jobActionRoute('reopen-custody', custody, 'reopen');

  // screens: queue, job-page
  jobActionRoute('start', work, 'start');

  // screens: waiting
  jobActionRoute('await-parts', work, 'await_parts');

  // screens: waiting
  jobActionRoute('parts-arrived', work, 'parts_arrived');

  // screens: job, waiting
  jobActionRoute('hold', work, 'hold');

  // screens: job, waiting
  jobActionRoute('resume', work, 'resume');

  // screens: finished, job-page
  jobActionRoute('finish', work, 'finish');

  // See reopen-custody above: a failed final check is not a bike coming back.
  // screens: reopen
  jobActionRoute('reopen-work', work, 'reopen');
}
