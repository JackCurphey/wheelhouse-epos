import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet } from '@/lib/api/client.ts';
import { buttonVariants } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Back, Card, Page, Row, Tag, day, linkClass, money, mono, orderHref } from './deliveries-bits.tsx';

/**
 * A delivery once it's booked in (openspec/changes/delivery-booked-in):
 * Delivery booked in, where Book in lands (rs-booked, rs-booked-staff in
 * receiving.mjs; audit M10; walk-through 3 M4), a delivery's page (rs-delivery,
 * rs-delivery-staff; audit H4 and M12) and Recent deliveries on the hub.
 * Costs come from the server only for the Owner, until roles. The invoice
 * check, a job waiting for a part and Cost went up? come later.
 */
type Kind = 'damaged' | 'wrong_item';
type Summary = { id: number; supplierName: string | null; items: number; bookedInAt: string; bookedBy: string | null };
type Delivery = Summary & {
  supplierId: number | null;
  bookedCost?: number;
  lines: { id: number; productId: number; name: string; sku: string | null; qty: number; unitCost?: number; lineCost?: number }[];
  setAside: { id: number; name: string; kind: Kind; qty: number; returned: boolean; cost?: number }[];
  stillToCome: { orderId: number; supplierName: string; orderedAt: string | null; qty: number }[];
};

const KIND: Record<Kind, string> = { damaged: 'Damaged', wrong_item: 'Wrong item' };
const SET_ASIDE_AS: Record<Kind, string> = { damaged: 'damaged', wrong_item: 'a wrong item' };
const count = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const named = (d: Summary) => `${d.supplierName ?? 'Delivery'} · ${count(d.items)}`;
const bookedLine = (d: Summary) => `Booked in ${day(d.bookedInAt)}${d.bookedBy ? ` by ${d.bookedBy}` : ''}`;
const deliveryHref = (id: number) => ROUTES['rs-delivery'].replace(':id', String(id));

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
  const { delivery: d, failed, gone } = useDelivery();
  if (!d) return <Waiting failed={failed} gone={gone} />;
  // Who can order stock: the server sends costs only to them, following who's
  // checked in; the sign-in on a till can be the Owner's with Jo serving.
  const owner = d.bookedCost !== undefined;
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
          <Link to={ROUTES['rs-receive']} className={buttonVariants({ variant: 'default' })}>Receive another delivery</Link>
        </div>
      </Card>
    </Page>
  );
}

/** A booked-in delivery (rs-delivery, rs-delivery-staff): costs only for who can order stock (audit M12). */
export function DeliveryPage() {
  const { delivery: d, failed, gone } = useDelivery();
  if (!d) return <Waiting failed={failed} gone={gone} />;
  const costs = d.bookedCost !== undefined;
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
