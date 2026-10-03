import { useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { RequestDialog } from './request-dialog.tsx';
import {
  LEGEND, STATE_LABEL, addDays, dayLabel, diaryState, gridRange, hhmm, layoutLanes, todayIso, toMinutes,
  shortDay, waitingCard, weekLabel, weekOf, type DiaryState, type WaitingItem,
} from './rules.ts';

/**
 * Workshop › Diary, piece 1: seeing the week and the day (journey 12,
 * drawn by docs/design/user-journeys/generator/diary.mjs). Nothing here
 * changes a job yet; answering requests and moving jobs are the next pieces.
 * Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md
 *
 * The diary keeps its place in the address (?date=, ?view=day, ?who=), so a
 * reload or a shared link opens the same week.
 */

type Mechanic = { id: number; name: string; active: boolean };
type Settings = { openingHours?: { weekday: number; open: string; close: string }[] };
type Waiting = { count: number; items: WaitingItem[] };

const SLOT_H = 29; // one 30-minute row, as drawn

// Whole class strings, so Tailwind sees every one (never built from parts).
const BLOCK: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] border-[var(--wh-state-scheduled-ink)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] border-[var(--wh-state-pending-ink)] text-[var(--wh-state-pending-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] border-[var(--wh-state-hold-ink)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] border-[var(--wh-state-waiting-ink)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] border-[var(--wh-state-ready-ink)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] border-[var(--wh-state-cancelled-ink)] text-[var(--wh-state-cancelled-ink)]',
};
const CHIP: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

const SR = 'sr-only';

type Shown = WorkshopJob & { state: DiaryState };

function timeText(j: { startTime: string | null; endTime: string | null }) {
  return j.startTime ? `${j.startTime}${j.endTime ? `–${j.endTime}` : ''}` : 'no set time';
}

function describe(j: Shown, chosen: boolean) {
  const bike = j.bikeLabel || 'Bike';
  return [bike, j.title, j.customerName || 'Customer', j.reference, STATE_LABEL[j.state], timeText(j)]
    .join(', ') + (chosen ? ', chosen from Waiting for you' : '');
}

function JobBlock({ job, range, wide, chosen, lane }: {
  job: Shown; range: { start: number }; wide: boolean; chosen: boolean; lane?: { lane: number; total: number };
}) {
  const start = toMinutes(job.startTime as string);
  const end = job.endTime ? toMinutes(job.endTime) : start + 30;
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  const cancelled = job.state === 'cancelled';
  const style: CSSProperties = { top, height };
  if (lane && lane.total > 1) {
    style.left = `calc(3px + (100% - 6px) * ${lane.lane} / ${lane.total})`;
    style.width = `calc((100% - 6px) / ${lane.total} - 4px)`;
  } else {
    style.left = 3;
    style.right = 3;
  }
  return (
    <div
      title={describe(job, false)}
      data-chosen={chosen || undefined}
      className={`absolute flex flex-col overflow-hidden rounded-[5px] border-[1.75px] px-1.5 py-[3px] ${BLOCK[job.state]} ${cancelled ? 'opacity-80' : ''} ${chosen ? 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''}`}
      style={style}
    >
      <span className={SR}>{describe(job, chosen)}</span>
      <span aria-hidden="true" className={`truncate text-[11px] font-bold text-[var(--wh-ink)] ${cancelled ? 'line-through' : ''}`}>
        {job.bikeLabel || 'Bike'}
      </span>
      <span aria-hidden="true" className="truncate text-[10px] leading-tight font-bold">
        {wide ? `${job.title} · ${STATE_LABEL[job.state]}` : job.title}
      </span>
    </div>
  );
}

/** A change request's dashed outline at the time the customer asked for. */
function RequestedOutline({ job, range }: { job: Shown; range: { start: number } }) {
  const r = job.requested;
  if (!r?.startTime) return null;
  const start = toMinutes(r.startTime);
  const end = r.endTime ? toMinutes(r.endTime) : start + 30;
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  return (
    <div
      className="absolute right-[3px] left-[3px] overflow-hidden rounded-[5px] border-[1.75px] border-dashed border-[var(--wh-state-hold-ink)] px-1.5 py-[3px] text-[10px] font-bold text-[var(--wh-state-hold-ink)]"
      style={{ top, height }}
    >
      <span className={SR}>{`${job.bikeLabel || 'Bike'} asks to move here: ${timeText(r)}`}</span>
      <span aria-hidden="true" className="block truncate">{`Requested ${r.startTime}`}</span>
    </div>
  );
}

