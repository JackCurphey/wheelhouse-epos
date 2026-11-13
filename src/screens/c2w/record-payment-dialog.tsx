import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { AMOUNT_WORDS, amountOf } from '@/screens/customers/credit-dialog.tsx';
import { Kv, Msg, longDate, plural, pounds } from './c2w-bits.tsx';
import { Field, SAVE_FAILED, SUB, canSay, problemLine } from './certificate-dialog.tsx';

/**
 * Record a payment: one remittance from a provider that covers several bikes
 * (c2w.mjs recordPayment; cw-record-payment, cw-record-payment-more;
 * openspec/changes/cycle-to-work task 8's owed screens). Every bike starts
 * ticked and the amount at what they still owe (logged). Saves to
 * POST /api/c2w/providers/:id/payments, owner only, which pays the oldest bike
 * first and saves the rest as part paid when less came in.
 */
export type OwedBike = {
  id: number; customerName: string; collectedOn: string; certificateNumber: string | null; certificatePence: number | null;
  expectedPence: number | null; paidPence: number | null; owedPence: number; expectedBy: string | null; lateDays: number | null;
};
export type OwedProvider = { provider: { id: number; name: string; commissionKind: 'percent' | 'pounds' | null; commissionValue: number | null; paysInDays: number | null }; orders: OwedBike[]; today: string };
export const owedProviderQuery = (id: number) => ({ queryKey: ['c2w-owed', id], queryFn: () => apiGet<OwedProvider>(`/api/c2w/providers/${id}/owed`) });
const toFocus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);
const total = (bikes: OwedBike[]) => bikes.reduce((n, b) => n + b.owedPence, 0);
export const expectedLine = (b: OwedBike) => (b.expectedPence === null ? '—' : `${pounds(b.owedPence)}${b.expectedBy ? ` by ${longDate(b.expectedBy)}` : ''}`);
// Nothing expected yet: the server refuses a payment for it (no_expected), so it can't be ticked (logged).
const payable = (b: OwedBike) => b.expectedPence !== null;
const signed = (pence: number) => (pence === 0 ? pounds(0) : pence > 0 ? `+${pounds(pence)}` : `-${pounds(-pence)}`);

