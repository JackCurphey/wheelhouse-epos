import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { SETUP_QUERY, useTillSetup } from '@/lib/till-setup.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { CHECKIN_QUERY } from '@/lib/till-checkin.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { Frame, SignedOut } from '@/staff/signed-out.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { tillNumbers } from './till-numbers.ts';

/**
 * Set up this till (till-setup in docs/design/user-journeys/generator/signin.mjs,
 * tillSetupAt; openspec/changes/till-setup). The Owner, signed in, makes this
 * computer a till: the shop and the till number as pills (Workshop day 62,
 * 66), taken numbers "In use" (UX walk-through 7 M2), an optional name.
 * Only what works (design 6): no "stays signed in, works offline" (step C)
 * and no receipt-number hint. Registering a till is never offered by PIN
 * (roles and switches 2). It also makes a workshop computer, with a shop and
 * a name but no number (stage-1 gaps 4; openspec/changes/workshop-computer,
 * design 7, not drawn).
 */
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const HEADING = 'm-0 text-size-26 leading-tight font-bold tracking-[-0.3px] text-[var(--wh-ink)]';
const LINE = 'm-0 text-size-15 leading-normal text-[var(--wh-muted)]';

export function TillSetupPage() {
  const session = useSession();
  if (session.status === 'loading') return <p className="p-8">Loading…</p>;
  if (session.status === 'signed-out') return <SignedOut expired={session.expired} />;
  if (session.status === 'error') return <Frame><p role="alert" className={LINE}>Wheelhouse couldn’t load this page. Try again in a moment.</p></Frame>;
  // The drawn note from Settings › Till › Tills (set-till-tills).
  if (!session.user.isOwner) return <Frame><p className={LINE}>Only the owner can add or remove tills.</p></Frame>;
  return <SetupForm ownerName={session.user.name} />;
}

function SetupForm({ ownerName }: { ownerName: string }) {
  const setup = useTillSetup();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [kind, setKind] = useState<'till' | 'workshop'>('till');
  const [siteId, setSiteId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // "computer" at desktop, "device" on a tablet or phone (tillSetupAt).
  const device = useMedia('(max-width: 1279px)') ? 'device' : 'computer';
  const data = setup.data;
  if (setup.isError) return <Frame><p role="alert" className={LINE}>Wheelhouse couldn’t load this page. Try again in a moment.</p></Frame>;
  if (!data) return <p className="p-8">Loading…</p>;
  // "It doesn't show on a computer that's already a till" (set-till-tills-owner).
  if (data.thisTill) return <Navigate to={ROUTES.till} replace />;
  // A workshop computer goes to its own Enter your PIN.
  if (data.thisWorkshop) return <Navigate to={ROUTES.desk} replace />;
  // A business with no site yet: WP-1.4 gives every business its first (design 6).
  if (!data.sites.length) return <Frame><p className={LINE}>This business has no shops set up in Wheelhouse yet, so a till can’t be added here.</p></Frame>;
  const site = data.sites.find((s) => s.id === siteId) ?? data.sites[0];
  const { numbers, chosen } = tillNumbers(site.taken);
  const number = picked !== null && numbers.some((n) => n.number === picked && !n.inUse) ? picked : chosen;
  const code = number === null ? null : `${site.code}${number}`;

  const workshop = kind === 'workshop';
  async function make() {
    if (!workshop && number === null) return;
    setSaving(true);
    setFailed(null);
    try {
      if (workshop) await apiMutate('/api/till-setup/workshop', { siteId: site.id, name: name.trim() }, { method: 'POST' });
      else await apiMutate('/api/till-setup', { siteId: site.id, number, name: name.trim() }, { method: 'POST' });
      // The browser is now the till or workshop computer: who's serving and the setup are read again.
      await queryClient.invalidateQueries({ queryKey: CHECKIN_QUERY });
      void queryClient.invalidateQueries({ queryKey: SETUP_QUERY });
      void navigate(workshop ? ROUTES.desk : ROUTES.till);
    } catch (err) {
      setFailed(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
      setSaving(false);
    }
  }

  const pill = (on: boolean, label: string, pick: () => void) => (
    <button key={label} type="button" role="radio" aria-checked={on} onClick={pick}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-transparent text-[var(--wh-ink)]'}`}>
      {label}
    </button>
  );
  const group = (id: string, label: string, pills: ReactNode) => (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-semibold">{label}</span>
      <RadioPillGroup aria-labelledby={id} className="flex flex-wrap gap-2">{pills}</RadioPillGroup>
    </div>
  );
  return (
    <Frame wide>
      <h1 className={HEADING}>{workshop ? 'Set up a workshop computer' : 'Set up this till'}</h1>
      <p className={LINE}>{workshop
        ? `Signed in as ${ownerName} (Owner). This ${device} becomes a workshop computer: staff work on it with their PIN.`
        : `Signed in as ${ownerName} (Owner). This ${device} becomes a till: staff check in with their PIN.`}</p>
      {group('setup-kind', `This ${device} becomes`, [pill(!workshop, 'A till', () => setKind('till')), pill(workshop, 'A workshop computer', () => setKind('workshop'))])}
      {group('setup-shop', 'Shop', data.sites.map((s) => pill(s.id === site.id, s.name, () => { setSiteId(s.id); setPicked(null); })))}
      {workshop ? null : group('setup-number', 'Till number', numbers.map((n) => n.inUse ? (
        <button key={n.number} type="button" role="radio" aria-checked={false} disabled aria-label={`${site.code}${n.number}, in use`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--wh-border)] bg-transparent px-3.5 text-sm font-semibold text-[var(--wh-muted)]">
          {`${site.code}${n.number}`}<span className="text-xs font-medium">In use</span>
        </button>
      ) : pill(n.number === number, `${site.code}${n.number}`, () => setPicked(n.number))))}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="till-name" className="text-sm font-semibold">Name (optional)</label>
        <Input id="till-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{failed}</p> : null}
      {workshop ? (
        <Button variant="accent" block disabled={saving} onClick={() => void make()}>{`Make this ${device} a workshop computer`}</Button>
      ) : code ? (
        <Button variant="accent" block disabled={saving} onClick={() => void make()}>Make this {device} Till {code}</Button>
      ) : null}
    </Frame>
  );
}
