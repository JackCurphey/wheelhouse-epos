import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { dayLabel, todayIso, toMinutes } from '@/screens/diary/rules.ts';
import { jobRefusalText } from '@/screens/diary/refusal-words.ts';

/**
 * Workshop › Overview (drawn as overview in generator/diary.mjs; Jack, 21 Oct,
 * docs/decisions/2026-10-21-workshop-overview.md): today's figures, then the
 * day's jobs in four tabs. Planned effort waits for Mark's capacity figures
 * (openspec/changes/workshop-overview/design.md).
 */
type Tab = 'arrivals' | 'shared' | 'attention' | 'ready';
const TABS: [Tab, string][] = [['arrivals', 'Arrivals'], ['shared', 'Shared queue'], ['attention', 'Needs attention'], ['ready', 'Ready']];

// A booking that stands: not a request, an offer, or one that has ended.
const live = (j: WorkshopJob) => j.bookingState === 'scheduled' || j.bookingState === 'reschedule_requested';
const inShop = (j: WorkshopJob) => j.custodyState === 'in_shop';
// A job over several days is read from today's own day, as the diary draws it:
// its time and its mechanic (fresh review, 21 Oct).
const todayPart = (j: WorkshopJob, today: string) => j.parts?.find((p) => p.date === today);
const startOf = (j: WorkshopJob, today: string) => todayPart(j, today)?.startTime ?? (j.jobDate === today ? j.startTime : null) ?? null;
const mechanicOf = (j: WorkshopJob, today: string) => { const p = todayPart(j, today); return p ? p.mechanicId : j.mechanicId; };
const bookedToday = (j: WorkshopJob, today: string) => j.jobDate === today || Boolean(todayPart(j, today));

/** Due to be booked in: no more than an hour away, or past; a drop-off is due all day. */
function due(start: string | null, now: Date): boolean {
  if (!start) return true;
  return toMinutes(start) - (now.getHours() * 60 + now.getMinutes()) <= 60;
}

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

