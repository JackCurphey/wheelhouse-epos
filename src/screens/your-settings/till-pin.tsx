import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';

/**
 * Your settings › Till PIN (app-map.mjs yourSettingsDialog's pinBlock;
 * signing in decision 6) and "Your new till PIN" / "Your till PIN"
 * (signin.mjs pin-change and pin-first; decision 7): Wheelhouse picks a
 * four-digit PIN nobody else at the shop has, "Give me a different one"
 * picks another, and only "Keep this PIN" keeps it
 * (openspec/changes/pins-and-checkin).
 */
type TillPinState = { canHavePin: boolean; hasPin: boolean };
const QUERY = ['till-pin'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';

export function TillPinBlock() {
  const pin = useQuery({ queryKey: QUERY, queryFn: () => apiGet<TillPinState>('/api/your-settings/till-pin') });
  const [open, setOpen] = useState(false);
  if (!pin.data?.canHavePin) return null;
  const has = pin.data.hasPin;
  return (
    <>
      <span className="text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Till</span>
      <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-4">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-size-15 font-bold">Till PIN</span>
          {has
            ? <span aria-label="PIN is set" className="font-[family-name:var(--wh-font-mono)] text-lg tracking-[3px]">••••</span>
            : <span className="text-sm font-semibold text-[var(--wh-warn-ink)]">No PIN yet</span>}
        </div>
        <span className="text-size-13 leading-[1.45] text-[var(--wh-muted)]">{has
          ? 'Checks you in at the till and puts your name on sales and workshop work. Only you know it.'
          : 'You need one to check in at the till. Wheelhouse picks it, and only you see it.'}</span>
        <Button variant={has ? 'default' : 'primary'} block onClick={() => setOpen(true)}>{has ? 'Change PIN' : 'Get your PIN'}</Button>
      </div>
      {open ? <PinDialog first={!has} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PinDialog({ first, onClose }: { first: boolean; onClose: () => void }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The first-time version has no ✕: Escape does nothing, and if the browser
  // closes it anyway it opens again (the float check's pattern).
  const [opened, setOpened] = useState(0);
  const keepRef = useRef<HTMLButtonElement>(null);
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const firstName = session.status === 'signed-in' ? session.user.name.split(' ')[0] : '';

  // A PIN Wheelhouse picked, shown once: one on opening, another for "Give me a different one".
  const ask = () => apiMutate<{ pin: string }>('/api/your-settings/till-pin/offer', {}).then(
    (r) => setPin(r.pin),
    (err) => setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t pick a PIN. Try again in a moment.'),
  );
  function offer() {
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
      await apiMutate('/api/your-settings/till-pin', { pin });
      await queryClient.invalidateQueries({ queryKey: QUERY });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  const title = first ? 'Your till PIN' : 'Your new till PIN';
  const intro = first
    ? `Welcome to ${shop}, ${firstName}. This PIN checks you in at the till and puts your name on sales and workshop work. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.`
    : 'Wheelhouse picked this for you — nobody else at the shop has it. Learn it before you close this.';
  const foot = first ? 'Not using the till? Skip it — you can get a PIN later in Your settings.' : 'Your old PIN stops working when you keep this one.';
  return (
    <Dialog key={opened} open dismissOnBackdrop={false} aria-labelledby="pin-title"
      onOpenChange={(o) => { if (!o) { if (first) setOpened((n) => n + 1); else onClose(); } }}
      onCancel={first ? (e) => e.preventDefault() : undefined}
      className="md:max-w-[440px] max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:bg-[var(--wh-bg)]">
      <div className="flex min-h-[72px] items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-3.5 pr-3.5 pl-[22px]">
        <h2 id="pin-title" className="m-0 grow text-xl font-bold">{title}</h2>
        {first ? null : (
          <button type="button" aria-label="Close without changing your PIN" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg">
            <NavIcon name="close" size={20} />
          </button>
        )}
      </div>
      <div className="flex flex-col items-center gap-5 bg-[var(--wh-bg)] px-5 pt-6 pb-7 text-center md:px-7">
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{intro}</p>
        <div aria-label={pin ? `New PIN ${pin.split('').join(' ')}` : 'Picking a PIN'} className="flex min-h-[72px] gap-2.5">
          {(pin ?? '    ').split('').map((d, i) => (
            <span key={i} aria-hidden="true" className="inline-flex h-[72px] w-[60px] items-center justify-center rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] font-[family-name:var(--wh-font-mono)] text-size-34 text-[var(--wh-ink)]">{d}</span>
          ))}
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        <div className="flex w-full flex-col gap-2.5">
          <Button ref={keepRef} variant="primary" block disabled={!pin || saving} onClick={() => void keep()}>Keep this PIN</Button>
          <Button block disabled={saving} onClick={offer}>Give me a different one</Button>
          {first ? <Button variant="ghost" block onClick={onClose}>Skip for now</Button> : null}
        </div>
        <span className="text-size-13 text-[var(--wh-muted)]">{foot}</span>
      </div>
    </Dialog>
  );
}
