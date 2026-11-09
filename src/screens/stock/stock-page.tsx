import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { ProductBox } from './product-box.tsx';
import { ChangePrices, type Changed } from './change-prices.tsx';
import { answerText, DetailFilters, detailsFor, filterValue, inCategoryText, MeasureLine, useCategoryList, useCategoryPicker } from './stock-list-bits.tsx';
import { count, mono, productHref, sizesHref, rowHasCost, rowIs, rowKey, rowLine, rowMargin, rowPrice, rowPriceText, rowState, StateTag, type ListRow } from './stock-bits.tsx';

/**
 * Stockroom › Stock (drawn as st-list in stock.mjs; stock control decisions
 * 2 and 11; openspec/changes/stock-list): one search box, All, Running low
 * and Below zero, and every product with its stock, price and (for the
 * Owner) margin, each opening its page. A product with sizes is one row, and a
 * size searched is its own (st-search-size; stock-list-categories-sizes). A
 * category picked brings its details as filters and columns (st-filter-bearings),
 * and a measurement searched shows each row's (st-search-measure). The Owner adds a
 * product (st-list, st-list-none, st-list-new; openspec/changes/product-page-sizes,
 * design 4). The Owner ticks products, kept through searches, and changes their prices
 * together, with Undo (st-list-ticked, st-prices, st-prices-done; openspec/changes/bulk-price-change,
 * design 4 and 5); the ticked bar's Print labels and Send to another shop come with their pieces.
 */
