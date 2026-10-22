import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, TriangleAlert } from 'lucide-react';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ItemSearch, type Picked } from './item-search.tsx';
import { refusalText } from './refusal-words.ts';
import { channelWord } from './channel-word.ts';
import { MAX_BYTES, TOO_LARGE, readBase64 } from './job-files.tsx';

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
  goesWithLineId?: number | null; without?: string | null; photoId?: number | null;
};
type Quote = {
  id: number; revision: number; state: string; lines: QuoteLine[]; totals: { all: number; approved: number; pending: number; declined: number };
  // The customer's spending limit and the whole bill with this quote (Workshop day 41-43).
  limit?: { spendLimit: number | null; wholeBill: number };
};
type SendResult = { message: { status: 'sent' | 'failed' | 'not_sent'; reason?: string; channel?: string }; link: string };

const money = (n: number) => `£${Number(n).toFixed(2)}`;
// "Mon 5 Oct, 10:15" in London's time, as the customer's page says it.
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
const when = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' })}, ${part(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
const ANSWERED = new Set(['approved', 'partly_approved', 'declined']);

const CHIP: Record<QuoteLine['decision'], [string, string]> = {
  pending: ['Awaiting approval', 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]'],
  approved: ['Approved', 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]'],
  declined: ['Declined', 'bg-[var(--wh-danger-bg)] text-[var(--wh-danger-hover)]'],
};

type DraftLine = Pick<QuoteLine, 'kind' | 'description' | 'productId' | 'quantity' | 'unitAmount' | 'need' | 'reason'>
  & Partial<Pick<QuoteLine, 'id' | 'goesWithLineId' | 'without' | 'photoId'>>;

/**
 * The lines as the server takes them back (POST /api/workshop-jobs/:id/quotes).
 * A pair is named by the part's place in the list, as every save gives the
 * lines new ids (openspec quote-goes-with).
 */
const asInputs = (lines: DraftLine[]) => lines.map((l) => {
  const partner = l.goesWithLineId ? lines.findIndex((o) => o.id === l.goesWithLineId) : -1;
  return {
    kind: l.kind, description: l.description, productId: l.productId, quantity: l.quantity, unitAmount: l.unitAmount, need: l.need, reason: l.reason ?? '',
    ...(partner >= 0 ? { goesWith: partner } : {}),
    ...(l.without ? { without: l.without } : {}),
    ...(l.photoId ? { photoId: l.photoId } : {}),
  };
});

