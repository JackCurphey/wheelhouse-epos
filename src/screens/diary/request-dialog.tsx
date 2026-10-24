import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { STATE_LABEL, dayLabel, shortDay, todayIso, type DiaryState, type WaitingItem } from './rules.ts';
import { requestMinutes } from './offer-dialog.tsx';
import { Pill } from './change-details-dialog.tsx';
import { noMessageNote, type BookingMessageReply } from './no-message.ts';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { pounds } from '@/screens/book/money.ts';

/**
 * Answering what's waiting (journey 12 decisions 15 and 19): the request
 * pop-ups drawn as request-new, request-decline, request-change and
 * request-cancel in docs/design/user-journeys/generator/diary.mjs. Each
 * answer goes to the server's existing route with the version this pop-up
 * saw, so an answer to a job someone else has just changed is refused.
 *
 * "Offer another time" (Jack, 20 Oct) hands the request to the diary's pick
 * mode (onOffer); Decline asks for a message to the customer (Jack, 20 Oct).
 * Accept takes the mechanic picked in the request's pills (decision 62). A change request's "Open full job" opens the job page (layout review 238, item 8).
 */

const CHIP: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  offered: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  answer: 'bg-[var(--wh-state-answer-bg)] text-[var(--wh-state-answer-ink)]',
  hold: 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  waiting: 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  ready: 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  cancelled: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

function Badge({ state }: { state: DiaryState }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${CHIP[state]}`}>{STATE_LABEL[state]}</span>;
}

type Slot = { jobDate?: string | null; startTime?: string | null; endTime?: string | null };
const at = (s?: Slot) => (s?.jobDate ? `${shortDay(s.jobDate)}${s.startTime ? ` · ${s.startTime}` : ''}` : '');
// A change request's From and To name the mechanic too: accepting moves the
// booking to the one the customer asked for (Jack, 8 Oct). No mechanic reads
// "Shared queue", as on the job page.
const atWho = (s?: Slot & { mechanicName?: string | null }) =>
  (s?.jobDate ? `${at(s)} · ${s.mechanicName ?? 'Shared queue'}` : '');
const when = (s: Slot) => (s.jobDate ? `${shortDay(s.jobDate)}${s.startTime ? `, ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : ''}` : '');

/** Why the server refused, in words (the old diary's refusalText). */
function refusal(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'stale') return 'This job changed while you were looking at it.';
    if (err.code === 'capacity') return 'The requested time is no longer free.';
    if (err.status === 404) return 'This job no longer exists.';
    return err.message;
  }
  if (err instanceof TypeError) return "Couldn't reach the server — try again.";
  return err instanceof Error ? err.message : 'Something went wrong.';
}

const TITLE: Record<WaitingItem['kind'], string> = {
  new_booking: '',
  change_request: 'Change request',
  customer_cancelled: 'Cancelled booking',
  offered: '',
};

