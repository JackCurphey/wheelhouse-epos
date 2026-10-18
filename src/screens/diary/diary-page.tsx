import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { ROUTES } from '@/staff/routes.ts';
import { createPortal } from 'react-dom';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { printReceipt, type ReceiptSale, type ShopDetails } from '@/screens/till/receipt.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { HeaderSlotContext } from '@/staff/header-slot.ts';
import { RequestDialog } from './request-dialog.tsx';
import { NewJobDialog } from './new-job-dialog.tsx';
import { JobDialog } from './job-dialog.tsx';
import { jobRefusalText } from './refusal-words.ts';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { HoverSummary, JobMenu, OverviewDialog, StackChooser, tileClass, type ChooserAt, type MenuAt } from './job-extras.tsx';
import {
  LEGEND, LEGEND_LABEL, STATE_LABEL, SNAP_MIN, addDays, addMonths, dropStart, monthLabel, monthOf, dayLabel, diaryState, gridRange, hhmm, layoutLanes, lengthText, stackGroups, stretchEnd, todayIso, toMinutes,
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
type Settings = { openingHours?: { weekday: number; open: string; close: string }[]; showSignOffToCustomers?: boolean };
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

/** A job on the move, or (stretch) having its length changed: then only durationMin changes. */
type Preview = { partId: number; colIndex: number; startMin: number; durationMin: number; stretch?: boolean };

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
  /** Stretching (Jack, 18 Oct): the bottom edge's grip, dragged. */
  onStretchDown: (job: Shown, colIndex: number, e: PointerEvent<HTMLElement>) => void;
  /** Where the times and length show while stretching: inside the column on a phone or the last column. */
  labelInside: (colIndex: number) => boolean;
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

function JobBlock({ job, range, wide, chosen, light = false, lane, colIndex }: {
  job: Shown; range: { start: number }; wide: boolean; chosen: boolean; light?: boolean; lane?: { lane: number; total: number }; colIndex: number;
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
  const className = `${laned} absolute flex flex-col overflow-hidden rounded-[5px] border-[1.75px] px-1.5 py-[3px] text-left ${BLOCK[job.state]} ${cancelled ? 'opacity-80' : ''} ${chosen ? (light ? 'z-[1] shadow-[0_0_0_2px_var(--wh-muted)]' : 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]') : ''} ${moving?.stretch ? 'z-[2] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : moving ? 'z-[2] cursor-grabbing shadow-[0_10px_26px_var(--wh-backdrop)]' : ''} ${picking ? 'pointer-events-none opacity-50' : ''}`;
  const inner = (
    <>
      <span className={SR}>{describe(job, chosen)}</span>
      <span aria-hidden="true" className={`truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)] ${cancelled ? 'line-through' : ''}`}>
        {job.bikeLabel || 'Bike'}
      </span>
      {/* A block too short for two 12px lines shows the bike only (drawn, walk 1 M3);
          the job stays in its description and summary. */}
      {height >= TWO_LINES ? (
        <span aria-hidden="true" className="truncate text-xs leading-[14px] font-bold">
          {[job.partCount > 1 ? `Day ${job.partPos} of ${job.partCount}` : '', job.title, wide ? STATE_LABEL[job.state] : ''].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </>
  );
  if (!move || !movable(job) || picking) {
    return (
      <div title={describe(job, false)} className={className} style={style} {...hover} onPointerDown={onPress}>
        {inner}
      </div>
    );
  }
  const stretching = moving?.stretch ? moving : null;
  // While stretching, a finger-sized grip on the bottom edge (a 44px touch
  // area, as drawn for tablets and phones) and the times and length beside
  // the job, or inside it on a phone or the last column (Jack, 18 Oct).
  const stretchUi = stretching ? (
    <>
      <div
        data-stretch-grip
        aria-hidden="true"
        onPointerDown={(e) => move.onStretchDown(job, colIndex, e)}
        className="absolute z-[3] flex h-11 cursor-ns-resize touch-none items-center justify-center"
        style={{ top: top + height - 22, left: 3, right: 3 }}
      >
        <span className="h-1.5 w-10 rounded-[3px] bg-[var(--wh-state-scheduled-ink)] shadow-[0_0_0_2px_var(--wh-panel)]" />
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute z-[4] rounded-md bg-[var(--wh-ink)] px-2.5 py-1.5 text-sm font-bold text-[var(--wh-panel)] shadow-[0_6px_16px_var(--wh-backdrop)] ${move.labelInside(colIndex) ? 'max-w-[calc(100%-12px)]' : 'whitespace-nowrap'}`}
        style={move.labelInside(colIndex) ? { bottom: `calc(100% - ${top + height - 30}px)`, right: 6 } : { top: top + height - 16, left: 'calc(100% + 6px)' }}
      >
        <span className="font-mono">{hhmm(stretching.startMin)}–{hhmm(stretching.startMin + stretching.durationMin)}</span> · {lengthText(stretching.durationMin)}
      </div>
    </>
  ) : null;
  return (
    <>
    <button
      type="button"
      title={describe(job, false)}
      data-part={job.partId}
      aria-describedby="diary-move-hint"
      onKeyDown={(e) => { if (!moving && onMenuKey?.(e)) return; move.onKeyDown(job, colIndex, e); }}
      onKeyUp={(e) => { if (moving && e.key === ' ') e.preventDefault(); }}
      onPointerDown={(e) => { onPress?.(e); move.onPointerDown(job, colIndex, e); }}
      onClick={() => move.onOpen(job)}
      className={`${className} group cursor-grab touch-none`}
      style={style}
      {...hover}
    >
      {inner}
      {/* With a mouse, the bottom edge stretches the job (drawn, diary-stretch). */}
      <span
        data-stretch-edge
        aria-hidden="true"
        onPointerDown={(e) => { if (e.pointerType === 'mouse') move.onStretchDown(job, colIndex, e); }}
        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center pointer-coarse:hidden"
      >
        <span className="mb-px h-1 w-7 rounded-sm bg-[var(--wh-state-scheduled-ink)] opacity-0 group-hover:opacity-100" />
      </span>
    </button>
    {stretchUi}
    </>
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
        className={`absolute inset-0 flex flex-col overflow-hidden rounded-[5px] border-[1.75px] border-[var(--wh-ink)] bg-[var(--wh-panel)] py-[3px] pr-[30px] pl-1.5 text-left ${chosen ? 'shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''}`}
      >
        <span aria-hidden="true" className="absolute top-[3px] right-[3px] inline-flex items-center gap-px rounded-full bg-[var(--wh-ink)] px-[5px] py-px text-xs font-bold text-[var(--wh-panel)]">
          {jobs.length}
          <Chevron dir="prev" small />
        </span>
        <span aria-hidden="true" className="truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)]">{front.bikeLabel || 'Bike'}</span>
        {((end - start) / 30) * SLOT_H - 4 >= TWO_LINES ? (
          <span aria-hidden="true" className="truncate text-xs leading-[14px] font-semibold text-[var(--wh-muted)]">{`${front.title} · ${hhmm(start)}`}</span>
        ) : null}
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

/** Where a customer asked to move a booking: from the job, or from "Waiting for you" when the job is in another week. */
type Outline = { id: number; label: string; mechanicId: number | null; requested: { jobDate?: string | null; startTime?: string | null; endTime?: string | null; mechanicId?: number | null } };

/**
 * The first day to show for a "Waiting for you" card: the booking's own, or
 * for a change request into another week the day asked for (Jack, 15 Oct).
 */
function cardDay(item: WaitingItem): string | null | undefined {
  const to = item.kind === 'change_request' ? item.to?.jobDate : null;
  if (to && item.jobDate && weekOf(to)[0] !== weekOf(item.jobDate)[0]) return to;
  return item.jobDate;
}

/**
 * Messages that come and go float at the bottom of the screen, over the
 * diary, so nothing on the page moves when they appear (Jack, 16 Oct; the
 * till's drawn "Paid by link" message is the pattern).
 */
function Floating({ children }: { children: ReactNode }) {
  return createPortal(
    // z-30: under the job menu and chooser (z-40), which open on top of it.
    <div data-floating className="pointer-events-none fixed inset-x-3 bottom-4 z-30 flex flex-col items-stretch gap-2 md:right-auto md:left-1/2 md:w-[min(760px,calc(100vw-2rem))] md:-translate-x-1/2">
      {children}
    </div>,
    document.body,
  );
}

/** Room for two 12px lines in a block: its padding and border, and two lines (diary.mjs, D_LINE_H 14). */
const TWO_LINES = 10 + 2 * 14;

/** A change request's dashed outline at the time the customer asked for. */
function RequestedOutline({ outline, range, chosen }: { outline: Outline; range: { start: number }; chosen: boolean }) {
  const SLOT_H = useContext(SlotContext);
  const r = outline.requested;
  if (!r?.startTime) return null;
  const start = toMinutes(r.startTime);
  const end = r.endTime ? toMinutes(r.endTime) : start + 30;
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  return (
    <div
      className={`absolute right-[3px] left-[3px] overflow-hidden rounded-[5px] border-[1.75px] border-dashed border-[var(--wh-state-hold-ink)] px-1.5 py-[3px] text-xs font-bold text-[var(--wh-state-hold-ink)] ${chosen ? 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : ''}`}
      style={{ top, height }}
    >
      <span className={SR}>{`${outline.label} asks to move here: ${timeText({ startTime: r.startTime, endTime: r.endTime ?? null })}${chosen ? ', chosen from Waiting for you' : ''}`}</span>
      <span aria-hidden="true" className="block truncate">{`Requested ${r.startTime}`}</span>
    </div>
  );
}

function Column({ label, index, jobs, outlines, range, wide, chosenId, lightChosen = false }: {
  label: string; index: number; jobs: Shown[]; outlines: Outline[]; range: { start: number; end: number }; wide: boolean; chosenId: number | null; lightChosen?: boolean;
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
  // new-job-pick: the slot under the pointer shows as a solid target with its
  // time before the click (Jack, 16 Oct). A mouse only; touch has no hover.
  // A touch screen sends a pointer move before each tap; showing the slot
  // then could make an iPad swallow the tap, so only a mouse shows it.
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  // Forgotten when choosing ends, so the next New job starts clean.
  const [wasPicking, setWasPicking] = useState(Boolean(pick));
  if (wasPicking !== Boolean(pick)) {
    setWasPicking(Boolean(pick));
    setHoverMin(null);
  }
  const pickY = (e: ReactMouseEvent<HTMLDivElement>) => e.clientY - e.currentTarget.getBoundingClientRect().top;
  const pickHint = pick && hoverMin !== null ? hoverMin : null;
  return (
    // While choosing a time for a new job, a click on the column picks the
    // time there; "Enter a time instead" is the keyboard way (decision 22).
    <div
      role="group"
      aria-label={label}
      data-diary-col={index}
      onClick={pick ? (e) => pick.onPick(index, pickY(e)) : undefined}
      onPointerMove={pick ? (e) => { if (e.pointerType === 'mouse') setHoverMin(dropStart(pickY(e), range, 30, SLOT_H)); } : undefined}
      onPointerLeave={() => setHoverMin(null)}
      className={`relative border-l border-[var(--wh-border)] first:border-l-0 ${pick ? 'cursor-pointer bg-[var(--wh-accent-soft)]/30' : ''}`}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2 - 1}px, var(--wh-border) ${SLOT_H * 2}px)`,
      }}
    >
      {groups.map((g) => (g.ids.length === 1 ? (
        <JobBlock key={g.id} job={byId.get(g.id) as Shown} range={range} wide={wide} chosen={byId.get(g.id)?.id === chosenId} light={lightChosen} lane={lanes.get(g.id)} colIndex={index} />
      ) : (
        <StackBlock key={`stack-${g.id}`} jobs={g.ids.map((id) => byId.get(id) as Shown)} start={g.start} end={g.end} range={range} lane={lanes.get(g.id)} colIndex={index} chosen={g.ids.some((id) => byId.get(id)?.id === chosenId)} />
      )))}
      {outlines.map((o) => (
        <RequestedOutline key={`req-${o.id}`} outline={o} range={range} chosen={o.id === chosenId} />
      ))}
      {pickHint !== null ? (
        <div
          data-pick-slot
          aria-hidden="true"
          className="pointer-events-none absolute right-[3px] left-[3px] z-[2] flex items-center justify-center overflow-hidden rounded-[5px] border-[1.5px] border-[var(--accent)] bg-[var(--accent)] px-1 text-xs font-bold whitespace-nowrap text-[var(--wh-on-brand)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--wh-highlight)_40%,transparent)]"
          style={{ top: ((pickHint - range.start) / 30) * SLOT_H + 2, height: SLOT_H - 4 }}
        >
          {hhmm(pickHint)}
        </div>
      ) : null}
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
        <span key={m} className="absolute right-1 font-[family-name:var(--wh-font-mono)] text-xs text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * SLOT_H - 6, 1) }}>
          {hhmm(m)}
        </span>
      ))}
    </div>
  );
}

function Grid({ heads, columns, noTime, onOpen, range, ariaLabel }: {
  heads: { key: string; top?: string; main: string; today?: boolean }[];
  columns: ReactNode[];
  noTime?: Shown[];
  onOpen: (job: Shown) => void;
  range: { start: number; end: number };
  ariaLabel: string;
}) {
  // While New job picks a time, the chips can't be opened, as blocks can't.
  const picking = useContext(PickContext);
  const cols = `44px repeat(${heads.length}, minmax(0, 1fr))`;
  return (
    <section aria-label={ariaLabel} className="min-w-[720px] overflow-hidden rounded-[10px] md:min-w-0 border border-[var(--wh-border)] bg-[var(--wh-panel)]">
      <div className="grid border-b border-[var(--wh-border)]" style={{ gridTemplateColumns: cols }}>
        <div className="bg-[var(--wh-surface-muted)]" />
        {heads.map((h) => (
          <div key={h.key} className={`flex flex-col items-center border-l border-[var(--wh-border)] px-2 py-1.5 ${h.today ? 'bg-[var(--wh-surface-muted)]' : ''}`}>
            {h.top ? <span className="text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">{h.top}</span> : null}
            <span className={`text-sm font-bold ${h.today ? 'text-[var(--accent-dark)]' : ''}`}>{h.main}{h.today ? ' · Today' : ''}</span>
          </div>
        ))}
      </div>
      {noTime ? (
        <div className="grid border-b border-[var(--wh-border)]" style={{ gridTemplateColumns: '44px minmax(0, 1fr)' }}>
          <div aria-hidden="true" className="bg-[var(--wh-surface-muted)] pt-[3px] text-center text-xs leading-tight font-bold text-[var(--wh-muted)]">
            No
            <br />
            time
          </div>
          <div role="group" aria-label="No time" className="flex min-h-[26px] flex-wrap items-center gap-[5px] px-2 py-1">
            {/* A chip opens the job, as a block does (the drawing's No time row, issue 192). */}
            {noTime.map((j) => (
              <button type="button" key={j.partId} title={describe(j, false)} disabled={Boolean(picking)} onClick={() => onOpen(j)} className={`inline-flex min-h-6 items-center rounded-full border border-current px-2 text-xs font-bold whitespace-nowrap disabled:opacity-40 ${CHIP[j.state]}`}>
                <span className={SR}>{describe(j, false)}</span>
                <span aria-hidden="true">{j.bikeLabel || 'Bike'}</span>
              </button>
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
  return useMedia('(max-width: 767px)');
}

/** Narrower than a computer: a phone or an upright tablet (layout review 238, item 7). */
function useIsNarrow(): boolean {
  return useMedia('(max-width: 1023px)');
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
function MonthGrid({ days, month, jobs, today, coarse, onOpen, onOpenDay }: {
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
    </>
  );
  const chipName = (j: Shown) => `${j.startTime ?? 'No time'}, ${j.bikeLabel || 'Bike'}, ${j.title}, ${j.customerName || 'Customer'}, ${STATE_LABEL[j.state]}`;
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
              <span className={`truncate text-[13px] font-bold ${j.state === 'cancelled' ? 'line-through' : ''}`}>{j.bikeLabel || 'Bike'} · {j.title}</span>
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
function ChooseDaySheet({ open, date, who, whose, onClose, onPick }: {
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

export function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const isNarrow = useIsNarrow();
  const today = todayIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : today;
  // On a phone the diary is always one day (decision 68); the week is the strip of days.
  const askedView = params.get('view');
  const view: 'week' | 'day' | 'month' = isPhone || askedView === 'day' ? 'day' : askedView === 'month' ? 'month' : 'week';
  // A day's jobs in the month are too small to tap one by one on a touch screen (decision 68).
  const coarse = useMedia('(pointer: coarse)');
  const who = params.get('who');
  const slotPx = isPhone ? PHONE_SLOT_H : SLOT_H;
  const [chosen, setChosen] = useState<number | null>(null);
  // How the last press on a Waiting card was made: a second tap opens the
  // chosen card on a touch screen, a second mouse click doesn't (decision 14).
  const cardPointer = useRef<string>('mouse');
  // The phone's By mechanic names, kept in step with the columns as they scroll.
  const mechHeadRef = useRef<HTMLDivElement>(null);
  // Whether the chosen card was chosen by a tap, for its hint (layout review 238, item 3).
  const [chosenByTouch, setChosenByTouch] = useState(false);
  const [openItem, setOpenItem] = useState<WaitingItem | null>(null);

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  const days = view === 'week' ? weekOf(date) : view === 'month' ? monthOf(date) : [date];
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
  // Only the jobs no mechanic has yet (Jack, 18 Oct, docs/decisions/2026-10-18-old-diary-features.md answer 5).
  const shared = who === 'shared';
  // A phone shows Everyone in one column unless "By mechanic" is chosen.
  const byMechanic = !isPhone || who === 'bymech';

  const shown: Shown[] = (jobs.data ?? [])
    .flatMap(blocksOf)
    .map((j) => ({ ...j, state: diaryState(j) }))
    .filter((j): j is Shown => j.state !== 'hidden')
    .filter((j) => (shared ? j.mechanicId === null : whoId === null || j.mechanicId === whoId));
  const range = gridRange(settings.data ?? {}, shown);
  // From the jobs on screen, and from "Waiting for you" for a booking whose
  // own day is in another week (Jack, 15 Oct).
  const onScreen = new Set(shown.map((j) => j.id));
  const outlines: Outline[] = [
    ...shown.filter((j) => j.state === 'hold' && j.partPos === 1 && j.requested?.startTime)
      .map((j) => ({ id: j.id, label: j.bikeLabel || 'Bike', mechanicId: j.mechanicId, requested: j.requested ?? {} })),
    ...(waiting.data?.items ?? [])
      .filter((i) => i.kind === 'change_request' && i.jobId && !onScreen.has(i.jobId) && i.to?.startTime
        && (shared ? !i.mechanicId : whoId === null || i.mechanicId === whoId))
      .map((i) => ({ id: i.jobId as number, label: i.customerName || 'Customer', mechanicId: i.mechanicId ?? null, requested: i.to ?? {} })),
  ];
  const outlinesFor = (pred: (o: Outline) => boolean) => outlines.filter(pred);

  const step = view === 'week' ? 7 : 1;
  const unit = view;
  const shift = (n: -1 | 1) => (view === 'month' ? addMonths(date, n) : addDays(date, n * step));

  // The grid's columns: the week's days, or the day's mechanics.
  type Col = { key: string; label: string; date: string; mechanicId: number | null; all?: boolean };
  let columns: Col[];
  if (view !== 'day') {
    columns = days.map((d) => ({ key: d, label: dayLabel(d), date: d, mechanicId: null }));
  } else if (shared) {
    columns = [{ key: 'none', label: 'Shared queue', date, mechanicId: null }];
  } else if (whoId === null && !byMechanic) {
    columns = [{ key: 'all', label: 'Everyone', date, mechanicId: null, all: true }];
  } else {
    columns = (whoId === null ? people : people.filter((m) => m.id === whoId))
      .map((m) => ({ key: String(m.id), label: m.name, date, mechanicId: m.id }));
    if (whoId === null && shown.some((j) => j.jobDate === date && j.startTime && j.mechanicId === null)) {
      columns.push({ key: 'none', label: 'Not assigned yet', date, mechanicId: null });
    }
  }
  const jobsIn = (c: Col) => shown.filter((j) => j.jobDate === c.date && (view !== 'day' || c.all || j.mechanicId === c.mechanicId));
  const outlinesIn = (c: Col) => outlinesFor((o) => o.requested.jobDate === c.date
    && (view !== 'day' || c.all || (o.requested.mechanicId ?? o.mechanicId) === c.mechanicId));
  // With the time asked for on screen, the chosen job takes the drawing's light
  // mark and the time the strong ring (change-selected).
  const chosenTimeShown = columns.some((c) => outlinesIn(c).some((o) => o.id === chosen));

  // ---- Moving a job (piece 3) ----
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  // The latest preview, for the pointer-up handler (added once per drag).
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;
  const [moveNote, setMoveNote] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const session = useSession();
  // "Print receipt" (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md):
  // the paid order names its sale; that sale is the receipt.
  async function printJobReceipt(j: { orderId: number | null; reference: string; bikeLabel?: string | null; signedOffByName?: string | null }) {
    setMoveError(null);
    try {
      const order = await apiGet<{ convertedSaleId: number | null }>(`/api/sale-documents/${j.orderId}`);
      if (!order.convertedSaleId) throw new Error('no sale');
      const sale = await apiGet<ReceiptSale>(`/api/sales/${order.convertedSaleId}`);
      // The shop's address, phone and VAT number (Shop details, 18 Oct).
      const details = await queryClient.fetchQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails & { name: string }>('/api/shop-details') }).catch(() => undefined);
      printReceipt({ details, sale, shopName: details?.name ?? (session.status === 'signed-in' ? session.shop.name : ''), job: { reference: j.reference, bikeLabel: j.bikeLabel ?? null, checkedBy: settings.data?.showSignOffToCustomers ? j.signedOffByName ?? null : null } });
    } catch {
      setMoveError('Wheelhouse couldn’t get this job’s receipt to print. Try again in a moment.');
    }
  }
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
      const why = jobRefusalText(err);
      setMoveError(`Couldn't move ${job.bikeLabel || 'Bike'}: ${why}`);
      if (err instanceof ApiError && err.code === 'stale') void queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
    } finally {
      setPreview(null);
    }
  }

  // ---- Changing a job's length (Jack, 18 Oct) ----
  const lengthAt = (p: Preview) => `${hhmm(p.startMin)}–${hhmm(p.startMin + p.durationMin)}`;
  // A job stops at its own day's closing time; the grid can run later for
  // another day (fresh review). A job already past it keeps its end.
  const latestEnd = (job: Shown, colIndex: number) => {
    const weekday = new Date(`${columns[colIndex].date}T12:00:00Z`).getUTCDay();
    const close = settings.data?.openingHours?.find((h) => h.weekday === weekday)?.close;
    const limit = close ? Math.min(range.end, toMinutes(close)) : range.end;
    return Math.max(limit, toMinutes(job.startTime as string) + durationOf(job));
  };
  async function saveLength(job: Shown, p: Preview) {
    if (p.durationMin === durationOf(job)) {
      setPreview(null);
      return;
    }
    const c = columns[p.colIndex];
    const body = { jobDate: c.date, startTime: hhmm(p.startMin), endTime: hhmm(p.startMin + p.durationMin), version: job.version };
    setMoveError(null);
    try {
      const path = job.partPos > 1 ? `/api/workshop-jobs/${job.id}/parts/${job.partId}` : `/api/workshop-jobs/${job.id}`;
      await apiMutate(path, body, { method: 'PUT' });
      setMoveNote(`${job.bikeLabel || 'Bike'} now ${lengthAt(p)}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
      ]);
    } catch (err) {
      setMoveError(`Couldn't change ${job.bikeLabel || 'Bike'}’s length: ${jobRefusalText(err)}`);
      if (err instanceof ApiError && err.code === 'stale') void queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
    } finally {
      setPreview(null);
    }
  }
  /** "Change length" in the job's menu: the grip shows, and up and down change it. */
  const startStretch = (job: Shown) => {
    const colIndex = columns.findIndex((c) => jobsIn(c).some((j) => j.partId === job.partId));
    if (colIndex < 0) return;
    const p = { ...startOf(job, colIndex), stretch: true };
    setPreview(p);
    setMoveError(null);
    setMoveNote(`Changing ${job.bikeLabel || 'Bike'}’s length. ${lengthAt(p)} · ${lengthText(p.durationMin)}. Use the up and down arrows to change it, Enter to save, Escape to leave it.`);
    followPart.current = job.partId;
  };
  // A tap or click anywhere but the grip leaves the length as it was.
  const stretchingPart = preview?.stretch ? preview.partId : null;
  useEffect(() => {
    if (stretchingPart === null) return;
    const away = (e: globalThis.PointerEvent) => {
      if ((e.target as Element | null)?.closest('[data-stretch-grip]')) return;
      setPreview(null);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [stretchingPart]);

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
      if (preview?.stretch && preview.partId === job.partId) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const most = latestEnd(job, colIndex) - preview.startMin;
          const next = { ...preview, durationMin: Math.max(SNAP_MIN, Math.min(most, preview.durationMin + (e.key === 'ArrowUp' ? -SNAP_MIN : SNAP_MIN))) };
          setPreview(next);
          setMoveNote(`Changing ${bike}’s length. ${lengthAt(next)} · ${lengthText(next.durationMin)}.`);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void saveLength(job, preview);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPreview(null);
          setMoveNote(`Length unchanged. ${bike} stays ${lengthAt(startOf(job, colIndex))}.`);
        }
        return;
      }
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
    labelInside: (colIndex) => isPhone || colIndex === columns.length - 1,
    onStretchDown(job, colIndex, e) {
      if (e.button !== 0) return;
      // The grip, not the block: no move, and no long press for the menu.
      e.stopPropagation();
      e.preventDefault();
      const colEl = document.querySelector<HTMLElement>(`[data-diary-col="${colIndex}"]`);
      if (!colEl) return;
      const startMin = toMinutes(job.startTime as string);
      const wasStretching = Boolean(preview?.stretch && preview.partId === job.partId);
      const length = wasStretching && preview ? preview.durationMin : durationOf(job);
      // The end follows the edge, wherever on it the press was (fresh review).
      const colTop = colEl.getBoundingClientRect().top;
      const grab = e.clientY - (colTop + ((startMin + length - range.start) / 30) * slotPx);
      const limits = { start: range.start, end: latestEnd(job, colIndex) };
      const y0 = e.clientY;
      let moved = false;
      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
      const onMove = (ev: globalThis.PointerEvent) => {
        // A wobble of a few pixels isn't a drag (as moving a job).
        if (!moved && Math.abs(ev.clientY - y0) < 4) return;
        moved = true;
        const end = stretchEnd(ev.clientY - colEl.getBoundingClientRect().top - grab, limits, startMin, slotPx);
        setPreview({ ...startOf(job, colIndex), durationMin: end - startMin, stretch: true });
      };
      const onUp = () => {
        stop();
        const p = previewRef.current;
        if (moved) {
          justDragged.current = true;
          setTimeout(() => { justDragged.current = false; }, 0);
          if (p?.stretch) void saveLength(job, p);
        } else if (!wasStretching) {
          setPreview(null);
        }
      };
      // A touch the browser takes back (a swipe, a second finger) saves nothing.
      const onCancel = () => {
        stop();
        setPreview(null);
      };
      if (!wasStretching) setPreview({ ...startOf(job, colIndex), stretch: true });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
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
        // Only the part of a column you can see counts: on a phone's By
        // mechanic diary, columns scrolled out of view, or under the times,
        // can't be dropped on (Jack, 17 Oct).
        const over = cols.find((el) => {
          const r = el.getBoundingClientRect();
          const box = el.closest('[data-mech-scroll]')?.getBoundingClientRect();
          const left = box ? Math.max(r.left, box.left + 48) : r.left;
          const right = box ? Math.min(r.right, box.right) : r.right;
          return x >= left && x < right;
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

  const grid: ReactNode = view === 'month' ? (
    <MonthGrid days={days} month={date} jobs={shown} today={today} coarse={coarse} onOpen={openJob} onOpenDay={(d) => set({ view: 'day', date: d })} />
  ) : (
    <Grid
      ariaLabel={view === 'week' ? `Workshop diary, week of ${dayLabel(start)}` : `Workshop diary, ${dayLabel(date)}, by mechanic`}
      range={range}
      heads={view === 'week'
        ? days.map((d) => {
          const [weekday, ...rest] = shortDay(d).split(' ');
          return { key: d, top: weekday, main: rest.join(' '), today: d === today };
        })
        : columns.map((c) => ({ key: c.key, main: c.label }))}
      // The Day view has the row too, with that day's untimed jobs (Jack, 15 Oct, issue 192).
      noTime={shown.filter((j) => !j.startTime && (view === 'week' || j.jobDate === date))}
      onOpen={openJob}
      columns={columns.map((c, i) => (
        <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={view === 'day'} chosenId={chosen} lightChosen={chosenTimeShown} />
      ))}
    />
  );

  // ---- New job (piece 5) ----
  const [picking, setPicking] = useState(false);
  const [newJob, setNewJob] = useState<{ date: string; startMin: number; mechanicId: number | null; auto: boolean; entered?: boolean } | null>(null);

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
          onStretch={movable(menuFor.job) && !picking ? () => { setMenuFor(null); startStretch(menuFor.job); } : undefined}
          till={(() => {
            const j = menuFor.job;
            if (j.state === 'pending') return { reason: 'Not booked yet' };
            if (!j.orderId) return { reason: 'No order on this job' };
            if (j.orderStatus === 'cancelled') return { reason: 'Order cancelled' };
            if (j.orderStatus !== 'open') return { reason: 'Already paid' };
            return { onOpen: () => { setMenuFor(null); navigate(`${ROUTES.till}?job=${j.id}`); } };
          })()}
          print={(() => {
            const j = menuFor.job;
            if (j.orderStatus === 'cancelled') return { reason: 'Order cancelled' };
            if (!j.orderId || j.orderStatus !== 'converted') return { reason: 'Not paid yet' };
            return { onPrint: () => { setMenuFor(null); void printJobReceipt(j); } };
          })()}
          onAnswer={menuFor.job.state === 'pending' ? () => {
            // The request's own card from Waiting for you, or one made from the job.
            const j = menuFor.job;
            const fromFeed = (waiting.data?.items ?? []).find((i) => i.jobId === j.id && i.kind === 'new_booking');
            setMenuFor(null);
            const made: WaitingItem = { kind: 'new_booking', jobId: j.id, reference: j.reference, customerName: j.customerName ?? null, serviceNames: [], mechanicId: j.mechanicId ?? null, jobDate: j.jobDate, startTime: j.startTime ?? null, endTime: j.endTime ?? null };
            setOpenItem(fromFeed ?? made);
          } : undefined}
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
  // Keyboard users land on the bar's first button (it is at the end of the page).
  const enterInsteadRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (picking) enterInsteadRef.current?.focus(); }, [picking]);
  const enterInstead = () => {
    setNewJob({ date, startMin: range.start, mechanicId: freest(date), auto: true, entered: true });
    setPicking(false);
  };
  const newJobDialog = newJob ? (
    <NewJobDialog
      key={`${newJob.date}-${newJob.startMin}`}
      date={newJob.date}
      startMin={newJob.startMin}
      mechanicId={newJob.mechanicId}
      autoChosen={newJob.auto}
      entered={newJob.entered}
      chooseMechanic={freest}
      people={people}
      onClose={() => setNewJob(null)}
    />
  ) : null;
  const pickBar = picking ? (
    <div role="status" className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-highlight)] bg-[var(--wh-accent-soft)] px-3 py-2 text-sm text-[var(--wh-accent-soft-ink)] shadow-[0_8px_24px_var(--wh-backdrop)]">
      <span className="grow font-semibold">Choose a time for the new job.</span>
      <button ref={enterInsteadRef} type="button" onClick={enterInstead} className="min-h-11 rounded-md px-3 font-semibold underline">Enter a time instead</button>
      <button type="button" onClick={() => setPicking(false)} className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-semibold text-[var(--wh-ink)]">Cancel</button>
    </div>
  ) : null;
  const moveErrorBox = moveError ? (
    <div role="alert" className="pointer-events-auto flex items-center gap-2 rounded-md bg-[var(--wh-danger-bg)] py-1 pr-1 pl-3 text-sm text-[var(--wh-danger-hover)] shadow-[0_8px_24px_var(--wh-backdrop)]">
      <span className="grow py-1">{moveError}</span>
      <button type="button" aria-label="Close the message" onClick={() => setMoveError(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-[var(--wh-hover)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  ) : null;
  const floating = pickBar || moveErrorBox ? <Floating>{pickBar}{moveErrorBox}</Floating> : null;
  // Room at the foot of the page, so the floating bar can't hide the last
  // hour of the diary: scrolling to the bottom brings it above the bar.
  const floatingSpacer = floating ? <div data-floating-spacer aria-hidden="true" className="h-28" /> : null;

  // ---- Phone (piece 4) ----
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
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
      <span aria-hidden="true" className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? 'bg-[var(--wh-panel)] text-[var(--wh-accent-soft-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
        {badge}
      </span>
      {label}
    </button>
  );

  // The Waiting list as a sheet: on a phone, and on an upright tablet where
  // there's no room for its column (Jack, 16 Oct; layout review 238, item 7).
  const chooseItem = (item: WaitingItem) => {
    if (chosen === item.jobId) { setOpenItem(item); setSheetOpen(false); return; }
    setChosen(item.jobId ?? null);
    const day = cardDay(item);
    if (day) set({ date: day, who: null });
    setSheetOpen(false);
  };
  // The chosen card with Open, at the foot of a phone or an upright tablet,
  // where there's no Waiting column to show it in.
  const chosenItem = items.find((i) => i.jobId === chosen) ?? null;
  const chosenBar = chosenItem ? (
    <div role="status" aria-label="Chosen from Waiting for you" className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 pt-2.5 pb-3 shadow-[0_-6px_18px_var(--wh-backdrop)]">
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
  ) : null;
  const waitingSheet = (
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
  );

  if (isPhone) {
    const week = weekOf(date);
    const showing = shared ? 'Shared queue' : whoId !== null ? people.find((m) => m.id === whoId)?.name ?? 'Everyone' : byMechanic ? 'By mechanic' : 'Everyone';
    const hours: number[] = [];
    for (let m = Math.ceil(range.start / 60) * 60; m < range.end; m += 60) hours.push(m);
    const noTime = columns.length === 1 ? shown.filter((j) => j.jobDate === date && !j.startTime) : [];
    const pickPeople = (value: string | null) => { set({ who: value }); setPeopleOpen(false); };
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
            onClick={() => { setPicking((v) => !v); setMoveError(null); }}
            className={`inline-flex size-11 items-center justify-center rounded-[10px] text-[22px] ${picking ? 'bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}
          >
            <span aria-hidden="true">+</span>
          </button>,
          headerSlot,
        ) : null}

        <div className="flex flex-col gap-2 border-b border-[var(--wh-border)] px-3.5 py-2.5">
          {/* The people chip shortens its text, rather than the row running off
              a narrow phone, when Today is showing (Jack, 16 Oct). */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="relative min-w-0">
              <button
                type="button"
                aria-expanded={peopleOpen}
                aria-label={`Showing ${showing}. Change whose jobs are shown`}
                onClick={() => setPeopleOpen((o) => !o)}
                className="inline-flex min-h-11 max-w-full items-center gap-[7px] rounded-full bg-[var(--wh-accent-soft)] py-[5px] pr-2.5 pl-1.5 text-sm font-semibold whitespace-nowrap text-[var(--wh-accent-soft-ink)]"
              >
                <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--wh-panel)]">
                  {whoId !== null ? initial(showing) : <NavIcon name="customers" size={14} />}
                </span>
                <span className="min-w-0 truncate">{showing}</span>
                <Chevron dir="next" />
              </button>
              {peopleOpen ? (
                <div role="menu" aria-label="Whose jobs to show" className="absolute top-full left-0 z-20 mt-1 flex min-w-[200px] flex-col rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-[0_10px_26px_var(--wh-backdrop)]">
                  {[{ v: null as string | null, label: 'Everyone' }, { v: 'bymech', label: 'By mechanic' }, ...people.map((m) => ({ v: String(m.id), label: m.name })), { v: 'shared', label: 'Shared queue' }].map((o) => (
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
            <div className="flex shrink-0 items-center gap-0">
              <button type="button" aria-label="Previous week" onClick={() => set({ date: addDays(date, -7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="prev" />
              </button>
              <button type="button" aria-haspopup="dialog" aria-label={`Choose a day. Showing ${shortWeek(week[0])}`} onClick={() => setChooseOpen(true)} className="inline-flex min-h-11 min-w-[66px] items-center justify-center text-sm font-bold whitespace-nowrap">{shortWeek(week[0])}</button>
              <button type="button" aria-label="Next week" onClick={() => set({ date: addDays(date, 7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="next" />
              </button>
              {/* Back to today in one tap, shown only away from it (Jack, 16 Oct; layout review 238, item 9). */}
              {date !== today ? (
                <button type="button" onClick={() => set({ date: null })} className="min-h-11 rounded-md px-1.5 text-sm font-semibold">Today</button>
              ) : null}
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
                  <button type="button" key={j.partId} disabled={picking} onClick={() => openJob(j)} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--wh-state-scheduled-ink)] px-3 text-[13px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
                    <span className={SR}>{describe(j, false)}</span>
                    <span aria-hidden="true">{j.bikeLabel || 'Bike'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
        <p role="status" aria-live="polite" className={SR}>{moveNote}</p>

        <section aria-label={`Workshop diary, ${dayLabel(date)}`} className="px-3.5 pb-3.5">
          {/* By mechanic: each column keeps a readable 96px and the diary scrolls
              sideways in its own area; the times stay put and the names move
              with their columns (Jack, 17 Oct). */}
          {columns.length > 1 ? (
            <div ref={mechHeadRef} data-mech-headings className="sticky top-0 z-[4] overflow-hidden bg-[var(--wh-bg)]">
              <div className="grid" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(96px, 1fr))` }}>
                <span className="sticky left-0 z-[1] bg-[var(--wh-bg)]" />
                {columns.map((c) => (
                  <span key={c.key} data-mech className="truncate border-b border-l border-[var(--wh-border)] px-1 py-1.5 text-center text-sm font-bold first:border-l-0">{c.label}</span>
                ))}
              </div>
            </div>
          ) : null}
          <SlotContext.Provider value={PHONE_SLOT_H}>
            <PickContext.Provider value={pickApi}>
            <MoveContext.Provider value={moveApi}><ExtrasContext.Provider value={extrasApi}>
              <div
                data-mech-scroll
                className="scroll-pl-12 overflow-x-auto"
                onScroll={(e) => { if (mechHeadRef.current) mechHeadRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
              >
              <div className="grid pt-2" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(${columns.length > 1 ? 96 : 0}px, 1fr))` }}>
                <div data-hours aria-hidden="true" className="sticky left-0 z-[3] bg-[var(--wh-bg)]" style={{ height: ((range.end - range.start) / 30) * PHONE_SLOT_H }}>
                  {hours.map((m) => (
                    <span key={m} className="absolute left-0 font-[family-name:var(--wh-font-mono)] text-xs text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * PHONE_SLOT_H - 8, 0) }}>
                      {hhmm(m)}
                    </span>
                  ))}
                </div>
                {columns.map((c, i) => (
                  <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={false} chosenId={chosen} lightChosen={chosenTimeShown} />
                ))}
              </div>
              </div>
            </ExtrasContext.Provider></MoveContext.Provider>
            </PickContext.Provider>
          </SlotContext.Provider>
        </section>

        {/* The foot of the phone page: passing messages sit above the chosen
            card's bar, at the end of the page, so nothing above moves and
            neither covers the other (Jack, 16 Oct). */}
        <div data-phone-foot className="sticky bottom-0 z-30 flex flex-col">
        {pickBar || moveErrorBox ? <div className="flex flex-col gap-2 px-3.5 pb-2">{pickBar}{moveErrorBox}</div> : null}
        {chosenBar}
        </div>

        {waitingSheet}
        <ChooseDaySheet key={chooseOpen ? `open-${date}` : 'closed'} open={chooseOpen} date={date} who={(j) => (shared ? j.mechanicId === null : whoId === null || j.mechanicId === whoId)} whose={shared ? 'Shared queue' : whoId !== null ? people.find((m) => m.id === whoId)?.name ?? 'everyone' : 'everyone'} onClose={() => setChooseOpen(false)} onPick={(d) => { setChooseOpen(false); set({ date: d }); }} />

        {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} onOpenJob={(id) => { setOpenItem(null); setOpenJobId(id); }} /> : null}
        {newJobDialog}
        {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
        {extrasUi}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar (decision 60): view and dates together · people and New job.
          From 1280px, spaced as the desktop Shared queue drawing (Jack, 18 Oct)
          so four people buttons fit one row; tablets keep their drawn spacing. */}
      <div className="flex flex-wrap items-center gap-3 xl:gap-x-1">
        <div role="tablist" aria-label="Diary view" className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-[10px] bg-[var(--wh-surface-muted)] p-[3px]">
          {(['week', 'day', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => { if (v === 'month') setPicking(false); set({ view: v === 'week' ? null : v }); }}
              className={`inline-flex min-h-[38px] items-center rounded-lg px-4 text-[13px] font-semibold pointer-coarse:min-h-11 ${view === v ? 'bg-[var(--wh-panel)] shadow-[0_1px_2px_var(--wh-border)]' : ''}`}
            >
              {v === 'week' ? 'Week' : v === 'day' ? 'Day' : 'Month'}
            </button>
          ))}
        </div>
        {/* Week/Day and the dates together at the left, one control (Jack, 16 Oct; layout review 238, item 1). */}
        <div className="inline-flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => set({ date: shift(-1) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="prev" />
          </button>
          <span className="min-w-[164px] text-center text-sm font-semibold whitespace-nowrap">{view === 'week' ? weekLabel(start) : view === 'month' ? monthLabel(date) : dayLabel(date)}</span>
          <button type="button" aria-label={`Next ${unit}`} onClick={() => set({ date: shift(1) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="next" />
          </button>
          <button type="button" onClick={() => set({ date: null })} className="ml-0.5 min-h-11 rounded-md px-2.5 text-[13px] font-semibold">
            Today
          </button>
        </div>
        {/* On an upright tablet this group is its own row: people on the left,
            Waiting and New job on the right (layout review 238, item 7). */}
        <div className="flex basis-full items-center gap-3 lg:grow lg:basis-auto xl:gap-0">
        <div className="hidden grow lg:block" />
        <div role="group" aria-label="Mechanic" className="flex flex-wrap items-center gap-1.5 xl:gap-1">
          {chip('all', 'Everyone', 'Everyone', <NavIcon name="customers" size={13} />, whoId === null && !shared)}
          {people.map((m) => chip(String(m.id), m.name.split(' ')[0], m.name, initial(m.name), whoId === m.id))}
          {chip('shared', 'Shared queue', 'Shared queue', <NavIcon name="customers" size={13} />, shared)}
        </div>
        <div className="grow lg:hidden" />
        <button
          type="button"
          aria-label={`Waiting for you, ${waiting.data?.count ?? items.length}`}
          onClick={() => setSheetOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-[7px] rounded-[10px] border border-[var(--wh-input-border)] bg-[var(--wh-panel)] pr-2.5 pl-3 text-[15px] font-semibold lg:hidden"
        >
          Waiting
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] px-[7px] text-[13px] font-bold">{waiting.data?.count ?? items.length}</span>
        </button>
        <div className="hidden w-5 shrink-0 lg:block xl:w-2" />
        {picking ? (
          <button type="button" aria-pressed="true" onClick={() => setPicking(false)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            Choose a time
          </button>
        ) : (
          <button type="button" onClick={() => { if (view === 'month') set({ view: null }); setPicking(true); setMoveError(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            <span aria-hidden="true">+</span>
            New job
          </button>
        )}
        </div>
      </div>
      {isNarrow ? null : floating}

      <div className="flex items-start gap-4">
        {/* Waiting for you (decision 14). */}
        {/* Boxed in as a panel, its count a badge (Jack, 16 Oct; the layout review, pull request 238). */}
        <section aria-labelledby="waiting-heading" className="hidden w-[184px] shrink-0 flex-col gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-surface-muted)] p-2.5 lg:flex lg:w-[224px]">
          <h2 id="waiting-heading" className="m-0 flex items-center gap-2 text-sm font-bold">
            {/* Screen readers hear the name in one piece: "Waiting for you (2)". */}
            <span aria-hidden="true">Waiting for you</span>
            <span data-count-badge aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-panel)] px-[7px] text-[13px] font-bold text-[var(--wh-ink)]">{waiting.data?.count ?? items.length}</span>
            <span className={SR}>{`Waiting for you (${waiting.data?.count ?? items.length})`}</span>
          </h2>
          {items.length === 0 && waiting.isSuccess ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">Nothing waiting.</p> : null}
          {items.map((item) => {
            const card = waitingCard(item);
            const on = chosen === item.jobId;
            // byTap: the card was chosen by a finger, not a mouse or the keyboard.
            const choose = (byTap = false) => {
              setChosen(item.jobId ?? null);
              setChosenByTouch(byTap);
              const day = cardDay(item);
              if (day) set({ date: day, who: null });
            };
            return (
              <div
                key={`${item.kind}-${item.jobId}`}
                className={`flex flex-col gap-2 rounded-lg bg-[var(--wh-panel)] ${on ? 'border-2 border-[var(--accent)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'border border-[var(--wh-border)]'}`}
              >
                {/* One click chooses the card; double-click, or Open, opens it; on a
                    touch screen a second tap opens it too (decision 14). A click
                    from the keyboard (detail 0) is never a tap, as for a stack. */}
                <button
                  type="button"
                  aria-pressed={on}
                  onPointerDown={(e) => { cardPointer.current = e.pointerType; }}
                  onClick={(e) => { const tap = e.detail > 0 && cardPointer.current === 'touch'; if (on && tap) setOpenItem(item); else choose(tap); }}
                  onDoubleClick={() => { choose(); setOpenItem(item); }}
                  className="flex flex-col gap-[5px] rounded-lg px-3 pt-2.5 pb-2.5 text-left"
                >
                  {/* Larger on a touch screen, as drawn for the tablet (layout review 238, item 4). */}
                  <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[card.tone]}`}>{card.label}</span>
                  <span className="text-[13px] font-bold pointer-coarse:text-[15px]">{card.customer}</span>
                  <span className="text-xs pointer-coarse:text-[13px]">{card.detail}</span>
                </button>
                {on ? (
                  <button
                    type="button"
                    aria-label={`Open ${card.customer}'s request`}
                    onClick={() => setOpenItem(item)}
                    className="mx-3 mb-2.5 inline-flex min-h-8 self-start items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-bold text-[var(--wh-on-brand)] pointer-coarse:min-h-11 pointer-coarse:px-[18px] pointer-coarse:text-sm"
                  >
                    Open
                  </button>
                ) : null}
              </div>
            );
          })}
          {/* How to open the chosen card, as drawn (layout review 238, item 3; decision 14). */}
          {chosen !== null && items.some((i) => i.jobId === chosen) ? (
            <p className="m-0 text-xs text-[var(--wh-muted)]">{chosenByTouch ? 'Tap the card again to open it.' : 'Double-click a card to open it.'}</p>
          ) : null}
        </section>

        <div className="flex min-w-0 grow flex-col gap-2.5">
          <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
          <p role="status" aria-live="polite" className={SR}>{moveNote}</p>
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
      {isNarrow ? (
        // An upright tablet: the foot of the page, as on a phone.
        <div data-tablet-foot className="sticky bottom-0 z-30 -mx-3.5 flex flex-col md:-mx-[22px]">
          {pickBar || moveErrorBox ? <div className="flex flex-col gap-2 px-3.5 pb-2">{pickBar}{moveErrorBox}</div> : null}
          {chosenBar}
        </div>
      ) : floatingSpacer}
      {waitingSheet}
      {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} onOpenJob={(id) => { setOpenItem(null); setOpenJobId(id); }} /> : null}
      {newJobDialog}
      {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
      {extrasUi}
    </div>
  );
}
