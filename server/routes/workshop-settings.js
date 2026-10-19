// Workshop settings (Settings > Workshop): opening hours and booking rules,
// days off and closures, capacity, and the service catalogue with its
// categories. /api/workshop-settings, /api/workshop-unavailability,
// /api/workshop-capacity, /api/workshop-service-categories and
// /api/workshop-services, with the helpers only they use. Staff routes: they
// run under the dispatcher's /api/ branch (server.js), so a handler gets
// (req, res, params, query, afterRelease, shopId) with the shop's row-level
// security already bound, and needs a staff session. Mark's file; a change to
// what the diary or New job receives needs Jack's approval (#180, 15 Oct).
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { ownerOnly } from '../lib/owner-only.js';
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { MAX_SERIAL } from '../lib/uploads.js';
import {
  HOUR_RE, MAX_RANGE_DAYS, isRealDate, dayCount, parseWeekdayHours, openingHoursFor, resolveOpeningHours,
  validateBlock, blockClashes, toHHMM, settleModeChange, validateModeChange, resolveWorkingDays,
} from '../capacity.js';
import { isKnownTimeZone, shopToday } from '../clock.js';
import { readServiceQuestions } from '../service-questions.js';
import {
  TIME_RE, LIVE_STATES_SQL, currentShopToday, parseWorkingDays, toCapacitySettings, toBlock, toCapacityJob, loadCapacity,
} from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };
// ---------- Workshop settings ----------

function serializeWorkshopSettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    // Every open day with its hours - its own where the shop set them, else
    // the usual opening/closing time above.
    openingHours: openingHoursFor(toCapacitySettings(row)),
    fullDayThresholdMinutes: row.full_day_threshold_minutes,
    // Today's mode: a scheduled change whose date has arrived counts as made,
    // even before a save writes it into booking_mode.
    ...settleModeChange(toCapacitySettings(row), shopToday(row.time_zone)),
    dropoffWindowStart: row.dropoff_window_start,
    dropoffWindowEnd: row.dropoff_window_end,
    timedLeadMinutes: row.timed_lead_minutes,
    unspecifiedJobMinutes: row.unspecified_job_minutes,
    minNoticeMinutes: row.min_notice_minutes,
    // Notice in whole days, or null for hours (Jack, 19 Oct; migration 044).
    minNoticeDays: row.min_notice_days ?? null,
    timeZone: row.time_zone,
    // INTEGER 0/1 in the column, boolean over the wire - the client renders
    // it directly, same shape serializeWorkshopService uses for `active`.
    showPricesOnline: row.show_prices_online === 1,
    // "Show who signed off to customers" (mechanic sign-off answer 3; Jack, 18 Oct).
    showSignOffToCustomers: row.show_sign_off_to_customers === 1,
    // null: this shop has no terms of its own, so the standard Wheelhouse
    // terms (server/standard-terms.js) apply (piece 11).
    bookingTerms: row.booking_terms ?? null,
    updatedAt: row.updated_at,
  };
}

// ---------- Workshop unavailability (lunch, leave, closures) ----------
// Blocks take time away from what customers can book. They never refuse or
// move a staff booking (4 Sep decision §7.7): adding one reports the live
// bookings it clashes with, and staff decide what to do.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

// Live bookings a block overlaps, from today on - a block's past is history.
async function clashesFor(block) {
  const today = await currentShopToday();
  const from = block.kind === 'dates' && block.startDate > today ? block.startDate : today;
  // Every day of a job (its parts), so a block over a job's second day finds it.
  let sql = `SELECT w.id, w.reference, w.title, p.mechanic_id, p.part_date AS job_date, p.start_time, p.end_time,
      CASE WHEN p.position = 1 THEN w.planned_minutes END AS planned_minutes
    FROM workshop_job_parts p JOIN workshop_jobs w ON w.id = p.workshop_job_id
    WHERE p.part_date >= ? AND w.booking_state IN (${LIVE_STATES_SQL})`;
  const args = [from];
  if (block.kind === 'dates') {
    sql += ' AND p.part_date <= ?';
    args.push(block.endDate);
  }
  const rows = await db.prepare(`${sql} ORDER BY p.part_date, p.start_time`).all(...args);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return blockClashes(block, rows.map(toCapacityJob)).map((j) => ({
    id: j.id,
    reference: byId.get(j.id).reference,
    title: byId.get(j.id).title,
    mechanicId: j.mechanicId,
    jobDate: j.jobDate,
    startTime: j.startTime,
    endTime: j.endTime,
  }));
}

