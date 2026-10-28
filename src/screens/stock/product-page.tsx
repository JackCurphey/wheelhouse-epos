import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { when } from '@/screens/diary/when.ts';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button';
import { AdjustStock, REASON_LABEL } from './adjust-stock.tsx';
import { count, marginText, money, mono, stockState, StateTag, type Product } from './stock-bits.tsx';

/**
 * A product's page (drawn as st-product, st-product-staff and st-product-bike
 * in stock.mjs; stock control decisions 3 and 11; openspec/changes/stock-list):
 * back to Stock and the product's name; on the left its codes, In stock,
 * then Price (and for the Owner, cost and margin); on the right one stock
 * history, newest first, each line with its reason and who where recorded.
 * Anyone with the page can Adjust stock (st-adjust; openspec/changes/adjust-stock);
 * Edit and sending to another shop come with later pieces, and a stock
 * bike's frame numbers aren't recorded yet.
 */
type Move = { id: number; type: string; change: number; reason: string | null; note: string; who: string | null; at: string };
type Page = Product & { history: Move[] };
type Show = 'Everything' | 'Sold' | 'Received' | 'Counted and adjusted';
const WHAT: Record<string, [string, Show | null]> = {
  sale: ['Sold', 'Sold'],
  till_sale: ['Sold', 'Sold'],
  return: ['Returned', 'Sold'],
  po_receipt: ['Received', 'Received'],
  intake: ['Booked in', 'Received'],
  adjustment: ['Adjusted', 'Counted and adjusted'],
  // A stock take applied, and undone (openspec/changes/stock-take).
  count: ['Counted', 'Counted and adjusted'],
  count_undone: ['Count undone', 'Counted and adjusted'],
};
const SHOWS: Show[] = ['Everything', 'Sold', 'Received', 'Counted and adjusted'];
const change = (n: number) => (n > 0 ? `+${n}` : count(n));

function Box({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4 max-md:px-3.5 max-md:py-3.5">
      <h3 id={id} className="m-0 text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}
const kv = (k: string, v: React.ReactNode) => (
  <div className="flex min-h-8 items-center justify-between gap-3 text-size-15">
    <span className="text-[var(--wh-muted)]">{k}</span>
    <span className="inline-flex items-center gap-2">{v}</span>
  </div>
);

export function ProductPage() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const here = session.status === 'signed-in' ? session.shop.name : 'Here';
  const isPhone = useMedia('(max-width: 767px)');
  const [show, setShow] = useState<Show>('Everything');
  const [adjusting, setAdjusting] = useState(false);
  const product = useQuery({ queryKey: ['product', id], queryFn: () => apiGet<Page>(`/api/products/${id}`), retry: false, enabled: known });
  if (!known || product.isError) {
    return <p role="alert" className="m-0 text-sm">{!known || (product.error instanceof ApiError && product.error.status === 404) ? 'Product not found' : 'Wheelhouse couldn’t load this product. Try again in a moment.'}</p>;
  }
  const p = product.data;
  if (!p) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  const codes = [p.sku, p.category, p.supplier, p.barcode ? `barcode ${p.barcode}` : null].filter(Boolean).join(' · ');
  const moves = p.history.filter((m) => show === 'Everything' || WHAT[m.type]?.[1] === show);
  const pill = (s: Show) => (
    <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setShow(s)}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${show === s ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{s}</button>
  );
  return (
    <div className="flex flex-col gap-3.5">
      <Link to={ROUTES.stock} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>Stock</Link>
      <div className="flex flex-col gap-[3px]">
        <h2 className="m-0 text-size-22 font-bold">{p.name}</h2>
        {p.active ? null : <span className="text-sm text-[var(--wh-muted)]">Taken off sale</span>}
      </div>
      <div className={`grid items-start gap-3.5 ${isPhone ? 'grid-cols-1' : 'grid-cols-[minmax(0,380px)_minmax(0,1fr)]'}`}>
        <div className="flex min-w-0 flex-col gap-3">
          {codes || p.photoUrl ? (
            <div className="flex items-center gap-3.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4">
              {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-[72px] shrink-0 rounded-lg object-cover" /> : null}
              <span className="min-w-0 text-size-13 text-[var(--wh-muted)]">{codes}</span>
            </div>
          ) : null}
          <Box id="h-in-stock" title="In stock">
            {kv(here, <><StateTag state={stockState(p)} /><span className={mono}>{count(p.stockQty)}</span></>)}
            {kv('Low-stock level', <span className={mono}>{p.lowStockThreshold}</span>)}
            {/* Anyone with the Stock page adjusts (2026-10-26-day-answers.md section 11). */}
            <div className="flex flex-wrap gap-2 pt-1"><Button onClick={() => setAdjusting(true)}>Adjust stock</Button></div>
          </Box>
          <Box id="h-price" title={owner ? 'Price and cost' : 'Price'}>
            {kv('Price', <span className={mono}>{money(p.price)}</span>)}
            {owner && p.cost !== null ? kv('Cost', <span className={mono}>{money(p.cost)}</span>) : null}
            {owner && p.cost !== null ? kv('Margin', marginText(p)) : null}
            {kv('VAT', p.vatRateBp === null ? '—' : `${p.vatRateBp / 100}%`)}
            {owner ? kv('Show on website', p.showOnline ? `On · as ${p.category}` : 'Off') : null}
          </Box>
        </div>
        <section aria-labelledby="h-history" className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4 max-md:px-3.5 max-md:py-3.5">
          <h3 id="h-history" className="m-0 text-base font-bold">Stock history</h3>
          {p.history.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing has changed its stock yet.</p> : (
            <>
              <RadioPillGroup aria-label="Show" className="flex flex-wrap gap-2">{SHOWS.map(pill)}</RadioPillGroup>
              {moves.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing here yet.</p> : (
                <ul aria-labelledby="h-history" className="m-0 list-none p-0">
                  {moves.map((m) => (
                    <li key={m.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_72px] items-center gap-3 border-t border-[var(--wh-border)] py-1.5 max-md:grid-cols-[minmax(0,1fr)_auto]">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-size-15 font-semibold">{[WHAT[m.type]?.[0] ?? 'Stock changed', m.reason ? REASON_LABEL[m.reason] : null].filter(Boolean).join(' · ')}</span>
                        <span className="text-size-13 text-[var(--wh-muted)]">{[m.reason && m.note ? `Note: ${m.note}` : m.note, m.who && m.type === 'count' ? `applied by ${m.who}` : m.who, when(m.at)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={`${mono} text-right text-size-15 font-bold`}>{change(m.change)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
      {adjusting ? <AdjustStock product={p} shopName={here} onClose={() => setAdjusting(false)} /> : null}
    </div>
  );
}
