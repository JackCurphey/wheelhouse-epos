import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/**
 * Pick dates (rp-pick-dates; audit M8): From and To, "Compared with the same
 * number of days just before.", Cancel and Show report. To before From, or a
 * day after today, is refused with a message beside the field, as the server
 * refuses it (server/lib/report-periods.js).
 */
const FIELD = 'w-full rounded-[7px] border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 py-[9px] text-sm aria-invalid:border-[var(--wh-danger)]';

export function PickDates({ subtitle, today, from, to, onShow, onClose }: {
  subtitle: string; today: string; from: string; to: string; onShow: (from: string, to: string) => void; onClose: () => void;
}) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [problem, setProblem] = useState<{ field: 'from' | 'to'; text: string } | null>(null);
  function show() {
    if (!a) return setProblem({ field: 'from', text: 'Pick a From date' });
    if (!b) return setProblem({ field: 'to', text: 'Pick a To date' });
    if (b < a) return setProblem({ field: 'to', text: 'To is before From: pick a To on or after From' });
    if (b > today) return setProblem({ field: 'to', text: "To can't be after today" });
    onShow(a, b);
  }
  const field = (id: 'from' | 'to', label: string, value: string, set: (v: string) => void) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`pd-${id}`} className="text-size-13-5 font-semibold">{label}</label>
      <input id={`pd-${id}`} type="date" className={FIELD} value={value} max={today} onChange={(e) => { set(e.target.value); setProblem(null); }}
        aria-invalid={problem?.field === id ? true : undefined} aria-describedby={problem?.field === id ? `pd-${id}-error` : undefined} />
      {problem?.field === id ? <p id={`pd-${id}-error`} role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger)]">{problem.text}</p> : null}
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="pd-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div><DialogTitle id="pd-title">Pick dates</DialogTitle><DialogDescription>{subtitle}</DialogDescription></div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">{field('from', 'From', a, setA)}{field('to', 'To', b, setB)}</div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">Compared with the same number of days just before.</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={show}>Show report</Button>
      </DialogFooter>
    </Dialog>
  );
}