function Column({ label, jobs, outlines, range, wide, chosenId }: {
  label: string; jobs: Shown[]; outlines: Shown[]; range: { start: number; end: number }; wide: boolean; chosenId: number | null;
}) {
  const timed = jobs.filter((j) => j.startTime);
  const lanes = layoutLanes(timed.map((j) => {
    const s = toMinutes(j.startTime as string);
    return { id: j.id, start: s, end: j.endTime ? toMinutes(j.endTime) : s + 30 };
  }));
  const height = ((range.end - range.start) / 30) * SLOT_H;
  return (
    <div
      role="group"
      aria-label={label}
      className="relative border-l border-[var(--wh-border)] first:border-l-0"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2}px)`,
      }}
    >
      {timed.map((j) => (
        <JobBlock key={j.id} job={j} range={range} wide={wide} chosen={j.id === chosenId} lane={lanes.get(j.id)} />
      ))}
      {outlines.map((j) => (
        <RequestedOutline key={`req-${j.id}`} job={j} range={range} />
      ))}
    </div>
  );
}

function HourGutter({ range }: { range: { start: number; end: number } }) {
  const hours: number[] = [];
  for (let m = Math.ceil(range.start / 60) * 60; m < range.end; m += 60) hours.push(m);
  return (
    <div aria-hidden="true" className="relative bg-[var(--wh-surface-muted)]" style={{ height: ((range.end - range.start) / 30) * SLOT_H }}>
      {hours.map((m) => (
        <span key={m} className="absolute right-1 font-[family-name:var(--wh-font-mono)] text-[10px] text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * SLOT_H - 6, 1) }}>
          {hhmm(m)}
        </span>
      ))}
    </div>
  );
}

function Grid({ heads, columns, noTime, range, ariaLabel }: {
  heads: { key: string; top?: string; main: string; today?: boolean }[];
  columns: ReactNode[];
  noTime?: Shown[];
  range: { start: number; end: number };
  ariaLabel: string;
}) {
  const cols = `44px repeat(${heads.length}, minmax(0, 1fr))`;
  return (
    <section aria-label={ariaLabel} className="min-w-[720px] overflow-hidden rounded-[10px] md:min-w-0 border border-[var(--wh-border)] bg-[var(--wh-panel)]">
      <div className="grid border-b border-[var(--wh-border)]" style={{ gridTemplateColumns: cols }}>
        <div className="bg-[var(--wh-surface-muted)]" />
        {heads.map((h) => (
          <div key={h.key} className={`flex flex-col items-center border-l border-[var(--wh-border)] px-2 py-1.5 ${h.today ? 'bg-[var(--wh-surface-muted)]' : ''}`}>
            {h.top ? <span className="text-[11px] font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">{h.top}</span> : null}
            <span className={`text-sm font-bold ${h.today ? 'text-[var(--accent-dark)]' : ''}`}>{h.main}{h.today ? ' · Today' : ''}</span>
          </div>
        ))}
      </div>
      {noTime ? (
        <div className="grid border-b border-[var(--wh-border)]" style={{ gridTemplateColumns: '44px minmax(0, 1fr)' }}>
          <div aria-hidden="true" className="bg-[var(--wh-surface-muted)] pt-[3px] text-center text-[9px] leading-tight font-bold text-[var(--wh-muted)]">
            No
            <br />
            time
          </div>
          <div role="group" aria-label="No time" className="flex min-h-[26px] flex-wrap items-center gap-[5px] px-2 py-1">
            {noTime.map((j) => (
              <span key={j.id} title={describe(j, false)} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
                <span className={SR}>{describe(j, false)}</span>
                <span aria-hidden="true">{j.bikeLabel || 'Bike'}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <HourGutter range={range} />
        {columns}
      </div>
    </section>
  );
}

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${dir === 'prev' ? 90 : -90}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function initial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

export function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const today = todayIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : today;
  const view = params.get('view') === 'day' ? 'day' : 'week';
  const who = params.get('who');
  const [chosen, setChosen] = useState<number | null>(null);
  const [openItem, setOpenItem] = useState<WaitingItem | null>(null);

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  const days = view === 'week' ? weekOf(date) : [date];
  const start = days[0];
  const end = days[days.length - 1];

  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => apiGet<Mechanic[]>('/api/employees?role=mechanic') });
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<Settings>('/api/workshop-settings') });
  const waiting = useQuery({ queryKey: ['workshop-waiting'], queryFn: () => apiGet<Waiting>('/api/workshop-waiting'), refetchInterval: 60_000 });
  const jobs = useQuery({
    queryKey: ['workshop-jobs', start, end],
    queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${start}&end=${end}`),
    // Keep the last week on screen while the next one loads, rather than
    // blanking the grid on every arrow press.
    placeholderData: (previous) => previous,
  });

  const people = (mechanics.data ?? []).filter((m) => m.active);
  const whoId = who && people.some((m) => String(m.id) === who) ? Number(who) : null;

  const shown: Shown[] = (jobs.data ?? [])
    .map((j) => ({ ...j, state: diaryState(j) }))
    .filter((j): j is Shown => j.state !== 'hidden')
    .filter((j) => whoId === null || j.mechanicId === whoId);
  const range = gridRange(settings.data ?? {}, shown);
  const outlinesFor = (pred: (j: Shown) => boolean) =>
    shown.filter((j) => j.state === 'hold' && j.requested?.startTime && pred(j));

  const step = view === 'week' ? 7 : 1;
  const unit = view === 'week' ? 'week' : 'day';

  let grid: ReactNode;
  if (view === 'week') {
    grid = (
      <Grid
        ariaLabel={`Workshop diary, week of ${dayLabel(start)}`}
        range={range}
        heads={days.map((d) => {
          const [weekday, ...rest] = shortDay(d).split(' ');
          return { key: d, top: weekday, main: rest.join(' '), today: d === today };
        })}
        noTime={shown.filter((j) => !j.startTime)}
        columns={days.map((d) => (
          <Column
            key={d}
            label={dayLabel(d)}
            jobs={shown.filter((j) => j.jobDate === d)}
            outlines={outlinesFor((j) => j.requested?.jobDate === d)}
            range={range}
            wide={false}
            chosenId={chosen}
          />
        ))}
      />
    );
  } else {
    const cols: { key: string; name: string; id: number | null }[] = (whoId === null ? people : people.filter((m) => m.id === whoId))
      .map((m) => ({ key: String(m.id), name: m.name, id: m.id }));
    if (whoId === null && shown.some((j) => j.jobDate === date && j.startTime && j.mechanicId === null)) {
      cols.push({ key: 'none', name: 'Not assigned yet', id: null });
    }
    grid = (
      <Grid
        ariaLabel={`Workshop diary, ${dayLabel(date)}, by mechanic`}
        range={range}
        heads={cols.map((c) => ({ key: c.key, main: c.name }))}
        columns={cols.map((c) => (
          <Column
            key={c.key}
            label={c.name}
            jobs={shown.filter((j) => j.jobDate === date && j.mechanicId === c.id)}
            outlines={outlinesFor((j) => j.requested?.jobDate === date && (j.requested?.mechanicId ?? j.mechanicId) === c.id)}
            range={range}
            wide
            chosenId={chosen}
          />
        ))}
      />
    );
  }

  const items = waiting.data?.items ?? [];
  const chip = (key: string, label: string, name: string, badge: ReactNode, on: boolean) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      aria-label={name}
      onClick={() => set({ who: key === 'all' ? null : key })}
      className={`inline-flex min-h-11 items-center gap-[7px] rounded-full border py-[5px] pr-3.5 pl-[5px] text-[13px] font-semibold ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}
    >
      <span aria-hidden="true" className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${on ? 'bg-[var(--wh-panel)] text-[var(--wh-accent-soft-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
        {badge}
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar (decision 60): view · dates · people. */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Diary view" className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-[10px] bg-[var(--wh-surface-muted)] p-[3px]">
          {(['week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => set({ view: v === 'day' ? 'day' : null })}
              className={`inline-flex min-h-[38px] items-center rounded-lg px-4 text-[13px] font-semibold ${view === v ? 'bg-[var(--wh-panel)] shadow-[0_1px_2px_var(--wh-border)]' : ''}`}
            >
              {v === 'week' ? 'Week' : 'Day'}
            </button>
          ))}
        </div>
        <div className="grow" />
        <div className="inline-flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => set({ date: addDays(date, -step) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="prev" />
          </button>
          <span className="min-w-[164px] text-center text-sm font-semibold whitespace-nowrap">{view === 'week' ? weekLabel(start) : dayLabel(date)}</span>
          <button type="button" aria-label={`Next ${unit}`} onClick={() => set({ date: addDays(date, step) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="next" />
          </button>
          <button type="button" onClick={() => set({ date: null })} className="ml-0.5 min-h-11 rounded-md px-2.5 text-[13px] font-semibold">
            Today
          </button>
        </div>
        <div className="grow" />
        <div role="group" aria-label="Mechanic" className="flex flex-wrap items-center gap-1.5">
          {chip('all', 'Everyone', 'Everyone', <NavIcon name="customers" size={13} />, whoId === null)}
          {people.map((m) => chip(String(m.id), m.name.split(' ')[0], m.name, initial(m.name), whoId === m.id))}
        </div>
      </div>

      <div className="flex items-start gap-4">
        {/* Waiting for you (decision 14). */}
        <section aria-labelledby="waiting-heading" className="hidden w-[184px] shrink-0 flex-col gap-2 md:flex lg:w-[224px]">
          <h2 id="waiting-heading" className="m-0 text-sm font-bold">{`Waiting for you (${waiting.data?.count ?? items.length})`}</h2>
          {items.length === 0 && waiting.isSuccess ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">Nothing waiting.</p> : null}
          {items.map((item) => {
            const card = waitingCard(item);
            const on = chosen === item.jobId;
            const choose = () => {
              setChosen(item.jobId ?? null);
              if (item.jobDate) set({ date: item.jobDate, who: null });
            };
            return (
              <div
                key={`${item.kind}-${item.jobId}`}
                className={`flex flex-col gap-2 rounded-lg bg-[var(--wh-panel)] ${on ? 'border-2 border-[var(--accent)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'border border-[var(--wh-border)]'}`}
              >
                {/* One click chooses the card; double-click, or Open, opens it (decision 14). */}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={choose}
                  onDoubleClick={() => { choose(); setOpenItem(item); }}
                  className="flex flex-col gap-[5px] rounded-lg px-3 pt-2.5 pb-2.5 text-left"
                >
                  <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${CHIP[card.tone]}`}>{card.label}</span>
                  <span className="text-[13px] font-bold">{card.customer}</span>
                  <span className="text-xs">{card.detail}</span>
                </button>
                {on ? (
                  <button
                    type="button"
                    aria-label={`Open ${card.customer}'s request`}
                    onClick={() => setOpenItem(item)}
                    className="mx-3 mb-2.5 inline-flex min-h-8 self-start items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-bold text-[var(--wh-on-brand)]"
                  >
                    Open
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>

        <div className="flex min-w-0 grow flex-col gap-2.5">
          <div className="overflow-x-auto">{jobs.isLoading ? <p>Loading the diary…</p> : grid}</div>
          {jobs.isError ? <p role="alert">Wheelhouse couldn&apos;t load the diary. Try again in a moment.</p> : null}
          <ul aria-label="What the colours mean" className="m-0 flex list-none flex-wrap gap-3 p-0">
            {LEGEND.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5 text-xs">
                <span aria-hidden="true" className={`inline-block size-3.5 rounded-[3px] border-[1.75px] ${BLOCK[s]}`} />
                {STATE_LABEL[s]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} /> : null}
    </div>
  );
}
