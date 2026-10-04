import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession, type SessionEmployee } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { asSaleItem, money, noteButtons, pence, saleTotal, type TillLine } from './rules.ts';

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
  | { kind: 'paid'; how: string; change: number };

declare global {
  interface Window { WH_TILL_TICK_MS?: number }
}

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
const parse = (raw: string) => {
  const n = Number(raw.replace('£', '').trim());
  return raw.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

const BIG = 'flex w-full min-h-[84px] items-center gap-4 rounded-xl border px-[18px] py-3.5 text-left';

export function PayDialog({ lines, onClose, onNextSale }: { lines: TillLine[]; onClose: () => void; onNextSale: () => void }) {
  const session = useSession();
  const me = session.status === 'signed-in' ? session.user.employee : null;
  const [serving, setServing] = useState<SessionEmployee | null>(me && me.isCashier ? me : null);
  const [step, setStep] = useState<Step>(serving ? { kind: 'methods' } : { kind: 'who' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = saleTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const sub = serving ? `${serving.name} serving · ${items(count)}` : items(count);

  async function save(cash: number, card: number, tendered: number | null, how: string) {
    if (!serving) return;
    setSaving(true);
    setError(null);
    try {
      await apiMutate('/api/sales', {
        items: lines.map(asSaleItem),
        // To the penny: the screen rounds what staff type, so the record must too.
        cashAmount: pence(cash) / 100,
        cardAmount: pence(card) / 100,
        cashTendered: tendered === null ? null : pence(tendered) / 100,
        cashierId: serving.id,
        sellPastStock: true,
      });
      setStep({ kind: 'paid', how, change: tendered === null ? 0 : (pence(tendered) - pence(cash)) / 100 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lost touch with the server, so the sale may have saved. Check the sale went through before taking payment again.");
    } finally {
      setSaving(false);
    }
  }

  const go = (s: Step) => { setError(null); setStep(s); };

  // Each step replaces the buttons, so move keyboard focus to the new title.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [step.kind]);
  const close = () => (step.kind === 'paid' ? onNextSale() : onClose());

  let title = `Take payment · ${money(total)}`;
  let description = sub;
  let body: ReactNode;
  let footer: ReactNode = null;

  if (step.kind === 'who') {
    title = 'Who’s serving?';
    description = 'Pick who is taking this sale.';
    body = <WhoIsServing onPick={(e) => { setServing(e); go({ kind: 'methods' }); }} />;
  } else if (step.kind === 'methods') {
    body = (
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={() => go({ kind: 'card', amount: total, cashPart: 0 })} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{`Card · ${money(total)}`}</span>
            <span className="text-[13px] opacity-85">Key it into the card machine</span>
          </span>
        </button>
        <button type="button" onClick={() => go({ kind: 'cash' })} className={`${BIG} border-[var(--wh-border)] bg-[var(--wh-panel)]`}>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">Cash</span>
            <span className="text-[13px] text-[var(--wh-muted)]">Enter what the customer hands you; the till works out the change</span>
          </span>
        </button>
        <Button className="min-h-14" onClick={() => go({ kind: 'split' })}>Split</Button>
      </div>
    );
  } else if (step.kind === 'card') {
    title = `Card · ${money(step.amount)}`;
    body = (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <span className="font-mono text-[34px]">{money(step.amount)}</span>
        <p className="m-0 text-[15px] font-semibold">{`Key ${money(step.amount)} into the card machine.`}</p>
        <p className="m-0 text-sm text-[var(--wh-muted)]">When the machine says approved, press Card approved. If it’s declined, nothing was taken: go back and pay another way.</p>
      </div>
    );
    const cashPart = step.cashPart;
    footer = (
      <>
        <Button variant="ghost" disabled={saving} onClick={() => go(cashPart ? { kind: 'split' } : { kind: 'methods' })}>Back</Button>
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
    title = `Cash · ${money(total)} to pay`;
    description = 'Tap what the customer handed you, or type it';
    body = <CashStep total={total} saving={saving} onBack={() => go({ kind: 'methods' })} onTaken={(handed) => save(total, 0, handed, `Cash · ${money(total)}`)} />;
  } else if (step.kind === 'split') {
    title = `Split payment · ${money(total)}`;
    description = 'Part in cash, the rest by card';
    body = <SplitStep total={total} onBack={() => go({ kind: 'methods' })} onCard={(cashPart, rest) => go({ kind: 'card', amount: rest, cashPart })} />;
  } else {
    title = 'Paid';
    description = step.how;
    body = <PaidStep total={total} change={step.change} onNextSale={onNextSale} />;
  }

  return (
    <Dialog
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
        <span className="font-mono text-[34px]">{enough ? money((pence(handed) - pence(total)) / 100) : '—'}</span>
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
        <span id="split-cash-hint" className="text-[13px] text-[var(--wh-muted)]">Take the cash first; the rest goes on the card.</span>
      </div>
      <div className="flex items-baseline justify-between rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-[18px] py-4">
        <span className="text-lg font-bold">Still to pay</span>
        <span className="font-mono text-[34px]">{money(rest)}</span>
      </div>
      <button type="button" disabled={!ok} onClick={() => cash !== null && onCard(cash, rest)} className={`${BIG} border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)] disabled:opacity-50`}>
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold">{`Card · ${money(rest)}`}</span>
          <span className="text-[13px] opacity-85">Key it into the card machine</span>
        </span>
      </button>
      <div><Button variant="ghost" onClick={onBack}>Back</Button></div>
    </>
  );
}

function PaidStep({ total, change, onNextSale }: { total: number; change: number; onNextSale: () => void }) {
  const [left, setLeft] = useState(5);
  // Kept in a ref so a new callback from the page doesn't restart the count.
  const next = useRef(onNextSale);
  useEffect(() => { next.current = onNextSale; });
  useEffect(() => {
    if (left <= 0) { next.current(); return; }
    const t = setTimeout(() => setLeft((n) => n - 1), window.WH_TILL_TICK_MS ?? 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-full bg-[var(--wh-state-ready-bg)] text-3xl text-[var(--wh-state-ready-ink)]">✓</span>
        <span className="font-mono text-[30px]">{money(total)}</span>
        {change > 0 ? <span className="text-lg font-bold">{`Change to give ${money(change)}`}</span> : null}
      </div>
      <Button variant="primary" className="min-h-[60px]" onClick={onNextSale}>No receipt</Button>
      <p role="timer" className="m-0 text-center text-sm text-[var(--wh-muted)]">{`Next sale starts in ${left} second${left === 1 ? '' : 's'}`}</p>
    </>
  );
}
