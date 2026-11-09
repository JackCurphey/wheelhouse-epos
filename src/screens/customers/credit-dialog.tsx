import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Field } from './customers-page.tsx';

/**
 * A customer's store credit (drawn as cs-credit in customer.mjs; customer service decision 10:
 * added or taken away with a reason, like a discount, by anyone; openspec/changes/finish-customers,
 * design 8): Has [£] now, Add credit or Take some away, the amount in pounds and pence, a reason,
 * and Add the credit, or Take it away (question 8). The reason is Other… with a typed one until
 * Till › Reasons has a Store credit list (question 9).
 */
type Change = 'add' | 'take';
const CHANGES = [{ value: 'add', label: 'Add credit' }, { value: 'take', label: 'Take some away' }];
const REASONS = [{ value: 'other', label: 'Other…' }];
const canSay = (err: unknown): err is ApiError => err instanceof ApiError && err.status < 500 && err.hasServerMessage;
export const AMOUNT_WORDS = 'Pounds and pence, like 5.00';

// What's typed as whole pence above nothing, or null.
export function amountOf(typed: string): number | null {
  const read = parseTotal(typed);
  return read && !('invalid' in read) && read.pence > 0 ? read.pence : null;
}

export function CreditDialog({ customerId, name, credit, onClose }: { customerId: number; name: string; credit: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [change, setChange] = useState<Change>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go() {
    const pence = amountOf(amount);
    if (pence === null) { setProblem(AMOUNT_WORDS); return; }
    if (!reason.trim()) { setProblem('Give a reason for the change'); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/customers/${customerId}/store-credit`, { change, pence, reason: reason.trim() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
        queryClient.invalidateQueries({ queryKey: ['customer-history', customerId] }),
      ]);
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="cr-title" className="md:max-w-[520px]">
      <DialogHeader>
        <DialogTitle id="cr-title">{`${name}’s store credit`}</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`Has ${penceText(credit)} now`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <PillGroup legend="Change" value={change} onChange={(v) => setChange(v as Change)} options={CHANGES} />
        <Field id="cr-amount" label="Amount" placeholder="£0.00" value={amount} onChange={setAmount} />
        <PillGroup legend="Reason" value="other" onChange={() => {}} options={REASONS} />
        <Field id="cr-reason" label="Reason" value={reason} onChange={setReason} />
        <p className="m-0 text-sm text-[var(--wh-muted)]">The change and its reason show in her history and in the reports.</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void go()}>{change === 'add' ? 'Add the credit' : 'Take it away'}</Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * The Owner puts a mistaken entry right (design question 14), from the history or the statement:
 * a reason, then Undo it. Not drawn; a Form box as cs-credit is (decided while building).
 */
export function UndoEntryDialog({ url, invalidate, onClose }: { url: string; invalidate: unknown[][]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function go() {
    if (!reason.trim()) { setProblem('Give a reason for undoing it'); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(url, { reason: reason.trim() });
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : 'Wheelhouse couldn’t undo that. Try again in a moment.');
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="undo-title" className="md:max-w-[480px]">
      <DialogHeader><DialogTitle id="undo-title">Undo this change</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Field id="undo-reason" label="Reason" value={reason} onChange={setReason} />
        <p className="m-0 text-sm text-[var(--wh-muted)]">The change and its undoing both stay in the history.</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void go()}>Undo it</Button>
      </DialogFooter>
    </Dialog>
  );
}