export function RequestDialog({ item, onClose, onAnswered, onOpenJob, onOffer, onNotice }: { item: WaitingItem; onClose: () => void; onNotice?: (text: string) => void; onAnswered?: () => void; onOpenJob?: (jobId: number) => void; onOffer?: (job: WorkshopJob) => void }) {
  const queryClient = useQueryClient();
  const id = item.jobId as number;
  const jobQuery = useQuery({ queryKey: ['workshop-job', id], queryFn: () => apiGet<WorkshopJob>(`/api/workshop-jobs/${id}`) });
  const job = jobQuery.data;
  const [confirmDecline, setConfirmDecline] = useState(false);
  // Choosing the mechanic as the request is accepted (Workshop day decision 62;
  // drawn on request-new): the shop's mechanics and the shared queue, the
  // request's own picked until another is chosen.
  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => apiGet<{ id: number; name: string; active?: boolean }[]>('/api/employees?role=mechanic'), enabled: item.kind === 'new_booking' });
  const people = (mechanics.data ?? []).filter((m) => m.active !== false);
  const [chosenMech, setChosenMech] = useState<number | null | undefined>(undefined);
  const mech = chosenMech === undefined ? job?.mechanicId ?? null : chosenMech;
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const customer = item.customerName || job?.customerName || 'Customer';
  const bike = job?.bikeLabel || 'Bike';
  // The decline step has its own title, as drawn (request-decline).
  const declining = (item.kind === 'new_booking' || item.kind === 'offered') && confirmDecline;
  const title = declining ? (item.kind === 'offered' ? 'Decline request' : 'Decline booking request') : TITLE[item.kind] || `${customer} · ${bike}`;
  const sub = declining ? `${customer} · ${bike}` : item.kind === 'new_booking' ? 'Pending request' : item.kind === 'offered' ? 'Time offered' : `${customer} · ${bike}`;

  // Declining with a message (Workshop day 15; Jack, 20 Oct; drawn as
  // request-decline): started for staff from the day asked for; the shop
  // suggests another day itself.
  const weekday = item.jobDate ? dayLabel(item.jobDate).split(' ')[0] : 'that day';
  // An offered time's decline starts empty: the drawing leaves it to staff (request-offered-decline).
  const [declineWords, setDeclineWords] = useState(item.kind === 'offered' ? '' : `Sorry, we can’t fit this service in on ${weekday}. Please try another day, or call us and we’ll help find one.`);

  async function answer(action: string, body: object = {}) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      const done = await jobAction<{ bookingMessage?: BookingMessageReply }>(id, action, job.version, body);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
      const note = noMessageNote(done?.bookingMessage, item.customerName || job?.customerName);
      if (note) onNotice?.(note);
      onAnswered?.();
      onClose();
    } catch (err) {
      let text = refusal(err);
      // The server checks whether an answer is allowed before it checks the
      // version, so a job someone else already answered comes back 'illegal'.
      // If its version has moved on, say so as for a stale answer.
      const fresh = await jobQuery.refetch();
      if (err instanceof ApiError && err.code === 'illegal' && fresh.data && fresh.data.version !== job.version) {
        text = refusal(new ApiError(409, { error: '', code: 'stale' }));
      }
      if (err instanceof ApiError && err.status === 404) void queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] });
      setConfirmDecline(false);
      setMessage(text);
    } finally {
      setSending(false);
    }
  }

  let body;
  let footer;
  if (item.kind === 'new_booking') {
    body = (
      <>
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-base font-bold">{customer}</span>
          <Badge state="pending" />
        </div>
        <span className="text-sm text-[var(--wh-muted)]">{bike}</span>
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-sm font-bold">What the customer told us</h3>
          <blockquote className="m-0 rounded-md border border-[var(--wh-border)] px-3 py-2 text-sm leading-normal">
            {job?.customerDescription || 'No message from the customer.'}
          </blockquote>
        </div>
        <div className="flex flex-col gap-1">
          <strong className="text-sm">{(item.serviceNames ?? []).join(', ') || job?.title}</strong>
          <span className="text-size-13 text-[var(--wh-muted)]">{`Requested ${when(item)}`}</span>
        </div>
        {mechanics.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the mechanics. Accept keeps the request’s own.</p> : null}
        {/* Shown once the job and the mechanics are in, so nothing looks picked that isn't. */}
        {job && mechanics.isSuccess ? <div className="flex flex-col gap-1.5">
          <span id="req-mech" className="text-sm font-semibold">Mechanic</span>
          <RadioPillGroup aria-labelledby="req-mech" className="flex flex-wrap gap-1.5">
            {people.map((p) => <Pill key={p.id} on={mech === p.id} onClick={() => setChosenMech(p.id)}>{p.name}</Pill>)}
            <Pill on={mech === null} onClick={() => setChosenMech(null)}>Shared queue</Pill>
          </RadioPillGroup>
        </div> : null}
      </>
    );
    if (confirmDecline) {
      const first = customer.split(' ')[0];
      body = (
        <>
          <strong className="text-sm">Explain what the customer can do next</strong>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="decline-msg" className="text-sm font-semibold">{`Message to ${first}`}</label>
            <textarea id="decline-msg" rows={4} maxLength={1000} value={declineWords} onChange={(e) => setDeclineWords(e.target.value)}
              className="resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-sm leading-normal" />
          </div>
          <p className="m-0 text-size-13 text-[var(--wh-muted)]">{`Declining releases the request’s reservation. The customer is told not to travel for this request.${job?.deposit ? ` Their ${pounds(job.deposit.pence)} deposit is refunded automatically.` : ''}`}</p>
        </>
      );
    }
    footer = confirmDecline ? (
      <div className="flex w-full flex-col gap-2">
        <Button variant="danger" block disabled={sending} onClick={() => answer('decline', { message: declineWords })}>Decline &amp; notify customer</Button>
        <Button block disabled={sending} onClick={() => setConfirmDecline(false)}>Keep request</Button>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-2">
        <Button variant="accent" block disabled={sending || !job} onClick={() => answer('accept', job && mech !== (job.mechanicId ?? null) ? { mechanicId: mech } : {})}>Accept</Button>
        <div className="flex gap-2.5">
          {/* Offer another time (Jack, 20 Oct): the diary goes into pick mode for this request. */}
          {onOffer && <Button disabled={sending || !job} onClick={() => { if (job) { onOffer(job); onClose(); } }}>Offer another time</Button>}
          <Button variant="ghost" disabled={sending || !job} onClick={() => setConfirmDecline(true)}>Decline</Button>
        </div>
      </div>
    );
  } else if (item.kind === 'offered') {
    // A time the shop offered, waiting for the customer (Jack, 20 Oct; drawn as
    // request-offered): offer a different one or decline; the customer accepts.
    const first = customer.split(' ')[0];
    const offeredAt = job ? `${dayLabel(job.jobDate)}${job.startTime ? `, ${job.startTime}` : ''}` : '';
    body = confirmDecline ? (
      <>
        <strong className="text-sm">Explain what the customer can do next</strong>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="decline-msg" className="text-sm font-semibold">{`Message to ${first}`}</label>
          <textarea id="decline-msg" rows={4} maxLength={1000} value={declineWords} onChange={(e) => setDeclineWords(e.target.value)}
            className="resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-sm leading-normal" />
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">{`Declining releases the request’s reservation. The customer is told not to travel for this request. ${job ? `${dayLabel(job.jobDate)}${job.startTime ? ` at ${job.startTime}` : ''}` : 'The offered time'} is no longer kept for ${first}.`}</p>
      </>
    ) : (
      <>
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-base font-bold">{customer}</span>
          <Badge state="offered" />
        </div>
        <span className="text-sm text-[var(--wh-muted)]">{bike}</span>
        <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
          <span className="text-sm"><strong>{offeredAt}</strong>{` · ${job?.mechanicName ?? 'Shared queue'}`}</span>
          <span className="text-size-13 text-[var(--wh-muted)]">{`Waiting for ${first} to accept it or cancel. It’s kept free for them.`}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-sm font-bold">{`Your message to ${first}`}</h3>
          <blockquote className="m-0 rounded-md border border-[var(--wh-border)] px-3 py-2 text-sm leading-normal whitespace-pre-wrap">
            {job?.offer?.message || 'No message.'}
          </blockquote>
        </div>
        <div className="flex flex-col gap-1">
          <strong className="text-sm">{(item.serviceNames ?? []).join(', ') || job?.title}</strong>
          {job ? <span className="text-size-13 text-[var(--wh-muted)]">{`${requestMinutes(job)} minutes planned. Asked for ${dayLabel(job.offer?.fromDate ?? job.jobDate)}.`}</span> : null}
        </div>
      </>
    );
    footer = confirmDecline ? (
      <div className="flex w-full flex-col gap-2">
        <Button variant="danger" block disabled={sending} onClick={() => answer('decline', { message: declineWords })}>Decline &amp; notify customer</Button>
        <Button block disabled={sending} onClick={() => setConfirmDecline(false)}>Keep request</Button>
      </div>
    ) : (
      <div className="flex w-full gap-2.5">
        {onOffer && <Button disabled={sending || !job} onClick={() => { if (job) { onOffer(job); onClose(); } }}>Offer a different time</Button>}
        <Button variant="ghost" disabled={sending || !job} onClick={() => setConfirmDecline(true)}>Decline</Button>
      </div>
    );
  } else if (item.kind === 'change_request') {
    body = (
      <>
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-base font-bold">{customer}</span>
          <Badge state="hold" />
        </div>
        <span className="text-sm text-[var(--wh-muted)]">{bike}</span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2.5 gap-y-1 rounded-lg border border-[var(--wh-border)] p-3.5">
          <span className="text-xs font-bold tracking-[0.6px] text-[var(--wh-muted)] uppercase">From</span>
          <span />
          <span className="text-xs font-bold tracking-[0.6px] text-[var(--wh-muted)] uppercase">To</span>
          <strong className="text-sm">{atWho(item.from)}</strong>
          <span aria-hidden="true">→</span>
          <strong className="text-sm">{atWho(item.to)}</strong>
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">The customer asked to move this booking. Accepting keeps the same work.</p>
      </>
    );
    footer = (
      <div className="flex w-full flex-col gap-2">
        <Button variant="accent" block disabled={sending || !job} onClick={() => answer('accept-change')}>Accept</Button>
        {/* Decline and "Open full job" share a row, as drawn on request-change (layout review 238, item 8). */}
        <div className="flex flex-col gap-2 md:flex-row">
          <Button block disabled={sending || !job} onClick={() => answer('decline-change')}>Decline</Button>
          {onOpenJob ? <Button variant="ghost" block disabled={sending} onClick={() => onOpenJob(id)}>Open full job</Button> : null}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-base font-bold">{customer}</span>
          <Badge state="cancelled" />
        </div>
        <span className="text-sm text-[var(--wh-muted)]">{bike}</span>
        <div className="flex flex-col gap-1">
          <strong className="text-sm">{(item.serviceNames ?? []).join(', ') || job?.title}</strong>
          {job?.cancelledAt ? (
            <span className="text-size-13 text-[var(--wh-muted)]">{`Cancelled by the customer on ${shortDay(todayIso(new Date(job.cancelledAt)))}.`}</span>
          ) : null}
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">No further action is needed.</p>
      </>
    );
    footer = (
      <Button variant="accent" block disabled={sending || !job} onClick={() => answer('cancellation-seen')}>Seen</Button>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby="request-title" aria-describedby="request-sub">
      <DialogHeader>
        <div className="flex min-w-0 flex-col">
          <DialogTitle id="request-title" className="truncate">{title}</DialogTitle>
          <DialogDescription id="request-sub">{sub}</DialogDescription>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        {jobQuery.isLoading ? <p className="m-0">Loading…</p> : body}
        {jobQuery.isError ? <p role="alert" className="m-0">{refusal(jobQuery.error)}</p> : null}
        {message ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{message}</p> : null}
      </DialogBody>
      <DialogFooter>{footer}</DialogFooter>
    </Dialog>
  );
}
