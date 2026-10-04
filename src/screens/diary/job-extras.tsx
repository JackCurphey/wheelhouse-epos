import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { STATE_LABEL, dayLabel, type DiaryState } from './rules.ts';

/**
 * The diary's extras (piece 5b): the hover summary, View overview, the
 * right-click menu, and the chooser a stack opens.
 * Drawn by diary-hover-summary, diary-context-menu and diary-stack-open in
 * docs/design/user-journeys/generator/diary.mjs (decisions 37, 58, 61, 65).
 * Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5b)
 */

export type DiaryJob = WorkshopJob & { state: DiaryState; partId: number };

type Order = { id: number; total: number; items: { id: number; name: string; qty: number; lineTotal: number }[] };
type Quote = { id: number; state: string; lines: { id: number; description: string; quantity: number; lineTotal: number; decision: string }[] };

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const ANSWERED = new Set(['approved', 'partly_approved', 'declined']);

export const headOf = (j: WorkshopJob) => [j.title, j.reference].filter(Boolean).join(' · ');
export const whoOf = (j: WorkshopJob) => `${j.customerName || 'No customer'} · ${j.bikeLabel || 'Bike'}`;

/**
 * Notes, then line items and the cost (decision 37's quick overview). The
 * job keeps one notes field, so the shop's notes carry no name or time.
 */
