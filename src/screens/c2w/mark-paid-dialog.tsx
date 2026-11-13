import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { AMOUNT_WORDS, amountOf } from '@/screens/customers/credit-dialog.tsx';
import { Msg, longDate, pounds, type C2wOrder } from './c2w-bits.tsx';
import { Field, SAVE_FAILED, SUB, canSay, problemLine } from './certificate-dialog.tsx';

/**
 * Mark paid on one order (c2w.mjs markPaid; cw-mark-paid, cw-mark-paid-diff;
 * openspec/changes/cycle-to-work task 8's order-page screen). It starts at what's
 * still owed and today. Less than owed is saved as part paid, or closed with a
 * reason; more is marked paid with the extra noted (not drawn: logged). "Close
 * with a reason…" asks why in the same popup, as Cancel the order does (logged);
 * from a part-paid order it closes the rest with nothing more received. Saves to
 * POST /api/c2w/orders/:id/paid, which only the owner may use.
 */
type As = null | 'paid' | 'part' | 'close';
export const owedOf = (o: C2wOrder) => Math.max(0, (o.expectedPence ?? 0) - (o.paidPence ?? 0));
/** Nothing received: allowed only for closing it (amountOf refuses 0). */
const isNothing = (typed: string) => /^\s*£?\s*0+(\.0{1,2})?\s*$/.test(typed);
export const toFocus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);

export function MarkPaidDialog({ o, today, closing = false, focusTo = 'cw-next', onClose, onSaved }: {
  o: C2wOrder; today: string; closing?: boolean; focusTo?: string; onClose: () => void; onSaved: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  // What's owed is fixed when the popup opens, so a reload can't change what the
  // owner saw; it catches up only when the server says it changed (owed_changed).
  const [owed, setOwed] = useState(() => owedOf(o));
  // Someone else marked it paid or closed it meanwhile: nothing more to save here.
  const [gone, setGone] = useState(false);
  const [amount, setAmount] = useState((owed / 100).toFixed(2));
  const [on, setOn] = useState(today);
  const [reference, setReference] = useState('');
  const [why, setWhy] = useState('');
  const [asking, setAsking] = useState(closing);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const typed = closing || isNothing(amount) ? 0 : amountOf(amount);
  const diff = typed === null ? 0 : typed - owed;
  const commission = o.certificatePence !== null && o.expectedPence !== null ? o.certificatePence - o.expectedPence : null;

  async function save(as: As) {
    if (typed === null) { setProblem(AMOUNT_WORDS); return; }
    if (as === 'close' && !why.trim()) { setProblem('Say why it’s being closed'); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/orders/${o.id}/paid`, {
        amountPence: typed, receivedOn: on, ...(reference.trim() ? { reference: reference.trim() } : {}), as, ...(as === 'close' ? { reason: why.trim() } : {}), owedPence: owed,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['c2w-order', o.id] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-count'] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-owed'] }),
      ]);
      onClose();
      toFocus(focusTo);
      // Not drawn (logged): a short note says what was saved, as the other steps do.
      onSaved(as === 'part' ? 'Saved as part paid.' : as === 'close' ? 'Closed with a reason.' : 'Marked paid.');
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined;
      // owed_changed: a part payment came in meanwhile. wrong_stage: it was
      // marked paid or closed elsewhere, so there is nothing more to save here.
      if (code === 'owed_changed' || code === 'wrong_stage') {
        // The amount typed stays: it's what the remittance says came.
        // Fetched, not just invalidated: from the list or the Owed page nothing else is watching the order.
        const fresh = await queryClient.fetchQuery({ queryKey: ['c2w-order', o.id], staleTime: 0, queryFn: () => apiGet<{ order: C2wOrder }>(`/api/c2w/orders/${o.id}`) })
          .then((r) => r.order, () => null);
        void queryClient.invalidateQueries({ queryKey: ['c2w-owed'] });
        if (fresh) {
          setOwed(owedOf(fresh));
          if (fresh.stage !== 'collected') setGone(true);
        }
      }
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }
  const sub = `${o.customerName} · ${o.providerName} · expected ${pounds(o.expectedPence ?? 0)}${o.expectedBy ? ` by ${longDate(o.expectedBy)}` : ''}`;
  const short = closing ? owed : -diff;
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }} onCancel={(e) => { if (busy) e.preventDefault(); }} aria-labelledby="mp-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="mp-title">Mark paid</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{sub}</p>
      </DialogHeader>
      {asking ? (
        <DialogBody className="flex flex-col gap-3">
          <Msg tone="warn"><strong>{`${pounds(short)} won’t be paid.`}</strong> The order is closed and comes off the owed list.</Msg>
          <div className="flex flex-col gap-1">
            <label htmlFor="mp-why" className="text-size-15 font-semibold">Why?</label>
            <textarea id="mp-why" autoFocus rows={2} maxLength={500} placeholder="[reason]" value={why} onChange={(e) => setWhy(e.target.value)}
              className="rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 py-2 text-size-15" />
          </div>
          <p className={`${SUB} m-0`}>This goes in the order’s history and the activity log.</p>
          {problemLine(problem)}
        </DialogBody>
      ) : (
        <DialogBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field id="mp-amount" label="Amount received" value={amount} onChange={setAmount} />
            <Field id="mp-on" label="Received on" type="date" value={on} max={today} onChange={(v) => setOn(v || today)} />
          </div>
          <Field id="mp-ref" label="Provider’s reference" value={reference} onChange={setReference} hint="Optional — from the remittance" />
          <div role="status">
            {typed === null ? null : diff === 0 ? <Msg tone="ok">Matches what was expected.</Msg>
              : diff < 0 ? <Msg tone="warn"><strong>{`${pounds(-diff)} less than expected.`}</strong> Save it as part paid and keep chasing the rest, or close it with a reason.</Msg>
                : <Msg tone="warn"><strong>{`${pounds(diff)} more than expected.`}</strong>{` The extra ${pounds(diff)} is noted.`}</Msg>}
          </div>
          <p className={`${SUB} m-0`}>This goes in the order’s history and the activity log.</p>
          {typed === null || commission === null ? null
            : <p className={`${SUB} m-0`}>{`The payment goes to your accounts software with that day’s figures, as “${o.providerName} paid ${pounds(typed)} · commission ${pounds(commission)}”.`}</p>}
          {problemLine(problem)}
        </DialogBody>
      )}
      <DialogFooter className="flex flex-wrap justify-end gap-2.5">
        {gone ? <Button variant="ghost" onClick={onClose}>Cancel</Button> : asking ? (
          <>
            {closing ? <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
              : <Button variant="ghost" disabled={busy} onClick={() => { setProblem(null); setAsking(false); toFocus('mp-amount'); }}>Back</Button>}
            <Button variant="primary" disabled={busy} onClick={() => void save('close')}>Close it</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            {diff < 0 ? (
              <>
                <Button variant="default" disabled={busy} onClick={() => { setProblem(null); setAsking(true); }}>Close with a reason…</Button>
                {typed ? <Button variant="primary" disabled={busy} onClick={() => void save('part')}>Save as part paid</Button> : null}
              </>
            ) : <Button variant="primary" disabled={busy} onClick={() => void save(diff > 0 ? 'paid' : null)}>Mark paid</Button>}
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
