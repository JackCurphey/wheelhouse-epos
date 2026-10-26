import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Workshop › Storage slots (Workshop day 27; drawn as
 * set-workshop-diary's storageSlotsContent): the switch, off to start, and
 * the shop's own hooks and spaces as chips, each with Remove, and
 * "+ Add a slot". Everything saves at once.
 */
type Slot = { id: number; name: string };
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

/** The fold's summary: "On · 8 slots" or "Off". */
export function useStorageSlotsSummary(): string {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<{ storageSlotsOn?: boolean }>('/api/workshop-settings') });
  const slots = useQuery({ queryKey: ['storage-slots'], queryFn: () => apiGet<Slot[]>('/api/storage-slots') });
  if (!settings.data) return '';
  if (!settings.data.storageSlotsOn) return 'Off';
  const n = slots.data?.length ?? 0;
  return `On · ${n} slot${n === 1 ? '' : 's'}`;
}

export function StorageSlotsSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<{ storageSlotsOn?: boolean }>('/api/workshop-settings') });
  const slots = useQuery({ queryKey: ['storage-slots'], queryFn: () => apiGet<Slot[]>('/api/storage-slots') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const on = Boolean(settings.data?.storageSlotsOn);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
      // A removed slot leaves the bikes on it, so the job lists are read again too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['storage-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }
  const switchTo = (next: boolean) => void run(async () => {
    const saved = await apiMutate('/api/workshop-settings', { storageSlotsOn: next }, { method: 'PUT' });
    queryClient.setQueryData(['workshop-settings'], saved);
  });

  return (
    <div className="flex flex-col gap-3">
      <RowSwitch label="Storage slots" on={on} disabled={busy || !settings.data} onChange={switchTo} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">
        {on ? 'On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.' : 'Off for this shop. Switch it on to note where each bike is kept.'}
      </p>
      <ul aria-label="Slots" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {(slots.data ?? []).map((s, i, all) => (
          <li key={s.id} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] pl-3.5 text-size-13 font-semibold">
            {s.name}
            <button type="button" aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => void run(() => apiMutate(`/api/storage-slots/${s.id}`, {}, { method: 'DELETE' }), () => {
              // The focus goes to the next chip's Remove (or the one before, or + Add a slot).
              const next = all[i + 1] ?? all[i - 1];
              setTimeout(() => document.querySelector<HTMLButtonElement>(next ? `[aria-label="Remove ${next.name}"]` : '[data-add-slot]')?.focus(), 0);
            })} className="inline-flex size-11 items-center justify-center rounded-full text-[var(--wh-muted)] hover:bg-[var(--wh-hover)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </li>
        ))}
      </ul>
      {adding === null ? (
        <div><Button variant="default" data-add-slot onClick={() => { setAdding(''); setTimeout(() => document.getElementById('new-slot')?.focus(), 0); }}>+ Add a slot</Button></div>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => apiMutate('/api/storage-slots', { name: adding }), () => {
          // The box stays open and empty for the next slot (fewest clicks).
          setAdding('');
          setTimeout(() => document.getElementById('new-slot')?.focus(), 0);
        }); }}>
          <input id="new-slot" aria-label="New slot" value={adding} maxLength={40} placeholder="Hook 7" onChange={(e) => setAdding(e.target.value)} className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm" />
          <Button type="submit" variant="primary" disabled={busy}>Add</Button>
          <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
        </form>
      )}
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}
