import { useEffect, useId, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { dayLabel } from '@/screens/diary/rules.ts';
import { clock } from '@/screens/diary/when.ts';
import { NoteCoinCounter } from './note-coin-counter.tsx';
import { FloatCheck } from './float-check.tsx';
import { printPaper } from './receipt.tsx';

/**
 * Close the day (journey 16; cash-up decisions 2 to 6; drawn in
 * docs/design/user-journeys/generator/cashup.mjs as eod-count,
 * eod-count-result, eod-count-exact, eod-banking, eod-banking-none,
 * eod-paidout, eod-finish and eod-z). One page, its steps as sections that
 * fold, each finished step opening the next: count the cash blind, paid-outs
 * and banking, and the end-of-day report. The till-sent, needs-attention and
 * card-machine steps wait for what they stand on, and there is no till name
 * until tills have names (openspec/changes/close-the-day).
 */
type FloatStart = { pence: number; how: 'looked' | 'counted'; expectedPence: number; byName: string; at: string };
type PaidOut = { id: number; amountPence: number; reason: string; note: string; byName: string; at: string };
export type Close = {
  id: number; day: string; closedByName: string; closedAt: string; floatStart: FloatStart;
  cashPence: number; drawerCashPence: number; paidOutsPence: number; expectedPence: number; countedPence: number; differencePence: number; reason: string;
  floatPence: number; bankedPence: number; leftPence: number; topUpPence: number; takingsPence: number; cardPence: number; otherPence: number; onlinePence: number;
};
export type Day = {
  day: string; floatPence: number | null; floatStart: FloatStart | null; cashPence: number; paidOutsPence: number;
  expectedPence: number | null; paidOuts: PaidOut[]; entry: { show: boolean; closesAt: string | null }; close: Close | null;
};
export const CLOSE_DAY_QUERY = ['close-the-day'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';

/** "£2.10 short", "£3.00 over", or "£0.00". */
const difference = (pence: number) => (pence === 0 ? penceText(0) : `${penceText(Math.abs(pence))} ${pence < 0 ? 'short' : 'over'}`);
/** "looked right · Jo Taylor at 09:02", or "counted by Jo Taylor at 09:02" (the j10 line: only a count says "counted by"). */
const floatHow = (f: FloatStart) => {
  const short = f.how === 'counted' && f.pence < f.expectedPence ? `${penceText(f.expectedPence - f.pence)} short, ` : '';
  return f.how === 'looked' ? `looked right · ${f.byName} at ${clock(f.at)}` : `${short}counted by ${f.byName} at ${clock(f.at)}`;
};

export function CloseTheDayPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const queryClient = useQueryClient();
  const day = useQuery({ queryKey: CLOSE_DAY_QUERY, queryFn: () => apiGet<Day>('/api/close-the-day'), enabled: owner, retry: false });
  const [open, setOpen] = useState<number | null>(1);
  const [counted, setCounted] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [kept, setKept] = useState(false);
  const [bagged, setBagged] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [changed, setChanged] = useState<string | null>(null);

  if (session.status === 'signed-in' && !owner) return <p className="m-0 text-sm">Only the shop’s owner can close the day.</p>;
  const d = day.data;
  if (day.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the day. Try again in a moment.</p>;
  if (!d) return null;
  const close = d.close;
  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="m-0 text-size-22 font-bold md:text-size-26">Close the day</h2>
      <span className="text-sm text-[var(--wh-muted)]">{dayLabel(d.day)}</span>
    </div>
  );
  if (d.floatPence === null) {
    return (
      <Page>{head}<Note>Set the shop’s float in Settings › Front desk › End of day first: Close the day leaves it in the drawer and banks the rest.</Note></Page>
    );
  }
  const toggle = (n: number) => setOpen((o) => (o === n ? null : n));
  const float = d.floatPence;
  const expected = d.expectedPence;

  // The till's figures are read again once the count is done, so the
  // difference is against what the till expects now (review, 27 Oct).
  async function doneCounting(countedPence: number) {
    await day.refetch();
    setResult(countedPence);
    setReason('');
    setChanged(null);
  }

  async function closeDay(countedPence: number, expectedPence: number) {
    setSaving(true);
    setFailed(null);
    try {
      const why = reason.trim();
      // The expected figure shown goes too: if a sale or cash taken out changed it, the server says so.
      const { close: made } = await apiMutate<{ close: Close }>('/api/close-the-day', why ? { countedPence, expectedPence, reason: why } : { countedPence, expectedPence }, { method: 'POST' });
      queryClient.setQueryData<Day>(CLOSE_DAY_QUERY, (old) => (old ? { ...old, close: made, entry: { ...old.entry, show: false } } : old));
      setShowReport(true);
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined;
      // Closed already, by someone else: show that close.
      if (err instanceof ApiError && err.status === 409 && code === 'already_closed') {
        await queryClient.invalidateQueries({ queryKey: CLOSE_DAY_QUERY });
        setShowReport(true);
      // The figures changed while counting: show the new difference, to keep again.
      } else if (err instanceof ApiError && err.status === 409 && code === 'expected_changed') {
        await day.refetch();
        setChanged(err.message);
        setKept(false);
        setBagged(false);
        setOpen(1);
      } else setFailed(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  const reportButton = <div><Button onClick={() => setShowReport(true)}>Show the report</Button></div>;
  if (close) {
    return (
      <Page>
        {head}
        <Step n={1} title="Count the cash" tone="done" status="Counted" />
        <Step n={2} title="Paid-outs and banking" tone="done" status="Bagged" />
        <Step n={3} title="End-of-day report" tone="done" status="Closed" open={open !== null} onToggle={() => setOpen((o) => (o === null ? 3 : null))}>{reportButton}</Step>
        {showReport ? <Report close={close} onClose={() => setShowReport(false)} /> : null}
      </Page>
    );
  }

  const diff = result !== null && expected !== null ? result - expected : null;
  const countStatus = result === null ? 'To do' : diff === 0 ? 'Spot on' : 'Counted';
  return (
    <Page>
      {head}
      <Step n={1} title="Count the cash" tone={result !== null ? 'done' : 'todo'} status={countStatus} open={open === 1} onToggle={() => toggle(1)}>
        {result === null || expected === null || diff === null || d.floatStart === null ? (
          <>
            <Note>Count the drawer and fill in how many of each. The till shows what it expected once you’ve finished.</Note>
            <NoteCoinCounter onChange={setCounted} />
            <div className="flex justify-end">
              <Button variant="primary" disabled={counted === null || day.isFetching} onClick={() => { if (counted !== null) void doneCounting(counted); }}>Done counting — show the difference</Button>
            </div>
          </>
        ) : (
          <>
            {changed ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-warn-bg)] px-2 py-1 text-size-13 font-semibold text-[var(--wh-warn-ink)]">{changed}</p> : null}
            <div>
              <Row label="Counted" value={penceText(result)} first />
              <Row label="The till expected" value={penceText(expected)} />
            </div>
            <div role="group" aria-label="How the till worked out what it expected" className="flex flex-col rounded-lg bg-[var(--wh-surface-muted)] px-3.5 py-2">
              <span className="pb-1 text-sm font-bold">How the till worked it out</span>
              <SubRow label={`Float this morning · ${floatHow(d.floatStart)}`} value={penceText(d.floatStart.pence)} />
              <SubRow label="plus cash sales" value={penceText(d.cashPence)} />
              <SubRow label="minus cash taken out (paid-outs)" value={penceText(d.paidOutsPence)} />
            </div>
            {diff === 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--wh-ok-bg)] px-3.5 py-3 text-[var(--wh-status-complete-ink)]">
                <span className="inline-flex items-center gap-2 text-base font-bold"><Check size={18} aria-hidden="true" />Spot on</span>
                <span className="font-mono text-lg">{penceText(0)}</span>
              </div>
            ) : (
              <>
                <Row label="Difference" value={difference(diff)} strong />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">If there’s a difference, why? <span className="font-normal text-[var(--wh-muted)]">(optional)</span></span>
                  <input aria-label="Reason for the difference" placeholder="e.g. change given wrongly" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
                    className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm" />
                </div>
              </>
            )}
            <div className="flex justify-between gap-2.5">
              <Button variant="ghost" onClick={() => { setResult(null); setCounted(null); setKept(false); setBagged(false); setChanged(null); }}>Count again</Button>
              <Button variant="primary" onClick={() => { setKept(true); setChanged(null); setOpen(2); }}>Keep this count and go on</Button>
            </div>
          </>
        )}
      </Step>

      <Step n={2} title="Paid-outs and banking" tone={bagged ? 'done' : 'todo'} status={bagged ? 'Bagged' : 'To do'} open={open === 2} onToggle={() => toggle(2)}>
        <div className="flex flex-col">
          <span className="pb-1.5 text-sm font-bold">Cash taken out today</span>
          {d.paidOuts.length === 0 ? (
            <p className="m-0 border-t border-[var(--wh-border)] py-2.5 text-sm text-[var(--wh-muted)]">No cash taken out today.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {d.paidOuts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-t border-[var(--wh-border)] py-2.5">
                  <span className="flex grow flex-col gap-0.5">
                    <span className="text-size-15 font-semibold">{p.reason}</span>
                    <span className="text-size-13 text-[var(--wh-muted)]">{`${clock(p.at)} · ${p.byName}${p.note ? ` · ${p.note}` : ''}`}</span>
                  </span>
                  <span className="font-mono text-size-15">{penceText(p.amountPence)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-1.5"><Button onClick={() => setAdding(true)}>Add a paid-out</Button></div>
        </div>
        {result !== null ? (
          <div className="flex flex-col rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-4 pt-1.5 pb-2.5">
            <Row label="Leave in the drawer" value={penceText(float)} first big />
            <Row label="Bank" value={penceText(Math.max(0, result - float))} big />
          </div>
        ) : null}
        {/* Jack's answer 5 (27 Oct): a drawer below the float banks nothing and is made up to it. */}
        {result !== null && result < float ? (
          <p className="m-0 rounded-md bg-[var(--wh-warn-bg)] px-2 py-1 text-size-13 font-semibold text-[var(--wh-warn-ink)]">{`Put ${penceText(float - result)} in to make the float up to ${penceText(float)}`}</p>
        ) : null}
        <Note>The float is the shop’s standard amount, so tomorrow starts the same. Bag the rest for the bank.</Note>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!kept} onClick={() => { setBagged(true); setOpen(3); }}>Banking bagged — next step</Button>
        </div>
      </Step>

      <Step n={3} title="End-of-day report" tone="todo" status={kept && bagged ? 'Ready' : 'After the steps above'} open={open === 3} onToggle={() => toggle(3)}>
        {kept && bagged && result !== null ? (
          <>
            <Note>Everything above is done. Closing the day saves the report and starts tomorrow with the float.</Note>
            {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{failed}</p> : null}
            <div className="flex justify-end">
              <Button variant="primary" disabled={saving || expected === null} onClick={() => { if (expected !== null) void closeDay(result, expected); }}>Close the day and show the report</Button>
            </div>
          </>
        ) : (
          <Note>Count the cash and bag the banking first.</Note>
        )}
      </Step>

      {adding ? <PaidOutDialog name={session.status === 'signed-in' ? session.user.name : ''} onClose={() => setAdding(false)} /> : null}
      {/* The float is checked first, so the count starts from a real figure:
          Looks right only at closing (Jack's answer 8, 27 Oct). */}
      <FloatCheck atClose />
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3">{children}</div>;
}

const TONE = {
  done: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]',
  todo: 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]',
};

/** A step (cashup.mjs `step`): number, title and status; an open step shows its content. */
function Step({ n, title, tone, status, open = false, onToggle, children }: { n: number; title: string; tone: 'done' | 'todo'; status: string; open?: boolean; onToggle?: () => void; children?: ReactNode }) {
  const id = useId();
  const expandable = Boolean(children && onToggle);
  return (
    <div className="flex flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
      <button type="button" aria-expanded={expandable ? open : false} disabled={!expandable} onClick={onToggle}
        className="flex min-h-[60px] w-full items-center gap-3.5 px-[18px] py-2.5 text-left text-[var(--wh-ink)]">
        <span className={`inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-bold ${TONE[tone]}`}>
          {tone === 'done' ? <><Check size={16} aria-hidden="true" /><span className="sr-only">{n}</span></> : n}
        </span>
        <span id={`${id}-title`} className="grow text-size-17 font-bold">{title}</span>
        <span className={`text-right text-size-13 font-semibold ${tone === 'done' ? 'text-[var(--wh-status-complete-ink)]' : 'text-[var(--wh-muted)]'}`}>{status}</span>
        {expandable ? <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-[var(--wh-muted)] ${open ? 'rotate-180' : ''}`} /> : null}
      </button>
      {/* The open step's content, named by its title, so a screen reader can move to it. */}
      {open && children ? <div role="region" aria-labelledby={`${id}-title`} className="flex flex-col gap-3.5 border-t border-[var(--wh-border)] px-[18px] pt-3.5 pb-[18px]">{children}</div> : null}
    </div>
  );
}

function Row({ label, value, first = false, strong = false, big = false }: { label: string; value: string; first?: boolean; strong?: boolean; big?: boolean }) {
  return (
    <div data-row className={`flex items-baseline justify-between gap-3 py-2 ${first ? '' : 'border-t border-[var(--wh-border)]'}`}>
      <span className={`${big ? 'text-base font-bold' : 'text-size-15'} ${strong ? 'font-bold' : ''}`}>{label}</span>
      <span className={`font-mono ${strong || big ? 'text-xl' : 'text-size-15'}`}>{value}</span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm text-[var(--wh-muted)]">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{children}</p>;
}

/**
 * "Cash taken out" (eod-paidout): the amount, what it was for and an optional
 * note. Until Settings › Till › Reasons exists, what it was for is typed (the
 * drawing's "Other…"). There's no cash drawer to open from Wheelhouse yet.
 */
function PaidOutDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { document.getElementById('po-amount')?.focus(); }, []);
  async function take() {
    const parsed = parseTotal(amount);
    if (parsed === null || 'invalid' in parsed || parsed.pence < 1) { setError('Pounds and pence, like 5.00'); return; }
    if (!reason.trim()) { setError('Say what it was for.'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiMutate('/api/paid-outs', { amountPence: parsed.pence, reason: reason.trim(), note: note.trim() }, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: CLOSE_DAY_QUERY });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="po-title" aria-describedby="po-sub">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="po-title">Cash taken out</DialogTitle>
          <DialogDescription id="po-sub">From the drawer</DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Field id="po-amount" label="Amount" value={amount} onChange={setAmount} placeholder="£0.00" mono />
        <Field id="po-reason" label="What it was for" value={reason} onChange={setReason} maxLength={100} />
        <Field id="po-note" label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. a receipt number" maxLength={500} />
        <Note>{`Taken out by ${name}. It comes off the cash the till expects.`}</Note>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={() => void take()}>Take it out</Button>
      </DialogFooter>
    </Dialog>
  );
}

function Field({ id, label, value, onChange, placeholder, maxLength, mono = false }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} value={value} placeholder={placeholder} maxLength={maxLength} inputMode={mono ? 'decimal' : undefined} onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}

/** The report's rows (eod-z), on screen and on paper. */
function reportRows(c: Close): [string, string, string?][] {
  return [
    ['Takings', penceText(c.takingsPence)],
    ['Card', penceText(c.cardPence)],
    ['Cash', penceText(c.cashPence)],
    ['Gift cards, store credit, customer accounts, other', penceText(c.otherPence)],
    ['Float at the start', penceText(c.floatStart.pence), `${penceText(c.floatStart.pence)} · ${floatHow(c.floatStart)}`],
    ['Cash difference', difference(c.differencePence)],
    ['Banked', penceText(c.bankedPence)],
  ];
}
// Online money is beside the till's takings, not in them (walk-through 11 H2;
// Jack's answer 7). The drawing's "see Reports" waits for Reports.
const online = (c: Close) => `Online money is not in this till’s takings: ${penceText(c.onlinePence)} today`;

/** "Day closed" (eod-z): the end-of-day report, with Print. */
function Report({ close, onClose }: { close: Close; onClose: () => void }) {
  const sub = `${dayLabel(close.day)} · closed by ${close.closedByName}`;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="z-title" aria-describedby="z-sub" className="max-w-[560px]">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="z-title">Day closed</DialogTitle>
          <DialogDescription id="z-sub">{sub}</DialogDescription>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </DialogHeader>
      <DialogBody>
        <ul className="m-0 list-none p-0">
          {reportRows(close).map(([label, value, sub2], i) => (
            <li key={label} className={`flex items-baseline justify-between gap-3 py-2 ${i ? 'border-t border-[var(--wh-border)]' : ''}`}>
              <span className="flex flex-col gap-0.5">
                <span className={`text-size-15 ${i === 0 ? 'font-bold' : ''}`}>{label}</span>
                {sub2 ? <span className="text-size-13 text-[var(--wh-muted)]">{sub2}</span> : null}
              </span>
              <span className={`font-mono ${i === 0 ? 'text-xl' : 'text-size-15'}`}>{value}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 border-t border-[var(--wh-border)] pt-3 text-sm leading-normal">{online(close)}</p>
      </DialogBody>
      <DialogFooter>
        <span />
        <Button variant="primary" onClick={() => printPaper(<ReportPaper close={close} sub={sub} />)}>Print</Button>
      </DialogFooter>
    </Dialog>
  );
}

function ReportPaper({ close, sub }: { close: Close; sub: string }) {
  return (
    <div className="font-mono text-xs">
      <p className="m-0 font-bold">Day closed</p>
      <p className="m-0">{sub}</p>
      {reportRows(close).map(([label, value, sub2]) => (
        <div key={label}>
          <div className="flex justify-between gap-2"><span>{label}</span><span>{value}</span></div>
          {sub2 ? <div>{sub2}</div> : null}
        </div>
      ))}
      <p className="m-0">{online(close)}</p>
    </div>
  );
}
