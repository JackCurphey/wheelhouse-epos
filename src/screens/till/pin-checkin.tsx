import { useEffect, useRef, useState, type ReactNode } from 'react';
import { User } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { useCheckinActions, type CheckedIn, type GiveTo } from '@/lib/till-checkin.ts';
import { ServingMenuButton } from './give-pin.tsx';

/**
 * Enter your PIN (drawn as till-checkin and till-pin-wrong in
 * docs/design/user-journeys/generator/signin.mjs; signing in decisions 4, 8
 * and 9). The PIN alone says who you are: the fourth digit is checked at
 * once, with no OK button. A wrong PIN clears the dots and says so; there is
 * no lock. Who has checked in today is listed under the pad.
 * Not here yet (openspec/changes/pins-and-checkin): the till bar and the
 * start-up status line (step C); the till's name sits above (till-setup). "No PIN yet?" is the
 * drawn line now the Owner can give a PIN here (openspec/changes/give-pin-at-till).
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const FAILED = 'Wheelhouse couldn’t check that PIN. Try again in a moment.';

export function PinCheckin({ checkedInToday }: { checkedInToday: CheckedIn[] }) {
  const { checkIn } = useCheckinActions();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  // The digits so far, read and written straight away, so two quick key
  // presses between renders both count and the fourth is sent once.
  const typed = useRef('');
  const show = (d: string) => { typed.current = d; setDigits(d); };

  async function send(pin: string) {
    busyRef.current = true;
    setBusy(true);
    try {
      await checkIn(pin);
    } catch (err) {
      // A wrong PIN (or "wait a moment") in the server's own words; anything else, plainly.
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : FAILED);
      show('');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function type(key: string) {
    if (busyRef.current) return;
    setError(null);
    if (key === 'Clear') { show(''); return; }
    if (key === 'Delete') { show(typed.current.slice(0, -1)); return; }
    if (typed.current.length >= 4) return;
    const next = typed.current + key;
    show(next);
    if (next.length === 4) void send(next);
  }
  // The keyboard's digits and Backspace work too, but not keys meant for a
  // box (the header search), shortcuts, or a key held down (review, 28 Oct, item 2).
  const typeRef = useRef(type);
  useEffect(() => { typeRef.current = type; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const at = e.target instanceof HTMLElement ? e.target : null;
      if (at && (at.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName))) return;
      if (/^[0-9]$/.test(e.key)) typeRef.current(e.key);
      else if (e.key === 'Backspace') typeRef.current('Delete');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const key = (k: string, label = k) => (
    // Not `disabled` while a PIN is checked: that would take the focus away (review, 28 Oct, item 7).
    <button key={k} type="button" aria-label={label !== k ? label : undefined} aria-disabled={busy} onClick={() => type(k === 'Delete' ? 'Delete' : k)}
      className={`min-h-14 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] font-semibold text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] md:min-h-16 ${/^\d$/.test(k) ? 'text-size-26' : 'text-base'}`}>
      {k}
    </button>
  );
  const shown = digits.length;
  return (
    <div className="flex min-h-full flex-col items-stretch justify-center gap-3.5 py-4 md:items-center md:gap-[18px]">
      <div className="flex flex-col gap-3.5 text-center md:w-[360px] md:gap-[18px]">
        <h1 className="m-0 text-2xl font-bold md:text-size-28">Enter your PIN</h1>
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)] md:text-size-15">Your PIN checks you in and puts your name on sales and workshop work.</p>
        <div role="status" data-pin-dots="" className="flex justify-center gap-4">
          <span className="sr-only">{`${shown} of 4 digits`}</span>
          {[0, 1, 2, 3].map((i) => <span key={i} aria-hidden="true" className={`size-[18px] rounded-full border-2 border-[var(--wh-ink)] ${i < shown ? 'bg-[var(--wh-ink)]' : 'bg-transparent'}`} />)}
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        <div className="grid grid-cols-3 gap-2.5">
          {KEYS.map((k) => key(k))}
          {key('Clear')}
          {key('0')}
          {key('Delete', 'Delete the last digit')}
        </div>
        <p className="m-0 text-size-13 leading-[1.45] text-[var(--wh-muted)] md:text-sm"><strong className="text-[var(--wh-ink)]">No PIN yet?</strong> Sign in on your phone, or ask the owner or a manager to give you one here.</p>
      </div>
      {checkedInToday.length ? (
        <div className="flex flex-col gap-2.5 md:w-[360px]">
          <span className="text-sm font-bold tracking-[0.8px] uppercase">Checked in today</span>
          <div className="flex flex-wrap gap-2">
            {checkedInToday.map((p) => (
              <span key={p.id} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] py-0 pr-3 pl-1 text-sm font-semibold">
                <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--wh-ok-bg)] text-xs font-bold text-[var(--wh-status-complete-ink)]">{p.name.split(' ').map((x) => x[0]).join('')}</span>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Serving: [name]" (tillBar's switch): back to Enter your PIN. For the
 * Owner, while someone has no PIN, it opens the Serving menu instead
 * (till-serving-menu; give-pin.tsx).
 */
export function ServingButton({ serving, givePin = [], lead = null }: { serving: CheckedIn; givePin?: GiveTo[]; lead?: ReactNode }) {
  const { switchServing } = useCheckinActions();
  const [failed, setFailed] = useState(false);
  return (
    <div className="mb-3.5 flex items-center justify-end gap-2.5">
      {/* The till's name on the left, as the till bar has it (till-setup). */}
      {lead ? <span className="mr-auto">{lead}</span> : null}
      {failed ? <span role="alert" className="text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t switch. Try again in a moment.</span> : null}
      {givePin.length ? <ServingMenuButton serving={serving} givePin={givePin} onFailed={() => setFailed(true)} /> : <button type="button" aria-label={`Serving: ${serving.name} — switch who’s serving`}
        onClick={() => { setFailed(false); switchServing().catch(() => setFailed(true)); }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-sm font-semibold hover:bg-[var(--wh-hover)]">
        <User size={16} aria-hidden="true" />{`Serving: ${serving.name}`}
      </button>}
    </div>
  );
}
