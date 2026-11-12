import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { changeWords, plural, when, type History, type Part, type Version, type VersionDetail, type WebsiteState } from './website-types.ts';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const failed = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t do that. Try again.');

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^[^,]*,/, ''));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function Problem({ words }: { words: string | null }) {
  return words ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{words}</p> : null;
}

/**
 * One part's form box (decided while building, 12 Nov: the drawings show
 * the photo's fields in heroPanel, website.mjs line 309, and nothing for
 * words, so words get one "Words" box). Save sends only that part's fields.
 */
export function PartBox({ part, onState, onSaved, onClose }: {
  part: Part;
  onState: (next: WebsiteState) => void;
  onSaved: (next: WebsiteState) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const hintId = useId();
  const file = useRef<HTMLInputElement>(null);
  const hasText = part.text !== undefined;
  const hasPhoto = 'photo' in part;
  const [text, setText] = useState(part.text ?? '');
  const [photo, setPhoto] = useState(part.photo ?? null);
  const [description, setDescription] = useState(part.description ?? '');
  const [decoration, setDecoration] = useState(!!part.decoration);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(chosen: File | undefined) {
    if (!chosen) return;
    if (!PHOTO_TYPES.includes(chosen.type)) { setProblem(`${chosen.name} isn’t a photo Wheelhouse can use. Choose a JPEG, PNG or WebP.`); return; }
    setBusy(true);
    setProblem(null);
    try {
      const next = await apiMutate<WebsiteState>(`/api/website/parts/${part.key}/photo`, { dataBase64: await readAsBase64(chosen), contentType: chosen.type }, { method: 'POST' });
      setPhoto(next.parts.find((p) => p.key === part.key)?.photo ?? null);
      onState(next);
    } catch (err) {
      setProblem(failed(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setProblem(null);
    const body: Record<string, unknown> = {};
    if (hasText) body.text = text;
    if (hasPhoto) { body.description = description; body.decoration = decoration; }
    try {
      onSaved(await apiMutate<WebsiteState>(`/api/website/parts/${part.key}`, body, { method: 'PUT' }));
    } catch (err) {
      setProblem(failed(err));
      setBusy(false);
    }
  }

  const field = 'w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 py-2';
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby={titleId}>
      <DialogHeader>
        <div>
          <DialogTitle id={titleId}>{part.name}</DialogTitle>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <Problem words={problem} />
        {hasText ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Words
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className={field} />
          </label>
        ) : null}
        {hasPhoto ? (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Photo</span>
              {photo ? <img src={photo} alt="" className="max-h-48 w-full rounded-lg object-cover" /> : <p className="m-0 text-sm text-[var(--wh-muted)]">No photo yet</p>}
              <input ref={file} type="file" accept={PHOTO_TYPES.join(',')} hidden onChange={(e) => void upload(e.target.files?.[0])} />
              <button type="button" disabled={busy} onClick={() => file.current?.click()} className="inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">{photo ? 'Change photo' : 'Add a photo'}</button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Describe the photo for people who can’t see it
              <Textarea rows={3} value={description} disabled={decoration} aria-describedby={hintId}
                placeholder="For example: the shop front on North Street, with bikes outside"
                onChange={(e) => setDescription(e.target.value)} className={field} />
            </label>
            <p id={hintId} className="m-0 text-size-13 text-[var(--wh-muted)]">Read out by screen readers, for blind and partially sighted customers.</p>
            <Checkbox label="This photo is only decoration" checked={decoration} onChange={(e) => setDecoration(e.target.checked)} />
          </>
        ) : null}
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">Customers see it when you publish.</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The Discard box (website.mjs line 367). */
export function DiscardBox({ state, busy, problem, onDiscard, onClose }: { state: WebsiteState; busy: boolean; problem: string | null; onDiscard: () => void; onClose: () => void }) {
  const titleId = useId();
  const subId = useId();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} dismissOnBackdrop={false} aria-labelledby={titleId} aria-describedby={subId} className="max-w-[540px]">
      <DialogHeader>
        <div>
          <DialogTitle id={titleId}>{`Discard your ${plural(state.changeCount, 'unpublished change')}?`}</DialogTitle>
          <DialogDescription id={subId}>{`Changes saved since you last published, on ${when(state.publishedAt)}`}</DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Problem words={problem} />
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {state.changes.map((c) => (
            <li key={c.page}><strong>{c.page}</strong>{changeWords(c) ? ` — ${changeWords(c)}` : ''}</li>
          ))}
        </ul>
        <p className="m-0 text-sm">{`Your website goes back to the last published version. The changes are kept in History for ${state.keepDays} days, in case you want them back.`}</p>
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>Keep editing</Button>
        <Button variant="danger" disabled={busy} onClick={onDiscard}>Discard changes</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** History, over the page (website.mjs line 369; decided while building, 12 Nov). */
export function HistoryBox({ changeCount, parts, onRestored, onClose }: {
  changeCount: number;
  parts: Part[];
  onRestored: (next: WebsiteState) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const subId = useId();
  const history = useQuery({ queryKey: ['website', 'history'], queryFn: () => apiGet<History>('/api/website/history') });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  async function goBack(id: number) {
    setBusy(true);
    setProblem(null);
    try {
      onRestored(await apiMutate<WebsiteState>(`/api/website/history/${id}/restore`, {}, { method: 'POST' }));
    } catch (err) {
      setProblem(failed(err));
      setBusy(false);
    }
  }

  const keepDays = history.data?.keepDays ?? 90;
  return (
    <Dialog open wide onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby={titleId} aria-describedby={subId}>
      <DialogHeader>
        <div>
          <DialogTitle id={titleId}>Earlier versions</DialogTitle>
          <DialogDescription id={subId}>{`Published versions, and drafts you discarded in the last ${keepDays} days`}</DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Problem words={problem ?? (history.error ? failed(history.error) : null)} />
        {changeCount ? (
          <p className="m-0 flex items-start gap-2 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5 text-sm">
            <NavIcon name="website" size={18} />
            {`You have ${plural(changeCount, 'unpublished change')}. Going back replaces them — they’re kept here, so you can come back to them.`}
          </p>
        ) : null}
        {history.data ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {history.data.versions.map((v) => (
              <VersionRow key={v.id} version={v} parts={parts} busy={busy} open={viewing === v.id}
                onView={() => setViewing(viewing === v.id ? null : v.id)} onGoBack={() => void goBack(v.id)} />
            ))}
          </ul>
        ) : history.isPending ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p> : null}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Going back puts that version in the editor as unpublished changes. Check it, then press Publish.</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

function VersionRow({ version: v, parts, busy, open, onView, onGoBack }: {
  version: Version; parts: Part[]; busy: boolean; open: boolean; onView: () => void; onGoBack: () => void;
}) {
  const date = when(v.at);
  const first = v.kind === 'discarded' ? `Unpublished draft · ${date}` : date;
  // A version with no one's name was already live on the old website (decision 14).
  const what = v.firstPublished ? 'First published' : v.changed.join(', ');
  const who = [`${v.kind === 'discarded' ? 'Discarded' : 'Published'}${v.by ? ` by ${v.by}` : ''}`, what].filter(Boolean).join(' · ');
  return (
    <li className="flex min-h-16 flex-col justify-center gap-2 border-t border-[var(--wh-border)] py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex grow flex-col gap-0.5">
          <span className="text-sm font-bold">{first}</span>
          <span className="text-size-13 text-[var(--wh-muted)]">{who}</span>
        </span>
        {v.current ? <span className="rounded-full bg-[var(--wh-ok-bg)] px-2.5 py-0.5 text-size-13 font-semibold text-[var(--wh-status-complete-ink)]">What customers see now</span> : (
          <>
            <Button variant="ghost" aria-expanded={open} onClick={onView}>View</Button>
            <Button disabled={busy} onClick={onGoBack}>Go back to this</Button>
          </>
        )}
      </div>
      {open ? <VersionWords id={v.id} parts={parts} /> : null}
    </li>
  );
}

/** "View": that version's words, part by part. */
function VersionWords({ id, parts }: { id: number; parts: Part[] }) {
  const detail = useQuery({ queryKey: ['website', 'history', id], queryFn: () => apiGet<VersionDetail>(`/api/website/history/${id}`) });
  if (detail.error) return <Problem words={failed(detail.error)} />;
  if (!detail.data) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  const saved = (detail.data.content as { parts?: Record<string, { text?: string; description?: string }> }).parts ?? {};
  return (
    <dl className="m-0 flex flex-col gap-1.5 text-sm">
      {parts.map((p) => {
        const words = saved[p.key]?.text ?? saved[p.key]?.description;
        return words ? (
          <div key={p.key} className="flex flex-col">
            <dt className="font-bold">{p.name}</dt>
            <dd className="m-0 whitespace-pre-wrap text-[var(--wh-muted)]">{words}</dd>
          </div>
        ) : null;
      })}
    </dl>
  );
}
