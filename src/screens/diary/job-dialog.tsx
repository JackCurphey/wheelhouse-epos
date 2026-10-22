import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '@/staff/routes.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { shortDay, todayIso } from './rules.ts';
import { WorkParts } from './work-parts.tsx';
import { jobRefusalText, refusalText } from './refusal-words.ts';
import { ChangeDetailsDialog } from './change-details-dialog.tsx';
import { JobFiles } from './job-files.tsx';
import { JobMessagesButton, jobMessagesKey } from './job-messages.tsx';
import { printBikeTag } from './bike-tag.tsx';
import { SignOffDialog, signedOffWhen } from './sign-off-dialog.tsx';
import { JobChecklistBar } from './job-checklist.tsx';
import { SlotDialog, useStorageSlots } from './storage-slots.tsx';
import { channelWord } from './channel-word.ts';

/**
 * The job page, piece 1 (journey 12; drawn as job-overview, job-book-in,
 * job-mechanic, job-waiting-parts, job-finished, job-collection): a
 * near-fullscreen pop-up over the diary (decision 16), one page with no tabs
 * (decision 20), and the stage's own button (decisions 30, 35).
 * Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md
 */

type Customer = { id: number; name: string; email: string | null; phone: string | null };

const money = (n: number) => `£${n.toFixed(2)}`;

/** The badge's word for where the job is (the drawings' stage names). */
export function jobStage(j: Pick<WorkshopJob, 'bookingState' | 'custodyState' | 'workState' | 'quote'> & { requested?: WorkshopJob['requested'] }): string {
  if (j.bookingState === 'pending') return 'Booking request';
  // A time the shop offered, waiting for the customer (Jack, 20 Oct).
  if (j.bookingState === 'offered') return 'Time offered';
  // Bookings that ended, or wait on the customer's change (Jack, 15 Oct, issue 190):
  // the diary's words, with Declined and Expired added.
  // As the diary: a change request with the time the customer asked for.
  if (j.bookingState === 'reschedule_requested' && j.requested) return 'Change requested';
  if (j.bookingState === 'cancelled') return 'Cancelled';
  if (j.bookingState === 'declined') return 'Declined';
  if (j.bookingState === 'expired') return 'Expired';
  if (j.custodyState === 'collected') return 'Collected';
  if (j.workState === 'complete') return 'Finished';
  // Waiting for parts wins over a quote out, as in the diary (Jack, 4 Oct).
  if (j.workState === 'waiting_parts') return 'Waiting for parts';
  // A quote the customer hasn't answered (UX walk-through M3: its own teal).
  if (j.quote?.state === 'sent') return 'Quoting';
  if (j.workState === 'on_hold') return 'On hold';
  if (j.custodyState === 'in_shop') return 'In the workshop';
  return 'Expected';
}

type Action = { label: string; action: string; primary: boolean };

/** The buttons that move the job on from where it is (the server's state machines). */
function stageActions(j: WorkshopJob): Action[] {
  if (j.bookingState === 'pending' || j.bookingState === 'offered' || j.bookingState === 'cancelled' || j.bookingState === 'declined' || j.bookingState === 'expired') return [];
  if (j.custodyState === 'collected') return [];
  // Put on hold, beside the main button, wherever the work can be held (Jack, 15 Oct).
  const hold: Action = { label: 'Put on hold', action: 'hold', primary: false };
  if (j.custodyState === 'expected') return [{ label: 'Book in', action: 'book-in', primary: true }, ...(j.workState === 'not_started' ? [hold] : [])];
  switch (j.workState) {
    case 'not_started': return [{ label: 'Start work', action: 'start', primary: true }, hold];
    case 'in_progress': return [
      { label: 'Mark ready for collection', action: 'finish', primary: true },
      { label: 'Waiting for parts', action: 'await-parts', primary: false },
      hold,
    ];
    case 'waiting_parts': return [{ label: 'Parts arrived', action: 'parts-arrived', primary: true }, hold];
    case 'on_hold': return [{ label: 'Resume', action: 'resume', primary: true }];
    // Unpaid finished work is paid at the till, which records the hand-over
    // (collect and pay decision 3; Jack, 18 Oct); paid work is handed over.
    // A cancelled order is neither paid nor payable here (fresh review).
    case 'complete': return j.orderId && j.orderStatus === 'cancelled' ? []
      : j.orderId && j.orderStatus === 'open'
        ? [{ label: 'Take payment', action: 'pay', primary: true }]
        : [{ label: 'Hand over', action: 'collect', primary: true }];
    default: return [];
  }
}

