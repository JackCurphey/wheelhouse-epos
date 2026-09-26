// The shop's clock (piece 10): the one place the server reads the real time
// for a shop's date and time of day, and the shop's today, now and earliest
// bookable moment in its own time zone, summer and winter time included.
// Timestamps written to rows (nowIso) and rate limiters still use the plain
// system time - they record instants, not a shop's calendar.
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md

import { toMinutes } from './capacity.js';

// Tests pin the clock through this variable (tests/helpers/liveServer.js sets
// it for every live server); nothing in production sets it.
const PIN_VAR = 'WHEELHOUSE_TEST_CLOCK';

export function currentMoment() {
  const pinned = process.env[PIN_VAR];
  if (!pinned) return new Date();
  const moment = new Date(pinned);
  if (Number.isNaN(moment.getTime())) throw new Error(`${PIN_VAR} is not a valid moment: ${pinned}`);
  return moment;
}

export function isKnownTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// The shop's local date (YYYY-MM-DD) and minutes past midnight at a moment.
export function shopNow(timeZone, moment = currentMoment()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(moment).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function shopToday(timeZone, moment = currentMoment()) {
  return shopNow(timeZone, moment).date;
}

// Now plus the shop's minimum notice, in real time (so notice across a clock
// change is the true number of hours), then read on the shop's clock.
export function earliestBookable({ timeZone, minNoticeMinutes }, moment = currentMoment()) {
  return shopNow(timeZone, new Date(moment.getTime() + minNoticeMinutes * 60_000));
}

// Timed: a start is in time at or after the earliest bookable moment - the
// earliest moment is itself bookable, so what availability offers the booking
// route accepts.
export function startIsInTime(earliest, date, startTime) {
  if (date !== earliest.date) return date > earliest.date;
  return toMinutes(startTime) >= earliest.minutes;
}

// Drop-off: a day is in time while the earliest bookable moment is before
// that day's drop-off window closes.
export function dropoffIsInTime(earliest, date, windowEnd) {
  if (date !== earliest.date) return date > earliest.date;
  return earliest.minutes < toMinutes(windowEnd);
}