/** The time, moving on by itself each minute, so "due" and today keep up on a page left open. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Figure({ id, label, value, note }: { id: string; label: string; value: string; note: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-4 max-md:flex-row max-md:flex-wrap max-md:items-baseline max-md:justify-between max-md:px-3.5 max-md:py-2.5">
      <h2 id={id} className="m-0 text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">{label}</h2>
      <p className="m-0 text-2xl font-bold max-md:text-xl">{value}</p>
      <p className="m-0 text-[13px] text-[var(--wh-muted)] max-md:basis-full">{note}</p>
    </section>
  );
}

const BADGE = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap';
function Custody({ job }: { job: WorkshopJob }) {
  return inShop(job)
    ? <span className={`${BADGE} bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]`}>In the shop</span>
    : <span className={`${BADGE} bg-[var(--wh-status-scheduled-bg)] text-[var(--wh-status-scheduled-ink)]`}>Expected</span>;
}

export function OverviewPage() {
  const queryClient = useQueryClient();
  const isPhone = useMedia('(max-width: 767px)');
  // A touch screen gets 44px tabs and buttons, as the diary's (decision 68).
  const touch = useMedia('(pointer: coarse)') || isPhone;
  const now = useNow();
  const today = todayIso(now);
  const [tab, setTab] = useState<Tab>('arrivals');
  const arrivalsTab = useRef<HTMLButtonElement>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // Today's jobs, and every bike in the shop whatever its days (a ready bike
  // from an earlier day has none today). Under 'workshop-jobs', so the
  // diary's changes refresh them too.
  const todays = useQuery({ queryKey: ['workshop-jobs', 'overview', today], queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${today}&end=${today}`) });
  const kept = useQuery({ queryKey: ['workshop-jobs', 'in-shop'], queryFn: () => apiGet<WorkshopJob[]>('/api/workshop-jobs?custody=in_shop') });

  const jobs = new Map<number, WorkshopJob>();
  for (const j of [...(todays.data ?? []), ...(kept.data ?? [])]) jobs.set(j.id, j);
  const sortKey = (j: WorkshopJob) => `${bookedToday(j, today) ? today : j.jobDate} ${startOf(j, today) ?? j.startTime ?? '~'}`;
  // Compared as plain text, so a job with no time ("~") comes last.
  const all = [...jobs.values()].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
  const expectedToday = all.filter((j) => live(j) && bookedToday(j, today));
  const inWorkshop = all.filter(inShop);
  const lists: Record<Tab, WorkshopJob[]> = {
    arrivals: expectedToday.filter((j) => j.custodyState === 'expected'),
    shared: all.filter((j) => live(j) && mechanicOf(j, today) === null && j.workState !== 'complete' && (inShop(j) || (j.custodyState === 'expected' && bookedToday(j, today)))),
    attention: inWorkshop.filter((j) => j.workState === 'waiting_parts' || j.workState === 'on_hold'),
    ready: inWorkshop.filter((j) => j.workState === 'complete'),
  };
  const shown = lists[tab];
  const stillToArrive = lists.arrivals.length;

  async function bookIn(j: WorkshopJob) {
    setBusy(j.id);
    setRefused(null);
    let done = false;
    try {
      await jobAction(j.id, 'book-in', j.version);
      done = true;
    } catch (err) {
      setRefused(err instanceof ApiError ? jobRefusalText(err) : 'Wheelhouse couldn’t book that in. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
      setBusy(null);
    }
    // The row has gone from Arrivals: the focus stays on the page, on its tab.
    if (done) arrivalsTab.current?.focus();
  }
  const choose = (key: Tab) => { setTab(key); setRefused(null); };

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
        ? <Button variant="accent" size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={busy === j.id} aria-label={`Book in ${j.reference}`} onClick={() => void bookIn(j)}>Book in</Button>
        : <span className="text-[13px] whitespace-nowrap max-md:text-sm"><span className="font-[family-name:var(--wh-font-mono)]">{start}</span> appointment</span>;
    }
    return <Link to={`${ROUTES.diary}?job=${j.id}`} aria-label={`Open job ${j.reference}`} className={`inline-flex items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--wh-on-brand)] hover:bg-[var(--accent-dark)] ${touch ? 'min-h-11' : 'min-h-8'}`}>Open job</Link>;
  };

  const dateLine = <p className="m-0 text-[15px] text-[var(--wh-muted)] max-md:text-sm">{`${dayLabel(today)} · one shop, one view of the work`}</p>;
  // Either read failing would make the figures look real when they aren't.
  if (todays.isError || kept.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
        {dateLine}
        <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the workshop’s jobs. Try again in a moment.</p>
        <div><Button className={touch ? 'min-h-11' : undefined} onClick={() => { void todays.refetch(); void kept.refetch(); }}>Try again</Button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
      {dateLine}
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1 max-md:gap-2.5">
        <Figure id="ov-expected" label="Expected today" value={`${expectedToday.length} ${expectedToday.length === 1 ? 'bike' : 'bikes'}`} note={`${stillToArrive} still to arrive`} />
        <Figure id="ov-in-workshop" label="In the workshop" value={String(inWorkshop.length)} note={`${lists.ready.length} ready to collect`} />
      </div>
      <div role="group" aria-label="Show jobs" className="flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => (
          <button key={key} ref={key === 'arrivals' ? arrivalsTab : undefined} type="button" aria-pressed={tab === key} onClick={() => choose(key)}
            className={`inline-flex items-center rounded-full border px-3.5 text-sm font-semibold ${touch ? 'min-h-11' : 'min-h-9'} ${tab === key ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}>
            {`${label} · ${lists[key].length}`}
          </button>
        ))}
      </div>
      {refused ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{refused}</p> : null}
      <div className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        {shown.length === 0 ? <p className="m-0 px-4 py-3.5 text-sm text-[var(--wh-muted)]">{todays.isPending || kept.isPending ? 'Loading…' : 'Nothing here.'}</p>
          : isPhone ? (
            <ul className="m-0 list-none p-0">
              {shown.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2.5 border-t border-[var(--wh-border)] px-3.5 py-2.5 first:border-t-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px]">{name(j)}</span>
                    <span className="text-[13px] text-[var(--wh-muted)]">{`${j.bikeLabel ?? 'No bike'} · ${work(j)}`}</span>
                    <span><Custody job={j} /></span>
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
                    <td className="px-4 py-2.5"><Custody job={j} /></td>
                    <td className="px-4 py-2.5 text-right">{action(j)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