const BADGE: Record<string, string> = {
  'Booking request': 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  Quoting: 'bg-[var(--wh-state-answer-bg)] text-[var(--wh-state-answer-ink)]',
  Expected: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  'In the workshop': 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  'Waiting for parts': 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  'On hold': 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  'Change requested': 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  Cancelled: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
  Declined: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
  Expired: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
  Finished: 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  Collected: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex rounded-full bg-[var(--wh-surface-muted)] px-2.5 py-0.5 text-xs font-semibold">{children}</span>
);

export function JobDialog({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const jobQuery = useQuery({ queryKey: ['workshop-job', jobId], queryFn: () => apiGet<WorkshopJob>(`/api/workshop-jobs/${jobId}`) });
  const job = jobQuery.data;
  // Opening a booking confirmed straight away clears its "New, booked online"
  // mark (Jack, 19 Oct, auto-confirm): once, then the diary reads it again.
  const newOnline = Boolean(job?.newOnline);
  useEffect(() => {
    if (!newOnline) return;
    // The diary reads its jobs again even if the page has closed meanwhile,
    // so the mark doesn't linger (fresh review).
    apiMutate(`/api/workshop-jobs/${jobId}/seen`, {})
      .then(() => queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }))
      .catch(() => { /* the mark stays; it's cleared next time the job is opened */ });
  }, [newOnline, jobId, queryClient]);
  // A booking that ended can't be booked in or given another day, though its page still opens (fresh review, 15 Oct).
  const ended = job?.bookingState === 'cancelled' || job?.bookingState === 'declined' || job?.bookingState === 'expired';
  // Finished work's notes are read-only: what was typed and not saved is not shown as if saved.
  const finished = job?.workState === 'complete';
  const customer = useQuery({
    queryKey: ['customer', job?.customerId],
    queryFn: () => apiGet<Customer>(`/api/customers/${job?.customerId}`),
    enabled: Boolean(job?.customerId),
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The notes as typed, until saved (null: nothing typed since the last save).
  const [draft, setDraft] = useState<string | null>(null);
  const [notesNote, setNotesNote] = useState('');
  // "Change details" (Jack, 18 Oct): not for finished work, which is frozen until reopened.
  const [changing, setChanging] = useState(false);
  // Storage slots (Workshop day 27): Book in asks where the bike is kept, and
  // "Kept on [slot]" moves it, when the shop's slots are on.
  const slots = useStorageSlots();
  const [slotBox, setSlotBox] = useState<'book-in' | 'move' | null>(null);
  // Deleting a job (Jack, 18 Oct, docs/decisions/2026-10-18-attachments-and-delete.md):
  // asks first, or says "Settle up first" while money has been paid on its
  // order or the bike is in the shop. The server refuses the same cases.
  const [deleting, setDeleting] = useState<'ask' | 'blocked' | null>(null);
  const [blockedBy, setBlockedBy] = useState<{ paid: boolean; inShop: boolean }>({ paid: false, inShop: false });
  function askDelete() {
    if (!job) return;
    const paid = job.orderStatus === 'converted';
    const inShop = job.custodyState === 'in_shop';
    setBlockedBy({ paid, inShop });
    setDeleting(paid || inShop ? 'blocked' : 'ask');
  }
  async function deleteJob() {
    if (!job) return;
    setSending(true);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}`, undefined, { method: 'DELETE' });
      setDeleting(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
      ]);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'settle_first') {
        const body = err.body as { paid?: boolean; inShop?: boolean } | undefined;
        setBlockedBy({ paid: Boolean(body?.paid), inShop: Boolean(body?.inShop) });
        setDeleting('blocked');
      } else {
        setDeleting(null);
        setMessage(refusalText(err));
      }
    } finally {
      setSending(false);
    }
  }

  // "Mark ready for collection" asks who is signing it off first (Jack, 16 Oct).
  const [signing, setSigning] = useState(false);
  // "Bike ready" waits a minute with Undo after marking it ready (UX
  // walk-through 1 H2; the messages engine). The strip goes when the minute does.
  const [ready, setReady] = useState<ReadyStrip | null>(null);
  useEffect(() => {
    if (!ready || !('id' in ready)) return undefined;
    const t = setTimeout(() => setReady(null), Math.max(0, Date.parse(ready.sendAfter) - Date.now()));
    return () => clearTimeout(t);
  }, [ready]);
  async function undoReady() {
    if (!ready || !('id' in ready)) return;
    setSending(true);
    setMessage(null);
    try {
      await apiMutate(`/api/messages/${ready.id}/undo`, {});
      setReady(null);
      void queryClient.invalidateQueries({ queryKey: jobMessagesKey(job?.id ?? 0) });
    } catch (err) {
      setReady(null);
      setMessage(refusalText(err));
    } finally {
      setSending(false);
    }
  }

  function bookIn() {
    if (slots.length) setSlotBox('book-in');
    else void run('book-in');
  }

  async function moveSlot(storageSlotId: number | null) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}/storage-slot`, { storageSlotId }, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  async function run(action: string, extra: object = {}) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      const done = await jobAction<WorkshopJob & { readyMessage?: ReadyMessage }>(job.id, action, job.version, extra);
      if (action === 'finish' && done?.readyMessage) setReady(readyStrip(done, done.readyMessage));
      // Finishing, or reopening, changes what the job's Messages list holds.
      if (action === 'finish' || action === 'reopen-work') void queryClient.invalidateQueries({ queryKey: jobMessagesKey(job.id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
    } catch (err) {
      // Only a stale refusal means someone else changed the job; a move it can
      // no longer make is explained from where it is (Jack, 15 Oct).
      if (err instanceof ApiError && err.code === 'stale') {
        setMessage('This job changed while you were looking at it.');
        void jobQuery.refetch();
      } else if (err instanceof ApiError && err.code === 'illegal') {
        setMessage(refusalText(err));
        void jobQuery.refetch();
      } else {
        setMessage(refusalText(err));
      }
    } finally {
      setSending(false);
    }
  }

  const refresh = (id: number) => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workshop-job', id] }),
    queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
  ]);

  async function saveNotes() {
    if (!job || draft === null) return;
    setSending(true);
    setMessage(null);
    setNotesNote('');
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}`, { notes: draft, version: job.version }, { method: 'PUT' });
      setDraft(null);
      setNotesNote('Notes saved.');
      await refresh(job.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'stale') {
        setMessage('This job changed while you were looking at it. Your words are still in the box.');
        void jobQuery.refetch();
      } else {
        setMessage(refusalText(err));
      }
    } finally {
      setSending(false);
    }
  }

  async function removeDay(partId: number) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}/parts/${partId}`, { version: job.version }, { method: 'DELETE' });
      await refresh(job.id);
    } catch (err) {
      setMessage(jobRefusalText(err));
      if (err instanceof ApiError && err.code === 'stale') void jobQuery.refetch();
    } finally {
      setSending(false);
    }
  }

  async function addDay() {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}/parts`, { version: job.version });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
    } catch (err) {
      setMessage(jobRefusalText(err));
      if (err instanceof ApiError && err.code === 'stale') void jobQuery.refetch();
    } finally {
      setSending(false);
    }
  }

  const stage = job ? jobStage(job) : '';
  const parts = job?.parts ?? [];
  // Decision 51: ready by the diary day, which for a job over several days is its last.
  const readyBy = parts.length ? parts[parts.length - 1].date : job?.jobDate;
  const actions = job ? stageActions(job) : [];

  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      aria-labelledby="job-title"
      className="h-full max-h-none max-w-none rounded-none md:h-[calc(100vh-64px)] md:max-w-[calc(100vw-64px)] md:rounded-[14px]"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--wh-border)] px-5 py-3.5">
          <h2 id="job-title" className="m-0 min-w-0 truncate text-lg font-bold">{job?.title ?? 'Job'}</h2>
          {job ? <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE[stage]}`}>{stage}</span> : null}
          <span className="grow" />
          {/* Beside Close on a computer or tablet; on a phone it sits in the job's details box (Jack, 18 Oct). */}
          {job && !finished ? <Button className="hidden md:inline-flex" onClick={() => setChanging(true)}>Change details</Button> : null}
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {jobQuery.isLoading ? <p className="m-5">Loading…</p> : null}
        {jobQuery.isError ? <p role="alert" className="m-5">Wheelhouse couldn&apos;t load this job. Try again in a moment.</p> : null}

        {job ? (
          <>
            {/* Customer strip (decision 58): who, then the bike, mechanic and tags. */}
            <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <strong>{job.customerName ?? 'No customer'}</strong>
                {customer.data?.phone ? <span>{customer.data.phone}</span> : null}
                {customer.data?.email ? <span>{customer.data.email}</span> : null}
                {/* Print bike tag once the bike is in (Jack, 21 Oct, bike tag answer 2:
                    "the top right where the three boxes are"; drawn as job-book-in-print),
                    then the drawn "Message [customer]" button (Jack, 20 Oct). */}
                {(job.custodyState === 'in_shop' && job.reference) || job.customerId ? (
                  <span className="ml-auto flex gap-2">
                    {/* A job with no number gets no tag: its id is the database's, counting every
                        shop's jobs, and nothing could find it from the barcode (fresh review). */}
                    {job.custodyState === 'in_shop' && job.reference ? (
                      <button
                        type="button" aria-label="Print bike tag" title="Print bike tag"
                        onClick={() => printBikeTag({ reference: job.reference as string, customerName: job.customerName ?? null, bikeLabel: [job.bikeLabel, job.bikeColour].filter(Boolean).join(' · ') || null })}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] hover:bg-[var(--wh-hover)]"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></svg>
                      </button>
                    ) : null}
                    {job.customerId ? <JobMessagesButton jobId={job.id} customerName={job.customerName ?? 'the customer'} title={job.title} reference={job.reference ?? null} /> : null}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {job.bikeLabel ? <span>{job.bikeLabel}</span> : null}
                {/* Where a bike in the shop is kept (job-book-in's "Kept on Hook 3"); a button to move it. */}
                {slots.length && job.custodyState === 'in_shop' ? (
                  <button type="button" disabled={sending} onClick={() => setSlotBox('move')} className="min-h-11 text-[var(--wh-muted)] underline-offset-2 hover:underline">
                    {job.storageSlotName ? `Kept on ${job.storageSlotName}` : 'Choose where it’s kept'}
                  </button>
                ) : null}
                <span>{`Mechanic: ${job.mechanicName ?? 'Shared queue'}`}</span>
                <Tag>{`Ready by ${shortDay(readyBy as string)}`}</Tag>
                {job.orderTotal ? <Tag>{`Total ${money(job.orderTotal)}`}</Tag> : null}
              </div>
            </div>

            {/* Who signed the finished work off (Jack, 16 Oct, answer 3; drawn under the finished strip). */}
            {finished && job.signedOffByName && job.signedOffAt ? (
              <p className="m-0 flex shrink-0 items-center gap-2 border-b border-[var(--wh-border)] px-5 py-1.5 text-[13px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                <span data-sign-off="true">Signed off by <strong>{job.signedOffByName}</strong>{` · ${signedOffWhen(job.signedOffAt)}`}</span>
              </p>
            ) : null}
            {ready && 'id' in ready ? (
              <div role="status" className="flex shrink-0 flex-wrap items-center gap-3 bg-[var(--wh-ink)] px-5 py-2 text-sm text-[var(--wh-bg)]">
                <span className="grow">{ready.text}</span>
                <button type="button" disabled={sending} onClick={() => void undoReady()} className="min-h-11 rounded-md px-3 font-semibold underline">Undo</button>
              </div>
            ) : null}
            {ready && 'reason' in ready ? (
              <p role="status" className="m-0 shrink-0 border-b border-[var(--wh-border)] px-5 py-2 text-sm">{ready.reason}</p>
            ) : null}
            <div className="min-h-0 grow overflow-y-auto px-5 py-4">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <section aria-labelledby="job-details" className="flex flex-col gap-1.5 text-sm">
                    <h3 id="job-details" className="m-0 text-sm font-bold">Job details</h3>
                    <span className="font-[family-name:var(--wh-font-mono)]">{job.reference}</span>
                    <span className="text-[var(--wh-muted)]">{`Created ${shortDay(todayIso(new Date(job.createdAt)))}`}</span>
                    {parts.length > 1 ? null : (
                      <span>{job.startTime ? `${shortDay(job.jobDate)}, ${job.startTime}${job.endTime ? `–${job.endTime}` : ''}` : `${shortDay(job.jobDate)}, no set time`}</span>
                    )}
                    {parts.length > 1 ? (
                      <ul aria-label="Days" className="m-0 flex list-none flex-col gap-0.5 p-0">
                        {parts.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-2">
                            <span>{`Day ${p.position}: ${shortDay(p.date)}${p.startTime ? `, ${p.startTime}${p.endTime ? `–${p.endTime}` : ''}` : ''}${p.mechanicName ? `, ${p.mechanicName}` : ''}`}</span>
                            {p.position > 1 ? (
                              <Button size="sm" variant="ghost" disabled={sending} onClick={() => removeDay(p.id)} aria-label={`Remove day ${p.position}`}>Remove</Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {!ended && (stageActions(job).length || job.custodyState !== 'collected') ? (
                      <Button size="sm" className="self-start" disabled={sending} onClick={addDay}>Add another day</Button>
                    ) : null}
                    {!finished ? <Button className="min-h-11 self-start md:hidden" onClick={() => setChanging(true)}>Change details</Button> : null}
                    {/* Decision 50: a toggle pill. Turning it on books the bike in; it can't be turned back off here. */}
                    {(() => {
                      const here = job.custodyState !== 'expected';
                      return (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={here}
                          disabled={here || sending || job.bookingState === 'pending' || job.bookingState === 'offered' || ended}
                          onClick={() => bookIn()}
                          className={`inline-flex min-h-9 items-center gap-2 self-start rounded-full border px-3.5 text-[13px] font-semibold ${here ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
                        >
                          <span aria-hidden="true" className={`inline-block size-3 rounded-full border ${here ? 'border-[var(--wh-accent-soft-ink)] bg-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)]'}`} />
                          Bike is here
                        </button>
                      );
                    })()}
                  </section>
                  <section aria-labelledby="job-notes" className="flex flex-col gap-1.5">
                    <h3 id="job-notes" className="m-0 text-sm font-bold">Notes</h3>
                    <div className="flex flex-col gap-2 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 py-2.5 text-sm leading-normal">
                      {job.customerDescription ? (
                        <div className="flex flex-col gap-1 border-b border-[var(--wh-border)] pb-2">
                          <span className="text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">From the customer</span>
                          <span className="whitespace-pre-line">{job.customerDescription}</span>
                        </div>
                      ) : null}
                      {/* Finished work is frozen until it is reopened, so its notes are read-only (Jack, 15 Oct). */}
                      <textarea
                        aria-labelledby="job-notes"
                        readOnly={job.workState === 'complete'}
                        rows={5}
                        value={(finished ? null : draft) ?? job.notes ?? ''}
                        onChange={(e) => { setDraft(e.target.value); setNotesNote(''); }}
                        placeholder="Add notes for the workshop"
                        className="min-h-24 w-full resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 py-2 text-sm leading-normal"
                      />
                    </div>
                    {job.workState === 'complete' ? (
                      <span className="text-[13px] text-[var(--wh-muted)]">Reopen the job to change its notes.</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Button size="sm" disabled={sending || draft === null || draft === (job.notes ?? '')} onClick={saveNotes}>Save notes</Button>
                        <span role="status" className="text-[13px] text-[var(--wh-muted)]">{notesNote}</span>
                      </div>
                    )}
                    {/* The service's checklist, under the notes as drawn (job-mechanic). */}
                    <JobChecklistBar job={job} />
                  </section>
                  <JobFiles jobId={job.id} />
                </div>
                <section aria-labelledby="job-work" className="flex min-w-0 flex-col gap-1.5">
                  <h3 id="job-work" className="m-0 text-sm font-bold">Work and parts</h3>
                  {job.orderId ? <WorkParts orderId={job.orderId} job={job} /> : <p className="m-0 text-sm text-[var(--wh-muted)]">This job has no order to add work and parts to.</p>}
                </section>
              </div>
            </div>

            {message ? <p role="alert" className="mx-5 mb-2 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{message}</p> : null}
            {/* Always shown, so "Delete job" is in view without scrolling (Jack, 18 Oct). */}
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[var(--wh-border)] px-5 py-3.5">
              <Button variant="danger" className="mr-auto min-h-11" disabled={sending} onClick={askDelete}>Delete job</Button>
              {actions.filter((a) => !a.primary).map((a) => (
                <Button key={a.action} disabled={sending} onClick={() => run(a.action)}>{a.label}</Button>
              ))}
              {actions.filter((a) => a.primary).map((a) => (
                <Button key={a.action} variant="accent" disabled={sending} onClick={() => (a.action === 'pay' ? navigate(`${ROUTES.till}?job=${jobId}`) : a.action === 'finish' ? setSigning(true) : a.action === 'book-in' ? bookIn() : run(a.action))}>{a.label}</Button>
              ))}
            </footer>
          </>
        ) : null}
      </div>
      {changing && job ? <ChangeDetailsDialog job={job} onClose={() => setChanging(false)} /> : null}
      {slotBox && job ? (
        <SlotDialog
          job={job} slots={slots} busy={sending}
          title={slotBox === 'book-in' ? `Book in · job ${job.reference ?? ''}` : 'Where the bike is kept'}
          onClose={() => setSlotBox(null)}
          onDone={(slot) => {
            const was = slotBox;
            setSlotBox(null);
            if (was === 'book-in') void run('book-in', slot === null ? {} : { storageSlotId: slot });
            else void moveSlot(slot);
          }}
        />
      ) : null}
      {signing && job ? <SignOffDialog job={job} busy={sending} onClose={() => setSigning(false)} onSign={(id) => { setSigning(false); void run('finish', { signedOffBy: id }); }} /> : null}
      <Dialog open={deleting === 'ask'} onOpenChange={(o) => { if (!o) setDeleting(null); }} aria-labelledby="delete-job-title">
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="delete-job-title">{`Delete ${job?.title ?? 'this job'}?`}</DialogTitle>
            <span className="text-[13px] text-[var(--wh-muted)]">{[job?.reference, job?.customerName, job?.bikeLabel].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" aria-label="Close" onClick={() => setDeleting(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </DialogHeader>
        <DialogBody><p className="m-0 text-sm">The job, its diary time and its files and photos are removed. This can’t be undone.</p></DialogBody>
        <DialogFooter className="flex justify-between gap-2.5">
          <Button variant="ghost" className="min-h-11" onClick={() => setDeleting(null)}>Keep the job</Button>
          <Button variant="danger" className="min-h-11" disabled={sending} onClick={() => void deleteJob()}>Delete job</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={deleting === 'blocked'} onOpenChange={(o) => { if (!o) setDeleting(null); }} aria-labelledby="delete-blocked-title">
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="delete-blocked-title">Settle up first</DialogTitle>
            <span className="text-[13px] text-[var(--wh-muted)]">{`Before ${[job?.title, job?.reference].filter(Boolean).join(' · ')} can be deleted`}</span>
          </div>
          <button type="button" aria-label="Close" onClick={() => setDeleting(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2 text-sm">
          <p className="m-0">Deleting it now would lose what’s still open:</p>
          <div className="flex flex-col">
            {blockedBy.paid ? (
              <div className="flex min-h-10 items-center justify-between gap-3 border-t border-[var(--wh-border)]"><span>Paid on its order</span><span className="font-mono font-semibold">{job?.orderTotal ? money(job.orderTotal) : 'Paid'}</span></div>
            ) : null}
            {blockedBy.inShop ? (
              <div className="flex min-h-10 items-center justify-between gap-3 border-t border-[var(--wh-border)]"><span>Bike in the shop</span><span className="font-semibold">{job?.bikeLabel || 'Bike'}</span></div>
            ) : null}
          </div>
          <p className="m-0">{blockedBy.paid && blockedBy.inShop ? 'Refund what was paid and hand the bike back — then delete.' : blockedBy.paid ? 'Refund what was paid — then delete.' : 'Hand the bike back — then delete.'}</p>
        </DialogBody>
        <DialogFooter className="flex justify-end">
          <Button className="min-h-11" onClick={() => setDeleting(null)}>OK</Button>
        </DialogFooter>
      </Dialog>
    </Dialog>
  );
}

type ReadyMessage = { id: number; channel: string; to: string; sendAfter: string } | { skipped: 'off' | 'no_contact' };
type ReadyStrip = { id: number; sendAfter: string; text: string } | { reason: string };

// What the strip says after marking it ready: the drawn line, or why Bike
// ready didn't go (no phone or email; switched off says nothing).
function readyStrip(job: WorkshopJob, m: ReadyMessage): ReadyStrip | null {
  if ('skipped' in m) {
    return m.skipped === 'no_contact' ? { reason: `“Bike ready” didn’t go: ${job.customerName ?? 'The customer'} has no phone number or email on file.` } : null;
  }
  const first = (job.customerName ?? '').trim().split(/\s+/)[0] || 'the customer';
  const at = job.signedOffAt ? signedOffWhen(job.signedOffAt).split(', ').at(-1) : null;
  const who = job.signedOffByName && at ? `${job.signedOffByName} marked it ready at ${at}. ` : '';
  return { id: m.id, sendAfter: m.sendAfter, text: `${who}“Bike ready” goes to ${first} by ${channelWord(m.channel)} in 1 minute.` };
}
