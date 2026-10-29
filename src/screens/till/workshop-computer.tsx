import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { useCheckinActions, type CheckedIn, type ThisWorkshop } from '@/lib/till-checkin.ts';
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
 * (design 5): no Online pill. "Bolton" alone on a phone, as drawn.
 */
export function WorkshopPinScreen({ workshop, shopName }: { workshop: ThisWorkshop; shopName: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--wh-bg)] text-[var(--wh-ink)]">
      <header className="flex h-14 shrink-0 items-center gap-1.5 bg-[var(--sidebar)] px-3.5 text-[var(--sidebar-foreground)] md:h-16 md:gap-3.5 md:px-5">
        <span className="flex min-w-0 grow flex-col gap-px">
          <span className="text-base font-bold">Workshop computer</span>
          <span className="text-xs opacity-85 md:text-sm md:opacity-100">{workshop.siteName}<span className="hidden md:inline">{shopName ? ` · ${shopName}` : ''}</span></span>
        </span>
        <span className="pr-2 text-size-13 opacity-85 md:pr-0 md:text-sm">Nobody working<span className="hidden md:inline"> — enter your PIN</span></span>
      </header>
      <main className="min-h-0 grow p-4 md:p-7">
        <PinCheckin checkedInToday={[]} workshop />
      </main>
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
