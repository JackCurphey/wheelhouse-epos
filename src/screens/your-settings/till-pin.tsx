import { useState } from 'react';
import { useScreenClear } from '@/lib/screen-clear.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button.tsx';
import { PinOfferDialog } from '@/screens/till/pin-offer-dialog.tsx';

/**
 * Your settings › Till PIN (app-map.mjs yourSettingsDialog's pinBlock;
 * signing in decision 6) and "Your new till PIN" / "Your till PIN"
 * (signin.mjs pin-change and pin-first; decision 7): Wheelhouse picks a
 * four-digit PIN nobody else at the shop has, "Give me a different one"
 * picks another, and only "Keep this PIN" keeps it
 * (openspec/changes/pins-and-checkin). The pop-up is shared with giving a
 * PIN at the till (pin-offer-dialog.tsx).
 */
type TillPinState = { canHavePin: boolean; hasPin: boolean };
const QUERY = ['till-pin'];

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
      {open ? <PinDialog mode={has ? 'change' : 'first'} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

type Mode = 'change' | 'first' | 'cleared';
const QUESTION = ['till-pin-ask'];

/**
 * "Your till PIN" by itself (pin-first, pin-cleared; UX walk-through 4 H1;
 * openspec/changes/whos-in-and-first-pin): a team member with no PIN, never
 * asked or asked before their PIN was cleared, gets it over the page they
 * land on. Skip for now or Keep this PIN records the ask and leaves them there.
 */
export function FirstPinPrompt() {
  const queryClient = useQueryClient();
  const ask = useQuery({ queryKey: QUESTION, queryFn: () => apiGet<{ ask: 'first' | 'cleared' | null }>('/api/your-settings/till-pin/ask'), staleTime: Infinity, retry: false });
  const [done, setDone] = useState(false);
  // Never over another pop-up, an open sale or the pay box: an ask that comes
  // while one is showing waits until the screen is clear (review, 28 Oct).
  const clear = useScreenClear();
  const [shown, setShown] = useState(false);
  const mode = ask.data?.ask;
  // Once open it stays open (it is itself a pop-up), so the clear screen is latched.
  if (mode && clear && !shown) setShown(true);
  if (!mode || done || !shown) return null;
  const answered = () => {
    setDone(true);
    // Asked: not again until the PIN is next cleared. A failed save only means asking again next time.
    void apiMutate('/api/your-settings/till-pin/ask', {}).catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: QUESTION }));
  };
  return <PinDialog mode={mode} onClose={answered} />;
}

function PinDialog({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const firstName = session.status === 'signed-in' ? session.user.name.split(' ')[0] : '';
  const later = mode !== 'change';
  // signin.mjs PIN_TEXT: first, cleared and change.
  const intro = mode === 'first'
    ? `Welcome to ${shop}, ${firstName}. This PIN checks you in at the till and puts your name on sales and workshop work. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.`
    : mode === 'cleared'
      ? 'Your old PIN was cleared, so here’s a new one. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.'
      : 'Wheelhouse picked this for you — nobody else at the shop has it. Learn it before you close this.';
  // The first-time versions have no ✕ (pin-first, pin-cleared), so Escape does nothing.
  return (
    <PinOfferDialog
      title={later ? 'Your till PIN' : 'Your new till PIN'}
      intro={intro}
      foot={later ? 'Not using the till? Skip it — you can get a PIN later in Your settings.' : 'Your old PIN stops working when you keep this one.'}
      pinWords="New PIN"
      closeLabel={later ? null : 'Close without changing your PIN'}
      offerPath="/api/your-settings/till-pin/offer"
      keepPath="/api/your-settings/till-pin"
      onKept={async () => { await queryClient.invalidateQueries({ queryKey: QUERY }); onClose(); }}
      onClose={onClose}
      extra={later ? <Button variant="ghost" block onClick={onClose}>Skip for now</Button> : null}
    />
  );
}
