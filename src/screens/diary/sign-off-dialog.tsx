import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { shortDay } from './rules.ts';

/**
 * "Who’s signing this off?" (Jack, 16 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md;
 * drawn as signOffDrawings() in diary.mjs): the shop's mechanics as pills,
 * the job's own mechanic picked (answer 2), nobody on a shared-queue job
 * (answer 7). No PIN: tap the name (answer 6).
 */
type Person = { id: number; name: string; active?: boolean };

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {children}
    </button>
  );
}

export function SignOffDialog({ job, busy, onSign, onClose }: { job: WorkshopJob; busy: boolean; onSign: (mechanicId: number) => void; onClose: () => void }) {
  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => apiGet<Person[]>('/api/employees?role=mechanic') });
  const people = (mechanics.data ?? []).filter((m) => m.active !== false);
  const [picked, setPicked] = useState<number | null>(job.mechanicId ?? null);
  // The job's mechanic, while they're still one of the shop's mechanics.
  const chosen = people.some((p) => p.id === picked) ? picked : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="sign-off-title" className="md:max-w-[460px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="sign-off-title">Who’s signing this off?</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{`${job.title} · ${job.reference}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">Signing off says the work is done and the bike is fine to go out. If it comes back, the job shows who passed it.</p>
        <div role="radiogroup" aria-label="Signed off by" className="flex flex-wrap gap-2">
          {people.map((p) => <Pill key={p.id} on={chosen === p.id} onClick={() => setPicked(p.id)}>{p.name}</Pill>)}
        </div>
        {mechanics.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the mechanics. Try again in a moment.</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={chosen === null || busy} onClick={() => { if (chosen !== null) onSign(chosen); }}>Sign off and mark ready</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** "Thu 17 Sep, 15:30", in the shop's time (London), with the diary's own day words. */
export function signedOffWhen(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${shortDay(day)}, ${time}`;
}
