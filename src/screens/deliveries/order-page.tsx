import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Back, Card, Page, Row, STATUS, Tag, day, isOpen, money, mono, stillToCome, type Order } from './deliveries-bits.tsx';

/**
 * An order (rs-order-ordered, rs-order-close in receiving.mjs; audit M2;
 * openspec/changes/deliveries-orders design 4): what was ordered and what
 * has arrived, the server's total, and for the Owner Mark as ordered (a
 * draft) or Close the order, which asks first. "Receive against this
 * order", for anyone, while it's still to come (openspec/changes/receive-delivery).
 * Close the order works on a partly delivered order too: what arrived stays,
 * and once closed a line says "[n] not coming" (Jack's answer 1, 27 Oct;
 * openspec/changes/close-part-delivered).
 */
export function OrderPage() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['purchase-order', id], queryFn: () => apiGet<Order>(`/api/purchase-orders/${id}`), retry: false, enabled: known });
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!known || order.isError) {
    return <Page><Back /><p role="alert" className="m-0 text-sm">{!known || (order.error instanceof ApiError && order.error.status === 404) ? 'Order not found' : 'Wheelhouse couldn’t load this order. Try again in a moment.'}</p></Page>;
  }
  const o = order.data;
  if (!o) return <Page><Back /><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;

  async function act(path: 'mark-ordered' | 'cancel') {
    setBusy(true);
    setProblem(null);
    try {
      const next = await apiMutate<Order>(`/api/purchase-orders/${id}/${path}`, {});
      queryClient.setQueryData(['purchase-order', id], next);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setClosing(false);
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t change the order. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const when = o.orderedAt ? `ordered ${day(o.orderedAt)}` : 'draft';
  return (
    <Page>
      <Back />
      <Card id="t-order" title={`${o.supplierName} · ${when}`}>
        <div><Tag>{STATUS[o.status]}</Tag></div>
        <ul aria-label="Lines" className="m-0 list-none p-0">
          {o.items.map((it) => (
            <Row key={it.id} title={it.name} sub={`${it.sku ? `${it.sku} · ` : ''}ordered ${it.qtyOrdered} · arrived ${it.qtyReceived}`}>
              {it.notComing > 0 ? <Tag>{`${it.notComing} not coming`}</Tag> : it.outstanding <= 0 ? <Tag ok>All arrived</Tag> : <Tag>{`${it.outstanding} to come`}</Tag>}
            </Row>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
          <span className="text-size-15">Total cost <span className={`text-base font-bold ${mono}`}>{money(o.totalCost)}</span></span>
          {isOpen(o) && (owner || o.status !== 'draft') ? (
            <span className="flex flex-wrap gap-2">
              {owner ? <Button variant="default" disabled={busy} onClick={() => setClosing(true)}>Close the order</Button> : null}
              {owner && o.status === 'draft' ? <Button variant="accent" disabled={busy} onClick={() => void act('mark-ordered')}>Mark as ordered</Button> : null}
              {o.status !== 'draft' ? <Link to={`${ROUTES['rs-receive']}?order=${o.id}`} className={buttonVariants({ variant: 'accent' })}>Receive against this order</Link> : null}
            </span>
          ) : null}
        </div>
        {problem && !closing ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
        {owner && isOpen(o) ? <p className="m-0 text-sm text-[var(--wh-muted)]">Closing the order drops anything still to come.</p> : null}
      </Card>
      {closing ? (
        <Dialog open onOpenChange={(v) => { if (!v) setClosing(false); }} aria-labelledby="close-title" dismissOnBackdrop={false}>
          <DialogHeader>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle id="close-title">Close the order?</DialogTitle>
              <span className="text-size-13 text-[var(--wh-muted)]">{`${o.supplierName} · ${when} · ${stillToCome(o)} still to come`}</span>
            </div>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <p className="m-0 text-sm text-[var(--wh-muted)]">Closing drops everything still to come on this order.</p>
            {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="default" onClick={() => setClosing(false)}>Keep it open</Button>
            <Button variant="accent" disabled={busy} onClick={() => void act('cancel')}>Close the order</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </Page>
  );
}
