import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { dayLabel, hhmm } from './rules.ts';

/**
 * Offer another time (Jack, 20 Oct, docs/decisions/2026-10-20-offer-another-time.md;
 * drawn as request-offer): the time picked in the diary, a message to the
 * customer started for them, and Offer this time. The suggested time is kept
 * free for the customer and the time they asked for let go (answer 1); they
 * answer on their booking page.
 */
export type OfferAt = { date: string; startMin: number; mechanicId: number | null };

/** The request's length: its planned minutes, else its own times, else an hour (the server's rule). */
export function requestMinutes(job: Pick<WorkshopJob, 'plannedMinutes' | 'startTime' | 'endTime'>): number {
  if (job.plannedMinutes) return job.plannedMinutes;
  if (job.startTime && job.endTime) {
    const [sh, sm] = job.startTime.split(':').map(Number);
    const [eh, em] = job.endTime.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }
  return 60;
}

function refusal(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'stale') return 'This request changed while you were looking at it. Press Keep request to see it as it is now.';
    if (err.code === 'capacity') return 'That time is no longer free. Choose another time.';
    if (err.status === 404) return 'This request no longer exists.';
    return err.message;
  }
  if (err instanceof TypeError) return "Couldn't reach the server — try again.";
  return 'Something went wrong.';
}

export function OfferDialog({ job, at, people, onChooseAgain, onKeep, onOffered }: {
  job: WorkshopJob; at: OfferAt; people: { id: number; name: string }[];
  onChooseAgain: () => void; onKeep: () => void; onOffered: () => void;
}) {
  const queryClient = useQueryClient();
  const customer = job.customerName || 'Customer';
  const first = customer.split(' ')[0];
  const day = dayLabel(at.date);
  const time = hhmm(at.startMin);
  const mechanic = people.find((p) => p.id === at.mechanicId)?.name ?? null;
  const [message, setMessage] = useState(`Sorry, we can’t fit this service in when you asked. Would ${day} at ${time} work instead?`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function offer() {
    setSending(true);
    setError(null);
    try {
      await jobAction(job.id, 'offer', job.version, { jobDate: at.date, startTime: time, mechanicId: at.mechanicId, message });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
      ]);
      onOffered();
    } catch (err) {
      setError(refusal(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onKeep(); }} aria-labelledby="offer-title" aria-describedby="offer-sub">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="offer-title">Offer another time</DialogTitle>
          <DialogDescription id="offer-sub">{[customer, job.bikeLabel].filter(Boolean).join(' · ')}</DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <p className="m-0 text-xs font-bold tracking-wide text-[var(--wh-muted)] uppercase">{`Asked for ${dayLabel(job.jobDate)} · ${requestMinutes(job)} minutes`}</p>
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-2">
          <span className="grow text-sm"><strong>{`${day}, ${time}`}</strong>{mechanic ? ` · ${mechanic}` : ''}</span>
          <button type="button" onClick={onChooseAgain} className="min-h-11 text-sm font-semibold underline">Choose another time</button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="offer-msg" className="text-sm font-semibold">{`Message to ${first}`}</label>
          <textarea id="offer-msg" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)}
            className="resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-sm leading-normal" />
        </div>
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">{`${first} sees the time and your message on their booking page, and accepts it or cancels. ${day} at ${time} is kept free for them; the time they asked for is let go.`}</p>
        {/* The server needs a mechanic for the time (fresh review). */}
        {mechanic === null && <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">No mechanic is free to take this time. Choose another time, in a mechanic’s column.</p>}
        {error && <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p>}
      </DialogBody>
      <DialogFooter className="flex w-full flex-col gap-2">
        <Button variant="accent" block disabled={sending || mechanic === null} onClick={() => void offer()}>Offer this time</Button>
        <Button block disabled={sending} onClick={onKeep}>Keep request</Button>
      </DialogFooter>
    </Dialog>
  );
}
