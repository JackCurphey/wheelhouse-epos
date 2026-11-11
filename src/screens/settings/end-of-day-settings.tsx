import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Front desk › End of day › Float (drawn as set-eod in
 * generator/setup.mjs; cash-up decision 4; openspec/changes/opening-float-check):
 * what's left in the drawer each night, which the morning's float check asks
 * for. Saved in whole pence when the box is left, as the Receipts box saves.
 */
type EndOfDay = { floatPence: number | null; closeEntryMinutes: number; countFirst: boolean };
const KEY = ['end-of-day-settings'];
const useEndOfDay = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<EndOfDay>('/api/end-of-day-settings') });
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
// set-save-failed (owner setup decision 17): a change that can't be saved says so, and keeps it.
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';

type Saving = { ok: true; undo: () => void } | { ok: false; text: string; retry: () => void };
/**
 * One End of day setting saved the moment it's chosen, as Signing in saves,
 * with "Saved" and Undo after (set-till-quick-saved), or a failed save kept
 * on screen with Try again (set-save-failed). Undo saves the value before.
 */
function useSaveNow<V extends number | boolean>(key: 'closeEntryMinutes' | 'countFirst') {
  const queryClient = useQueryClient();
  const settings = useEndOfDay();
  const stored = settings.data?.[key] as V | undefined;
  const [kept, setKept] = useState<V | null>(null);
  const [note, setNote] = useState<Saving | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(next: V, before: V | undefined) {
    setSaving(true);
    setKept(next);
    setNote(null);
    try {
      queryClient.setQueryData(KEY, await apiMutate<EndOfDay>('/api/end-of-day-settings', { [key]: next }, { method: 'PUT' }));
      // The till's Close the day reads the new setting.
      void queryClient.invalidateQueries({ queryKey: ['close-the-day'] });
      setKept(null);
      setNote(before === undefined ? null : { ok: true, undo: () => void save(before, undefined) });
    } catch (err) {
      const text = !(err instanceof ApiError) ? NO_INTERNET : err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED;
      setNote({ ok: false, text, retry: () => void save(next, before) });
    } finally {
      setSaving(false);
    }
  }
  return { value: kept ?? stored, ready: !!settings.data, saving, note, change: (next: V) => void save(next, stored) };
}

/** "Saved" with Undo, or what went wrong with Try again (settings-frame.mjs toastHtml). */
function SavedNote({ note, saving }: { note: Saving | null; saving: boolean }) {
  if (!note) return null;
  return (
    <div role={note.ok ? 'status' : 'alert'} className="flex items-center gap-3 self-start rounded-lg bg-[var(--wh-ink)] py-1 pr-1 pl-3.5 text-sm font-semibold text-[var(--wh-panel)]">
      <span>{note.ok ? 'Saved' : note.text}</span>
      <button type="button" disabled={saving} onClick={note.ok ? note.undo : note.retry} className="min-h-11 border-0 bg-transparent px-3 text-sm font-bold whitespace-nowrap text-[var(--wh-panel)] underline">{note.ok ? 'Undo' : 'Try again'}</button>
    </div>
  );
}

// Settings › End of day › Close the day (set-eod-close; cash-up decision 5;
// owner setup decision 18): when the till bar shows "Close the day".
const CLOSE_CHOICES: [number, string, string][] = [[0, 'At closing time', 'At closing time'], [30, '30 minutes before', '30 minutes before closing'], [60, '1 hour before', '1 hour before closing']];

/** The fold's summary: the choice, as drawn ("1 hour before closing"). */
export function useCloseEntrySummary(): string {
  const minutes = useEndOfDay().data?.closeEntryMinutes;
  return CLOSE_CHOICES.find(([m]) => m === minutes)?.[2] ?? '';
}

export function CloseEntrySettings() {
  const s = useSaveNow<number>('closeEntryMinutes');
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2">
        <span id="close-entry-label" className="text-size-15 font-semibold">Show “Close the day” in the till bar</span>
        <RadioPillGroup pickOnMove={false} aria-labelledby="close-entry-label" className="flex flex-wrap gap-2">
          {CLOSE_CHOICES.map(([minutes, label]) => {
            const on = s.value === minutes;
            return (
              <button key={minutes} type="button" role="radio" aria-checked={on} disabled={s.saving || !s.ready}
                onClick={() => { if (!on) s.change(minutes); }}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}>
                {label}
              </button>
            );
          })}
        </RadioPillGroup>
      </div>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Owners and managers see it on every till from then on. Closing time comes from the opening hours.</p>
      <div><Link to={`${ROUTES.settings}?room=office&fold=opening-hours`} className={buttonVariants({ variant: 'default' })}>Change opening hours</Link></div>
      <SavedNote note={s.note} saving={s.saving} />
    </div>
  );
}

// Settings › End of day › Counting the cash (eodFolds; owner setup decision 6;
// cash-up decision 2): one switch for the whole business, on to start. The
// open fold isn't drawn; its line and the off summary are design section 5 point 1.
export function useCountFirstSummary(): string {
  const data = useEndOfDay().data;
  if (!data) return '';
  return data.countFirst ? 'Count first' : 'Show the expected amount';
}

export function CountFirstSettings() {
  const s = useSaveNow<boolean>('countFirst');
  return (
    <div className="flex flex-col gap-2">
      <RowSwitch label="Count first" on={s.value === true} disabled={s.saving || !s.ready} onChange={(next) => s.change(next)} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Count the cash before seeing what the till expects.</p>
      <SavedNote note={s.note} saving={s.saving} />
    </div>
  );
}

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
