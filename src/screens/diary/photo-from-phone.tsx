import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Check, Smartphone } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { refusalText } from './refusal-words.ts';
import { useMedia } from './diary-bits.tsx';

/**
 * Use my phone, the computer's side (openspec/changes/use-my-phone; drawn as
 * job-photo-choice, job-photo-phone and job-photo-phone-added, approved by
 * Jack on 23 Oct, docs/decisions/2026-10-23-use-my-phone.md).
 */

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** A computer: a mouse-like pointer and a window as wide as a computer's (as the quote bar decides it). */
function useIsComputer() {
  const coarse = useMedia('(pointer: coarse)');
  const narrow = useMedia('(max-width: 1023px)');
  return !coarse && !narrow;
}

/**
 * A draft line's Add photo. On a computer it opens a menu: "Choose a file" or
 * "Use my phone" (job-photo-choice). On a tablet or phone it goes straight to
 * the camera or file picker, as before.
 */
export function AddLinePhoto({ description, disabled, onFile, onPhone }: {
  description: string; disabled: boolean; onFile: (file: File | undefined) => void; onPhone: () => void;
}) {
  const computer = useIsComputer();
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const name = `Add photo for ${description}`;

  // Opening moves focus to the first item, as the diary's menus do (JobMenu);
  // a click elsewhere closes it.
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => { if (!holder.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  // Closing hands focus back to Add photo, where the pop-up returns it too.
  const close = () => { setOpen(false); button.current?.focus(); };
  function onMenuKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') {
      // Stopped here, or the job page's own dialog would close with the menu.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const fileInput = (label: string, tabbable: boolean) => (
    <input ref={input} type="file" accept={PHOTO_ACCEPT} className="sr-only" disabled={disabled} aria-label={label} tabIndex={tabbable ? undefined : -1}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onFile(f); }} />
  );
  const look = 'inline-flex min-h-11 self-start items-center gap-1 rounded-md border border-dashed border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 text-xs font-semibold no-underline';

  if (!computer) {
    return (
      <label className={`${look} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]`}>
        <Camera size={13} aria-hidden="true" />
        <span aria-hidden="true">Add photo</span>
        {fileInput(name, true)}
      </label>
    );
  }
  const item = 'flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-semibold hover:bg-[var(--wh-surface-muted)] focus-visible:bg-[var(--wh-surface-muted)]';
  return (
    <span ref={holder} className="relative inline-flex self-start">
      <button ref={button} type="button" className={look} disabled={disabled} aria-label={name} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Camera size={13} aria-hidden="true" />
        <span aria-hidden="true">Add photo</span>
      </button>
      {/* Reached through Choose a file, so not a Tab stop of its own. */}
      {fileInput(`Choose a file for ${description}`, false)}
      {open ? (
        // Opens upwards from the button's right edge, as drawn, so the job
        // page's footer doesn't cut it off.
        <div ref={menu} role="menu" aria-label={name} onKeyDown={onMenuKey}
          className="absolute right-0 bottom-full z-20 mb-1 flex w-64 flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-lg">
          <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={() => { close(); input.current?.click(); }}>Choose a file</button>
          <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={() => { close(); onPhone(); }}>Use my phone</button>
          <p className="m-0 mt-1 border-t border-[var(--wh-border)] px-3 pt-2 pb-2 text-xs text-[var(--wh-muted)]">Use my phone shows a code to scan with your phone’s camera.</p>
        </div>
      ) : null}
    </span>
  );
}

type Made = { codeId: number; url: string; expiresAt: string };
type Status = { state: 'waiting' } | { state: 'added'; attachmentId: number | null } | { state: 'expired' };

/** How often the pop-up asks how the photo is coming (3 seconds; the tests shorten it). */
const pollEvery = () => (window as unknown as { WH_PHOTO_CODE_POLL_MS?: number }).WH_PHOTO_CODE_POLL_MS ?? 3000;

