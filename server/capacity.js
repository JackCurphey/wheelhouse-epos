// The capacity calculator: one answer to "how much of this mechanic's day is
// free, and when". The customer calendar, the customer booking check and the
// staff capacity view all ask it, so the rule lives in one place.
//
// Pure - no database. server.js loads the rows and passes them in; this file
// only does arithmetic, which is why it is unit-tested without Postgres.
// Windows are [startMinute, endMinute) pairs within one day.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const HOUR_RE = /^([01]\d|2[0-3]):00$/;
export const SLOT_STEP_MINUTES = 30;
export const MAX_RANGE_DAYS = 62;
export const LIVE_BOOKING_STATES = ['pending', 'scheduled', 'reschedule_requested'];
const DAY_MINUTES = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// getUTCDay, as checkJobSlot: job_date is a bare calendar date, and a local
// parse would shift the weekday for a server west of UTC.
export function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// DATE_RE only checks the shape (e.g. 2026-02-30 matches it); this also
// rejects a date that does not exist, by round-tripping through Date and
// checking nothing shifted (an invalid day/month rolls over rather than
// erroring).
export function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function dayCount(start, end) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
}

export function datesBetween(start, end) {
  const out = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= last; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

// ---- Opening hours ----

// workshop_settings.weekday_hours holds only the days that differ from the
// usual hours. Anything malformed is dropped rather than trusted.
export function parseWeekdayHours(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return {}; }
  const out = {};
  if (!parsed || typeof parsed !== 'object') return out;
  for (const [key, value] of Object.entries(parsed)) {
    const w = Number(key);
    if (!Number.isInteger(w) || w < 0 || w > 6) continue;
    if (!value || !TIME_RE.test(value.open || '') || !TIME_RE.test(value.close || '')) continue;
    if (value.close <= value.open) continue;
    out[w] = { open: value.open, close: value.close };
  }
  return out;
}

export function effectiveHours(settings, weekday) {
  if (!settings.openingDays.includes(weekday)) return null;
  const own = settings.weekdayHours[weekday];
  return own ? { open: own.open, close: own.close } : { open: settings.openingTime, close: settings.closingTime };
}

// What the old booking page's grid spans: earliest open to latest close.
export function widestHours(settings) {
  const days = settings.openingDays.map((w) => effectiveHours(settings, w));
  if (!days.length) return { open: settings.openingTime, close: settings.closingTime };
  return { open: days.map((d) => d.open).sort()[0], close: days.map((d) => d.close).sort().at(-1) };
}

export function openingHoursFor(settings) {
  return settings.openingDays.map((weekday) => ({ weekday, ...effectiveHours(settings, weekday) }));
}

// A staff PUT of openingHours: the listed days are open, and only days whose
// hours differ from the usual ones are stored as their own.
export function resolveOpeningHours(input, { openingTime, closingTime }) {
  if (!Array.isArray(input)) return { error: 'openingHours must be a list of { weekday, open, close }' };
  const seen = new Set();
  const weekdayHours = {};
  for (const entry of input) {
    const w = Number(entry?.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6 || seen.has(w)) {
      return { error: 'Each weekday (0-6, 0 is Sunday) may appear once' };
    }
    if (!HOUR_RE.test(entry.open || '') || !HOUR_RE.test(entry.close || '')) {
      return { error: 'Opening hours must be on the hour (e.g. 09:00)' };
    }
    if (entry.close <= entry.open) return { error: 'Closing time must be after opening time' };
    seen.add(w);
    if (entry.open !== openingTime || entry.close !== closingTime) weekdayHours[w] = { open: entry.open, close: entry.close };
  }
  return { openingDays: [...seen].sort((a, b) => a - b), weekdayHours };
}

// ---- Booking mode ----

export function modeForDate(settings, date) {
  if (settings.nextBookingMode && settings.nextBookingModeFrom && date >= settings.nextBookingModeFrom) {
    return settings.nextBookingMode;
  }
  return settings.bookingMode;
}

// ---- Blocks ----

// A real whole number, from a number or a numeric string ('1') - never from
// '', null, false or anything else Number() would otherwise coerce into 0.
function toWholeNumber(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
  return NaN;
}

