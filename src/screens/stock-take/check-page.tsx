import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { Card, Page, Tag, mono } from '@/screens/deliveries/deliveries-bits.tsx';
import { appliedHref, atCost, plural, pounds, type Applied, type Take } from './stock-take-bits.ts';

/**
 * Check the count (tk-diff in stock.mjs; stock control decisions 5 and 11;
 * UX walk-through 3 H2; openspec/changes/stock-take design 8 to 12): the
 * products that differ, largest value first, with expected, counted (and by
 * whom), what moved after the count and was allowed for, and the difference
 * at cost; Recount; what nobody counted, with Count them as none; then
 * "Apply to [n] products". For the Owner.
 */
type Row = {
  productId: number; name: string; sku: string | null; expected: number; counted: number; difference: number;
  valuePence: number; byCounter: { name: string; qty: number }[]; allowedFor: { kind: string; change: number }[];
};
type Checked = Take & {
  productsCounted: number; productsMatching: number; productsDiffering: number; valuePence: number; rows: Row[];
  recountAsked: { productId: number; name: string; sku: string | null; askedBy: string }[];
  notCounted: { products: number; expected: number; list: { productId: number; name: string; sku: string | null }[] } | null;
};

// "1 sold during the count, allowed for" (drawn on tk-diff), one line for each kind.
function allowed(a: { kind: string; change: number }) {
  const n = a.kind === 'adjusted' ? `${a.change > 0 ? '+' : ''}${a.change}` : String(Math.abs(a.change));
  return `${n} ${a.kind} during the count, allowed for`;
}
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,2fr)_90px_minmax(0,1.2fr)_minmax(0,1.1fr)_auto]';
const cellBtn = 'inline-flex min-h-11 min-w-11 items-center justify-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline';

function DiffTag({ difference, valuePence }: { difference: number; valuePence: number }) {
  const under = difference < 0;
  return (
    <span className={`inline-flex min-h-[26px] items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${under ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
      {`${Math.abs(difference)} ${under ? 'under' : 'over'} · ${pounds(valuePence)}`}
    </span>
  );
}

export function CheckPage() {
  const id = Number(useParams().id ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const key = ['stock-take-check', id];
  const checked = useQuery({ queryKey: key, queryFn: () => apiGet<Checked>(`/api/stock-takes/${id}/check`) });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function act(what: string, body: object, after?: (reply: unknown) => void) {
    setBusy(true);
    setProblem(null);
    try {
      const reply = await apiMutate<unknown>(`/api/stock-takes/${id}/${what}`, body);
      void queryClient.invalidateQueries({ queryKey: ['stock-takes'] });
      if (after) after(reply);
      else await queryClient.invalidateQueries({ queryKey: key });
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t do that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  const apply = () => act('apply', {}, (reply) => navigate(appliedHref(id), { state: { justApplied: reply as Applied } }));

  const back = (
    <Link to={ROUTES.stocktake} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>Stock take
    </Link>
  );
  if (checked.isError) return <Page>{back}<p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this count. Try again in a moment.</p></Page>;
  const c = checked.data;
  if (!c) return <Page>{back}<p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;
  return (
    <Page>
      {back}
      <Card id="t-check" title={`Check the count of ${c.label}`}>
        <p className="m-0 text-size-15">{`${plural(c.productsCounted, 'product')} counted · ${c.productsMatching} match · ${c.productsDiffering} differ · `}<strong>{`${atCost(c.valuePence)}, in all`}</strong></p>
        <div role="table" aria-label="Differences, largest value first">
          <div role="row" className={`${GRID} text-size-13 font-bold text-[var(--wh-muted)]`}>
            <span role="columnheader">Product</span>
            <span role="columnheader" className="max-md:hidden">Expected</span>
            <span role="columnheader" className="max-md:hidden">Counted</span>
            <span role="columnheader" aria-sort="descending">Difference</span>
            <span className="w-[76px] max-md:hidden" />
          </div>
          {c.rows.map((r) => (
            <div role="row" key={r.productId} className={`${GRID} min-h-14 border-t border-[var(--wh-border)] py-2`}>
              <span role="cell" className="flex min-w-0 flex-col gap-0.5">
                <span className="text-size-15 font-semibold">{r.name}</span>
                {[r.sku, r.expected < 0 ? 'was below zero' : null, ...r.allowedFor.map(allowed)].filter(Boolean).map((t) => (
                  <span key={t} className="text-size-13 text-[var(--wh-muted)]">{t}</span>
                ))}
              </span>
              <span role="cell" className={`${mono} text-size-15 max-md:hidden`}>{r.expected}</span>
              <span role="cell" className="flex flex-col gap-0.5 max-md:hidden">
                <span className={`${mono} text-size-15`}>{r.counted}</span>
                {r.byCounter.length > 1 ? <span className="text-xs text-[var(--wh-muted)]">{r.byCounter.map((b) => `${b.name} ${b.qty}`).join(' + ')}</span> : null}
              </span>
              <span role="cell"><DiffTag difference={r.difference} valuePence={r.valuePence} /></span>
              <span role="cell" className="max-md:hidden">
                <button type="button" disabled={busy} className={cellBtn} aria-label={`Ask for ${r.name} to be recounted`} onClick={() => void act('recount', { productId: r.productId })}>Recount</button>
              </span>
            </div>
          ))}
          {c.recountAsked.map((r) => (
            <div role="row" key={`r${r.productId}`} className={`${GRID} min-h-14 border-t border-[var(--wh-border)] py-2`}>
              <span role="cell" className="flex min-w-0 flex-col gap-0.5">
                <span className="text-size-15 font-semibold">{r.name}</span>
                {r.sku ? <span className="text-size-13 text-[var(--wh-muted)]">{r.sku}</span> : null}
              </span>
              <span role="cell" className="max-md:hidden" />
              <span role="cell" className="max-md:hidden" />
              <span role="cell"><Tag>Recount asked</Tag></span>
              <span role="cell" className="max-md:hidden" />
            </div>
          ))}
        </div>
        {c.notCounted ? (
          <>
            <details className="border-t border-[var(--wh-border)] pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-size-15 font-semibold">{`Not counted · ${plural(c.notCounted.products, 'product')} · expected ${c.notCounted.expected} in all`}</summary>
              <ul aria-label="Not counted" className="m-0 list-none p-0">
                {c.notCounted.list.map((p) => <li key={p.productId} className="py-1 text-sm">{p.sku ? `${p.name} · ${p.sku}` : p.name}</li>)}
              </ul>
            </details>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <p className="m-0 text-sm text-[var(--wh-muted)]">Products nobody scanned are left as they are.</p>
              {c.notCounted.products > 0 ? <Button variant="default" disabled={busy} onClick={() => void act('none', {})}>Count them as none</Button> : null}
            </div>
          </>
        ) : null}
        {/* The drawn note, shortened until it is true (review, 28 Oct): nothing
            holds stock yet, jobs don't move stock, nothing is sent between shops. */}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Anything sold, booked in or adjusted during the count is allowed for.</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--wh-border)] pt-1.5">
          <span className="text-sm text-[var(--wh-muted)]">Products that match aren’t listed. Recount sends a line back to the counters.</span>
          <Button variant="accent" disabled={busy} onClick={() => void apply()}>{`Apply to ${plural(c.productsDiffering, 'product')}`}</Button>
        </div>
      </Card>
    </Page>
  );
}
