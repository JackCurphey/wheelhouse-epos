import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';

/**
 * Settings › Front desk › Payments › Other ways to pay (drawn as set-pay-other in setup.mjs;
 * openspec/changes/owner-setup-till-payments-eod, design 4; Jack's answer 3): each way with its
 * line and Remove, "Add another way to pay" with Add, and the drawn note. Add and Remove save at
 * once and say "Saved." with Undo in the fold's own status line, as the other Settings folds say
 * Saved (ways-to-pay-settings.tsx), until the shared Saved · Undo note lands. Take payment
 * doesn't read the list yet.
 */
type OtherWay = { id: number; name: string; note: string | null; position: number };
type Ways = { ways: OtherWay[]; id?: number };
const KEY = ['payment-ways-other'];
// The list itself is kept, as each change answers with the whole of it.
const useOtherWays = () => useQuery({ queryKey: KEY, queryFn: async () => (await apiGet<Ways>('/api/payment-ways-other')).ways ?? [] });
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

/** The fold's summary: the ways' names, or None. */
export function useOtherWaysSummary(): string {
  const list = useOtherWays();
  if (!list.data) return '';
  return list.data.length ? list.data.map((w) => w.name).join(', ') : 'None';
}

export function OtherWaysToPay() {
  const queryClient = useQueryClient();
  const list = useOtherWays();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What Undo sends, while "Saved." shows.
  const [undo, setUndo] = useState<{ send: () => Promise<Ways> } | null>(null);

  async function save(send: () => Promise<Ways>, undoWith: ((saved: Ways) => () => Promise<Ways>) | null) {
    setBusy(true);
    setError(null);
    try {
      const saved = await send();
      queryClient.setQueryData(KEY, saved.ways);
      setUndo(undoWith ? { send: undoWith(saved) } : null);
      return true;
    } catch (err) {
      setUndo(null);
      setError(words(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    const name = typed.trim();
    if (!name) return;
    const done = await save(() => apiMutate<Ways>('/api/payment-ways-other', { name }),
      (saved) => () => apiMutate<Ways>(`/api/payment-ways-other/${saved.id}`, {}, { method: 'DELETE' }));
    if (done) setTyped('');
  }
  const remove = (w: OtherWay) => void save(() => apiMutate<Ways>(`/api/payment-ways-other/${w.id}`, {}, { method: 'DELETE' }),
    // Undo puts it back where it was, with its line.
    () => () => apiMutate<Ways>('/api/payment-ways-other', { name: w.name, note: w.note, position: w.position }));

  if (list.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the other ways to pay. Try again in a moment.</p>;
  return (
    <div className="flex flex-col gap-2">
      {(list.data ?? []).map((w) => (
        <div key={w.id} className="flex min-h-[52px] items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-0 pr-1.5 pl-3">
          <span className="flex grow flex-col gap-px">
            <span className="text-size-15 font-semibold">{w.name}</span>
            {w.note ? <span className="text-size-12 text-[var(--wh-muted)]">{w.note}</span> : null}
          </span>
          <button type="button" aria-label={`Remove ${w.name}`} disabled={busy} onClick={() => remove(w)}
            className="inline-flex size-11 shrink-0 items-center justify-center text-[var(--wh-muted)] hover:bg-[var(--wh-hover)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input aria-label="New way to pay" placeholder="Add another way to pay" value={typed} maxLength={30}
          aria-invalid={error ? true : undefined} onChange={(e) => setTyped(e.target.value)}
          className="min-h-11 min-w-0 grow rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm" />
        <Button type="submit" variant="default" disabled={busy}>Add</Button>
      </form>
      <p className="m-0 text-sm text-[var(--wh-muted)]">These sit under “Other” at the bottom of Take payment, one tap away.</p>
      {undo ? (
        <p role="status" className="m-0 flex items-center gap-2.5 text-sm font-semibold">
          Saved.
          <Button variant="ghost" disabled={busy} onClick={() => void save(undo.send, null)}>Undo</Button>
        </p>
      ) : null}
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}