// Through the shop-scoped db: a foreign key check bypasses row-level security,
// so another shop's mechanic id must be refused here, not by the constraint.
async function blockMechanicExists(mechanicId) {
  if (mechanicId === null) return true;
  return !!(await db.prepare('SELECT id FROM employees WHERE id = ? AND is_mechanic = 1').get(mechanicId));
}

// ---------- Workshop service categories ----------
// One level deep (Jack, 24 Sep): a category holds individual services, never
// other categories. Full services carry no category. Deleting a category moves
// its services to uncategorised (ON DELETE SET NULL in migration 022).
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md

function serializeServiceCategory(row) {
  return { id: row.id, name: row.name, position: row.position };
}

// Shared by POST and PUT; `existing` is null on POST. An omitted field keeps
// its stored value on PUT.
function readCategoryBody(body, existing) {
  const name = body.name !== undefined ? String(body.name).trim() : (existing ? existing.name : '');
  if (!name) throw new ValidationError('A category needs a name');
  let position = existing ? existing.position : 0;
  if (body.position !== undefined) {
    position = Number(body.position);
    if (!Number.isInteger(position) || position < -MAX_SERIAL - 1 || position > MAX_SERIAL) {
      throw new ValidationError('Position must be a whole number');
    }
  }
  return { name, position };
}

// ---------- Workshop services (the fixed-price labour catalogue) ----------

export function serializeWorkshopService(row, includes = []) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    minutes: row.minutes,
    // active is INTEGER 0/1 on this table, matching products.active.
    active: row.active === 1,
    // Whether a customer may book this service themselves. The catalogue is
    // written in mechanic language and organised by work performed; only the
    // subset a shop ticks belongs in front of a customer. See
    // docs/decisions/2026-09-04-booking-mode-and-downtime.md §7.
    bookableOnline: row.bookable_online === 1,
    // Where the customer booking page lists it: 'full' services in a short
    // list of their own, 'individual' ones under their category (or "Other"
    // when uncategorised). One level deep; see migration 022.
    kind: row.kind,
    categoryId: row.category_id,
    position: row.position,
    // Ordered; each { id, wording, kind, required, choices?, allowNotSure? }.
    // See server/service-questions.js and migration 028.
    questions: row.questions ?? [],
    // Ordered ids of the individual services a full service includes,
    // removed ones too (a future staff screen marks them). Always [] for an
    // individual service. See migration 031.
    includes,
  };
}

// Shared by POST and PUT. Throws ValidationError so both callers translate it
// the same way.
function readServiceBody(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new ValidationError('A service needs a name');
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) throw new ValidationError('A service needs a price of zero or more');
  let minutes = null;
  if (body.minutes !== undefined && body.minutes !== null && body.minutes !== '') {
    minutes = Math.trunc(Number(body.minutes));
    if (!Number.isFinite(minutes) || minutes <= 0) throw new ValidationError('Duration must be a positive number of minutes');
  }
  return { name, price, minutes };
}

// Where a service sits in the customer's list. `existing` is null on POST; on
// PUT an omitted field keeps its stored value, so a caller that predates these
// fields (the old staff app) cannot wipe them. A category id is looked up
// through the shop-scoped db first: the foreign key alone bypasses row-level
// security and would accept another shop's category.
async function readServicePlacement(body, existing) {
  const kind = body.kind !== undefined ? body.kind : (existing ? existing.kind : 'individual');
  if (kind !== 'full' && kind !== 'individual') {
    throw new ValidationError("A service's kind must be 'full' or 'individual'");
  }
  let categoryId = body.categoryId !== undefined ? body.categoryId : (existing ? existing.category_id : null);
  if (kind === 'full') {
    categoryId = null;
  } else if (categoryId === '') {
    // An empty form dropdown - treat exactly like null (uncategorised).
    categoryId = null;
  } else if (categoryId !== null) {
    categoryId = Number(categoryId);
    const valid = Number.isInteger(categoryId) && categoryId >= 1 && categoryId <= MAX_SERIAL;
    const found = valid
      ? await db.prepare('SELECT id FROM workshop_service_categories WHERE id = ?').get(categoryId)
      : null;
    if (!found) throw new ValidationError('That category does not exist');
  }
  let position = existing ? existing.position : 0;
  if (body.position !== undefined) {
    position = Number(body.position);
    if (!Number.isInteger(position) || position < -MAX_SERIAL - 1 || position > MAX_SERIAL) {
      throw new ValidationError('Position must be a whole number');
    }
  }
  return { kind, categoryId, position };
}