export function validateBlock(input) {
  const { kind } = input;
  if (kind !== 'weekly' && kind !== 'dates') return { error: "kind must be 'weekly' or 'dates'" };
  const mechanicId = input.mechanicId === null || input.mechanicId === undefined ? null : toWholeNumber(input.mechanicId);
  if (mechanicId !== null && !Number.isInteger(mechanicId)) {
    return { error: 'mechanicId must be a whole number, or null for the whole shop' };
  }
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  if ((startTime === null) !== (endTime === null)) {
    return { error: 'Give both a start and an end time, or neither for all day' };
  }
  if (startTime && (!TIME_RE.test(startTime) || !TIME_RE.test(endTime))) return { error: 'Times must look like 13:00' };
  if (startTime && endTime <= startTime) return { error: 'The end time must be after the start time' };
  const reason = String(input.reason ?? '').trim();
  if (reason.length > 200) return { error: 'Keep the reason under 200 characters' };

  if (kind === 'weekly') {
    if (mechanicId === null) return { error: 'A weekly block needs a mechanic' };
    if (!startTime) return { error: 'A weekly block needs a start and end time' };
    const weekdays = Array.isArray(input.weekdays)
      ? [...new Set(input.weekdays.map(toWholeNumber))].sort((a, b) => a - b) : [];
    if (!weekdays.length || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return { error: 'weekdays must be day numbers 0-6 (0 is Sunday)' };
    }
    return { block: { mechanicId, kind, weekdays, startDate: null, endDate: null, startTime, endTime, reason } };
  }
  if (!isRealDate(input.startDate || '') || !isRealDate(input.endDate || '')) {
    return { error: 'startDate and endDate must look like 2026-12-25' };
  }
  if (input.endDate < input.startDate) return { error: 'The end date must be on or after the start date' };
  if (mechanicId === null && startTime) return { error: 'A shop closure covers whole days - leave the times out' };
  return {
    block: { mechanicId, kind, weekdays: null, startDate: input.startDate, endDate: input.endDate, startTime, endTime, reason },
  };
}

export function blockApplies(block, date, weekday) {
  if (block.kind === 'weekly') return block.weekdays.includes(weekday);
  return date >= block.startDate && date <= block.endDate;
}

function blockInterval(block) {
  return block.startTime ? [toMinutes(block.startTime), toMinutes(block.endTime)] : [0, DAY_MINUTES];
}

function isTimed(job) {
  return !!job.startTime;
}

function jobMinutes(job) {
  return isTimed(job) ? toMinutes(job.endTime) - toMinutes(job.startTime) : (job.plannedMinutes || 0);
}

// Live jobs a block overlaps. An all-day block clashes with every job that
// day; a timed block only with timed jobs that overlap it - an untimed job has
// no time to overlap. A shop-wide block clashes with every mechanic's jobs.
export function blockClashes(block, jobs) {
  return jobs.filter((j) => {
    if (block.mechanicId !== null && j.mechanicId !== block.mechanicId) return false;
    if (!blockApplies(block, j.jobDate, weekdayOf(j.jobDate))) return false;
    if (!block.startTime) return true;
    if (!isTimed(j)) return false;
    const [bs, be] = blockInterval(block);
    return toMinutes(j.startTime) < be && toMinutes(j.endTime) > bs;
  });
}

// ---- The calculator ----

export function subtractIntervals(windows, cuts) {
  let out = windows.map((w) => [...w]);
  for (const [cs, ce] of cuts) {
    const next = [];
    for (const [ws, we] of out) {
      if (ce <= ws || cs >= we) { next.push([ws, we]); continue; }
      if (cs > ws) next.push([ws, cs]);
      if (ce < we) next.push([ce, we]);
    }
    out = next;
  }
  return out.sort((a, b) => a[0] - b[0]);
}

const total = (windows) => windows.reduce((n, [s, e]) => n + (e - s), 0);

