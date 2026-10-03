import { createContext, useContext, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { createPortal } from 'react-dom';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { HeaderSlotContext } from '@/staff/header-slot.ts';
import { RequestDialog } from './request-dialog.tsx';
import { NewJobDialog } from './new-job-dialog.tsx';
import { JobDialog } from './job-dialog.tsx';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import {
  LEGEND, STATE_LABEL, SNAP_MIN, addDays, dropStart, dayLabel, diaryState, gridRange, hhmm, layoutLanes, todayIso, toMinutes,
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

type Mechanic = { id: number; name: string; active: boolean; workingDays?: number[] };
type Settings = { openingHours?: { weekday: number; open: string; close: string }[] };
type Waiting = { count: number; items: WaitingItem[] };

const SLOT_H = 29; // one 30-minute row, as drawn (desktop and tablet)
// The phone's timeline is taller: 44px a row (P_SLOT in the drawings).
const PHONE_SLOT_H = 44;
const SlotContext = createContext(SLOT_H);

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

type Preview = { jobId: number; colIndex: number; startMin: number; durationMin: number };

/**
 * Moving a job (piece 3): by dragging, or from the keyboard (Enter picks it
 * up, arrows move it, Enter saves, Escape puts it back). Shared through a
 * context so each block can take part without threading props through the
 * grid. A job being moved stays in its own column's markup and is shifted
 * across visually, so it keeps keyboard focus as it moves between days.
 */
type MoveApi = {
  preview: Preview | null;
  onKeyDown: (job: Shown, colIndex: number, e: KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (job: Shown, colIndex: number, e: PointerEvent<HTMLElement>) => void;
  /** A click (not a drag) or Enter opens the job page. */
  onOpen: (job: Shown) => void;
};
const MoveContext = createContext<MoveApi | null>(null);

/** New job's "choose a time" step (decision 22): a click on a column picks the time there. */
type PickApi = { onPick: (colIndex: number, y: number) => void } | null;
const PickContext = createContext<PickApi>(null);

/** A booking request is answered before it is moved; a cancellation isn't moved at all. */
const movable = (j: Shown) => Boolean(j.startTime) && j.state !== 'pending' && j.state !== 'cancelled';

function JobBlock({ job, range, wide, chosen, lane, colIndex }: {
  job: Shown; range: { start: number }; wide: boolean; chosen: boolean; lane?: { lane: number; total: number }; colIndex: number;
}) {
  const SLOT_H = useContext(SlotContext);
  const move = useContext(MoveContext);
  const picking = useContext(PickContext);
  const moving = move?.preview?.jobId === job.id ? move.preview : null;
  const start = moving ? moving.startMin : toMinutes(job.startTime as string);
  const end = moving ? moving.startMin + moving.durationMin : job.endTime ? toMinutes(job.endTime) : start + 30;
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  const cancelled = job.state === 'cancelled';
  const style: CSSProperties = { top, height };
  if (moving) {
    // Shifted across by whole columns (each column is 100% of this one's width).
    style.left = `calc(3px + ${moving.colIndex - colIndex} * 100%)`;
    style.width = 'calc(100% - 6px)';
  } else if (lane && lane.total > 1) {
    style.left = `calc(3px + (100% - 6px) * ${lane.lane} / ${lane.total})`;
    style.width = `calc((100% - 6px) / ${lane.total} - 4px)`;
  } else {
    style.left = 3;
    style.right = 3;
  }
  const className = `absolute flex flex-col overflow-hidden rounded-[5px] border-[1.75px] px-1.5 py-[3px] text-left ${BLOCK[job.state]} ${cancelled ? 'opacity-80' : ''} ${chosen ? 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''} ${moving ? 'z-[2] cursor-grabbing shadow-[0_10px_26px_var(--wh-backdrop)]' : ''} ${picking ? 'pointer-events-none opacity-50' : ''}`;
  const inner = (
    <>
      <span className={SR}>{describe(job, chosen)}</span>
      <span aria-hidden="true" className={`truncate text-[11px] font-bold text-[var(--wh-ink)] ${cancelled ? 'line-through' : ''}`}>
        {job.bikeLabel || 'Bike'}
      </span>
      <span aria-hidden="true" className="truncate text-[10px] leading-tight font-bold">
        {wide ? `${job.title} · ${STATE_LABEL[job.state]}` : job.title}
      </span>
    </>
  );
  if (!move || !movable(job) || picking) {
    return (
      <div title={describe(job, false)} className={className} style={style}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      title={describe(job, false)}
      aria-describedby="diary-move-hint"
      onKeyDown={(e) => move.onKeyDown(job, colIndex, e)}
      onKeyUp={(e) => { if (moving && e.key === ' ') e.preventDefault(); }}
      onPointerDown={(e) => move.onPointerDown(job, colIndex, e)}
      onClick={() => move.onOpen(job)}
      className={`${className} cursor-grab touch-none`}
      style={style}
    >
      {inner}
    </button>
  );
}

/** A change request's dashed outline at the time the customer asked for. */
function RequestedOutline({ job, range }: { job: Shown; range: { start: number } }) {
  const SLOT_H = useContext(SlotContext);
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

function Column({ label, index, jobs, outlines, range, wide, chosenId }: {
  label: string; index: number; jobs: Shown[]; outlines: Shown[]; range: { start: number; end: number }; wide: boolean; chosenId: number | null;
}) {
  const SLOT_H = useContext(SlotContext);
  const timed = jobs.filter((j) => j.startTime);
  const lanes = layoutLanes(timed.map((j) => {
    const s = toMinutes(j.startTime as string);
    return { id: j.id, start: s, end: j.endTime ? toMinutes(j.endTime) : s + 30 };
  }));
  const height = ((range.end - range.start) / 30) * SLOT_H;
  const pick = useContext(PickContext);
  return (
    // While choosing a time for a new job, a click on the column picks the
    // time there; "Enter a time instead" is the keyboard way (decision 22).
    <div
      role="group"
      aria-label={label}
      data-diary-col={index}
      onClick={pick ? (e) => pick.onPick(index, e.clientY - e.currentTarget.getBoundingClientRect().top) : undefined}
      className={`relative border-l border-[var(--wh-border)] first:border-l-0 ${pick ? 'cursor-pointer bg-[var(--wh-accent-soft)]/30' : ''}`}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2}px)`,
      }}
    >
      {timed.map((j) => (
        <JobBlock key={j.id} job={j} range={range} wide={wide} chosen={j.id === chosenId} lane={lanes.get(j.id)} colIndex={index} />
      ))}
      {outlines.map((j) => (
        <RequestedOutline key={`req-${j.id}`} job={j} range={range} />
      ))}
    </div>
  );
}

function HourGutter({ range }: { range: { start: number; end: number } }) {
  const SLOT_H = useContext(SlotContext);
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

/** "5–11 Oct", or "28 Sep – 4 Oct" across months: the phone's week label. */
function shortWeek(monday: string) {
  const [, d1, m1] = shortDay(monday).split(' ');
  const [, d2, m2] = shortDay(addDays(monday, 6)).split(' ');
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`;
}

function initial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

/** True below the tablet width (768px), where the diary is one day at a time. */
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

export function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const isPhone = useIsPhone();
  const today = todayIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : today;
  // On a phone the diary is always one day (decision 68); the week is the strip of days.
  const view = isPhone || params.get('view') === 'day' ? 'day' : 'week';
  const who = params.get('who');
  const slotPx = isPhone ? PHONE_SLOT_H : SLOT_H;
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
  // A phone loads the whole week, so tapping another day in the strip is instant.
  const fetchDays = isPhone ? weekOf(date) : days;
  const start = fetchDays[0];
  const end = fetchDays[fetchDays.length - 1];

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
  // A phone shows Everyone in one column unless "By mechanic" is chosen.
  const byMechanic = !isPhone || who === 'bymech';

  const shown: Shown[] = (jobs.data ?? [])
    .map((j) => ({ ...j, state: diaryState(j) }))
    .filter((j): j is Shown => j.state !== 'hidden')
    .filter((j) => whoId === null || j.mechanicId === whoId);
  const range = gridRange(settings.data ?? {}, shown);
  const outlinesFor = (pred: (j: Shown) => boolean) =>
    shown.filter((j) => j.state === 'hold' && j.requested?.startTime && pred(j));

  const step = view === 'week' ? 7 : 1;
  const unit = view === 'week' ? 'week' : 'day';

  // The grid's columns: the week's days, or the day's mechanics.
  type Col = { key: string; label: string; date: string; mechanicId: number | null; all?: boolean };
  let columns: Col[];
  if (view === 'week') {
    columns = days.map((d) => ({ key: d, label: dayLabel(d), date: d, mechanicId: null }));
  } else if (whoId === null && !byMechanic) {
    columns = [{ key: 'all', label: 'Everyone', date, mechanicId: null, all: true }];
  } else {
    columns = (whoId === null ? people : people.filter((m) => m.id === whoId))
      .map((m) => ({ key: String(m.id), label: m.name, date, mechanicId: m.id }));
    if (whoId === null && shown.some((j) => j.jobDate === date && j.startTime && j.mechanicId === null)) {
      columns.push({ key: 'none', label: 'Not assigned yet', date, mechanicId: null });
    }
  }
  const jobsIn = (c: Col) => shown.filter((j) => j.jobDate === c.date && (view === 'week' || c.all || j.mechanicId === c.mechanicId));
  const outlinesIn = (c: Col) => outlinesFor((j) => j.requested?.jobDate === c.date
    && (view === 'week' || c.all || (j.requested?.mechanicId ?? j.mechanicId) === c.mechanicId));

  // ---- Moving a job (piece 3) ----
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  // The latest preview, for the pointer-up handler (added once per drag).
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;
  const [moveNote, setMoveNote] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const drag = useRef<{ job: Shown; origCol: number; x: number; y: number; grab: number; moved: boolean } | null>(null);

  const durationOf = (j: Shown) => {
    const s0 = toMinutes(j.startTime as string);
    return j.endTime ? toMinutes(j.endTime) - s0 : 30;
  };
  const whereText = (p: Preview) => {
    const c = columns[p.colIndex];
    return `${shortDay(c.date)}, ${hhmm(p.startMin)}–${hhmm(p.startMin + p.durationMin)}${view === 'day' && !c.all ? `, ${c.label}` : ''}`;
  };
  const startOf = (j: Shown, colIndex: number): Preview => ({ jobId: j.id, colIndex, startMin: toMinutes(j.startTime as string), durationMin: durationOf(j) });

  async function save(job: Shown, p: Preview, origCol: number) {
    const c = columns[p.colIndex];
    const same = p.colIndex === origCol && p.startMin === toMinutes(job.startTime as string);
    if (same) {
      setPreview(null);
      return;
    }
    const body: Record<string, unknown> = {
      jobDate: c.date, startTime: hhmm(p.startMin), endTime: hhmm(p.startMin + p.durationMin), version: job.version,
    };
    if (view === 'day' && !c.all && c.mechanicId !== job.mechanicId) body.mechanicId = c.mechanicId;
    setMoveError(null);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}`, body, { method: 'PUT' });
      setMoveNote(`${job.bikeLabel || 'Bike'} moved to ${whereText(p)}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
      ]);
    } catch (err) {
      const why = err instanceof ApiError
        ? (err.code === 'stale' ? 'This job changed while you were looking at it.' : err.message)
        : "Couldn't reach the server — try again.";
      setMoveError(`Couldn't move ${job.bikeLabel || 'Bike'}: ${why}`);
      if (err instanceof ApiError && err.code === 'stale') void queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
    } finally {
      setPreview(null);
    }
  }

  const [openJobId, setOpenJobId] = useState<number | null>(null);
  // The click that follows the end of a drag must not open the job.
  const justDragged = useRef(false);
  const openJob = (job: Shown) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (preview) return;
    setOpenJobId(job.id);
  };
  const moveApi: MoveApi = {
    preview,
    onOpen: openJob,
    onKeyDown(job, colIndex, e) {
      const bike = job.bikeLabel || 'Bike';
      const hint = 'Use the arrow keys to move it, Enter to save, Escape to cancel.';
      if (!preview || preview.jobId !== job.id) {
        if (e.key === 'Enter') {
          // Handled here rather than by the button's own click, so it opens once.
          e.preventDefault();
          openJob(job);
          return;
        }
        if (e.key !== 'm' && e.key !== 'M') return;
        e.preventDefault();
        const p = startOf(job, colIndex);
        setPreview(p);
        setMoveError(null);
        setMoveNote(`Moving ${bike}. ${whereText(p)}. ${hint}`);
        return;
      }
      let next: Preview | null = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const delta = e.key === 'ArrowUp' ? -SNAP_MIN : SNAP_MIN;
        next = { ...preview, startMin: Math.max(range.start, Math.min(range.end - preview.durationMin, preview.startMin + delta)) };
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const ci = Math.max(0, Math.min(columns.length - 1, preview.colIndex + (e.key === 'ArrowLeft' ? -1 : 1)));
        next = { ...preview, colIndex: ci };
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void save(job, preview, colIndex);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPreview(null);
        setMoveNote(`Move cancelled. ${bike} stays at ${whereText(startOf(job, colIndex))}.`);
        return;
      }
      if (next) {
        e.preventDefault();
        setPreview(next);
        setMoveNote(`Moving ${bike}. ${whereText(next)}. ${hint}`);
      }
    },
    onPointerDown(job, colIndex, e) {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      drag.current = { job, origCol: colIndex, x: e.clientX, y: e.clientY, grab: e.clientY - rect.top, moved: false };
      const onMove = (ev: globalThis.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.abs(ev.clientX - d.x) < 4 && Math.abs(ev.clientY - d.y) < 4) return;
        d.moved = true;
        const cols = [...document.querySelectorAll<HTMLElement>('[data-diary-col]')];
        const over = cols.find((el) => {
          const r = el.getBoundingClientRect();
          return ev.clientX >= r.left && ev.clientX < r.right;
        });
        const colEl = over ?? cols[d.origCol];
        if (!colEl) return;
        const ci = Number(colEl.dataset.diaryCol);
        const top = colEl.getBoundingClientRect().top;
        setPreview({ ...startOf(d.job, ci), startMin: dropStart(ev.clientY - top - d.grab, range, durationOf(d.job), slotPx) });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const d = drag.current;
        drag.current = null;
        const p = previewRef.current;
        if (d?.moved) {
          justDragged.current = true;
          // A drag that ends off the block fires no click, so don't let the flag linger.
          setTimeout(() => { justDragged.current = false; }, 0);
        }
        if (d?.moved && p) void save(d.job, p, d.origCol);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
  };

  const grid: ReactNode = (
    <Grid
      ariaLabel={view === 'week' ? `Workshop diary, week of ${dayLabel(start)}` : `Workshop diary, ${dayLabel(date)}, by mechanic`}
      range={range}
      heads={view === 'week'
        ? days.map((d) => {
          const [weekday, ...rest] = shortDay(d).split(' ');
          return { key: d, top: weekday, main: rest.join(' '), today: d === today };
        })
        : columns.map((c) => ({ key: c.key, main: c.label }))}
      noTime={view === 'week' ? shown.filter((j) => !j.startTime) : undefined}
      columns={columns.map((c, i) => (
        <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={view === 'day'} chosenId={chosen} />
      ))}
    />
  );

  // ---- New job (piece 5) ----
  const [picking, setPicking] = useState(false);
  const [newJob, setNewJob] = useState<{ date: string; startMin: number; mechanicId: number | null; auto: boolean } | null>(null);
  /** Decision 18: the mechanic working that day with the most free time (fewest booked minutes). */
  const freest = (day: string): number | null => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const working = people.filter((m) => !Array.isArray(m.workingDays) || m.workingDays.includes(weekday));
    const pool = working.length ? working : people;
    let best: number | null = null;
    let bestMinutes = Infinity;
    for (const m of pool) {
      const booked = (jobs.data ?? []).filter((j) => j.jobDate === day && j.mechanicId === m.id && j.startTime && j.endTime)
        .reduce((sum, j) => sum + toMinutes(j.endTime as string) - toMinutes(j.startTime as string), 0);
      if (booked < bestMinutes) { best = m.id; bestMinutes = booked; }
    }
    return best;
  };
  const pickApi: PickApi = picking ? {
    onPick(colIndex, y) {
      const c = columns[colIndex];
      const startMin = dropStart(y, range, 30, slotPx);
      const fixed = view === 'day' && !c.all;
      setNewJob({ date: c.date, startMin, mechanicId: fixed ? c.mechanicId : freest(c.date), auto: !fixed });
      setPicking(false);
    },
  } : null;
  const enterInstead = () => {
    setNewJob({ date, startMin: range.start, mechanicId: freest(date), auto: true });
    setPicking(false);
  };
  const newJobDialog = newJob ? (
    <NewJobDialog
      key={`${newJob.date}-${newJob.startMin}`}
      date={newJob.date}
      startMin={newJob.startMin}
      mechanicId={newJob.mechanicId}
      autoChosen={newJob.auto}
      people={people}
      onClose={() => setNewJob(null)}
    />
  ) : null;
  const pickBar = picking ? (
    <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-highlight)] bg-[var(--wh-accent-soft)] px-3 py-2 text-sm text-[var(--wh-accent-soft-ink)]">
      <span className="grow font-semibold">Choose a time for the new job.</span>
      <button type="button" onClick={enterInstead} className="min-h-11 rounded-md px-3 font-semibold underline">Enter a time instead</button>
      <button type="button" onClick={() => setPicking(false)} className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-semibold text-[var(--wh-ink)]">Cancel</button>
    </div>
  ) : null;

  // ---- Phone (piece 4) ----
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The top bar's action slot, drawn by the frame outside this page.
  const headerSlot = useContext(HeaderSlotContext);
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

  if (isPhone) {
    const week = weekOf(date);
    const showing = whoId !== null ? people.find((m) => m.id === whoId)?.name ?? 'Everyone' : byMechanic ? 'By mechanic' : 'Everyone';
    const chosenItem = items.find((i) => i.jobId === chosen) ?? null;
    const hours: number[] = [];
    for (let m = Math.ceil(range.start / 60) * 60; m < range.end; m += 60) hours.push(m);
    const noTime = columns.length === 1 ? shown.filter((j) => j.jobDate === date && !j.startTime) : [];
    const pickPeople = (value: string | null) => { set({ who: value }); setPeopleOpen(false); };
    const chooseItem = (item: WaitingItem) => {
      if (chosen === item.jobId) { setOpenItem(item); setSheetOpen(false); return; }
      setChosen(item.jobId ?? null);
      if (item.jobDate) set({ date: item.jobDate, who: null });
      setSheetOpen(false);
    };
    return (
      <div className="-m-3.5 flex flex-col">
        {headerSlot ? createPortal(
          <button
            type="button"
            aria-label={`Waiting for you, ${waiting.data?.count ?? items.length}`}
            onClick={() => setSheetOpen(true)}
            className="inline-flex min-h-11 items-center gap-[7px] rounded-[10px] border border-[var(--wh-on-accent)]/35 pr-2.5 pl-3 text-[15px] font-semibold text-[var(--sidebar-foreground)]"
          >
            Waiting
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-panel)] px-[7px] text-[13px] font-bold text-[var(--wh-ink)]">
              {waiting.data?.count ?? items.length}
            </span>
          </button>,
          headerSlot,
        ) : null}
        {headerSlot ? createPortal(
          <button
            type="button"
            aria-label={picking ? 'Choose a time' : 'New job'}
            aria-pressed={picking}
            onClick={() => setPicking((v) => !v)}
            className={`inline-flex size-11 items-center justify-center rounded-[10px] text-[22px] ${picking ? 'bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}
          >
            <span aria-hidden="true">+</span>
          </button>,
          headerSlot,
        ) : null}

        <div className="flex flex-col gap-2 border-b border-[var(--wh-border)] px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="relative">
              <button
                type="button"
                aria-expanded={peopleOpen}
                aria-label={`Showing ${showing}. Change whose jobs are shown`}
                onClick={() => setPeopleOpen((o) => !o)}
                className="inline-flex min-h-11 items-center gap-[7px] rounded-full bg-[var(--wh-accent-soft)] py-[5px] pr-2.5 pl-1.5 text-sm font-semibold whitespace-nowrap text-[var(--wh-accent-soft-ink)]"
              >
                <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--wh-panel)]">
                  {whoId !== null ? initial(showing) : <NavIcon name="customers" size={14} />}
                </span>
                {showing}
                <Chevron dir="next" />
              </button>
              {peopleOpen ? (
                <div role="menu" aria-label="Whose jobs to show" className="absolute top-full left-0 z-20 mt-1 flex min-w-[200px] flex-col rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-[0_10px_26px_var(--wh-backdrop)]">
                  {[{ v: null as string | null, label: 'Everyone' }, { v: 'bymech', label: 'By mechanic' }, ...people.map((m) => ({ v: String(m.id), label: m.name }))].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={showing === o.label}
                      onClick={() => pickPeople(o.v)}
                      className={`min-h-11 rounded-md px-3 text-left text-sm font-semibold ${showing === o.label ? 'bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'hover:bg-[var(--wh-hover)]'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" aria-label="Previous week" onClick={() => set({ date: addDays(date, -7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="prev" />
              </button>
              <span className="min-w-[74px] text-center text-sm font-bold whitespace-nowrap">{shortWeek(week[0])}</span>
              <button type="button" aria-label="Next week" onClick={() => set({ date: addDays(date, 7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="next" />
              </button>
            </div>
          </div>
          {/* The week's days replace the Week/Day switch (decision 68). */}
          <div role="tablist" aria-label="Choose a day" className="flex gap-0.5 rounded-[10px] bg-[var(--wh-surface-muted)] p-[3px]">
            {week.map((d) => {
              const on = d === date;
              const [wd, dn] = shortDay(d).split(' ');
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`${dayLabel(d)}${d === today ? ', today' : ''}`}
                  onClick={() => set({ date: d })}
                  className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg ${on ? 'bg-[var(--wh-panel)] shadow-[0_1px_2px_var(--wh-border)]' : ''}`}
                >
                  <span className={`text-xs font-bold uppercase ${on ? '' : 'text-[var(--wh-muted)]'}`}>{wd}</span>
                  <span className="text-base leading-tight font-bold">{dn}</span>
                  {d === today ? <span aria-hidden="true" className="absolute bottom-1 size-[5px] rounded-full bg-[var(--wh-highlight)]" /> : null}
                </button>
              );
            })}
          </div>
          {columns.length === 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">No time</span>
              <div role="group" aria-label="No time" className="flex flex-wrap gap-1.5">
                {noTime.length === 0 ? <span className="text-[13px] text-[var(--wh-muted)]">None</span> : null}
                {noTime.map((j) => (
                  <span key={j.id} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--wh-state-scheduled-ink)] px-3 text-[13px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
                    <span className={SR}>{describe(j, false)}</span>
                    <span aria-hidden="true">{j.bikeLabel || 'Bike'}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {pickBar ? <div className="px-3.5 pt-2.5">{pickBar}</div> : null}
        <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
        <p role="status" aria-live="polite" className={SR}>{moveNote}</p>
        {moveError ? <p role="alert" className="m-3.5 mb-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{moveError}</p> : null}

        <section aria-label={`Workshop diary, ${dayLabel(date)}`} className="px-3.5 pb-3.5">
          {columns.length > 1 ? (
            <div className="sticky top-0 z-[4] grid bg-[var(--wh-bg)]" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(0, 1fr))` }}>
              <span />
              {columns.map((c) => (
                <span key={c.key} className="border-b border-l border-[var(--wh-border)] px-1 py-1.5 text-center text-sm font-bold first:border-l-0">{c.label}</span>
              ))}
            </div>
          ) : null}
          <SlotContext.Provider value={PHONE_SLOT_H}>
            <PickContext.Provider value={pickApi}>
            <MoveContext.Provider value={moveApi}>
              <div className="grid pt-2" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(0, 1fr))` }}>
                <div aria-hidden="true" className="relative" style={{ height: ((range.end - range.start) / 30) * PHONE_SLOT_H }}>
                  {hours.map((m) => (
                    <span key={m} className="absolute left-0 font-[family-name:var(--wh-font-mono)] text-xs text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * PHONE_SLOT_H - 8, 0) }}>
                      {hhmm(m)}
                    </span>
                  ))}
                </div>
                {columns.map((c, i) => (
                  <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={false} chosenId={chosen} />
                ))}
              </div>
            </MoveContext.Provider>
            </PickContext.Provider>
          </SlotContext.Provider>
        </section>

        {chosenItem ? (
          <div role="status" aria-label="Chosen from Waiting for you" className="sticky bottom-0 flex flex-col gap-1.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 pt-2.5 pb-3 shadow-[0_-6px_18px_var(--wh-backdrop)]">
            <div className="flex items-center gap-2.5">
              <div className="flex min-w-0 grow flex-col gap-[3px]">
                <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[waitingCard(chosenItem).tone]}`}>{waitingCard(chosenItem).label}</span>
                <span className="text-[15px] font-bold">{waitingCard(chosenItem).customer}</span>
                <span className="text-sm">{waitingCard(chosenItem).detail}</span>
              </div>
              <button
                type="button"
                aria-label={`Open ${waitingCard(chosenItem).customer}'s request`}
                onClick={() => setOpenItem(chosenItem)}
                className="inline-flex min-h-11 min-w-[72px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-[15px] font-bold text-[var(--wh-on-brand)]"
              >
                Open
              </button>
            </div>
            <span className="text-xs text-[var(--wh-muted)]">Tap the card again to open it.</span>
          </div>
        ) : null}

        <Dialog open={sheetOpen} onOpenChange={setSheetOpen} aria-labelledby="waiting-sheet-title">
          <DialogHeader>
            <DialogTitle id="waiting-sheet-title">{`Waiting for you (${waiting.data?.count ?? items.length})`}</DialogTitle>
            <button type="button" aria-label="Close" onClick={() => setSheetOpen(false)} className="inline-flex size-11 items-center justify-center rounded-lg">
              <NavIcon name="close" size={20} />
            </button>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2">
            {items.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing waiting.</p> : null}
            {items.map((item) => {
              const card = waitingCard(item);
              const on = chosen === item.jobId;
              return (
                <button
                  key={`${item.kind}-${item.jobId}`}
                  type="button"
                  aria-pressed={on}
                  onClick={() => chooseItem(item)}
                  className={`flex min-h-11 flex-col gap-1 rounded-lg bg-[var(--wh-panel)] px-3 py-2.5 text-left ${on ? 'border-2 border-[var(--accent)]' : 'border border-[var(--wh-border)]'}`}
                >
                  <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[card.tone]}`}>{card.label}</span>
                  <span className="text-[15px] font-bold">{card.customer}</span>
                  <span className="text-sm">{card.detail}</span>
                </button>
              );
            })}
          </DialogBody>
        </Dialog>

        {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} /> : null}
        {newJobDialog}
        {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
      </div>
    );
  }

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
        <div className="w-5 shrink-0" />
        {picking ? (
          <button type="button" aria-pressed="true" onClick={() => setPicking(false)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            Choose a time
          </button>
        ) : (
          <button type="button" onClick={() => { setPicking(true); setMoveError(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            <span aria-hidden="true">+</span>
            New job
          </button>
        )}
      </div>
      {pickBar}

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
          <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
          <p role="status" aria-live="polite" className={SR}>{moveNote}</p>
          {moveError ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{moveError}</p> : null}
          <div className="overflow-x-auto"><PickContext.Provider value={pickApi}><MoveContext.Provider value={moveApi}>{jobs.isLoading ? <p>Loading the diary…</p> : grid}</MoveContext.Provider></PickContext.Provider></div>
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
      {newJobDialog}
      {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
    </div>
  );
}
