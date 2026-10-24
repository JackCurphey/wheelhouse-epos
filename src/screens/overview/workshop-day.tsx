import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { toMinutes } from '@/screens/diary/rules.ts';
import { jobRefusalText } from '@/screens/diary/refusal-words.ts';
import { SlotDialog, useStorageSlots } from '@/screens/diary/storage-slots.tsx';

/**
 * The workshop's day, as the Workshop Overview and Today both show it
 * (openspec/changes/today-page, design decision 4): one set of rules for what
 * is expected today, still to arrive, in the workshop and ready, and one Book
 * in, so the two pages can't disagree.
 */

// A booking that stands: not a request, an offer, or one that has ended.
export const live = (j: WorkshopJob) => j.bookingState === 'scheduled' || j.bookingState === 'reschedule_requested';
export const inShop = (j: WorkshopJob) => j.custodyState === 'in_shop';
// A job over several days is read from today's own day, as the diary draws it:
// its time and its mechanic (fresh review, 21 Oct).
const todayPart = (j: WorkshopJob, today: string) => j.parts?.find((p) => p.date === today);
// A drop-off's day comes back with an empty start time: that is no time too.
export const startOf = (j: WorkshopJob, today: string) => todayPart(j, today)?.startTime || (j.jobDate === today ? j.startTime : null) || null;
export const mechanicOf = (j: WorkshopJob, today: string) => { const p = todayPart(j, today); return p ? p.mechanicId : j.mechanicId; };
export const bookedToday = (j: WorkshopJob, today: string) => j.jobDate === today || Boolean(todayPart(j, today));

/** Due to be booked in: no more than an hour away, or past; a drop-off is due all day. */
export function due(start: string | null, now: Date): boolean {
  if (!start) return true;
  return toMinutes(start) - (now.getHours() * 60 + now.getMinutes()) <= 60;
}

/** The time, moving on by itself each minute, so "due" and today keep up on a page left open. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Today's jobs, and every bike in the shop whatever its days (a ready bike
 * from an earlier day has none today), in time order. Under 'workshop-jobs',
 * so the diary's changes refresh them too.
 */
export function useWorkshopDay(today: string) {
  const todays = useQuery({ queryKey: ['workshop-jobs', 'overview', today], queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${today}&end=${today}`) });
  const kept = useQuery({ queryKey: ['workshop-jobs', 'in-shop'], queryFn: () => apiGet<WorkshopJob[]>('/api/workshop-jobs?custody=in_shop') });
  const jobs = new Map<number, WorkshopJob>();
  for (const j of [...(todays.data ?? []), ...(kept.data ?? [])]) jobs.set(j.id, j);
  const sortKey = (j: WorkshopJob) => `${bookedToday(j, today) ? today : j.jobDate} ${startOf(j, today) ?? j.startTime ?? '~'}`;
  // Compared as plain text, so a job with no time ("~") comes last.
  const all = [...jobs.values()].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
  const expectedToday = all.filter((j) => live(j) && bookedToday(j, today));
  const inWorkshop = all.filter(inShop);
  return {
    all,
    expectedToday,
    inWorkshop,
    arrivals: expectedToday.filter((j) => j.custodyState === 'expected'),
    ready: inWorkshop.filter((j) => j.workState === 'complete'),
    loaded: todays.isSuccess && kept.isSuccess,
    failed: todays.isError || kept.isError,
    retry: () => { void todays.refetch(); void kept.refetch(); },
  };
}

/**
 * Book in, as the Overview does it: with the shop's storage slots on, it asks
 * where the bike is kept first (till-book-in). `dialog` is that question, to
 * render; `onDone` runs once a bike is booked in.
 */
export function useBookIn(onDone?: () => void): { start: (j: WorkshopJob) => void; busy: number | null; refused: string | null; clearRefused: () => void; dialog: ReactNode } {
  const queryClient = useQueryClient();
  const { slots, ask } = useStorageSlots();
  const [busy, setBusy] = useState<number | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [slotFor, setSlotFor] = useState<WorkshopJob | null>(null);

  async function bookIn(j: WorkshopJob, storageSlotId: number | null = null) {
    setBusy(j.id);
    setRefused(null);
    let done = false;
    try {
      await jobAction(j.id, 'book-in', j.version, storageSlotId === null ? {} : { storageSlotId });
      done = true;
    } catch (err) {
      setRefused(err instanceof ApiError ? jobRefusalText(err) : 'Wheelhouse couldn’t book that in. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
      setBusy(null);
    }
    if (done) onDone?.();
  }

  const dialog = slotFor ? (
    <SlotDialog
      job={slotFor} slots={slots} busy={busy === slotFor.id} title={slotFor.reference ? `Book in · job ${slotFor.reference}` : 'Book in'}
      onClose={() => setSlotFor(null)}
      onDone={(slot) => { const j = slotFor; setSlotFor(null); void bookIn(j, slot); }}
    />
  ) : null;
  return {
    start: (j) => { if (ask) setSlotFor(j); else void bookIn(j); },
    busy,
    refused,
    clearRefused: () => setRefused(null),
    dialog,
  };
}
