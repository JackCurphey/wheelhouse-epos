import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { useQueryClient } from '@tanstack/react-query';
import { CHECKIN_QUERY, useCheckinActions, type CheckedIn, type TapName, type ThisWorkshop } from '@/lib/till-checkin.ts';
import { PinCheckin } from './pin-checkin.tsx';

/**
 * The shared workshop computer (openspec/changes/workshop-computer;
 * walk-through 8 decisions 1, 3 and 4; stage-1 gaps 10). Before anyone is
 * working, Enter your PIN with no till number under the workshop bar
 * (till-checkin-workshop in docs/design/user-journeys/generator/signin.mjs,
 * workshopBar and checkinWorkshop); then "Working: [name] · Switch" across
 * the top of every page (diary.mjs, workingBar); and back to Enter your PIN
 * after 10 minutes with nobody using it (build plan Q6), which the server
 * enforces too.
 */

/**
 * Enter your PIN in place of every page. The bar says only what works
 * (design 5): no Online pill. "Bolton" alone on a phone, as drawn. With
 * trust PIN on and someone who typed their PIN here today, "Who’s working?"
 * comes first (openspec/changes/trust-pin-workshop).
 */
export function WorkshopPinScreen({ workshop, shopName, names = [] }: { workshop: ThisWorkshop; shopName: string; names?: TapName[] }) {
  // "Someone else" on the Working pills asks for the pad straight away (working-pills design 4).
  const [askPin, setAskPin] = useState(takePadNext);
  const tapping = names.length > 0 && !askPin;
  return (
    <div className="flex min-h-screen flex-col bg-[var(--wh-bg)] text-[var(--wh-ink)]">
      <header className="flex h-14 shrink-0 items-center gap-1.5 bg-[var(--sidebar)] px-3.5 text-[var(--sidebar-foreground)] md:h-16 md:gap-3.5 md:px-5">
        <span className="flex min-w-0 grow flex-col gap-px">
          <span className="text-base font-bold">Workshop computer</span>
          <span className="text-xs opacity-85 md:text-sm md:opacity-100">{workshop.siteName}<span className="hidden md:inline">{shopName ? ` · ${shopName}` : ''}</span></span>
        </span>
        <span className="pr-2 text-size-13 opacity-85 md:pr-0 md:text-sm">Nobody working<span className="hidden md:inline">{tapping ? ' — tap your name' : ' — enter your PIN'}</span></span>
      </header>
      <main className="min-h-0 grow p-4 md:p-7">
        {tapping ? <WhosWorking names={names} onSomeoneElse={() => setAskPin(true)} /> : <PinCheckin checkedInToday={[]} workshop />}
      </main>
    </div>
  );
}

const TAP_FAILED = 'Wheelhouse couldn’t check you in. Try again, or enter your PIN.';

/**
 * "Who’s working?" (till-checkin-workshop-names, checkinWorkshopNames and
 * nameTile in signin.mjs; roles and switches 3). The drawn "Owner and
 * manager pages still ask for your PIN." waits for that to be built
 * (trust-pin-workshop design 6); each name shows Mechanic or Staff.
 */
function WhosWorking({ names, onSomeoneElse }: { names: TapName[]; onSomeoneElse: () => void }) {
  const { tapIn } = useCheckinActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function tap(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await tapIn(id);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : TAP_FAILED);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-full flex-col items-stretch justify-center py-4 md:items-center">
      <div className="flex flex-col gap-3 md:w-[360px] md:gap-3.5">
        <h1 className="m-0 text-2xl font-bold md:text-size-28">Who’s working?</h1>
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)] md:text-size-15">You’ve typed your PIN here today, so just tap your name.</p>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        {names.map((n) => (
          <button key={n.id} type="button" aria-disabled={busy} onClick={() => void tap(n.id)}
            className="flex min-h-14 w-full items-center gap-3.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-2.5 text-left text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] md:min-h-16">
            <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] font-bold">{n.name[0]}</span>
            <span className="flex flex-col">
              <span className="text-size-17 font-semibold">{n.name}</span>
              <span className="text-size-13 text-[var(--wh-muted)]">{n.role}</span>
            </span>
          </button>
        ))}
        <Button type="button" className="w-full" onClick={onSomeoneElse}>Someone else — enter your PIN</Button>
      </div>
    </div>
  );
}

// Set by "Someone else" on the Working pills, read once by the PIN screen that follows.
let padNext = false;
function takePadNext() {
  const next = padNext;
  padNext = false;
  return next;
}

