import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ItemSearch, type Picked } from './item-search.tsx';

/**
 * The quote, in the job's work and parts (journey 4; quoteJobBoards in
 * docs/design/user-journeys/generator/diary.mjs, quote.mjs): build it line by
 * line (Needed or Optional, a reason for the customer), Send quote with a
 * minute to Undo, then Record their answer or Withdraw quote. Once answered,
 * approved lines are on the job's order and declined ones are struck through.
 * Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md (piece 2)
 */

type QuoteLine = {
  id: number; kind: 'labour' | 'part'; description: string; productId: number | null; quantity: number; unitAmount: number;
  decision: 'pending' | 'approved' | 'declined'; lineTotal: number; need: 'needed' | 'optional'; reason: string | null;
  decidedVia: string | null; decidedAt: string | null; decidedByName: string | null; addedToOrderAt: string | null;
};
type Quote = { id: number; revision: number; state: string; lines: QuoteLine[]; totals: { all: number; approved: number; pending: number; declined: number } };
type SendResult = { message: { status: 'sent' | 'failed' | 'not_sent'; reason?: string }; link: string };

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const ANSWERED = new Set(['approved', 'partly_approved', 'declined']);

const CHIP: Record<QuoteLine['decision'], [string, string]> = {
  pending: ['Awaiting approval', 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]'],
  approved: ['Approved', 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]'],
  declined: ['Declined', 'bg-[var(--wh-danger-bg)] text-[var(--wh-danger-hover)]'],
};

/** A line as the server takes it back (POST /api/workshop-jobs/:id/quotes). */
const asInput = (l: Pick<QuoteLine, 'kind' | 'description' | 'productId' | 'quantity' | 'unitAmount' | 'need' | 'reason'>) => ({
  kind: l.kind, description: l.description, productId: l.productId, quantity: l.quantity, unitAmount: l.unitAmount, need: l.need, reason: l.reason ?? '',
});

/** How long Send waits for an Undo (journey 4 decision 5); the tests shorten it. */
const sendDelay = () => (window as unknown as { WH_QUOTE_SEND_DELAY_MS?: number }).WH_QUOTE_SEND_DELAY_MS ?? 60_000;