// A service's questions, saved as one whole list. Omitted on PUT keeps the
// stored list, like the placement fields above.
function readQuestionsOrKeep(body, stored) {
  if (body.questions === undefined) return stored;
  const r = readServiceQuestions(body.questions, stored);
  if (r.error) throw new ValidationError(r.error);
  return r.value;
}

const MAX_INCLUDES = 50;

// A full service's included services, saved as one whole ordered list.
// `kind` is the service's kind after this save; `stored` the saved ids (null
// on POST). `selfId`/`selfName` identify the service being saved (null on
// POST, since it has no id yet) so it can be refused as its own include -
// migration 031's CHECK would otherwise reject that as a database error
// (500) rather than a clean 400, and on PUT the lookup below runs before the
// UPDATE that changes this service's own kind, so a currently-individual
// service promoting itself would otherwise look like a valid individual
// service to include. Omitted keeps the stored list, as questions and
// placement do, so a caller that predates the field cannot wipe it - except
// that an individual service never includes anything. Each id is looked up
// through the shop-scoped db: the foreign key alone bypasses row-level
// security and would accept another shop's service.
async function readIncludes(body, kind, stored, selfId, selfName) {
  if (body.includes === undefined) return kind === 'full' ? (stored ?? []) : [];
  const ids = body.includes;
  if (!Array.isArray(ids)) throw new ValidationError('That service does not exist');
  if (kind !== 'full') {
    if (ids.length > 0) throw new ValidationError('Only a full service can include other services');
    return [];
  }
  if (ids.length > MAX_INCLUDES) throw new ValidationError(`A full service can include at most ${MAX_INCLUDES} services`);
  if (new Set(ids).size !== ids.length) throw new ValidationError("A service can't be included twice");
  if (selfId !== null && ids.includes(selfId)) throw new ValidationError(`${selfName} is not an individual service`);
  for (const id of ids) {
    const found = Number.isInteger(id) && id >= 1 && id <= MAX_SERIAL
      ? await db.prepare('SELECT name, kind FROM workshop_services WHERE id = ?').get(id)
      : null;
    if (!found) throw new ValidationError('That service does not exist');
    if (found.kind !== 'individual') throw new ValidationError(`${found.name} is not an individual service`);
  }
  return ids;
}

// Replaces a service's list whole. Callers run it inside their transaction.
async function replaceIncludes(serviceId, ids) {
  await db.prepare('DELETE FROM workshop_service_includes WHERE service_id = ?').run(serviceId);
  for (const [position, id] of ids.entries()) {
    await db.prepare(
      'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, ?)'
    ).run(serviceId, id, position);
  }
}

// Ordered included ids for every service that has any, as Map<serviceId, id[]>.
async function loadIncludes() {
  const rows = await db.prepare(
    'SELECT service_id, included_service_id FROM workshop_service_includes ORDER BY service_id, position'
  ).all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.service_id)) map.set(r.service_id, []);
    map.get(r.service_id).push(r.included_service_id);
  }
  return map;
}

