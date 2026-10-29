import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';

/**
 * Settings › Stockroom › Stock adjustments (drawn as st-setting-adjust in
 * generator/stock.mjs; stock control decision 6; openspec/changes/stock-warnings-on-today):
 * an adjustment worth more than this, at cost, shows on Today. Saved in whole
 * pence when the box is left, as the Float box saves.
 */
type Stockroom = { adjustTodayOverPence: number | null };
const KEY = ['stockroom-settings'];
const useStockroom = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<Stockroom>('/api/stockroom-settings') });

/** The fold's summary, as drawn ("Show on Today over £[amount]"), or that it isn't set. */
export function useStockAdjustmentsSummary(): string {
  const settings = useStockroom();
  if (!settings.data) return '';
  return settings.data.adjustTodayOverPence === null ? 'Not set yet' : `Show on Today over ${penceText(settings.data.adjustTodayOverPence)}`;
}

export function StockAdjustmentsSettings() {
  const queryClient = useQueryClient();
  const settings = useStockroom();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = settings.data?.adjustTodayOverPence ?? null;

  async function save() {
    if (typed === null) return;
    const read = parseTotal(typed);
    if (read === null || 'invalid' in read) { setNote({ ok: false, text: 'Pounds and pence, like 50.00' }); return; }
    if (read.pence === stored) { setTyped(null); setNote(null); return; }
    setNote(null);
    try {
      const saved = await apiMutate<Stockroom>('/api/stockroom-settings', { adjustTodayOverPence: read.pence }, { method: 'PUT' });
      queryClient.setQueryData(KEY, saved);
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="adj-over" className="flex flex-col gap-0.5">
          <span className="text-size-15 font-bold">Show on Today when an adjustment is worth more than</span>
          <span className="text-size-13 text-[var(--wh-muted)]">At cost · for owners and managers</span>
        </label>
        <input
          id="adj-over"
          inputMode="decimal"
          value={typed ?? (stored === null ? '' : penceText(stored))}
          disabled={!settings.data}
          aria-invalid={note && !note.ok ? true : undefined}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => void save()}
          className="min-h-11 w-[120px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-right font-mono text-base"
        />
      </div>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Every adjustment is in its product’s stock history, whatever its value.</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}