// `jobs` must already be live jobs only (LIVE_BOOKING_STATES). `mechanics` must
// be every active mechanic, even when a caller wants one: the walk-in queue is
// split across everyone working, so leaving one out changes the others' share.
export function computeCapacity({ settings, mechanics, blocks, jobs, dates }) {
  return dates.map((date) => {
    const weekday = weekdayOf(date);
    const hours = effectiveHours(settings, weekday);
    const shopBlocks = blocks.filter((b) => b.mechanicId === null && blockApplies(b, date, weekday));
    const shopClosed = shopBlocks.length > 0;
    const dayJobs = jobs.filter((j) => j.jobDate === date);
    const queueMinutes = dayJobs.filter((j) => j.mechanicId === null).reduce((n, j) => n + jobMinutes(j), 0);

    const rows = mechanics.map((m) => {
      const scheduled = !!hours && m.workingDays.includes(weekday);
      const ownBlocks = blocks.filter((b) => b.mechanicId === m.id && blockApplies(b, date, weekday));
      const open = scheduled && !shopClosed ? [[toMinutes(hours.open), toMinutes(hours.close)]] : [];
      return { m, scheduled, ownBlocks, availableWindows: subtractIntervals(open, ownBlocks.map(blockInterval)) };
    });
    const workingCount = rows.filter((r) => total(r.availableWindows) > 0).length;
    const queueShare = workingCount ? queueMinutes / workingCount : 0;

    return {
      date,
      weekday,
      mode: modeForDate(settings, date),
      shopClosed,
      shopBlocks,
      queueMinutes,
      mechanics: rows.map(({ m, scheduled, ownBlocks, availableWindows }) => {
        const mine = dayJobs.filter((j) => j.mechanicId === m.id);
        const timed = mine.filter(isTimed).map((j) => [toMinutes(j.startTime), toMinutes(j.endTime)]);
        const untimedMinutes = mine.filter((j) => !isTimed(j)).reduce((n, j) => n + jobMinutes(j), 0);
        const freeWindows = subtractIntervals(availableWindows, timed);
        const working = total(availableWindows) > 0;
        const freeMinutes = working
          ? total(freeWindows) - untimedMinutes - queueShare - settings.reserveMinutes
          : 0;
        return { mechanicId: m.id, scheduled, working, availableWindows, freeWindows, freeMinutes, blocks: ownBlocks };
      }),
    };
  });
}

// Timed mode: every 30-minute start where the whole job fits one free window,
// provided the day still has the minutes for it.
export function startTimesFor(mech, minutes) {
  if (!mech.working || mech.freeMinutes < minutes) return [];
  const out = [];
  for (const [s, e] of mech.freeWindows) {
    const first = Math.ceil(s / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    for (let t = first; t + minutes <= e; t += SLOT_STEP_MINUTES) out.push(toHHMM(t));
  }
  return out;
}

export function fitsDropoff(mech, minutes) {
  return mech.working && mech.freeMinutes >= minutes;
}

// Whether [start, end) sits inside time the mechanic is available - blocks and
// the shop's hours removed. Job overlap is checkJobSlot's, in server.js.
export function fitsFreeTime(mech, startTime, endTime) {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  return mech.availableWindows.some(([ws, we]) => s >= ws && e <= we);
}

// What the old booking page reads (public-portal/portal.js:263): busy
// intervals and full mechanic-days. Busy is live timed jobs, plus every part of
// the widest-hours grid the mechanic cannot be booked in - blocks, closures, a
// shorter day - with no reason attached. Only a mechanic's normal working days
// appear; the old page greys closed weekdays and days off itself.
export function legacyView(day, settings, jobs) {
  const widest = widestHours(settings);
  const grid = [[toMinutes(widest.open), toMinutes(widest.close)]];
  const busy = [];
  const fullDays = [];
  for (const m of day.mechanics) {
    if (!m.scheduled) continue;
    const timed = jobs
      .filter((j) => j.mechanicId === m.mechanicId && j.jobDate === day.date && isTimed(j))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const j of timed) busy.push({ mechanicId: m.mechanicId, jobDate: day.date, startTime: j.startTime, endTime: j.endTime });
    for (const [s, e] of subtractIntervals(grid, m.availableWindows)) {
      busy.push({ mechanicId: m.mechanicId, jobDate: day.date, startTime: toHHMM(s), endTime: toHHMM(e) });
    }
    if (m.freeMinutes <= 0) fullDays.push({ mechanicId: m.mechanicId, jobDate: day.date });
  }
  return { busy, fullDays };
}
