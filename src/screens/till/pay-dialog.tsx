import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession, type SessionEmployee } from '@/lib/auth/use-session.ts';
import { useYourSettings } from '@/lib/your-settings.ts';
import { useTillCheckin } from '@/lib/till-checkin.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { printReceipt, type ReceiptJob, type ReceiptSale, type ShopDetails } from './receipt.tsx';
import { EmailReceiptDialog, type ReceiptCustomer } from './email-receipt.tsx';
import { asSaleItem, money, noteButtons, pence, saleTotal, type TillLine } from './rules.ts';
import { firstName, possessive } from '@/screens/c2w/c2w-bits.tsx';

/**
 * Take payment (journey 11 decisions 6 and 7): card, cash or both, then
 * Paid, which starts the next sale by itself after five seconds.
 *
 * The card machine isn't connected yet, so Card is the drawing's own
 * fallback: key the amount into the machine, then say it was approved.
 * The whole sale is saved in one call once it's paid in full.
 * Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
 */

type Employee = { id: number; name: string; isCashier: boolean; active: boolean };
type Step =
  | { kind: 'who' }
  | { kind: 'methods' }
  | { kind: 'card'; amount: number; cashPart: number }
  | { kind: 'cash' }
  | { kind: 'split' }
  | { kind: 'extra' }
  | { kind: 'paid'; how: string; change: number; note: string | null; sale: ReceiptSale | null; cash: number; card: number };