export function JobSummary({ job, columns = true }: { job: WorkshopJob; columns?: boolean }) {
  const order = useQuery({
    queryKey: ['sale-document', job.orderId],
    queryFn: () => apiGet<Order>(`/api/sale-documents/${job.orderId}`),
    enabled: Boolean(job.orderId),
  });
  const answered = job.quote && ANSWERED.has(job.quote.state) ? job.quote : null;
  const quote = useQuery({
    queryKey: ['quote', answered?.id],
    queryFn: () => apiGet<Quote>(`/api/quotes/${answered?.id}`),
    enabled: Boolean(answered),
  });
  const declined = (quote.data?.lines ?? []).filter((l) => l.decision === 'declined');
  const label = 'text-[11px] font-bold tracking-[0.3px] text-[var(--wh-muted)] uppercase';

  return (
    <div className={`flex gap-4 ${columns ? 'flex-row' : 'flex-col'}`}>
      <div className="flex min-w-0 grow flex-col gap-2">
        <span className={label}>Notes</span>
        {job.customerDescription ? (
          <div className="flex flex-col gap-px">
            <span className="text-[11px] font-bold text-[var(--wh-muted)]">Customer</span>
            <span className="text-[13px] leading-snug">{job.customerDescription}</span>
          </div>
        ) : null}
        {job.notes ? (
          <div className="flex flex-col gap-px">
            <span className="text-[11px] font-bold text-[var(--wh-muted)]">Shop</span>
            <span className="text-[13px] leading-snug whitespace-pre-line">{job.notes}</span>
          </div>
        ) : null}
        {!job.customerDescription && !job.notes ? <span className="text-[13px] text-[var(--wh-muted)]">No notes yet.</span> : null}
      </div>
      <div className={`flex flex-col gap-[5px] ${columns ? 'w-[190px] shrink-0' : ''}`}>
        <span className={label}>Line items</span>
        {!job.orderId || (order.data && order.data.items.length === 0 && declined.length === 0)
          ? <span className="text-[13px] text-[var(--wh-muted)]">No work or parts yet.</span>
          : null}
        {job.orderId && order.isPending ? <span className="text-[13px] text-[var(--wh-muted)]">Loading…</span> : null}
        {job.orderId && order.isError ? <span className="text-[13px]">Couldn’t load the line items.</span> : null}
        {(order.data?.items ?? []).map((l) => (
          <div key={l.id} className="flex justify-between gap-2 text-[13px]">
            <span className="min-w-0">{l.qty > 1 ? `${l.name} × ${l.qty}` : l.name}</span>
            <span className="font-mono">{money(l.lineTotal)}</span>
          </div>
        ))}
        {declined.map((l) => (
          <div key={`q${l.id}`} className="flex justify-between gap-2 text-[13px] text-[var(--wh-muted)] line-through">
            <span className="min-w-0">{l.description}</span>
            <span className="font-mono">{money(l.lineTotal)}</span>
          </div>
        ))}
        {order.data ? (
          <div className="mt-1 flex justify-between gap-2 border-t border-[var(--wh-border)] pt-1.5">
            <span className="text-[13px] font-bold">Cost</span>
            <span className="font-mono text-[15px] font-bold">{money(order.data.total)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Decision 65: the summary beside a job the mouse rests on. Hidden from
 * screen readers (the block's own label reads the job out; View overview has
 * the same content), and it never takes the pointer.
 */
export function HoverSummary({ job, rect }: { job: WorkshopJob; rect: DOMRect }) {
  const W = Math.min(520, window.innerWidth - 16);
  const right = rect.right + 8 + W <= window.innerWidth;
  const left = right ? rect.right + 8 : Math.max(8, rect.left - 8 - W);
  const top = Math.max(8, rect.top - 24);
  return (
    <div
      data-hover-summary
      aria-hidden="true"
      className="pointer-events-none fixed z-30 flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 shadow-[0_10px_26px_var(--wh-backdrop)]"
      style={{ left, top, width: W }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">{headOf(job)}</span>
        <span className="text-[13px] text-[var(--wh-muted)]">{whoOf(job)}</span>
      </div>
      <JobSummary job={job} />
    </div>
  );
}

/** View overview: the summary in a pop-up that stays until it's closed. */
export function OverviewDialog({ job, onClose, onOpenJob }: { job: WorkshopJob; onClose: () => void; onOpenJob: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} wide aria-labelledby="overview-title" aria-describedby="overview-sub">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="overview-title">{headOf(job)}</DialogTitle>
          <DialogDescription id="overview-sub">{whoOf(job)}</DialogDescription>
        </div>
        <DialogClose onClick={onClose} aria-label="Close" />
      </DialogHeader>
      <DialogBody>
        <JobSummary job={job} columns={window.innerWidth >= 640} />
      </DialogBody>
      <DialogFooter>
        <Button variant="primary" onClick={onOpenJob}>Open job</Button>
      </DialogFooter>
    </Dialog>
  );
}

export type MenuAt = { x: number; y: number; touch: boolean; phone: boolean };

/**
 * Decision 37: Open job and View overview. Arrow keys move through it,
 * Escape or a click elsewhere closes it, and focus goes back to the job.
 */
export function JobMenu({ job, at, onClose, onOpenJob, onOverview }: {
  job: WorkshopJob; at: MenuAt; onClose: (returnFocus: boolean) => void; onOpenJob: () => void; onOverview: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || at.phone) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    });
  }, [at]);
  // The diary passes a fresh onClose on every redraw, so read it through a ref:
  // focus goes to the first item once, when the menu opens, not on each redraw.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current(false);
    };
    // It sits where it was opened, so scrolling the diary closes it.
    const scrolled = () => closeRef.current(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('scroll', scrolled, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('scroll', scrolled, true);
    };
  }, []);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
    } else if (e.key === 'Tab') {
      onClose(false);
    }
  }

  const tip = at.touch
    ? 'Tip: keep holding to see the job’s summary straight away.'
    : 'Tip: hold the right mouse button to open the overview straight away.';
  const item = `flex w-full items-center px-3.5 text-left font-semibold hover:bg-[var(--wh-hover)] focus-visible:bg-[var(--wh-hover)] ${at.touch ? 'min-h-12 text-[15px]' : 'min-h-10 text-sm'}`;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Job actions"
      aria-describedby={at.phone ? 'job-menu-head' : undefined}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      className={at.phone
        ? 'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] pb-4 shadow-[0_-10px_26px_var(--wh-backdrop)]'
        : `fixed z-40 flex flex-col overflow-hidden rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] py-1 shadow-[0_10px_26px_var(--wh-backdrop)] ${at.touch ? 'w-[236px]' : 'w-[208px]'}`}
      style={at.phone ? undefined : pos}
    >
      {at.phone ? (
        // As drawn (diary-context-menu, phone): the job, then whose it is. A
        // menu holds only menu items, so this is the menu's description.
        <span id="job-menu-head" aria-hidden="true" className="flex flex-col gap-0.5 px-4 pt-3.5 pb-2">
          <span className="text-base font-bold">{headOf(job)}</span>
          <span className="text-sm text-[var(--wh-muted)]">{whoOf(job)}</span>
        </span>
      ) : null}
      <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={onOpenJob}>Open job</button>
      <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={onOverview}>View overview</button>
      <p className="m-0 border-t border-[var(--wh-border)] px-3.5 pt-2 pb-1.5 text-xs leading-snug text-[var(--wh-muted)]">{tip}</p>
    </div>
  );
}

const TILE: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] border-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] border-[var(--wh-state-pending-ink)]',
  answer: 'bg-[var(--wh-state-answer-bg)] border-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] border-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] border-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] border-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] border-[var(--wh-state-cancelled-ink)]',
};
export const tileClass = (s: DiaryState) => TILE[s];

/** Where a stack's chooser opens: a box under the stack, or (phone) a sheet. */
export type ChooserAt = { phone: boolean; touch: boolean; anchor: DOMRect | null };

/**
 * Decision 61: a stack opens a chooser with a tile for each of its jobs.
 * Drawn (diary-stack-open) as a small box under the stack on a computer or
 * tablet, and a sheet on a phone. A tap shows the touch tiles, with each
 * job's number and times (touchStackTile); a click shows bike, work and start.
 */