/** A line's group: a part and every labour line that goes with it, or the line alone. */
function groupOf(lines: QuoteLine[], l: QuoteLine) {
  const part = l.goesWithLineId ?? (lines.some((o) => o.goesWithLineId === l.id) ? l.id : null);
  return part === null ? [l] : lines.filter((o) => o.id === part || o.goesWithLineId === part);
}
const partnersOf = (lines: QuoteLine[], l: QuoteLine) => groupOf(lines, l).filter((o) => o.id !== l.id);

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
  // The job page's customer strip has already read the customer (job-dialog.tsx).
  const contact = useQuery({
    queryKey: ['customer', job.customerId],
    queryFn: () => apiGet<{ phone: string | null }>(`/api/customers/${job.customerId}`),
    enabled: Boolean(job.customerId),
  });
  const customer = job.customerName || 'the customer';
  // The dialogs call the customer by first name, as drawn ("Record Maya’s answer").
  const first = job.customerName?.trim().split(/\s+/)[0] || 'the customer';
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [recording, setRecording] = useState(false);
  // Save and tell (within the customer's limit): the same minute's Undo as Send quote.
  const [telling, setTelling] = useState(false);
  const [told, setTold] = useState<SendResult['message'] | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [withouts, setWithouts] = useState<Record<number, string>>({});
  // The draft line whose photo is open larger, by its place in the draft:
  // a save gives every line a new id (fresh review).
  const [viewingAt, setViewingAt] = useState<number | null>(null);
  const fileUrl = (id: number) => `/api/workshop-jobs/${job.id}/attachments/${id}`;
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
      setError(refusalText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The draft's lines, or none: answered, withdrawn and superseded quotes are
  // finished with, so adding to the quote starts the next revision.
  const draftLines = q && q.state === 'draft' ? q.lines : [];
  const saveDraft = (lines: DraftLine[]) => act(() => apiMutate(`/api/workshop-jobs/${job.id}/quotes`, { lines: asInputs(lines) }));
  const parts = draftLines.filter((x) => x.kind === 'part');
  const viewing = viewingAt === null ? null : draftLines[viewingAt] ?? null;

  // A line's photo (Jack, 1 Oct; one per line, as drawn) is one of the job's
  // files: it goes to Files and photos first, then onto the line.
  async function setPhoto(l: QuoteLine, file: File | undefined) {
    if (!file) return false;
    if (file.size > MAX_BYTES) { setError(TOO_LARGE); return false; }
    return act(async () => {
      const dataBase64 = await readBase64(file);
      const added = await apiMutate<{ id: number }>(`/api/workshop-jobs/${job.id}/attachments`,
        { filename: file.name, contentType: file.type || 'application/octet-stream', dataBase64 }, { method: 'POST' });
      // The draft as it is now, not as it was when the upload began: a reason
      // saved meanwhile stays (fresh review). Lines are matched by place, as a
      // save gives them new ids.
      const at = draftLines.findIndex((x) => x.id === l.id);
      const latest = q ? (await apiGet<Quote>(`/api/quotes/${q.id}`)).lines : draftLines;
      await apiMutate(`/api/workshop-jobs/${job.id}/quotes`, { lines: asInputs(latest.map((x, i) => (i === at ? { ...x, photoId: added.id } : x))) });
      await queryClient.invalidateQueries({ queryKey: ['workshop-job-files', job.id] });
    });
  }

  async function addLine(p: Picked) {
    const line = p.type === 'service'
      ? { kind: 'labour' as const, description: p.service.name, productId: null, quantity: 1, unitAmount: p.service.price, need: 'needed' as const, reason: '' }
      : { kind: 'part' as const, description: p.product.name, productId: p.product.id, quantity: 1, unitAmount: p.product.price, need: 'needed' as const, reason: '' };
    if (await saveDraft([...draftLines, line])) setAdding(false);
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
  function startTell() {
    if (!q) return;
    setTelling(true);
    setTold(null);
    setError(null);
    timer.current = setTimeout(async () => {
      timer.current = null;
      setTelling(false);
      const done = await act(async () => setTold((await apiMutate<{ message: SendResult['message'] }>(`/api/quotes/${q.id}/within-limit`, {})).message));
      // Refused (the bill moved over the limit meanwhile): read the quote again,
      // so the panel offers Send quote (fresh review).
      if (!done) await refresh();
    }, sendDelay());
  }
  function undoTell() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setTelling(false);
  }
  function undoSend() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSending(false);
  }

  const inShop = job.custodyState === 'in_shop' && job.workState !== 'complete';
  // Within the customer's limit, no quote goes (dq-job-within).
  const limit = q?.state === 'draft' && q.lines.length ? q.limit : undefined;
  const within = Boolean(limit && limit.spendLimit !== null && limit.wholeBill <= limit.spendLimit);
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
                            onClick={() => saveDraft(draftLines.map((x) => (x.id === l.id ? { ...x, need: x.need === 'needed' ? 'optional' : 'needed' } : x)))}
                            className="inline-flex min-h-11 self-start items-center rounded-full border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-xs font-semibold no-underline"
                          >
                            {l.need === 'needed' ? 'Needed' : 'Optional'}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--wh-muted)] no-underline">{l.need === 'needed' ? 'Needed' : 'Optional'}</span>
                        )}
                        {/* The drawn photo button (dq-job-quote): only while the quote is a draft. */}
                        {draft && l.photoId ? (
                          <button type="button" disabled={busy} onClick={() => setViewingAt(draftLines.findIndex((x) => x.id === l.id))}
                            className="inline-flex min-h-11 self-start items-center gap-1 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 text-xs font-semibold no-underline">
                            <Camera size={13} aria-hidden="true" />
                            <span className="sr-only">{`1 photo — view or add for ${l.description}`}</span>
                            <span aria-hidden="true">1 photo</span>
                          </button>
                        ) : draft ? (
                          <label className="inline-flex min-h-11 cursor-pointer self-start items-center gap-1 rounded-md border border-dashed border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 text-xs font-semibold no-underline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]">
                            <Camera size={13} aria-hidden="true" />
                            <span aria-hidden="true">Add photo</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
                              aria-label={`Add photo for ${l.description}`} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void setPhoto(l, f); }} />
                          </label>
                        ) : null}
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
                            void saveDraft(draftLines.map((x) => (x.id === l.id ? { ...x, reason: v } : x)));
                          }}
                          className="min-h-9 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2"
                        />
                      ) : (l.reason ?? '')}
                      {/* What happens without it (decision 7, H1): the mechanic's words for a Needed line. */}
                      {draft && l.need === 'needed' ? (
                        <input
                          aria-label={`What happens without ${l.description}`}
                          value={withouts[l.id] ?? l.without ?? ''}
                          placeholder="What happens without it"
                          maxLength={300}
                          onChange={(e) => setWithouts((w) => ({ ...w, [l.id]: e.target.value }))}
                          onBlur={() => {
                            const v = withouts[l.id];
                            if (v === undefined || v === (l.without ?? '')) return;
                            void saveDraft(draftLines.map((x) => (x.id === l.id ? { ...x, without: v } : x)));
                          }}
                          className="mt-1 min-h-9 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2"
                        />
                      ) : null}
                      {/* Goes with (decision 7, M2): a labour line and one of the quote's parts. */}
                      {draft && l.kind === 'labour' && parts.length ? (
                        <label className="mt-1 inline-flex items-center gap-1 text-xs no-underline">
                          Goes with
                          <select
                            aria-label={`${l.description} goes with`}
                            value={l.goesWithLineId ? String(l.goesWithLineId) : ''}
                            disabled={busy}
                            onChange={(e) => void saveDraft(draftLines.map((x) => (x.id === l.id ? { ...x, goesWithLineId: e.target.value ? Number(e.target.value) : null } : x)))}
                            className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-1.5 text-xs"
                          >
                            <option value="">Nothing</option>
                            {parts.map((p) => <option key={p.id} value={String(p.id)}>{p.description}</option>)}
                          </select>
                        </label>
                      ) : null}
                      {!draft && l.goesWithLineId ? (
                        <span className="block text-xs text-[var(--wh-muted)] no-underline">{`Goes with ${q?.lines.find((x) => x.id === l.goesWithLineId)?.description ?? ''}`}</span>
                      ) : null}
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
        <p className="m-0 text-right text-sm font-bold">
          {/* The whole bill the limit is checked against, booked work included (fresh review). */}
          {`Proposed total ${money(q.state === 'draft' && q.limit ? q.limit.wholeBill : orderTotal + (q.state === 'draft' ? q.totals.all : q.totals.pending))}`}
        </p>
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

      {limit ? (
        <p className="m-0 text-right text-[13px] text-[var(--wh-muted)]">
          {within && limit.spendLimit !== null ? `Within ${first}’s £${limit.spendLimit.toLocaleString('en-GB')} limit — no quote needed. ${first} will be told what was added.`
            : 'Quotes are sent when the customer asked to be called first, or the total is over their limit.'}
        </p>
      ) : null}
      {telling ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-[var(--wh-ink)] px-3 py-2 text-sm text-[var(--wh-bg)]">
          <span className="grow">{`Adding the work and telling ${first} by text in 1 minute.`}</span>
          <button type="button" onClick={undoTell} className="min-h-11 rounded-md px-3 font-semibold underline">Undo</button>
        </div>
      ) : null}
      {told ? (
        <p role="status" className="m-0 text-sm">
          {told.status === 'sent' ? `Added, and ${first} was told by ${channelWord(told.channel)}.` : `Added, but no message went: ${told.reason ?? ''}`}
        </p>
      ) : null}
      {sending ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-[var(--wh-ink)] px-3 py-2 text-sm text-[var(--wh-bg)]">
          <span className="grow">{`Sending the quote to ${customer} by text in 1 minute.`}</span>
          <button type="button" onClick={undoSend} className="min-h-11 rounded-md px-3 font-semibold underline">Undo</button>
        </div>
      ) : null}
      {sent ? (
        sent.message.status === 'sent' ? (
          <p role="status" className="m-0 text-sm">{`Quote sent to ${customer} by ${channelWord(sent.message.channel)}.`}</p>
        ) : (
          <div role="status" className="flex flex-col gap-1.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 py-2 text-sm">
            <span>{`The quote is ready for ${customer}, but no text went: ${sent.message.reason ?? ''}`}</span>
            <span className="text-[13px] break-all text-[var(--wh-muted)]">{sent.link}</span>
            <Button size="sm" className="self-start" onClick={() => { void navigator.clipboard?.writeText(sent.link).catch(() => undefined); }}>Copy link</Button>
          </div>
        )
      ) : null}
      {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}

      {/* Still nothing after the one reminder: the Today line (dq-today-no-answer), on the job's page too. */}
      {q?.state === 'sent' && job.quote?.reminderSentAt ? (
        <div role="note" className="flex gap-2.5 rounded-md bg-[var(--wh-warn-bg)] px-3 py-2 text-sm text-[var(--wh-warn-ink)]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col gap-0.5">
            <strong>No answer to the quote yet</strong>
            <span>
              {[job.quote.sentAt ? `Sent ${when(job.quote.sentAt)}` : null, `reminder sent ${when(job.quote.reminderSentAt)}`].filter(Boolean).join(' · ')}
              {contact.data?.phone ? <>{' · '}<a href={`tel:${contact.data.phone.replace(/\s+/g, '')}`} className="font-semibold whitespace-nowrap text-inherit">{contact.data.phone}</a></> : null}
            </span>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {q?.state === 'draft' && q.lines.length && !sending && !telling ? (
          within
            ? <Button variant="accent" size="sm" disabled={busy} onClick={startTell}>{`Save and tell ${first}`}</Button>
            : <Button variant="accent" size="sm" disabled={busy} onClick={startSend}>Send quote</Button>
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
          customer={first}
          reference={job.reference}
          lines={q.lines}
          busy={busy}
          onClose={() => setRecording(false)}
          onSave={async (via, decisions) => {
            if (await act(() => apiMutate(`/api/quotes/${q.id}/answer`, { via, decisions }))) setRecording(false);
          }}
        />
      ) : null}
      {viewing && viewing.photoId ? (
        <Dialog open onOpenChange={(o) => { if (!o) setViewingAt(null); }} aria-labelledby="line-photo-title" className="md:max-w-[720px]">
          <DialogHeader>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle id="line-photo-title">{viewing.description}</DialogTitle>
              {viewing.reason ? <span className="text-[13px] text-[var(--wh-muted)]">{viewing.reason}</span> : null}
            </div>
          </DialogHeader>
          <DialogBody><img src={fileUrl(viewing.photoId)} alt={viewing.description} className="max-h-[70vh] w-full object-contain" /></DialogBody>
          <DialogFooter className="flex flex-wrap justify-end gap-2.5">
            <Button disabled={busy} onClick={async () => {
              if (await saveDraft(draftLines.map((x) => (x.id === viewing.id ? { ...x, photoId: null } : x)))) setViewingAt(null);
            }}>Remove from line</Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]">
              Replace photo
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} aria-label="Replace photo"
                onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (await setPhoto(viewing, f)) setViewingAt(null); }} />
            </label>
            <Button variant="accent" onClick={() => setViewingAt(null)}>Close</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
      {withdrawing && q ? (
        <Dialog open onOpenChange={(o) => { if (!o) setWithdrawing(false); }} aria-labelledby="withdraw-title">
          <DialogHeader>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle id="withdraw-title">Withdraw this quote?</DialogTitle>
              <span className="text-[13px] text-[var(--wh-muted)]">{[job.reference, job.customerName].filter(Boolean).join(' · ')}</span>
            </div>
          </DialogHeader>
          <DialogBody><p className="m-0 text-sm">{`${first}’s page will say the quote was withdrawn and there’s nothing to answer. Only the booked work stays agreed.`}</p></DialogBody>
          <DialogFooter>
            <Button onClick={() => setWithdrawing(false)}>Keep the quote</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              if (await act(() => apiMutate(`/api/quotes/${q.id}/withdraw`, {}))) setWithdrawing(false);
            }}>Withdraw quote</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </div>
  );
}

