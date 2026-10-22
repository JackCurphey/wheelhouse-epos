import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * The job's checklist (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md):
 * its service's, written by the shop in Settings › Workshop › Checklists.
 * The bar under Notes (job-mechanic) says how far through it is and opens it
 * (job-checklist): collapsed rows of a tick and the item, a note box only
 * where a note exists, and "+ Add note" on the rest (Workshop day 21, 39, 58).
 * Each tick saves at once; a note saves when its box is left.
 */
export type JobChecklistData = {
  name: string;
  items: { label: string; done: boolean; note: string | null }[];
  done: number;
  total: number;
  notes: number;
};

const key = (jobId: number) => ['job-checklist', jobId];
export const progress = (c: JobChecklistData) => `${c.done} of ${c.total} done · ${c.notes} note${c.notes === 1 ? '' : 's'}`;

export function JobChecklistBar({ job }: { job: WorkshopJob }) {
  const checklist = useQuery({ queryKey: key(job.id), queryFn: () => apiGet<JobChecklistData | null>(`/api/workshop-jobs/${job.id}/checklist`) });
  const [open, setOpen] = useState(false);
  const c = checklist.data;
  if (!c) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 text-left text-sm hover:bg-[var(--wh-hover)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        <span className="grow font-semibold">{c.name}</span>
        <span className="text-[13px] text-[var(--wh-muted)]">{progress(c)}</span>
      </button>
      {open ? <ChecklistDialog job={job} checklist={c} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChecklistDialog({ job, checklist, onClose }: { job: WorkshopJob; checklist: JobChecklistData; onClose: () => void }) {
  const queryClient = useQueryClient();
  const finished = job.workState === 'complete';
  const [error, setError] = useState<string | null>(null);
  // Items whose note box is open: those with a note, and those "+ Add note" opened.
  const [noting, setNoting] = useState<ReadonlySet<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  // Saves in flight: a reply is shown only once none is left, so an older
  // reply never undoes a newer tick on screen (fresh review).
  const inFlight = useRef(0);
  const patch = (index: number, fields: Partial<JobChecklistData['items'][number]>) => {
    queryClient.setQueryData<JobChecklistData | null>(key(job.id), (c) => {
      if (!c) return c;
      const items = c.items.map((it, i) => (i === index ? { ...it, ...fields } : it));
      return { ...c, items, done: items.filter((i) => i.done).length, notes: items.filter((i) => i.note).length };
    });
  };

  // The tick or note shows at once, so a slow connection never leaves a
  // tapped box looking untapped; if the server refuses it, only that item's
  // change is put back, then the checklist is read again.
  async function change(index: number, body: { done?: boolean; note?: string | null }): Promise<boolean> {
    setError(null);
    await queryClient.cancelQueries({ queryKey: key(job.id) });
    const was = queryClient.getQueryData<JobChecklistData | null>(key(job.id))?.items[index];
    const note = body.note === undefined ? undefined : body.note?.trim() || null;
    patch(index, { ...(body.done === undefined ? {} : { done: body.done }), ...(note === undefined ? {} : { note }) });
    inFlight.current += 1;
    try {
      const saved = await apiMutate<JobChecklistData>(`/api/workshop-jobs/${job.id}/checklist/items/${index}`, body, { method: 'PUT' });
      inFlight.current -= 1;
      if (inFlight.current === 0) queryClient.setQueryData(key(job.id), saved);
      return true;
    } catch (err) {
      inFlight.current -= 1;
      if (was) patch(index, { ...(body.done === undefined ? {} : { done: was.done }), ...(note === undefined ? {} : { note: was.note }) });
      if (inFlight.current === 0) void queryClient.invalidateQueries({ queryKey: key(job.id) });
      setError(err instanceof ApiError ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
      return false;
    }
  }

  // A note saves when its box is left; a refused one keeps what was typed.
  async function leaveNote(index: number, draft = drafts[index]) {
    if (draft === undefined) return;
    if (draft.trim() === (checklist.items[index].note ?? '')) {
      setDrafts((d) => { const next = { ...d }; delete next[index]; return next; });
      return;
    }
    if (await change(index, { note: draft })) setDrafts((d) => { const next = { ...d }; delete next[index]; return next; });
  }

  // Closing (Done, the close button, Escape) saves a note still being typed:
  // the box goes before it can be left.
  function close() {
    for (const [i, draft] of Object.entries(drafts)) void leaveNote(Number(i), draft);
    onClose();
  }

  const sub = [job.title, job.reference, job.bikeLabel].filter(Boolean).join(' · ');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }} aria-labelledby="checklist-title"
      // Full screen on a phone with Done pinned below, as drawn (job-checklist, phone).
      className="md:max-w-[640px] max-md:open:flex max-md:h-full max-md:max-h-none max-md:max-w-none max-md:flex-col max-md:rounded-none">
      <DialogHeader>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <DialogTitle id="checklist-title">{checklist.name}</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{sub}</span>
        </div>
        <Button variant="primary" className="hidden md:inline-flex" onClick={close}>Done</Button>
        <button type="button" aria-label="Close, back to the job" onClick={close} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3 max-md:min-h-0 max-md:grow max-md:overflow-y-auto">
        <p className="m-0 text-sm text-[var(--wh-muted)]">{progress(checklist)}</p>
        {finished ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">Reopen the work to change its checklist.</p> : null}
        <ul className="m-0 flex max-w-[560px] list-none flex-col p-0">
          {checklist.items.map((item, i) => {
            const showNote = item.note !== null || noting.has(i);
            const noteId = `checklist-note-${i}`;
            return (
              <li key={`${i}-${item.label}`} className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] py-1 first:border-t-0">
                <div className="flex min-h-11 items-center gap-2.5">
                  <label className="flex min-h-11 grow cursor-pointer items-center gap-2.5 text-[15px]">
                    <input
                      type="checkbox" checked={item.done} disabled={finished}
                      onChange={(e) => void change(i, { done: e.target.checked })}
                      className="size-[22px] shrink-0 accent-[var(--accent-dark)]"
                    />
                    <span>{item.label}</span>
                  </label>
                  {!showNote && !finished ? (
                    <button
                      type="button" aria-label={`Add a note for ${item.label}`}
                      onClick={() => { setNoting(new Set(noting).add(i)); setTimeout(() => document.getElementById(noteId)?.focus(), 0); }}
                      className="min-h-11 shrink-0 px-2 text-sm font-semibold"
                    >+ Add note</button>
                  ) : null}
                </div>
                {showNote ? (
                  <textarea
                    id={noteId} aria-label={`Note for ${item.label}`} rows={2} maxLength={500} readOnly={finished}
                    value={drafts[i] ?? item.note ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [i]: e.target.value })}
                    onBlur={() => void leaveNote(i)}
                    className="ml-8 resize-y rounded-md border border-[var(--wh-border)] bg-[var(--wh-surface-muted)] px-2.5 py-2 text-sm leading-normal"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      {/* On a phone Done is pinned at the bottom (job-checklist, phone). */}
      <DialogFooter className="flex justify-end md:hidden">
        <Button variant="primary" block onClick={close}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}
