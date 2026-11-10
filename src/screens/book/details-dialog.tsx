import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { apiMutate, ApiError } from '@/lib/api/client.ts';

/**
 * Edit your details (openspec/changes/finish-account design 6; Jack, 9 Nov,
 * answer 3; "Edit" on ac-account). Not drawn: a Form box as How we contact
 * you's is, with Name, Mobile and Email, Cancel and Save (decided while
 * building). Name and mobile save at once; the email is shown here and
 * changes by a code sent to the new address.
 */
export type Details = { name: string | null; phone: string | null; email: string };

export function DetailsDialog({ me, shopSlug, onClose }: { me: Details; shopSlug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(me.name ?? '');
  const [phone, setPhone] = React.useState(me.phone ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const field = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-size-15';

  async function save() {
    const change: { name?: string; phone?: string } = {};
    if (name.trim() !== (me.name ?? '').trim()) change.name = name;
    if (phone.trim() !== (me.phone ?? '').trim()) change.phone = phone;
    if (!Object.keys(change).length) { onClose(); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = await apiMutate<Pick<Details, 'name' | 'phone'>>(`/api/portal/${encodeURIComponent(shopSlug)}/me`, change, { method: 'PUT' });
      queryClient.setQueryData<Details>(['account', shopSlug, 'me'], (old) => (old ? { ...old, ...saved } : old));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Please sign in again to change this.'
        : err instanceof ApiError && err.status === 400 && err.hasServerMessage ? err.message : 'That didn’t go through. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ed-title" className="md:max-w-[520px]">
      <DialogHeader><DialogTitle id="ed-title">Edit your details</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ed-name" className="text-sm font-semibold">Name</label>
          <input id="ed-name" autoComplete="name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ed-phone" className="text-sm font-semibold">Mobile</label>
          <input id="ed-phone" type="tel" autoComplete="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ed-email" className="text-sm font-semibold">Email</label>
          <input id="ed-email" type="email" autoComplete="email" readOnly className={`${field} text-[var(--wh-muted)]`} value={me.email} />
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
