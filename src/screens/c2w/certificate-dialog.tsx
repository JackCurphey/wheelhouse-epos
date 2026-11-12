import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { AMOUNT_WORDS, amountOf } from '@/screens/customers/credit-dialog.tsx';
import { Kv, Msg, dayOf, firstName, longDate, mono, note, pounds, type C2wOrder } from './c2w-bits.tsx';

/**
 * The order's pop-ups for its next steps (c2w.mjs applied, certificate,
 * matchLines; openspec/changes/cycle-to-work tasks 6.5–6.6): Maya has applied,
 * Add the certificate with what to do when it's for less or more, and Change
 * the order to match. Each saves to `server/routes/c2w.js` and reloads the order.
 */
const canSay = (err: unknown): err is ApiError => err instanceof ApiError && err.status < 500 && err.hasServerMessage;
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const SUB = 'text-size-13 text-[var(--wh-muted)]';
const problemLine = (p: string | null) => (p ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{p}</p> : null);

function Field({ id, label, value, onChange, type = 'text', hint, max }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; max?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-size-15 font-semibold">{label}</label>
      <input id={id} type={type} value={value} max={max} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-15" />
      {hint ? <span id={`${id}-hint`} className={SUB}>{hint}</span> : null}
    </div>
  );
}

function Tick({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--wh-ink)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{label}</span>
        {sub ? <span className={SUB}>{sub}</span> : null}
      </span>
    </label>
  );
}

function Choice<T extends string>({ legend, name, value, options, onPick }: { legend: string; name: string; value: T; options: { value: T; label: string; hint?: string }[]; onPick: (v: T) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-size-15 font-bold">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 items-start gap-2.5 py-1.5">
          <input type="radio" name={name} className="mt-1 size-4" checked={value === o.value} onChange={() => onPick(o.value)}
            aria-label={o.label} aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined} />
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">{o.label}</span>
            {o.hint ? <span id={`${name}-${o.value}-hint`} className={SUB}>{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Reload the order and the list after a step is saved. */
function useReload(id: number) {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['c2w-order', id] }),
    queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['c2w-count'] }),
  ]);
}

