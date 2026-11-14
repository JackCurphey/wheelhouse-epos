import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Msg, dayOf, firstName, longDate, type C2wEvent, type C2wOrder } from './c2w-bits.tsx';
import { CHANGE_TITLE, type ChangeWhat } from './change-dialog.tsx';

/**
 * More… on the order (c2w.mjs `more`, `moreMenu`, cw-more) and Cancel the order
 * (cw-cancel, cw-cancel-ordered; openspec/changes/cycle-to-work task 8.5's screen).
 * The changes (task 4.8, change-dialog.tsx) are offered while they can still
 * change the quote: the bike and accessories until the bike is ready, the
 * provider until the certificate is in (logged). Release the bike joins it with
 * its pull request (5b).
 * No deposit line until deposits are built (pull request 11).
 */
const SUB = 'text-size-13 text-[var(--wh-muted)]';
const ITEM = 'flex min-h-11 w-full items-center rounded-md border-0 bg-transparent px-3 text-left text-size-15';
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const canSay = (err: unknown): err is ApiError => err instanceof ApiError && err.status < 500 && err.hasServerMessage;

/** A real menu, as Reports' "…": it opens on its first item, the arrows move, Escape or a click away closes it. */
export function MoreMenu({ o, onCancel, onChange }: { o: C2wOrder; onCancel: () => void; onChange: (what: ChangeWhat) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const label = `More for ${o.customerName}’s order`;
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  function keys(e: React.KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
  }
  const choose = (act: () => void) => () => { setOpen(false); button.current?.focus(); act(); };
  const changes: ChangeWhat[] = o.stage === 'quote' || o.stage === 'waiting' ? ['bike', 'accessories', 'provider'] : o.stage === 'certificate' ? ['bike', 'accessories'] : [];
  return (
    <div className="relative">
      <Button ref={button} variant="default" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>More…</Button>
      {open ? (
        <div ref={menu} role="menu" aria-label={label} onKeyDown={keys}
          className="absolute left-0 top-[50px] z-10 flex w-[300px] flex-col rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1.5 shadow-modal md:left-auto md:right-0 md:w-[280px]">
          {changes.map((w) => <button key={w} type="button" role="menuitem" className={ITEM} onClick={choose(() => onChange(w))}>{CHANGE_TITLE[w]}</button>)}
          {changes.length ? <span role="separator" className="mx-1.5 my-1 h-px bg-[var(--wh-border)]" /> : null}
          <button type="button" role="menuitem" className={`${ITEM} text-[var(--wh-danger)]`} onClick={choose(onCancel)}>Cancel the order…</button>
          {changes.length ? <p className="mx-3 mb-2 mt-1.5 text-size-13 leading-[1.45] text-[var(--wh-muted)]">A change after the quote is sent makes a revised quote; nothing is sent until you press Email.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** When the bike went on the supplier order: the latest "ordered" line not since undone. */
function orderedOn(events: C2wEvent[]) {
  const last = [...events].reverse().find((e) => e.kind === 'ordered' || e.kind === 'order_undone');
  return last?.kind === 'ordered' ? longDate(dayOf(last.at)) : null;
}

/** Maya isn't going ahead? (cw-cancel, cw-cancel-ordered). */
export function CancelDialog({ o, events, shop, onClose }: { o: C2wOrder; events: C2wEvent[]; shop: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [bike, setBike] = useState<'keep' | 'return'>('keep');
  const [tell, setTell] = useState(true);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = firstName(o.customerName);
  const where = o.siteName ?? shop;
  const supplier = o.orderedFrom ?? o.supplier ?? '[supplier]';
  async function go() {
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/orders/${o.id}/cancel`, { tell, ...(o.onOrder ? { bike } : {}), ...(why.trim() ? { reason: why.trim() } : {}) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['c2w-order', o.id] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-count'] }),
      ]);
      onClose();
      setTimeout(() => document.getElementById('cw-cancelled')?.focus(), 0);
    } catch (err) {
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }
  const on = orderedOn(events);
  const radio = (value: 'keep' | 'return', label: string, hint: string) => (
    <label className="flex min-h-11 items-start gap-2.5 py-1.5">
      <input type="radio" name="cxb" className="mt-1 size-4" checked={bike === value} onChange={() => setBike(value)} aria-label={label} aria-describedby={`cxb-${value}-hint`} />
      <span className="flex flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{label}</span>
        <span id={`cxb-${value}-hint`} className={SUB}>{hint}</span>
      </span>
    </label>
  );
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }} onCancel={(e) => { if (busy) e.preventDefault(); }} aria-labelledby="cx-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="cx-title">{`${name} isn’t going ahead?`}</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`Quote ${o.quoteRef} · ${o.bike}`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {o.onOrder ? (
          <>
            <Msg><strong>{`The bike was ordered from ${supplier}`}</strong>{`${on ? ` on ${on}` : ''}${o.certificateNumber ? `, and certificate ${o.certificateNumber} was added` : ''}.`}</Msg>
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 p-0 text-size-15 font-bold">The bike</legend>
              {radio('keep', 'Keep it as shop stock', `It goes on sale at ${where} when it arrives.`)}
              {radio('return', `Send it back to ${supplier}`, 'Starts a return in Deliveries and orders.')}
            </fieldset>
            <Msg tone="warn"><strong>{`Tell ${o.providerName}`}</strong> the order is cancelled — the way your note for them says.</Msg>
          </>
        ) : o.held ? <Msg><strong>{o.bike}</strong>{` goes back on sale at ${where}.`}</Msg> : null}
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} aria-describedby="cx-tell-hint" className="mt-0.5 size-5 shrink-0 accent-[var(--wh-ink)]" />
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">{`Tell ${name} the order is cancelled`}</span>
            <span id="cx-tell-hint" className={SUB}>“Your order is cancelled”, sent the way she chose. It says what happens to any deposit.</span>
          </span>
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor="cx-why" className="text-size-15 font-semibold">Why?</label>
          <textarea id="cx-why" rows={2} maxLength={500} placeholder="[reason]" value={why} onChange={(e) => setWhy(e.target.value)}
            className="rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 py-2 text-size-15" />
        </div>
        <p className={SUB + ' m-0'}>This goes in the order’s history and the activity log.</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Keep the order</Button>
        <Button variant="danger" disabled={busy} onClick={() => void go()}>Cancel the order</Button>
      </DialogFooter>
    </Dialog>
  );
}