export function QuotePanel({ job, orderTotal }: { job: WorkshopJob; orderTotal: number }) {
  const queryClient = useQueryClient();
  const current = job.quote ?? null;
  const quoteQuery = useQuery({
    queryKey: ['quote', current?.id],
    queryFn: () => apiGet<Quote>(`/api/quotes/${current?.id}`),
    enabled: Boolean(current),
  });
  const q = current && quoteQuery.data ? quoteQuery.data : null;
  const customer = job.customerName || 'the customer';
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['quote'] }),
    queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
    queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
    queryClient.invalidateQueries({ queryKey: ['sale-document'] }),
  ]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The draft's lines, or none: answered, withdrawn and superseded quotes are
  // finished with, so adding to the quote starts the next revision.
  const draftLines = q && q.state === 'draft' ? q.lines : [];
  const saveDraft = (lines: ReturnType<typeof asInput>[]) => act(() => apiMutate(`/api/workshop-jobs/${job.id}/quotes`, { lines }));

  async function addLine(p: Picked) {
    const line = p.type === 'service'
      ? { kind: 'labour' as const, description: p.service.name, productId: null, quantity: 1, unitAmount: p.service.price, need: 'needed' as const, reason: '' }
      : { kind: 'part' as const, description: p.product.name, productId: p.product.id, quantity: 1, unitAmount: p.product.price, need: 'needed' as const, reason: '' };
    if (await saveDraft([...draftLines.map(asInput), line])) setAdding(false);
  }

  function startSend() {
    if (!q) return;
    setSending(true);
    setSent(null);
    setError(null);
    timer.current = setTimeout(async () => {
      timer.current = null;
      setSending(false);
      await act(async () => setSent(await apiMutate<SendResult>(`/api/quotes/${q.id}/send`, {})));
    }, sendDelay());
  }
  function undoSend() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSending(false);
  }

  const inShop = job.custodyState === 'in_shop' && job.workState !== 'complete';
  const canAdd = inShop && (!q || q.state !== 'sent');
  const answered = q ? ANSWERED.has(q.state) : false;
  const shownLines = !q ? [] : answered ? q.lines.filter((l) => l.decision === 'declined') : q.state === 'draft' || q.state === 'sent' ? q.lines : [];
  const declinedNames = answered && q ? q.lines.filter((l) => l.decision === 'declined').map((l) => l.description) : [];

  return (
    <div className="flex flex-col gap-2">
      {canAdd ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>Add to quote</Button>
          <span className="text-xs text-[var(--wh-muted)]">For work the customer needs to agree to first.</span>
        </div>
      ) : null}
      {adding ? <ItemSearch id="quote-search" disabled={busy} onPick={addLine} /> : null}

      {shownLines.length ? (
        <div className="overflow-x-auto rounded-md border border-[var(--wh-border)]">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Quote</caption>
            <thead>
              <tr className="bg-[var(--wh-surface-muted)] text-left text-xs text-[var(--wh-muted)]">
                <th scope="col" className="px-3 py-2 font-semibold">Quoted work or part</th>
                <th scope="col" className="px-3 py-2 font-semibold">Reason for the customer</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                <th scope="col" className="px-3 py-2 font-semibold">Customer approval</th>
              </tr>
            </thead>
            <tbody>
              {shownLines.map((l) => {
                const draft = q?.state === 'draft';
                const struck = l.decision === 'declined';
                return (
                  <tr key={l.id} className={`border-t border-[var(--wh-border)] ${struck ? 'line-through' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span>{l.description}</span>
                        {draft ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={l.need === 'needed'}
                            aria-label={`${l.description}: ${l.need}`}
                            disabled={busy}
                            onClick={() => saveDraft(draftLines.map((x) => asInput(x.id === l.id ? { ...x, need: x.need === 'needed' ? 'optional' : 'needed' } : x)))}
                            className="inline-flex min-h-11 self-start items-center rounded-full border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-xs font-semibold no-underline"
                          >
                            {l.need === 'needed' ? 'Needed' : 'Optional'}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--wh-muted)] no-underline">{l.need === 'needed' ? 'Needed' : 'Optional'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {draft ? (
                        <input
                          aria-label={`Reason for ${l.description}`}
                          value={reasons[l.id] ?? l.reason ?? ''}
                          placeholder="Reason for the customer"
                          onChange={(e) => setReasons((r) => ({ ...r, [l.id]: e.target.value }))}
                          onBlur={() => {
                            const v = reasons[l.id];
                            if (v === undefined || v === (l.reason ?? '')) return;
                            void saveDraft(draftLines.map((x) => asInput(x.id === l.id ? { ...x, reason: v } : x)));
                          }}
                          className="min-h-9 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2"
                        />
                      ) : (l.reason ?? '')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.lineTotal)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold no-underline ${CHIP[l.decision][1]}`}>{CHIP[l.decision][0]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {q && (q.state === 'draft' || q.state === 'sent') && q.lines.length ? (
        <p className="m-0 text-right text-sm font-bold">{`Proposed total ${money(orderTotal + (q.state === 'draft' ? q.totals.all : q.totals.pending))}`}</p>
      ) : null}
      {answered ? (
        <div className="flex flex-col items-end gap-0.5">
          <p className="m-0 text-sm font-bold">{`Approved total ${money(orderTotal)}`}</p>
          {declinedNames.length ? (
            <p className="m-0 text-[13px] text-[var(--wh-muted)]">{`${declinedNames.join(', ')} declined. Anything beyond these lines needs a new approval.`}</p>
          ) : null}
        </div>
      ) : null}
      {q?.state === 'withdrawn' ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">The quote was withdrawn. Only the booked work stays agreed.</p> : null}

      {sending ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-[var(--wh-ink)] px-3 py-2 text-sm text-[var(--wh-bg)]">
          <span className="grow">{`Sending the quote to ${customer} by text in 1 minute.`}</span>
          <button type="button" onClick={undoSend} className="min-h-11 rounded-md px-3 font-semibold underline">Undo</button>
        </div>
      ) : null}
      {sent ? (
        sent.message.status === 'sent' ? (
          <p role="status" className="m-0 text-sm">{`Quote sent to ${customer} by text.`}</p>
        ) : (
          <div role="status" className="flex flex-col gap-1.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 py-2 text-sm">
            <span>{`The quote is ready for ${customer}, but no text went: ${sent.message.reason ?? ''}`}</span>
            <span className="text-[13px] break-all text-[var(--wh-muted)]">{sent.link}</span>
            <Button size="sm" className="self-start" onClick={() => { void navigator.clipboard?.writeText(sent.link).catch(() => undefined); }}>Copy link</Button>
          </div>
        )
      ) : null}
      {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {q?.state === 'draft' && q.lines.length && !sending ? (
          <Button variant="accent" size="sm" disabled={busy} onClick={startSend}>Send quote</Button>
        ) : null}
        {q?.state === 'sent' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => setWithdrawing(true)}>Withdraw quote</Button>
            <Button variant="accent" size="sm" disabled={busy} onClick={() => setRecording(true)}>Record their answer</Button>
          </>
        ) : null}
      </div>

      {recording && q ? (
        <RecordAnswer
          customer={customer}
          lines={q.lines}
          busy={busy}
          onClose={() => setRecording(false)}
          onSave={async (via, decisions) => {
            if (await act(() => apiMutate(`/api/quotes/${q.id}/answer`, { via, decisions }))) setRecording(false);
          }}
        />
      ) : null}
      {withdrawing && q ? (
        <Dialog open onOpenChange={(o) => { if (!o) setWithdrawing(false); }} aria-labelledby="withdraw-title">
          <DialogHeader><DialogTitle id="withdraw-title">Withdraw this quote?</DialogTitle></DialogHeader>
          <DialogBody><p className="m-0 text-sm">{`${customer}'s page will say the quote was withdrawn. Only the booked work stays agreed.`}</p></DialogBody>
          <DialogFooter>
            <Button onClick={() => setWithdrawing(false)}>Keep the quote</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              if (await act(() => apiMutate(`/api/quotes/${q.id}/withdraw`, {}))) setWithdrawing(false);
            }}>Withdraw</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </div>
  );
}

/** Record their answer (journey 4 decision 4): ticks start the way the mechanic recommended. */
function RecordAnswer({ customer, lines, busy, onClose, onSave }: {
  customer: string; lines: QuoteLine[]; busy: boolean; onClose: () => void;
  onSave: (via: 'phone' | 'in_shop', decisions: { lineId: number; decision: 'approved' | 'declined' }[]) => void;
}) {
  const [yes, setYes] = useState<Record<number, boolean>>(() => Object.fromEntries(lines.map((l) => [l.id, l.need === 'needed'])));
  const [via, setVia] = useState<'phone' | 'in_shop'>('phone');
  const yesCount = lines.filter((l) => yes[l.id]).length;
  const noCount = lines.length - yesCount;
  const plural = (n: number) => `${n} line${n === 1 ? '' : 's'}`;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="record-title">
      <DialogHeader><DialogTitle id="record-title">{`Record ${customer}'s answer`}</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <fieldset className="m-0 flex gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-semibold">How did they answer?</legend>
          {([['phone', 'By phone'], ['in_shop', 'In the shop']] as const).map(([v, label]) => (
            <label key={v} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="record-via" checked={via === v} onChange={() => setVia(v)} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1">
          {lines.map((l) => (
            <label key={l.id} className="flex min-h-11 items-center gap-2.5 text-sm">
              <input type="checkbox" aria-label={`Yes to ${l.description}`} checked={Boolean(yes[l.id])} onChange={(e) => setYes((y) => ({ ...y, [l.id]: e.target.checked }))} />
              <span className="grow">{l.description}</span>
              <span className="tabular-nums">{money(l.lineTotal)}</span>
            </label>
          ))}
        </div>
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">Answers are final. A change later needs a new quote.</p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => onSave(via, lines.map((l) => ({ lineId: l.id, decision: yes[l.id] ? 'approved' : 'declined' })))}>
          {`Save: yes to ${plural(yesCount)}, no thanks to ${noCount}`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
