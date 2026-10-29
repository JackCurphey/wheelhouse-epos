import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button, buttonVariants } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useTillSetup } from '@/lib/till-setup.ts';
import { ROUTES } from '@/staff/routes.ts';
import { shortDate } from '@/screens/diary/when.ts';

/**
 * Settings › Front desk › Till › Tills, as the Owner sees it (drawn as
 * set-till-tills-owner in generator/setup.mjs, tillsOpen; openspec/changes/tills-list):
 * every till that's on, then every workshop computer (workshop computer task
 * 2.7), each with where, when and by whom it was registered, Rename, and
 * Remove, which asks first (set-till-remove; owner setup 17). Then the drawn
 * note and "Make this computer a till", which doesn't show on a computer
 * that's already a till or a workshop computer, nor for a business with no
 * shop set up yet (till-setup design 6).
 */
type Registered = { id: number; name: string | null; siteName: string; registeredAt: string; registeredBy: string | null };
type TillsList = { tills: (Registered & { code: string })[]; workshopComputers: Registered[] };
type Device = Registered & { kind: 'tills' | 'workshop'; label: string };
const LIST_QUERY = ['till-setup', 'list'];
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

export function useTillsSummary(): string {
  const setup = useTillSetup();
  // Read as loading until the reply has its tills (a reply of another shape breaks nothing).
  const tills = setup.data?.tills;
  if (!Array.isArray(tills)) return '';
  return tills.length ? tills.map((code) => `Till ${code}`).join(', ') : 'None yet';
}

export function TillsSettings() {
  const setup = useTillSetup();
  const list = useQuery({ queryKey: LIST_QUERY, queryFn: () => apiGet<TillsList>('/api/till-setup/list'), retry: false });
  const [renaming, setRenaming] = useState<Device | null>(null);
  const [removing, setRemoving] = useState<Device | null>(null);
  const data = setup.data;
  const devices: Device[] = [
    ...(list.data?.tills ?? []).map((t) => ({ ...t, kind: 'tills' as const, label: `Till ${t.code}` })),
    ...(list.data?.workshopComputers ?? []).map((w) => ({ ...w, kind: 'workshop' as const, label: 'Workshop computer' })),
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {devices.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {devices.map((d) => (
            <li key={`${d.kind}-${d.id}`} className="flex min-h-[60px] items-center gap-3 border-t border-[var(--wh-border)]">
              <span className="flex grow flex-col gap-0.5">
                <span className="text-size-15 font-bold">{d.name ? `${d.label} · ${d.name}` : d.label}</span>
                <span className="text-size-13 text-[var(--wh-muted)]">{`${d.siteName} · registered ${shortDate(d.registeredAt)}${d.registeredBy ? ` by ${d.registeredBy}` : ''}`}</span>
              </span>
              <button type="button" aria-label={`Rename ${d.label}`} onClick={() => setRenaming(d)}
                className="min-h-11 rounded-md border-0 bg-transparent px-3 text-sm font-semibold text-[var(--wh-ink)] hover:bg-[var(--wh-hover)]">Rename</button>
              <Button variant="danger" aria-label={`Remove ${d.label}`} onClick={() => setRemoving(d)}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col items-start gap-2.5 pt-1">
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.</p>
        {/* A load that fails says so (review, 28 Oct), in the settings boxes' words. */}
        {setup.isError || list.isError ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the tills. Try again in a moment.</p> : null}
        {data && !data.thisTill && !data.thisWorkshop && data.sites?.length ? (
          <Link to={ROUTES['till-setup']} className={buttonVariants({ variant: 'default' })}>Make this computer a till</Link>
        ) : null}
      </div>
      {renaming ? <RenameBox device={renaming} onClose={() => setRenaming(null)} /> : null}
      {removing ? <RemoveBox device={removing} onClose={() => setRemoving(null)} /> : null}
    </div>
  );
}

// Saves, then reads everything again: a computer that has just stopped being
// a till or workshop computer finds out at once (design 3).
function useChange(onDone: () => void) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries();
      onDone();
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

// The box's header as drawn (settings-frame.mjs popup): the title over the shop, and a close.
function BoxHeader({ id, title, sub, onClose }: { id: string; title: string; sub: string; onClose: () => void }) {
  return (
    <DialogHeader className="bg-[var(--wh-panel)]">
      <span className="flex grow flex-col gap-0.5">
        <DialogTitle id={id} className="text-xl">{title}</DialogTitle>
        <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span>
      </span>
      <DialogClose onClick={onClose} />
    </DialogHeader>
  );
}

// Rename: not drawn; Customer groups' Edit box, with Set up this till's
// "Name (optional)" (tills-list design 3).
function RenameBox({ device, onClose }: { device: Device; onClose: () => void }) {
  const [name, setName] = useState(device.name ?? '');
  const { busy, error, run } = useChange(onClose);
  const save = () => void run(() => apiMutate(`/api/till-setup/${device.kind}/${device.id}`, { name }, { method: 'PUT' }));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="rename-title" className="md:max-w-[480px]">
      <BoxHeader id="rename-title" title={`Rename ${device.label}`} sub={device.siteName} onClose={onClose} />
      <DialogBody className="flex flex-col gap-1.5">
        <label htmlFor="rename-name" className="text-sm font-semibold">Name (optional)</label>
        <Input id="rename-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={save}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

// Removing asks first (set-till-remove; owner setup 17); a workshop computer
// in its own words. Not closed by a click outside it.
function RemoveBox({ device, onClose }: { device: Device; onClose: () => void }) {
  const { busy, error, run } = useChange(onClose);
  const till = device.kind === 'tills';
  const thing = till ? 'the till' : 'the workshop computer';
  const remove = () => void run(() => apiMutate(`/api/till-setup/${device.kind}/${device.id}/remove`, {}));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} dismissOnBackdrop={false} aria-labelledby="remove-title" className="md:max-w-[520px]">
      <BoxHeader id="remove-title" title={till ? `Remove ${device.label}?` : 'Remove the workshop computer?'} sub={device.siteName} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{till ? 'This computer stops working as a till. Sales already taken stay in the reports.' : 'This computer stops working as a workshop computer.'}</p>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>{`Keep ${thing}`}</Button>
        <Button variant="danger" disabled={busy} onClick={remove}>{`Remove ${thing}`}</Button>
      </DialogFooter>
    </Dialog>
  );
}
