import { useId, useState } from 'react';

import { DENOMINATIONS, countedPence, parseTotal, penceText } from '@/lib/cash-count';

// Keyboard focus as the shared Input draws it (src/components/ui/input.tsx).
// Its classes are copied, not the component: its merge of class names would
// drop this part's text-size-* classes.
const FOCUS = 'focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--accent)]';

/**
 * The note-and-coin counter (building block 18): a box for every note and
 * coin, adding up to a total that can be typed over (cash-up decision 3).
 * Drawn as denomGrid and totalBox in eod-count
 * (docs/design/user-journeys/generator/cashup.mjs:71-94); the float check's
 * "Count it" opens the same count (op-float-count, consolidate/j10.mjs:11).
 *
 * It never shows what the till expects: blind counting is the page's choice
 * (cash-up decision 2). It tells the page the amount counted in whole pence,
 * or null when nothing is counted, so the page can keep "Done counting" off
 * (opening audit H1). Spec: openspec/changes/note-coin-counter
 */
export function NoteCoinCounter({ onChange }: { onChange: (pence: number | null) => void }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [counts, setCounts] = useState<Record<string, string>>({});
  // A typed total takes over from the boxes until a box changes, or the
  // person leaves the total box empty. '' is a total being retyped.
  const [typed, setTyped] = useState<string | null>(null);

  const fromBoxes = countedPence(counts);
  const parsed = typed === null ? null : parseTotal(typed);
  const wrong = parsed !== null && 'invalid' in parsed;

  const setBox = (label: string, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    // A letter or minus sign changes nothing, so it keeps a typed total.
    if (cleaned === (counts[label] ?? '')) return;
    const next = { ...counts, [label]: cleaned };
    setCounts(next);
    setTyped(null);
    onChange(countedPence(next));
  };

  const setTotal = (raw: string) => {
    setTyped(raw);
    const t = parseTotal(raw);
    onChange(t === null || 'invalid' in t ? null : t.pence);
  };

  // Leaving an empty total box goes back to the boxes' sum; while typing it
  // stays empty, so backspacing doesn't snap the sum back.
  const leaveTotal = () => {
    if (typed === null || parseTotal(typed) !== null) return;
    setTyped(null);
    onChange(countedPence(counts));
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Count each note and coin" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        {DENOMINATIONS.map((d) => {
          const n = counts[d.label] ?? '';
          return (
            <label key={d.label} className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-2.5 py-1.5">
              <span className="min-w-9 text-size-15 font-bold">{d.label}</span>
              <span aria-hidden="true" className="text-size-13 text-[var(--wh-muted)]">×</span>
              <input
                inputMode="numeric"
                maxLength={5}
                aria-label={`Number of ${d.label}`}
                value={n}
                onChange={(e) => setBox(d.label, e.target.value)}
                className={`min-h-11 w-[52px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-center font-mono text-size-15 text-[var(--wh-ink)] ${FOCUS}`}
              />
              {Number(n) > 0 ? <span className="grow text-right font-mono text-size-13 text-[var(--wh-muted)] max-md:hidden">{penceText(Number(n) * d.pence)}</span> : null}
            </label>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-4 py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-bold">Cash counted</span>
            <span id={hintId} className="text-size-13 text-[var(--wh-muted)]">Adds up from the boxes — or type the total</span>
          </span>
          <input
            inputMode="decimal"
            aria-label="Cash counted, total"
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? `${hintId} ${errorId}` : hintId}
            value={typed ?? (fromBoxes === null ? '' : penceText(fromBoxes))}
            onChange={(e) => setTotal(e.target.value)}
            onBlur={leaveTotal}
            className={`min-h-12 w-[140px] rounded-lg border bg-[var(--wh-panel)] px-3 text-right font-mono text-size-22 text-[var(--wh-ink)] ${FOCUS} ${wrong ? 'border-[var(--wh-danger-hover)]' : 'border-[var(--wh-input-border)]'}`}
          />
        </label>
        {/* The app's field-error words (email-receipt.tsx), in a polite live region. */}
        <p id={errorId} aria-live="polite" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{wrong ? 'Pounds and pence, like 208.70' : ''}</p>
      </div>
    </div>
  );
}
