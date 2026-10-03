import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog } from '@/components/ui/dialog.tsx';
import { shortDay, todayIso } from './rules.ts';
import { WorkParts } from './work-parts.tsx';

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
export function jobStage(j: Pick<WorkshopJob, 'bookingState' | 'custodyState' | 'workState'>): string {
  if (j.bookingState === 'pending') return 'Booking request';
  if (j.custodyState === 'collected') return 'Collected';
  if (j.workState === 'complete') return 'Ready for collection';
  if (j.workState === 'waiting_parts') return 'Waiting for parts';
  if (j.workState === 'on_hold') return 'On hold';
  if (j.custodyState === 'in_shop') return 'In workshop';
  return 'Expected';
}

type Action = { label: string; action: string; primary: boolean };

/** The buttons that move the job on from where it is (the server's state machines). */
function stageActions(j: WorkshopJob): Action[] {
  if (j.bookingState === 'pending' || j.bookingState === 'cancelled' || j.bookingState === 'declined' || j.bookingState === 'expired') return [];
  if (j.custodyState === 'collected') return [];
  if (j.custodyState === 'expected') return [{ label: 'Book in', action: 'book-in', primary: true }];
  switch (j.workState) {
    case 'not_started': return [{ label: 'Start work', action: 'start', primary: true }];
    case 'in_progress': return [
      { label: 'Mark ready for collection', action: 'finish', primary: true },
      { label: 'Waiting for parts', action: 'await-parts', primary: false },
    ];
    case 'waiting_parts': return [{ label: 'Parts arrived', action: 'parts-arrived', primary: true }];
    case 'on_hold': return [{ label: 'Resume', action: 'resume', primary: true }];
    case 'complete': return [{ label: 'Hand over', action: 'collect', primary: true }];
    default: return [];
  }
}

const BADGE: Record<string, string> = {
  'Booking request': 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]',
  Expected: 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  'In workshop': 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]',
  'Waiting for parts': 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]',
  'On hold': 'bg-[var(--wh-state-hold-bg)] text-[var(--wh-state-hold-ink)]',
  'Ready for collection': 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]',
  Collected: 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]',
};

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex rounded-full bg-[var(--wh-surface-muted)] px-2.5 py-0.5 text-xs font-semibold">{children}</span>
);

export function JobDialog({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const jobQuery = useQuery({ queryKey: ['workshop-job', jobId], queryFn: () => apiGet<WorkshopJob>(`/api/workshop-jobs/${jobId}`) });
  const job = jobQuery.data;
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

  async function run(action: string) {
    if (!job) return;
    setSending(true);
    setMessage(null);
    try {
      await jobAction(job.id, action, job.version);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'stale' || err.code === 'illegal')) {
        setMessage('This job changed while you were looking at it.');
        void jobQuery.refetch();
      } else {
        setMessage(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
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
        setMessage(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
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
      setMessage(err instanceof ApiError
        ? (err.code === 'stale' ? 'This job changed while you were looking at it.' : err.message)
        : "Couldn't reach the server — try again.");
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
      setMessage(err instanceof ApiError
        ? (err.code === 'stale' ? 'This job changed while you were looking at it.' : err.message)
        : "Couldn't reach the server — try again.");
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
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {job.bikeLabel ? <span>{job.bikeLabel}</span> : null}
                <span>{`Mechanic: ${job.mechanicName ?? 'Shared queue'}`}</span>
                <Tag>{`Ready by ${shortDay(readyBy as string)}`}</Tag>
                {job.orderTotal ? <Tag>{`Total ${money(job.orderTotal)}`}</Tag> : null}
              </div>
            </div>

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
                    {stageActions(job).length || job.custodyState !== 'collected' ? (
                      <Button size="sm" className="self-start" disabled={sending} onClick={addDay}>Add another day</Button>
                    ) : null}
                    {/* Decision 50: a toggle pill. Turning it on books the bike in; it can't be turned back off here. */}
                    {(() => {
                      const here = job.custodyState !== 'expected';
                      return (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={here}
                          disabled={here || sending || job.bookingState === 'pending'}
                          onClick={() => run('book-in')}
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
                          <span>{job.customerDescription}</span>
                        </div>
                      ) : null}
                      <textarea
                        aria-labelledby="job-notes"
                        rows={5}
                        value={draft ?? job.notes ?? ''}
                        onChange={(e) => { setDraft(e.target.value); setNotesNote(''); }}
                        placeholder="Add notes for the workshop"
                        className="min-h-24 w-full resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 py-2 text-sm leading-normal"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" disabled={sending || draft === null || draft === (job.notes ?? '')} onClick={saveNotes}>Save notes</Button>
                      <span role="status" className="text-[13px] text-[var(--wh-muted)]">{notesNote}</span>
                    </div>
                  </section>
                </div>
                <section aria-labelledby="job-work" className="flex min-w-0 flex-col gap-1.5">
                  <h3 id="job-work" className="m-0 text-sm font-bold">Work and parts</h3>
                  {job.orderId ? <WorkParts orderId={job.orderId} /> : <p className="m-0 text-sm text-[var(--wh-muted)]">This job has no order to add work and parts to.</p>}
                </section>
              </div>
            </div>

            {message ? <p role="alert" className="mx-5 mb-2 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{message}</p> : null}
            {actions.length ? (
              <footer className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-[var(--wh-border)] px-5 py-3.5">
                {actions.filter((a) => !a.primary).map((a) => (
                  <Button key={a.action} disabled={sending} onClick={() => run(a.action)}>{a.label}</Button>
                ))}
                {actions.filter((a) => a.primary).map((a) => (
                  <Button key={a.action} variant="accent" disabled={sending} onClick={() => run(a.action)}>{a.label}</Button>
                ))}
              </footer>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
