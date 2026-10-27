import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';

/**
 * Settings › Front desk › End of day › Float (drawn as set-eod in
 * generator/setup.mjs; cash-up decision 4; openspec/changes/opening-float-check):
 * what's left in the drawer each night, which the morning's float check asks
 * for. Saved in whole pence when the box is left, as the Receipts box saves.
 */
type EndOfDay = { floatPence: number | null };
const KEY = ['end-of-day-settings'];
const useEndOfDay = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<EndOfDay>('/api/end-of-day-settings') });

/** The fold's summary: the float, or that it isn't set. */
export function useFloatSummary(): string {
  const settings = useEndOfDay();
  if (!settings.data) return '';
  return settings.data.floatPence === null ? 'Not set yet' : penceText(settings.data.floatPence);
}

export function FloatSettings() {
  const queryClient = useQueryClient();
  const settings = useEndOfDay();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = settings.data?.floatPence ?? null;

  async function save() {
    if (typed === null) return;
    const read = parseTotal(typed);
    // The counter's own words for a total that isn't pounds and pence.
    if (read === null || 'invalid' in read) { setNote({ ok: false, text: 'Pounds and pence, like 150.00' }); return; }
    if (read.pence === stored) { setTyped(null); setNote(null); return; }
    setNote(null);
    try {
      const saved = await apiMutate<EndOfDay>('/api/end-of-day-settings', { floatPence: read.pence }, { method: 'PUT' });
      queryClient.setQueryData(KEY, saved);
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
      // The till's float check reads the new float.
      void queryClient.invalidateQueries({ queryKey: ['float-check'] });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <label htmlFor="eod-float" className="grow text-size-15 font-semibold">Leave this much in the drawer each night</label>
        <input
          id="eod-float"
          inputMode="decimal"
          value={typed ?? (stored === null ? '' : penceText(stored))}
          disabled={!settings.data}
          aria-invalid={note && !note.ok ? true : undefined}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => void save()}
          className="min-h-11 w-[140px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-right font-mono text-base"
        />
      </div>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Close the day works out the rest to bank, so every day starts with the same float.</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}
