import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode } from 'react';
import { tileClass } from './job-extras.tsx';
import { Chevron } from './diary-bits.tsx';
import { BlockLinesContext, ExtrasContext, MoveContext, PickContext, SlotContext, useExtrasHandlers } from './diary-context.ts';
import { StatusShape, hasShape, useStatusSymbols } from './status-shape.tsx';
import { BLOCK, CHIP, SR, blockLine, describe, movable, timeText, type Outline, type Shown } from './diary-model.ts';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { stateWord, dropStart, hhmm, layoutLanes, lengthText, stackGroups, toMinutes } from './rules.ts';

/** "New, booked online", or "New online" where a narrow week column would cut it off (diary.mjs blockMark). */
export function NewOnlineMark({ short }: { short: boolean }) {
  return (
    <>
      <span className="shrink-0"><NavIcon name="website" size={12} /></span>
      {short ? 'New online' : 'New, booked online'}
    </>
  );
}

export function JobBlock({ job, range, wide, chosen, light = false, lane, colIndex, fullMark = false }: {
  job: Shown; range: { start: number }; wide: boolean; chosen: boolean; light?: boolean; lane?: { lane: number; total: number }; colIndex: number; fullMark?: boolean;
}) {
  const SLOT_H = useContext(SlotContext);
  const move = useContext(MoveContext);
  const picking = useContext(PickContext);
  const lines = useContext(BlockLinesContext);
  const moving = move?.preview?.partId === job.partId ? move.preview : null;
  const { onMenuKey, onPress, ...hover } = useExtrasHandlers(job);
  const start = moving ? moving.startMin : toMinutes(job.startTime as string);
  const end = moving ? moving.startMin + moving.durationMin : job.endTime ? toMinutes(job.endTime) : start + 30;
  const top = ((start - range.start) / 30) * SLOT_H + 2;
  const height = Math.max(((end - start) / 30) * SLOT_H - 4, SLOT_H - 6);
  const cancelled = job.state === 'cancelled';
  const mark = Boolean(job.newOnline);
  // The full words on a phone and in a wide column; short in a narrow week column (design).
  const shortMark = !wide && !fullMark;
  // Show status symbols: in a narrow week column, where the word doesn't fit, and on every request, as drawn
  // (diary.mjs jobBlock, pendingBlock); not a phone's job blocks (touchJobBlock, review), nor a state with no shape.
  const symbol = useStatusSymbols() && hasShape(job.state) && ((!wide && !fullMark) || job.state === 'pending');
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
  const className = `${laned} absolute flex flex-col overflow-hidden rounded-[5px] border-[1.75px] py-[3px] pl-1.5 text-left ${symbol ? 'pr-4' : 'pr-1.5'} ${BLOCK[job.state]} ${cancelled ? 'opacity-80' : ''} ${chosen ? (light ? 'z-[1] shadow-[0_0_0_2px_var(--wh-muted)]' : 'z-[1] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]') : ''} ${moving?.stretch ? 'z-[2] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_var(--wh-highlight)]' : moving ? 'z-[2] cursor-grabbing shadow-[0_10px_26px_var(--wh-backdrop)]' : ''} ${picking ? 'pointer-events-none opacity-50' : ''}`;
  const inner = (
    <>
      <span className={SR}>{describe(job, chosen)}</span>
      {symbol ? <StatusShape state={job.state} /> : null}
      {/* Confirmed straight away, until someone opens it (Jack, 19 Oct, auto-confirm),
          placed as the drawing does (diary.mjs blockMark): one line, "first line · mark";
          two lines, the first line then the mark; three or more, first, second, mark.
          The two lines are the shop's choice (Settings › Workshop › Diary blocks). */}
      <span aria-hidden="true" className={`flex items-center gap-1 truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)] ${cancelled ? 'line-through' : ''}`}>
        <span className="truncate">{blockLine(job, lines.first)}</span>
        {mark && height < TWO_LINES ? <>{' · '}<NewOnlineMark short={shortMark} /></> : null}
      </span>
      {/* A block too short for two 12px lines shows its first line only (drawn, walk 1 M3);
          the job stays in its description and summary. */}
      {height >= TWO_LINES && !(mark && height < THREE_LINES) ? (
        <span aria-hidden="true" className="truncate text-xs leading-[14px] font-bold">
          {[job.partCount > 1 ? `Day ${job.partPos} of ${job.partCount}` : '', blockLine(job, lines.second), wide ? stateWord(job) : ''].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {mark && height >= TWO_LINES ? (
        <span aria-hidden="true" className="flex items-center gap-1 truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)]">
          <NewOnlineMark short={shortMark} />
        </span>
      ) : null}
      {/* Where the bike is kept, on the next line where there's room (storage slots; diary.mjs jobBlock). */}
      {lines.slotsOn && job.storageSlotName && height >= (mark ? FOUR_LINES : THREE_LINES) ? (
        <span aria-hidden="true" className="truncate text-xs leading-[14px] font-semibold text-[var(--wh-muted)]">{job.storageSlotName}</span>
      ) : null}
    </>
  );
  // An offered time opens its pop-up, but isn't dragged (Jack, 20 Oct, request-offered).
  if (move && job.state === 'offered' && !picking) {
    return (
      <button type="button" title={describe(job, false)} className={className} style={style} {...hover} onPointerDown={onPress} onKeyDown={(e) => { onMenuKey?.(e); }} onClick={() => move.onOpen(job)}>
        {inner}
      </button>
    );
  }
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
export function StackBlock({ jobs, start, end, range, lane, colIndex, chosen }: {
  jobs: Shown[]; start: number; end: number; range: { start: number }; lane?: { lane: number; total: number }; colIndex: number; chosen: boolean;
}) {
  const SLOT_H = useContext(SlotContext);
  const extras = useContext(ExtrasContext);
  const picking = useContext(PickContext);
  const lines = useContext(BlockLinesContext);
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
  const names = jobs.map((j) => `${j.bikeLabel || 'Bike'} · ${j.title} (${j.reference})${j.newOnline ? ', new, booked online' : ''}`).join(', ');
  // Not drawn: a stack with a new online booking in it says so on its front, and
  // its name says which job (decided-while-building, 21 Oct, new-online-on-stacks).
  const anyNew = jobs.some((j) => j.newOnline);
  const inner = ((end - start) / 30) * SLOT_H - 4;
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
        {/* As a block places it: beside the bike on a one-line stack, else on its own line. */}
        <span aria-hidden="true" className="flex items-center gap-1 truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)]">
          <span className="truncate">{blockLine(front, lines.first)}</span>
          {anyNew && inner < TWO_LINES ? <>{' · '}<NewOnlineMark short /></> : null}
        </span>
        {anyNew && inner >= TWO_LINES ? (
          <span aria-hidden="true" className="flex items-center gap-1 truncate text-xs leading-[14px] font-bold text-[var(--wh-ink)]"><NewOnlineMark short /></span>
        ) : null}
        {inner >= (anyNew ? THREE_LINES : TWO_LINES) ? (
          <span aria-hidden="true" className="truncate text-xs leading-[14px] font-semibold text-[var(--wh-muted)]">{`${blockLine(front, lines.second)} · ${hhmm(start)}`}</span>
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
  const lines = useContext(BlockLinesContext);
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
      <span className="truncate text-xs font-bold text-[var(--wh-ink)]">{blockLine(job, lines.first)}</span>
      <span className="truncate text-xs font-bold">{blockLine(job, lines.second)}</span>
      {/* Bike, job, then the mark, as a tall block has it. */}
      {job.newOnline ? <span className="flex items-center gap-1 truncate text-xs font-bold text-[var(--wh-ink)]"><NewOnlineMark short /></span> : null}
      {/* Fanned by a press and hold: the touch tile's number and times (touchStackTile). */}
      <span className="truncate text-xs text-[var(--wh-muted)]">{touch ? `${job.reference} · ${job.startTime}–${job.endTime ?? ''}` : job.reference}</span>
    </button>
  );
}

/** Room for two 12px lines in a block: its padding and border, and two lines (diary.mjs, D_LINE_H 14). */
const TWO_LINES = 10 + 2 * 14;
const THREE_LINES = TWO_LINES + 14;
const FOUR_LINES = THREE_LINES + 14;

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

export function Column({ label, index, jobs, outlines, range, wide, chosenId, lightChosen = false, fullMark = false }: {
  label: string; index: number; jobs: Shown[]; outlines: Outline[]; range: { start: number; end: number }; wide: boolean; chosenId: number | null; lightChosen?: boolean; fullMark?: boolean;
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
        <JobBlock key={g.id} job={byId.get(g.id) as Shown} range={range} wide={wide} chosen={byId.get(g.id)?.id === chosenId} light={lightChosen} lane={lanes.get(g.id)} colIndex={index} fullMark={fullMark} />
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
        <span key={m} data-hour-label="" className="absolute right-1 font-[family-name:var(--wh-font-mono)] text-xs text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * SLOT_H - 6, 1) }}>
          {hhmm(m)}
        </span>
      ))}
    </div>
  );
}

export function Grid({ heads, columns, noTime, onOpen, range, ariaLabel }: {
  heads: { key: string; top?: string; main: string; today?: boolean }[];
  columns: ReactNode[];
  noTime?: Shown[];
  onOpen: (job: Shown) => void;
  range: { start: number; end: number };
  ariaLabel: string;
}) {
  // While New job picks a time, the chips can't be opened, as blocks can't.
  const picking = useContext(PickContext);
  // The hour column grows with Larger text, so its times aren't cut off (larger-text, review of the screenshot).
  const gutter = 'calc(44px * var(--wh-text-scale))';
  const cols = `${gutter} repeat(${heads.length}, minmax(0, 1fr))`;
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
        <div className="grid border-b border-[var(--wh-border)]" style={{ gridTemplateColumns: `${gutter} minmax(0, 1fr)` }}>
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
                <span aria-hidden="true" className="inline-flex items-center gap-1">{j.bikeLabel || 'Bike'}{j.newOnline ? <>{' · '}<NewOnlineMark short /></> : null}</span>
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