/** The address as an SVG QR code, for an <img>. */
function qrImage(address: string) {
  const qr = qrcode(0, 'M');
  qr.addData(address);
  qr.make();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }))}`;
}

/**
 * "Add a photo from your phone" (job-photo-phone, then job-photo-phone-added
 * by itself once the photo arrives). Makes a code for the line at
 * `linePosition` of the draft `quoteId` when it opens, and again on "Make a
 * new code" once one has run out.
 */
export function PhotoFromPhoneDialog({ jobId, quoteId, linePosition, description, reference, onClose, onAdded }: {
  jobId: number; quoteId: number; linePosition: number; description: string; reference: string; onClose: () => void; onAdded: () => void;
}) {
  const [made, setMade] = useState<Made | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    apiMutate<Made>(`/api/workshop-jobs/${jobId}/quote-photo-codes`, { quoteId, linePosition }, { method: 'POST' })
      .then((m) => { if (live) setMade(m); })
      .catch((err) => { if (live) setError(refusalText(err)); });
    return () => { live = false; };
  }, [jobId, quoteId, linePosition, attempt]);

  const status = useQuery({
    queryKey: ['photo-code', jobId, made?.codeId],
    queryFn: () => apiGet<Status>(`/api/workshop-jobs/${jobId}/quote-photo-codes/${made?.codeId}`),
    enabled: Boolean(made),
    refetchInterval: (q) => (q.state.data && q.state.data.state !== 'waiting' ? false : pollEvery()),
  });
  const state = status.data?.state ?? 'waiting';

  // Cancel, Close or Escape before a photo came switch the code off, so none
  // can arrive unseen; after it came, closing is Done.
  function cancel() {
    if (made && state === 'waiting') {
      void apiMutate(`/api/workshop-jobs/${jobId}/quote-photo-codes/${made.codeId}`, undefined, { method: 'DELETE' }).catch(() => {});
    }
    onClose();
  }
  const again = () => { setMade(null); setError(null); setAttempt((n) => n + 1); };

  // One status line, always in the same place, so a screen reader hears each
  // change: making the code, waiting, added, expired.
  const said = state === 'added' ? 'Photo added' : state === 'expired' ? 'This code has expired.' : made ? 'Waiting for the photo…' : error ? '' : 'Making the code…';
  const statusLook = state === 'added' ? 'flex items-center gap-2 text-lg font-bold text-[var(--wh-state-ready-ink)]'
    : state === 'expired' ? 'font-semibold' : 'flex items-center gap-2 text-sm';
  const statusIcon = state === 'added' ? <Check size={20} aria-hidden="true" /> : made && state === 'waiting' ? <Smartphone size={16} aria-hidden="true" /> : null;
  const statusLine = <p role="status" className={`m-0 ${statusLook}`}>{statusIcon}{said}</p>;

  let before: ReactNode = null;
  let after: ReactNode;
  let footer: ReactNode;
  if (state === 'added') {
    const added = status.data as { state: 'added'; attachmentId: number | null };
    after = (
      <>
        {added.attachmentId ? <img src={`/api/workshop-jobs/${jobId}/attachments/${added.attachmentId}`} alt="The photo from your phone" className="max-h-56 w-full rounded-md object-contain" /> : null}
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`It’s on ${description} now, and the code no longer works.`}</p>
      </>
    );
    footer = <Button variant="accent" onClick={onAdded}>Done</Button>;
  } else if (state === 'expired') {
    // Not drawn: the code ran out (or the quote changed) before a photo came.
    after = <p className="m-0 text-sm text-[var(--wh-muted)]">Make a new one to try again.</p>;
    footer = (
      <>
        <Button onClick={cancel}>Close</Button>
        <Button variant="accent" onClick={again}>Make a new code</Button>
      </>
    );
  } else {
    before = (
      <>
        <p className="m-0 text-size-15">{`Scan this code with your phone’s camera. It opens the photo step for ${description} on ${reference}.`}</p>
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
        {made ? <img src={qrImage(made.url)} alt="A code to scan with your phone’s camera" className="mx-auto size-52 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1" /> : null}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Works for 15 minutes, for this photo only. No sign-in needed.</p>
      </>
    );
    after = made ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">No camera app? Open <span className="font-mono break-all text-[var(--wh-ink)]">{made.url}</span> on your phone.</p> : null;
    footer = (
      <>
        <Button onClick={cancel}>Cancel</Button>
        {error ? <Button variant="accent" onClick={again}>Try again</Button> : null}
      </>
    );
  }
  const body = [before, statusLine, after];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { if (state === 'added') onAdded(); else cancel(); } }} aria-labelledby="photo-phone-title" className="md:max-w-[460px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="photo-phone-title">Add a photo from your phone</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{`${description} · ${reference}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">{body[0]}{body[1]}{body[2]}</DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">{footer}</DialogFooter>
    </Dialog>
  );
}
