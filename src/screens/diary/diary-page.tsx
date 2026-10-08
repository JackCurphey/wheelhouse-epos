import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode } from 'react';
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
import { HoverSummary, JobMenu, OverviewDialog, StackChooser, tileClass, type ChooserAt, type MenuAt } from './job-extras.tsx';
import {
  LEGEND, LEGEND_LABEL, STATE_LABEL, SNAP_MIN, addDays, dropStart, dayLabel, diaryState, gridRange, hhmm, layoutLanes, stackGroups, todayIso, toMinutes,
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
  answer: 'bg-[var(--wh-state-answer-bg)] border-[var(--wh-state-answer-ink)] text-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] border-[var(--wh-state-hold-ink)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] border-[var(--wh-state-waiting-ink)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] border-[var(--wh-state-ready-ink)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] border-[var(--wh-state-cancelled-ink)] text-[var(--wh-state-cancelled-ink)]',
};
const CHIP: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  answer: 'bg-[var(--wh-state-answer-bg)] text-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

const SR = 'sr-only';

/** One block: a job on one of its days (decision 52), with that day's date, times and mechanic. */
type Shown = WorkshopJob & { state: DiaryState; partId: number; partPos: number; partCount: number };

/** A job as one block per day it is worked; a job sent without parts is one day. */
function blocksOf(j: WorkshopJob): Omit<Shown, 'state'>[] {
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

function timeText(j: { startTime: string | null; endTime: string | null }) {
  return j.startTime ? `${j.startTime}${j.endTime ? `–${j.endTime}` : ''}` : 'no set time';
}

const dayOf = (j: Shown) => (j.partCount > 1 ? `day ${j.partPos} of ${j.partCount}` : '');

function describe(j: Shown, chosen: boolean) {
  const bike = j.bikeLabel || 'Bike';
  return [bike, j.title, j.customerName || 'Customer', j.reference, STATE_LABEL[j.state], timeText(j), dayOf(j)]
    .filter(Boolean).join(', ') + (chosen ? ', chosen from Waiting for you' : '');
}

type Preview = { partId: number; colIndex: number; startMin: number; durationMin: number };

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

/**
 * Piece 5b: the hover summary, the right-click menu (and holding the right
 * button, or a long press on touch), and a stack's chooser. Shared through a
 * context, like moving.
 */
type ExtrasApi = {
  enter: (job: Shown, el: HTMLElement) => void;
  leave: () => void;
  menu: (job: Shown, at: { x: number; y: number; touch: boolean }, opener: HTMLElement | null) => void;
  press: (job: Shown, e: PointerEvent<HTMLElement>) => void;
  stack: (jobs: Shown[], colIndex: number, opener: HTMLElement, touch: boolean) => void;
};
const ExtrasContext = createContext<ExtrasApi | null>(null);

/** Handlers every job block and fanned tile shares: hover, right-click, hold, Menu key. */
function useExtrasHandlers(job: Shown) {
  const extras = useContext(ExtrasContext);
  if (!extras) return {};
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => { if (e.pointerType === 'mouse') extras.enter(job, e.currentTarget); },
    onPointerLeave: () => extras.leave(),
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
      e.preventDefault();
      extras.menu(job, { x: e.clientX, y: e.clientY, touch: false }, e.currentTarget);
    },
    onMenuKey: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return false;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      extras.menu(job, { x: r.left, y: r.bottom + 4, touch: false }, e.currentTarget);
      return true;
    },
    onPress: (e: PointerEvent<HTMLElement>) => extras.press(job, e),
  };
}

/** A booking request is answered before it is moved; a cancellation isn't moved at all. */
const movable = (j: Shown) => Boolean(j.startTime) && j.state !== 'pending' && j.state !== 'cancelled';

