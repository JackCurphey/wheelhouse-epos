// The workshop helpers other areas call: booking, settings, sales and the
// dashboard as well as the workshop's own routes. Moved out of server.js
// unchanged (split plan §4.1, WP-0.4); jobs.js imports nothing from server.js.
// Reads run through the request's shop context (row-level security), as they
// did in server.js.
import { prepare, dbExec } from '../db.js';
import { sendJson, notFound, nowIso } from '../lib/http.js';
import {
  LIVE_BOOKING_STATES, parseWeekdayHours, bookingLockKey, effectiveHours, computeCapacity, datesBetween,
} from '../capacity.js';
import { shopToday } from '../clock.js';
import { STANDARD_BOOKING_TERMS } from '../standard-terms.js';
import { serializeQuote } from './quotes.js';
import { bookingRequest } from './state-machines.js';
import { applyEvent } from './transitions.js';
import { allocateReference } from './references.js';

const db = { prepare, exec: dbExec };

// A customer's stored change request (piece 12). It counts only while the job
// is waiting on it: a route that moves the job out of reschedule_requested
// without clearing the columns (the old diary's status PUT, staff cancel)
// leaves them behind, and then they mean nothing.
export function requestedOf(row) {
  if (row.booking_state !== 'reschedule_requested' || !row.requested_job_date) return null;
  return {
    jobDate: row.requested_job_date,
    startTime: row.requested_start_time || '',
    endTime: row.requested_end_time || '',
    mechanicId: row.requested_mechanic_id,
  };
}

export function serializeWorkshopJob(row) {
  return {
    id: row.id,
    title: row.title,
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    bikeId: row.bike_id,
    bikeLabel: row.bike_label !== undefined ? row.bike_label : undefined,
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name !== undefined ? row.mechanic_name : undefined,
    jobDate: row.job_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    // The states the screens actually drive from. `status` above is the derived
    // legacy field, kept only for public/app.js and the online booking pages until
    // Phase 4 replaces them.
    reference: row.reference,
    bookingState: row.booking_state,
    custodyState: row.custody_state,
    workState: row.work_state,
    // Every action endpoint requires the version the caller last saw, so it has
    // to come back on every read.
    version: row.version,
    notes: row.notes,
    // The customer's answers to the service's questions, frozen at booking
    // (migration 028). Null for staff jobs, "not sure" and older bookings.
    questionAnswers: row.question_answers ?? null,
    // The customer's own words from the booking (piece 3), apart from the
    // notes they were also copied into - the review pop-up shows them alone.
    customerDescription: row.customer_description ?? null,
    customerBikeNote: row.customer_bike_note ?? null,
    // Piece 12: the customer's change request while it waits, and who
    // cancelled (a customer's shows in "Waiting for you" until seen).
    requested: requestedOf(row),
    cancelledBy: row.cancelled_by ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancellationSeenAt: row.cancellation_seen_at ?? null,
    changeDeclinedAt: row.change_declined_at ?? null,
    orderId: row.order_id,
    orderStatus: row.order_status,
    orderTotal: row.order_total,
    // The job's current quote (its latest revision), or null (journey 4).
    quote: row.quote_id ? { id: row.quote_id, state: row.quote_state, revision: row.quote_revision } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const WORKSHOP_JOB_SELECT = `SELECT w.*, lq.id AS quote_id, lq.state AS quote_state, lq.revision AS quote_revision, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label, mech.name AS mechanic_name, d.id AS order_id, d.status AS order_status, d.total AS order_total
  FROM workshop_jobs w
  LEFT JOIN customers c ON c.id = w.customer_id
  LEFT JOIN customer_bikes b ON b.id = w.bike_id
  LEFT JOIN employees mech ON mech.id = w.mechanic_id
  LEFT JOIN sale_documents d ON d.workshop_job_id = w.id
  LEFT JOIN LATERAL (SELECT id, state, revision FROM workshop_quotes q
                     WHERE q.workshop_job_id = w.id ORDER BY revision DESC LIMIT 1) lq ON true`;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function resolveJobMechanicId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, mechanicId: existingId };
  if (rawId === null || rawId === '') return { ok: true, mechanicId: null };
  const mechanicId = Number(rawId);
  const mechanic = await db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_mechanic = 1').get(mechanicId);
  if (!mechanic) return { ok: false };
  return { ok: true, mechanicId };
}

