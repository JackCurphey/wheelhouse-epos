import { useRef, useState, type MutableRefObject } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '@/staff/routes.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { HoverSummary, JobMenu, OverviewDialog, StackChooser, type ChooserAt, type MenuAt } from './job-extras.tsx';
import type { ExtrasApi } from './diary-context.ts';
import { movable, type Shown } from './diary-model.ts';
import type { WaitingItem } from './rules.ts';

/**
 * Piece 5b: the hover summary, the right-click menu (and holding the right
 * button, or a long press on touch), the overview and a stack's chooser. The
 * page hands over what they open or start; this returns the ExtrasApi the
 * blocks share through context, and the pop-ups to draw.
 */
export function useDiaryExtras({ isPhone, otherBusy, picking, waitingItems, openShown, startStretch, startKeyMove, followPart, justDragged, printJobReceipt, setOpenItem }: {
  isPhone: boolean;
  /** Anything else open or in progress on the page: hover summaries wait for it. */
  otherBusy: boolean;
  picking: boolean;
  waitingItems: WaitingItem[];
  openShown: (job: WorkshopJob & { state: Shown['state'] }) => void;
  startStretch: (job: Shown) => void;
  startKeyMove: (job: Shown, colIndex: number) => void;
  followPart: MutableRefObject<number | null>;
  justDragged: MutableRefObject<boolean>;
  printJobReceipt: (j: Shown) => Promise<void>;
  setOpenItem: (item: WaitingItem) => void;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<{ job: Shown; rect: DOMRect } | null>(null);
  const [menuFor, setMenuFor] = useState<{ job: Shown; at: MenuAt; opener: HTMLElement | null } | null>(null);
  const [overview, setOverview] = useState<Shown | null>(null);
  const [stackJobs, setStackJobs] = useState<Shown[] | null>(null);
  const stackFrom = useRef<{ colIndex: number; opener: HTMLElement } | null>(null);
  const [stackAt, setStackAt] = useState<ChooserAt>({ phone: false, touch: false, anchor: null });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const touchPress = useRef(false);
  const busy = Boolean(otherBusy || menuFor || overview || stackJobs);
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
          onOpenJob={() => { setMenuFor(null); openShown(menuFor.job); }}
          onOverview={() => showOverview(menuFor.job)}
          onStretch={movable(menuFor.job) && !picking ? () => { setMenuFor(null); startStretch(menuFor.job); } : undefined}
          till={(() => {
            const j = menuFor.job;
            if (j.state === 'pending' || j.state === 'offered') return { reason: 'Not booked yet' };
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
            const fromFeed = waitingItems.find((i) => i.jobId === j.id && i.kind === 'new_booking');
            setMenuFor(null);
            const made: WaitingItem = { kind: 'new_booking', jobId: j.id, reference: j.reference, customerName: j.customerName ?? null, serviceNames: [], mechanicId: j.mechanicId ?? null, jobDate: j.jobDate, startTime: j.startTime ?? null, endTime: j.endTime ?? null };
            setOpenItem(fromFeed ?? made);
          } : undefined}
        />
      ) : null}
      {overview ? (
        <OverviewDialog job={overview} onClose={() => setOverview(null)} onOpenJob={() => { setOverview(null); openShown(overview); }} />
      ) : null}
      {stackJobs ? (
        <StackChooser
          jobs={stackJobs}
          time={stackJobs[0].startTime ?? ''}
          at={stackAt}
          onClose={(back) => { setStackJobs(null); if (back) stackFrom.current?.opener.focus(); }}
          onPick={(j) => { setStackJobs(null); openShown(j); }}
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
  return { extrasApi, extrasUi };
}
