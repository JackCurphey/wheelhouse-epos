import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { BoxHeading, Note, Refusal } from './reports-bits.tsx';
import { savedAddress, type SavedReport } from './changed-format.ts';

/**
 * Your reports (rp-home in generator/reports.mjs `yourReports` and `mine`; openspec/changes/
 * reports-your-own, decisions 8 and 9): the person's own saved reports, each with its name, what it is,
 * a badge of who can see it, opening on the latest period of the kind it was saved on. The "More for
 * [name]" menu (Rename, Share, Delete) comes in the next pull request.
 */
export function YourReports() {
  const saved = useQuery({ queryKey: ['reports-saved'], queryFn: () => apiGet<{ reports: SavedReport[] }>('/api/reports/saved'), retry: false });
  const reports = saved.data?.reports ?? [];
  return (
    <section aria-labelledby="rp-mine" className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
      <BoxHeading id="rp-mine">Your reports</BoxHeading>
      {saved.isError ? <Refusal error={saved.error} /> : null}
      {saved.data && reports.length === 0 ? <Note>Start from any report, choose “Change what’s shown”, then “Save as my report”.</Note> : null}
      {reports.map((r) => (
        <div key={r.id} className="flex min-h-14 items-center gap-2 border-t border-[var(--wh-border)]">
          <Link to={savedAddress(r, ROUTES['rp-changed'])} className="flex min-h-14 flex-1 items-center gap-3 text-[var(--wh-ink)] no-underline">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-size-15 font-bold">{r.name}</span>
              <span className="text-size-13-5 text-[var(--wh-muted)]">{r.what}</span>
            </span>
            <span className="rounded-full bg-[var(--wh-surface-muted)] px-2.5 py-0.5 text-size-13-5 font-semibold">{r.shared ? 'Shared with managers' : 'Just you'}</span>
          </Link>
        </div>
      ))}
    </section>
  );
}
