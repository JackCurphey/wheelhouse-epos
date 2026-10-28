import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';

/**
 * The till PIN pop-up (signin.mjs pinDialog: pin-change, pin-first and
 * till-give-pin; signing in decision 7): Wheelhouse picks a four-digit PIN
 * nobody else at the shop has, shown once; "Give me a different one" picks
 * another; only "Keep this PIN" keeps it. Your settings uses it for your own
 * PIN (openspec/changes/pins-and-checkin), and the till for someone else's
 * (openspec/changes/give-pin-at-till). The focus goes to Keep this PIN once
 * the PIN comes. With a ✕, Escape closes it as the ✕ does; without one
 * (the first-time version) Escape does nothing, and if the browser closes it
 * anyway it opens again (the float check's pattern).
 */
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const PICK_FAILED = 'Wheelhouse couldn’t pick a PIN. Try again in a moment.';

export function PinOfferDialog({ title, intro, foot, pinWords, closeLabel, offerPath, keepPath, onKept, onClose, extra }: {
  title: string;
  intro: string;
  foot: string;
  /** What a screen reader says before the digits ("New PIN", "[Name]’s PIN"). */
  pinWords: string;
  /** The ✕'s words; none for the first-time version. */
  closeLabel: string | null;
  offerPath: string;
  keepPath: string;
  onKept: () => Promise<void> | void;
  onClose: () => void;
  /** Another way out under the two buttons (Skip for now). */
  extra?: ReactNode;
}) {
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(0);
  const keepRef = useRef<HTMLButtonElement>(null);

  // A PIN Wheelhouse picked, shown once: one on opening, another for "Give me a different one".
  // One at a time: another can't be asked for until this one comes (review, 28 Oct, item 5).
  const [asking, setAsking] = useState(true);
  const asked = useRef(true);
  const ask = () => apiMutate<{ pin: string }>(offerPath, {}).then(
    (r) => setPin(r.pin),
    (err) => setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : PICK_FAILED),
  ).finally(() => { asked.current = false; setAsking(false); });
  function offer() {
    if (asked.current) return;
    asked.current = true;
    setAsking(true);
    setError(null);
    setPin(null);
    void ask();
  }
  useEffect(() => { void ask(); }, []); // once, on opening
  useEffect(() => { if (pin) keepRef.current?.focus(); }, [pin, opened]);

  async function keep() {
    if (!pin) return;
    setSaving(true);
    setError(null);
    try {
      await apiMutate(keepPath, { pin });
      await onKept();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog key={opened} open dismissOnBackdrop={false} aria-labelledby="pin-title" aria-describedby="pin-intro"
      onOpenChange={(o) => { if (!o) { if (closeLabel) onClose(); else setOpened((n) => n + 1); } }}
      onCancel={closeLabel ? undefined : (e) => e.preventDefault()}
      className="md:max-w-[440px] max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:bg-[var(--wh-bg)]">
      <div className="flex min-h-[72px] items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-3.5 pr-3.5 pl-[22px]">
        <h2 id="pin-title" className="m-0 grow text-xl font-bold">{title}</h2>
        {closeLabel ? (
          <button type="button" aria-label={closeLabel} onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg">
            <NavIcon name="close" size={20} />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-5 bg-[var(--wh-bg)] px-5 pt-6 pb-7 text-center md:px-7">
        <p id="pin-intro" className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{intro}</p>
        <div className="flex min-h-[72px] gap-2.5">
          {/* The PIN read out as words; the boxes are for the eye (review, 28 Oct, item 7). */}
          <span className="sr-only">{pin ? `${pinWords} ${pin.split('').join(' ')}` : 'Picking a PIN'}</span>
          {(pin ?? '    ').split('').map((d, i) => (
            <span key={i} aria-hidden="true" className="inline-flex h-[72px] w-[60px] items-center justify-center rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] font-[family-name:var(--wh-font-mono)] text-size-34 text-[var(--wh-ink)]">{d}</span>
          ))}
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        <div className="flex w-full flex-col gap-2.5">
          <Button ref={keepRef} variant="primary" block disabled={!pin || saving} onClick={() => void keep()}>Keep this PIN</Button>
          <Button block aria-disabled={saving || asking} onClick={() => { if (!saving) offer(); }}>Give me a different one</Button>
          {extra}
        </div>
        <span className="text-size-13 text-[var(--wh-muted)]">{foot}</span>
      </div>
    </Dialog>
  );
}