export function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// A job with a start time always gets an end time - defaulting to +1 hour
// keeps every scheduled job a draggable/resizable block on the diary grid.
export function resolveJobTimes(startTime, endTimeInput) {
  if (!startTime) return { startTime: '', endTime: '' };
  if (!TIME_RE.test(startTime)) return { error: 'Start time must be in HH:MM format' };
  let endTime = endTimeInput;
  if (!endTime) endTime = addMinutesToTime(startTime, 60);
  if (!TIME_RE.test(endTime)) return { error: 'End time must be in HH:MM format' };
  if (endTime <= startTime) return { error: 'End time must be after start time' };
  return { startTime, endTime };
}

// Clears a stored change request (piece 12).
export const CLEAR_REQUEST = `requested_job_date = NULL, requested_mechanic_id = NULL, requested_start_time = NULL,
  requested_end_time = NULL, requested_at = NULL`;

// A refusal because other bookings have used the time. The code is what a
// screen branches on; the words are what the old booking page shows.
export const capacityRefusal = (error) => ({ status: 409, body: { error, code: 'capacity' } });
export const refusal = (error) => ({ status: 400, body: { error } });
// The 024 hold index firing: another live hold already sits on the slot.
export const SLOT_GONE = 'That time is no longer available - please choose another.';

// One mapper so a single place decides that a refused move is 409 and a hidden
// row is 404.
export function sendQuoteResult(res, result, status = 200) {
  if (result.ok) return sendJson(res, status, serializeQuote(result.quote));
  if (result.code === 'not_found') return notFound(res, result.message);
  return sendJson(res, 409, { error: result.message, code: result.code });
}

export function parseWorkingDays(raw) {
  try {
    const days = JSON.parse(raw);
    if (Array.isArray(days)) return days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  } catch {
    // fall through to default
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

// The shop's today, on its own clock and time zone (server/clock.js). Reads
// the settings row through the request's shop context (row-level security).
export async function currentShopToday() {
  return shopToday(await currentShopTimeZone());
}

export async function currentShopTimeZone() {
  const row = await db.prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get();
  return row.time_zone;
}

// A workshop_settings row in the capacity calculator's shape (server/capacity.js).
export function toCapacitySettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    weekdayHours: parseWeekdayHours(row.weekday_hours),
    reserveMinutes: row.full_day_threshold_minutes,
    bookingMode: row.booking_mode,
    nextBookingMode: row.next_booking_mode ?? null,
    nextBookingModeFrom: row.next_booking_mode_from ?? null,
    dropoffWindowStart: row.dropoff_window_start,
    dropoffWindowEnd: row.dropoff_window_end,
    minNoticeMinutes: row.min_notice_minutes,
    timeZone: row.time_zone,
  };
}

export const LIVE_STATES_SQL = LIVE_BOOKING_STATES.map((s) => `'${s}'`).join(', ');

