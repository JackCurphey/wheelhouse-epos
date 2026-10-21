import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { jobRefusalText } from './refusal-words.ts';
import type { MoveApi } from './diary-context.ts';
import type { Col, Preview, Settings, Shown } from './diary-model.ts';
import { SNAP_MIN, dropStart, hhmm, lengthText, shortDay, stretchEnd, toMinutes } from './rules.ts';

/**
 * Moving a job and changing its length (piece 3, and Jack, 18 Oct): by
 * dragging, or from the keyboard. Owns the move preview, the spoken note and
 * the error, and hands the page the MoveApi its blocks share through context.
 */
export function useDiaryMoves({ columns, view, range, settings, slotPx, isPhone, jobsIn, openShown }: {
  columns: Col[];
  view: 'week' | 'day' | 'month';
  range: { start: number; end: number };
  settings: Settings | undefined;
  slotPx: number;
  isPhone: boolean;
  jobsIn: (c: Col) => Shown[];
  openShown: (job: Shown) => void;
}) {
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
    const close = settings?.openingHours?.find((h) => h.weekday === weekday)?.close;
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

  // The click that follows the end of a drag must not open the job.
  const justDragged = useRef(false);
  const openJob = (job: Shown) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (preview) return;
    openShown(job);
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
  return { preview, moveNote, moveError, setMoveError, moveApi, openJob, startStretch, startKeyMove, followPart, justDragged };
}
