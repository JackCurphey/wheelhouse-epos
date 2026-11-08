import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Field, pence } from '@/screens/stock/product-box.tsx';
import { Button, buttonVariants } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Back, Card, Page, Row, Tag, day, linkClass, money, mono, orderHref } from './deliveries-bits.tsx';
import { PrintLabels } from './delivery-labels.tsx';

/**
 * A delivery once it's booked in (openspec/changes/delivery-booked-in):
 * Delivery booked in, where Book in lands (rs-booked, rs-booked-staff in
 * receiving.mjs; audit M10; walk-through 3 M4), a delivery's page (rs-delivery,
 * rs-delivery-staff; audit H4 and M12) and Recent deliveries on the hub.
 * Print labels is on the booked-in page (openspec/changes/delivery-labels).
 * Costs come from the server only for the Owner, until roles; the Owner can
 * change a line's cost (Cost went up? Change it; openspec/changes/product-page-sizes,
 * design 5). The invoice check and a job waiting for a part come later.
 */
type Kind = 'damaged' | 'wrong_item';
type Summary = { id: number; supplierName: string | null; items: number; bookedInAt: string; bookedBy: string | null };
type Delivery = Summary & {
  supplierId: number | null;
  bookedCost?: number;
  lines: { id: number; productId: number; name: string; sku: string | null; barcode: string | null; pricePence: number; qty: number; unitCost?: number; lineCost?: number }[];
  setAside: { id: number; name: string; kind: Kind; qty: number; returned: boolean; cost?: number }[];
  stillToCome: { orderId: number; supplierName: string; orderedAt: string | null; qty: number }[];
};

const KIND: Record<Kind, string> = { damaged: 'Damaged', wrong_item: 'Wrong item' };
const SET_ASIDE_AS: Record<Kind, string> = { damaged: 'damaged', wrong_item: 'a wrong item' };
const count = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const named = (d: Summary) => `${d.supplierName ?? 'Delivery'} · ${count(d.items)}`;
const bookedLine = (d: Summary) => `Booked in ${day(d.bookedInAt)}${d.bookedBy ? ` by ${d.bookedBy}` : ''}`;
const deliveryHref = (id: number) => ROUTES['rs-delivery'].replace(':id', String(id));
type Line = Delivery['lines'][number];

/**
 * Cost went up? Change it (receiving's 3 Oct later change, walk-through 3 M3; follows
 * rs-invoice-cost's box): the line's new cost, typed in pounds and sent in whole pence; the
 * product's cost and its history follow on the server.
 */
