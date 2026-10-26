import { useState } from 'react';

import { DENOMINATIONS, countedPence, parseTotal, penceText } from '@/lib/cash-count';

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
  const [counts, setCounts] = useState<Record<string, string>>({});
  // A typed total takes over from the boxes until a box changes or it's cleared.
  const [typed, setTyped] = useState<string | null>(null);

  const fromBoxes = countedPence(counts);
  const parsed = typed === null ? null : parseTotal(typed);
  const wrong = parsed !== null && 'invalid' in parsed;

  const setBox = (label: string, raw: string) => {
    const next = { ...counts, [label]: raw.replace(/\D/g, '') };
    setCounts(next);
    setTyped(null);
    onChange(countedPence(next));
  };

  const setTotal = (raw: string) => {
    const t = parseTotal(raw);
    if (t === null) {
      setTyped(null);
      onChange(countedPence(counts));
      return;
    }
    setTyped(raw);
    onChange('invalid' in t ? null : t.pence);
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
                aria-label={`Number of ${d.label}`}
                value={n}
                onChange={(e) => setBox(d.label, e.target.value)}
                className="min-h-11 w-[52px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-center font-mono text-size-15 text-[var(--wh-ink)]"
              />
              {n ? <span className="grow text-right font-mono text-size-13 text-[var(--wh-muted)] max-md:hidden">{penceText(Number(n) * d.pence)}</span> : null}
            </label>
          );
        })}
      </div>
      <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-4 py-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-bold">Cash counted</span>
          <span className="text-size-13 text-[var(--wh-muted)]">Adds up from the boxes — or type the total</span>
        </span>
        <input
          inputMode="decimal"
          aria-label="Cash counted, total"
          aria-invalid={wrong || undefined}
          value={typed ?? (fromBoxes === null ? '' : penceText(fromBoxes))}
          onChange={(e) => setTotal(e.target.value)}
          className="min-h-12 w-[140px] rounded-lg border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-right font-mono text-size-22 text-[var(--wh-ink)] aria-invalid:border-2 aria-invalid:border-[var(--wh-danger)]"
        />
      </label>
    </div>
  );
}