/** Maya has applied (cw-applied): the day, and the employer and reference if there are any. */
export function AppliedDialog({ o, today, rule, supplier, onClose }: { o: C2wOrder; today: string; rule: string | undefined; supplier: string | null; onClose: () => void }) {
  const reload = useReload(o.id);
  const [on, setOn] = useState(today);
  const [employer, setEmployer] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = firstName(o.customerName);
  async function go() {
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/orders/${o.id}/applied`, {
        appliedOn: on, ...(employer.trim() ? { employer: employer.trim() } : {}), ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      await reload();
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }
  // The rule's line is drawn for a bike to order once the customer has applied.
  const ruleLine = rule === 'applied' && !o.inStock && !o.onOrder
    ? `Your rule: order once the customer has applied. The order will show “Order from ${supplier ?? 'the supplier'}” next.` : null;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} aria-labelledby="ap-title" className="md:max-w-[540px]">
      <DialogHeader>
        <DialogTitle id="ap-title">{`${name} has applied`}</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`Quote ${o.quoteRef} · ${o.providerName}`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Field id="ap-on" label="Applied on" type="date" max={today} value={on} onChange={setOn} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field id="ap-employer" label="Employer" hint="Optional" value={employer} onChange={setEmployer} />
          <Field id="ap-reference" label="Application reference" hint={`Optional — if ${name} has one`} value={reference} onChange={setReference} />
        </div>
        {ruleLine ? <Msg>{ruleLine}</Msg> : null}
        {problemLine(problem)}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void go()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

type Difference = 'keep' | 'match';

/**
 * Add the certificate (cw-certificate, -diff, -more, -late) and, for a
 * certificate for less, Change the order to match (cw-certificate-match). What's
 * typed is kept when going Back from the second step.
 */
export function CertificateDialog({ o, today, onClose }: { o: C2wOrder; today: string; onClose: () => void }) {
  const reload = useReload(o.id);
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(today);
  const [ready, setReady] = useState(true);
  const [less, setLess] = useState<Difference>('match');
  const [more, setMore] = useState<Difference>('keep');
  const [step, setStep] = useState<'certificate' | 'lines' | 'released'>('certificate');
  const [after, setAfter] = useState<C2wOrder | null>(null);
  const [off, setOff] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = firstName(o.customerName);
  const pence = amountOf(amount);
  // Late is judged on the Received date, as the server judges it (orders.js: received after valid until).
  const late = !!received && received > o.validUntil;
  const kind = pence === null ? null : pence < o.totalPence ? 'less' : pence > o.totalPence ? 'more' : late ? 'late' : 'match';
  const gap = pence === null ? 0 : Math.abs(pence - o.totalPence);
  const heading = pence === null ? '' : `Certificate ${pounds(pence)} · quote ${pounds(o.totalPence)}.`;
  // The tick is drawn for a bike put aside whose certificate matches the order.
  const tickShown = (kind === 'match' || kind === 'late') && o.held;
  const difference: Difference | null = kind === 'less' ? less : kind === 'more' ? more : null;
  const extrasPence = o.accessories.reduce((n, a) => n + a.pricePence, 0);
  const bikePence = o.totalPence - extrasPence;
  const kept = o.accessories.filter((a) => !off.includes(a.productId));
  const newTotal = bikePence + kept.reduce((n, a) => n + a.pricePence, 0);

  function checked(): number | null {
    if (!number.trim()) { setProblem('Give the certificate number'); return null; }
    if (pence === null) { setProblem(AMOUNT_WORDS); return null; }
    setProblem(null);
    return pence;
  }
  async function save() {
    const p = checked();
    if (p === null) return;
    setBusy(true);
    try {
      const saved = await apiMutate<{ order: C2wOrder }>(`/api/c2w/orders/${o.id}/certificate`, {
        number: number.trim(), amountPence: p, receivedOn: received, ready: tickShown && ready,
        ...(difference ? { difference } : {}),
        ...(difference === 'match' ? { accessoryIds: (kind === 'less' ? kept : o.accessories).map((a) => a.productId) } : {}),
      });
      await reload();
      // cw-certificate-released: the bike was let go and none could be put aside again.
      const got = saved?.order;
      if (got?.releasedAt && got.next === 'order') {
        setAfter(got); setStep('released'); setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }
  async function orderOne() {
    setBusy(true);
    try {
      await apiMutate(`/api/c2w/orders/${o.id}/order`, {});
      await reload();
      onClose();
    } catch (err) {
      setProblem(canSay(err) ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }
  const close = (v: boolean) => { if (!v) onClose(); };

  if (step === 'released' && after?.releasedAt) {
    // "Hold another" from the other shop waits for Jack (question 8), and there's no lead time for "About [n] days" (both logged).
    const orderChoice = after.supplier ? `Order one from ${after.supplier}` : 'Order the bike';
    return (
      <Dialog open onOpenChange={close} aria-labelledby="cr-title" className="md:max-w-[560px]">
        <DialogHeader>
          <DialogTitle id="cr-title">The bike was released</DialogTitle>
          <p className="m-0 text-sm text-[var(--wh-muted)]">{`${o.customerName} · certificate ${number.trim()} saved`}</p>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Msg tone="warn"><strong>{`${after.bike} was released on ${longDate(dayOf(after.releasedAt))}`}</strong>{after.releasedSold ? ' and has since been sold.' : '.'}</Msg>
          <Choice legend={`What to do for ${name}`} name="cr" value="order" onPick={() => {}} options={[{ value: 'order', label: orderChoice }]} />
          {problemLine(problem)}
        </DialogBody>
        <DialogFooter className="flex justify-end gap-2.5">
          <Button variant="ghost" disabled={busy} onClick={onClose}>Decide later</Button>
          <Button key="save-released" variant="primary" disabled={busy} onClick={() => void orderOne()}>Save</Button>
        </DialogFooter>
      </Dialog>
    );
  }

  if (step === 'lines' && pence !== null) {
    return (
      <Dialog open onOpenChange={close} aria-labelledby="ml-title" className="md:max-w-[560px]">
        <DialogHeader>
          <DialogTitle id="ml-title">Change the order to match</DialogTitle>
          <p className="m-0 text-sm text-[var(--wh-muted)]">{`${o.customerName} · certificate ${pounds(pence)} · quote ${pounds(o.totalPence)}`}</p>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="mb-1 p-0 text-size-15 font-bold">Tick what to take off</legend>
            <div data-line="bike" className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--wh-border)] text-size-15">
              <span>{o.bike}</span><span className={mono}>{pounds(bikePence)}</span>
            </div>
            {o.accessories.map((a) => (
              <div key={a.productId} className="flex items-start justify-between gap-3 border-b border-[var(--wh-border)]">
                <Tick label={a.name} checked={off.includes(a.productId)} onChange={(v) => setOff((was) => (v ? [...was, a.productId] : was.filter((x) => x !== a.productId)))} />
                <span className={`pt-0.5 ${mono}`}>{pounds(a.pricePence)}</span>
              </div>
            ))}
          </fieldset>
          <p className={note}>To change the bike or size, use More on the order.</p>
          <div>
            <Kv k="New total (includes VAT)" strong><span className={mono}>{pounds(newTotal)}</span></Kv>
            <Kv k="Certificate"><span className={mono}>{pounds(pence)}</span></Kv>
          </div>
          {newTotal === pence ? <Msg tone="ok"><strong>They match.</strong>{` The revised quote goes to ${name} with the “Certificate received” email.`}</Msg> : null}
          {problemLine(problem)}
        </DialogBody>
        <DialogFooter className="flex justify-end gap-2.5">
          <Button variant="ghost" disabled={busy} onClick={() => { setProblem(null); setStep('certificate'); }}>Back</Button>
          <Button key="save-lines" variant="primary" disabled={busy || newTotal !== pence} onClick={() => void save()}>{`Save and email ${name}`}</Button>
        </DialogFooter>
      </Dialog>
    );
  }

  const putAside = o.held ? `${o.bike} stays put aside until ${name} collects it.` : null;
  const toLines = kind === 'less' && less === 'match';
  return (
    <Dialog open onOpenChange={close} aria-labelledby="ce-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="ce-title">Add the certificate</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`${o.customerName} · ${o.providerName}`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field id="ce-number" label="Certificate number" value={number} onChange={setNumber} />
          <Field id="ce-amount" label="Amount on the certificate" value={amount} onChange={setAmount} />
        </div>
        <Field id="ce-received" label="Received" type="date" max={today} value={received} onChange={setReceived} />
        {kind === 'match' ? <Msg tone="ok"><strong>{heading}</strong> They match.</Msg> : null}
        {kind === 'late' ? <Msg tone="warn"><strong>{`Quote ran out on ${longDate(o.validUntil)} — check the price.`}</strong>{` ${heading} The amounts match.`}</Msg> : null}
        {late && (kind === 'less' || kind === 'more') ? <Msg tone="warn"><strong>{`Quote ran out on ${longDate(o.validUntil)} — check the price.`}</strong></Msg> : null}
        {kind === 'less' ? (
          <>
            <Msg tone="warn"><strong>{heading}</strong>{` ${pounds(gap)} less than the quote.`}</Msg>
            <Choice legend="What to do" name="ce-less" value={less} onPick={setLess} options={[
              { value: 'match', label: 'Change the order to match', hint: `Take something off so the total is the certificate amount. ${name} is emailed “Certificate received” with the revised quote.` },
              { value: 'keep', label: `Keep the order; ${name} pays the ${pounds(gap)} difference`, hint: `At collection, as a second payment at the till. ${name} is told “You pay ${pounds(gap)} when you collect”.` },
            ]} />
          </>
        ) : null}
        {kind === 'more' ? (
          <>
            <Msg tone="warn"><strong>{heading}</strong>{` ${pounds(gap)} more than the quote.`}</Msg>
            <Choice legend="What to do" name="ce-more" value={more} onPick={setMore} options={[
              { value: 'keep', label: 'Keep the order as quoted', hint: `${name} pays nothing at collection. ${o.providerName} is expected to pay the order’s total, ${pounds(o.totalPence)}.` },
              { value: 'match', label: 'Change the order to match', hint: `Add to the order so the total is the certificate amount. ${name} is emailed “Certificate received” with the revised quote.` },
            ]} />
          </>
        ) : null}
        {kind === 'less' || kind === 'more' ? <p className={note}>{`What’s expected from ${o.providerName} follows the order either way.`}</p> : null}
        {tickShown ? (
          <Tick checked={ready} onChange={setReady} label={`The bike is ready — tell ${name} they can collect it`}
            sub={`Leave it ticked if the bike can go now. Untick it if it needs work first: ${name} is sent “Certificate received” now, and “Ready to collect” when you mark it ready.`} />
        ) : null}
        {putAside && kind === 'match' ? <p className={note}>{`${putAside} With the tick, the order moves to Ready to collect and ${name} is sent one message, “Ready to collect”, which says the certificate arrived.`}</p> : null}
        {putAside && kind === 'late' ? <p className={note}>{putAside}</p> : null}
        {problemLine(problem)}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        {toLines
          ? <Button key="to-lines" variant="primary" onClick={() => { if (checked() !== null) setStep('lines'); }}>Next: what to take off</Button>
          : <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>}
      </DialogFooter>
    </Dialog>
  );
}
