import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { RowSwitch } from './row-switch.tsx';
import { useSavedNote } from './saved-note.tsx';

/**
 * Settings › Front desk › End of day (set-eod, set-eod-close, set-save-failed
 * in generator/setup.mjs; cash-up decisions 2, 4 and 5; owner setup decisions
 * 6, 17 and 18): the Float, when Close the day shows, and Count first. Each
 * change is followed by Settings' note (saved-note.tsx): "Saved" with Undo,
 * or a failed save kept here with Try again.
 */
type EndOfDay = { floatPence: number | null; closeEntryMinutes: number; countFirst: boolean };
const KEY = ['end-of-day-settings'];
const useEndOfDay = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<EndOfDay>('/api/end-of-day-settings') });
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
// set-save-failed (owner setup decision 17): a change that can't be saved says so, and keeps it.
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';

/**
 * Saves part of End of day and shows the note: "Saved", with Undo when there
 * is something to go back to; when it fails, what went wrong, with Try again
 * only when a retry could work (no connection, or a fault on the server).
 * `done(ok, kept)` says whether it saved, and whether the change stays on screen.
 */
function useEndOfDaySave(control: (body: Partial<EndOfDay>) => HTMLElement | null) {
  const queryClient = useQueryClient();
  const note = useSavedNote();
  const mine = useRef({});
  const [saving, setSaving] = useState(false);

  async function put(body: Partial<EndOfDay>, undo: Partial<EndOfDay> | null, done: (ok: boolean, kept: boolean) => void) {
    // Focus in the note goes back to the setting being saved.
    const back = () => control(body);
    setSaving(true);
    note.busy(back);
    try {
      queryClient.setQueryData(KEY, await apiMutate<EndOfDay>('/api/end-of-day-settings', body, { method: 'PUT' }));
      // The till's Close the day and float check read the new settings.
      void queryClient.invalidateQueries({ queryKey: ['close-the-day'] });
      void queryClient.invalidateQueries({ queryKey: ['float-check'] });
      done(true, false);
      note.show({ text: 'Saved', owner: mine.current, back, action: undo ? { label: 'Undo', run: () => void put(undo, null, done) } : undefined });
    } catch (err) {
      const retry = !(err instanceof ApiError) || err.status >= 500;
      const text = !(err instanceof ApiError) ? NO_INTERNET : !retry && err.hasServerMessage ? err.message : SAVE_FAILED;
      done(false, retry);
      note.show({ text, failed: true, owner: mine.current, back, action: retry ? { label: 'Try again', run: () => void put(body, undo, done) } : undefined });
    } finally {
      setSaving(false);
    }
  }
  return { put, saving, noteIsMine: note.owner === mine.current };
}

/**
 * One choice saved the moment it's chosen, as Signing in saves. A choice that
 * failed stays picked while its own note shows; once a newer note replaces
 * it, the fold shows what the server holds. Tapping a kept choice saves it again.
 */
function useSaveNow<V extends number | boolean>(key: 'closeEntryMinutes' | 'countFirst', control: (value: V) => HTMLElement | null) {
  const settings = useEndOfDay();
  const stored = settings.data?.[key] as V | undefined;
  const [kept, setKept] = useState<{ value: V } | null>(null);
  const s = useEndOfDaySave((body) => control(body[key] as V));
  const shownKept = kept && (s.saving || s.noteIsMine) ? kept : null;

  function save(next: V, before: V | undefined) {
    setKept({ value: next });
    void s.put({ [key]: next }, before === undefined ? null : { [key]: before }, (ok, stays) => {
      if (ok || !stays) setKept(null);
    });
  }
  return {
    value: shownKept ? shownKept.value : stored,
    failedKept: shownKept !== null && !s.saving,
    ready: !!settings.data,
    saving: s.saving,
    change: (next: V) => save(next, stored),
  };
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
  const group = useRef<HTMLDivElement>(null);
  const s = useSaveNow<number>('closeEntryMinutes', (m) => group.current?.querySelector<HTMLElement>(`[data-minutes="${m}"]`) ?? null);
  return (
    <div className="flex flex-col gap-2.5">
      <div ref={group} className="flex flex-col gap-2">
        <span id="close-entry-label" className="text-size-15 font-semibold">Show “Close the day” in the till bar</span>
        <RadioPillGroup pickOnMove={false} aria-labelledby="close-entry-label" className="flex flex-wrap gap-2">
          {CLOSE_CHOICES.map(([minutes, label]) => {
            const on = s.value === minutes;
            return (
              <button key={minutes} type="button" role="radio" aria-checked={on} data-minutes={minutes} disabled={s.saving || !s.ready}
                onClick={() => { if (!on || s.failedKept) s.change(minutes); }}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}>
                {label}
              </button>
            );
          })}
        </RadioPillGroup>
      </div>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Owners and managers see it on every till from then on. Closing time comes from the opening hours.</p>
      <div><Link to={`${ROUTES.settings}?room=office&fold=opening-hours`} className={buttonVariants({ variant: 'default' })}>Change opening hours</Link></div>
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
  const row = useRef<HTMLDivElement>(null);
  const s = useSaveNow<boolean>('countFirst', () => row.current?.querySelector<HTMLElement>('[role="switch"]') ?? null);
  return (
    <div ref={row} className="flex flex-col gap-2">
      <RowSwitch label="Count first" on={s.value === true} disabled={s.saving || !s.ready} onChange={(next) => s.change(next)} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Count the cash before seeing what the till expects.</p>
    </div>
  );
}

/** The fold's summary: the float, or that it isn't set. */
export function useFloatSummary(): string {
  const settings = useEndOfDay();
  if (!settings.data) return '';
  return settings.data.floatPence === null ? 'Not set yet' : penceText(settings.data.floatPence);
}

/**
 * Settings › End of day › Float (set-eod; cash-up decision 4;
 * openspec/changes/opening-float-check): what's left in the drawer each
 * night, which the morning's float check asks for. Saved in whole pence when
 * the box is left, as the Receipts box saves, with Settings' note after
 * (set-save-failed draws it on this fold). Undo puts back a float that was set.
 */
export function FloatSettings() {
  const settings = useEndOfDay();
  const box = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const stored = settings.data?.floatPence ?? null;
  const s = useEndOfDaySave(() => box.current);

  function save() {
    if (typed === null) return;
    const read = parseTotal(typed);
    // The counter's own words for a total that isn't pounds and pence.
    if (read === null || 'invalid' in read) { setBad(true); return; }
    setBad(false);
    if (read.pence === stored) { setTyped(null); return; }
    const sent = typed;
    void s.put({ floatPence: read.pence }, stored === null ? null : { floatPence: stored }, (ok, stays) => {
      if (ok || !stays) setTyped((t) => (t === sent ? null : t));
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <label htmlFor="eod-float" className="grow text-size-15 font-semibold">Leave this much in the drawer each night</label>
        <input
          ref={box}
          id="eod-float"
          inputMode="decimal"
          value={typed ?? (stored === null ? '' : penceText(stored))}
          disabled={!settings.data}
          aria-invalid={bad ? true : undefined}
          onChange={(e) => { setTyped(e.target.value); setBad(false); }}
          onBlur={save}
          className="min-h-11 w-[140px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-right font-mono text-base"
        />
      </div>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Close the day works out the rest to bank, so every day starts with the same float.</p>
      {bad ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Pounds and pence, like 150.00</p> : null}
    </div>
  );
}
