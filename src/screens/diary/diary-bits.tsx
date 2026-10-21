import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { addDays, shortDay } from './rules.ts';

/**
 * Messages that come and go float at the bottom of the screen, over the
 * diary, so nothing on the page moves when they appear (Jack, 16 Oct; the
 * till's drawn "Paid by link" message is the pattern).
 */
export function Floating({ children }: { children: ReactNode }) {
  return createPortal(
    // z-30: under the job menu and chooser (z-40), which open on top of it.
    <div data-floating className="pointer-events-none fixed inset-x-3 bottom-4 z-30 flex flex-col items-stretch gap-2 md:right-auto md:left-1/2 md:w-[min(760px,calc(100vw-2rem))] md:-translate-x-1/2">
      {children}
    </div>,
    document.body,
  );
}

export function Chevron({ dir, small = false }: { dir: 'prev' | 'next'; small?: boolean }) {
  return (
    <svg width={small ? 9 : 18} height={small ? 9 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${dir === 'prev' ? 90 : -90}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** "5–11 Oct", or "28 Sep – 4 Oct" across months: the phone's week label. */
export function shortWeek(monday: string) {
  const [, d1, m1] = shortDay(monday).split(' ');
  const [, d2, m2] = shortDay(addDays(monday, 6)).split(' ');
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`;
}

export function initial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

/** True below the tablet width (768px), where the diary is one day at a time. */
export function useIsPhone(): boolean {
  return useMedia('(max-width: 767px)');
}

/** Narrower than a computer: a phone or an upright tablet (layout review 238, item 7). */
export function useIsNarrow(): boolean {
  return useMedia('(max-width: 1023px)');
}

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
  );
}