const pillClass = (on: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-size-13 font-semibold whitespace-nowrap md:px-4 md:text-sm ${on
  ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]'
  : 'border-[var(--wh-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)] hover:bg-[var(--wh-hover)]'}`;

/**
 * The Working pills (workshop-working-pills in signin.mjs, workPill and
 * workingPills; roles and switches 9; openspec/changes/working-pills): with
 * trust PIN on, at the bottom of every page in place of the Working bar.
 * Today's people as pills, the person working highlighted (added if they
 * aren't a name to tap, as the Owner never is), then "Someone else". A pill
 * is the same tap as "Who's working?", on the same page; "Someone else" ends
 * the check-in and shows the pad.
 */
export function WorkingPills({ working, names }: { working: CheckedIn; names: TapName[] }) {
  const { tapIn, switchServing } = useCheckinActions();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = names.some((n) => n.id === working.id) ? names : [working, ...names];
  async function act(go: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await go();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t change who’s working. Try again in a moment.');
      // The pills are read again, so a name the server no longer offers goes (design 3).
      void queryClient.invalidateQueries({ queryKey: CHECKIN_QUERY });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sticky bottom-0 z-30 flex shrink-0 flex-col border-t border-[var(--wh-border)] bg-[var(--wh-surface-muted)] shadow-[0_-6px_16px_var(--wh-backdrop)]">
      {error ? <p role="alert" className="m-0 px-3 pt-2 text-sm font-semibold text-[var(--wh-danger-hover)] md:px-6">{error}</p> : null}
      <div role="group" aria-label="Who’s working" className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 py-2.5 md:gap-2 md:px-6">
        <span className="mr-1 shrink-0 text-size-13 text-[var(--wh-muted)]">Working:</span>
        {people.map((p) => {
          const on = p.id === working.id;
          return (
            <button key={p.id} type="button" aria-pressed={on} aria-disabled={busy}
              onClick={() => { if (!on) void act(() => tapIn(p.id)); }} className={pillClass(on)}>
              {p.name}
            </button>
          );
        })}
        <button type="button" aria-disabled={busy} onClick={() => void act(async () => {
          padNext = true;
          try { await switchServing(); } catch (err) { padNext = false; throw err; }
        })} className={pillClass(false)}>
          Someone else
        </button>
      </div>
    </div>
  );
}

/**
 * "Working: Alex Morgan · Switch" (block 26), across the top of every page
 * on a workshop computer. Switch ends the check-in: back to Enter your PIN.
 * A screen reader hears "Now working: [name]" (second walk, answer 10) from
 * WorkingStatus, which stays in the page from the PIN screen on.
 */
export function WorkingBar({ working }: { working: CheckedIn }) {
  const { switchServing } = useCheckinActions();
  const [failed, setFailed] = useState(false);
  return (
    <section aria-label="Who’s working" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--wh-border)] bg-[var(--wh-surface-muted)] px-3.5 py-1.5 text-size-13 md:px-6">
      <User size={16} aria-hidden="true" />
      <span>Working: <strong>{working.name}</strong></span>
      <span aria-hidden="true" className="text-[var(--wh-muted)]">·</span>
      <button type="button" onClick={() => { setFailed(false); switchServing().catch(() => setFailed(true)); }}
        className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--wh-brand-dark)] underline">
        Switch
      </button>
      {failed ? <span role="alert" className="font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t switch. Try again in a moment.</span> : null}
    </section>
  );
}

/**
 * One status region, kept from the PIN screen to the page, empty until
 * someone is working: filled after the PIN, so "Now working: [name]" is
 * announced (the review, 29 Oct).
 */
export function WorkingStatus({ working }: { working: CheckedIn | null }) {
  return <p role="status" data-working="" className="sr-only">{working ? `Now working: ${working.name}` : ''}</p>;
}

// The server is told someone is still here at most this often (design 2).
const TELL_EVERY_MS = 30_000;
const USES = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * While someone is working on a workshop computer: a press, a click, a tap, a
 * key or a scroll counts as using it, and the server is told at most every 30
 * seconds, a use it hasn't been told of yet within 30 seconds. The 10 minutes
 * run from the last telling, the time the server counts from too, so the
 * screen and the server end together (the review, 29 Oct). The check runs
 * every second against the clock, so a sleeping tab catches up the moment it
 * wakes.
 */
export function useWorkshopIdle(working: boolean, idleMinutes: number | null = 10) {
  const { stillHere, idleOut } = useCheckinActions();
  const actions = useRef({ stillHere, idleOut });
  useEffect(() => { actions.current = { stillHere, idleOut }; });
  useEffect(() => {
    if (!working) return undefined;
    // The check-in itself was the first telling.
    let told = Date.now();
    let untold = false;
    const tell = (now: number) => {
      told = now;
      untold = false;
      actions.current.stillHere().catch(() => {});
    };
    const used = () => {
      const now = Date.now();
      if (now - told >= TELL_EVERY_MS) tell(now);
      else untold = true;
    };
    for (const kind of USES) window.addEventListener(kind, used, { capture: true, passive: true });
    const timer = setInterval(() => {
      const now = Date.now();
      if (untold && now - told >= TELL_EVERY_MS) tell(now);
      // Off (trust PIN on): never goes back by itself (trust-pin-workshop).
      if (idleMinutes === null || now - told < idleMinutes * 60_000) return;
      clearInterval(timer);
      actions.current.idleOut();
    }, 1000);
    return () => {
      for (const kind of USES) window.removeEventListener(kind, used, { capture: true });
      clearInterval(timer);
    };
  }, [working, idleMinutes]);
}
