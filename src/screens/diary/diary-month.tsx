import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Chevron } from './diary-bits.tsx';
import { NewOnlineMark } from './diary-tiles.tsx';
import { CHIP, SR, blocksOf, type Shown } from './diary-model.ts';
import { STATE_LABEL, addMonths, dayLabel, diaryState, monthLabel, monthOf, todayIso } from './rules.ts';

/** A day's jobs for the month: timed ones earliest first, then those with no time. */
function dayOrder(a: Shown, b: Shown) {
  if (!a.startTime || !b.startTime) return a.startTime ? -1 : b.startTime ? 1 : 0;
  return a.startTime.localeCompare(b.startTime);
}
const MONTH_CHIPS = 3; // as the old diary and the drawing: three, then "+[n] more"
const WEEKDAY_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month view (Jack, 18 Oct, docs/decisions/2026-10-18-old-diary-features.md
 * answer 1, drawn on diary-month): the month's weeks, each day's first three
 * jobs and "+[n] more", which opens the day's list. The date opens the day
 * in the Day view. On a touch screen a day's jobs are too small to tap one
 * by one (decision 68), so the whole day opens its list (diary-month-tablet).
 */
export function MonthGrid({ days, month, jobs, today, coarse, onOpen, onOpenDay }: {
  days: string[]; month: string; jobs: Shown[]; today: string; coarse: boolean;
  onOpen: (job: Shown) => void; onOpenDay: (day: string) => void;
}) {
  const [listDay, setListDay] = useState<string | null>(null);
  const inMonth = month.slice(0, 7);
  const jobsOn = (d: string) => jobs.filter((j) => j.jobDate === d).sort(dayOrder);
  const chipText = (j: Shown) => (
    <>
      <span className="font-mono font-bold">{j.startTime ?? 'No time'}</span>
      <span className="truncate">{j.bikeLabel || 'Bike'}</span>
      {/* Not drawn: the globe alone, as a month chip has no room for words; the
          day's list and the chip's name say it (decided-while-building, 21 Oct). */}
      {j.newOnline ? <span className="shrink-0"><NavIcon name="website" size={12} /></span> : null}
    </>
  );
  const chipName = (j: Shown) => `${j.startTime ?? 'No time'}, ${j.bikeLabel || 'Bike'}, ${j.title}, ${j.customerName || 'Customer'}, ${STATE_LABEL[j.state]}${j.newOnline ? ', new, booked online' : ''}`;
  const chipClass = (j: Shown) => `flex min-w-0 items-center gap-1 rounded-[4px] border-l-[3px] px-1 text-left text-xs leading-[18px] ${CHIP[j.state]} ${j.state === 'cancelled' ? 'line-through' : ''}`;
  const listJobs = listDay ? jobsOn(listDay) : [];
  return (
    <>
      {/* A region of day groups, as the week's grid (fresh review): each day's
          name carries its weekday, so the headings are hidden from readers. */}
      <section aria-label={`Workshop diary, ${monthLabel(month)}`} className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--wh-border)] bg-[var(--wh-border)]">
        {WEEKDAY_HEADS.map((h) => (
          <div key={h} aria-hidden="true" className="bg-[var(--wh-panel)] px-2 py-1.5 text-center text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">{h}</div>
        ))}
        {days.map((d) => {
          const list = jobsOn(d);
          const shown = list.slice(0, MONTH_CHIPS);
          const more = list.length - shown.length;
          const isToday = d === today;
          const out = d.slice(0, 7) !== inMonth;
          return (
            <div
              key={d}
              role="group"
              aria-label={dayLabel(d)}
              className={`flex min-h-[104px] min-w-0 flex-col gap-[3px] px-[5px] py-1 ${isToday ? 'bg-[var(--wh-surface-muted)]' : 'bg-[var(--wh-panel)]'} ${out ? 'opacity-55' : ''}`}
            >
              <button
                type="button"
                aria-label={`Open ${dayLabel(d)} in the Day view`}
                onClick={() => onOpenDay(d)}
                className={`self-start text-[13px] leading-[18px] font-bold ${coarse ? 'min-h-11 min-w-11 text-left' : ''} ${isToday ? 'text-[var(--wh-accent-dark)]' : ''}`}
              >
                {Number(d.slice(8))}{isToday ? ' · Today' : ''}
              </button>
              {coarse ? (
                // On a touch screen the rest of the day is one button that
                // opens its list (diary-month-tablet), so every way in works.
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setListDay(d)}
                  className="flex min-h-11 grow flex-col gap-[3px] text-left"
                >
                  {/* The name keeps the words on screen, for Voice Control (WCAG 2.5.3). */}
                  <span className={SR}>{`Show ${dayLabel(d)}’s jobs, ${list.length} job${list.length === 1 ? '' : 's'}:`}</span>
                  {shown.map((j) => <span key={j.partId} className={chipClass(j)}>{chipText(j)}</span>)}
                  {more > 0 ? <span className="px-0.5 text-xs leading-4 font-bold text-[var(--wh-accent-dark)]">+{more} more</span> : null}
                </button>
              ) : shown.map((j) => (
                <button key={j.partId} type="button" aria-label={chipName(j)} title={chipName(j)} onClick={() => onOpen(j)} className={chipClass(j)}>{chipText(j)}</button>
              ))}
              {!coarse && more > 0 ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setListDay(d)}
                  className="self-start px-0.5 text-xs leading-4 font-bold text-[var(--wh-accent-dark)] underline underline-offset-2"
                >
                  +{more} more
                </button>
              ) : null}
            </div>
          );
        })}
      </section>
      {coarse ? <p className="m-0 mt-2 text-[13px] text-[var(--wh-muted)]">Tap a day to see its jobs.</p> : null}
      <Dialog open={listDay !== null} onOpenChange={(o) => { if (!o) setListDay(null); }} aria-labelledby="month-day-title">
        <DialogHeader>
          <DialogTitle id="month-day-title">{listDay ? dayLabel(listDay) : ''}</DialogTitle>
          <button type="button" aria-label="Close" onClick={() => setListDay(null)} className="inline-flex size-11 items-center justify-center rounded-lg">
            <NavIcon name="close" size={20} />
          </button>
        </DialogHeader>
        <DialogBody className="flex flex-col">
          {listJobs.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No jobs this day.</p> : null}
          {listJobs.map((j) => (
            <button
              key={j.partId}
              type="button"
              onClick={() => { setListDay(null); onOpen(j); }}
              className="grid min-h-[52px] grid-cols-[48px_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-t border-[var(--wh-border)] px-2 py-1.5 text-left first:border-t-0"
            >
              <span className="font-mono text-[13px] font-bold">{j.startTime ?? 'No time'}</span>
              <span className={`flex items-center gap-1 truncate text-[13px] font-bold ${j.state === 'cancelled' ? 'line-through' : ''}`}>
                <span className="truncate">{j.bikeLabel || 'Bike'} · {j.title}</span>
                {j.newOnline ? <>{' · '}<NewOnlineMark short /></> : null}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[j.state]}`}>{STATE_LABEL[j.state]}</span>
              <span />
              <span className="col-span-2 text-xs text-[var(--wh-muted)]">{j.customerName || 'Customer'} · {j.mechanicName || 'Shared queue'}</span>
            </button>
          ))}
          {listDay ? (
            <button type="button" onClick={() => { const d = listDay; setListDay(null); onOpenDay(d); }} className="flex min-h-11 items-center border-t border-[var(--wh-border)] px-2 text-left text-[13px] font-semibold text-[var(--wh-accent-dark)] underline underline-offset-2">
              Open this day in the Day view
            </button>
          ) : null}
        </DialogBody>
      </Dialog>
    </>
  );
}

/**
 * The phone's "Choose a day" (Jack, 18 Oct, drawn on diary-month-phone): the
 * week label opens the month, each day showing how many jobs it has; a tap
 * on a day goes to it.
 */
export function ChooseDaySheet({ open, date, who, whose, onClose, onPick }: {
  open: boolean; date: string; who: (j: Shown) => boolean; whose: string; onClose: () => void; onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState(date);
  const days = monthOf(month);
  const jobs = useQuery({
    queryKey: ['workshop-jobs', days[0], days[days.length - 1]],
    queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${days[0]}&end=${days[days.length - 1]}`),
    enabled: open,
  });
  const counts = new Map<string, number>();
  for (const j of (jobs.data ?? []).flatMap(blocksOf)) {
    const shown = { ...j, state: diaryState(j) };
    if (shown.state === 'hidden' || !who(shown as Shown)) continue;
    counts.set(j.jobDate, (counts.get(j.jobDate) ?? 0) + 1);
  }
  const inMonth = month.slice(0, 7);
  const today = todayIso();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="choose-day-title">
      <DialogHeader>
        <span className="flex flex-col gap-0.5">
          <DialogTitle id="choose-day-title">Choose a day</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">Jobs in each day, {whose}</span>
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg">
          <NavIcon name="close" size={20} />
        </button>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]"><Chevron dir="prev" /></button>
          <span className="text-base font-bold">{monthLabel(month)}</span>
          <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]"><Chevron dir="next" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADS.map((h) => <span key={h} aria-hidden="true" className="text-center text-xs font-bold text-[var(--wh-muted)] uppercase">{h.slice(0, 1)}</span>)}
          {days.map((d) => {
            const n = counts.get(d) ?? 0;
            const jobsText = `${n} job${n === 1 ? '' : 's'}`;
            return (
              <button
                key={d}
                type="button"
                aria-label={`${dayLabel(d)}${d === today ? ', today' : ''}, ${jobsText}`}
                onClick={() => onPick(d)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[10px] ${n ? 'bg-[var(--wh-surface-muted)]' : ''} ${d === today ? 'shadow-[inset_0_0_0_2px_var(--accent)]' : ''} ${d.slice(0, 7) === inMonth ? '' : 'text-[var(--wh-muted)]'}`}
              >
                <span className="text-base font-bold">{Number(d.slice(8))}</span>
                <span aria-hidden="true" className="text-xs font-bold text-[var(--wh-accent-dark)]">{n ? jobsText : '\u00a0'}</span>
              </button>
            );
          })}
        </div>
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">Tap a day to open it.</p>
      </DialogBody>
    </Dialog>
  );
}

