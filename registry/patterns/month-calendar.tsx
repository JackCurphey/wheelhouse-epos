import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One month for picking a booking day (Jack, 26 Sep: the atlas month grid).
 * Weeks start Monday. A date not in `available` is greyed, struck through,
 * aria-disabled and does nothing - no "Full"/"Closed" label, because the
 * server never says why a day is unavailable. Arrow keys move between days
 * (one focusable day at a time); leaving the month asks for the next or
 * previous one. Dates are YYYY-MM-DD strings worked in UTC, so no time zone
 * can shift a day.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Blank cells before day 1 in a Monday-first week. */
export function leadingBlanks(month: string): number {
  return (utc(`${month}-01`).getUTCDay() + 6) % 7;
}

export function addDays(date: string, n: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const TITLE = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_NAME = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export type MonthCalendarProps = {
  month: string;
  onMonthChange: (month: string) => void;
  available: ReadonlySet<string>;
  value?: string | null;
  onChange: (date: string) => void;
  className?: string;
};

function firstFocus(days: string[], available: ReadonlySet<string>, value: string | null) {
  if (value && days.includes(value)) return value;
  return days.find((d) => available.has(d)) ?? days[0];
}

export function MonthCalendar({ month, onMonthChange, available, value = null, onChange, className }: MonthCalendarProps) {
  const days = monthDays(month);
  const [focusDate, setFocusDate] = React.useState(() => firstFocus(days, available, value));
  const current = days.includes(focusDate) ? focusDate : firstFocus(days, available, value);
  const moved = React.useRef(false);
  const gridRef = React.useRef<HTMLDivElement>(null);
  // A day left this month by arrow key, waiting to find out whether the
  // parent accepts the month change. If it doesn't (refused), `month` never
  // changes and this stays pending harmlessly instead of firing later.
  const pendingCrossMonth = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${current}"]`)?.focus();
  }, [current]);

  // Only reacts to a month the parent actually applied - never to one that
  // was requested and refused, so a stale pending target from a refused
  // ArrowUp/Down/Left/Right can't later steal focus on an unrelated month
  // change (e.g. the Previous/Next-month buttons).
  React.useEffect(() => {
    const target = pendingCrossMonth.current;
    pendingCrossMonth.current = null;
    if (target && target.slice(0, 7) === month) {
      setFocusDate(target);
      moved.current = true;
    }
  }, [month]);

  function onKeyDown(e: React.KeyboardEvent, date: string) {
    const step = STEP[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = addDays(date, step);
    if (next.slice(0, 7) !== month) {
      pendingCrossMonth.current = next;
      onMonthChange(next.slice(0, 7));
      return;
    }
    moved.current = true;
    setFocusDate(next);
  }

  const title = TITLE.format(utc(`${month}-01`));
  const arrow =
    'flex size-11 items-center justify-center rounded-md text-lg text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

  return (
    <div className={cn('flex flex-col gap-2 text-[var(--wh-ink)]', className)}>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" className={arrow} onClick={() => onMonthChange(addMonths(month, -1))}>‹</button>
        <h2 className="m-0 text-base font-semibold" aria-live="polite">{title}</h2>
        <button type="button" aria-label="Next month" className={arrow} onClick={() => onMonthChange(addMonths(month, 1))}>›</button>
      </div>
      <div ref={gridRef} role="group" aria-label={title} className="grid grid-cols-7 gap-[5px] text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} aria-hidden="true" className="text-[11px] text-[var(--wh-muted)]">{w}</span>
        ))}
        {Array.from({ length: leadingBlanks(month) }, (_, i) => (
          <span key={`b${i}`} data-cell="blank" />
        ))}
        {days.map((d) => {
          const open = available.has(d);
          const picked = open && d === value;
          return (
            <button
              key={d}
              type="button"
              data-cell="day"
              data-date={d}
              aria-label={DAY_NAME.format(utc(d))}
              aria-disabled={open ? undefined : true}
              aria-pressed={picked}
              tabIndex={d === current ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, d)}
              onClick={() => { setFocusDate(d); if (open) onChange(d); }}
              className={cn(
                'min-h-11 rounded-md border-0 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]',
                open ? 'bg-[var(--wh-hover)] text-[var(--wh-ink)]' : 'cursor-not-allowed bg-white text-[var(--wh-muted)] line-through',
                picked && 'bg-[var(--accent-dark)] font-semibold text-white',
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
