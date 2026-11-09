import { Fragment, useState } from 'react';
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
import { ProductBox } from './product-box.tsx';
import { answerText, type Detail } from './stock-list-bits.tsx';
import { count, marginText, money, mono, stockState, StateTag, type Product } from './stock-bits.tsx';
import { dateText } from '@/screens/deliveries/frame-number.tsx';

/**
 * A product's page (drawn as st-product, st-product-staff and st-product-bike
 * in stock.mjs; stock control decisions 3 and 11; openspec/changes/stock-list):
 * back to Stock and the product's name; on the left its codes, In stock,
 * then Price (and for the Owner, cost and margin); on the right one stock
 * history, newest first, each line with its reason and who where recorded.
 * Anyone with the page can Adjust stock (st-adjust; openspec/changes/adjust-stock);
 * the Owner can Edit it, and its details, in the product box
 * (openspec/changes/product-page-sizes, design 2). Sending to another shop comes
 * with its own piece. A bike lists its frame numbers first, each booked in from its delivery
 * (st-product-bike; openspec/changes/frame-numbers, design 5).
 */
// A size's line names its size and colour (st-product-sizes).
type Which = { size?: string | null; colour?: string | null };
// A received line names its delivery, and for a bike how many frames came in on it (frame-numbers, design 4).
type Move = Which & { id: number; type: string; change: number; reason: string | null; note: string; who: string | null; at: string; delivery?: { id: number; supplierName: string | null } | null; frames?: number };
// A price or cost change, sent to the Owner only (openspec/changes/product-page-sizes, design 1).
type PriceChange = Which & { id: string; type: 'price_change'; field: 'price' | 'cost'; was: number; now: number; who: string | null; at: string; delivery: { id: number; supplierName: string | null } | null };
export type Line = Move | PriceChange;
export type ShopStock = { id: number; name: string; qty: number; here: boolean };
type Answered = Detail & { from: string; value: number | string | null };
type Frame = { id: number; frameNumber: string; state: 'in_stock' | 'held' | 'sold'; bookedInAt: string; deliveryId: number | null; supplierName: string | null };
type Page = Product & { stockAtShops: ShopStock[]; history: Line[]; details?: Answered[]; isBike?: boolean; frames?: Frame[] };
type Show = 'Everything' | 'Sold' | 'Received' | 'Counted and adjusted' | 'Price changes';
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
  price_change: ['Price changed', 'Price changes'],
};
const SHOWS: Show[] = ['Everything', 'Sold', 'Received', 'Counted and adjusted', 'Price changes'];
const change = (n: number) => (n > 0 ? `+${n}` : count(n));
const isPrice = (m: Line): m is PriceChange => m.type === 'price_change';
// "Price changed · £28.00 → £[price]" as st-product draws it; a cost's the same, for the Owner.
const lineWhat = (m: Line) => (isPrice(m)
  ? `${m.field === 'price' ? 'Price changed' : 'Cost changed'} · ${money(m.was)} → ${money(m.now)}`
  : [WHAT[m.type]?.[0] ?? 'Stock changed', m.reason ? REASON_LABEL[m.reason] : null].filter(Boolean).join(' · '));
const sizeText = (m: Line) => [m.size ? `Size ${m.size}` : null, m.colour].filter(Boolean).join(' · ') || null;
const lineDetail = (m: Line) => [sizeText(m), ...(isPrice(m)
  ? [m.delivery ? `delivery from ${m.delivery.supplierName ?? 'a supplier'}` : null, m.who, when(m.at)]
  : [m.frames ? `${m.frames} ${m.frames === 1 ? 'frame number' : 'frame numbers'}` : m.reason && m.note ? `Note: ${m.note}` : m.note, m.who && m.type === 'count' ? `applied by ${m.who}` : m.who, when(m.at)])].filter(Boolean).join(' · ');
