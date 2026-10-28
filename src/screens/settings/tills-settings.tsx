import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button.tsx';
import { useTillSetup } from '@/lib/till-setup.ts';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Settings › Front desk › Till › Tills, as the Owner sees it (drawn as
 * set-till-tills-owner in generator/setup.mjs, tillsOpen; stage-1 gaps
 * decision 4: only "Make this computer a till" until the list of tills with
 * Rename and Remove, WP-5.1; openspec/changes/till-setup). The button doesn't
 * show on a computer that's already a till, nor for a business with no shop
 * set up yet (design 6).
 */
export function useTillsSummary(): string {
  const setup = useTillSetup();
  if (!setup.data) return '';
  return setup.data.tills.length ? setup.data.tills.map((code) => `Till ${code}`).join(', ') : 'None yet';
}

export function TillsSettings() {
  const setup = useTillSetup();
  const data = setup.data;
  return (
    <div className="flex flex-col items-start gap-2.5 pt-1">
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.</p>
      {data && !data.thisTill && data.sites.length ? (
        <Link to={ROUTES['till-setup']} className={buttonVariants({ variant: 'default' })}>Make this computer a till</Link>
      ) : null}
    </div>
  );
}
