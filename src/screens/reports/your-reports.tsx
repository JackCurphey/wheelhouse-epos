import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { BoxHeading, Note, Refusal } from './reports-bits.tsx';
import { savedAddress, type SavedReport } from './changed-format.ts';
import { ReportMenu } from './report-menu.tsx';
import { NameDialog } from './save-report-dialog.tsx';

/**
 * Your reports (rp-home in generator/reports.mjs `yourReports` and `mine`; openspec/changes/
 * reports-your-own, decisions 8 to 11): the person's own saved reports, each with its name, what it is,
 * a badge of who can see it and a "More for [name]" menu (Rename, Share with managers, Delete), opening on
 * the latest period of the kind it was saved on. Delete goes at once and tells the page (`onDeleted`),
 * which shows the bar with Undo.
 */
export function YourReports({ onDeleted }: { onDeleted: (gone: { id: number; name: string }) => void }) {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ['reports-saved'], queryFn: () => apiGet<{ reports: SavedReport[] }>('/api/reports/saved'), retry: false });
  const [renaming, setRenaming] = useState<SavedReport | null>(null);
  const remove = useMutation({
    mutationFn: (r: SavedReport) => apiMutate<{ id: number; name: string }>(`/api/reports/saved/${r.id}`, undefined, { method: 'DELETE' }),
    onSuccess: (gone) => { void queryClient.invalidateQueries({ queryKey: ['reports-saved'] }); onDeleted(gone); },
  });
  const reports = saved.data?.reports ?? [];
  return (
    <section aria-labelledby="rp-mine" className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
      <BoxHeading id="rp-mine">Your reports</BoxHeading>
      {saved.isError ? <Refusal error={saved.error} /> : null}
      {remove.isError ? <Refusal error={remove.error} /> : null}
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
          <ReportMenu name={r.name} onRename={() => setRenaming(r)} onDelete={() => remove.mutate(r)} />
        </div>
      ))}
      {renaming ? (
        <NameDialog
          title="Rename" what={renaming.what} initial={renaming.name} withWho={false} onClose={() => setRenaming(null)}
          send={(name) => apiMutate<SavedReport>(`/api/reports/saved/${renaming.id}`, { name }, { method: 'PATCH' })}
          onDone={() => setRenaming(null)}
        />
      ) : null}
    </section>
  );
}