type Filter = 'All' | 'Running low' | 'Below zero';
type SortKey = 'name' | 'stock' | 'price' | 'margin';
const SHOWN = 50;
// What a bulk change, or its Undo, said (st-prices-done).
type Done = { text: string; batchId: number | null };
const several = (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`;
const SORTS: Record<SortKey, (r: ListRow) => number | string> = {
  name: (r) => r.name.toLowerCase(),
  stock: (r) => r.stockQty,
  price: rowPrice,
  margin: (r) => rowMargin(r) ?? -Infinity,
};
// Sizes found by a search are counted as sizes (st-search-size: "1 size and colour").
const plural = (rows: ListRow[]) => {
  const n = rows.length;
  if (rows.every((r) => r.kind === 'size')) return n === 1 ? '1 size and colour' : `${n} sizes and colours`;
  return n === 1 ? '1 product' : `${n} products`;
};

function useTyped(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return settled;
}

export function StockPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const isPhone = useMedia('(max-width: 767px)');
  const navigate = useNavigate();
  // The box, with the name typed when nothing matched (st-list-none); null when shut.
  const [adding, setAdding] = useState<{ name?: string } | null>(null);
  const queryClient = useQueryClient();
  // Ticked rows by rowKey, kept through searches and filters (st-list-ticked).
  const [ticked, setTicked] = useState<Map<string, ListRow>>(new Map());
  const [changing, setChanging] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [typed, setTyped] = useState('');
  const search = useTyped(typed);
  // Today's See them opens Stock with Below zero picked (st-today-below; stock-warnings-on-today design 8).
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(params.get('show') === 'below-zero' ? 'Below zero' : 'All');
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({ key: 'name', up: true });
  const [all, setAll] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const categories = useCategoryList().data ?? [];
  const details = category ? detailsFor(categories, category) : [];
  // Each detail's filter is asked for once typing settles, as the search box is, and only
  // with the category it was typed for: one just changed never sends the last one's.
  const typedFor: { category: string | null; values: Record<number, string> } = JSON.parse(useTyped(JSON.stringify({ category, values })));
  const settled = typedFor.category === category ? typedFor.values : {};
  const sent = details.map((d) => [d, filterValue(d, settled[d.id] ?? '')] as const).filter(([, v]) => v).map(([d, v]) => [`d${d.id}`, v]);
  const query = new URLSearchParams([...(search ? [['search', search]] : []), ...(category ? [['category', category]] : []), ...sent]).toString();
  const list = useQuery({
    queryKey: ['stock', query],
    queryFn: async () => (await apiGet<{ rows: ListRow[] }>(`/api/stock-list${query ? `?${query}` : ''}`)).rows,
    placeholderData: keepPreviousData,
  });
  const choose = (path: string | null) => { setCategory(path); setValues({}); setAll(false); };
  const picker = useCategoryPicker({ all: categories, picked: category, onPick: choose });
  const sentValues = Object.fromEntries(sent.map(([k, v]) => [Number(k.slice(1)), v]));
  const inCategory = category ? inCategoryText(category, details, sentValues) : '';

  // Audit M12: a category's details as columns on a computer, Margin making room; a sort
  // by Margin with Margin gone goes back to the name.
  const columns = isPhone ? [] : details;
  const margins = owner && columns.length === 0 && (list.data ?? []).some(rowHasCost);
  const sortKey: SortKey = sort.key === 'margin' && !margins ? 'name' : sort.key;
  const sortUp = sortKey === sort.key ? sort.up : true;
  const by = SORTS[sortKey];
  const rows = (list.data ?? [])
    .filter((r) => filter === 'All' || rowIs(r, filter === 'Below zero' ? 'below' : 'low'))
    .sort((a, b) => {
      const [x, y] = [by(a), by(b)];
      return (x < y ? -1 : x > y ? 1 : 0) * (sortUp ? 1 : -1);
    });
  const shown = all ? rows : rows.slice(0, SHOWN);
  // Ticking is for whoever can change prices: the Owner, the one the server sends costs to, as
  // Edit on a product's page (bulk-price-change, design 4).
  const ticking = owner && (list.data ?? []).some(rowHasCost);
  const allTicked = shown.length > 0 && shown.every((r) => ticked.has(rowKey(r)));
  const tick = (r: ListRow) => { const next = new Map(ticked); if (next.has(rowKey(r))) next.delete(rowKey(r)); else next.set(rowKey(r), r); setTicked(next); };
  const tickAll = () => { const next = new Map(ticked); shown.forEach((r) => (allTicked ? next.delete(rowKey(r)) : next.set(rowKey(r), r))); setTicked(next); };
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['stock'] }), queryClient.invalidateQueries({ queryKey: ['product'] })]);
  const changed = (c: Changed) => { setChanging(false); setTicked(new Map()); setDone({ text: `Prices changed · ${several(c.changed)}`, batchId: c.batchId }); refresh(); };
  async function undo(batchId: number) {
    try {
      const u = await apiMutate<{ undone: number; leftAlone: number }>(`/api/stock/prices/${batchId}/undo`, {});
      setDone({ text: [`Prices put back · ${several(u.undone)}`, u.leftAlone ? `${u.leftAlone} changed since, left as they are` : null].filter(Boolean).join(' · '), batchId: null });
      refresh();
    } catch (err) {
      setDone({ text: err instanceof ApiError && err.status < 500 ? err.message : 'Wheelhouse couldn’t put the prices back. Try again in a moment.', batchId: null });
    }
  }
  // The sign-in can say Owner with someone else at the till: what the server sent decides.
  const grid = { gridTemplateColumns: isPhone ? `${ticking ? '44px ' : ''}minmax(0, 1fr) auto` : [...(ticking ? ['44px'] : []), 'minmax(0, 2.2fr)', ...columns.map(() => 'minmax(0, 0.7fr)'), 'minmax(0, 0.9fr)', 'minmax(0, 0.8fr)', ...(margins ? ['minmax(0, 0.7fr)'] : [])].join(' ') };
  // All is everything: it takes a category off too.
  const pick = (f: Filter) => { setFilter(filter === f && f !== 'All' ? 'All' : f); if (f === 'All') choose(null); setAll(false); };
  const head = (key: SortKey, label: string, right = false) => (
    <span role="columnheader" aria-sort={sortKey === key ? (sortUp ? 'ascending' : 'descending') : 'none'} className={right ? 'text-right' : ''}>
      <button type="button" onClick={() => setSort({ key, up: sortKey === key ? !sortUp : true })}
        className="inline-flex min-h-11 items-center gap-1 text-size-13 font-bold text-[var(--wh-muted)]">
        {label}{sortKey === key ? <span aria-hidden="true">{sortUp ? '▴' : '▾'}</span> : null}
      </button>
    </span>
  );
  const pill = (f: Filter) => (
    <button key={f} type="button" aria-pressed={filter === f && !(f === 'All' && category)} onClick={() => pick(f)}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${filter === f && !(f === 'All' && category) ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{f}</button>
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2.5">
      <label className="flex min-h-[52px] min-w-0 grow items-center gap-2.5 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
        <Search aria-hidden="true" size={20} />
        <input type="search" aria-label="Search stock" value={typed} onChange={(e) => { setTyped(e.target.value); setAll(false); }}
          placeholder="Name, barcode, supplier code — or a measurement, like “bearing 30 mm”"
          className="min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] outline-none placeholder:text-[var(--wh-muted)]" />
      </label>
      {/* st-list: beside the search for the Owner, not on a phone. */}
      {owner && !isPhone ? <Button className="shrink-0" onClick={() => setAdding({})}>+ Add a product</Button> : null}
      </div>
      <div className={`flex items-center gap-2 ${isPhone ? 'overflow-x-auto pb-0.5' : 'flex-wrap'}`}>{(['All', 'Running low', 'Below zero'] as Filter[]).map(pill)}{picker.pill}</div>
      {picker.list}
      {category ? <DetailFilters name={categories.find((c) => c.path === category)?.name ?? category} details={details} values={values} onChange={(id, v) => { setValues({ ...values, [id]: v }); setAll(false); }} /> : null}
      <p role="status" className="m-0 text-sm text-[var(--wh-muted)]">{list.data ? (category ? `${rows.length} ${inCategory}` : rows.length ? plural(rows) : 'No products') : ''}</p>
      {ticking && ticked.size ? (
        <div role="region" aria-label="Ticked products" className="flex flex-wrap items-center gap-2.5 rounded-[10px] bg-[var(--wh-ink)] py-2 pr-2 pl-3.5 text-[var(--wh-panel)]">
          <span className="grow text-size-15 font-bold">{`${ticked.size} ticked`}</span>
          <button type="button" onClick={() => setTicked(new Map())} className="min-h-11 border-0 bg-transparent px-3 text-sm font-semibold text-[var(--wh-panel)] underline">Untick all</button>
          <Button onClick={() => { setDone(null); setChanging(true); }}>Change prices</Button>
        </div>
      ) : null}
      {done ? (
        <div role="status" className="flex items-center gap-3 self-start rounded-lg bg-[var(--wh-ink)] py-1 pr-1 pl-3.5 text-sm font-semibold text-[var(--wh-panel)]">
          <span>{done.text}</span>
          {done.batchId !== null ? <button type="button" onClick={() => undo(done.batchId!)} className="min-h-11 border-0 bg-transparent px-3 text-sm font-bold text-[var(--wh-panel)] underline">Undo</button> : null}
        </div>
      ) : null}
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the stock. Try again in a moment.</p>
        : !list.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
        : rows.length === 0 ? (
          <div className="flex flex-col items-start gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-6">
            <h2 className="m-0 text-lg font-bold">{search ? `Nothing matches “${search}”` : category ? `Nothing ${inCategory}` : filter === 'All' ? 'No products yet' : `Nothing is ${filter.toLowerCase()}`}</h2>
            {search ? <p className="m-0 text-sm text-[var(--wh-muted)]">Check the spelling, or try a supplier code or a supplier.</p> : null}
            {search && owner ? <Button onClick={() => setAdding({ name: search })}>{`+ Add “${search}” as a product`}</Button> : null}
            {!search && !category && filter === 'All' && owner ? (
              <>
                <p className="m-0 text-sm text-[var(--wh-muted)]">Add your first product, or bring everything over from Citrus Lime (Office › Moving from Citrus Lime).</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => setAdding({})}>+ Add a product</Button>
                  <Link to={ROUTES.moving} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 text-sm font-semibold text-[var(--wh-ink)] no-underline">Bring them from Citrus Lime</Link>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div role="table" aria-label="Products" className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
            {isPhone ? null : (
              <div role="rowgroup">
                <div role="row" style={grid} className={`grid items-center gap-3 pt-1 ${ticking ? 'pr-4' : 'px-4'}`}>
                  {ticking ? <span role="columnheader"><TickBox label={`Tick all ${shown.length} shown`} on={allTicked} onChange={tickAll} /></span> : null}
                  {head('name', 'Product')}{columns.map((d) => <span key={d.id} role="columnheader" className="text-size-13 font-bold text-[var(--wh-muted)]">{d.name}</span>)}{head('stock', 'In stock')}{head('price', 'Price', true)}{margins ? head('margin', 'Margin', true) : null}
                </div>
              </div>
            )}
            <div role="rowgroup">
              {shown.map((r) => {
                const label = (
                  <>
                    <span className="text-size-15 font-semibold underline decoration-[var(--wh-border)]">{r.name}</span>
                    <span className="text-size-13 text-[var(--wh-muted)]">{((!category || isPhone) && search && MeasureLine({ row: r, all: categories, search })) || rowLine(r, !!category)}{isPhone ? ` · ${rowPriceText(r)}` : ''}</span>
                  </>
                );
                const m = rowMargin(r);
                return (
                <div role="row" key={rowKey(r)} style={grid} className={`grid min-h-[60px] items-center gap-3 border-t border-[var(--wh-border)] py-1 first:border-t-0 md:first:border-t ${ticking ? 'pr-4' : 'px-4'}`}>
                  {ticking ? <span role="cell"><TickBox label={`Tick ${r.name}${r.kind === 'size' ? `, ${rowLine(r)}` : ''}`} on={ticked.has(rowKey(r))} onChange={() => tick(r)} /></span> : null}
                  <span role="cell" className="min-w-0">
                    {/* A product with sizes opens its own page (product-page-sizes, design 3). */}
                    <Link to={r.kind === 'group' ? sizesHref(r.groupId) : productHref(r.id)} className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5 text-[var(--wh-ink)] no-underline">{label}</Link>
                  </span>
                  {columns.map((d) => (
                    <span key={d.id} role="cell" className={`${mono} text-size-15`}><span className="sr-only">{`${d.name}: `}</span>{answerText(d, r.kind === 'group' ? undefined : r.details?.[d.id])}</span>
                  ))}
                  <span role="cell" className={`flex flex-wrap items-center gap-2 ${isPhone ? 'justify-end' : ''}`}>
                    <span className="sr-only">In stock: </span><span className={`${mono} text-size-15`}>{count(r.stockQty)}</span>{r.kind === 'group' ? null : <StateTag state={rowState(r)} />}
                  </span>
                  {isPhone ? null : <span role="cell" className={`${mono} text-right text-size-15`}><span className="sr-only">Price: </span>{rowPriceText(r)}</span>}
                  {isPhone || !margins ? null : <span role="cell" className="text-right text-size-15 text-[var(--wh-muted)]"><span className="sr-only">Margin: </span>{m === null ? '—' : `${m}%`}</span>}
                </div>
                );
              })}
            </div>
          </div>
        )}
      {!all && rows.length > SHOWN ? (
        <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline">{`Show all (${rows.length})`}</button>
      ) : null}
      {changing ? <ChangePrices rows={[...ticked.values()]} onClose={() => setChanging(false)} onChanged={changed} /> : null}
      {adding ? (
        <ProductBox title="Add a product" saveLabel="Add" start={adding} onClose={() => setAdding(null)}
          onSaved={(p) => { setAdding(null); navigate(productHref(p.id)); }} />
      ) : null}
    </div>
  );
}

// A 44 by 44 tick box, as stock.mjs's tickBox draws it.
function TickBox({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex size-11 items-center justify-center">
      <input type="checkbox" aria-label={label} checked={on} onChange={onChange} className="m-0 size-5 accent-[var(--accent-dark)]" />
    </label>
  );
}
