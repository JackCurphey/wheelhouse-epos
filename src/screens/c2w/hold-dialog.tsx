import { useState } from 'react';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { addDays, dayOf, daysBetween, firstName, longDate, note, plural, possessive, type C2wEvent, type C2wOrder } from './c2w-bits.tsx';
import { Choice, SAVE_FAILED, SUB, problemLine } from './certificate-dialog.tsx';

/**
 * What to do with a hold (c2w.mjs holdReminder, cw-hold-ending; openspec/changes/
 * cycle-to-work tasks 5.5–5.7): Hold longer or Release the bike, from the order's
 * held box or More…. Opened from a button, the popup starts on that button's
 * choice (logged). Saving says what happened in the page's note, as Today does.
 */
export type HoldStep = 'hold-longer' | 'release';
export type HoldSaid = { step: HoldStep; holdUntil: string | null };

export function HoldDialog({ o, events, today, holdDays, start, onClose, onSaved }: {
  o: C2wOrder; events: C2wEvent[]; today: string; holdDays: number | null; start: HoldStep;
  onClose: () => void; onSaved: (said: HoldSaid) => void;
}) {
  const [step, setStep] = useState<HoldStep>(start);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const until = o.holdUntil ?? today;
  const name = firstName(o.customerName);
  const quoted = daysBetween(dayOf(o.quoteGivenAt), today);
  const newUntil = holdDays === null ? null : addDays(until > today ? until : today, holdDays);
  // The reminder only counts if it went: one switched off or skipped is not claimed (logged).
  const reminded = [...events].reverse().find((e) => e.kind === 'hold_ending_sent' && !e.detail.skipped);

  async function save() {
    setProblem(null);
    setBusy(true);
    try {
      const done = await apiMutate<{ order: { holdUntil: string | null } }>(`/api/c2w/orders/${o.id}/${step}`, {});
      onSaved({ step, holdUntil: done.order.holdUntil });
      onClose();
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} aria-labelledby="hr-title" className="md:max-w-[540px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="hr-title">{`${possessive(o.customerName)} hold ends on ${longDate(until)}`}</DialogTitle>
          <span className={SUB}>{`${o.bike} · ${quoted > 0 ? `quoted ${plural(quoted, 'day', 'days')} ago` : 'quoted today'}, no certificate yet`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Choice<HoldStep> legend="What to do with the hold" name="hr-step" value={step} onPick={setStep} options={[
          { value: 'hold-longer', label: 'Hold longer', hint: `Until ${newUntil ? longDate(newUntil) : '[date]'} — another ${holdDays === null ? '[n] days' : plural(holdDays, 'day', 'days')}. ${name} is sent “Your bike is put aside” again, with the new date.` },
          { value: 'release', label: 'Release the bike', hint: `It goes back on sale. The order stays open; if the certificate comes, Wheelhouse checks the bike’s still here. ${name} is sent “Your bike is no longer put aside”.` },
        ]} />
        {/* Not while the hold has already ended: the list and Today already say "choose" (logged). */}
        {until >= today ? <p className={note}>{`If nobody chooses by ${longDate(until)}, the bike stays held and the list and Today show “Hold ended ${longDate(until)} — choose”. It’s never released without someone choosing.`}</p> : null}
        {reminded ? <p className={note}>{`${name} has been sent “Your hold ends on ${longDate(String(reminded.detail.until ?? until))}”. Any of these messages can be switched off in Settings › Messages.`}</p> : null}
        {problemLine(problem)}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The page's note after saving (Today's cw-today-held wording). */
export const holdSaidText = (customerName: string, said: HoldSaid) => (said.step === 'hold-longer' && said.holdUntil
  ? `${possessive(customerName)} bike is held until ${longDate(said.holdUntil)}. ${firstName(customerName)} is sent “Your bike is put aside”.`
  : `${possessive(customerName)} bike is back on sale. The order stays open.`);