/** Record their answer (journey 4 decision 4): ticks start the way the mechanic recommended. */
function RecordAnswer({ customer, reference, lines, busy, onClose, onSave }: {
  customer: string; reference: string | null; lines: QuoteLine[]; busy: boolean; onClose: () => void;
  onSave: (via: 'phone' | 'in_shop', decisions: { lineId: number; decision: 'approved' | 'declined' }[]) => void;
}) {
  const [yes, setYes] = useState<Record<number, boolean>>(() => Object.fromEntries(lines.map((l) => [l.id, groupOf(lines, l).some((o) => o.need === 'needed')])));
  const [via, setVia] = useState<'phone' | 'in_shop'>('phone');
  const yesCount = lines.filter((l) => yes[l.id]).length;
  const noCount = lines.length - yesCount;
  const plural = (n: number) => `${n} line${n === 1 ? '' : 's'}`;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="record-title">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="record-title">{`Record ${customer}’s answer`}</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{`Quote${reference ? ` for ${reference}` : ''} · answered ${via === 'phone' ? 'by phone' : 'in the shop'}`}</span>
        </div>
      </DialogHeader>
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
        <p className="m-0 text-sm">{`Tick what ${customer} agreed to ${via === 'phone' ? 'on the phone' : 'in the shop'}. These answers are final once saved, as if answered online.`}</p>
        <div className="flex flex-col gap-1">
          {lines.map((l) => (
            <label key={l.id} className="flex min-h-11 items-center gap-2.5 text-sm">
              <input type="checkbox" aria-label={`Yes to ${l.description}`} checked={Boolean(yes[l.id])}
                onChange={(e) => { const on = e.target.checked; setYes((y) => ({ ...y, [l.id]: on, ...Object.fromEntries(partnersOf(lines, l).map((o) => [o.id, on])) })); }} />
              <span className="grow">{l.description}</span>
              <span className="tabular-nums">{money(l.lineTotal)}</span>
            </label>
          ))}
        </div>
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
