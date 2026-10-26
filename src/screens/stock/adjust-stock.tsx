import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { count, mono, type Product } from './stock-bits.tsx';

/**
 * Adjust stock (drawn as st-adjust and st-adjust-faulty in stock.mjs; stock
 * control decisions 6 and 11; openspec/changes/adjust-stock design 5): the
 * change, or the count after it, joined; a reason that follows the sign, none
 * picked until one is; a note, needed for Other. Adjust is greyed and says why
 * until it can be pressed. The To return list and the manager's Today aren't
 * built, so the box doesn't mention them.
 */
type Reason = { key: string; label: string };
const DOWN: Reason[] = [
  { key: 'damaged', label: 'Damaged' },
  { key: 'lost_stolen', label: 'Lost or stolen' },
  { key: 'used_workshop', label: 'Used in the workshop' },
  { key: 'faulty_return', label: 'Faulty — to return to supplier' },
  { key: 'other', label: 'Other' },
];
const UP: Reason[] = [{ key: 'found', label: 'Found' }, { key: 'other', label: 'Other' }];
export const REASON_LABEL: Record<string, string> = Object.fromEntries([...DOWN, ...UP].map((r) => [r.key, r.label]));
const reasonsFor = (change: number) => (change > 0 ? UP : DOWN);

// A whole number as typed: a true minus (as shown) or a hyphen (as typed).
function whole(text: string): number | null {
  const t = text.trim().replace('−', '-');
  return /^-?\d+$/.test(t) ? Number(t) : null;
}
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t adjust the stock. Try again in a moment.');
const pillClass = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--input)] bg-[var(--wh-panel)]'}`;
const field = 'min-h-11 rounded-md border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 text-size-15 text-[var(--wh-ink)]';
const stepBtn = 'size-11 border-0 bg-[var(--wh-panel)] text-xl text-[var(--wh-ink)]';

export function AdjustStock({ product, shopName, onClose }: { product: Product; shopName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const now = product.stockQty;
  const [changeText, setChangeText] = useState('−1');
  const [afterText, setAfterText] = useState(String(now - 1));
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = whole(changeText);
  const list = reasonsFor(change ?? 0);
  // A reason that doesn't fit the new sign is unpicked (Other fits both).
  const follow = (next: number | null) => {
    if (reason && !reasonsFor(next ?? 0).some((r) => r.key === reason)) setReason(null);
  };
  const typeChange = (text: string) => {
    setChangeText(text);
    const n = whole(text);
    setAfterText(n === null ? '' : count(now + n));
    follow(n);
  };
  const typeAfter = (text: string) => {
    setAfterText(text);
    const a = whole(text);
    const n = a === null ? null : a - now;
    setChangeText(n === null ? '' : count(n));
    follow(n);
  };
  const step = (by: number) => typeChange(count((change ?? 0) + by));

  const why = !change ? 'Type the change'
    : change < 0 && now + change < 0 ? 'Stock can’t go below zero'
    : !reason ? 'Pick a reason to adjust'
    : reason === 'other' && !note.trim() ? 'Write a note for Other'
    : null;

  async function adjust() {
    if (why || busy || change === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/products/${product.id}/stock`, { change, type: 'adjustment', reason, note: note.trim() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product', product.id] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
      onClose();
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="adj-title" className="md:max-w-[620px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="adj-title">Adjust stock</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">
          {[product.name, product.sku, `at ${shopName}`].filter(Boolean).join(' · ')} · <span className={mono}>{count(now)}</span> in stock now
        </p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="grid grid-cols-[auto_auto] items-end justify-start gap-4 max-md:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Change</span>
            <span role="group" aria-label="Change in stock" className="inline-flex shrink-0 items-center self-start overflow-hidden rounded-lg border border-[var(--wh-border)]">
              <button type="button" aria-label="One fewer" className={stepBtn} onClick={() => step(-1)}>−</button>
              <input inputMode="numeric" aria-label="How many" value={changeText} onChange={(e) => typeChange(e.target.value)}
                className={`h-11 w-[52px] border-x border-y-0 border-[var(--wh-border)] bg-[var(--wh-panel)] text-center text-size-15 text-[var(--wh-ink)] ${mono}`} />
              <button type="button" aria-label="One more" className={stepBtn} onClick={() => step(1)}>+</button>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adj-after" className="text-sm font-semibold">In stock after</label>
            <input id="adj-after" inputMode="numeric" value={afterText} onChange={(e) => typeAfter(e.target.value)} className={`${field} w-[100px] ${mono}`} />
          </div>
        </div>
        <RadioPillGroup aria-label="Reason" className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="mr-1 text-size-15 font-semibold">Reason</span>
          {list.map((r) => (
            <button key={r.key} type="button" role="radio" aria-checked={reason === r.key} onClick={() => setReason(r.key)} className={pillClass(reason === r.key)}>{r.label}</button>
          ))}
        </RadioPillGroup>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="adj-note" className="text-sm font-semibold">Note (needed for Other)</label>
          <input id="adj-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-full`} />
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">Going up instead? The reasons become Found and Other. It goes into the stock history with your name.</p>
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="items-start justify-between">
        <Button onClick={onClose}>Cancel</Button>
        <span className="flex flex-col items-end gap-1">
          <Button variant="primary" aria-disabled={why || busy ? true : undefined} aria-describedby={why ? 'adj-why' : undefined}
            className={why ? 'opacity-45' : undefined} onClick={adjust}>Adjust</Button>
          {why ? <span id="adj-why" className="text-size-13 text-[var(--wh-muted)]">{why}</span> : null}
        </span>
      </DialogFooter>
    </Dialog>
  );
}