function JobBlock({ job, range, wide, chosen, lane, colIndex }: {
  job: Shown; range: { start: number }; wide: boolean; chosen: boolean; lane?: { lane: number; total: number }; colIndex: number;
}) {
  const SLOT_H = useContext(SlotContext);
  const move = useContext(MoveContext);
  const picking = useContext(PickContext);
  const moving = move?.preview?.partId === job.partId ? move.preview : null;
  const { onMenuKey, onPress, ...hover } = useExtrasHandlers(job);
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
    // Decision 59: a narrow lane widens to the whole column on a 0.3s hover.
    Object.assign(style, {
      '--lane-left': `calc(3px + (100% - 6px) * ${lane.lane} / ${lane.total})`,
      '--lane-width': `calc((100% - 6px) / ${lane.total} - 4px)`,
    });
  } else {
    style.left = 3;
    style.right = 3;
  }
  const laned = !moving && lane && lane.total > 1
    ? 'left-[var(--lane-left)] w-[var(--lane-width)] hover:left-[3px] hover:z-[3] hover:w-[calc(100%-6px)] hover:delay-300 motion-safe:transition-[left,width] motion-reduce:hover:delay-0'
    : '';
  const className = `${laned} absolute flex flex-col overflow-hidden rounded-[5px] border-[1.75px] px-1.5 py-[3px] text-left ${BLOCK[job.state]} ${cancelled ? 'opacity-80' : ''} ${chosen ? 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''} ${moving ? 'z-[2] cursor-grabbing shadow-[0_10px_26px_var(--wh-backdrop)]' : ''} ${picking ? 'pointer-events-none opacity-50' : ''}`;
  const inner = (
    <>
      <span className={SR}>{describe(job, chosen)}</span>
      <span aria-hidden="true" className={`truncate text-[11px] font-bold text-[var(--wh-ink)] ${cancelled ? 'line-through' : ''}`}>
        {job.bikeLabel || 'Bike'}
      </span>
      <span aria-hidden="true" className="truncate text-[10px] leading-tight font-bold">
        {[job.partCount > 1 ? `Day ${job.partPos} of ${job.partCount}` : '', job.title, wide ? STATE_LABEL[job.state] : ''].filter(Boolean).join(' · ')}
      </span>
    </>
  );
  if (!move || !movable(job) || picking) {
    return (
      <div title={describe(job, false)} className={className} style={style} {...hover} onPointerDown={onPress}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      title={describe(job, false)}
      data-part={job.partId}
      aria-describedby="diary-move-hint"
      onKeyDown={(e) => { if (!moving && onMenuKey?.(e)) return; move.onKeyDown(job, colIndex, e); }}
      onKeyUp={(e) => { if (moving && e.key === ' ') e.preventDefault(); }}
      onPointerDown={(e) => { onPress?.(e); move.onPointerDown(job, colIndex, e); }}
      onClick={() => move.onOpen(job)}
      className={`${className} cursor-grab touch-none`}
      style={style}
      {...hover}
    >
      {inner}
    </button>
  );
}

/**
 * Decisions 58 and 61: jobs that start together, as one stack. A click (or
 * Enter) opens the chooser; resting the mouse on it for 0.3s fans the jobs
 * out as diary blocks, two to a row, which open, move and summarise like any
 * job. The fan is for the mouse; the chooser is the way for everyone else.
 */
