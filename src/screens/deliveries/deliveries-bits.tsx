import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Pieces shared by Deliveries and orders, New order and an order
 * (openspec/changes/deliveries-orders; receiving.mjs's shared pieces).
 * Costs are pounds, as the server stores and sends them. A closed order
 * (partly delivered, the rest not coming) or a cancelled one (nothing in)
 * has nothing still to come; `notComing` is what had been to come
 * (openspec/changes/close-part-delivered).
 */
export type OrderItem = { id: number; productId: number; name: string; sku: string | null; qtyOrdered: number; qtyReceived: number; outstanding: number; notComing: number; unitCost: number };
export type Order = {
  id: number; supplierId: number; supplierName: string; status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'closed' | 'cancelled';
  orderedAt: string | null; items: OrderItem[]; totalCost: number;
};

export const mono = 'font-[family-name:var(--wh-font-mono)]';
export const money = (pounds: number) => `£${pounds.toFixed(2)}`;
export const orderHref = (id: number) => ROUTES['rs-order-ordered'].replace(':id', String(id));
export const ONLY_OWNER = 'Orders are for the shop’s owner for now.';

// "Tue 1 Sep", the shop's day (as the messages page says a day; three
// letters for the month, as the drawings write it, where en-GB says "Sept").
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', ...o });
export const day = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' }).slice(0, 3)}`;

export const STATUS: Record<Order['status'], string> = {
  draft: 'Draft', ordered: 'Ordered', partially_received: 'Partly delivered', received: 'Delivered', closed: 'Closed', cancelled: 'Closed',
};
export const stillToCome = (o: Order) => o.items.reduce((n, it) => n + it.outstanding, 0);
export const isOpen = (o: Order) => ['draft', 'ordered', 'partially_received'].includes(o.status);

/** A status tag: words first; a tick for good news, grey for a routine wait (audit M5). */
export function Tag({ children, ok = false }: { children: ReactNode; ok?: boolean }) {
  return (
    <span className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${ok ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
      {ok ? <NavIcon name="check" size={13} /> : null}{children}
    </span>
  );
}

/** A card with its heading and an optional action (receiving.mjs `section`). */
export function Card({ id, title, action, children }: { id: string; title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
      <div className="flex flex-col gap-2.5 p-3.5 md:px-5 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={id} className="m-0 text-lg font-bold">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

/** A list row: name and a grey line under it, then whatever goes on the right (receiving.mjs `line`). */
export function Row({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[var(--wh-border)] py-2">
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{title}</span>
        {sub ? <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span> : null}
      </span>
      {children}
    </li>
  );
}

/** Sub-pages carry a way back (audit L2). */
export function Back() {
  return (
    <Link to={ROUTES.deliveries} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>Deliveries and orders
    </Link>
  );
}

export const linkClass = 'inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-sm font-semibold whitespace-nowrap text-[var(--wh-ink)]';

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3.5">{children}</div>;
}