// "Received · delivery from [Supplier]", opening the delivery (st-product-bike's history).
const fromDelivery = (m: Line) => (!isPrice(m) && m.delivery && ['po_receipt', 'intake'].includes(m.type) ? m.delivery : null);
const FRAME_TAG: Record<Frame['state'], [string, string]> = {
  in_stock: ['In stock', 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'],
  held: ['Held', 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]'],
  sold: ['Sold', 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]'],
};

/** Bikes by frame number (st-product-bike): each frame, its state, and the delivery it came in on. */
function BikeFrames({ frames, stock }: { frames: Frame[]; stock: number }) {
  const inStock = frames.filter((f) => f.state === 'in_stock').length;
  return (
    <Box id="h-frames" title="Bikes by frame number">
      {frames.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No bikes in stock yet. Each bike’s frame number is recorded when it’s booked in.</p> : (
        <ul aria-labelledby="h-frames" className="m-0 list-none p-0">
          {frames.map((f) => (
            <li key={f.id} className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[var(--wh-border)] py-2">
              <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                <span className="text-size-15 font-semibold">Frame <span className={mono}>{f.frameNumber}</span></span>
                <span className="text-size-13 text-[var(--wh-muted)]">{`Booked in ${dateText(f.bookedInAt)}${f.supplierName ? ` from ${f.supplierName}` : ''}`}</span>
              </span>
              <span className={`inline-flex min-h-[26px] items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${FRAME_TAG[f.state][1]}`}>{FRAME_TAG[f.state][0]}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Until the till picks which bike it sells (till-serial), a sale or an adjustment leaves its frame here. */}
      {inStock > stock ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">The till doesn’t pick a bike’s frame yet, so a bike sold or adjusted may still be listed here.</p> : null}
    </Box>
  );
}

export function Box({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4 max-md:px-3.5 max-md:py-3.5">
      <div className="flex items-center justify-between gap-3"><h3 id={id} className="m-0 text-base font-bold">{title}</h3>{action}</div>
      {children}
    </section>
  );
}
export const kv = (k: string, v: React.ReactNode) => (
  <div className="flex min-h-8 items-center justify-between gap-3 text-size-15">
    <span className="text-[var(--wh-muted)]">{k}</span>
    <span className="inline-flex items-center gap-2">{v}</span>
  </div>
);

/** One history, newest first, with its filter (st-product); a size's line says which size (st-product-sizes). */
export function StockHistory({ history }: { history: Line[] }) {
  const [show, setShow] = useState<Show>('Everything');
  const moves = history.filter((m) => show === 'Everything' || WHAT[m.type]?.[1] === show);
  // Price changes only when there are some: staff are sent none (st-product-staff).
  const shows = history.some(isPrice) ? SHOWS : SHOWS.filter((s) => s !== 'Price changes');
  const pill = (s: Show) => (
    <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setShow(s)}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${show === s ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{s}</button>
  );
  return (
    <section aria-labelledby="h-history" className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4 max-md:px-3.5 max-md:py-3.5">
      <h3 id="h-history" className="m-0 text-base font-bold">Stock history</h3>
      {history.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing has changed its stock yet.</p> : (
        <>
          <RadioPillGroup aria-label="Show" className="flex flex-wrap gap-2">{shows.map(pill)}</RadioPillGroup>
          {moves.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing here yet.</p> : (
            <ul aria-labelledby="h-history" className="m-0 list-none p-0">
              {moves.map((m) => (
                <li key={m.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_72px] items-center gap-3 border-t border-[var(--wh-border)] py-1.5 max-md:grid-cols-[minmax(0,1fr)_auto]">
                  <span className="flex min-w-0 flex-col">
                    {fromDelivery(m) ? (
                      <Link to={ROUTES['rs-delivery'].replace(':id', String(fromDelivery(m)!.id))} className="text-size-15 font-semibold text-[var(--wh-ink)]">
                        {`${WHAT[m.type][0]} · delivery from ${fromDelivery(m)!.supplierName ?? 'a supplier'}`}
                      </Link>
                    ) : <span className="text-size-15 font-semibold">{lineWhat(m)}</span>}
                    <span className="text-size-13 text-[var(--wh-muted)]">{lineDetail(m)}</span>
                  </span>
                  <span className={`${mono} text-right text-size-15 font-bold`}>{isPrice(m) ? '' : change(m.change)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function ProductPage() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const isPhone = useMedia('(max-width: 767px)');
  const [adjusting, setAdjusting] = useState(false);
  const [editing, setEditing] = useState<'name' | 'details' | null>(null);
  // Who may edit is who the server sends a cost to (canSeeCosts, product-editor.js): the Owner's
  // sign-in with someone else checked in is that person (the review).
  const product = useQuery({ queryKey: ['product', id], queryFn: () => apiGet<Page>(`/api/products/${id}`), retry: false, enabled: known });
  if (!known || product.isError) {
    return <p role="alert" className="m-0 text-sm">{!known || (product.error instanceof ApiError && product.error.status === 404) ? 'Product not found' : 'Wheelhouse couldn’t load this product. Try again in a moment.'}</p>;
  }
  const p = product.data;
  if (!p) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  // The shop this computer changes stock at (openspec/changes/stock-per-shop, design 7).
  const here = p.stockAtShops.find((s) => s.here);
  const canEdit = owner && p.costPence !== null;
  const codes = [p.sku, p.category, p.supplier, p.barcode ? `barcode ${p.barcode}` : null].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-3.5">
      <Link to={ROUTES.stock} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>Stock</Link>
      <div className="flex flex-col gap-[3px]">
        <h2 className="m-0 text-size-22 font-bold">{p.name}</h2>
        {p.active ? null : <span className="text-sm text-[var(--wh-muted)]">Taken off sale</span>}
      </div>
      <div className={`grid items-start gap-3.5 ${isPhone ? 'grid-cols-1' : 'grid-cols-[minmax(0,380px)_minmax(0,1fr)]'}`}>
        <div className="flex min-w-0 flex-col gap-3">
          {codes || p.photoUrl || canEdit ? (
            <div className="flex items-center gap-3.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4">
              {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-[72px] shrink-0 rounded-lg object-cover" /> : null}
              <span className="flex min-w-0 flex-col items-start gap-1.5">
                <span className="text-size-13 text-[var(--wh-muted)]">{codes}</span>
                {/* Edit is the Owner's, as drawn (stock control decision 11). */}
                {canEdit ? <Button onClick={() => setEditing('name')}>Edit</Button> : null}
              </span>
            </div>
          ) : null}
          <Box id="h-in-stock" title="In stock">
            {/* tr-sites' lines. "On its way" comes with sending stock. */}
            {p.stockAtShops.map((s) => (
              <Fragment key={s.id}>{kv(s.name, <><StateTag state={stockState({ stockQty: s.qty, lowStockThreshold: p.lowStockThreshold })} /><span className={mono}>{count(s.qty)}</span></>)}</Fragment>
            ))}
            {kv('Low-stock level', <span className={mono}>{p.stockAtShops.length > 1 ? `${p.lowStockThreshold} each` : p.lowStockThreshold}</span>)}
            {/* Anyone with the Stock page adjusts (2026-10-26-day-answers.md section 11). */}
            <div className="flex flex-wrap gap-2 pt-1"><Button onClick={() => setAdjusting(true)}>Adjust stock</Button></div>
          </Box>
          {p.details?.length ? (
            <Box id="h-details" title={`Details · ${p.category}`}
              action={canEdit ? <button type="button" aria-label="Edit details" onClick={() => setEditing('details')} className="inline-flex min-h-11 items-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">Edit</button> : null}>
              {p.details.map((d) => <Fragment key={d.id}>{kv(d.name, <span className={d.kind === 'number' ? mono : undefined}>{answerText(d, d.value ?? undefined)}</span>)}</Fragment>)}
            </Box>
          ) : null}
          <Box id="h-price" title={owner && p.costPence !== null ? 'Price and cost' : 'Price'}>
            {kv('Price', <span className={mono}>{money(p.pricePence)}</span>)}
            {owner && p.costPence !== null ? kv('Cost', <span className={mono}>{money(p.costPence)}</span>) : null}
            {owner && p.costPence !== null ? kv('Margin', marginText(p)) : null}
            {kv('VAT', p.vatRateBp === null ? '—' : `${p.vatRateBp / 100}%`)}
            {owner ? kv('Show on website', p.showOnline ? `On · as ${p.category}` : 'Off') : null}
          </Box>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {p.isBike && p.frames ? <BikeFrames frames={p.frames} stock={p.stockQty} /> : null}
          <StockHistory history={p.history} />
        </div>
      </div>
      {editing ? (
        <ProductBox product={p} title="Edit product" subtitle={[p.name, p.sku].filter(Boolean).join(' · ')} saveLabel="Save" focus={editing}
          onSaved={() => setEditing(null)} onClose={() => setEditing(null)} />
      ) : null}
      {adjusting && here ? <AdjustStock product={p} shopName={here.name} now={here.qty} onClose={() => setAdjusting(false)} /> : null}
    </div>
  );
}
