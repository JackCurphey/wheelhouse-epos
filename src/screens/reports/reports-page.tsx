import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { BoxHeading, Page, Refusal } from './reports-bits.tsx';
import { money } from './reports-format.ts';
import { YourReports } from './your-reports.tsx';
import { NameDialog } from './save-report-dialog.tsx';

/**
 * Reports (rp-home in generator/reports.mjs; Jack's answers 1 and 2 of
 * 10 Nov; openspec/changes/reports-sales-and-takings): today's date and the
 * shop, the strip with this week's Takings so far (its Margin tile waits for
 * part 2), and a card for each report that is built. Each later part adds its
 * card here and nowhere else.
 */
type Home = { today: string; dateLine: string; shopLine: string; strip: { heading: string; takingsPence: number } };

const CARDS: { name: string; line: string; to: string }[] = [
  { name: 'Sales', line: 'Takings, number of sales and the average sale', to: ROUTES['rp-sales'] },
  // The drawing's "and till" is left out while closes are per shop (Jack's answer 4, 10 Nov).
  { name: 'Takings and cash-ups', line: 'Each closed day, and any cash difference', to: ROUTES['rp-takings'] },
  { name: 'Workshop', line: 'Jobs, labour and parts, how full each mechanic was', to: ROUTES['rp-workshop'] },
];

/**
 * The bar after a delete (rp-report-deleted; audit M6): "“[name]” deleted." with Undo, at the top of the page. It
 * stays until the person leaves Reports or deletes another report, and once Undo has been used it is gone for good.
 * If the name has been used again since, Undo says so and asks for a new name (decision 10).
 */
function DeletedBar({ gone, onBack }: { gone: { id: number; name: string }; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  // The menu item that was pressed has gone, so the focus goes to Undo, the next thing to do.
  useEffect(() => { undoButton.current?.focus(); }, []);
  async function undo() {
    setFailed(null);
    try {
      await apiMutate(`/api/reports/saved/${gone.id}/undo`, {});
      void queryClient.invalidateQueries({ queryKey: ['reports-saved'] });
      onBack();
    } catch (err) {
      // Only "that name is used again" needs a new name; anything else is said in the bar.
      if (serverSaid(err) && err instanceof ApiError && err.status === 400) setAsking(err.message);
      else setFailed(serverSaid(err) ? err.message : 'Wheelhouse couldn’t bring it back. Try again in a moment.');
    }
  }
  return (
    <>
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wh-surface-muted)] px-3.5 py-2.5 text-size-15 leading-snug">
        <Check size={18} aria-hidden="true" />
        <span className="min-w-[200px] flex-1">“{gone.name}” deleted.{failed ? ` ${failed}` : ''}</span>
        <button ref={undoButton} type="button" onClick={() => void undo()} className="inline-flex min-h-11 items-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">Undo</button>
      </div>
      {asking ? (
        <NameDialog
          title="Rename" what={`“${gone.name}” was deleted`} initial={gone.name} firstProblem={asking} withWho={false} onClose={() => setAsking(null)}
          send={(name) => apiMutate(`/api/reports/saved/${gone.id}/undo`, { name })}
          onDone={() => { setAsking(null); onBack(); }}
        />
      ) : null}
    </>
  );
}

export function ReportsPage() {
  const [gone, setGone] = useState<{ id: number; name: string } | null>(null);
  const home = useQuery({ queryKey: ['reports-home'], queryFn: () => apiGet<Home>('/api/reports/home'), retry: false });
  if (home.isError) return <Page><Refusal error={home.error} /></Page>;
  if (!home.data) return <Page><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;
  const { dateLine, shopLine, strip } = home.data;
  return (
    <Page>
      {gone ? <DeletedBar key={gone.id} gone={gone} onBack={() => setGone(null)} /> : null}
      <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{dateLine} · {shopLine}</p>
      <section aria-label={strip.heading} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
        <BoxHeading>{strip.heading}</BoxHeading>
        <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
            <span className="text-size-13-5 text-[var(--wh-muted)]">Takings</span>
            <span className="text-size-17 font-bold">{money(strip.takingsPence)}</span>
          </div>
          <Link to={ROUTES['rp-sales']} className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3 text-[var(--wh-ink)] no-underline">
            <span className="flex min-w-0 flex-col gap-0.5"><span className="text-size-13-5 text-[var(--wh-muted)]">Shop</span><span className="text-size-17 font-bold">{shopLine}</span></span>
            <span aria-hidden="true" className="text-[var(--wh-muted)]">›</span>
          </Link>
        </div>
      </section>
      <section aria-labelledby="rp-ready" className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
        <BoxHeading id="rp-ready">Ready-made reports</BoxHeading>
        <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
          {CARDS.map((c) => (
            <Link key={c.name} to={c.to} className="flex min-h-[76px] flex-col gap-1 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3.5 text-[var(--wh-ink)] no-underline">
              <span className="text-size-15 font-bold">{c.name}</span>
              <span className="text-sm text-[var(--wh-muted)]">{c.line}</span>
            </Link>
          ))}
        </div>
      </section>
      <YourReports onDeleted={setGone} />
    </Page>
  );
}

