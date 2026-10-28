import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { buttonVariants } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Card, Page } from '@/screens/deliveries/deliveries-bits.tsx';
import { checkHref, plural, type Applied } from './stock-take-bits.ts';

/**
 * Count applied (tk-applied in stock.mjs; decision 11: applied counts have
 * Undo): straight after Apply, a bar "Count applied · [Area] · [n] products
 * corrected" with Undo, which stays until the page is left; and the box with
 * what was corrected and Download the count. Opened later from Finished
 * counts, the box only. For the Owner.
 */
export function AppliedPage() {
  const id = Number(useParams().id ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Held here, and taken off the history entry at once, so a reload or a
  // later visit to this address shows the box without the Undo bar.
  const [just] = useState((location.state as { justApplied?: Applied } | null)?.justApplied);
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const hub = useQuery({ queryKey: ['stock-takes'], queryFn: () => apiGet<{ finished?: Applied[] }>('/api/stock-takes'), enabled: !just });
  const take = just ?? hub.data?.finished?.find((t) => t.id === id);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function undo() {
    setBusy(true);
    setProblem(null);
    try {
      await apiMutate(`/api/stock-takes/${id}/undo`, {});
      void queryClient.invalidateQueries({ queryKey: ['stock-takes'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-take-check', id] });
      navigate(checkHref(id), { replace: true });
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t undo the count. Try again in a moment.');
      setBusy(false);
    }
  }

  const back = (
    <Link to={ROUTES.stocktake} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>Stock take
    </Link>
  );
  if (!take) {
    return <Page>{back}<p className="m-0 text-sm text-[var(--wh-muted)]">{hub.isError || hub.data ? 'This count isn’t one of the finished counts.' : 'Loading…'}</p></Page>;
  }
  return (
    <Page>
      {back}
      {just ? (
        <div role="status" className="flex items-center gap-3 self-start rounded-lg bg-[var(--wh-ink)] py-1 pr-1 pl-3.5 text-sm font-semibold text-[var(--wh-panel)]">
          <span>{`Count applied · ${take.label} · ${plural(take.productsChanged, 'product')} corrected`}</span>
          <button type="button" disabled={busy} onClick={() => void undo()} className="min-h-11 border-0 bg-transparent px-3 text-sm font-bold text-[var(--wh-panel)] underline">Undo</button>
        </div>
      ) : null}
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      <Card id="t-count-applied" title="Count applied">
        <p className="m-0 flex items-center gap-2 text-base font-bold text-[var(--wh-status-complete-ink)]">
          <NavIcon name="check" size={18} />{`${take.label} · stock corrected for ${plural(take.productsChanged, 'product')}`}
        </p>
        <p className="m-0 text-sm text-[var(--wh-muted)]">Each change is in its product’s stock history as “Counted”, with who counted and who applied it. Products that were below zero are now corrected; products nobody scanned were left as they are.</p>
        <div><a href={`/api/stock-takes/${id}/download`} download className={buttonVariants({ variant: 'default' })}>Download the count</a></div>
      </Card>
    </Page>
  );
}
