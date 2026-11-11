import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError, serverSaid } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';

/** The page's width and spacing, as the other staff pages have it. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">{children}</div>;
}

/** reports.mjs `box`: a white card with its content spaced out. */
export function Box({ children, label }: { children: ReactNode; label?: string }) {
  return <section aria-label={label} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">{children}</section>;
}

export function BoxHeading({ id, children }: { id?: string; children: ReactNode }) {
  return <h3 id={id} className="m-0 text-size-17 font-bold">{children}</h3>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm text-[var(--wh-muted)]">{children}</p>;
}

/** "All reports", back to the page (reports.mjs `back`). */
export function BackToReports() {
  return (
    <Link to={ROUTES.reports} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>All reports
    </Link>
  );
}

/** A refusal in the server's own words, or a plain failure. */
export function Refusal({ error }: { error: unknown }) {
  const words = serverSaid(error) ? error.message : error instanceof ApiError || error instanceof Error ? 'Something went wrong showing this report. Try again.' : 'Something went wrong.';
  return <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{words}</p>;
}
