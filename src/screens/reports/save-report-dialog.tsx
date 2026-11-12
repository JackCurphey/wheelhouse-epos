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

/**
 * The name popup both ways: "Save as my report" (with who can see it) and "Rename" (only the name, with the
 * same two name messages; design decision 11). `send` makes the change for the name typed; `firstProblem`
 * opens it already saying why (Undo after the name was used again).
 */
export function NameDialog({ title, what, initial = '', firstProblem = null, withWho, send, onDone, onClose }: {
  title: string; what: string; initial?: string; firstProblem?: string | null; withWho: boolean;
  send: (name: string) => Promise<unknown>; onDone: (result: unknown) => void; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial);
  const [problem, setProblem] = useState<string | null>(firstProblem);
  const save = useMutation({
    mutationFn: () => send(name.trim()),
    onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: ['reports-saved'] }); onDone(result); },
    onError: (err) => setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t save this report. Try again in a moment.'),
  });
  function submit() {
    if (!name.trim()) { setProblem('Type its name'); return; }
    setProblem(null);
    save.mutate();
  }
  const who = [{ value: 'me', label: 'Just me' }, { value: 'managers', label: 'Me and the other managers', why: NO_MANAGERS }];
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }} dismissOnBackdrop={false} aria-labelledby="sv-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div><DialogTitle id="sv-title">{title}</DialogTitle><DialogDescription>{what}</DialogDescription></div>
      </DialogHeader>
      <form id="sv-form" onSubmit={(e) => { e.preventDefault(); submit(); }} className="contents">
      <DialogBody className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="sv-name" className="text-size-13-5 font-semibold">Name (needed)</label>
          <input id="sv-name" className={FIELD} value={name} onChange={(e) => { setName(e.target.value); setProblem(null); }} autoFocus
            aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'sv-name-error' : undefined} />
          {problem ? <p id="sv-name-error" role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger)]">{problem}</p> : null}
        </div>
        {withWho ? (
        <>
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-size-15 font-bold">Who can see it</legend>
          <div className="flex flex-wrap gap-1.5">{who.map((c) => <ChoiceChip key={c.value} role="radio" group="who" choice={c} checked={c.value === 'me'} onChoose={() => {}} />)}</div>
          <Reasons choices={who} />
        </fieldset>
        <p className="m-0 text-sm text-[var(--wh-muted)]">It opens on the latest period each time, under “Your reports”.</p>
        </>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>Save</Button>
      </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Save as my report: what the report is, a name, and (until managers exist) just me. */
export function SaveReportDialog({ what, report, onSaved, onClose }: { what: string; report: ToSave; onSaved: (saved: SavedReport) => void; onClose: () => void }) {
  return (
    <NameDialog
      title="Save as my report" what={what} withWho onClose={onClose}
      send={(name) => apiMutate<SavedReport>('/api/reports/saved', { name, ...report, shared: false })}
      onDone={(saved) => onSaved(saved as SavedReport)}
    />
  );
}