// Booking writes for one shop and date run one at a time: check, then write,
// with nothing between them. A transaction-scoped advisory lock keyed (shop,
// date), released at COMMIT or ROLLBACK. Several dates (a move) are locked in
// date order, so two moves between the same days cannot deadlock. Nested
// BEGIN/COMMIT inside fn (createWorkshopJob) becomes a savepoint (server/db.js).
export async function withBookingLock(dates, fn) {
  await db.exec('BEGIN');
  try {
    for (const date of [...new Set(dates)].sort()) {
      await db.prepare(
        "SELECT pg_advisory_xact_lock(current_setting('app.current_shop_id')::int, ?::int)"
      ).get(bookingLockKey(date));
    }
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (err) {
    // A failed ROLLBACK (e.g. the connection already dropped) must not hide
    // the original error - that's the one the caller needs to see.
    await db.exec('ROLLBACK').catch(() => {});
    throw err;
  }
}

// The booking lock for every day a job touches (piece 12): its own day, the
// day it asked to move to, and `extraDates` (where it is moving now). The days
// are read before the lock, so the job is read again under it - FOR UPDATE, so
// nothing else writes it until this commits - and if it moved in between, the
// lock is taken again for its new days. fn(job) returns a { status, body }
// refusal or undefined; this returns that, or { gone: true } when the job no
// longer exists.
const JOB_MOVED = Symbol('job moved');
export async function withJobBookingLock(jobId, extraDates, fn) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await db.prepare('SELECT job_date, requested_job_date FROM workshop_jobs WHERE id = ?').get(jobId);
    if (!before) return { gone: true };
    const dates = [before.job_date, before.requested_job_date, ...extraDates].filter(Boolean);
    const out = await withBookingLock(dates, async () => {
      const job = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ? FOR UPDATE').get(jobId);
      if (!job) return { gone: true };
      if (job.job_date !== before.job_date || job.requested_job_date !== before.requested_job_date) return JOB_MOVED;
      return fn(job);
    });
    if (out !== JOB_MOVED) return out;
  }
  throw new Error(`workshop job ${jobId} kept moving while its booking days were being locked`);
}

// A booking-state change on a job read FOR UPDATE under the lock: nothing can
// have moved it since, so a refusal here is a bug, not a race - it throws, and
// the whole write rolls back.
export async function applyLocked(job, event) {
  const moved = await applyEvent({ jobId: job.id, machine: bookingRequest, event, expectedVersion: job.version });
  if (!moved.ok) throw new Error(`job ${job.id}: ${event} refused under the booking lock: ${moved.message}`);
  return moved.job;
}

