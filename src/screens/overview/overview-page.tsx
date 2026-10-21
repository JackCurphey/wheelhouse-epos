import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { dayLabel, todayIso, toMinutes } from '@/screens/diary/rules.ts';

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
const byTime = (a: WorkshopJob, b: WorkshopJob) =>
  a.jobDate.localeCompare(b.jobDate) || (a.startTime ? (b.startTime ? a.startTime.localeCompare(b.startTime) : -1) : b.startTime ? 1 : 0);

/** Due to be booked in: no more than an hour away, or past; a drop-off is due all day. */
function due(j: WorkshopJob, now: Date): boolean {
  if (!j.startTime) return true;
  return toMinutes(j.startTime) - (now.getHours() * 60 + now.getMinutes()) <= 60;
}

function useIsPhone(): boolean {
  const query = '(max-width: 767px)';
  return useSyncExternalStore(
    (onChange) => {
      const mq = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
  );
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
  const isPhone = useIsPhone();
  const now = new Date();
  const today = todayIso(now);
  const [tab, setTab] = useState<Tab>('arrivals');
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // Today's jobs, and every bike in the shop whatever its days (a ready bike
  // from an earlier day has none today). Under 'workshop-jobs', so the
  // diary's changes refresh them too.
  const todays = useQuery({ queryKey: ['workshop-jobs', 'overview', today], queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${today}&end=${today}`) });
  const kept = useQuery({ queryKey: ['workshop-jobs', 'in-shop'], queryFn: () => apiGet<WorkshopJob[]>('/api/workshop-jobs?custody=in_shop') });

  const jobs = new Map<number, WorkshopJob>();
  for (const j of [...(todays.data ?? []), ...(kept.data ?? [])]) jobs.set(j.id, j);
  const all = [...jobs.values()].sort(byTime);
  const expectedToday = all.filter((j) => live(j) && j.jobDate === today);
  const inWorkshop = all.filter(inShop);
  const lists: Record<Tab, WorkshopJob[]> = {
    arrivals: expectedToday.filter((j) => j.custodyState === 'expected'),
    shared: all.filter((j) => live(j) && j.mechanicId === null && j.workState !== 'complete' && (inShop(j) || (j.custodyState === 'expected' && j.jobDate === today))),
    attention: inWorkshop.filter((j) => j.workState === 'waiting_parts' || j.workState === 'on_hold'),
    ready: inWorkshop.filter((j) => j.workState === 'complete'),
  };
  const shown = lists[tab];
  const stillToArrive = lists.arrivals.length;

  async function bookIn(j: WorkshopJob) {
    setBusy(j.id);
    setRefused(null);
    try {
      await jobAction(j.id, 'book-in', j.version);
    } catch (err) {
      setRefused(err instanceof ApiError ? err.message : 'Wheelhouse couldn’t book that in. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
      setBusy(null);
    }
  }

  const work = (j: WorkshopJob) => {
    const extra = j.custodyState === 'expected' && !j.startTime ? 'drop-off'
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
      return due(j, now)
        ? <Button size={isPhone ? 'default' : 'sm'} disabled={busy === j.id} aria-label={`Book in ${j.reference}`} onClick={() => void bookIn(j)}>Book in</Button>
        : <span className="text-[13px] whitespace-nowrap max-md:text-sm"><span className="font-[family-name:var(--wh-font-mono)]">{j.startTime}</span> appointment</span>;
    }
    return <Link to={`${ROUTES.diary}?job=${j.id}`} aria-label={`Open job ${j.reference}`} className="inline-flex min-h-9 items-center rounded-md border border-[var(--wh-input-border)] px-3 text-sm font-semibold max-md:min-h-11">Open job</Link>;
  };

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
      <p className="m-0 text-[15px] text-[var(--wh-muted)] max-md:text-sm">{`${dayLabel(today)} · one shop, one view of the work`}</p>
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1 max-md:gap-2.5">
        <Figure id="ov-expected" label="Expected today" value={`${expectedToday.length} ${expectedToday.length === 1 ? 'bike' : 'bikes'}`} note={`${stillToArrive} still to arrive`} />
        <Figure id="ov-in-workshop" label="In the workshop" value={String(inWorkshop.length)} note={`${lists.ready.length} ready to collect`} />
      </div>
      <div role="group" aria-label="Show jobs" className="flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}
            className={`inline-flex items-center rounded-full border px-3.5 text-sm font-semibold ${isPhone ? 'min-h-11' : 'min-h-9'} ${tab === key ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}>
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
