import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { ToReturn } from './to-return.tsx';
import { Card, ONLY_OWNER, Page, Row, STATUS, Tag, day, isOpen, linkClass, orderHref, stillToCome, type Order } from './deliveries-bits.tsx';

/**
 * Stockroom › Deliveries and orders (rs-hub, rs-hub-empty, rs-hub-staff in
 * receiving.mjs; openspec/changes/deliveries-orders). For now: the open
 * orders and + New order, for the Owner (decision 4, until "Can order
 * stock"); "A delivery arrived?" for everyone, with or without an order
 * (openspec/changes/receive-delivery and receive-without-order).
 * To return to [Supplier] second, only when something's on it
 * (openspec/changes/to-return). Products to add and Recent deliveries come
 * later; the restock list waits for answers.
 */
export function DeliveriesPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: () => apiGet<Order[]>('/api/purchase-orders'), enabled: owner });
  if (session.status !== 'signed-in') return null;
  // Receiving comes first (decision 2), for everyone (decision 4).
  const arrived = (
    <Card id="t-a-delivery-arrived" title="A delivery arrived?">
      <p className="m-0 text-sm text-[var(--wh-muted)]">Scan each item as it comes out of the box. Works with or without an order.</p>
      <div><Link to={ROUTES['rs-receive']} className={buttonVariants({ variant: 'accent' })}>Receive a delivery</Link></div>
    </Card>
  );
  if (!owner) return <Page>{arrived}<p className="m-0 text-sm text-[var(--wh-muted)]">{ONLY_OWNER}</p></Page>;
  const open = orders.data?.filter(isOpen);
  return (
    <Page>
      {arrived}
      {/* Second, only when something's on it (decision 10; openspec/changes/to-return). */}
      <ToReturn />
      <Card id="t-orders" title="Orders" action={<Link to={ROUTES['rs-order']} className={buttonVariants({ variant: 'default' })}>+ New order</Link>}>
        {orders.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the orders. Try again in a moment.</p>
          : !open ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : open.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No orders. Shops that order on the supplier’s website can ignore this — deliveries are received the same way.</p>
          : (
            <ul aria-labelledby="t-orders" className="m-0 list-none p-0">
              {open.map((o) => {
                const draft = o.status === 'draft' || !o.orderedAt;
                return (
                  <Row key={o.id} title={`${o.supplierName} · ${o.items.length} ${o.items.length === 1 ? 'line' : 'lines'}`}
                    sub={draft ? 'Draft · not ordered yet' : `Ordered ${day(o.orderedAt!)} · ${stillToCome(o)} still to come`}>
                    <Tag>{STATUS[o.status]}</Tag>
                    <Link to={orderHref(o.id)} className={linkClass}
                      aria-label={draft ? `Open the draft order for ${o.supplierName}` : `Open the order from ${o.supplierName}, ordered ${day(o.orderedAt!)}`}>Open</Link>
                  </Row>
                );
              })}
            </ul>
          )}
      </Card>
    </Page>
  );
}