export function register(route) {
  // One row per shop (RLS scopes it), rather than the old global single-row
  // (id=1) singleton - a shop's id is assigned by Postgres, not fixed at 1, so
  // lookups just take whichever single row RLS makes visible.
  // screens: booking-settings, hours
  route('GET', '/api/workshop-settings', async (req, res) => {
    const row = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    sendJson(res, 200, serializeWorkshopSettings(row));
  });

  // screens: booking-settings, hours
  route('PUT', '/api/workshop-settings', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const existing = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    const body = await readJsonBody(req);
    const openingTime = body.openingTime !== undefined ? String(body.openingTime).trim() : existing.opening_time;
    const closingTime = body.closingTime !== undefined ? String(body.closingTime).trim() : existing.closing_time;
    if (!HOUR_RE.test(openingTime) || !HOUR_RE.test(closingTime)) {
      return badRequest(res, 'Opening and closing times must be on the hour (e.g. 09:00)');
    }
    if (closingTime <= openingTime) return badRequest(res, 'Closing time must be after opening time');
    const openingDays = resolveWorkingDays(body.openingDays, existing.opening_days);
    if (openingDays === null) return badRequest(res, 'openingDays must be an array of day numbers (0-6)');
    // openingHours sets which days are open and each day's hours at once. The
    // old fields still work: openingTime/closingTime move the usual hours, and a
    // day with its own hours keeps them, so the old settings page (which sends
    // openingTime on every save) never wipes a shorter Saturday.
    let openingDaysJson = openingDays;
    let weekdayHours = parseWeekdayHours(existing.weekday_hours);
    if (body.openingHours !== undefined) {
      if (body.openingDays !== undefined) return badRequest(res, 'Send openingHours or openingDays, not both');
      const resolved = resolveOpeningHours(body.openingHours, { openingTime, closingTime });
      if (resolved.error) return badRequest(res, resolved.error);
      openingDaysJson = JSON.stringify(resolved.openingDays);
      weekdayHours = resolved.weekdayHours;
    }
    // A closed day keeps no hours of its own, so re-opening it starts from the usual ones.
    const openNow = JSON.parse(openingDaysJson);
    weekdayHours = Object.fromEntries(Object.entries(weekdayHours).filter(([w]) => openNow.includes(Number(w))));
    let fullDayThresholdMinutes = existing.full_day_threshold_minutes;
    if (body.fullDayThresholdMinutes !== undefined) {
      fullDayThresholdMinutes = Number(body.fullDayThresholdMinutes);
      if (!Number.isInteger(fullDayThresholdMinutes) || fullDayThresholdMinutes < 0 || fullDayThresholdMinutes > 480) {
        return badRequest(res, 'The full-day threshold must be a whole number of minutes between 0 and 480');
      }
    }

    // The shop's time zone first: it decides which date is today below.
    const timeZone = body.timeZone !== undefined ? body.timeZone : existing.time_zone;
    if (!isKnownTimeZone(timeZone)) return badRequest(res, "That time zone isn't recognised");

    // A scheduled change whose date has arrived is written into booking_mode
    // now, so the next schedule never overwrites a change that already happened.
    const today = shopToday(timeZone);
    const settled = settleModeChange(toCapacitySettings(existing), today);
    const bookingMode = body.bookingMode !== undefined ? String(body.bookingMode).trim() : settled.bookingMode;
    if (bookingMode !== 'timed' && bookingMode !== 'dropoff') {
      return badRequest(res, "Booking mode must be either 'timed' or 'dropoff'");
    }
    let nextMode = { nextBookingMode: settled.nextBookingMode, nextBookingModeFrom: settled.nextBookingModeFrom };
    if (body.nextBookingMode !== undefined || body.nextBookingModeFrom !== undefined) {
      nextMode = validateModeChange(
        { nextBookingMode: body.nextBookingMode ?? null, nextBookingModeFrom: body.nextBookingModeFrom ?? null },
        { today, bookingMode },
      );
      if (nextMode.error) return badRequest(res, nextMode.error);
    }
    // Setting bookingMode straight to the already-scheduled mode makes the
    // schedule self-contradictory (booking_mode and next_booking_mode equal);
    // clear it rather than leave a dangling future date.
    if (nextMode.nextBookingMode === bookingMode) {
      nextMode = { nextBookingMode: null, nextBookingModeFrom: null };
    }

    const dropoffWindowStart = body.dropoffWindowStart !== undefined
      ? String(body.dropoffWindowStart).trim() : existing.dropoff_window_start;
    const dropoffWindowEnd = body.dropoffWindowEnd !== undefined
      ? String(body.dropoffWindowEnd).trim() : existing.dropoff_window_end;
    if (!TIME_RE.test(dropoffWindowStart) || !TIME_RE.test(dropoffWindowEnd)) {
      return badRequest(res, 'Drop-off window times must look like 09:00');
    }
    if (dropoffWindowEnd <= dropoffWindowStart) {
      return badRequest(res, 'The drop-off window must end after it starts');
    }

    let timedLeadMinutes = existing.timed_lead_minutes;
    if (body.timedLeadMinutes !== undefined) {
      timedLeadMinutes = Number(body.timedLeadMinutes);
      if (!Number.isInteger(timedLeadMinutes) || timedLeadMinutes < 0 || timedLeadMinutes > 240) {
        return badRequest(res, 'The arrival lead time must be a whole number of minutes between 0 and 240');
      }
    }

    let unspecifiedJobMinutes = existing.unspecified_job_minutes;
    if (body.unspecifiedJobMinutes !== undefined) {
      unspecifiedJobMinutes = Number(body.unspecifiedJobMinutes);
      if (!Number.isInteger(unspecifiedJobMinutes) || unspecifiedJobMinutes <= 0 || unspecifiedJobMinutes > 480) {
        return badRequest(res, 'The not-sure duration must be a whole number of minutes between 1 and 480');
      }
    }

    let minNoticeDays = existing.min_notice_days ?? null;
    if (body.minNoticeDays !== undefined) {
      minNoticeDays = body.minNoticeDays;
      // Up to 28: the booking page shows dates to the end of next month (fresh review).
      if (minNoticeDays !== null && !(Number.isInteger(minNoticeDays) && minNoticeDays >= 1 && minNoticeDays <= 28)) {
        return badRequest(res, 'Notice in days must be a whole number from 1 to 28');
      }
    }
    let minNoticeMinutes = existing.min_notice_minutes;
    if (body.minNoticeMinutes !== undefined) {
      // A number sent as text is accepted, as the fields above; null is refused
      // rather than read as 0 (no notice at all).
      minNoticeMinutes = body.minNoticeMinutes === null ? NaN : Number(body.minNoticeMinutes);
      if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 10080) {
        return badRequest(res, 'Minimum notice must be between 0 minutes and 7 days');
      }
    }

    const showPricesOnline = body.showPricesOnline === undefined
      ? existing.show_prices_online : (body.showPricesOnline ? 1 : 0);
    const showSignOff = body.showSignOffToCustomers === undefined
      ? existing.show_sign_off_to_customers : (body.showSignOffToCustomers ? 1 : 0);

    // A shop's own terms, or null to use the standard ones (piece 11). A
    // string is trimmed; null or an empty/blank string reverts to standard;
    // omitted keeps whatever is stored.
    let bookingTerms = existing.booking_terms;
    if (body.bookingTerms !== undefined) {
      if (body.bookingTerms === null) {
        bookingTerms = null;
      } else if (typeof body.bookingTerms === 'string') {
        const trimmed = body.bookingTerms.trim();
        if (trimmed.length > 20000) return badRequest(res, 'Booking terms can be up to 20,000 characters');
        bookingTerms = trimmed.length === 0 ? null : trimmed;
      } else {
        return badRequest(res, 'Booking terms must be text');
      }
    }

    await db.prepare(
      `UPDATE workshop_settings SET opening_time = ?, closing_time = ?, opening_days = ?, weekday_hours = ?,
         full_day_threshold_minutes = ?, booking_mode = ?, next_booking_mode = ?, next_booking_mode_from = ?,
         dropoff_window_start = ?,
         dropoff_window_end = ?, timed_lead_minutes = ?, unspecified_job_minutes = ?,
         min_notice_minutes = ?, min_notice_days = ?, time_zone = ?,
         show_prices_online = ?, show_sign_off_to_customers = ?, booking_terms = ?, updated_at = ? WHERE id = ?`
    ).run(openingTime, closingTime, openingDaysJson, JSON.stringify(weekdayHours), fullDayThresholdMinutes, bookingMode,
          nextMode.nextBookingMode, nextMode.nextBookingModeFrom,
          dropoffWindowStart, dropoffWindowEnd, timedLeadMinutes, unspecifiedJobMinutes,
          minNoticeMinutes, minNoticeDays, timeZone,
          showPricesOnline, showSignOff, bookingTerms, nowIso(), existing.id);
    const row = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    sendJson(res, 200, serializeWorkshopSettings(row));
  });

  // screens: hours, diary, week, month
  route('GET', '/api/workshop-unavailability', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    let rows;
    if (start || end) {
      if (!isRealDate(start || '') || !isRealDate(end || '')) return badRequest(res, 'Give both start and end dates, or neither');
      rows = await db.prepare(
        `SELECT * FROM workshop_unavailability
         WHERE kind = 'weekly' OR (start_date <= ? AND end_date >= ?) ORDER BY id`
      ).all(end, start);
    } else {
      rows = await db.prepare('SELECT * FROM workshop_unavailability ORDER BY id').all();
    }
    sendJson(res, 200, { blocks: rows.map(toBlock) });
  });

  // screens: hours
  route('POST', '/api/workshop-unavailability', async (req, res) => {
    const checked = validateBlock(await readJsonBody(req));
    if (checked.error) return badRequest(res, checked.error);
    const b = checked.block;
    if (!(await blockMechanicExists(b.mechanicId))) return notFound(res, 'Mechanic not found');
    const { lastInsertRowid } = await db.prepare(
      `INSERT INTO workshop_unavailability (employee_id, kind, weekdays, start_date, end_date, start_time, end_time, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(b.mechanicId, b.kind, b.weekdays ? JSON.stringify(b.weekdays) : null,
          b.startDate, b.endDate, b.startTime, b.endTime, b.reason);
    const block = toBlock(await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(lastInsertRowid));
    sendJson(res, 201, { block, clashes: await clashesFor(block) });
  });

  // screens: hours
  route('PUT', '/api/workshop-unavailability/:id', async (req, res, params) => {
    const row = await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(Number(params.id));
    if (!row) return notFound(res, 'Block not found');
    const body = await readJsonBody(req);
    const checked = validateBlock({ ...toBlock(row), ...body });
    if (checked.error) return badRequest(res, checked.error);
    const b = checked.block;
    if (!(await blockMechanicExists(b.mechanicId))) return notFound(res, 'Mechanic not found');
    await db.prepare(
      `UPDATE workshop_unavailability SET employee_id = ?, kind = ?, weekdays = ?, start_date = ?, end_date = ?,
         start_time = ?, end_time = ?, reason = ?, updated_at = now() WHERE id = ?`
    ).run(b.mechanicId, b.kind, b.weekdays ? JSON.stringify(b.weekdays) : null,
          b.startDate, b.endDate, b.startTime, b.endTime, b.reason, row.id);
    const block = toBlock(await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(row.id));
    sendJson(res, 200, { block, clashes: await clashesFor(block) });
  });

  // screens: hours
  route('DELETE', '/api/workshop-unavailability/:id', async (req, res, params) => {
    const row = await db.prepare('SELECT id FROM workshop_unavailability WHERE id = ?').get(Number(params.id));
    if (!row) return notFound(res, 'Block not found');
    await db.prepare('DELETE FROM workshop_unavailability WHERE id = ?').run(row.id);
    sendJson(res, 200, { ok: true });
  });

  // The calculator's full answer for staff: reasons, clashes and minutes
  // included. Read by the diary, queue, week, month and hours screens.
  // screens: diary, queue, week, month, hours
  route('GET', '/api/workshop-capacity', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    if (!isRealDate(start || '') || !isRealDate(end || '')) {
      return badRequest(res, 'Valid start and end dates are required');
    }
    if (end < start) return badRequest(res, 'The end date must be on or after the start date');
    if (dayCount(start, end) > MAX_RANGE_DAYS) {
      return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    }
    const { blocks, jobs, days } = await loadCapacity(start, end);
    const range = ([s, e]) => ({ start: toHHMM(s), end: toHHMM(e) });
    sendJson(res, 200, {
      days: days.map((day) => {
        const dayJobs = jobs.filter((j) => j.jobDate === day.date && !j.requested);
        const clashes = blocks.flatMap((b) => blockClashes(b, dayJobs).map((j) => ({ jobId: j.id, blockId: b.id })));
        return {
          date: day.date,
          mode: day.mode,
          shopClosed: day.shopClosed,
          closures: day.shopBlocks,
          queueMinutes: day.queueMinutes,
          clashes,
          mechanics: day.mechanics.map((m) => ({
            mechanicId: m.mechanicId,
            working: m.working,
            freeMinutes: Math.max(0, Math.floor(m.freeMinutes)),
            freeWindows: m.freeWindows.map(range),
            blocks: m.blocks,
          })),
        };
      }),
    });
  });

  // screens: services, service-edit
  route('GET', '/api/workshop-service-categories', async (req, res) => {
    const rows = await db.prepare('SELECT * FROM workshop_service_categories ORDER BY position, name').all();
    sendJson(res, 200, rows.map(serializeServiceCategory));
  });

  // screens: services, service-edit
  route('POST', '/api/workshop-service-categories', async (req, res) => {
    const body = await readJsonBody(req);
    let fields;
    try {
      fields = readCategoryBody(body, null);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    const info = await db.prepare('INSERT INTO workshop_service_categories (name, position) VALUES (?, ?)')
      .run(fields.name, fields.position);
    const row = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeServiceCategory(row));
  });

  // screens: services, service-edit
  route('PUT', '/api/workshop-service-categories/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    const body = await readJsonBody(req);
    let fields;
    try {
      fields = readCategoryBody(body, existing);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    await db.prepare('UPDATE workshop_service_categories SET name = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(fields.name, fields.position, nowIso(), id);
    const row = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
    sendJson(res, 200, serializeServiceCategory(row));
  });

  // screens: services, service-edit
  route('DELETE', '/api/workshop-service-categories/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    await db.prepare('DELETE FROM workshop_service_categories WHERE id = ?').run(id);
    sendJson(res, 200, { ok: true });
  });

  // screens: services, service-edit
  route('GET', '/api/workshop-services', async (req, res) => {
    const rows = await db.prepare('SELECT * FROM workshop_services ORDER BY active DESC, name').all();
    const includes = await loadIncludes();
    sendJson(res, 200, rows.map((r) => serializeWorkshopService(r, includes.get(r.id) ?? [])));
  });

  // screens: services, service-edit
  route('POST', '/api/workshop-services', async (req, res) => {
    const body = await readJsonBody(req);
    let fields;
    let placement;
    let questions;
    let includes;
    try {
      fields = readServiceBody(body);
      placement = await readServicePlacement(body, null);
      questions = readQuestionsOrKeep(body, []);
      includes = await readIncludes(body, placement.kind, null, null, null);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    const bookableOnline = body.bookableOnline ? 1 : 0;
    await db.exec('BEGIN');
    let info;
    try {
      info = await db.prepare(
        'INSERT INTO workshop_services (name, price, minutes, bookable_online, kind, category_id, position, questions) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))'
      ).run(fields.name, fields.price, fields.minutes, bookableOnline, placement.kind, placement.categoryId, placement.position, JSON.stringify(questions));
      await replaceIncludes(info.lastInsertRowid, includes);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeWorkshopService(row, includes));
  });

  // screens: services, service-edit
  route('PUT', '/api/workshop-services/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    const body = await readJsonBody(req);
    let fields;
    let placement;
    let questions;
    let includes;
    try {
      fields = readServiceBody(body);
      placement = await readServicePlacement(body, existing);
      questions = readQuestionsOrKeep(body, existing.questions ?? []);
      const stored = (await db.prepare(
        'SELECT included_service_id FROM workshop_service_includes WHERE service_id = ? ORDER BY position'
      ).all(id)).map((r) => r.included_service_id);
      includes = await readIncludes(body, placement.kind, stored, id, fields.name);
      if (existing.kind === 'individual' && placement.kind === 'full') {
        const holder = await db.prepare(
          `SELECT f.name FROM workshop_service_includes i JOIN workshop_services f ON f.id = i.service_id
           WHERE i.included_service_id = ? ORDER BY f.name LIMIT 1`
        ).get(id);
        if (holder) throw new ValidationError(`${fields.name} is part of ${holder.name} - take it out of that first`);
      }
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    const active = body.active === undefined ? existing.active : (body.active ? 1 : 0);
    const bookableOnline = body.bookableOnline === undefined
      ? existing.bookable_online : (body.bookableOnline ? 1 : 0);
    await db.exec('BEGIN');
    try {
      await db.prepare(
        'UPDATE workshop_services SET name = ?, price = ?, minutes = ?, active = ?, bookable_online = ?, kind = ?, category_id = ?, position = ?, questions = CAST(? AS jsonb), updated_at = ? WHERE id = ?'
      ).run(fields.name, fields.price, fields.minutes, active, bookableOnline,
        placement.kind, placement.categoryId, placement.position, JSON.stringify(questions), nowIso(), id);
      // Only touch the stored list when the caller actually sent one, or when
      // the demotion to individual must clear it - a save that leaves
      // `includes` out (as `questions` and placement work) must not delete and
      // reinsert rows that did not change.
      const demotedToIndividual = existing.kind === 'full' && placement.kind === 'individual';
      if (body.includes !== undefined || demotedToIndividual) {
        await replaceIncludes(id, includes);
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
    sendJson(res, 200, serializeWorkshopService(row, includes));
  });

  // Deactivate rather than delete: a job line keeps its service_id, and that
  // link must not dangle.
  // screens: services, service-edit
  route('DELETE', '/api/workshop-services/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    await db.prepare('UPDATE workshop_services SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
    sendJson(res, 200, { ok: true });
  });
}