declare global {
  interface Window { WH_TILL_TICK_MS?: number }
}

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
const parse = (raw: string) => {
  const n = Number(raw.replace('£', '').trim());
  return raw.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

const BIG = 'flex w-full min-h-[84px] items-center gap-4 rounded-xl border px-[18px] py-3.5 text-left';

/**
 * A Cycle to Work order handed over (till.mjs till-c2w-pay, till-c2w-extra;
 * openspec/changes/cycle-to-work task 7): the provider's certificate is the
 * first, one-tap way to pay, and anything it doesn't cover, from the counter
 * or a smaller certificate, is taken from the customer as a second payment.
 * One call records both, with the order's lines added by the server.
 */
export type C2wPayment = { orderId: number; checks: string[]; total: number; share: number; provider: string; customer: string; certificateNumber: string; bike: string; frameNumber: string | null };
const C2W_SUB = (provider: string) => `The certificate · owed by ${provider}, not in the drawer`;

/**
 * A workshop job's order (Jack, 18 Oct, docs/decisions/2026-10-18-till-job-payment.md):
 * paying converts the order, which charges its own saved lines, and then
 * `afterPaid` runs (recording the bike as collected), its note shown on Paid.
 */
type JobPayment = { orderId: number; total: number; receipt?: ReceiptJob; customer?: ReceiptCustomer | null; signedOffBy?: number | null; afterPaid: (reply: { jobWarning?: string }) => Promise<string | null> };

export function PayDialog({ lines, onClose, onNextSale, job, c2w: c2wNow, requestKey, onAnswerLost, onAnswerSettled }: { lines: TillLine[]; onClose: () => void; onNextSale: () => void; job?: JobPayment; c2w?: C2wPayment; requestKey: string; onAnswerLost?: () => void; onAnswerSettled?: () => void }) {
  const session = useSession();
  const me = session.status === 'signed-in' ? session.user.employee : null;
  const shopName = session.status === 'signed-in' ? session.shop.name : '';
  // The shop's address, phone and VAT number for the receipt (Shop details, 18 Oct).
  const shopDetails = useQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails & { name: string }>('/api/shop-details') });
  // The signed-in person's Don't close things by themselves (Your settings).
  const wait = Boolean(useYourSettings().data?.accessibility?.noAutoClose);
  // The person checked in at the till is serving (pins-and-checkin); before that, the sign-in's own.
  const checkedIn = useTillCheckin().data?.serving ?? null;
  const [serving, setServing] = useState<SessionEmployee | null>(checkedIn ? { ...checkedIn, isCashier: true } : me && me.isCashier ? me : null);
  const [step, setStep] = useState<Step>(serving ? { kind: 'methods' } : { kind: 'who' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A hand-over's figures are the server's amount due when the box opened, kept
  // as they were: once the order is Collected a refetch can't change what Paid
  // shows (review of pull request 7b).
  const [c2w] = useState(c2wNow);
  // A job's order is paid at the amount due, discounts taken off on the server.
  // A Cycle to Work order's total and share are the server's (POST hand-over/due).
  const total = job ? job.total : c2w ? c2w.total : saleTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const what = c2w ? `${possessive(c2w.customer)} Cycle to Work order` : items(count);
  const sub = serving ? `${serving.name} serving · ${what}` : what;
  // The provider's share as the server works it out (server/c2w/hand-over.js); the customer pays the rest.
  const share = c2w ? c2w.share : 0;
  const rest = c2w ? (pence(total) - pence(share)) / 100 : total;
  const c2wHow = c2w ? `Cycle to Work · ${c2w.provider}` : '';
  const howPaid = (cash: number, card: number, plain: string) => {
    if (!c2w) return plain;
    const parts = [cash > 0 ? 'cash' : null, card > 0 ? 'card' : null].filter(Boolean);
    return parts.length ? `${c2wHow} and ${parts.join(' and ')}` : c2wHow;
  };

  async function save(cash: number, card: number, tendered: number | null, how: string) {
    if (!serving) return;
    setSaving(true);
    setError(null);
    try {
      // To the penny: the screen rounds what staff type, so the record must too.
      const amounts = { cashAmount: pence(cash) / 100, cardAmount: pence(card) / 100, cashTendered: tendered === null ? null : pence(tendered) / 100, requestKey, cashierId: serving.id };
      let note: string | null = null;
      // Both reply with the whole sale, which is what the receipt prints.
      let sale: ReceiptSale & { jobWarning?: string };
      if (job) {
        // Who signed the work off, when paying finishes it (mechanic sign-off answer 5).
        // null when it didn't ask (the work read as finished), so the server can
        // warn if it was reopened in between (fresh review).
        const signOff = { signedOffBy: job.signedOffBy ?? null };
        sale = await apiMutate<ReceiptSale & { jobWarning?: string }>(`/api/sale-documents/${job.orderId}/convert`, { ...amounts, sellPastStock: true, ...signOff });
        note = await job.afterPaid(sale);
      } else if (c2w) {
        // The server adds the order's lines and the provider's payment, and checks the ticks.
        sale = await apiMutate<ReceiptSale>('/api/sales', { items: lines.map(asSaleItem), c2wOrderId: c2w.orderId, c2wChecks: c2w.checks, ...amounts, sellPastStock: true });
      } else sale = await apiMutate<ReceiptSale>('/api/sales', { items: lines.map(asSaleItem), ...amounts, sellPastStock: true });
      onAnswerSettled?.();
      setStep({ kind: 'paid', how: howPaid(cash, card, how), change: tendered === null ? 0 : (pence(tendered) - pence(cash)) / 100, note, sale: sale && Array.isArray(sale.items) ? sale : null, cash: pence(cash) / 100, card: pence(card) / 100 });
    } catch (err) {
      // No answer at all: the sale may be there, so the till keeps its key. A refusal
      // says nothing was recorded, unless it's a key already used, when a sale is. Busy
      // (which is 408 and 429 too: refused before the sale was looked at) and server
      // faults say neither, so they change nothing.
      if (!(err instanceof ApiError)) onAnswerLost?.();
      else if (err.status < 500 && err.code !== 'busy' && (err.body as { code?: string } | null)?.code !== 'reused_key') onAnswerSettled?.();
      // Busy: trying again can work, and gets the first sale if there was one, so it's
      // never a reason to reverse a card payment or take it twice (the review of 5 Nov).
      if (err instanceof ApiError && err.code === 'busy') setError(`Wheelhouse is busy just now, so this sale may not be recorded yet. Try again in a moment${card > 0 ? ': if the card machine took the payment, don’t take it again.' : '.'}`);
      // The key went on a sale with other details, as when the basket changed after a lost
      // answer. That sale stands, so nothing here says to reverse it; Clear gets out.
      else if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'reused_key') {
        const { saleId } = err.body as { saleId?: number };
        setError(`Sale ${saleId} is already recorded, with different details, so this one isn’t. If the card machine took a payment for this basket, check it against sale ${saleId}. Close this and press Clear to start a new sale.`);
      }
      // Already paid, as when an answer was lost and this was pressed again: the sale is
      // there, so reversing the card would refund a good sale (the re-check of 5 Nov).
      else if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'already_converted') setError(`This job is already paid: sale ${(err.body as { saleId?: number }).saleId} was recorded. Don’t take payment again. If the card machine took a second payment, reverse that one on the machine.`);
      // A job whose work can't be finished yet is refused before anything is taken.
      // The card machine may already have taken it: say so (fresh review).
      else if (job && err instanceof ApiError && err.code === 'illegal') setError(`The work isn’t finished, so this job can’t be paid yet. No sale was recorded${card > 0 ? ': if the card machine took the payment, reverse it on the machine.' : '.'}`);
      // A server fault says neither way, so the hand-over may have gone through. Most
      // roll the sale back, leaving the order Ready: pressing Card approved again sends
      // the same request key, without the card taken twice (risky-area review of 7b).
      else if (c2w && err instanceof ApiError && err.status >= 500) setError(`Something went wrong in Wheelhouse, so this sale may have saved. Check ${possessive(c2w.customer)} order before taking payment again${card > 0 ? ': if it’s Collected, don’t take the card payment again; if it’s still Ready to collect, press Card approved again without taking the card again.' : '.'}`);
      else if ((job || c2w) && err instanceof ApiError) setError(`${err.message.replace(/\.$/, '')}. No sale was recorded${card > 0 ? ': if the card machine took the payment, reverse it on the machine.' : '.'}`);
      else setError(err instanceof ApiError ? err.message : "Lost touch with the server, so the sale may have saved. Check the sale went through before taking payment again.");
    } finally {
      setSaving(false);
    }
  }

  const go = (s: Step) => { setError(null); setStep(s); };

  // Each step replaces the buttons, so move keyboard focus to the new title.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [step.kind]);
  // A browser can close the window anyway (Chrome lets a second Escape
  // through). Mid-save, a fresh window comes straight back instead, so a sale
  // the server is still recording can't vanish and be taken twice.
  const [reopened, setReopened] = useState(0);
  const close = () => {
    if (saving) return setReopened((n) => n + 1);
    return step.kind === 'paid' ? onNextSale() : onClose();
  };

  let title = `Take payment · ${money(total)}`;
  let description = sub;
  let body: ReactNode;
  let footer: ReactNode = null;

  if (step.kind === 'who') {
    title = 'Who’s serving?';
    description = 'Pick who is taking this sale.';
    body = <WhoIsServing onPick={(e) => { setServing(e); go({ kind: 'methods' }); }} />;
  } else if (step.kind === 'methods' && c2w) {
    // The certificate first; Card, Cash and Split take only what it leaves.
    const certificateOnly = pence(rest) === 0;
    body = (
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={saving} onClick={() => (certificateOnly ? save(0, 0, null, c2wHow) : go({ kind: 'extra' }))} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{`${c2wHow} · ${money(share)}`}</span>
            <span className="text-size-13 opacity-85">{`${C2W_SUB(c2w.provider)} · certificate ${c2w.certificateNumber}`}</span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Button className="min-h-14" disabled={certificateOnly} onClick={() => go({ kind: 'card', amount: rest, cashPart: 0 })}>Card</Button>
          <Button className="min-h-14" disabled={certificateOnly} onClick={() => go({ kind: 'cash' })}>Cash</Button>
          <Button className="min-h-14" disabled={certificateOnly} onClick={() => go({ kind: 'split' })}>Split</Button>
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">{`Anything the certificate doesn’t cover is taken from ${firstName(c2w.customer)} as a second payment.`}</p>
      </div>
    );
  } else if (step.kind === 'extra' && c2w) {
    const counter = lines.map((l) => l.name);
    body = (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col">
          <PaidRow label={c2wHow} amount={share} />
          <span className="pb-2 pl-6 text-size-13 text-[var(--wh-muted)]">{C2W_SUB(c2w.provider)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-[18px] py-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{`${firstName(c2w.customer)} pays`}</span>
            <span className="text-size-13 text-[var(--wh-muted)]">{counter.length ? `${counter.join(', ')}, added at the counter` : 'What the certificate doesn’t cover'}</span>
          </span>
          <span className="font-mono text-size-34">{money(rest)}</span>
        </div>
        <button type="button" onClick={() => go({ kind: 'card', amount: rest, cashPart: 0 })} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{`Card · ${money(rest)}`}</span>
            <span className="text-size-13 opacity-85">Key it into the card machine</span>
          </span>
        </button>
        <div className="grid grid-cols-3 gap-2.5">
          <Button className="min-h-14" onClick={() => go({ kind: 'cash' })}>Cash</Button>
        </div>
        <div><Button variant="ghost" onClick={() => go({ kind: 'methods' })}>Back</Button></div>
      </div>
    );
  } else if (step.kind === 'methods') {
    body = (
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={() => go({ kind: 'card', amount: total, cashPart: 0 })} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{`Card · ${money(total)}`}</span>
            <span className="text-size-13 opacity-85">Key it into the card machine</span>
          </span>
        </button>
        <button type="button" onClick={() => go({ kind: 'cash' })} className={`${BIG} border-[var(--wh-border)] bg-[var(--wh-panel)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">Cash</span>
            <span className="text-size-13 text-[var(--wh-muted)]">Enter what the customer hands you; the till works out the change</span>
          </span>
        </button>
        <Button className="min-h-14" onClick={() => go({ kind: 'split' })}>Split</Button>
      </div>
    );
  } else if (step.kind === 'card') {
    title = `Card · ${money(step.amount)}`;
    body = (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <span className="font-mono text-size-34">{money(step.amount)}</span>
        <p className="m-0 text-size-15 font-semibold">{`Key ${money(step.amount)} into the card machine.`}</p>
        <p className="m-0 text-sm text-[var(--wh-muted)]">When the machine says approved, press Card approved. If it’s declined, nothing was taken: go back and pay another way.</p>
      </div>
    );
    const cashPart = step.cashPart;
    footer = (
      <>
        <Button variant="ghost" disabled={saving} onClick={() => go(cashPart ? { kind: 'split' } : c2w ? { kind: 'extra' } : { kind: 'methods' })}>Back</Button>
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => save(cashPart, step.amount, cashPart ? cashPart : null, cashPart ? `Cash ${money(cashPart)} · Card ${money(step.amount)}` : `Card · ${money(step.amount)}`)}
        >
          Card approved
        </Button>
      </>
    );
  } else if (step.kind === 'cash') {
    title = `Cash · ${money(rest)} to pay`;
    description = 'Tap what the customer handed you, or type it';
    body = <CashStep total={rest} saving={saving} onBack={() => go({ kind: c2w ? 'extra' : 'methods' })} onTaken={(handed) => save(rest, 0, handed, `Cash · ${money(rest)}`)} />;
  } else if (step.kind === 'split') {
    title = `Split payment · ${money(rest)}`;
    description = 'Part in cash, the rest by card';
    body = <SplitStep total={rest} onBack={() => go({ kind: 'methods' })} onCard={(cashPart, left) => go({ kind: 'card', amount: left, cashPart })} />;
  } else if (step.kind === 'paid') {
    title = 'Paid';
    // As drawn (till-receipt-print): the sale's number after how it was paid.
    description = step.sale ? `${step.how} · Sale ${step.sale.id}` : step.how;
    const paidSale = step.sale;
    // Print, then the next sale, as No receipt (Jack, 18 Oct, till-receipt-print).
    // A reply that warns the job wasn't signed off names nobody (piece 3).
    const warned = Boolean((paidSale as { jobWarning?: string } | null)?.jobWarning);
    const receiptJob = job?.receipt && warned ? { ...job.receipt, checkedBy: null } : job?.receipt;
    // With Don't close things by themselves on, Print leaves Paid open (till-receipt-wait).
    const onPrint = paidSale ? () => { printReceipt({ sale: paidSale, shopName: shopDetails.data?.name ?? shopName, job: receiptJob, details: shopDetails.data }); if (!wait) onNextSale(); } : null;
    // A hand-over shows each payment and that the bike went with the customer (till-c2w-paid).
    let rows: PaidLine[] | undefined;
    let collected: string | null = null;
    if (c2w) {
      const name = firstName(c2w.customer);
      rows = [{ label: c2wHow, amount: share, sub: step.cash + step.card > 0 ? undefined : C2W_SUB(c2w.provider) }];
      if (step.cash > 0) rows.push({ label: `Cash · ${c2w.customer}`, amount: step.cash });
      if (step.card > 0) rows.push({ label: `Card · ${c2w.customer}`, amount: step.card });
      collected = `${c2w.bike} collected${c2w.frameNumber ? `, frame ${c2w.frameNumber}` : ''}, on ${possessive(name)} bike record. ${possessive(name)} order is now Collected${paidSale ? `, with sale ${paidSale.id} in its history` : ''}.`;
    }
    body = <PaidStep total={total} change={step.change} note={step.note} wait={wait} saleId={paidSale?.id ?? null} customer={job?.customer ?? null} rows={rows} collected={collected} onPrint={onPrint} onNextSale={onNextSale} />;
  }

  return (
    <Dialog
      key={reopened}
      open
      onOpenChange={(open) => { if (!open) close(); }}
      // While a payment is saving, Escape must not hide a sale the server is
      // still recording (fresh review of pull request 111, 4 Oct).
      onCancel={(event) => { if (saving) event.preventDefault(); }}
      dismissOnBackdrop={false} aria-labelledby="pay-title" aria-describedby="pay-sub">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="pay-title" ref={titleRef} tabIndex={-1} className="outline-none">{title}</DialogTitle>
          <DialogDescription id="pay-sub">{description}</DialogDescription>
        </div>
        {/* Drawn on till-pay, and the only way out on a till with no Escape key. */}
        <DialogClose onClick={close} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {body}
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      {footer ? <DialogFooter>{footer}</DialogFooter> : null}
    </Dialog>
  );
}

function WhoIsServing({ onPick }: { onPick: (e: SessionEmployee) => void }) {
  const staff = useQuery({ queryKey: ['employees', 'cashier'], queryFn: () => apiGet<Employee[]>('/api/employees?role=cashier') });
  const people = (staff.data ?? []).filter((e) => e.active);
  if (staff.isPending) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  if (staff.isError) return <p role="alert" className="m-0 text-sm">Couldn’t load the staff list. Try again.</p>;
  if (people.length === 0) return <p className="m-0 text-sm">Nobody is set up to take sales yet. The owner can add someone in Team.</p>;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {people.map((e) => (
        <Button key={e.id} className="min-h-14" onClick={() => onPick({ id: e.id, name: e.name, isCashier: true })}>{e.name}</Button>
      ))}
    </div>
  );
}

function CashStep({ total, saving, onBack, onTaken }: { total: number; saving: boolean; onBack: () => void; onTaken: (handed: number) => void }) {
  const [raw, setRaw] = useState('');
  const handed = parse(raw);
  const enough = handed !== null && pence(handed) >= pence(total);
  return (
    <>
      <div role="group" aria-label="Amount handed over" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {noteButtons(total).map((n) => {
          const on = handed !== null && pence(handed) === pence(n);
          return (
            <button key={n} type="button" aria-pressed={on} onClick={() => setRaw(n.toFixed(2))} className={`min-h-[60px] rounded-[10px] border font-mono text-lg ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>
              {money(n)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cash-handed" className="text-sm font-semibold">Or type the amount</label>
        <input id="cash-handed" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} className="min-h-11 w-40 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-mono" />
      </div>
      <div className="flex items-baseline justify-between rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4">
        <span className="text-lg font-bold">Change to give</span>
        <span className="font-mono text-size-34">{enough ? money((pence(handed) - pence(total)) / 100) : '—'}</span>
      </div>
      <div className="flex justify-between gap-2.5 border-t border-[var(--wh-border)] pt-3.5">
        <Button variant="ghost" disabled={saving} onClick={onBack}>Back</Button>
        <Button variant="primary" disabled={!enough || saving} onClick={() => handed !== null && onTaken(handed)}>Cash taken</Button>
      </div>
    </>
  );
}

function SplitStep({ total, onBack, onCard }: { total: number; onBack: () => void; onCard: (cashPart: number, rest: number) => void }) {
  const [raw, setRaw] = useState('');
  const cash = parse(raw);
  const ok = cash !== null && pence(cash) > 0 && pence(cash) < pence(total);
  const rest = ok ? (pence(total) - pence(cash)) / 100 : total;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="split-cash" className="text-sm font-semibold">Cash part</label>
        <input id="split-cash" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} aria-describedby="split-cash-hint" className="min-h-11 w-40 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-mono" />
        <span id="split-cash-hint" className="text-size-13 text-[var(--wh-muted)]">Take the cash first; the rest goes on the card.</span>
      </div>
      <div className="flex items-baseline justify-between rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-[18px] py-4">
        <span className="text-lg font-bold">Still to pay</span>
        <span className="font-mono text-size-34">{money(rest)}</span>
      </div>
      <button type="button" disabled={!ok} onClick={() => cash !== null && onCard(cash, rest)} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)] disabled:opacity-50`}>
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold">{`Card · ${money(rest)}`}</span>
          <span className="text-size-13 opacity-85">Key it into the card machine</span>
        </span>
      </button>
      <div><Button variant="ghost" onClick={onBack}>Back</Button></div>
    </>
  );
}

// Don't close things by themselves (Jack, 24 Oct answer 9; drawn as
// till-receipt-wait): no countdown, and Start next sale in No receipt's place.
// Email (till-receipt; openspec/changes/till-email-receipt): the countdown
// waits while its pop-up is open (2 Oct, leftover screens M1); once sent, the
// next sale starts, or with the setting on Paid stays and says so.
type PaidLine = { label: string; amount: number; sub?: string };
function PaidRow({ label, amount }: { label: string; amount: number }) {
  return (
    <span className="flex items-baseline justify-between gap-3 py-2">
      <span className="flex items-center gap-2 text-size-15 font-semibold"><span aria-hidden="true" className="text-[var(--wh-state-ready-ink)]">✓</span>{label}</span>
      <span className="font-mono text-base">{money(amount)}</span>
    </span>
  );
}

function PaidStep({ total, change, note, wait, saleId, customer, rows, collected, onPrint, onNextSale }: {
  total: number; change: number; note: string | null; wait: boolean; saleId: number | null; customer: ReceiptCustomer | null;
  rows?: PaidLine[]; collected?: string | null; onPrint: (() => void) | null; onNextSale: () => void;
}) {
  const [left, setLeft] = useState(5);
  const [emailing, setEmailing] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  // With a note to read, Paid waits for No receipt (as the job warning, 16 Oct).
  const counting = !note && !wait && !emailing;
  // Kept in a ref so a new callback from the page doesn't restart the count.
  const next = useRef(onNextSale);
  useEffect(() => { next.current = onNextSale; });
  useEffect(() => {
    if (!counting) return;
    if (left <= 0) { next.current(); return; }
    const t = setTimeout(() => setLeft((n) => n - 1), window.WH_TILL_TICK_MS ?? 1000);
    return () => clearTimeout(t);
  }, [left, counting]);
  return (
    <>
      {rows ? (
        <div className="flex flex-col">
          {rows.map((r) => (
            <span key={r.label} className="flex flex-col">
              <PaidRow label={r.label} amount={r.amount} />
              {r.sub ? <span className="pb-2 pl-6 text-size-13 text-[var(--wh-muted)]">{r.sub}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {collected ? <p role="status" className="m-0 rounded-lg bg-[var(--wh-state-ready-bg)] px-3.5 py-3 text-sm text-[var(--wh-state-ready-ink)]">{collected}</p> : null}
      {/* A hand-over's rows stand in for the tick and total; the change and any note still show (review of pull request 7b). */}
      <div className="flex flex-col items-center gap-2 text-center">
        {rows ? null : <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-full bg-[var(--wh-state-ready-bg)] text-3xl text-[var(--wh-state-ready-ink)]">✓</span>}
        {rows ? null : <span className="font-mono text-size-30">{money(total)}</span>}
        {change > 0 ? <span className="text-lg font-bold">{`Change to give ${money(change)}`}</span> : null}
        {note ? <span role="status" className="rounded-md bg-[var(--wh-warn-bg)] px-3 py-2 text-sm font-semibold text-[var(--wh-warn-ink)]">{note}</span> : null}
      </div>
      <div role="group" aria-label="Receipt" className="grid grid-cols-3 gap-2.5">
        <Button className="min-h-[60px]" disabled={!onPrint} onClick={() => onPrint?.()}>Print</Button>
        <Button className="min-h-[60px]" disabled={saleId === null} onClick={() => setEmailing(true)}>Email</Button>
        <Button variant="primary" className="min-h-[60px]" onClick={onNextSale}>{wait ? 'Start next sale' : 'No receipt'}</Button>
      </div>
      {rows && rows.length > 1 ? <p className="m-0 text-center text-size-13 text-[var(--wh-muted)]">The receipt shows both payments.</p> : null}
      {emailedTo ? <p role="status" className="m-0 text-center text-sm font-semibold">{`Receipt sent to ${emailedTo}.`}</p> : null}
      {emailing ? <p role="status" className="m-0 text-center text-sm text-[var(--wh-muted)]">Next sale waits until the receipt is sent</p> : null}
      {wait && !emailing ? <p role="status" className="m-0 text-center text-sm text-[var(--wh-muted)]">The next sale waits until you press Start next sale.</p> : null}
      {counting ? <p role="timer" className="m-0 text-center text-sm text-[var(--wh-muted)]">{`Next sale starts in ${left} second${left === 1 ? '' : 's'}`}</p> : null}
      {emailing && saleId !== null ? (
        <EmailReceiptDialog
          saleId={saleId} customer={customer}
          onClose={() => setEmailing(false)}
          onSent={(to) => {
            setEmailing(false);
            if (wait) setEmailedTo(to);
            else onNextSale();
          }}
        />
      ) : null}
    </>
  );
}
