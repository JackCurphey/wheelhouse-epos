import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useServices } from './services-query.ts';

/**
 * The frame around every book screen (Jack, 26 Sep: pinned button). Shop's
 * name at the top, an optional back link, "Step n of 4" with a progress bar,
 * the screen's title as its h1, then the screen. The main action is pinned to
 * the bottom of the viewport so it stays under the thumb on long screens; the
 * page gets bottom padding so the button never covers the last field.
 * `pending` passes no step and no back link.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export type BookFrameProps = {
  step?: 1 | 2 | 3 | 4;
  title: string;
  back?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children: React.ReactNode;
};

export function BookFrame({ step, title, back, action, children }: BookFrameProps) {
  const { shopSlug = '' } = useParams();
  const services = useServices(shopSlug);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-4 text-[var(--wh-ink)]">
      <header className="flex min-h-11 items-center border-b border-[var(--wh-border)] py-2 font-semibold">
        {services.data?.shopName ?? ''}
      </header>
      <main className={cn('flex-1 py-3', action && 'pb-28')}>
        {back && (
          <Link to={back} className="mb-1 inline-flex min-h-11 items-center text-sm text-[var(--accent-dark)]">
            ← Back
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
        <h1 className="m-0 mb-3 text-xl font-semibold">{title}</h1>
        {children}
      </main>
      {action && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--wh-border)] bg-white px-4 py-3">
          <div className="mx-auto max-w-md">
            <Button variant="accent" block className="min-h-12" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
