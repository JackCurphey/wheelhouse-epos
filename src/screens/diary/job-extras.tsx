import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
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
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
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
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      className={at.phone
        ? 'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] pb-4 shadow-[0_-10px_26px_var(--wh-backdrop)]'
        : `fixed z-40 flex flex-col overflow-hidden rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] py-1 shadow-[0_10px_26px_var(--wh-backdrop)] ${at.touch ? 'w-[236px]' : 'w-[208px]'}`}
      style={at.phone ? undefined : pos}
    >
      {at.phone ? <span aria-hidden="true" className="px-4 pt-3.5 pb-2 text-base font-bold">{headOf(job)}</span> : null}
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

/** Decision 61: a stack opens a chooser with a tile for each of its jobs. */
export function StackChooser({ jobs, time, onClose, onPick, onMove, onMenu }: {
  jobs: DiaryJob[]; time: string; onClose: () => void; onPick: (j: DiaryJob) => void;
  /** M on a tile: move that job with the arrow keys, as on any job block. */
  onMove: (j: DiaryJob) => void;
  /** The Menu key or Shift+F10 on a tile: that job's actions. */
  onMenu: (j: DiaryJob) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby="stack-title" aria-describedby="stack-sub">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="stack-title">{`${jobs.length} jobs at ${time}`}</DialogTitle>
          <DialogDescription id="stack-sub">{`${dayLabel(jobs[0].jobDate)} · choose one to open`}</DialogDescription>
        </div>
        <DialogClose onClick={onClose} aria-label="Close" />
      </DialogHeader>
      <DialogBody className="grid grid-cols-2 gap-2">
        <p id="stack-move-hint" className="sr-only">Press Enter to open the job, M to move it with the arrow keys, or the Menu key for more.</p>
        {jobs.map((j) => (
          <button
            key={j.partId}
            type="button"
            aria-label={`${j.bikeLabel || 'Bike'}, ${j.title}, ${j.reference}, ${STATE_LABEL[j.state]}`}
            aria-describedby="stack-move-hint"
            onClick={() => onPick(j)}
            onKeyDown={(e) => {
              if (e.key === 'm' || e.key === 'M') { e.preventDefault(); onMove(j); }
              else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); onMenu(j); }
            }}
            className={`flex min-h-14 flex-col items-start gap-0.5 overflow-hidden rounded-[5px] border-[1.75px] px-2 py-1.5 text-left ${TILE[j.state]}`}
          >
            <span className="w-full truncate text-xs font-bold text-[var(--wh-ink)]">{j.bikeLabel || 'Bike'}</span>
            <span className="w-full truncate text-[11px] font-semibold text-[var(--wh-muted)]">{`${j.title} · ${j.startTime ?? ''}`}</span>
          </button>
        ))}
      </DialogBody>
    </Dialog>
  );
}
