import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { refusalText } from './refusal-words.ts';
import { readBase64 } from '@/lib/read-base64.ts';

/**
 * "Files and photos" on the job page (Jack, 18 Oct,
 * docs/decisions/2026-10-18-attachments-and-delete.md answer 3, drawn on
 * job-files): photos as small pictures that open larger, other files by name
 * and size, the customer's booking photos marked "From the customer", "Add
 * file or photo", and "Remove", which asks first. The server takes any file
 * up to 15MB, sent as base64 in JSON.
 */
type Attachment = { id: number; originalName: string; contentType: string; sizeBytes: number; uploadedAt: string; fromCustomer: boolean };

export const MAX_BYTES = 15 * 1024 * 1024;
export const TOO_LARGE = 'That file is too large (max 15MB).';
const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isPhoto = (a: Attachment) => a.contentType.startsWith('image/');

// Shared with the phone's photo step (src/lib/read-base64.ts).
export { readBase64 };

const REMOVE = 'min-h-11 self-start px-0.5 text-size-13 font-semibold text-[var(--wh-danger)] underline underline-offset-2';

export function JobFiles({ jobId }: { jobId: number }) {
  const queryClient = useQueryClient();
  const key = ['workshop-job-files', jobId];
  const files = useQuery({ queryKey: key, queryFn: () => apiGet<Attachment[]>(`/api/workshop-jobs/${jobId}/attachments`) });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [larger, setLarger] = useState<Attachment | null>(null);
  const url = (a: Attachment) => `/api/workshop-jobs/${jobId}/attachments/${a.id}`;

  async function add(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) { setError(TOO_LARGE); return; }
    setBusy(true);
    try {
      const dataBase64 = await readBase64(file);
      await apiMutate(`/api/workshop-jobs/${jobId}/attachments`, { filename: file.name, contentType: file.type || 'application/octet-stream', dataBase64 }, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (err) {
      setError(refusalText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(a: Attachment) {
    setRemoving(null);
    setError(null);
    try {
      await apiMutate(url(a), undefined, { method: 'DELETE' });
      // A quote line's photo is one of these files: removing it takes it off
      // the line, so the quote is read again too (fresh review).
      await Promise.all([queryClient.invalidateQueries({ queryKey: key }), queryClient.invalidateQueries({ queryKey: ['quote'] })]);
    } catch (err) {
      setError(refusalText(err));
    }
  }

  const list = files.data ?? [];
  const photos = list.filter(isPhoto);
  const others = list.filter((a) => !isPhoto(a));
  return (
    <section aria-labelledby="job-files" className="flex flex-col gap-2 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 pt-2.5 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="job-files" className="m-0 text-sm font-bold">Files and photos</h3>
        {/* A file input behind the button: on a tablet or phone it offers the camera too. */}
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]">
          {busy ? 'Adding…' : 'Add file or photo'}
          <input ref={input} type="file" className="sr-only" disabled={busy} aria-label="Add file or photo" onChange={(e) => void add(e.target.files?.[0])} />
        </label>
      </div>
      {files.isError ? <p className="m-0 text-sm text-[var(--wh-muted)]">Couldn&apos;t load the files.</p> : null}
      {files.isSuccess && list.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No files or photos yet.</p> : null}
      {photos.length ? (
        <div className="flex flex-wrap gap-2.5">
          {photos.map((a) => (
            <figure key={a.id} className="m-0 flex w-24 flex-col gap-1">
              <button type="button" aria-label={`Open ${a.originalName} larger`} onClick={() => setLarger(a)} className="overflow-hidden rounded-lg border border-[var(--wh-border)]">
                <img src={url(a)} alt={a.originalName} className="aspect-[4/3] w-full object-cover" />
              </button>
              {a.fromCustomer ? <figcaption className="text-xs text-[var(--wh-muted)]">From the customer</figcaption> : null}
              <button type="button" aria-label={`Remove ${a.originalName}`} onClick={() => setRemoving(a)} className={REMOVE}>Remove</button>
            </figure>
          ))}
        </div>
      ) : null}
      {others.map((a) => (
        <div key={a.id} className="flex min-h-11 items-center gap-2.5 border-t border-[var(--wh-border)] text-sm">
          <a href={url(a)} download={a.originalName} className="flex min-h-11 min-w-0 grow items-center underline underline-offset-2"><span className="truncate">{a.originalName}</span></a>
          <span className="shrink-0 text-[var(--wh-muted)]">{`· ${sizeText(a.sizeBytes)}`}</span>
          {a.fromCustomer ? <span className="shrink-0 text-xs text-[var(--wh-muted)]">From the customer</span> : null}
          <button type="button" aria-label={`Remove ${a.originalName}`} onClick={() => setRemoving(a)} className={REMOVE}>Remove</button>
        </div>
      ))}
      {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}

      <Dialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null); }} aria-labelledby="remove-file-title">
        <DialogHeader>
          <DialogTitle id="remove-file-title">{removing ? `Remove ${removing.originalName}?` : ''}</DialogTitle>
        </DialogHeader>
        <DialogBody><p className="m-0 text-sm">It is removed from this job. This can’t be undone.</p></DialogBody>
        <DialogFooter className="flex justify-between gap-2.5">
          <Button variant="ghost" className="min-h-11" onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="danger" className="min-h-11" onClick={() => { if (removing) void remove(removing); }}>Remove</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={larger !== null} onOpenChange={(o) => { if (!o) setLarger(null); }} aria-labelledby="photo-title">
        <DialogHeader>
          <DialogTitle id="photo-title">{larger?.originalName ?? ''}</DialogTitle>
          <button type="button" aria-label="Close" onClick={() => setLarger(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </DialogHeader>
        <DialogBody>{larger ? <img src={url(larger)} alt={larger.originalName} className="max-h-[70vh] w-full object-contain" /> : null}</DialogBody>
      </Dialog>
    </section>
  );
}
