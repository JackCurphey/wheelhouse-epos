import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client.ts';
import { useServices } from './services-query.ts';

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
export type BookFrameProps = {
  step?: 1 | 2 | 3 | 4;
  title: string;
  back?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  actionNote?: React.ReactNode;
  children: React.ReactNode;
};

export function BookFrame({ step, title, back, action, actionNote, children }: BookFrameProps) {
  const { shopSlug = '' } = useParams();
  const services = useServices(shopSlug);

  const heading = React.useRef<HTMLHeadingElement>(null);
  const ready = services.isSuccess;
  const notFound = services.error instanceof ApiError && services.error.code === 'not_found';

  // Each screen mounts its own frame, so this runs on every screen change:
  // keyboard and screen-reader users land on the new heading (d2). No
  // scroll, so a screen that scrolls itself (the service list's ?start) keeps
  // its position.
  React.useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [services.status, title]);

  // A field brought into view by Tab (or scrollIntoView) can land behind the
  // pinned action bar (WCAG 2.4.11 Focus Not Obscured). scroll-padding-bottom
  // keeps the browser's own scroll-into-view landing above it; restored on
  // unmount or when the action goes away so a screen with no pinned bar isn't
  // left with padding that no longer applies to it. Only set while the
  // pinned area actually shows (ready and an action), with extra room when a
  // note sits above the button.
  React.useEffect(() => {
    if (!(action && ready)) return undefined;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = actionNote ? '9rem' : '7rem';
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [action, ready, actionNote]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-4 text-[var(--wh-ink)]">
      <header className="flex min-h-11 items-center border-b border-[var(--wh-border)] py-2 font-semibold">
        {services.data?.shopName ?? ''}
      </header>
      <main className={cn('flex-1 py-3', ready && action && (actionNote ? 'pb-36' : 'pb-28'))}>
        {services.isPending && <p role="status">Loading…</p>}
        {services.isError && (
          <>
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold">
              {notFound ? "We can't find this shop" : "We couldn't load this shop's services"}
            </h1>
            {!notFound && (
              <Button variant="accent" onClick={() => services.refetch()}>
                Try again
              </Button>
            )}
          </>
        )}
        {ready && (
          <>
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
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold focus:outline-none">{title}</h1>
            {children}
          </>
        )}
      </main>
      {ready && action && (
        <div data-book-pinned className="fixed inset-x-0 bottom-0 border-t border-[var(--wh-border)] bg-white px-4 py-3">
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