function ChangeCost({ delivery, line, onClose }: { delivery: Delivery; line: Line; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const costPence = pence(typed);
  const why = costPence === null ? 'Type the new cost in pounds, like 14.00' : null;
  async function save() {
    if (why || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/deliveries/booked-in/${delivery.id}/lines/${line.id}/cost`, { costPence }, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['deliveries', delivery.id] }),
        queryClient.invalidateQueries({ queryKey: ['product', line.productId] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
      onClose();
    } catch (err) {
      setError(serverSaid(err) ? err.message : 'Wheelhouse couldn’t change the cost. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="cost-title" className="md:max-w-[560px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="cost-title">Cost went up? Change it</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{[line.name, line.sku].filter(Boolean).join(' · ')}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Field id="cost-new" name="New cost" value={typed} onChange={setTyped} mono />
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">
          Was <span className={mono}>{money(line.unitCost ?? 0)}</span>. It changes from now on — margins and stock value use it. The product’s history says “Cost changed · delivery from {delivery.supplierName ?? 'a supplier'}”.
        </p>
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="items-start justify-between">
        <Button onClick={onClose}>Cancel</Button>
        <span className="flex flex-col items-end gap-1">
          <Button variant="primary" aria-disabled={why || busy ? true : undefined} aria-describedby={why ? 'cost-why' : undefined}
            className={why ? 'opacity-45' : undefined} onClick={save}>Change cost</Button>
          {why ? <span id="cost-why" className="text-size-13 text-[var(--wh-muted)]">{why}</span> : null}
        </span>
      </DialogFooter>
    </Dialog>
  );
}

function useDelivery() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const delivery = useQuery({ queryKey: ['deliveries', id], queryFn: () => apiGet<Delivery>(`/api/deliveries/booked-in/${id}`), retry: false, enabled: known });
  const failed = !known || delivery.isError;
  const gone = !known || (delivery.error instanceof ApiError && delivery.error.status === 404);
  return { delivery: delivery.data, failed, gone };
}

function Waiting({ failed, gone }: { failed: boolean; gone: boolean }) {
  return (
    <Page>
      <Back />
      {failed ? <p role="alert" className="m-0 text-sm">{gone ? 'Delivery not found' : 'Wheelhouse couldn’t load this delivery. Try again in a moment.'}</p>
        : <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>}
    </Page>
  );
}

/** Delivery booked in: what happened and what's next (rs-booked, rs-booked-staff; audit M10). */
export function DeliveryBookedPage() {
  const [labels, setLabels] = useState(false);
  const { delivery: d, failed, gone } = useDelivery();
  if (!d) return <Waiting failed={failed} gone={gone} />;
  // Who can order stock: the server sends costs only to them, following who's
  // checked in; the sign-in on a till can be the Owner's with Jo serving.
  const owner = d.bookedCost !== undefined;
  // Staff land here to label what they booked in: first for them, and for
  // the Owner beside what's next (walk-through 3 M4).
  const print = d.lines.length > 0 ? <Button variant="accent" onClick={() => setLabels(true)}>Print labels</Button> : null;
  const kinds = (['damaged', 'wrong_item'] as const)
    .map((kind) => ({ kind, qty: d.setAside.filter((p) => p.kind === kind).reduce((n, p) => n + p.qty, 0) }))
    .filter((k) => k.qty > 0);
  const toReturn = d.supplierName ? `To return to ${d.supplierName}` : 'To return';
  return (
    <Page>
      <Back />
      <Card id="t-booked-in" title="Booked in">
        <p role="status" className="m-0 flex items-center gap-2 text-base font-bold text-[var(--wh-status-complete-ink)]">
          {d.items > 0 ? <><NavIcon name="check" size={18} />{`${count(d.items)} booked in · stock updated`}</> : 'Nothing booked in'}
        </p>
        {owner || !print ? null : <div>{print}</div>}
        {kinds.length + d.stillToCome.length > 0 ? (
          <ul aria-labelledby="t-booked-in" className="m-0 list-none p-0">
            {kinds.map(({ kind, qty }) => (owner
              ? (
                <Row key={kind} title={`${qty} set aside as ${SET_ASIDE_AS[kind]}`} sub={`On ${toReturn}`}>
                  <Link to={ROUTES.deliveries} className={linkClass} aria-label={`See what’s to return${d.supplierName ? ` to ${d.supplierName}` : ''}`}>See the list</Link>
                </Row>
              )
              : <Row key={kind} title={`${qty} set aside as ${SET_ASIDE_AS[kind]} — the owner will return it`} sub="It isn’t in stock" />
            ))}
            {d.stillToCome.map((o) => (
              <Row key={o.orderId} title={<><span className={mono}>{o.qty}</span> still to come on the order</>}
                sub={`${o.supplierName}${o.orderedAt ? ` · ordered ${day(o.orderedAt)}` : ''}`}>
                {owner ? <Link to={orderHref(o.orderId)} className={linkClass} aria-label={`Open the order from ${o.supplierName}`}>Open the order</Link> : null}
              </Row>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1.5">
          {owner ? print : null}
          <Link to={ROUTES['rs-receive']} className={buttonVariants({ variant: 'default' })}>Receive another delivery</Link>
        </div>
      </Card>
      {labels ? <PrintLabels supplierName={d.supplierName} bookedInAt={d.bookedInAt} lines={d.lines} onClose={() => setLabels(false)} /> : null}
    </Page>
  );
}

/** A booked-in delivery (rs-delivery, rs-delivery-staff): costs only for who can order stock (audit M12). */
export function DeliveryPage() {
  const { delivery: d, failed, gone } = useDelivery();
  const [changingId, setChangingId] = useState<number | null>(null);
  if (!d) return <Waiting failed={failed} gone={gone} />;
  const costs = d.bookedCost !== undefined;
  const changing = d.lines.find((l) => l.id === changingId);
  return (
    <Page>
      <Back />
      <Card id="t-delivery" title={named(d)}>
        <span className="text-sm text-[var(--wh-muted)]">{bookedLine(d)}</span>
        {d.lines.length > 0 ? (
          <ul aria-label="Items in this delivery" className="m-0 list-none p-0">
            {d.lines.map((l) => (
              <Row key={l.id} title={l.name} sub={`${l.sku ? `${l.sku} · ` : ''}${l.qty}${l.unitCost !== undefined ? ` × ${money(l.unitCost)}` : ''}`}>
                {l.lineCost !== undefined ? <span className={mono}>{money(l.lineCost)}</span> : null}
                {/* A line's cost is sent only to who may change it (canSeeCosts). */}
                {l.unitCost !== undefined ? <Button aria-label={`Change the cost of ${l.name}`} onClick={() => setChangingId(l.id)}>Change cost</Button> : null}
              </Row>
            ))}
          </ul>
        ) : null}
        {costs ? (
          <div className="flex justify-between gap-2.5 pt-1.5 text-size-15">
            <span>Booked-in cost, before VAT</span>
            <span className={`${mono} text-base font-bold`}>{money(d.bookedCost!)}</span>
          </div>
        ) : null}
        {d.setAside.length > 0 ? (
          <>
            <h3 id="t-set-aside" className="m-0 mt-1.5 text-size-15 font-bold">Set aside as problems</h3>
            <ul aria-labelledby="t-set-aside" className="m-0 list-none p-0">
              {d.setAside.map((p) => (
                <Row key={p.id} title={p.name} sub={`${KIND[p.kind]} · ${p.qty}${p.cost !== undefined ? ` · ${money(p.cost)}` : ''}`}>
                  <Tag>{p.returned ? 'Returned' : 'On To return'}</Tag>
                </Row>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
      {costs ? null : <p className="m-0 text-sm text-[var(--wh-muted)]">Costs are for people who can order stock.</p>}
      {changing ? <ChangeCost delivery={d} line={changing} onClose={() => setChangingId(null)} /> : null}
    </Page>
  );
}

/** Recent deliveries on the hub (rs-hub, rs-hub-staff), for everyone; no section when there are none. */
export function RecentDeliveries() {
  const list = useQuery({ queryKey: ['deliveries', 'recent'], queryFn: () => apiGet<{ deliveries: Summary[] }>('/api/deliveries') });
  const recent = Array.isArray(list.data?.deliveries) ? list.data.deliveries : [];
  if (!list.isError && recent.length === 0) return null;
  return (
    <Card id="t-recent-deliveries" title="Recent deliveries">
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the recent deliveries. Try again in a moment.</p> : (
        <ul aria-labelledby="t-recent-deliveries" className="m-0 list-none p-0">
          {recent.map((d) => (
            <Row key={d.id} title={named(d)} sub={bookedLine(d)}>
              <Link to={deliveryHref(d.id)} className={linkClass}
                aria-label={`Open the delivery${d.supplierName ? ` from ${d.supplierName}` : ''}, ${day(d.bookedInAt)}`}>Open</Link>
            </Row>
          ))}
        </ul>
      )}
    </Card>
  );
}
