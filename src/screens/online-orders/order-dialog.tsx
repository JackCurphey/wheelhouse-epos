import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { penceText } from '@/lib/money.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Tick } from '@/screens/c2w/certificate-dialog.tsx';
import { Badge, at, failedText, firstName, itemName, note, useOrderSteps, type FullOrder, type OrderRow } from './order-bits.tsx';

/**
 * One online order, opened from the list (online.mjs orderDialog,
 * on-order-staff and on-order-staff-ready; website-buy-online tasks 8.2–8.4),
 * and Not ready after all (on-not-ready). Close left, the main step right
 * (audit M2). Can't supply an item and Cancel and refund come with refunds
 * (group 7), so the body has no buttons until an order is ready (logged).
 * The server sends no prices or product codes for the lines, so they aren't
 * shown (logged).
 */
const SUB = 'm-0 text-sm text-[var(--wh-muted)]';
const mono = 'font-[family-name:var(--wh-font-mono)]';
export const SOLD_OFF = 'Mark ready isn’t available yet: an item was sold at the till.';

function subtitle(o: FullOrder) {
  if (o.stage === 'ready' && o.readyAt) {
    return `Ready since ${at(o.readyAt)} · ${o.emailProblem ? 'email didn’t arrive' : 'emailed'}${o.shelfName ? ` · waiting at ${o.shelfName}` : ''}`;
  }
  if (o.stage === 'collected' && o.collectedAt) return `Collected ${at(o.collectedAt)}${o.collectedBy ? ` by ${o.collectedBy}` : ''}`;
  return null;
}

export function OrderDialog({ id, onClose, onMarkReady, onSaved }: {
  id: number; onClose: () => void; onMarkReady: (o: OrderRow) => void; onSaved: (text: string, failed?: boolean) => void;
}) {
  const order = useQuery({ queryKey: ['online-order', id], queryFn: () => apiGet<{ order: FullOrder }>(`/api/online-orders/${id}`) });
  const step = useOrderSteps();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const o = order.data?.order;

  async function handOver(x: FullOrder) {
    setBusy(true);
    setProblem(null);
    try {
      await step(x.id, 'hand-over');
      onClose();
      onSaved(`Handed over ${x.customer}’s order`);
    } catch (err) {
      setBusy(false);
      setProblem(failedText(err));
    }
  }

  const title = o ? `Order ${o.reference} · ${o.customer}` : 'Order';
  const sub = o ? subtitle(o) : null;
  const paidParts = o ? ([['Store credit', o.paid.creditPence], ['Card', o.paid.cardPence]] as const).filter(([, p]) => p > 0) : [];
  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }} aria-labelledby="od-title" wide>
        <DialogHeader>
          <div className="flex flex-col gap-1">
            <DialogTitle id="od-title">{title}</DialogTitle>
            {sub ? <p className={SUB}>{sub}</p> : null}
          </div>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2.5">
          {order.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this order. Try again in a moment.</p> : null}
          {!o && !order.isError ? <p className={note}>Loading…</p> : null}
          {o ? (
            <>
              <ul aria-label="Items" className="m-0 list-none p-0">
                {o.items.map((i) => (
                  <li key={i.productId} className="flex flex-col gap-1 border-t border-[var(--wh-border)] py-2.5">
                    <span className="text-size-15 font-semibold">{itemName(i)}</span>
                    {i.where ? <span><Badge tone={i.notOnShelf ? 'amber' : 'grey'}>{i.where}</Badge></span> : null}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--wh-border)] pt-2.5 text-sm leading-normal md:grid-cols-3">
                <p className="m-0"><strong>How</strong><br />{o.how.replace(/^Collect · /, 'Collect from ')}</p>
                <p className="m-0">
                  <strong>{`Paid ${at(o.paidAt)}`}</strong>
                  {paidParts.map(([k, p]) => <span key={k} className="block">{`${k} `}<span className={mono}>{penceText(p)}</span></span>)}
                </p>
                <p className="m-0">
                  <strong>Customer</strong>
                  {o.email ? <span className="block">{o.email}</span> : null}
                  {o.phone ? <a href={`tel:${o.phone.replace(/\s+/g, '')}`} className={`block text-[var(--wh-ink)] ${mono}`}>{o.phone}</a> : null}
                </p>
              </div>
              {o.stage === 'ready' ? (
                <div className="flex flex-wrap gap-2.5 border-t border-[var(--wh-border)] pt-2.5">
                  <Button variant="default" disabled={busy} onClick={() => setAsking(true)}>Not ready after all</Button>
                </div>
              ) : null}
              {o.stage === 'to_get_ready' && o.markReadyOff ? <p id="od-off" className="m-0 text-sm">{SOLD_OFF}</p> : null}
              {problem ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{problem}</p> : null}
            </>
          ) : null}
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="ghost" disabled={busy} onClick={onClose}>Close</Button>
          {o?.stage === 'to_get_ready' ? (
            <Button variant="primary" disabled={busy || Boolean(o.markReadyOff)} aria-describedby={o.markReadyOff ? 'od-off' : undefined}
              onClick={() => { onClose(); onMarkReady(o); }}>Mark ready</Button>
          ) : null}
          {o?.stage === 'ready' ? <Button variant="primary" disabled={busy} onClick={() => void handOver(o)}>Hand over</Button> : null}
        </DialogFooter>
      </Dialog>
      {asking && o ? <NotReady o={o} onKeep={() => setAsking(false)} onMoved={() => { setAsking(false); onClose(); }} onSaved={onSaved} /> : null}
    </>
  );
}

/** Not ready after all? (on-not-ready): ticked to send "Sorry, not ready yet" (audit H4). */
function NotReady({ o, onKeep, onMoved, onSaved }: { o: FullOrder; onKeep: () => void; onMoved: () => void; onSaved: (text: string, failed?: boolean) => void }) {
  const step = useOrderSteps();
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = firstName(o.customer);
  async function move() {
    setBusy(true);
    setProblem(null);
    try {
      await step(o.id, 'not-ready', { tell });
      onMoved();
      onSaved(`Moved ${o.customer}’s order back to “To get ready”`);
    } catch (err) {
      setBusy(false);
      setProblem(failedText(err));
    }
  }
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onKeep(); }} aria-labelledby="nr-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div className="flex flex-col gap-1">
          <DialogTitle id="nr-title">Not ready after all?</DialogTitle>
          <p className={SUB}>{`Order ${o.reference} · ${o.customer} was told it’s ready${o.readyAt ? ` at ${at(o.readyAt)}` : ''}`}</p>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <p className="m-0 text-size-15 leading-normal">It goes back to “To get ready”.</p>
        <Tick checked={tell} onChange={setTell} label={`Send ${name} “Sorry, not ready yet”`} sub="The wording is in Settings › Messages › Order not ready after all" />
        {problem ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={onKeep}>Keep it ready</Button>
        <Button variant="primary" disabled={busy} onClick={() => void move()}>Move it back</Button>
      </DialogFooter>
    </Dialog>
  );
}
