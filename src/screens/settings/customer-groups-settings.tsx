import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * Settings › Front desk › Payments › Customer groups (customer service review
 * decision 8; drawn as cs-groups in customer.mjs; openspec/changes/customer-groups-settings):
 * each group's name, how many customers, its discount and Edit; the drawn note;
 * "+ Add a group". The box isn't drawn: it follows Services' (design 3).
 */
type Group = { id: number; name: string; discountPercent: number; customerCount?: number };
type Editing = { id: number | null; name: string; percent: string };
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const mono = 'font-[family-name:var(--wh-font-mono)]';

/** The fold's summary: the groups' names, or that there are none. */
export function useCustomerGroupsSummary(): string {
  const groups = useQuery({ queryKey: ['customer-groups'], queryFn: () => apiGet<Group[]>('/api/customer-groups') });
  if (!groups.data) return '';
  return groups.data.length ? groups.data.map((g) => g.name).join(', ') : 'No groups yet';
}

export function CustomerGroupsSettings() {
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ['customer-groups'], queryFn: () => apiGet<Group[]>('/api/customer-groups') });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      setEditing(null);
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }
  const save = (e: Editing) => run(() => {
    const body = { name: e.name.trim(), discountPercent: Number(e.percent) };
    return e.id ? apiMutate(`/api/customer-groups/${e.id}`, body, { method: 'PUT' }) : apiMutate('/api/customer-groups', body);
  });

  return (
    <div className="flex flex-col gap-2.5">
      {(groups.data ?? []).map((g) => (
        <div key={g.id} className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-0 pr-2 pl-3.5">
          <span className="flex grow flex-col gap-0.5">
            <span className="text-size-15 font-bold">{g.name}</span>
            <span className="text-size-13 text-[var(--wh-muted)]">{`${g.customerCount ?? 0} customer${g.customerCount === 1 ? '' : 's'}`}</span>
          </span>
          <span className={`text-size-15 ${mono}`}>{`${g.discountPercent}% off`}</span>
          <Button variant="ghost" aria-label={`Edit ${g.name}`} onClick={() => setEditing({ id: g.id, name: g.name, percent: String(g.discountPercent) })}>Edit</Button>
        </div>
      ))}
      <div className="flex flex-col items-start gap-2.5">
        <p className="m-0 text-sm text-[var(--wh-muted)]">The till gives the discount by itself when a group member is added to a sale, with the group as the reason.</p>
        <Button onClick={() => setEditing({ id: null, name: '', percent: '' })}>+ Add a group</Button>
      </div>
      {editing ? (
        <GroupBox start={editing} busy={busy} error={error}
          onSave={(e) => void save(e)}
          onRemove={editing.id ? () => void run(() => apiMutate(`/api/customer-groups/${editing.id}`, {}, { method: 'DELETE' })) : undefined}
          onClose={() => { setEditing(null); setError(null); }} />
      ) : null}
    </div>
  );
}

function GroupBox({ start, busy, error, onSave, onRemove, onClose }: {
  start: Editing; busy: boolean; error: string | null; onSave: (e: Editing) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [e, setE] = useState(start);
  const title = start.id ? `Edit ${start.name}` : 'Add a group';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="group-title" className="md:max-w-[480px]">
      <DialogHeader>
        <DialogTitle id="group-title">{title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Name
          <input className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal" value={e.name}
            onChange={(ev) => setE({ ...e, name: ev.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          % off
          <input className="min-h-11 w-32 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal" inputMode="decimal" value={e.percent}
            onChange={(ev) => setE({ ...e, percent: ev.target.value })} />
        </label>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        {onRemove ? <Button variant="danger" disabled={busy} onClick={onRemove}>Remove group</Button> : <span />}
        <Button variant="primary" disabled={busy} onClick={() => onSave(e)}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
