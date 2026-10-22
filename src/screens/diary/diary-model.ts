import type { BlockLines } from './diary-context.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { STATE_LABEL, weekOf, type DiaryState, type WaitingItem } from './rules.ts';

export type Mechanic = { id: number; name: string; active: boolean; workingDays?: number[] };
export type Settings = { openingHours?: { weekday: number; open: string; close: string }[]; showSignOffToCustomers?: boolean; blockFirst?: BlockLines['first']; blockSecond?: BlockLines['second'] };

/** A block's line for the shop's choice of bike, job title, customer or job number. */
export function blockLine(j: Shown, field: BlockLines['first']): string {
  if (field === 'jobTitle') return j.title;
  if (field === 'customer') return j.customerName || 'Customer';
  if (field === 'reference') return j.reference ?? '';
  return j.bikeLabel || 'Bike';
}
export type Waiting = { count: number; items: WaitingItem[] };
export const SLOT_H = 29; // one 30-minute row, as drawn (desktop and tablet)
// The phone's timeline is taller: 44px a row (P_SLOT in the drawings).
export const PHONE_SLOT_H = 44;
// Whole class strings, so Tailwind sees every one (never built from parts).
export const BLOCK: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] border-[var(--wh-state-scheduled-ink)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] border-[var(--wh-state-pending-ink)] text-[var(--wh-state-pending-ink)]',
  offered: 'bg-[var(--wh-state-pending-bg)] border-[var(--wh-state-pending-ink)] text-[var(--wh-state-pending-ink)]',
  answer: 'bg-[var(--wh-state-answer-bg)] border-[var(--wh-state-answer-ink)] text-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] border-[var(--wh-state-hold-ink)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] border-[var(--wh-state-waiting-ink)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] border-[var(--wh-state-ready-ink)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] border-[var(--wh-state-cancelled-ink)] text-[var(--wh-state-cancelled-ink)]',
};
export const CHIP: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  offered: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  answer: 'bg-[var(--wh-state-answer-bg)] text-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

export const SR = 'sr-only';
/** One block: a job on one of its days (decision 52), with that day's date, times and mechanic. */
export type Shown = WorkshopJob & { state: DiaryState; partId: number; partPos: number; partCount: number };

/** A job as one block per day it is worked; a job sent without parts is one day. */
export function blocksOf(j: WorkshopJob): Omit<Shown, 'state'>[] {
  const parts = j.parts?.length ? j.parts : null;
  if (!parts) return [{ ...j, partId: -j.id, partPos: 1, partCount: 1 }];
  return parts.map((p) => ({
    ...j,
    jobDate: p.date,
    startTime: p.startTime || null,
    endTime: p.endTime || null,
    mechanicId: p.mechanicId,
    mechanicName: p.mechanicName,
    partId: p.id,
    partPos: p.position,
    partCount: parts.length,
  }));
}

export function timeText(j: { startTime: string | null; endTime: string | null }) {
  return j.startTime ? `${j.startTime}${j.endTime ? `–${j.endTime}` : ''}` : 'no set time';
}

export const dayOf = (j: Shown) => (j.partCount > 1 ? `day ${j.partPos} of ${j.partCount}` : '');

export function describe(j: Shown, chosen: boolean) {
  const bike = j.bikeLabel || 'Bike';
  return [bike, j.title, j.customerName || 'Customer', j.reference, STATE_LABEL[j.state], timeText(j), dayOf(j)]
    .filter(Boolean).join(', ') + (chosen ? ', chosen from Waiting for you' : '')
    // A booking confirmed straight away, until someone opens it (Jack, 19 Oct, auto-confirm).
    + (j.newOnline ? ', new, booked online' : '');
}

/** A job on the move, or (stretch) having its length changed: then only durationMin changes. */
export type Preview = { partId: number; colIndex: number; startMin: number; durationMin: number; stretch?: boolean };
/** A booking request is answered before it is moved; a cancellation isn't moved at all. */
// An offer is changed by offering again, not dragged (Jack, 20 Oct).
export const movable = (j: Shown) => Boolean(j.startTime) && j.state !== 'pending' && j.state !== 'offered' && j.state !== 'cancelled';
/** Where a customer asked to move a booking: from the job, or from "Waiting for you" when the job is in another week. */
export type Outline = { id: number; label: string; mechanicId: number | null; requested: { jobDate?: string | null; startTime?: string | null; endTime?: string | null; mechanicId?: number | null } };

/**
 * The first day to show for a "Waiting for you" card: the booking's own, or
 * for a change request into another week the day asked for (Jack, 15 Oct).
 */
export function cardDay(item: WaitingItem): string | null | undefined {
  const to = item.kind === 'change_request' ? item.to?.jobDate : null;
  if (to && item.jobDate && weekOf(to)[0] !== weekOf(item.jobDate)[0]) return to;
  return item.jobDate;
}

/** One column of the grid: a day of the week, or a mechanic in the Day view. */
export type Col = { key: string; label: string; date: string; mechanicId: number | null; all?: boolean };