function StackBlock({ jobs, start, end, range, lane, colIndex, chosen }: {
  jobs: Shown[]; start: number; end: number; range: { start: number }; lane?: { lane: number; total: number }; colIndex: number; chosen: boolean;
}) {
  const SLOT_H = useContext(SlotContext);
  const extras = useContext(ExtrasContext);
  const picking = useContext(PickContext);
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  const style: CSSProperties = { top, height };
  if (lane && lane.total > 1) {
    style.left = `calc(3px + (100% - 6px) * ${lane.lane} / ${lane.total})`;
    style.width = `calc((100% - 6px) / ${lane.total} - 4px)`;
  } else {
    style.left = 3;
    style.right = 3;
  }
  // The drawings' touch stack: press and hold fans it out (there's no hover).
  const [fanned, setFanned] = useState(false);
  const held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!fanned) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!(e.target instanceof Node) || !wrap.current?.contains(e.target)) setFanned(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [fanned]);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  // The tray is wider than a tablet's day, so once it's open, slide it back
  // inside the diary if it runs past either edge (seen on screen, 4 Oct).
  const fanRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const f = fanRef.current;
    const box = f?.closest('.overflow-x-auto')?.getBoundingClientRect();
    if (!fanned || !f || !box) { setShift(0); return; }
    const r = f.getBoundingClientRect();
    const left = r.left - shift;
    const right = r.right - shift;
    setShift(left < box.left + 4 ? box.left + 4 - left : right > box.right - 4 ? box.right - 4 - right : 0);
    // Measured once each time the tray opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fanned]);
  const wrap = useRef<HTMLDivElement>(null);
  // What started the last press, so a tap gets the touch chooser (not every
  // browser says on the click itself).
  const lastPointer = useRef('mouse');
  const onHold = (e: PointerEvent<HTMLElement>) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== 'touch' || e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const stop = () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      // Many touch browsers send no click after a long press, so the flag that
      // swallows that click mustn't outlive it (as with justDragged).
      if (held.current) setTimeout(() => { held.current = false; }, 0);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('pointermove', moved);
    };
    const moved = (ev: globalThis.PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 6 || Math.abs(ev.clientY - y0) > 6) stop();
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('pointermove', moved);
    holdTimer.current = setTimeout(() => { held.current = true; setFanned(true); }, 500);
  };
  const front = jobs[0];
  const names = jobs.map((j) => `${j.bikeLabel || 'Bike'} · ${j.title} (${j.reference})`).join(', ');
  const edge = (offset: number, opacity: number) => (
    <div aria-hidden="true" className="absolute bottom-0 rounded-[5px] border-[1.75px] border-[var(--wh-ink)] bg-[var(--wh-panel)]" style={{ left: offset, right: -offset, top: -offset, opacity }} />
  );
  const cols = Math.min(jobs.length, 2);
  return (
    <div ref={wrap} className={`group/stack absolute hover:z-[9] ${fanned ? 'z-[9]' : ''} ${picking ? 'pointer-events-none opacity-50' : ''}`} style={style}>
      {edge(6, 0.45)}
      {edge(3, 0.7)}
      <button
        type="button"
        aria-label={`${jobs.length} jobs booked ${hhmm(start)} to ${hhmm(end)}, click to choose which one to open: ${names}${chosen ? ', chosen from Waiting for you' : ''}`}
        title={names}
        data-parts={jobs.map((j) => j.partId).join(' ')}
        onPointerDown={onHold}
        onClick={(e) => {
          // The tap that ends a press and hold leaves the fan open, not the chooser.
          if (held.current) { held.current = false; return; }
          // A click from the keyboard (detail 0) is never a tap.
          extras?.stack(jobs, colIndex, e.currentTarget, e.detail > 0 && lastPointer.current === 'touch');
        }}
        className={`absolute inset-0 flex flex-col overflow-hidden rounded-[5px] border-[1.75px] border-[var(--wh-ink)] bg-[var(--wh-panel)] py-[3px] pr-[22px] pl-1.5 text-left ${chosen ? 'shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''}`}
      >
        <span aria-hidden="true" className="absolute top-[3px] right-[3px] inline-flex items-center gap-px rounded-full bg-[var(--wh-ink)] px-[5px] py-px text-[9px] font-bold text-[var(--wh-panel)]">
          {jobs.length}
          <Chevron dir="prev" small />
        </span>
        <span aria-hidden="true" className="truncate text-[11px] font-bold text-[var(--wh-ink)]">{front.bikeLabel || 'Bike'}</span>
        <span aria-hidden="true" className="truncate text-[10px] font-semibold text-[var(--wh-muted)]">{`${front.title} · ${hhmm(start)}`}</span>
      </button>
      {/* Hidden (not just see-through) until the 0.3s is up, so a quick
          click lands on the stack, not on a job that hasn't appeared. */}
      <div
        aria-hidden="true"
        ref={fanRef}
        data-fan
        data-open={fanned ? 'true' : undefined}
        className={`invisible absolute left-1/2 grid -translate-x-1/2 opacity-0 transition-[opacity,visibility] group-hover/stack:visible group-hover/stack:opacity-100 group-hover/stack:delay-300 motion-reduce:transition-none data-[open=true]:visible data-[open=true]:opacity-100 ${fanned
          // Press and hold (touchStackBlock): the jobs on a lifted tray.
          ? '-top-2 gap-2 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-2 shadow-[0_14px_32px_var(--wh-backdrop)]'
          : 'top-0 gap-1.5 drop-shadow-[0_10px_26px_var(--wh-backdrop)]'}`}
        style={{ gridTemplateColumns: `repeat(${cols}, ${fanned ? 150 : 128}px)`, marginLeft: shift }}
      >
        {jobs.map((j) => <FanTile key={j.partId} job={j} colIndex={colIndex} touch={fanned} />)}
      </div>
    </div>
  );
}

