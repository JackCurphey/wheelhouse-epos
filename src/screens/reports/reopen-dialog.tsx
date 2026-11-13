import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CLOSE_DAY_QUERY } from '@/screens/till/close-the-day.tsx';

/**
 * Reopen this day (rp-reopen in generator/reports.mjs; openspec/changes/reports-accounts-and-reopen, reports
 * spec; audit H2): "Why are you reopening it? (needed)", the note, "Keep it closed" and "Reopen the day", which
 * stays off until a reason is typed. The refusals (not the latest day, already reopened) are the server's own
 * words, shown beside the box, which stays open.
 */
const FIELD = 'w-full rounded-[7px] border border-[var(--input)] bg-[var(--wh-panel)] min-h-11 px-2.5 py-[9px] text-sm aria-invalid:border-[var(--wh-danger)]';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Wed 16 September", as the drawing's title has it. */
const titleDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};

export function ReopenDialog({ id, day, onDone, onClose }: { id: number; day: string; onDone: () => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const reopen = useMutation({
    mutationFn: () => apiMutate(`/api/reports/days/${id}/reopen`, { reason: reason.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports-takings'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-day'] });
      void queryClient.invalidateQueries({ queryKey: CLOSE_DAY_QUERY });
      void queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      onDone();
    },
    onError: (err) => setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t reopen the day. Try again in a moment.'),
  });
  const ready = reason.trim() !== '';
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !reopen.isPending) onClose(); }} dismissOnBackdrop={false} aria-labelledby="re-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div><DialogTitle id="re-title">{`Reopen ${titleDay(day)}?`}</DialogTitle><DialogDescription>Its figures come out of the reports until it’s closed again</DialogDescription></div>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (ready && !reopen.isPending) { setProblem(null); reopen.mutate(); } }} className="contents">
        <DialogBody className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="re-reason" className="text-size-13-5 font-semibold">Why are you reopening it? (needed)</label>
            <input id="re-reason" className={FIELD} value={reason} placeholder="e.g. a card payment was counted as cash" autoFocus
              onChange={(e) => { setReason(e.target.value); setProblem(null); }} aria-invalid={problem ? true : undefined} aria-describedby={problem ? 're-error' : undefined} />
            {problem ? <p id="re-error" role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger)]">{problem}</p> : null}
          </div>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Saved with your name and the time. The day goes back to Needs attention, and what was sent to Xero is corrected when it’s closed again.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" disabled={reopen.isPending} onClick={onClose}>Keep it closed</Button>
          <Button type="submit" variant="primary" aria-disabled={!ready || undefined} className={ready ? 'min-h-11' : 'min-h-11 opacity-45'} disabled={reopen.isPending}>Reopen the day</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
