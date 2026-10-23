import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Dialog } from '@/components/ui/dialog.tsx';
import { useSession } from '@/lib/auth/use-session.ts';
import { useChangeAccessibility, useYourSettings, type Accessibility } from '@/lib/your-settings.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Your settings (drawn as your-settings, app-map.mjs yourSettingsDialog;
 * workshop day 57; app map review 9: each applies at once, no Save). A
 * pop-up over the page you came from, at the address your name links to;
 * Close goes back. Only the switches built show (design 5); the Till PIN
 * waits for PINs (WP-1.7).
 */
// Larger text waits: zooming the app put the diary's drops and pop-ups off
// their marks (review), so it's a question for Jack.
const ROWS: { key: keyof Accessibility; label: string; hint: string }[] = [
  { key: 'reduceMotion', label: 'Reduce motion', hint: 'Turns off animations, such as the arrow that shows where a customer wants to move a job. Also switches on automatically when your computer is set to reduce motion.' },
];

function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg">
      <span aria-hidden="true" className={`relative inline-block h-6 w-10 rounded-full ${on ? 'bg-[var(--accent)]' : 'bg-[var(--wh-input-border)]'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-[var(--wh-panel)] shadow ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function YourSettingsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const isPhone = useMedia('(max-width: 767px)');
  const settings = useYourSettings();
  const change = useChangeAccessibility();
  const [busy, setBusy] = useState<ReadonlySet<keyof Accessibility>>(new Set());
  const [failed, setFailed] = useState(false);
  if (session.status !== 'signed-in') return null;
  const { user } = session;
  const roleName = user.isOwner ? 'Owner' : 'Staff';
  // Back to the page you came from; the desk when this was opened directly.
  const close = () => { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate(ROUTES.desk); };

  async function flip(key: keyof Accessibility, on: boolean) {
    setBusy((b) => new Set(b).add(key));
    setFailed(false);
    try {
      await change(key, on);
    } catch {
      setFailed(true);
    } finally {
      setBusy((b) => { const next = new Set(b); next.delete(key); return next; });
    }
  }

  const a11y = settings.data?.accessibility;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }} aria-labelledby="ys-title" className="md:max-w-[560px] max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-3.5 pr-3.5 pl-[22px]">
        <div className="flex grow flex-col gap-0.5">
          <h2 id="ys-title" className="m-0 text-xl font-bold">Your settings</h2>
          <span className="text-[13px] text-[var(--wh-muted)]">{`${user.name} · ${roleName} · ${isPhone ? 'just for you' : 'just for you, they don’t change what others see'}`}</span>
        </div>
        <button type="button" aria-label="Close" onClick={close} className="inline-flex size-11 items-center justify-center rounded-lg">
          <NavIcon name="close" size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto bg-[var(--wh-bg)] p-[22px] max-md:p-3.5">
        <span className="text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Accessibility</span>
        {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load your settings. Try again in a moment.</p> : null}
        {ROWS.map((r) => (
          <div key={r.key} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 grow flex-col gap-1">
                <span className="text-[15px] font-bold">{r.label}</span>
                <span className="text-[13px] leading-[1.45] text-[var(--wh-muted)]">{r.hint}</span>
              </div>
              <Switch label={r.label} on={Boolean(a11y?.[r.key])} disabled={!a11y || busy.has(r.key)} onChange={() => void flip(r.key, !a11y?.[r.key])} />
            </div>
          </div>
        ))}
        {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t save that. Try again in a moment.</p> : null}
        <p className="m-0 text-[13px] text-[var(--wh-muted)]">Changes apply straight away.</p>
      </div>
    </Dialog>
  );
}
