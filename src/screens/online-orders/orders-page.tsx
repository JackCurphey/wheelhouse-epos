import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { OrderDialog } from './order-dialog.tsx';
import { Badge, at, failedText, itemName, note, possessive, useOrderSteps, type Group, type OrderRow } from './order-bits.tsx';

/**
 * Front desk › Online orders (online.mjs ordersPage: on-orders,
 * on-orders-ready, on-orders-sold-at-till; website-buy-online task 8.1): the
 * orders to get ready, ready to collect and collected in the last 7 days.
 * Mark ready says when the ready email goes, with Undo while it waits. Hand
 * over opens the order, whose Hand over records it (decision Q11, logged):
 * the till's hand-over comes with paying (group 5).
 */
const COLS = 'md:grid-cols-[190px_minmax(0,1fr)_130px_190px]';
const dayName = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).replace(',', '');

function sub(o: OrderRow) {
  if (o.stage === 'ready' && o.readyAt) return `ready since ${at(o.readyAt)}`;
  if (o.stage === 'collected' && o.collectedAt) return `collected ${at(o.collectedAt)}`;
  return `paid ${at(o.paidAt)}`;
}

function Row({ o, busy, onOpen, onMarkReady }: { o: OrderRow; busy: boolean; onOpen: (o: OrderRow) => void; onMarkReady: (o: OrderRow) => void }) {
  const offId = `oo-off-${o.id}`;
  const flags = [
    o.emailProblem ? `Email didn’t arrive${o.emailProblem.phone ? ` · ${o.emailProblem.phone}` : ''}` : null,
    o.notCollectedDays ? `Not collected · ${o.notCollectedDays} ${o.notCollectedDays === 1 ? 'day' : 'days'}` : null,
  ].filter((f): f is string => f !== null);
  return (
    <li className={`grid grid-cols-1 items-center gap-1.5 border-t border-[var(--wh-border)] py-3 md:gap-4 ${COLS}`}>
      <span className="flex flex-col gap-0.5">
        <button type="button" aria-label={`Open ${possessive(o.customer)} order`} onClick={() => onOpen(o)}
          className="flex min-h-11 flex-col justify-center gap-0.5 border-0 bg-transparent p-0 text-left text-[var(--wh-ink)]">
          <span className="text-size-15 font-bold underline">{o.customer}</span>
          <span className="text-size-13 text-[var(--wh-muted)]">{`Order ${o.reference} · ${sub(o)}`}</span>
        </button>
        {flags.map((f) => <span key={f} className="mt-0.5"><Badge tone="amber">{f}</Badge></span>)}
      </span>
      <div className="flex flex-col gap-1">
        <span className="sr-only">Items: </span>
        {o.items.map((i) => (
          <span key={i.productId} className="flex flex-wrap items-center gap-2 text-sm">
            {itemName(i)}
            {o.stage === 'collected' ? null : <Badge tone={i.notOnShelf ? 'amber' : 'grey'}>{i.where}</Badge>}
          </span>
        ))}
      </div>
      <span className="text-sm"><span className="sr-only">How: </span>{o.how}</span>
      <span className="justify-self-start md:justify-self-end">
        {o.stage === 'to_get_ready' ? (
          <span className="flex flex-col items-start gap-1 text-left md:items-end md:text-right">
            <Button variant="primary" disabled={busy || Boolean(o.markReadyOff)} aria-label={`Mark ${possessive(o.customer)} order ready`}
              aria-describedby={o.markReadyOff ? offId : undefined} onClick={() => onMarkReady(o)}>Mark ready</Button>
            {o.markReadyOff ? <span id={offId} className={note}>{o.markReadyOff}</span> : null}
          </span>
        ) : null}
        {o.stage === 'ready' ? <Button variant="default" aria-label={`Hand over ${possessive(o.customer)} order`} onClick={() => onOpen(o)}>Hand over</Button> : null}
        {o.stage === 'collected' && o.collectedBy ? <span className="text-sm text-[var(--wh-muted)]">{`by ${o.collectedBy}`}</span> : null}
      </span>
    </li>
  );
}

function OrdersBody() {
  const session = useSession();
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const list = useQuery({ queryKey: ['online-orders'], queryFn: () => apiGet<{ groups: Group[] }>('/api/online-orders') });
  const step = useOrderSteps();
  const saved = useSavedNote();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const failed = (err: unknown) => saved.show({ text: failedText(err), failed: true });

  async function markReady(o: OrderRow) {
    setBusy(true);
    try {
      const done = await step<{ waitSeconds: number }>(o.id, 'ready');
      saved.show({ text: `Ready. The email goes to ${o.customer} in ${done.waitSeconds} seconds`, action: { label: 'Undo', run: () => { saved.busy(); void undo(o); } } });
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  }
  async function undo(o: OrderRow) {
    try {
      await step(o.id, 'ready/undo');
      saved.show({ text: 'Undone' });
    } catch (err) {
      failed(err);
    }
  }

  if (list.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load online orders. Try again in a moment.</p>;
  const groups = list.data?.groups;
  if (!groups) return <p className={note}>Loading…</p>;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3.5">
      <p className={note}>{`${dayName()} · ${shop}`}</p>
      {groups.map((g) => {
        const id = `oo-g-${g.key}`;
        const none = g.key === 'to_get_ready' && g.orders.length === 0;
        return (
          <section key={g.key} aria-labelledby={id} className="shrink-0 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
            <div className="flex flex-col gap-3 p-3.5 md:p-[18px]">
              <h2 id={id} className="m-0 text-size-17 font-bold">{`${g.title} · ${g.orders.length}`}</h2>
              <p className={note}>{none ? 'Nothing to get ready here.' : g.hint}</p>
              {g.orders.length ? (
                <>
                  <div aria-hidden="true" className={`hidden gap-4 text-xs font-bold text-[var(--wh-muted)] md:grid ${COLS}`}><span>Customer</span><span>Items</span><span>How</span><span /></div>
                  <ul aria-labelledby={id} className="m-0 list-none p-0">
                    {g.orders.map((o) => <Row key={o.id} o={o} busy={busy} onOpen={(x) => setOpen(x.id)} onMarkReady={(x) => void markReady(x)} />)}
                  </ul>
                </>
              ) : null}
            </div>
          </section>
        );
      })}
      {open !== null ? (
        <OrderDialog id={open} onClose={() => setOpen(null)} onMarkReady={(o) => void markReady(o)}
          onSaved={(text, isFailed) => saved.show({ text, failed: isFailed })} />
      ) : null}
    </div>
  );
}

export function OnlineOrdersPage() {
  return <SavedNoteArea room="online-orders" className="flex w-full flex-col"><OrdersBody /></SavedNoteArea>;
}
