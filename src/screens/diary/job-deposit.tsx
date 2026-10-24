import { useState } from 'react';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { shortDay, todayIso } from './rules.ts';

/**
 * The job's deposit (Jack, 24 Oct answers 2, 3 and 5; approved drawings
 * bk-staff-deposit, bk-staff-deposit-refund, bk-staff-deposit-refunded,
 * bk-staff-no-show and bk-staff-no-show-kept in diary.mjs;
 * openspec/changes/deposit-diary-screen).
 */
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const day = (iso: string | null) => (iso ? shortDay(todayIso(new Date(iso))) : '');
const mono = 'font-[family-name:var(--wh-font-mono)]';

/** Didn't come is offered once the booked day has gone with the bike not in (design 2). */
export function canMarkNoShow(job: WorkshopJob, today = todayIso()): boolean {
  return job.bookingState === 'scheduled' && job.custodyState === 'expected' && !job.noShowAt && job.jobDate < today;
}

const badge = (words: string, tone: 'green' | 'grey' | 'amber') => (
  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
    tone === 'green' ? 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]'
      : tone === 'amber' ? 'bg-[var(--wh-state-waiting-bg)] text-[var(--wh-state-waiting-ink)]'
        : 'bg-[var(--wh-state-cancelled-bg)] text-[var(--wh-state-cancelled-ink)]'}`}>{words}</span>
);

/** The strip under the customer strip: Not come in, and the deposit with Refund the deposit (design 1). */
export function DepositStrip({ job, notCome, onRefund }: { job: WorkshopJob; notCome: boolean; onRefund: () => void }) {
  const d = job.deposit;
  if (!d && !notCome) return null;
  const head = d?.state === 'refunded' ? ['Deposit refunded', 'grey'] as const : d?.state === 'kept' ? ['Deposit kept', 'grey'] as const : ['Deposit paid', 'green'] as const;
  const side = !d ? '' : d.state === 'refunded' ? `· ${day(d.refundedAt)}${d.refundReason ? ` · ${d.refundReason}` : ''}`
    : d.state === 'kept' && d.noShowAt ? `· Didn’t come · marked by ${d.noShowBy ?? 'staff'} · ${day(d.noShowAt)}`
      : `· ${day(d.paidAt)}`;
  return (
    <section role="group" aria-label="Deposit" className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--wh-border)] px-5 py-2">
      {notCome ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          {badge('Not come in', 'amber')}
          <span>Booked for <span className={mono}>{`${shortDay(job.jobDate)}${job.startTime ? ` · ${job.startTime}` : ''}`}</span> · the bike hasn’t come in</span>
        </div>
      ) : null}
      {d ? (
        <div className="flex flex-wrap items-center gap-2">
          {badge(head[0], head[1])}
          <span className={`text-[13px] font-bold ${mono}`}>{pounds(d.pence)}</span>
          <span className="text-xs text-[var(--wh-muted)]">{side}</span>
          <span className="grow" />
          {d.state === 'refunded' ? null : <Button size="sm" onClick={onRefund}>Refund the deposit</Button>}
        </div>
      ) : null}
    </section>
  );
}

/** The drawn refund pop-up: the whole deposit, a reason (needed), where it goes (design 4). */
export function RefundDepositDialog({ job, onClose, onDone }: { job: WorkshopJob; onClose: () => void; onDone: () => void }) {
  const d = job.deposit;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!d) return null;
  async function refund() {
    if (!reason.trim()) { setError('Say why the deposit is being refunded'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}/deposit-refund`, { reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t refund that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="deposit-refund-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="deposit-refund-title">Refund the deposit</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{[job.customerName, job.title, job.reference].filter(Boolean).join(' · ')}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3 text-sm">
        <div className="flex min-h-10 items-center justify-between gap-3 border-y border-[var(--wh-border)]">
          <span>{`The whole deposit, paid ${day(d.paidAt)}`}</span>
          <span className={`font-semibold ${mono}`}>{pounds(d.pence)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="deposit-reason" className="text-[15px] font-semibold">Reason (needed)</label>
          <input id="deposit-reason" required aria-required="true" maxLength={200} value={reason}
            aria-invalid={error ? true : undefined} onChange={(e) => { setReason(e.target.value); setError(null); }}
            className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[15px]" />
        </div>
        <p className="m-0 text-[var(--wh-muted)]">It goes back to the card they paid with, within 5 to 10 working days.</p>
        {error ? <p role="alert" className="m-0 font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void refund()}>{`Refund ${pounds(d.pence)}`}</Button>
      </DialogFooter>
    </Dialog>
  );
}