/** One job in a fanned-out stack: its true length, and it opens, moves and summarises. */
function FanTile({ job, colIndex, touch }: { job: Shown; colIndex: number; touch: boolean }) {
  const SLOT_H = useContext(SlotContext);
  const move = useContext(MoveContext);
  const { onMenuKey: _menuKey, onPress, ...hover } = useExtrasHandlers(job);
  void _menuKey;
  const s0 = toMinutes(job.startTime as string);
  const dur = job.endTime ? toMinutes(job.endTime) - s0 : 30;
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => { onPress?.(e); if (move && movable(job)) move.onPointerDown(job, colIndex, e); }}
      onClick={() => move?.onOpen(job)}
      className={`flex touch-none flex-col overflow-hidden px-1.5 py-[3px] text-left ${touch ? 'w-[150px] rounded-md border' : 'w-32 rounded-[5px] border-[1.75px]'} ${tileClass(job.state)}`}
      // Touch tiles are at least 56px tall, as drawn (touchStackTile).
      style={{ height: Math.max((dur / 30) * SLOT_H - 4, touch ? 56 : SLOT_H - 6) }}
      {...hover}
    >
      <span className="truncate text-xs font-bold text-[var(--wh-ink)]">{job.bikeLabel || 'Bike'}</span>
      <span className="truncate text-xs font-bold">{job.title}</span>
      {/* Fanned by a press and hold: the touch tile's number and times (touchStackTile). */}
      <span className="truncate text-xs text-[var(--wh-muted)]">{touch ? `${job.reference} · ${job.startTime}–${job.endTime ?? ''}` : job.reference}</span>
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
  // Decision 58: jobs starting together are one stack, which takes one lane.
  // A job being moved leaves its stack and shows as itself while it moves.
  const movingId = useContext(MoveContext)?.preview?.partId ?? null;
  const span = (j: Shown) => {
    const s = toMinutes(j.startTime as string);
    return { id: j.partId, start: s, end: j.endTime ? toMinutes(j.endTime) : s + 30 };
  };
  const groups = [
    ...stackGroups(timed.filter((j) => j.partId !== movingId).map(span)),
    ...timed.filter((j) => j.partId === movingId).map((j) => ({ ...span(j), ids: [j.partId] })),
  ];
  const lanes = layoutLanes(groups);
  const byId = new Map(timed.map((j) => [j.partId, j]));
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
      {groups.map((g) => (g.ids.length === 1 ? (
        <JobBlock key={g.id} job={byId.get(g.id) as Shown} range={range} wide={wide} chosen={byId.get(g.id)?.id === chosenId} lane={lanes.get(g.id)} colIndex={index} />
      ) : (
        <StackBlock key={`stack-${g.id}`} jobs={g.ids.map((id) => byId.get(id) as Shown)} start={g.start} end={g.end} range={range} lane={lanes.get(g.id)} colIndex={index} chosen={g.ids.some((id) => byId.get(id)?.id === chosenId)} />
      )))}
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
              <span key={j.partId} title={describe(j, false)} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
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

