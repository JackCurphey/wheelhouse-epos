import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { useServices } from './services-query.ts';
import { useOptionalDraft } from './draft.tsx';

/**
 * The frame around every book screen (Jack, 26 Sep: pinned button; loading,
 * unknown-shop and failed states, d2). Shop's name at the top, an optional
 * back link, "Step n of 4" with a progress bar, the screen's title as its h1,
 * then the screen. The main action is pinned to the bottom of the viewport
 * so it stays under the thumb on long screens; the page gets bottom padding
 * so the button never covers the last field. `pending` passes no step and no
 * back link.
 *
 * While `/services` is loading, only "Loading…" shows. On a 404, the frame
 * says the shop can't be found; on any other failure, it offers "Try again".
 * Once ready, the frame focuses its h1 on every screen change so keyboard and
 * screen-reader users land on the new heading.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
/**
 * Lets something inside the frame that pins its own bar (the quote's answer
 * bar, quote-pinned-bar) ask for the room the frame keeps under its pinned
 * action: bottom padding, and scroll padding so Tab never lands behind it.
 * Call with the bar's height in rem while it shows, and 0 when it goes.
 */
export const PinnedRoom = React.createContext<(rem: number) => void>(() => {});

export type BookFrameProps = {
  step?: 1 | 2 | 3 | 4;
  title: string;
  /** A small line above the heading, as the booking page's "Your repair · WH-1042" (bk-page). */
  eyebrow?: string;
  back?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  actionNote?: React.ReactNode;
  /** The account's two columns on a computer (customer-account-screens design 2); every other page stays phone-width. */
  wide?: boolean;
  children: React.ReactNode;
};

export function BookFrame({ step, title, eyebrow, back, action, actionNote, wide, children }: BookFrameProps) {
  const { shopSlug = '' } = useParams();
  const services = useServices(shopSlug);
  const booking = useOptionalDraft();
  const resumed = booking?.resumed ?? false;
  const markStep = booking?.markStep;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The booking's own steps record where the customer is, for coming back
  // later (booking-draft-resume).
  React.useEffect(() => {
    if (step && markStep) markStep(pathname.replace(`/book/${shopSlug}`, '').replace(/^\//, ''));
  }, [step, pathname, shopSlug, markStep]);

  const heading = React.useRef<HTMLHeadingElement>(null);
  const ready = services.isSuccess;
  const notFound = services.error instanceof ApiError && services.error.code === 'not_found';
  // Room asked for by a bar the screen pins itself (PinnedRoom), in rem.
  const [roomAsked, setRoomAsked] = React.useState(0);
  const pinned = ready && (Boolean(action) || roomAsked > 0);
  const room = action ? (actionNote ? 9 : 7) : roomAsked;

  // Each screen mounts its own frame, so this runs on every screen change:
  // keyboard and screen-reader users land on the new heading (d2), and the
  // window is scrolled to the top so the heading isn't left off-screen at
  // the previous screen's scroll position (focus alone doesn't scroll it
  // into view, since it's focused with preventScroll). React commits child
  // effects before parent effects, so a screen that scrolls itself after
  // mount (the service list's ?start) runs its own scroll after this one and
  // wins.
  React.useEffect(() => {
    if (!heading.current) return;
    heading.current.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [services.status, title]);

  // A field brought into view by Tab (or scrollIntoView) can land behind the
  // pinned action bar (WCAG 2.4.11 Focus Not Obscured). scroll-padding-bottom
  // keeps the browser's own scroll-into-view landing above it; restored on
  // unmount or when the action goes away so a screen with no pinned bar isn't
  // left with padding that no longer applies to it. Only set while the
  // pinned area actually shows (ready and an action), with extra room when a
  // note sits above the button.
  React.useEffect(() => {
    if (!pinned) return undefined;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${room}rem`;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [pinned, room]);

  return (
    <div className={`mx-auto flex min-h-dvh ${wide ? 'max-w-5xl' : 'max-w-md'} flex-col bg-[var(--wh-panel)] px-4 text-[var(--wh-ink)]`}>
      <header className="flex min-h-11 items-center border-b border-[var(--wh-border)] py-2 font-semibold">
        {services.data?.shopName ?? ''}
      </header>
      <main className="flex-1 py-3" style={pinned ? { paddingBottom: `${room}rem` } : undefined}>
        {services.isPending && <p role="status">Loading…</p>}
        {services.isError && (
          <>
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold focus:outline-none">
              {notFound ? "We can't find this shop" : 'Online booking is unavailable just now'}
            </h1>
            {/* bk-unavailable; its shop lines can't show, as they come with the services that failed (booking-search-unavailable design 3). */}
            {!notFound && <p className="m-0 mb-3 text-size-15 leading-normal">Please try again in a little while, or call the shop to book.</p>}
            {!notFound && (
              <Button variant="accent" onClick={() => services.refetch()}>
                Try again
              </Button>
            )}
          </>
        )}
        {ready && (
          <>
            {/* Coming back to an unfinished booking (book a repair decision 9; bk-resume). */}
            {resumed && (
              <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-[10px] bg-[var(--wh-warn-bg)] px-4 py-3.5 text-size-15 text-[var(--wh-warn-ink)]">
                <span className="grow"><strong>You didn’t finish booking.</strong> Carry on where you left off — everything you typed is still here.</span>
                <Button onClick={() => booking?.dismissResume()}>Carry on</Button>
                <button type="button" onClick={() => { booking?.clear(); navigate(`/book/${shopSlug}`); }} className="min-h-11 font-semibold text-[var(--wh-warn-ink)] underline">Start again</button>
              </div>
            )}
            {back && (
              <Link to={back} className="mb-1 inline-flex min-h-11 items-center text-sm text-[var(--accent-dark)]">
                <span aria-hidden="true">←</span> Back
              </Link>
            )}
            {step && (
              <div className="mb-3">
                <p className="m-0 mb-1 text-xs text-[var(--wh-muted)]">Step {step} of 4</p>
                <div
                  role="progressbar"
                  aria-label="Booking progress"
                  aria-valuemin={1}
                  aria-valuemax={4}
                  aria-valuenow={step}
                  className="h-1 rounded-sm bg-[var(--wh-border)]"
                >
                  <div className="h-1 rounded-sm bg-[var(--accent-dark)]" style={{ width: `${step * 25}%` }} />
                </div>
              </div>
            )}
            {eyebrow && <p className="m-0 mb-1 text-sm text-[var(--wh-muted)]">{eyebrow}</p>}
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold focus:outline-none">{title}</h1>
            <PinnedRoom.Provider value={setRoomAsked}>{children}</PinnedRoom.Provider>
          </>
        )}
      </main>
      {ready && action && (
        <div data-book-pinned className="fixed inset-x-0 bottom-0 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3">
          <div className="mx-auto max-w-md">
            {actionNote && <div className="mb-2 text-center text-sm">{actionNote}</div>}
            <Button variant="accent" block className="min-h-12" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
