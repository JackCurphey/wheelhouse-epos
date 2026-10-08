import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { STATE_LABEL, shortDay, todayIso, type DiaryState, type WaitingItem } from './rules.ts';

/**
 * Answering what's waiting (journey 12 decisions 15 and 19): the request
 * pop-ups drawn as request-new, request-decline, request-change and
 * request-cancel in docs/design/user-journeys/generator/diary.mjs. Each
 * answer goes to the server's existing route with the version this pop-up
 * saw, so an answer to a job someone else has just changed is refused.
 *
 * Not here yet, because the server can't do them: choosing the mechanic as
 * you accept (decision 62), "Offer another time", and a message with a
 * decline. "Open full job" waits for the job page.
 */

const CHIP: Record<DiaryState, string> = {
  scheduled: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  pending: 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
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
};

export function RequestDialog({ item, onClose, onAnswered }: { item: WaitingItem; onClose: () => void; onAnswered?: () => void }) {
  const queryClient = useQueryClient();
  const id = item.jobId as number;
  const jobQuery = useQuery({ queryKey: ['workshop-job', id], queryFn: () => apiGet<WorkshopJob>(`/api/workshop-jobs/${id}`) });
  const job = jobQuery.data;
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const customer = item.customerName || job?.customerName || 'Customer';
  const bike = job?.bikeLabel || 'Bike';
  const title = TITLE[item.kind] || `${customer} · ${bike}`;
  const sub = item.kind === 'new_booking' ? 'Pending request' : `${customer} · ${bike}`;

  async function answer(action: string) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      await jobAction(id, action, job.version);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
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
          <span className="text-[13px] text-[var(--wh-muted)]">{`Requested ${when(item)}`}</span>
        </div>
      </>
    );
    footer = confirmDecline ? (
      <div className="flex w-full flex-col gap-2">
        <p className="m-0 text-sm">{`Decline ${customer}'s booking for ${item.jobDate ? shortDay(item.jobDate) : 'this day'}? This can't be undone.`}</p>
        <Button variant="danger" block disabled={sending} onClick={() => answer('decline')}>Decline booking</Button>
        <Button block disabled={sending} onClick={() => setConfirmDecline(false)}>Keep booking</Button>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-2">
        <Button variant="accent" block disabled={sending || !job} onClick={() => answer('accept')}>Accept</Button>
        <div className="flex gap-2.5">
          <Button variant="ghost" disabled={sending || !job} onClick={() => setConfirmDecline(true)}>Decline</Button>
        </div>
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
          <span className="text-[11px] font-bold tracking-[0.6px] text-[var(--wh-muted)] uppercase">From</span>
          <span />
          <span className="text-[11px] font-bold tracking-[0.6px] text-[var(--wh-muted)] uppercase">To</span>
          <strong className="text-sm">{atWho(item.from)}</strong>
          <span aria-hidden="true">→</span>
          <strong className="text-sm">{atWho(item.to)}</strong>
        </div>
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">The customer asked to move this booking. Accepting keeps the same work.</p>
      </>
    );
    footer = (
      <div className="flex w-full flex-col gap-2">
        <Button variant="accent" block disabled={sending || !job} onClick={() => answer('accept-change')}>Accept</Button>
        <Button block disabled={sending || !job} onClick={() => answer('decline-change')}>Decline</Button>
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
            <span className="text-[13px] text-[var(--wh-muted)]">{`Cancelled by the customer on ${shortDay(todayIso(new Date(job.cancelledAt)))}.`}</span>
          ) : null}
        </div>
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">No further action is needed.</p>
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
