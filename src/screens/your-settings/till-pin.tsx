import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
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
      {open ? <PinDialog first={!has} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PinDialog({ first, onClose }: { first: boolean; onClose: () => void }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const firstName = session.status === 'signed-in' ? session.user.name.split(' ')[0] : '';
  const intro = first
    ? `Welcome to ${shop}, ${firstName}. This PIN checks you in at the till and puts your name on sales and workshop work. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.`
    : 'Wheelhouse picked this for you — nobody else at the shop has it. Learn it before you close this.';
  // The first-time version has no ✕ (pin-first), so Escape does nothing.
  return (
    <PinOfferDialog
      title={first ? 'Your till PIN' : 'Your new till PIN'}
      intro={intro}
      foot={first ? 'Not using the till? Skip it — you can get a PIN later in Your settings.' : 'Your old PIN stops working when you keep this one.'}
      pinWords="New PIN"
      closeLabel={first ? null : 'Close without changing your PIN'}
      offerPath="/api/your-settings/till-pin/offer"
      keepPath="/api/your-settings/till-pin"
      onKept={async () => { await queryClient.invalidateQueries({ queryKey: QUERY }); onClose(); }}
      onClose={onClose}
      extra={first ? <Button variant="ghost" block onClick={onClose}>Skip for now</Button> : null}
    />
  );
}
