import type { DiaryColumn } from '@/components/ui/day-diary';
import type { PillOption } from '@/components/ui/pill-group';
import type { BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import type { AvailabilityDay, AvailabilityResponse, DropoffDay, PortalMechanic, TimedDay } from './date-query.ts';
import { totalMinutes } from './service-selection.ts';

/**
 * The date screen's rules, kept apart from the screen so they can be tested
 * directly: the range asked for, the job length, which days are free, the
 * diary's columns, whether a saved choice is still free, "Any mechanic", the
 * summary and the Continue message. The screen only calls these.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */

// The server's "not sure hour" (server/server.js, the booking route).
export const NOT_SURE_MINUTES = 60;
// The drop-off pill for "Any mechanic". Never stored: resolved on Continue.
export const ANY_MECHANIC = 'any';

export type BookingRange = { start: string; end: string; months: [string, string] };
type Hours = { open: string; close: string };

export function jobMinutes(services: ServicesResponse, draft: BookingDraft): number {
  return draft.notSure ? NOT_SURE_MINUTES : totalMinutes(services, draft.serviceIds ?? []);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The device's own date. The client can't know the shop's time zone; the
 * server (piece 10) offers nothing before the shop's earliest bookable moment,
 * so a device a day ahead or behind only widens or narrows the request.
 */
export function localToday(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today to the last day of next month ("about two months ahead"): at most 62 days, the server's limit. */
export function bookingRange(today: string): BookingRange {
  const [y, m] = today.split('-').map(Number);
  // Day 0 of the month after next is the last day of next month.
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start: today, end, months: [today.slice(0, 7), end.slice(0, 7)] };
}

function hasRoom(day: AvailabilityDay): boolean {
  return day.mode === 'timed'
    ? day.mechanics.some((m) => m.startTimes.length > 0)
    : day.mechanics.some((m) => m.bookable);
}

/** Days with at least one mechanic who has a start time (timed) or is bookable (drop-off). */
export function availableDays(availability: AvailabilityResponse): Set<string> {
  return new Set(availability.days.filter(hasRoom).map((d) => d.date));
}

/** The saved day, only while it is free. */
export function pickedDay(availability: AvailabilityResponse, date: string | undefined): AvailabilityDay | undefined {
  if (!date) return undefined;
  const day = availability.days.find((d) => d.date === date);
  return day && hasRoom(day) ? day : undefined;
}

/** The saved day's month, else the first free day's, else this month. */
export function initialMonth(range: BookingRange, draft: BookingDraft, available: ReadonlySet<string>): string {
  const inRange = (date: string) => range.months.includes(date.slice(0, 7));
  if (draft.date && available.has(draft.date) && inRange(draft.date)) return draft.date.slice(0, 7);
  const first = [...available].filter(inRange).sort()[0];
  return first ? first.slice(0, 7) : range.months[0];
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${pad(mins % 60)}`;

// The server's slot step: start times are always on a 30-minute boundary.
const SLOT_MINUTES = 30;

/**
 * The gap time in one column: every 30-minute step within [open, close) that
 * is not a start time, merged into blocks (a mechanic with no start times is
 * one block open..close). open/close off a 30-minute boundary clamp the
 * first/last block. Jack, 26 Sep (.superpowers/sdd/d4-gaps/brief.md): this
 * replaces availability.busy for the diary, which only had cases the server
 * had already scheduled and missed every other kind of "no start time" gap.
 */
function busyBlocks(startTimes: string[], hours: Hours): { start: string; end: string }[] {
  const openMin = toMin(hours.open);
  const closeMin = toMin(hours.close);
  const starts = new Set(startTimes);
  const blocks: { start: number; end: number }[] = [];
  for (let t = Math.floor(openMin / SLOT_MINUTES) * SLOT_MINUTES; t < closeMin; t += SLOT_MINUTES) {
    if (starts.has(toTime(t))) continue;
    const start = Math.max(t, openMin);
    const end = Math.min(t + SLOT_MINUTES, closeMin);
    if (start >= end) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.end === start) last.end = end;
    else blocks.push({ start, end });
  }
  return blocks.map((b) => ({ start: toTime(b.start), end: toTime(b.end) }));
}

/** One diary column per shown mechanic, in the shop's order, busy being the gaps between that day's start times. */
export function diaryColumns(
  day: TimedDay,
  mechanics: PortalMechanic[],
  shown: number[],
  hours: Hours,
): DiaryColumn[] {
  return mechanics
    .filter((m) => shown.includes(m.id))
    .map((m) => {
      const startTimes = day.mechanics.find((x) => x.mechanicId === m.id)?.startTimes ?? [];
      return { id: String(m.id), name: m.name, busy: busyBlocks(startTimes, hours), startTimes };
    });
}

const bookableOn = (day: DropoffDay, mechanicId: number) =>
  day.mechanics.some((m) => m.mechanicId === mechanicId && m.bookable);

/** "Any mechanic", then each mechanic in the shop's order; those who can't take the job that day disabled. */
export function dropoffOptions(day: DropoffDay, mechanics: PortalMechanic[]): PillOption[] {
  return [
    { value: ANY_MECHANIC, label: 'Any mechanic' },
    ...mechanics.map((m) => ({ value: String(m.id), label: m.name, disabled: !bookableOn(day, m.id) })),
  ];
}

/** "Any mechanic" on Continue: the first bookable mechanic in the shop's order. */
export function resolveMechanic(day: DropoffDay, mechanics: PortalMechanic[]): number | null {
  return mechanics.find((m) => bookableOn(day, m.id))?.id ?? null;
}

/**
 * Whether the saved day, mechanic and time are still offered. Nothing saved
 * counts as free (nothing to clear). A timed day with only a day saved is
 * free while the day is; a mechanic and time must still be that mechanic's
 * start time. A drop-off day holds no time, and a chosen mechanic must still
 * be bookable. A day whose mode changed counts as taken.
 */
export function choiceStillFree(availability: AvailabilityResponse, draft: BookingDraft): boolean {
  if (draft.date === undefined) return true;
  const day = pickedDay(availability, draft.date);
  if (!day) return false;
  if (day.mode === 'timed') {
    if (draft.mechanicId === undefined && draft.startTime === undefined) return true;
    const time = draft.startTime;
    return time !== undefined && day.mechanics.some((m) => m.mechanicId === draft.mechanicId && m.startTimes.includes(time));
  }
  if (draft.startTime !== undefined) return false;
  return draft.mechanicId === undefined || bookableOn(day, draft.mechanicId);
}

// Fixed English names, not a locale formatter: our own copy has no comma, and
// ICU data on some Node/ICU builds would add one after the weekday.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Monday 5 October". Worked in UTC, like the calendar, so no time zone can shift the day. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The pinned summary; empty until a free day is picked. */
export function summaryText(availability: AvailabilityResponse, draft: BookingDraft, mechanics: PortalMechanic[]): string {
  const day = pickedDay(availability, draft.date);
  if (!day) return '';
  const when = dayLabel(day.date);
  if (day.mode === 'dropoff') return `${when}, drop off ${day.dropoffWindow.start}–${day.dropoffWindow.end}`;
  const name = mechanics.find((m) => m.id === draft.mechanicId)?.name;
  return draft.startTime && name ? `${when}, ${draft.startTime} with ${name}` : when;
}

/** Why Continue can't go on yet; null when it can. */
export function continueMessage(availability: AvailabilityResponse, draft: BookingDraft): string | null {
  const day = pickedDay(availability, draft.date);
  if (!day) return 'Choose a day';
  if (day.mode === 'timed' && (draft.mechanicId === undefined || draft.startTime === undefined)) return 'Choose a time';
  return null;
}
