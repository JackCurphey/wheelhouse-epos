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
  CLEAR_REQUEST, SLOT_GONE, WORKSHOP_JOB_SELECT, capacityRefusal, checkJobSlot, createWorkshopJob,
  currentShopToday, parseWorkingDays, refusal, requestedOf, resolveJobMechanicId, resolveJobTimes,
  serializeWorkshopJob, syncJobHold, timeToMinutes, withBookingLock, withJobBookingLock,
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

export const VERSION_REQUIRED = 'version is required - send the version you last read';

// The words applyEvent uses for a lost race (server/workshop/transitions.js).
export const staleRefusal = {
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
}
