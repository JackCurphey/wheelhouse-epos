import { useState } from 'react';
import { apiMutate } from '@/lib/api/client.ts';
import { penceInput } from '@/lib/money.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Field } from './customers-page.tsx';
import { AMOUNT_WORDS, amountOf } from './credit-dialog.tsx';
import { canSay, useInvalidate } from './account-dialog.tsx';

/**
 * Record a bank transfer (cs-transfer): the amount starts at everything owed, the day it
 * arrived starts at the shop's today, and a reference as the bank statement shows it. Never counted in the
 * till's takings.
 */
export function TransferDialog({ customerId, first, owed, today, onClose }: { customerId: number; first: string; owed: number; today: string; onClose: () => void }) {
  const invalidate = useInvalidate(customerId);
  const [amount, setAmount] = useState(penceInput(owed));
  const [day, setDay] = useState(today);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function go() {
    const pence = amountOf(amount);
    if (pence === null) { setProblem(AMOUNT_WORDS); return; }
    if (!day) { setProblem('Give the day it arrived'); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/customers/${customerId}/account/transfers`, { pence, receivedOn: day, reference: reference.trim() || null });
      await invalidate();
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="bt-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="bt-title">Record a bank transfer</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">For money that didn’t come through the till</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Field id="bt-amount" label="Amount" placeholder="£0.00" value={amount} onChange={setAmount} />
          <span className="text-size-13 text-[var(--wh-muted)]">{`Everything ${first} owes — change it if they paid part.`}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field id="bt-day" label="Date it arrived" type="date" value={day} onChange={setDay} max={today} />
          <Field id="bt-reference" label="Reference" placeholder="As it shows on the bank statement" value={reference} onChange={setReference} />
        </div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`It comes off what ${first} owes. It isn’t counted in the till’s takings, so cash-up isn’t affected.`}</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void go()}>Record it</Button>
      </DialogFooter>
    </Dialog>
  );
}
