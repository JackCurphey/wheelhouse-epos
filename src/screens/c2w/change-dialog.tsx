import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { pounds, quoteHref, type C2wOrder, type Provider } from './c2w-bits.tsx';
import { Field, Picked, Search, type Product } from './new-order.tsx';
import { quoteKey } from './quote-page.tsx';

/**
 * More… › Change the bike or size, Change the accessories, Change the provider
 * (c2w.mjs moreMenu, cw-quote-revised; openspec/changes/cycle-to-work task 4.8).
 * Not drawn (logged): each change is a popup with New order's pickers and
 * "Save the change"; saving makes a revised quote, sends nothing, and opens it.
 */
export type ChangeWhat = 'bike' | 'accessories' | 'provider';
export const CHANGE_TITLE: Record<ChangeWhat, string> = { bike: 'Change the bike or size', accessories: 'Change the accessories', provider: 'Change the provider' };

const SUB = 'text-size-13 text-[var(--wh-muted)]';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm';
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const priced = (p: Product) => <><span className="font-bold">{p.name}</span><span className={SUB}>{pounds(p.pricePence)}</span></>;

export function ChangeDialog({ o, what, onClose }: { o: C2wOrder; what: ChangeWhat; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const providers = useQuery({ queryKey: ['c2w-providers'], queryFn: () => apiGet<{ providers: Provider[] }>('/api/c2w/providers'), enabled: what === 'provider' }).data?.providers ?? [];
  const [bike, setBike] = useState<Product | null>(null);
  const [extras, setExtras] = useState<{ id: number; name: string }[]>(() => o.accessories.map((a) => ({ id: a.productId, name: a.name })));
  const [providerId, setProviderId] = useState(o.providerId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const before = o.accessories.map((a) => a.productId).join(',');
  const changed = what === 'bike' ? bike !== null && bike.id !== o.productId
    : what === 'accessories' ? extras.map((a) => a.id).join(',') !== before
      : providerId !== o.providerId;
  const body = what === 'bike' ? { what, productId: bike?.id } : what === 'accessories' ? { what, accessoryIds: extras.map((a) => a.id) } : { what, providerId };

  async function save() {
    if (!changed) return;
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/orders/${o.id}/change`, body);
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : SAVE_FAILED);
      setBusy(false);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['c2w-order', o.id] }),
      queryClient.invalidateQueries({ queryKey: quoteKey(o.id) }),
      queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
    ]);
    onClose();
    navigate(quoteHref(o.id));
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} aria-labelledby="ch-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="ch-title">{CHANGE_TITLE[what]}</DialogTitle>
          <span className={SUB}>{`Quote ${o.quoteRef} · ${o.customerName}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {what === 'bike' ? (
          <Field id="ch-bike" label="Bike" picked={bike !== null} sub={`Now: ${o.bike}`}>
            {bike
              ? <Picked id="ch-bike-change" labelId="ch-bike-l" what="the bike" onChange={() => setBike(null)}>{bike.name}</Picked>
              : <Search<Product> id="ch-bike" label="Bike" path="/api/products" name={(p) => p.name} onPick={setBike} show={priced} />}
          </Field>
        ) : null}
        {what === 'accessories' ? (
          <Field id="ch-acc" label="Accessories">
            {extras.length ? (
              <ul aria-label="Accessories chosen" className="m-0 flex list-none flex-wrap gap-2 p-0">
                {extras.map((a, i) => (
                  <li key={`${a.id}-${i}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--wh-input-border)] pl-3 text-sm">
                    {a.name}
                    <Button variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${a.name}`} onClick={() => setExtras((x) => x.filter((_, j) => j !== i))}>✕</Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Search<Product> id="ch-acc" label="Accessories" path="/api/products" name={(p) => p.name} onPick={(p) => setExtras((x) => (x.some((a) => a.id === p.id) ? x : [...x, { id: p.id, name: p.name }]))} show={priced} />
          </Field>
        ) : null}
        {what === 'provider' ? (
          <Field id="ch-prov" label="Scheme provider" sub={`Now: ${o.providerName}`}>
            <select id="ch-prov" className={INPUT} value={providerId} onChange={(e) => setProviderId(Number(e.target.value))}>
              {providers.some((p) => p.id === o.providerId) ? null : <option value={o.providerId}>{o.providerName}</option>}
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        ) : null}
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!changed || busy} onClick={() => void save()}>Save the change</Button>
      </DialogFooter>
    </Dialog>
  );
}
