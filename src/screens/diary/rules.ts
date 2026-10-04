/**
 * The staff diary's pure rules. A .ts file with relative imports only, so the
 * tests load it straight into Node (tests/screens/diary-rules.test.js).
 * Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md
 */

/** The diary's colours (ST in docs/design/user-journeys/generator/diary.mjs). */
export type DiaryState = 'pending' | 'scheduled' | 'answer' | 'waiting' | 'hold' | 'ready' | 'cancelled';

// The job page's stage words, everywhere (3 Oct answer 11, walk-through 9 M4).
export const STATE_LABEL: Record<DiaryState, string> = {
  scheduled: 'Expected',
  pending: 'Pending',
  answer: 'Quoting',
  hold: 'Change requested',
  waiting: 'Waiting for parts',
  ready: 'Finished',
  cancelled: 'Cancelled',
};

/** The legend's words: blue covers more than one stage (diaryLegend). */
export const LEGEND_LABEL: Record<DiaryState, string> = { ...STATE_LABEL, scheduled: 'Expected, booked in or in the workshop' };

/** The legend's order, as drawn (diaryLegend). */
export const LEGEND: DiaryState[] = ['scheduled', 'pending', 'answer', 'hold', 'waiting', 'ready', 'cancelled'];

type JobStates = {
  bookingState: string;
  workState: string;
  requested?: unknown;
  cancelledBy?: string | null;
  cancellationSeenAt?: string | null;
  quote?: { state: string } | null;
};

/**
 * How the diary draws a job, or 'hidden'. The old diary's rules
 * (public/diary-marks.js): a customer's cancellation stays, struck through,
 * until someone marks it seen; other ended bookings are not drawn.
 */
export function diaryState(job: JobStates): DiaryState | 'hidden' {
  const b = job.bookingState;
  if (b === 'cancelled') return job.cancelledBy === 'customer' && !job.cancellationSeenAt ? 'cancelled' : 'hidden';
  if (b === 'declined' || b === 'expired') return 'hidden';
  if (b === 'pending') return 'pending';
  if (b === 'reschedule_requested' && job.requested) return 'hold';
  if (job.workState === 'waiting_parts') return 'waiting';
  if (job.workState === 'complete') return 'ready';
  // A quote waiting for the customer (UX walk-through M3): its own teal.
  if (job.quote?.state === 'sent') return 'answer';
  return 'scheduled';
}

// Dates are YYYY-MM-DD strings, worked out in UTC from their own digits so
// the machine's time zone and clock changes can't move them.
function utc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + n);
  return iso(date);
}