export function RecordPaymentDialog({ provider, bikes, today, focusTo, onClose, onSaved }: {
  provider: { id: number; name: string }; bikes: OwedBike[]; today: string; focusTo: string; onClose: () => void; onSaved: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  // The bikes are fixed when the popup opens, so a reload can't change what the
  // owner ticked; they catch up only when the server says what's owed changed.
  const [owed, setOwed] = useState(bikes);
  const [ticked, setTicked] = useState(() => new Set(bikes.filter(payable).map((b) => b.id)));
  const [amount, setAmount] = useState((total(bikes.filter(payable)) / 100).toFixed(2));
  const [on, setOn] = useState(today);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = owed.filter((b) => ticked.has(b.id) && payable(b));
  const expected = total(chosen);
  const typed = amountOf(amount);
  const diff = typed === null || chosen.length === 0 ? 0 : typed - expected;
  // Only when every ticked bike has its certificate amount, as Mark paid does:
  // otherwise the commission has no source and the accounts line isn't shown.
  const commission = chosen.some((b) => b.certificatePence === null || b.expectedPence === null) ? null
    : chosen.reduce((n, b) => n + (b.certificatePence ?? 0) - (b.expectedPence ?? 0), 0);
  const tick = (id: number, on: boolean) => setTicked((was) => {
    const now = new Set(was);
    if (on) now.add(id); else now.delete(id);
    return now;
  });

  async function save() {
    if (chosen.length === 0) { setProblem('Tick the bikes this payment is for'); return; }
    if (typed === null) { setProblem(AMOUNT_WORDS); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/providers/${provider.id}/payments`, {
        amountPence: typed, receivedOn: on, ...(reference.trim() ? { reference: reference.trim() } : {}), orderIds: chosen.map((b) => b.id), expectedPence: expected,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['c2w-owed'] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['c2w-count'] }),
        ...chosen.map((b) => queryClient.invalidateQueries({ queryKey: ['c2w-order', b.id] })),
      ]);
      onClose();
      toFocus(focusTo);
      // Not drawn (logged): a short note says what was saved, as Mark paid does.
      onSaved(`Recorded ${pounds(typed)} from ${provider.name} for ${plural(chosen.length, 'bike', 'bikes')}.`);
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined;
      if (code === 'owed_changed' || code === 'not_owed') {
        // The amount typed stays: it's what the remittance says came. Bikes no
        // longer owed (paid or closed elsewhere: not_owed) drop out; the ones
        // still owed keep their ticks. The page behind catches up too.
        void queryClient.invalidateQueries({ queryKey: ['c2w-owed'], exact: true });
        const fresh = await queryClient.fetchQuery({ ...owedProviderQuery(provider.id), staleTime: 0 }).then((r) => r.orders, () => null);
        if (fresh) setOwed(fresh);
      }
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }

  const lead = typed === null || chosen.length === 0 ? null
    : diff === 0 ? <Msg tone="ok"><strong>{`Matches the ${plural(chosen.length, 'ticked bike', 'ticked bikes')}.`}</strong> Saving marks each one paid. If a payment is less, the bikes it doesn’t fully cover are saved as part paid.</Msg>
      : diff > 0 ? <Msg tone="warn"><strong>{`${pounds(diff)} more than expected — check with ${provider.name}.`}</strong>{` Saving marks each ticked bike paid, and the extra ${pounds(diff)} is noted on the payment.`}</Msg>
        : <Msg tone="warn"><strong>{`${pounds(-diff)} less than expected.`}</strong> It goes on the oldest bike first; the bikes it doesn’t fully cover are saved as part paid.</Msg>;
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }} onCancel={(e) => { if (busy) e.preventDefault(); }} aria-labelledby="rp-title" className="md:max-w-[720px]">
      <DialogHeader>
        <DialogTitle id="rp-title">Record a payment</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`${provider.name} · ${plural(owed.length, 'bike', 'bikes')} owed`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field id="rp-amount" label="Amount received" value={amount} onChange={setAmount} />
          <Field id="rp-on" label="Received on" type="date" value={on} max={today} onChange={(v) => setOn(v || today)} />
          <Field id="rp-ref" label="Provider’s reference" value={reference} onChange={setReference} hint="Optional" />
        </div>
        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-size-15 font-semibold">Which bikes it covers</legend>
          {owed.map((b) => (
            <div key={b.id} className="flex min-h-11 items-start gap-2.5">
              <input id={`rp-b${b.id}`} type="checkbox" checked={payable(b) && ticked.has(b.id)} disabled={!payable(b)} onChange={(e) => tick(b.id, e.target.checked)} aria-describedby={`rp-b${b.id}-sub`}
                className="mt-0.5 size-5 shrink-0 accent-[var(--wh-ink)]" />
              <span className="flex flex-col gap-0.5">
                <label htmlFor={`rp-b${b.id}`} className={`${payable(b) ? 'cursor-pointer' : ''} text-size-15 font-semibold`}>{b.customerName}</label>
                <span id={`rp-b${b.id}-sub`} className={SUB}>{payable(b) ? `Certificate ${b.certificateNumber ?? '—'} · expected ${expectedLine(b)}`
                  : `Nothing is expected from ${provider.name} for this bike yet. Add what they will pay to the order first.`}</span>
              </span>
            </div>
          ))}
        </fieldset>
        <div>
          <Kv k="Expected for the ticked bikes">{pounds(expected)}</Kv>
          <Kv k="Received">{typed === null ? '—' : pounds(typed)}</Kv>
          <Kv k="Difference" strong>{typed === null || chosen.length === 0 ? '—' : signed(diff)}</Kv>
        </div>
        <div role="status">{lead}</div>
        <p className={`${SUB} m-0`}>This goes in each ticked order’s history and the activity log.</p>
        {typed === null || commission === null ? null
          : <p className={`${SUB} m-0`}>{`It goes to your accounts software with that day’s figures, as “${provider.name} paid ${pounds(typed)} · commission ${pounds(commission)}”.`}</p>}
        {problemLine(problem)}
      </DialogBody>
      <DialogFooter className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>{diff > 0 ? 'Save as paid' : 'Save'}</Button>
      </DialogFooter>
    </Dialog>
  );
}
