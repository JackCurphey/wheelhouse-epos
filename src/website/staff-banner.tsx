import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { apiPath } from './address.ts';
import { useSiteContext } from './site-query.ts';

/**
 * The staff banner on a switched-off website (openspec/changes/website-browse,
 * design 5; screens wb-off-preview, wb-off-preview-product, wb-off-preview-ask
 * and wb-turned-on in browse.mjs). The server says `preview` only to this
 * shop's own staff, with `canTurnOn` for whoever may switch it on and
 * `ownerNames` for everyone else (server/routes/site.js). Customers never get
 * `preview`, so they never see it.
 *
 * Once turned on the site is no longer a preview, so "Your website is on"
 * is this page's own memory of having just done it.
 */

/** "Jack Lewis", or "Jack Lewis or [Second owner]". */
const either = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`);

const link = 'inline-flex min-h-11 items-center font-semibold text-inherit';

export function StaffBanner() {
  const { address, site } = useSiteContext();
  const client = useQueryClient();
  const [justOn, setJustOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!site.preview && !justOn) return null;

  const turn = async (to: 'on' | 'off') => {
    setBusy(true);
    setError(null);
    try {
      await apiMutate(apiPath(address, `/api/site/turn-${to}`), {});
      setJustOn(to === 'on');
      await client.invalidateQueries({ queryKey: ['site', address.base], exact: true });
    } catch (err) {
      setError(serverSaid(err) ? err.message : 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  };

  const on = justOn;
  const ask = !on && !site.canTurnOn;
  const who = site.ownerNames?.length ? either(site.ownerNames) : 'the shop’s owner';
  return (
    <div
      role={on ? 'status' : undefined}
      className={`flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3 text-size-15 ${on ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]' : 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]'}`}
    >
      {on ? <Check aria-hidden className="size-[18px] shrink-0" /> : <Lock aria-hidden className="size-[18px] shrink-0" />}
      <span className="flex-[1_1_260px]">
        {on ? (
          <><strong>Your website is on.</strong> Customers can see it now.</>
        ) : (
          <><strong>Only your staff can see this.</strong> Your website is switched off — customers see “This website isn’t available”.{ask ? ` Ask ${who} to turn it on.` : ' Turning it on the first time also publishes it.'}</>
        )}
      </span>
      {!ask && (
        <>
          <Button className="min-h-11" disabled={busy} onClick={() => { void turn(on ? 'off' : 'on'); }}>{on ? 'Turn off' : 'Turn it on'}</Button>
          <a href="/workshop/website" className={link}>Edit this page</a>
        </>
      )}
      <a href="/workshop" className={link}>Back to Wheelhouse</a>
      {error && <p role="alert" className="m-0 basis-full font-semibold">{error}</p>}
    </div>
  );
}