function Chevron({ dir, small = false }: { dir: 'prev' | 'next'; small?: boolean }) {
  return (
    <svg width={small ? 9 : 18} height={small ? 9 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${dir === 'prev' ? 90 : -90}deg)` }}>
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
    .flatMap(blocksOf)
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
  const startOf = (j: Shown, colIndex: number): Preview => ({ partId: j.partId, colIndex, startMin: toMinutes(j.startTime as string), durationMin: durationOf(j) });

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
    // A column with no mechanic (the Week view, Everyone) dropped exactly on a
    // change request's time sends the mechanic asked for, so the move accepts
    // the request (Jack, 8 Oct).
    const asked = job.requested as { jobDate?: string; startTime?: string; mechanicId?: number | null } | null | undefined;
    // Only the job's first day: a request is that day's (a later day moves on its own).
    if (job.partPos === 1 && (view === 'week' || c.all) && asked?.mechanicId != null && asked.mechanicId !== job.mechanicId
      && asked.jobDate === c.date && asked.startTime === hhmm(p.startMin)) {
      body.mechanicId = asked.mechanicId;
    }
    setMoveError(null);
    try {
      // Day 1 is the job itself; a later day is moved on its own (decision 52).
      const path = job.partPos > 1 ? `/api/workshop-jobs/${job.id}/parts/${job.partId}` : `/api/workshop-jobs/${job.id}`;
      await apiMutate(path, body, { method: 'PUT' });
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
  /** M: pick a job up to move with the arrow keys (from its block, or its stack's chooser). */
  const startKeyMove = (job: Shown, colIndex: number) => {
    const p = startOf(job, colIndex);
    setPreview(p);
    setMoveError(null);
    setMoveNote(`Moving ${job.bikeLabel || 'Bike'}. ${whereText(p)}. Use the arrow keys to move it, Enter to save, Escape to cancel.`);
  };
  // A job moved from its stack's chooser leaves the stack and shows as itself
  // while it moves: focus follows it there, and when the move ends, goes back
  // to the stack it's in (or the job, if it no longer stacks).
  const followPart = useRef<number | null>(null);
  useEffect(() => {
    const id = followPart.current;
    if (id === null) return;
    if (preview?.partId === id) {
      document.querySelector<HTMLElement>(`[data-part="${id}"]`)?.focus();
    } else if (!preview) {
      followPart.current = null;
      (document.querySelector<HTMLElement>(`[data-parts~="${id}"]`) ?? document.querySelector<HTMLElement>(`[data-part="${id}"]`))?.focus();
    }
  });
  const moveApi: MoveApi = {
    preview,
    onOpen: openJob,
    onKeyDown(job, colIndex, e) {
      const bike = job.bikeLabel || 'Bike';
      const hint = 'Use the arrow keys to move it, Enter to save, Escape to cancel.';
      if (!preview || preview.partId !== job.partId) {
        if (e.key === 'Enter') {
          // Handled here rather than by the button's own click, so it opens once.
          e.preventDefault();
          openJob(job);
          return;
        }
        if (e.key !== 'm' && e.key !== 'M') return;
        e.preventDefault();
        startKeyMove(job, colIndex);
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
      // A fanned tile can hang over the next day. Grabbed there, the pointer
      // counts as being at the edge of the job's own day, so a nudge doesn't
      // land it next door (fresh review of pull request 112). Anywhere else,
      // the day is simply the one under the pointer.
      const ownCol = document.querySelector<HTMLElement>(`[data-diary-col="${colIndex}"]`)?.getBoundingClientRect();
      const overhang = ownCol ? e.clientX - Math.max(ownCol.left, Math.min(e.clientX, ownCol.right - 1)) : 0;
      const onMove = (ev: globalThis.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.abs(ev.clientX - d.x) < 4 && Math.abs(ev.clientY - d.y) < 4) return;
        d.moved = true;
        const cols = [...document.querySelectorAll<HTMLElement>('[data-diary-col]')];
        const x = ev.clientX - overhang;
        const over = cols.find((el) => {
          const r = el.getBoundingClientRect();
          return x >= r.left && x < r.right;
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

  // ---- The extras (piece 5b) ----
  const [hovered, setHovered] = useState<{ job: Shown; rect: DOMRect } | null>(null);
  const [menuFor, setMenuFor] = useState<{ job: Shown; at: MenuAt; opener: HTMLElement | null } | null>(null);
  const [overview, setOverview] = useState<Shown | null>(null);
  const [stackJobs, setStackJobs] = useState<Shown[] | null>(null);
  const stackFrom = useRef<{ colIndex: number; opener: HTMLElement } | null>(null);
  const [stackAt, setStackAt] = useState<ChooserAt>({ phone: false, touch: false, anchor: null });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const touchPress = useRef(false);
  const busy = Boolean(preview || picking || menuFor || overview || stackJobs || openJobId !== null || newJob);
  const stopHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHovered(null);
  };
  const stopPress = () => {
    for (const t of pressTimers.current) clearTimeout(t);
    pressTimers.current = [];
    touchPress.current = false;
  };
  const showOverview = (job: Shown) => {
    stopHover();
    setMenuFor(null);
    setOverview(job);
  };
  const extrasApi: ExtrasApi = {
    enter(job, el) {
      if (busy) return;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      // Decision 65: about 0.6s, or at once when motion is reduced.
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      hoverTimer.current = setTimeout(() => setHovered({ job, rect: el.getBoundingClientRect() }), reduced ? 0 : 600);
    },
    leave: stopHover,
    menu(job, at, opener) {
      // A long press on touch opens the menu itself; the browser's own
      // context menu for that press is ignored.
      if (touchPress.current) return;
      stopHover();
      setMenuFor({ job, at: { ...at, phone: isPhone }, opener });
    },
    press(job, e) {
      const right = e.pointerType === 'mouse' && e.button === 2;
      const touch = e.pointerType === 'touch' && e.button === 0;
      if (!right && !touch) return;
      stopPress();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const opener = e.currentTarget;
      let longPressed = false;
      const end = () => {
        if (longPressed) {
          // The click that ends a long press must not open the job.
          justDragged.current = true;
          setTimeout(() => { justDragged.current = false; }, 0);
        }
        stopPress();
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        window.removeEventListener('pointermove', moved);
      };
      const moved = (ev: globalThis.PointerEvent) => {
        if (Math.abs(ev.clientX - x0) > 6 || Math.abs(ev.clientY - y0) > 6) end();
      };
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      window.addEventListener('pointermove', moved);
      if (right) {
        // Holding the right button opens the overview straight away.
        pressTimers.current.push(setTimeout(() => showOverview(job), 500));
        return;
      }
      touchPress.current = true;
      pressTimers.current.push(setTimeout(() => {
        longPressed = true;
        stopHover();
        setMenuFor({ job, at: { x: x0, y: y0, touch: true, phone: isPhone }, opener });
      }, 500));
      pressTimers.current.push(setTimeout(() => showOverview(job), 1100));
    },
    stack(list, colIndex, opener, touch) {
      stopHover();
      stackFrom.current = { colIndex, opener };
      setStackAt({ phone: isPhone, touch, anchor: opener.getBoundingClientRect() });
      setStackJobs(list);
    },
  };
  const extrasUi = (
    <>
      {hovered && !busy ? <HoverSummary job={hovered.job} rect={hovered.rect} /> : null}
      {menuFor ? (
        <JobMenu
          job={menuFor.job}
          at={menuFor.at}
          onClose={(back) => { const el = menuFor.opener; setMenuFor(null); if (back) el?.focus(); }}
          onOpenJob={() => { setMenuFor(null); setOpenJobId(menuFor.job.id); }}
          onOverview={() => showOverview(menuFor.job)}
        />
      ) : null}
      {overview ? (
        <OverviewDialog job={overview} onClose={() => setOverview(null)} onOpenJob={() => { setOverview(null); setOpenJobId(overview.id); }} />
      ) : null}
      {stackJobs ? (
        <StackChooser
          jobs={stackJobs}
          time={stackJobs[0].startTime ?? ''}
          at={stackAt}
          onClose={(back) => { setStackJobs(null); if (back) stackFrom.current?.opener.focus(); }}
          onPick={(j) => { setStackJobs(null); setOpenJobId(j.id); }}
          onMove={(picked) => {
            const from = stackFrom.current;
            const j = stackJobs.find((x) => x.partId === picked.partId);
            setStackJobs(null);
            if (!from || !j || !movable(j)) return;
            followPart.current = j.partId;
            startKeyMove(j, from.colIndex);
          }}
          onMenu={(picked) => {
            const opener = stackFrom.current?.opener ?? null;
            const j = stackJobs.find((x) => x.partId === picked.partId);
            setStackJobs(null);
            if (!j) return;
            const r = opener?.getBoundingClientRect();
            setMenuFor({ job: j, at: { x: r?.left ?? 0, y: (r?.bottom ?? 0) + 4, touch: false, phone: isPhone }, opener });
          }}
        />
      ) : null}
    </>
  );

  /** Decision 18: the mechanic working that day with the most free time (fewest booked minutes). */
  const freest = (day: string): number | null => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const working = people.filter((m) => !Array.isArray(m.workingDays) || m.workingDays.includes(weekday));
    const pool = working.length ? working : people;
    let best: number | null = null;
    let bestMinutes = Infinity;
    for (const m of pool) {
      const booked = (jobs.data ?? []).flatMap(blocksOf).filter((j) => j.jobDate === day && j.mechanicId === m.id && j.startTime && j.endTime)
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
                  <span key={j.partId} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--wh-state-scheduled-ink)] px-3 text-[13px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
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
            <MoveContext.Provider value={moveApi}><ExtrasContext.Provider value={extrasApi}>
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
            </ExtrasContext.Provider></MoveContext.Provider>
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
        {extrasUi}
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
          <div className="overflow-x-auto"><PickContext.Provider value={pickApi}><MoveContext.Provider value={moveApi}><ExtrasContext.Provider value={extrasApi}>{jobs.isLoading ? <p>Loading the diary…</p> : grid}</ExtrasContext.Provider></MoveContext.Provider></PickContext.Provider></div>
          {jobs.isError ? <p role="alert">Wheelhouse couldn&apos;t load the diary. Try again in a moment.</p> : null}
          <ul aria-label="What the colours mean" className="m-0 flex list-none flex-wrap gap-3 p-0">
            {LEGEND.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5 text-xs">
                <span aria-hidden="true" className={`inline-block size-3.5 rounded-[3px] border-[1.75px] ${BLOCK[s]}`} />
                {LEGEND_LABEL[s]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} /> : null}
      {newJobDialog}
      {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
      {extrasUi}
    </div>
  );
}
