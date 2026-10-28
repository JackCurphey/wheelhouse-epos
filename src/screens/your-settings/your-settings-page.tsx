import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Dialog } from '@/components/ui/dialog.tsx';
import { useSession } from '@/lib/auth/use-session.ts';
import { useChangeAccessibility, useYourSettings, type Accessibility } from '@/lib/your-settings.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { BLOCK } from '@/screens/diary/diary-model.ts';
import { StatusShape } from '@/screens/diary/status-shape.tsx';
import { TillPinBlock } from './till-pin.tsx';

/**
 * Your settings (drawn as your-settings, app-map.mjs yourSettingsDialog;
 * workshop day 57; app map review 9: each applies at once, no Save). A
 * pop-up over the page you came from, at the address your name links to;
 * Close goes back. Only the switches built show (design 5). The Till PIN
 * block comes first, as drawn (openspec/changes/pins-and-checkin).
 */
// Larger text scales the text sizes themselves, not the page (Jack, 24 Oct
// answer 8; openspec/changes/larger-text): after Reduce motion, as drawn.
// Don't close things by themselves between them (Jack, 24 Oct answer 9;
// app-map.mjs ys-wait; openspec/changes/dont-close-screens).
const ROWS: { key: keyof Accessibility; label: string; hint: string; preview?: 'symbols' | 'text' }[] = [
  // Show the diary legend, first, on to start (Jack, 26 Oct; diary-legend-box; app-map.mjs ys-legend).
  { key: 'showLegend', label: 'Show the diary legend', hint: 'The key to what each colour means, beside the Workshop diary. Switch it off once you know them.' },
  { key: 'statusSymbols', label: 'Show status symbols', hint: 'Adds a small symbol to each diary job so its status doesn’t rely on colour alone. Helpful for colour blindness.', preview: 'symbols' },
  { key: 'reduceMotion', label: 'Reduce motion', hint: 'Turns off animations, such as the arrow that shows where a customer wants to move a job. Also switches on automatically when your computer is set to reduce motion.' },
  { key: 'noAutoClose', label: 'Don’t close things by themselves', hint: 'Things that close or send after a few seconds — the till’s receipt choice, Undo — wait until you press a key or button.' },
  { key: 'largerText', label: 'Larger text', hint: 'Makes text across Wheelhouse a step larger.', preview: 'text' },
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

// The drawing's preview of Larger text (diary.mjs largerTextPreview): Normal at
// 14 and Larger at 17, fixed, so it shows the step whichever is on.
function TextPreview() {
  // Fixed sizes on purpose (the only ones off the scale): the preview shows the step either way.
  const col = (px: number, label: string) => (
    <span className="flex flex-col gap-[3px]">
      <span className="text-[var(--wh-muted)]" style={{ fontSize: 11 }}>{label}</span>
      <span className="font-semibold" style={{ fontSize: px }}>Standard service</span>
    </span>
  );
  return (
    <div role="group" aria-label="Preview" className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Preview</span>
      <div className="flex items-end gap-5 pt-1.5">{col(14, 'Normal')}{col(17, 'Larger')}</div>
    </div>
  );
}

// The drawing's preview of Show status symbols: two week blocks with their shapes (diary.mjs symbolsPreview).
const SAMPLE: [('scheduled' | 'waiting'), string, string][] = [['scheduled', 'Trek Domane AL 3', 'Standard service'], ['waiting', 'Cannondale Quick', 'Gear adjustment']];
function SymbolsPreview() {
  return (
    <div className="border-t border-[var(--wh-border)] pt-2.5">
      <span className="text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Preview</span>
      <div className="flex gap-2 pt-1.5">
        {SAMPLE.map(([state, bike, title]) => (
          <div key={state} aria-hidden="true" className={`relative w-[122px] rounded-[5px] border-[1.75px] py-[3px] pr-4 pl-1.5 ${BLOCK[state]}`}>
            <StatusShape state={state} />
            <div className="truncate text-size-11 font-bold text-[var(--wh-ink)]">{bike}</div>
            <div className="truncate text-size-10 font-bold">{title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function YourSettingsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const isPhone = useMedia('(max-width: 767px)');
  const isTablet = useMedia('(max-width: 1023px)') && !isPhone;
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
  // Folded sidebar, last as drawn: its hint for a tablet, where the rail is always there; not on a phone, where the menu opens the rooms.
  // Not on a phone, where the diary has no legend (diary-legend-box design 2).
  const rows = isPhone ? ROWS.filter((r) => r.key !== 'showLegend') : [...ROWS, { key: 'foldedSidebar' as const, label: 'Folded sidebar', hint: isTablet
    ? 'On a tablet the sidebar is always the icon rail; tap Unfold to open it.'
    : 'Folds the sidebar down to icons on every page, for more room. Press Unfold to open it. The Till always has it folded.' }];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }} aria-labelledby="ys-title" className="md:max-w-[560px] max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-3.5 pr-3.5 pl-[22px]">
        <div className="flex grow flex-col gap-0.5">
          <h2 id="ys-title" className="m-0 text-xl font-bold">Your settings</h2>
          <span className="text-size-13 text-[var(--wh-muted)]">{`${user.name} · ${roleName} · ${isPhone ? 'just for you' : 'just for you, they don’t change what others see'}`}</span>
        </div>
        <button type="button" aria-label="Close" onClick={close} className="inline-flex size-11 items-center justify-center rounded-lg">
          <NavIcon name="close" size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto bg-[var(--wh-bg)] p-[22px] max-md:p-3.5">
        <TillPinBlock />
        <span className="text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Accessibility</span>
        {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load your settings. Try again in a moment.</p> : null}
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 grow flex-col gap-1">
                <span className="text-size-15 font-bold">{r.label}</span>
                <span className="text-size-13 leading-[1.45] text-[var(--wh-muted)]">{r.hint}</span>
              </div>
              <Switch label={r.label} on={Boolean(a11y?.[r.key])} disabled={!a11y || busy.has(r.key)} onChange={() => void flip(r.key, !a11y?.[r.key])} />
            </div>
            {r.preview === 'symbols' ? <SymbolsPreview /> : r.preview === 'text' ? <TextPreview /> : null}
          </div>
        ))}
        {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t save that. Try again in a moment.</p> : null}
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">Changes apply straight away.</p>
      </div>
    </Dialog>
  );
}
