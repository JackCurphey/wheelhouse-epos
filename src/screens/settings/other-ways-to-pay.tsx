import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { useSavedNote } from './saved-note.tsx';

/**
 * Settings › Front desk › Payments › Other ways to pay (drawn as set-pay-other in setup.mjs;
 * openspec/changes/owner-setup-till-payments-eod, design 4; Jack's answer 3): each way with its
 * line and Remove, "Add another way to pay" with Add, and the drawn note. Add and Remove save at
 * once, followed by Settings' note (saved-note.tsx), used as End of day uses it: "Saved · Bank
 * transfer added" with Undo (worded as set-till-quick-saved), or what went wrong, with Try again
 * only when a retry could work. Take payment doesn't read the list yet.
 */
type OtherWay = { id: number; name: string; note: string | null; position: number };
type Ways = { ways: OtherWay[]; id?: number };
// One save: what it sends, the note's words, where focus in the note goes back to (`back`, and
// `failBack` when it fails), where the focus moves once saved, and what Undo sends.
type Change = { send: () => Promise<Ways>; text: string; back: string; failBack: string; moveTo?: string; undo?: (saved: Ways) => Change; after?: () => void };
const KEY = ['payment-ways-other'];
const ADD_BOX = 'New way to pay';
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
// set-save-failed (owner setup decision 17): a change that can't be saved says so, and keeps it.
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';
// The list itself is kept, as each change answers with the whole of it.
const useOtherWays = () => useQuery({ queryKey: KEY, queryFn: async () => (await apiGet<Ways>('/api/payment-ways-other')).ways ?? [] });
const addWay = (body: { name: string; note?: string | null; position?: number }) => apiMutate<Ways>('/api/payment-ways-other', body);
const removeWay = (id: number) => apiMutate<Ways>(`/api/payment-ways-other/${id}`, {}, { method: 'DELETE' });

/** The fold's summary: the ways' names, or None. */
export function useOtherWaysSummary(): string {
  const list = useOtherWays();
  if (!list.data) return '';
  return list.data.length ? list.data.map((w) => w.name).join(', ') : 'None';
}

export function OtherWaysToPay() {
  const queryClient = useQueryClient();
  const note = useSavedNote();
  const mine = useRef({});
  const list = useOtherWays();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  // The control to focus once the list has redrawn and its buttons are enabled again (as Storage
  // slots moves the focus after a Remove): a Remove by its name, or the Add box.
  const focusTo = useRef<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const control = (label: string) => Array.from(body.current?.querySelectorAll<HTMLElement>('[aria-label]') ?? []).find((el) => el.getAttribute('aria-label') === label) ?? null;
  useEffect(() => {
    if (focusTo.current === null || busy) return;
    const label = focusTo.current;
    focusTo.current = null;
    Array.from(body.current?.querySelectorAll<HTMLElement>('[aria-label]') ?? []).find((el) => el.getAttribute('aria-label') === label)?.focus();
  }, [busy, list.data]);

  async function save(change: Change) {
    setBusy(true);
    note.busy(() => control(change.failBack));
    try {
      const saved = await change.send();
      queryClient.setQueryData(KEY, saved.ways);
      change.after?.();
      if (change.moveTo) focusTo.current = change.moveTo;
      const undo = change.undo?.(saved);
      note.show({ text: change.text, owner: mine.current, back: () => control(change.back), action: undo ? { label: 'Undo', run: () => void save(undo) } : undefined });
    } catch (err) {
      const retry = !(err instanceof ApiError) || err.status >= 500;
      const text = !(err instanceof ApiError) ? NO_INTERNET : !retry && err.hasServerMessage ? err.message : SAVE_FAILED;
      note.show({ text, failed: true, owner: mine.current, back: () => control(change.failBack), action: retry ? { label: 'Try again', run: () => void save(change) } : undefined });
    } finally {
      setBusy(false);
    }
  }
  function add() {
    const name = typed.trim();
    if (!name) return;
    void save({
      send: () => addWay({ name }), text: `Saved · ${name} added`, back: ADD_BOX, failBack: ADD_BOX, after: () => setTyped(''),
      // The Undo, once saved, is confirmed: "Saved", with nothing more to undo (as End of day).
      undo: (saved) => ({ send: () => removeWay(saved.id ?? 0), text: 'Saved', back: ADD_BOX, failBack: `Remove ${name}`, moveTo: ADD_BOX }),
    });
  }
  // The focus goes to the next row's Remove, or the Add box when it was the last; Undo puts the
  // way back where it was, with its line, and the focus on its Remove.
  function remove(w: OtherWay, next: OtherWay | undefined) {
    const after = next ? `Remove ${next.name}` : ADD_BOX;
    void save({
      send: () => removeWay(w.id), text: `Saved · ${w.name} removed`, back: after, failBack: `Remove ${w.name}`, moveTo: after,
      undo: () => ({ send: () => addWay({ name: w.name, note: w.note, position: w.position }), text: 'Saved', back: `Remove ${w.name}`, failBack: after, moveTo: `Remove ${w.name}` }),
    });
  }

  if (list.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the other ways to pay. Try again in a moment.</p>;
  return (
    // 12px between the list, the Add box and the note, as the fold body (settings-frame.tsx); 8px between rows (payOther).
    <div ref={body} className="flex flex-col gap-3">
      {list.data?.length ? (<div className="flex flex-col gap-2">
        {list.data.map((w, i, all) => (
          <div key={w.id} className="flex min-h-[52px] items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-0 pr-1.5 pl-3">
            <span className="flex grow flex-col gap-px">
              <span className="text-size-15 font-semibold">{w.name}</span>
              {w.note ? <span className="text-xs text-[var(--wh-muted)]">{w.note}</span> : null}
            </span>
            <button type="button" aria-label={`Remove ${w.name}`} disabled={busy} onClick={() => remove(w, all[i + 1])}
              className="inline-flex size-11 shrink-0 items-center justify-center text-[var(--wh-muted)] hover:bg-[var(--wh-hover)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
      </div>) : null}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input aria-label={ADD_BOX} placeholder="Add another way to pay" value={typed} maxLength={30}
          onChange={(e) => setTyped(e.target.value)}
          className="min-h-11 min-w-0 grow rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm" />
        <Button type="submit" variant="default" disabled={busy}>Add</Button>
      </form>
      <p className="m-0 text-sm text-[var(--wh-muted)]">These sit under “Other” at the bottom of Take payment, one tap away.</p>
    </div>
  );
}
