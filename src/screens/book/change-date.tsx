import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { cn } from '@/lib/utils';
import { bookingLinkPath, type BookingLink } from './pending-query.ts';
import { dayLabel, localToday } from './date-rules.ts';
import { monthLabel, weekdayName } from './pending-rules.ts';

/**
 * Change the date (Jack, 1 Oct, decision 10; 20 Oct; drawn as bk-change;
 * openspec/changes/change-date): the booking's own days and times, from its
 * link (its mechanic and length, its own slot free), ten days at a time; the
 * chosen day's times; Ask for this date sends the change, which waits for the
 * shop. One request covers today to 61 days on (the server's limit), so moving
 * along the strip costs nothing (fresh review).
 */
type ChangeDay = { date: string; mode: 'timed' | 'dropoff'; closed: boolean; startTimes?: string[]; bookable?: boolean; dropoffWindow?: { start: string; end: string } };
type ChangeAvailability = { mechanicId: number; minutes: number; days: ChangeDay[] };

const STRIP = 10;
const plusDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const free = (d: ChangeDay) => !d.closed && (d.mode === 'timed' ? (d.startTimes?.length ?? 0) > 0 : d.bookable === true);

/** The day's own words: "your booking", "closed", "full", "[n] times free" or "free". */
function dayWords(d: ChangeDay, booked: string): { sub: string; label: string } {
  const n = d.startTimes?.length ?? 0;
  const sub = d.date === booked ? 'Your booking' : d.closed ? 'Closed' : !free(d) ? 'Full' : d.mode === 'timed' ? `${n} ${n === 1 ? 'time' : 'times'}` : 'Free';
  const label = d.date === booked ? 'your booking' : d.closed ? 'closed' : !free(d) ? 'full' : d.mode === 'timed' ? `${n} ${n === 1 ? 'time' : 'times'} free` : 'free';
  return { sub, label };
}

export function ChangeDate({ link, shopSlug, code, onClose }: { link: BookingLink; shopSlug: string; code: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  // From today, or from the booking's own day if the device's clock is ahead of
  // the shop's (the booking's day is never before the shop's today when it can
  // be changed); the server offers nothing before its own earliest moment.
  const [range] = React.useState(() => {
    const today = localToday(new Date());
    const start = link.jobDate < today ? link.jobDate : today;
    return { start, end: plusDays(start, 61) };
  });
  const availability = useQuery({
    queryKey: ['portal', shopSlug, 'booking-link', code, 'availability', range.start, range.end],
    queryFn: () => apiGet<ChangeAvailability>(`${bookingLinkPath(shopSlug, code)}/availability?start=${range.start}&end=${range.end}`),
  });
  const [from, setFrom] = React.useState(0);
  const [day, setDay] = React.useState<string | null>(null);
  const [time, setTime] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const weekday = weekdayName(link.jobDate);

  const days = availability.data?.days ?? [];
  const shown = days.slice(from, from + STRIP);
  const chosen = days.find((d) => d.date === day);
  const sameAsBooked = chosen?.date === link.jobDate && (chosen.mode === 'dropoff' || time === link.startTime);
  // A time must still be on the day's list: the days are read again after a refusal (fresh review).
  const ready = !!chosen && free(chosen) && (chosen.mode === 'dropoff' || (!!time && (chosen.startTimes ?? []).includes(time))) && !sameAsBooked;

  async function ask() {
    if (!chosen || !availability.data) return;
    setBusy(true);
    setError(null);
    try {
      const body = { jobDate: chosen.date, mechanicId: availability.data.mechanicId, ...(chosen.mode === 'timed' ? { startTime: time } : {}) };
      const reply = await apiMutate<BookingLink>(`${bookingLinkPath(shopSlug, code)}/change`, body, { method: 'POST' });
      queryClient.setQueryData(['portal', shopSlug, 'booking-link', code], reply);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t send that. Try again in a moment.');
      // The days may have changed since they were read.
      void availability.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="chg" className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] p-4">
      <h2 id="chg" className="m-0 text-lg font-bold">Choose a new date</h2>
      {availability.isPending && <p role="status" className="m-0 text-sm">Loading…</p>}
      {availability.isError && <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{availability.error instanceof ApiError && availability.error.hasServerMessage ? availability.error.message : 'Wheelhouse couldn’t load the days. Try again in a moment.'}</p>}
      {shown.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold">{monthLabel(shown[0].date)}</span>
            <span className="flex gap-1">
              {from > 0 && <Button variant="ghost" size="sm" onClick={() => setFrom(Math.max(0, from - 7))}>‹ Earlier weeks</Button>}
              {from + STRIP < days.length && <Button variant="ghost" size="sm" onClick={() => setFrom(from + 7)}>Later weeks ›</Button>}
            </span>
          </div>
          <div role="radiogroup" aria-label="Days" className="flex gap-2 overflow-x-auto pb-1">
            {shown.map((d) => {
              const words = dayWords(d, link.jobDate);
              const dt = new Date(`${d.date}T00:00:00Z`);
              const on = d.date === day;
              return (
                <label key={d.date} className={cn('flex min-w-[64px] shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]',
                  on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : d.date === link.jobDate ? 'border-2 border-dashed border-[var(--wh-ink)]' : 'border-[var(--wh-input-border)]')}>
                  <input type="radio" name="change-day" className="sr-only" checked={on} disabled={!free(d)} aria-label={`${dayLabel(d.date)}, ${words.label}`}
                    onChange={() => { setDay(d.date); setTime(null); setError(null); }} />
                  <span aria-hidden="true" className="text-xs">{dayLabel(d.date).split(' ')[0].slice(0, 3)}</span>
                  <span aria-hidden="true" className="text-lg font-bold">{dt.getUTCDate()}</span>
                  <span aria-hidden="true" className="text-[11px]">{words.sub}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
      {chosen && chosen.mode === 'timed' && free(chosen) && (
        <div className="flex flex-col gap-2">
          <span id="chg-times" className="text-[15px] font-bold">{`${dayLabel(chosen.date)} — choose a time`}</span>
          <div role="radiogroup" aria-labelledby="chg-times" className="flex flex-wrap gap-2">
            {(chosen.startTimes ?? []).map((t) => (
              <label key={t} className={cn('inline-flex min-h-11 min-w-[76px] cursor-pointer items-center justify-center rounded-lg border px-3 font-[family-name:var(--wh-font-mono)] text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]',
                time === t ? 'border-2 border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)]')}>
                <input type="radio" name="change-time" className="sr-only" checked={time === t} aria-label={t} onChange={() => { setTime(t); setError(null); }} />
                <span aria-hidden="true">{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {chosen && chosen.mode === 'dropoff' && chosen.dropoffWindow && (
        <p className="m-0 text-[15px]">{`Drop off between ${chosen.dropoffWindow.start} and ${chosen.dropoffWindow.end}`}</p>
      )}
      <p className="m-0 text-sm text-[var(--wh-muted)]">{`Your booking stays on ${weekday} until the shop confirms the new time.`}</p>
      {error && <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p>}
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>{`Keep ${weekday}`}</Button>
        <Button variant="primary" disabled={!ready || busy} onClick={() => void ask()}>Ask for this date</Button>
      </div>
    </section>
  );
}
