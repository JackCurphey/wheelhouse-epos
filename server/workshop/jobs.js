// The workshop helpers other areas call: booking, settings, sales and the
// dashboard as well as the workshop's own routes. Moved out of server.js
// unchanged (split plan §4.1, WP-0.4); jobs.js imports nothing from server.js.
// Reads run through the request's shop context (row-level security), as they
// did in server.js.
import { prepare, dbExec } from '../db.js';
import { sendJson, notFound } from '../lib/http.js';
import { LIVE_BOOKING_STATES, parseWeekdayHours } from '../capacity.js';
import { shopToday } from '../clock.js';
import { serializeQuote } from './quotes.js';

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