// A customer's requested time (piece 12) is held beside the job's own hold,
// marked purpose 'requested', while the job waits on the request: one live
// requested hold, on the requested slot. A request replaced by another lets
// the old slot go; a job that stops being a request lets it go. syncJobHold
// runs this first, so a requested slot is given up before the job's own hold
// may move onto it.
export async function syncRequestedHold(jobId) {
  const job = await db.prepare(
    `SELECT booking_state, requested_job_date, requested_mechanic_id, requested_start_time, requested_end_time, planned_minutes
     FROM workshop_jobs WHERE id = ?`
  ).get(jobId);
  const wanted = job && job.booking_state === 'reschedule_requested' && job.requested_job_date
    ? {
      jobDate: job.requested_job_date,
      // As for the job's own hold: an unassigned slot is counted, never slotted.
      startTime: job.requested_mechanic_id ? (job.requested_start_time || '') : '',
      mechanicId: job.requested_mechanic_id,
      minutes: job.requested_start_time
        ? Math.max(0, timeToMinutes(job.requested_end_time) - timeToMinutes(job.requested_start_time))
        : (job.planned_minutes || 0),
    }
    : null;
  const held = await db.prepare(
    `SELECT id, job_date, start_time, mechanic_id FROM workshop_capacity_holds
     WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed') ORDER BY id`
  ).all(jobId);
  const keep = wanted && held.find((h) =>
    h.job_date === wanted.jobDate && h.start_time === wanted.startTime && h.mechanic_id === wanted.mechanicId);
  for (const h of held) {
    if (h !== keep) await db.prepare("UPDATE workshop_capacity_holds SET state = 'released' WHERE id = ?").run(h.id);
  }
  if (wanted && !keep) {
    await db.prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state, purpose)
       VALUES (?, ?, ?, ?, ?, 'held', 'requested')`
    ).run(jobId, wanted.jobDate, wanted.startTime, wanted.mechanicId, wanted.minutes);
  }
}

// A job's capacity hold follows the job. One live hold per live job: an
// assigned job holds a timed slot at its start with its length; an unassigned
// job (no mechanic - drop-off, a walk-in, or a timed job nobody has taken yet)
// holds no slot, so its hold is untimed and carries only its length - the
// shared queue counts it, never a slot on the grid. A timed job's length
// still comes from its times regardless of assignment. A job that stops being
// live has its hold released. Called inside createWorkshopJob's transaction;
// the booking lock (Task 5) wraps the other writes. Only the job's own hold
// (purpose 'booking') - a requested slot's is syncRequestedHold's.
export async function syncJobHold(jobId) {
  await syncRequestedHold(jobId);
  const job = await db.prepare(
    'SELECT id, mechanic_id, job_date, start_time, end_time, planned_minutes, booking_state FROM workshop_jobs WHERE id = ?'
  ).get(jobId);
  if (!job || !LIVE_BOOKING_STATES.includes(job.booking_state)) {
    await db.prepare(
      `UPDATE workshop_capacity_holds SET state = 'released'
       WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')`
    ).run(jobId);
    return;
  }
  const startTime = job.start_time || '';
  const minutes = startTime
    ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(startTime))
    : (job.planned_minutes || 0);
  // An unassigned job's hold is untimed - the shared queue is counted, never slotted.
  const holdStartTime = job.mechanic_id ? startTime : '';
  const hold = await db.prepare(
    `SELECT id FROM workshop_capacity_holds
     WHERE workshop_job_id = ? AND purpose = 'booking' AND state IN ('held', 'confirmed') ORDER BY id LIMIT 1`
  ).get(jobId);
  if (hold) {
    await db.prepare(
      'UPDATE workshop_capacity_holds SET job_date = ?, start_time = ?, mechanic_id = ?, minutes = ? WHERE id = ?'
    ).run(job.job_date, holdStartTime, job.mechanic_id, minutes, hold.id);
  } else {
    await db.prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state)
       VALUES (?, ?, ?, ?, ?, 'held')`
    ).run(jobId, job.job_date, holdStartTime, job.mechanic_id, minutes);
  }
}

// Shared by the staff "create job" route below and the online booking pages'
// booking route (/api/portal/:shopSlug/bookings) - inserts the job plus its
// linked order in one transaction. Trusts every field completely; callers
// are responsible for validating/resolving them first (the portal route
// deliberately ignores anything the client sends for customerId/status and
// forces its own values, same principle as createSale() never trusting a
// client-sent total).
// Takes the three states, not a status: workshop_jobs.status is a generated
// column since migration 021 and Postgres refuses a direct write. Callers that
// still speak the old five-value vocabulary (the staff diary's POST, below)
// translate at the boundary with readLegacyStatus().
// Throws a pg unique-violation (code 23505) when another request already holds
// the slot. Callers map that to 409 - the request was well-formed and lost a
// race, which is not the same thing as being wrong.
export async function createWorkshopJob({ title, customerId, bikeId, mechanicId, jobDate, startTime, endTime, bookingState, workState, custodyState, notes, skipAutoOrder, plannedMinutes, termsAcceptedAt, serviceIds, linkTokenHash, customerDescription, customerBikeNote, questionAnswers, bookingRequestKeyHash, bookingRequestBodyHash }) {
  await db.exec('BEGIN');
  try {
    // Inside the transaction: a reference allocated for a job whose insert then
    // fails is a number spent for nothing, which is tolerable, but a reference
    // allocated outside and reused is not.
    const reference = await allocateReference();
    // The terms in force right now, for a booking that took consent
    // (termsAcceptedAt is only ever set by the portal booking route - a
    // staff-made job takes no terms consent and stores none). Read inside
    // this transaction so a later change to the shop's terms never rewrites
    // what an already-committed booking agreed to (piece 11).
    let termsText = null;
    if (termsAcceptedAt) {
      const settingsRow = await db.prepare('SELECT booking_terms FROM workshop_settings LIMIT 1').get();
      termsText = settingsRow?.booking_terms || STANDARD_BOOKING_TERMS;
    }
    const info = await db
      .prepare(
        `INSERT INTO workshop_jobs (title, customer_id, bike_id, mechanic_id, job_date, start_time, end_time, booking_state, work_state, custody_state, reference, notes, planned_minutes, terms_accepted_at, terms_text, link_token_hash, customer_description, customer_bike_note, question_answers, booking_request_key_hash, booking_request_body_hash, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)`
      )
      .run(
        title, customerId, bikeId, mechanicId, jobDate, startTime, endTime, bookingState, workState, custodyState, reference, notes,
        plannedMinutes ?? (startTime ? Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime)) : null),
        termsAcceptedAt ?? null,
        termsText,
        linkTokenHash ?? null, customerDescription ?? null, customerBikeNote ?? null,
        questionAnswers ? JSON.stringify(questionAnswers) : null,
        bookingRequestKeyHash ?? null, bookingRequestBodyHash ?? null,
        nowIso()
      );
    const jobIdForHold = info.lastInsertRowid;

    // One row per booked service, in the order chosen, each price copied in SQL
    // so it never passes through a JavaScript number (piece 7).
    for (const [position, serviceId] of (serviceIds ?? []).entries()) {
      await db.prepare(
        `INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position)
         VALUES (?, ?, (SELECT price FROM workshop_services WHERE id = ?), ?)`
      ).run(info.lastInsertRowid, serviceId, serviceId, position);
    }

    // Take the capacity hold in the same transaction as the job. checkJobSlot
    // above is a SELECT, so two requests can both pass it and both insert; the
    // partial unique index from migration 018 is what makes exactly one of them
    // win. Inside the transaction so the loser's job rolls back with its hold
    // rather than surviving as a booking for a slot it does not hold.
    await syncJobHold(jobIdForHold);
    const jobId = info.lastInsertRowid;

    // Every workshop job is backed by an order so it's findable from the
    // Orders page, unless the caller already has an order it's about to link
    // this job to itself (the order's "show in workshop diary" toggle).
    if (!skipAutoOrder) {
      await db.prepare(
        `INSERT INTO sale_documents (kind, customer_id, subtotal, discount, total, note, title, workshop_job_id, updated_at)
         VALUES ('order', ?, 0, 0, 0, ?, ?, ?, ?)`
      ).run(customerId, notes, title, jobId, nowIso());
    }

    await db.exec('COMMIT');
    return jobId;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

// The diary's scheduling rules, enforced server-side.
//
// These lived only in public/app.js, which made them suggestions: the browser
// greys out a closed Sunday, but a raw POST scheduled one anyway. Both the
// staff routes and the portal booking route go through here now, so there is
// one implementation of "is this slot legal" rather than three that drift.
//
// Returns null when the slot is fine, or { error, taken } - taken means another
// live booking holds the time. `ignoreJobId` is the job being edited - a job
// must not collide with itself.
export async function checkJobSlot({ jobDate, startTime, endTime, mechanicId, ignoreJobId = null }) {
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  if (!settings) return null;

  // getUTCDay() rather than getDay(): job_date is a bare calendar date with
  // no timezone, and parsing it locally would shift the weekday for anyone
  // west of UTC.
  const dayOfWeek = new Date(`${jobDate}T00:00:00Z`).getUTCDay();
  const openingDays = parseWorkingDays(settings.opening_days);
  if (Array.isArray(openingDays) && !openingDays.includes(dayOfWeek)) {
    return { error: 'The shop is closed that day - please choose another date.', taken: false };
  }

  // A mechanic's own days off are separate from the shop's closing days - a
  // part-timer can be off on a Monday the shop is open. Checked before the
  // times, because a day off rules out the whole day regardless of hours.
  if (mechanicId) {
    const mechanic = await db.prepare('SELECT working_days FROM employees WHERE id = ?').get(mechanicId);
    const workingDays = mechanic ? parseWorkingDays(mechanic.working_days) : null;
    if (Array.isArray(workingDays) && !workingDays.includes(dayOfWeek)) {
      return { error: 'That mechanic does not work that day - please choose another day or another mechanic.', taken: false };
    }
  }

  // A job with no times is a loose "sometime that day" entry - it occupies no
  // slot, so there is nothing to check it against.
  if (!startTime || !endTime) return null;

  // The day's own hours - Saturday may close earlier than the week.
  const hours = effectiveHours(toCapacitySettings(settings), dayOfWeek);
  if (startTime < hours.open || endTime > hours.close) {
    return { error: `That job doesn't fit in the shop's opening hours (${hours.open}\u2013${hours.close}) - please choose an earlier time or a shorter job type.`, taken: false };
  }

  if (!mechanicId) return null;
  // A customer's requested time (piece 12) is held like a booking until staff
  // answer, so it is an overlap too - except for the job that asked for it.
  const overlap = await db
    .prepare(
      `SELECT w.id FROM workshop_job_parts p JOIN workshop_jobs w ON w.id = p.workshop_job_id
       WHERE p.mechanic_id = ? AND p.part_date = ? AND p.start_time IS NOT NULL AND p.start_time != ''
       AND p.start_time < ? AND p.end_time > ? AND (?::int IS NULL OR w.id != ?::int)
       AND w.booking_state IN (${LIVE_STATES_SQL})
       UNION ALL
       SELECT id FROM workshop_jobs
       WHERE requested_mechanic_id = ? AND requested_job_date = ? AND requested_start_time <> ''
       AND requested_start_time < ? AND requested_end_time > ? AND (?::int IS NULL OR id != ?::int)
       AND booking_state = 'reschedule_requested'
       LIMIT 1`
    )
    .get(mechanicId, jobDate, endTime, startTime, ignoreJobId, ignoreJobId,
      mechanicId, jobDate, endTime, startTime, ignoreJobId, ignoreJobId);
  if (overlap) {
    return { error: 'That mechanic is already booked over part of that window - please choose another time.', taken: true };
  }
  return null;
}

export function toBlock(row) {
  return {
    id: row.id,
    mechanicId: row.employee_id ?? null,
    kind: row.kind,
    weekdays: row.weekdays ? JSON.parse(row.weekdays) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
  };
}

export function toCapacityJob(row) {
  return {
    id: row.id,
    mechanicId: row.mechanic_id ?? null,
    jobDate: row.job_date,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    plannedMinutes: row.planned_minutes ?? null,
  };
}

// Everything the capacity calculator needs for a date range, read inside the
// request's shop context. Every active mechanic, even when a caller wants one:
// the walk-in queue is split across everyone working. `ignoreJobId` leaves one
// job's own booking and request out - a change is never counted against the
// booking it changes (piece 12).
export async function loadCapacity(start, end, { ignoreJobId = null } = {}) {
  const settings = toCapacitySettings(await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get());
  const mechanics = (await db.prepare(
    'SELECT id, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name'
  ).all()).map((m) => ({ id: m.id, workingDays: parseWorkingDays(m.working_days) }));
  const blocks = (await db.prepare(
    `SELECT * FROM workshop_unavailability WHERE kind = 'weekly' OR (start_date <= ? AND end_date >= ?)`
  ).all(end, start)).map(toBlock);
  // One row per day a job is worked (its parts), so a job's second day takes
  // that mechanic's time too. Only part 1 speaks for untimed planned minutes.
  const jobs = (await db.prepare(
    `SELECT w.id, p.mechanic_id, p.part_date AS job_date, p.start_time, p.end_time,
            CASE WHEN p.position = 1 THEN w.planned_minutes END AS planned_minutes
       FROM workshop_job_parts p JOIN workshop_jobs w ON w.id = p.workshop_job_id
      WHERE p.part_date >= ? AND p.part_date <= ? AND w.booking_state IN (${LIVE_STATES_SQL})
        AND (?::int IS NULL OR w.id <> ?::int)`
  ).all(start, end, ignoreJobId, ignoreJobId)).map(toCapacityJob);
  // A customer's requested time (piece 12) takes capacity like a booking while
  // staff decide, so nobody else is offered it. Tagged `requested` so a job is
  // only ever listed once, and only for its own slot, among a block's clashes.
  jobs.push(...(await db.prepare(
    `SELECT id, requested_mechanic_id AS mechanic_id, requested_job_date AS job_date,
            requested_start_time AS start_time, requested_end_time AS end_time, planned_minutes
     FROM workshop_jobs
     WHERE booking_state = 'reschedule_requested' AND requested_job_date >= ? AND requested_job_date <= ?
       AND (?::int IS NULL OR id <> ?::int)`
  ).all(start, end, ignoreJobId, ignoreJobId)).map((r) => ({ ...toCapacityJob(r), requested: true })));
  const days = computeCapacity({ settings, mechanics, blocks, jobs, dates: datesBetween(start, end) });
  return { settings, blocks, jobs, days };
}
