import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { dayLabel, todayIso } from '@/screens/diary/rules.ts';
import { useStorageSlots } from '@/screens/diary/storage-slots.tsx';
import { bookedToday, due, inShop, live, mechanicOf, startOf, useBookIn, useNow, useWorkshopDay } from './workshop-day.tsx';

/**
 * Workshop › Overview (drawn as overview in generator/diary.mjs; Jack, 21 Oct,
 * docs/decisions/2026-10-21-workshop-overview.md): today's figures, then the
 * day's jobs in four tabs, and Planned effort from the capacity figures
 * (openspec/changes/planned-effort).
 */
type Tab = 'arrivals' | 'shared' | 'attention' | 'ready';
const TABS: [Tab, string][] = [['arrivals', 'Arrivals'], ['shared', 'Shared queue'], ['attention', 'Needs attention'], ['ready', 'Ready']];

/** "6h", or "6.5h" to the half hour, as drawn. */
const hoursOf = (minutes: number) => `${Math.round(minutes / 30) / 2}h`;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
  );
}

function Figure({ id, label, value, note, fill }: { id: string; label: string; value: string; note: string; fill?: number }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-4 max-md:flex-row max-md:flex-wrap max-md:items-baseline max-md:justify-between max-md:px-3.5 max-md:py-2.5">
      <h2 id={id} className="m-0 text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">{label}</h2>
      <p className="m-0 text-2xl font-bold max-md:text-xl">{value}</p>
      {/* A thin bar for the one figure that is a share (audit M7). */}
      {fill !== undefined ? (
        <div role="img" aria-label={`${fill}% of planned effort used today`} className="h-1 w-full overflow-hidden rounded-full bg-[var(--wh-surface-muted)] max-md:basis-full">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${fill}%` }} />
        </div>
      ) : null}
      <p className="m-0 text-size-13 text-[var(--wh-muted)] max-md:basis-full">{note}</p>
    </section>
  );
}

const BADGE = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap';
// "Kept on [slot]" for a bike in on a slot when the shop's slots are on
// (rs-overview-arrived; storage slots, 22 Oct), else "In the shop".
function Custody({ job, slotsOn }: { job: WorkshopJob; slotsOn: boolean }) {
  return inShop(job)
    ? <span className={`${BADGE} bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]`}>{slotsOn && job.storageSlotName ? `Kept on ${job.storageSlotName}` : 'In the shop'}</span>
    : <span className={`${BADGE} bg-[var(--wh-status-scheduled-bg)] text-[var(--wh-status-scheduled-ink)]`}>Expected</span>;
}

export function OverviewPage() {
  const isPhone = useMedia('(max-width: 767px)');
  // A touch screen gets 44px tabs and buttons, as the diary's (decision 68).
  const touch = useMedia('(pointer: coarse)') || isPhone;
  const now = useNow();
  const today = todayIso(now);
  const [tab, setTab] = useState<Tab>('arrivals');
  const tabButtons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  // Storage slots (Workshop day 27): the shop's, when they're on.
  const { on: slotsOn } = useStorageSlots();
  // The day's jobs and Book in, shared with Today (workshop-day.tsx).
  const day = useWorkshopDay(today);
  // The row has gone from its list once booked in: the focus stays on the page, on the tab showing.
  const booking = useBookIn(() => tabButtons.current[tab]?.focus());
  const { busy, refused } = booking;
  // Planned effort (Jack, 21 Oct, answer 2: once the capacity figures give it).
  // Left out, not shown as zero, while they can't be read.
  const effort = useQuery({
    queryKey: ['workshop-capacity', 'overview', today],
    queryFn: () => apiGet<{ days: { date: string; plannedMinutes?: number; availableMinutes?: number }[] }>(`/api/workshop-capacity?start=${today}&end=${today}`),
  });
  const effortDay = effort.data?.days.find((d) => d.date === today && typeof d.plannedMinutes === 'number' && typeof d.availableMinutes === 'number');

  const { all, expectedToday, inWorkshop } = day;
  const lists: Record<Tab, WorkshopJob[]> = {
    arrivals: day.arrivals,
    shared: all.filter((j) => live(j) && mechanicOf(j, today) === null && j.workState !== 'complete' && (inShop(j) || (j.custodyState === 'expected' && bookedToday(j, today)))),
    attention: inWorkshop.filter((j) => j.workState === 'waiting_parts' || j.workState === 'on_hold'),
    ready: day.ready,
  };
  const shown = lists[tab];
  const stillToArrive = lists.arrivals.length;

  const startBookIn = booking.start;
  const choose = (key: Tab) => { setTab(key); booking.clearRefused(); };

  const work = (j: WorkshopJob) => {
    const start = startOf(j, today);
    // A due arrival keeps its time beside the work, as drawn ("· 11:30 appointment").
    const extra = j.custodyState === 'expected' && !start ? 'drop-off'
      : j.custodyState === 'expected' && due(start, now) ? `${start} appointment`
      : j.workState === 'waiting_parts' ? 'waiting for parts'
      : j.workState === 'on_hold' ? 'on hold' : null;
    return extra ? `${j.title} · ${extra}` : j.title;
  };
  const name = (j: WorkshopJob) => (
    <Link to={`${ROUTES.diary}?job=${j.id}`} className="font-semibold text-[var(--wh-ink)] underline-offset-2 hover:underline">
      <span className="font-[family-name:var(--wh-font-mono)]">{j.reference}</span> · {j.customerName ?? 'No customer'}
    </Link>
  );
  const action = (j: WorkshopJob): ReactNode => {
    if (j.custodyState === 'expected') {
      const start = startOf(j, today);
      return due(start, now)
        ? <Button variant="accent" size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={busy === j.id} aria-label={`Book in ${j.reference}`} onClick={() => startBookIn(j)}>Book in</Button>
        : <span className="text-size-13 whitespace-nowrap max-md:text-sm"><span className="font-[family-name:var(--wh-font-mono)]">{start}</span> appointment</span>;
    }
    return <Link to={`${ROUTES.diary}?job=${j.id}`} aria-label={`Open job ${j.reference}`} className={`inline-flex items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--wh-on-brand)] hover:bg-[var(--accent-dark)] ${touch ? 'min-h-11' : 'min-h-8'}`}>Open job</Link>;
  };

  const dateLine = <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{`${dayLabel(today)} · one shop, one view of the work`}</p>;
  // Either read failing would make the figures look real when they aren't.
  if (day.failed) {
    return (
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
        {dateLine}
        <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the workshop’s jobs. Try again in a moment.</p>
        <div><Button className={touch ? 'min-h-11' : undefined} onClick={day.retry}>Try again</Button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
      {dateLine}
      <div className={`grid gap-3.5 max-md:grid-cols-1 max-md:gap-2.5 ${effortDay ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Figure id="ov-expected" label="Expected today" value={`${expectedToday.length} ${expectedToday.length === 1 ? 'bike' : 'bikes'}`} note={`${stillToArrive} still to arrive`} />
        <Figure id="ov-in-workshop" label="In the workshop" value={String(inWorkshop.length)} note={`${lists.ready.length} ready to collect`} />
        {effortDay ? (
          <Figure id="ov-effort" label="Planned effort" value={`${hoursOf(effortDay.plannedMinutes as number)} / ${hoursOf(effortDay.availableMinutes as number)}`} note="Shared and assigned, counted once"
            fill={(effortDay.availableMinutes as number) > 0 ? Math.min(100, Math.round(((effortDay.plannedMinutes as number) / (effortDay.availableMinutes as number)) * 100)) : undefined} />
        ) : null}
      </div>
      <div role="group" aria-label="Show jobs" className="flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => (
          <button key={key} ref={(el) => { tabButtons.current[key] = el; }} type="button" aria-pressed={tab === key} onClick={() => choose(key)}
            className={`inline-flex items-center rounded-full border px-3.5 text-sm font-semibold ${touch ? 'min-h-11' : 'min-h-9'} ${tab === key ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}>
            {`${label} · ${lists[key].length}`}
          </button>
        ))}
      </div>
      {refused ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{refused}</p> : null}
      <div className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        {shown.length === 0 ? <p className="m-0 px-4 py-3.5 text-sm text-[var(--wh-muted)]">{!day.loaded ? 'Loading…' : 'Nothing here.'}</p>
          : isPhone ? (
            <ul className="m-0 list-none p-0">
              {shown.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2.5 border-t border-[var(--wh-border)] px-3.5 py-2.5 first:border-t-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-size-15">{name(j)}</span>
                    <span className="text-size-13 text-[var(--wh-muted)]">{`${j.bikeLabel ?? 'No bike'} · ${work(j)}`}</span>
                    <span><Custody job={j} slotsOn={slotsOn} /></span>
                  </div>
                  <div className="shrink-0">{action(j)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-[var(--wh-muted)]">
                  <th scope="col" className="px-4 py-2.5">Job / customer</th>
                  <th scope="col" className="px-4 py-2.5">Bike</th>
                  <th scope="col" className="px-4 py-2.5">Work</th>
                  <th scope="col" className="px-4 py-2.5">Custody</th>
                  <th scope="col" className="px-4 py-2.5 text-right"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((j) => (
                  <tr key={j.id} className="border-t border-[var(--wh-border)]">
                    <td className="px-4 py-2.5">{name(j)}</td>
                    <td className="px-4 py-2.5">{j.bikeLabel ?? '—'}</td>
                    <td className="px-4 py-2.5">{work(j)}</td>
                    <td className="px-4 py-2.5"><Custody job={j} slotsOn={slotsOn} /></td>
                    <td className="px-4 py-2.5 text-right">{action(j)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {booking.dialog}
    </div>
  );
}