/** The seven days, Monday to Sunday, of the week holding `day`. */
export function weekOf(day: string): string[] {
  const monday = addDays(day, -((utc(day).getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Today's date where the browser is, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Saturday 3 October" */
export function dayLabel(day: string): string {
  const d = utc(day);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Sat 3 Oct" */
export function shortDay(day: string): string {
  const d = utc(day);
  return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "5–11 October 2026", or "28 September – 4 October 2026" across months. */
export function weekLabel(monday: string): string {
  const a = utc(monday);
  const b = utc(addDays(monday, 6));
  const ma = MONTHS[a.getUTCMonth()];
  const mb = MONTHS[b.getUTCMonth()];
  if (ma === mb) return `${a.getUTCDate()}–${b.getUTCDate()} ${mb} ${b.getUTCFullYear()}`;
  const ya = a.getUTCFullYear() === b.getUTCFullYear() ? '' : ` ${a.getUTCFullYear()}`;
  return `${a.getUTCDate()} ${ma}${ya} – ${b.getUTCDate()} ${mb} ${b.getUTCFullYear()}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

type Hours = { openingHours?: { weekday: number; open: string; close: string }[] };

/**
 * The hours the grid covers: the shop's earliest opening to its latest
 * closing (09:00–18:00 when none are set), widened on the hour to show any
 * job outside them.
 */
export function gridRange(settings: Hours, jobs: { startTime?: string | null; endTime?: string | null }[]) {
  const hours = settings.openingHours ?? [];
  let start = hours.length ? Math.min(...hours.map((h) => toMinutes(h.open))) : 9 * 60;
  let end = hours.length ? Math.max(...hours.map((h) => toMinutes(h.close))) : 18 * 60;
  for (const j of jobs) {
    if (j.startTime) start = Math.min(start, Math.floor(toMinutes(j.startTime) / 60) * 60);
    if (j.endTime) end = Math.max(end, Math.ceil(toMinutes(j.endTime) / 60) * 60);
  }
  return { start, end };
}

/**
 * Decision 59's lanes: jobs that overlap share the column side by side, each
 * at its own true time; a job with the column to itself keeps all of it.
 * Lanes are worked out per group of overlapping jobs, so an unrelated job
 * later in the day never inherits another group's width.
 */
export function layoutLanes(items: { id: number; start: number; end: number }[]) {
  const out = new Map<number, { lane: number; total: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  let group: { id: number; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const g of group) out.set(g.id, { lane: g.lane, total: laneEnds.length });
    group = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (it.start >= groupEnd) close();
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.end;
    group.push({ id: it.id, lane });
    groupEnd = Math.max(groupEnd, it.end);
  }
  close();
  return out;
}

type Slot = { jobDate?: string | null; startTime?: string | null; endTime?: string | null };
export type WaitingItem = Slot & {
  kind: 'new_booking' | 'change_request' | 'customer_cancelled';
  jobId?: number;
  reference?: string;
  customerName?: string | null;
  serviceNames?: string[];
  mechanicId?: number | null;
  from?: Slot & { mechanicId?: number | null };
  to?: Slot & { mechanicId?: number | null };
};

const KIND: Record<WaitingItem['kind'], { tone: DiaryState; label: string }> = {
  new_booking: { tone: 'pending', label: 'New booking request' },
  change_request: { tone: 'hold', label: 'Change request' },
  customer_cancelled: { tone: 'cancelled', label: 'Cancelled by customer' },
};

function when(s: Slot): string {
  if (!s.jobDate) return '';
  const times = s.startTime ? `, ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : '';
  return `${shortDay(s.jobDate)}${times}`;
}

/** What a "Waiting for you" card says (the drawings' waitingCard). */
export function waitingCard(item: WaitingItem) {
  const { tone, label } = KIND[item.kind];
  let detail: string;
  if (item.kind === 'change_request' && item.from && item.to) {
    const end = (s: Slot) => `${s.jobDate ? shortDay(s.jobDate) : ''}${s.startTime ? ` ${s.startTime}` : ''}`;
    detail = `${end(item.from)} → ${end(item.to)}`;
  } else {
    detail = [(item.serviceNames ?? []).join(', '), when(item)].filter(Boolean).join(' · ');
  }
  return { tone, label, customer: item.customerName || 'Customer', detail };
}

/** The diary's 30-minute row height, in pixels (as drawn). */
export const SLOT_PX = 29;
/** Moves snap to 15 minutes, like the old diary (WORKSHOP_SNAP_MIN). */
export const SNAP_MIN = 15;

/**
 * Where a dragged job starts: the top of the dropped block, `y` pixels down
 * its column, as a time snapped to 15 minutes and kept inside the grid's
 * hours (so a job never starts before them or runs past their end).
 */
export function dropStart(y: number, range: { start: number; end: number }, durationMin: number, slotPx = SLOT_PX): number {
  const raw = range.start + (y / slotPx) * 30;
  const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
  return Math.max(range.start, Math.min(range.end - durationMin, snapped));
}

/**
 * Decision 58: jobs in one column that start at the same time become one
 * stack (a group of one is just the job). A stack runs from that start to
 * its longest job's end, and takes one lane like a job does. Each group is
 * named by its first job's id, in the order the jobs came.
 */
export function stackGroups(items: { id: number; start: number; end: number }[]) {
  const byStart = new Map<number, { id: number; ids: number[]; start: number; end: number }>();
  for (const it of items) {
    const g = byStart.get(it.start);
    if (g) {
      g.ids.push(it.id);
      g.end = Math.max(g.end, it.end);
    } else {
      byStart.set(it.start, { id: it.id, ids: [it.id], start: it.start, end: it.end });
    }
  }
  return [...byStart.values()];
}
