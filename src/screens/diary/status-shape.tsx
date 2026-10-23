import type { ReactElement } from 'react';
import type { DiaryState } from './rules.ts';
import { useYourSettings } from '@/lib/your-settings.ts';

/**
 * Show status symbols (Your settings; workshop day 57; diary.mjs STATUS_SHAPE):
 * a small shape per status, so it doesn't rely on colour alone. Drawn in the
 * status's own ink (the block's text colour). Hidden from screen readers,
 * which hear the status word.
 */
const SHAPES: Partial<Record<DiaryState, ReactElement>> = {
  pending: <circle cx="5" cy="5" r="4" fill="currentColor" />,
  scheduled: <rect x="1.25" y="1.25" width="7.5" height="7.5" rx="1.25" fill="currentColor" />,
  waiting: <path d="M5 0.3L9.7 5L5 9.7L0.3 5Z" fill="currentColor" />,
  hold: <path d="M5 0.6L9.6 9.2H0.4Z" fill="currentColor" />,
  ready: <path d="M1.3 5.1L3.9 7.7L8.7 2.1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  cancelled: <path d="M1.6 1.6L8.4 8.4M8.4 1.6L1.6 8.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  answer: <path d="M1 2.2H9V7H4L1.6 9V7H1Z" fill="currentColor" />,
};

/** Whether the drawing gives this status a shape (an offered time has none). */
export const hasShape = (state: DiaryState) => Boolean(SHAPES[state]);

/** The person's Show status symbols switch, off until they turn it on. */
export function useStatusSymbols(): boolean {
  return Boolean(useYourSettings().data?.accessibility.statusSymbols);
}

/** The status's shape, in the top-right corner of its block or swatch. */
export function StatusShape({ state, size = 13, inset = 4 }: { state: DiaryState; size?: number; inset?: number }) {
  const shape = SHAPES[state];
  if (!shape) return null;
  return (
    <svg data-status-shape={state} aria-hidden="true" width={size} height={size} viewBox="0 0 10 10"
      className="absolute shrink-0 drop-shadow-[0_0_1px_var(--wh-panel)]" style={{ top: inset, right: inset }}>
      {shape}
    </svg>
  );
}
