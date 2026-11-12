import { poundsText } from '@/lib/money.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { money, type SalesRow } from './reports-format.ts';

/** A bar or point: pence, or a count where the graph's scale is 'count' (Workshop's jobs finished). */
export type GraphRow = Pick<SalesRow, 'key' | 'label' | 'notReached' | 'takingsPence' | 'beforeTakingsPence'>;

/**
 * The graph above a report's table (reports.mjs `graph` and `lineGraph`;
 * decision 7; audit M1, M16, L7), in plain SVG: bars by day or hour with the
 * period before as a dashed outline behind each bar, or a line by month with
 * the period before dashed; a scale of zero and two gridlines; a key; "Not yet"
 * for days to come; and a spoken description naming the busiest bar and the
 * change, ending "The figures are in the table below."
 */
// The drawing's width on a computer; on a phone a narrower one, so the text isn't shrunk to nothing.
const WIDE = 700;
const NARROW = 340;
const H = 120;
const TOP = 10;

// The top of the scale: the biggest figure rounded up to a tidy number of pounds.
function niceMax(pence: number): number {
  if (pence <= 0) return 100;
  const pounds = pence / 100;
  const step = 10 ** Math.floor(Math.log10(pounds));
  return Math.ceil(pounds / step) * step * 100;
}
const scaleLabel = (pence: number) => poundsText(Math.round(pence / 100)).replace(/\.00$/, '');
// A count's scale: an even number, so the middle gridline is a whole one.
const niceCount = (n: number): number => (n <= 0 ? 2 : n <= 10 ? n + (n % 2) : niceMax(n * 100) / 100);

export function graphWords({ title, rows, unitWord, diffPence, against }: { title: string; rows: SalesRow[]; unitWord: string; diffPence: number | null; against: string }): string {
  const reached = rows.filter((r) => !r.notReached && r.takingsPence !== null);
  const busiest = reached.reduce<SalesRow | null>((best, r) => (best === null || (r.takingsPence ?? 0) > (best.takingsPence ?? 0) ? r : best), null);
  const parts: string[] = [];
  if (busiest && (busiest.takingsPence ?? 0) > 0) parts.push(`busiest ${unitWord} ${busiest.label}`);
  if (diffPence !== null) parts.push(diffPence === 0 ? `no change on ${against}` : `${diffPence > 0 ? 'up' : 'down'} ${money(Math.abs(diffPence))} on ${against}`);
  return `${title}: ${parts.join('; ') || 'nothing sold'}. The figures are in the table below.`;
}

function Axis({ max, left, width, label }: { max: number; left: number; width: number; label: (n: number) => string }) {
  return (
    <>
      {[1, 0.5, 0].map((f) => {
        const y = TOP + H - H * f;
        return (
          <g key={f}>
            <line x1={left} x2={width} y1={y} y2={y} stroke="var(--wh-border)" strokeDasharray={f ? '3 3' : undefined} />
            <text x={left - 6} y={y + 4} textAnchor="end" fontSize="12" fill="var(--wh-muted)">{label(max * f)}</text>
          </g>
        );
      })}
    </>
  );
}

function Key({ now, before, dashed }: { now: string; before: string; dashed: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-3.5 text-xs text-[var(--wh-muted)]">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-[var(--wh-ink)]" />{now}</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`inline-block h-2.5 w-4 rounded-sm border border-dashed border-[var(--wh-muted)] ${dashed ? '' : ''}`} />{before}</span>
    </span>
  );
}

const twoLines = (label: string): [string, string] => {
  const i = label.indexOf(' ');
  return i < 0 ? [label, ''] : [label.slice(0, i), label.slice(i + 1)];
};

export function ReportGraph({ title, rows, kind, keyNow, keyBefore, spoken, showBefore, scale = 'money' }: {
  title: string; rows: GraphRow[]; kind: 'bars' | 'line'; keyNow: string; keyBefore: string; spoken: string; showBefore: boolean; scale?: 'money' | 'count';
}) {
  const phone = useMedia('(max-width: 767px)');
  const W = phone ? NARROW : WIDE;
  const LEFT = phone ? 36 : 44;
  const biggest = Math.max(0, ...rows.flatMap((r) => [r.takingsPence ?? 0, showBefore ? r.beforeTakingsPence : 0]));
  const max = scale === 'count' ? niceCount(biggest) : niceMax(biggest);
  const slot = (W - LEFT) / rows.length;
  const x = (i: number) => LEFT + slot * i + slot / 2;
  const y = (pence: number) => TOP + H - (pence / max) * H;
  const barW = Math.min(56, slot * 0.6);
  // A month or a long picked range has too many bars to name each: name every few, so the labels never run together.
  const step = Math.max(1, Math.ceil(30 / slot));
  return (
    <figure className="m-0 flex flex-col gap-3" role="img" aria-label={spoken}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-size-15 font-bold">{title}</figcaption>
        <Key now={keyNow} before={keyBefore} dashed />
      </div>
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${TOP + H + 40}`} className="h-auto w-full overflow-visible">
        <Axis max={max} left={LEFT} width={W} label={scale === 'count' ? (n) => String(Math.round(n)) : scaleLabel} />
        {kind === 'bars' ? rows.map((r, i) => (
          <g key={String(r.key)}>
            {showBefore ? <rect x={x(i) - barW / 2 - 3} y={y(r.beforeTakingsPence)} width={barW + 6} height={Math.max(0, TOP + H - y(r.beforeTakingsPence))} fill="none" stroke="var(--wh-muted)" strokeDasharray="3 3" /> : null}
            {r.notReached ? null : <rect x={x(i) - barW / 2} y={y(r.takingsPence ?? 0)} width={barW} height={Math.max(1, TOP + H - y(r.takingsPence ?? 0))} fill="var(--wh-ink)" />}
            {i % step === 0 ? (
              <>
                <text x={x(i)} y={TOP + H + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--wh-ink)">{twoLines(r.label)[0]}</text>
                <text x={x(i)} y={TOP + H + 30} textAnchor="middle" fontSize="12" fill="var(--wh-muted)">{r.notReached ? 'Not yet' : twoLines(r.label)[1]}</text>
              </>
            ) : null}
          </g>
        )) : (
          <>
            {showBefore ? <polyline fill="none" stroke="var(--wh-muted)" strokeWidth="2" strokeDasharray="5 4" points={rows.map((r, i) => `${x(i)},${y(r.beforeTakingsPence)}`).join(' ')} /> : null}
            <polyline fill="none" stroke="var(--wh-ink)" strokeWidth="2.5" points={rows.filter((r) => !r.notReached).map((r) => `${x(rows.indexOf(r))},${y(r.takingsPence ?? 0)}`).join(' ')} />
            {rows.map((r, i) => (phone && i % 2 ? null : <text key={String(r.key)} x={x(i)} y={TOP + H + 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--wh-ink)">{r.label}</text>))}
          </>
        )}
      </svg>
    </figure>
  );
}
