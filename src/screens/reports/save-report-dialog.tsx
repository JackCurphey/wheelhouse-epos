import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChoiceChip, Reasons } from './choice-chips.tsx';
import type { SavedReport } from './changed-format.ts';

/**
 * Save as my report (rp-save and rp-save-taken in generator/reports.mjs; openspec/changes/
 * reports-your-own, decisions 7 to 9; audit M5): what the report is under the title, "Name (needed)",
 * "Who can see it" with "Just me" chosen and "Me and the other managers" greyed with its reason until
 * staff roles bring managers, the note, Cancel and Save. No name, or a name the person already has, is
 * refused beside the field, and the popup stays as typed.
 */
const FIELD = 'w-full rounded-[7px] border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 py-[9px] text-sm aria-invalid:border-[var(--wh-danger)]';
const NO_MANAGERS = 'there are no managers until staff roles are set up';

export type ToSave = { base: string; measure: string; split: string; only: string[]; supplier: string; period: string };

export function SaveReportDialog({ what, report, onSaved, onClose }: { what: string; report: ToSave; onSaved: (saved: SavedReport) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => apiMutate<SavedReport>('/api/reports/saved', { name: name.trim(), ...report, shared: false }),
    onSuccess: (saved) => { void queryClient.invalidateQueries({ queryKey: ['reports-saved'] }); onSaved(saved); },
    onError: (err) => setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t save this report. Try again in a moment.'),
  });
  function submit() {
    if (!name.trim()) { setProblem('Type its name'); return; }
    setProblem(null);
    save.mutate();
  }
  const who = [{ value: 'me', label: 'Just me' }, { value: 'managers', label: 'Me and the other managers', why: NO_MANAGERS }];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="sv-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div><DialogTitle id="sv-title">Save as my report</DialogTitle><DialogDescription>{what}</DialogDescription></div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="sv-name" className="text-size-13-5 font-semibold">Name (needed)</label>
          <input id="sv-name" className={FIELD} value={name} onChange={(e) => { setName(e.target.value); setProblem(null); }} autoFocus
            aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'sv-name-error' : undefined} />
          {problem ? <p id="sv-name-error" role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger)]">{problem}</p> : null}
        </div>
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-size-15 font-bold">Who can see it</legend>
          <div className="flex flex-wrap gap-1.5">{who.map((c) => <ChoiceChip key={c.value} role="radio" group="who" choice={c} checked={c.value === 'me'} onChoose={() => {}} />)}</div>
          <Reasons choices={who} />
        </fieldset>
        <p className="m-0 text-sm text-[var(--wh-muted)]">It opens on the latest period each time, under “Your reports”.</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={save.isPending} onClick={submit}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