export function StackChooser({ jobs, time, at, onClose, onPick, onMove, onMenu }: {
  jobs: DiaryJob[]; time: string; at: ChooserAt; onClose: (returnFocus: boolean) => void; onPick: (j: DiaryJob) => void;
  /** M on a tile: move that job with the arrow keys, as on any job block. */
  onMove: (j: DiaryJob) => void;
  /** The Menu key or Shift+F10 on a tile: that job's actions. */
  onMenu: (j: DiaryJob) => void;
}) {
  const hints = (
    <>
      <p id="stack-sub" className="sr-only">{`${dayLabel(jobs[0].jobDate)} · choose one to open`}</p>
      <p id="stack-move-hint" className="sr-only">Press Enter to open the job, M to move it with the arrow keys, or the Menu key for more.</p>
      <p id="stack-open-hint" className="sr-only">Press Enter to open the job, or the Menu key for more.</p>
    </>
  );
  const tiles = jobs.map((j) => {
    const canMove = j.state !== 'pending' && j.state !== 'cancelled';
    return (
      <button
        key={j.partId}
        type="button"
        aria-label={`${j.bikeLabel || 'Bike'}, ${j.title}, ${j.reference}, ${STATE_LABEL[j.state]}`}
        aria-describedby={canMove ? 'stack-move-hint' : 'stack-open-hint'}
        onClick={() => onPick(j)}
        onKeyDown={(e) => {
          // A booking request is answered before it's moved; a cancellation isn't moved.
          if ((e.key === 'm' || e.key === 'M') && canMove) { e.preventDefault(); onMove(j); }
          else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); onMenu(j); }
        }}
        className={`flex flex-col items-start gap-px overflow-hidden rounded-md px-2 py-1.5 text-left ${at.touch || at.phone ? 'min-h-14 border' : 'border-[1.75px]'} ${TILE[j.state]}`}
      >
        <span className={`w-full truncate font-bold text-[var(--wh-ink)] ${at.phone ? 'text-sm' : 'text-xs'}`}>{j.bikeLabel || 'Bike'}</span>
        {at.touch || at.phone ? (
          <>
            <span className={`w-full truncate font-bold ${at.phone ? 'text-[13px]' : 'text-xs'}`}>{j.title}</span>
            <span className="w-full truncate text-xs text-[var(--wh-ink)] opacity-80">{`${j.reference} · ${j.startTime ?? ''}–${j.endTime ?? ''}`}</span>
          </>
        ) : (
          <span className="w-full truncate text-xs font-bold">{`${j.title} · ${j.startTime ?? ''}`}</span>
        )}
      </button>
    );
  });
  if (at.phone) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(false); }} aria-labelledby="stack-title" aria-describedby="stack-sub">
        <DialogHeader>
          <div className="min-w-0 grow">
            <DialogTitle id="stack-title">{`${jobs.length} jobs at ${time}`}</DialogTitle>
            <DialogDescription>{`${dayLabel(jobs[0].jobDate)} · choose one to open`}</DialogDescription>
          </div>
          <DialogClose onClick={() => onClose(false)} aria-label="Close" />
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-2">
          {hints}
          {tiles}
        </DialogBody>
      </Dialog>
    );
  }
  return <StackBox jobs={jobs} time={time} at={at} onClose={onClose} hints={hints} tiles={tiles} />;
}

/** The computer and tablet chooser: a box under the stack, first job focused, Escape back to the stack. */
function StackBox({ jobs, time, at, onClose, hints, tiles }: {
  jobs: DiaryJob[]; time: string; at: ChooserAt; onClose: (returnFocus: boolean) => void; hints: ReactNode; tiles: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tileW = at.touch ? 150 : 122;
  const width = Math.min(jobs.length, 2) * tileW + 8 + (at.touch ? 20 : 16);
  const a = at.anchor;
  const [pos, setPos] = useState({ left: a ? a.left + a.width / 2 - width / 2 : 8, top: a ? a.bottom + 8 : 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos((p) => ({
      left: Math.max(8, Math.min(p.left, window.innerWidth - r.width - 8)),
      // No room below: open above the stack.
      top: a && p.top + r.height > window.innerHeight - 8 ? Math.max(8, a.top - r.height - 8) : p.top,
    }));
  }, [a]);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current(false);
    };
    // It sits where it was opened, so scrolling the diary closes it.
    const scrolled = () => closeRef.current(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('scroll', scrolled, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('scroll', scrolled, true);
    };
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby="stack-title"
      aria-describedby="stack-sub"
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(true); }
      }}
      onBlur={(e) => {
        // Tabbing out of the box closes it, as with the job menu.
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) onClose(false);
      }}
      className={`fixed z-40 flex flex-col rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] shadow-[0_12px_32px_var(--wh-backdrop)] ${at.touch ? 'gap-2 p-2.5' : 'gap-1.5 p-2'}`}
      style={{ ...pos, width }}
    >
      <span id="stack-title" className={`px-1 font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase ${at.touch ? 'text-xs' : 'text-[11px]'}`}>{`${jobs.length} jobs at ${time}`}</span>
      {hints}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(jobs.length, 2)}, ${tileW}px)` }}>{tiles}</div>
    </div>
  );
}
