import { createContext, useContext, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react';
import { SLOT_H, type Preview, type Shown } from './diary-model.ts';

export const SlotContext = createContext(SLOT_H);

/**
 * Moving a job (piece 3): by dragging, or from the keyboard (Enter picks it
 * up, arrows move it, Enter saves, Escape puts it back). Shared through a
 * context so each block can take part without threading props through the
 * grid. A job being moved stays in its own column's markup and is shifted
 * across visually, so it keeps keyboard focus as it moves between days.
 */
export type MoveApi = {
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
export const MoveContext = createContext<MoveApi | null>(null);

/** New job's "choose a time" step (decision 22): a click on a column picks the time there. */
export type PickApi = { onPick: (colIndex: number, y: number) => void } | null;
export const PickContext = createContext<PickApi>(null);

/**
 * Piece 5b: the hover summary, the right-click menu (and holding the right
 * button, or a long press on touch), and a stack's chooser. Shared through a
 * context, like moving.
 */
export type ExtrasApi = {
  enter: (job: Shown, el: HTMLElement) => void;
  leave: () => void;
  menu: (job: Shown, at: { x: number; y: number; touch: boolean }, opener: HTMLElement | null) => void;
  press: (job: Shown, e: PointerEvent<HTMLElement>) => void;
  stack: (jobs: Shown[], colIndex: number, opener: HTMLElement, touch: boolean) => void;
};
export const ExtrasContext = createContext<ExtrasApi | null>(null);

/** Handlers every job block and fanned tile shares: hover, right-click, hold, Menu key. */
export function useExtrasHandlers(job: Shown) {
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
