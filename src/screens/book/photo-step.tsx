import * as React from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Camera, Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { PHOTO_TYPES } from '@/components/ui/photo-picker';
import { readBase64 } from '@/lib/read-base64.ts';
import { BookFrame, PinnedRoom } from './frame.tsx';

/**
 * Use my phone, the phone's side (openspec/changes/use-my-phone; drawn as
 * phone-photo-ready, -check, -done and -expired, approved by Jack on 23 Oct,
 * docs/decisions/2026-10-23-use-my-phone.md). The page a code opens, with no
 * sign-in: the line, the job and bike, its reason; take or choose one photo,
 * check it, send it. A code that has run out or been used says so and shows
 * nothing about the job. Nothing about the customer is ever sent here.
 */
type View = { shopName: string; reference: string; bike: string | null; line: string; reason: string | null };

const MAX_BYTES = 10 * 1024 * 1024;
const GONE_TITLE = 'This code has expired or has already been used';

const isGone = (err: unknown) => err instanceof ApiError && (err.status === 410 || err.status === 404);

export function PhotoStepScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const url = `/api/portal/${encodeURIComponent(shopSlug)}/photo-codes/${encodeURIComponent(code)}`;
  const view = useQuery({ queryKey: ['photo-code', shopSlug, code], queryFn: () => apiGet<View>(url), retry: false, refetchOnWindowFocus: false });
  const [picked, setPicked] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);
  const [refused, setRefused] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<'added' | 'gone' | null>(null);

  // The picked photo's preview, let go when it changes or the page closes.
  const preview = React.useMemo(() => (picked ? URL.createObjectURL(picked) : null), [picked]);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // The booking page's photo rules, said on the phone before anything is sent.
  function pick(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { setRefused(`${file.name} isn't a JPEG, PNG or WebP photo.`); return; }
    if (file.size > MAX_BYTES) { setRefused(`${file.name} is over 10 MB.`); return; }
    setRefused(null);
    setPicked(file);
  }

  async function send() {
    if (!picked) return;
    setSending(true);
    setRefused(null);
    try {
      await apiMutate(url, { dataBase64: await readBase64(picked) }, { method: 'POST' });
      setOutcome('added');
    } catch (err) {
      if (isGone(err)) setOutcome('gone');
      // The server's own words for a photo it refused (400); anything else,
      // a server or network failure, in plain words.
      else setRefused(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'The photo couldn’t be sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (view.isPending) return <BookFrame title="Loading…">{null}</BookFrame>;
  if (outcome === 'gone' || (view.isError && isGone(view.error))) {
    return (
      <BookFrame title={GONE_TITLE}>
        <RoundIcon tone="warn"><TriangleAlert size={24} aria-hidden="true" /></RoundIcon>
        <p className="m-0">Make a new one on the computer.</p>
      </BookFrame>
    );
  }
  if (view.isError || !view.data) {
    return (
      <BookFrame title="We couldn’t open this code">
        <Button variant="accent" onClick={() => view.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  const v = view.data;
  const where = `${v.reference}${v.bike ? ` · ${v.bike}` : ''}`;

  if (outcome === 'added') {
    return (
      <BookFrame title={`Photo added to ${v.reference}`}>
        <RoundIcon tone="ok"><Check size={24} aria-hidden="true" /></RoundIcon>
        <p role="status" className="m-0">{`It’s on the computer now, under ${v.line}. You can close this page.`}</p>
      </BookFrame>
    );
  }

  const refusal = refused ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{refused}</p> : null;

  if (picked) {
    return (
      <BookFrame title="Check the photo">
        <div className="flex flex-col gap-3">
          <p className="m-0">{`For ${v.line} on ${v.reference}.`}</p>
          {preview ? <img src={preview} alt="The photo you just took" className="max-h-[60vh] w-full rounded-md object-contain" /> : null}
          {refusal}
        </div>
        <PinnedChoices>
          <Button variant="accent" block className="min-h-12" disabled={sending} onClick={() => void send()}>Use this photo</Button>
          <Button block className="min-h-12" disabled={sending} onClick={() => setPicked(null)}>Take another</Button>
        </PinnedChoices>
      </BookFrame>
    );
  }

  // The two ways in are file inputs styled as the drawn buttons: one asks for
  // the camera, the other for the phone's photos. Pinned along the bottom, as
  // drawn (phone-photo-ready), where the frame keeps room for them.
  const choice = 'flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]';
  return (
    <BookFrame title={`Add a photo for ${v.line}`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 rounded-md bg-[var(--wh-surface-muted)] px-3 py-2">
          <span className="font-semibold">{where}</span>
          {v.reason ? <span className="text-sm text-[var(--wh-muted)]">{v.reason}</span> : null}
        </div>
        {refusal}
      </div>
      <PinnedChoices>
        <label className={`${choice} bg-[var(--wh-ink)] text-[var(--wh-panel)]`}>
          <Camera size={18} aria-hidden="true" />
          <span aria-hidden="true">Take a photo</span>
          <input type="file" accept={PHOTO_TYPES.join(',')} capture="environment" className="sr-only" aria-label="Take a photo"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
        </label>
        <label className={`${choice} border border-[var(--wh-input-border)] bg-[var(--wh-panel)]`}>
          <span aria-hidden="true">Choose from your photos</span>
          <input type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" aria-label="Choose from your photos"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
        </label>
      </PinnedChoices>
    </BookFrame>
  );
}

/** The photo step's two buttons, pinned along the bottom with room kept for them (PinnedRoom). */
function PinnedChoices({ children }: { children: React.ReactNode }) {
  const askRoom = React.useContext(PinnedRoom);
  React.useEffect(() => {
    askRoom(9);
    return () => askRoom(0);
  }, [askRoom]);
  return (
    <div data-book-pinned className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3">
      <div className="mx-auto flex max-w-md flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** The drawn round icon on the done and expired pages (roundIcon in diary.mjs). */
function RoundIcon({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-state-ready-ink)]' : 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]';
  return <span className={`mb-3 inline-flex size-12 items-center justify-center rounded-full ${look}`}>{children}</span>;
}

