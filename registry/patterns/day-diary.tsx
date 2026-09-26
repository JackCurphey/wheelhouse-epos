import { cn } from '@/lib/utils';

/**
 * One day's diary for picking a start time (Jack, 26 Sep: brought over from
 * the pre-31-Aug booking page's mechanic diary, one day at a time for
 * phones). One column per mechanic, hours down the side. Booked time is a
 * grey "Unavailable" block with no other detail. Open time is made of one
 * button per start time the server allows, so every tap lands on a real
 * time and a keyboard or screen reader can reach each one. The scale is set
 * so every start time's button, however short a following busy block or
 * closing time makes it, is still at least 44px tall.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */

export type DiaryColumn = { id: string; name: string; busy: { start: string; end: string }[]; startTimes: string[] };
export type DiaryValue = { columnId: string; time: string };
export type DayDiaryProps = {
  open: string;
  close: string;
  columns: DiaryColumn[];
  value?: DiaryValue | null;
  onChange: (value: DiaryValue) => void;
  className?: string;
};

const MIN_TARGET_PX = 44;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * How long a button for a start time actually renders: from that time to
 * whichever comes first — the next start time in the same column, the next
 * busy block's start, or closing time. pxPerMinute and the render use this
 * same helper so the scale that promises 44px and the height that is drawn
 * can never disagree.
 */
export function startSpan(time: number, column: DiaryColumn, closeMinutes: number): number {
  const boundaries = [closeMinutes];
  for (const s of column.startTimes) {
    const t = toMinutes(s);
    if (t > time) boundaries.push(t);
  }
  for (const b of column.busy) {
    const t = toMinutes(b.start);
    if (t > time) boundaries.push(t);
  }
  return Math.min(...boundaries) - time;
}

/** Pixels per minute so every start time's actual rendered span is at least 44px (30 minutes if nothing is shorter). */
export function pxPerMinute(columns: DiaryColumn[], close: string): number {
  const closeMinutes = toMinutes(close);
  let minSpan = 30;
  for (const c of columns) {
    for (const s of c.startTimes) {
      const span = startSpan(toMinutes(s), c, closeMinutes);
      if (span > 0 && span < minSpan) minSpan = span;
    }
  }
  return MIN_TARGET_PX / minSpan;
}

export function DayDiary({ open, close, columns, value = null, onChange, className }: DayDiaryProps) {
  const start = toMinutes(open);
  const end = toMinutes(close);
  const ppm = pxPerMinute(columns, close);
  const height = (end - start) * ppm;
  const y = (t: number) => (Math.min(Math.max(t, start), end) - start) * ppm;

  const hours: number[] = [];
  for (let t = Math.ceil(start / 60) * 60; t < end; t += 60) hours.push(t);

  return (
    <div
      className={cn('grid gap-x-1.5 text-[var(--wh-ink)]', className)}
      style={{ gridTemplateColumns: `40px repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      <div />
      {columns.map((c) => (
        <div key={c.id} className="mb-1 text-center text-sm font-semibold">{c.name}</div>
      ))}
      <div className="relative" style={{ height }} aria-hidden="true">
        {hours.map((t) => (
          <span key={t} className="absolute left-0 text-[11px] text-[var(--wh-muted)]" style={{ top: y(t) }}>
            {`${String(t / 60).padStart(2, '0')}:00`}
          </span>
        ))}
      </div>
      {columns.map((c) => {
        const times = c.startTimes
          .map(toMinutes)
          .filter((t) => t >= start && t < end)
          .sort((a, b) => a - b);
        return (
          <div key={c.id} role="group" aria-label={c.name} className="relative rounded-md bg-[var(--wh-hover-subtle)]" style={{ height }}>
            {c.busy.map((b, i) => {
              const top = y(toMinutes(b.start));
              const h = y(toMinutes(b.end)) - top;
              if (h <= 0) return null;
              return (
                <div
                  key={`busy-${i}`}
                  data-busy=""
                  className="absolute inset-x-[3px] flex items-center justify-center overflow-hidden rounded-[5px] bg-[var(--wh-hover)] bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--wh-border)_5px_7px)] text-[11px] text-[var(--wh-muted)]"
                  style={{ top, height: h }}
                >
                  Unavailable
                </div>
              );
            })}
            {times.map((t) => {
              const label = c.startTimes.find((s) => toMinutes(s) === t) as string;
              const span = Math.max(1, startSpan(t, c, end));
              const picked = value?.columnId === c.id && value.time === label;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={`${c.name}, ${label}`}
                  aria-pressed={picked}
                  onClick={() => onChange({ columnId: c.id, time: label })}
                  className={cn(
                    'absolute inset-x-[3px] flex items-start justify-start rounded-[5px] px-1.5 pt-0.5 text-[11px] text-[var(--wh-muted)]',
                    'hover:bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                    picked && 'bg-[var(--accent-dark)] font-semibold text-white hover:bg-[var(--accent-dark)]',
                  )}
                  style={{ top: y(t), height: span * ppm }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
