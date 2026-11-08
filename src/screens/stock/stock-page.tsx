import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiGet } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { ProductBox } from './product-box.tsx';
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
 * design 4); ticking comes with its own piece.
 */
type Filter = 'All' | 'Running low' | 'Below zero';
type SortKey = 'name' | 'stock' | 'price' | 'margin';
const SHOWN = 50;
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
  // The sign-in can say Owner with someone else at the till: what the server sent decides.
  const grid = { gridTemplateColumns: isPhone ? 'minmax(0, 1fr) auto' : ['minmax(0, 2.2fr)', ...columns.map(() => 'minmax(0, 0.7fr)'), 'minmax(0, 0.9fr)', 'minmax(0, 0.8fr)', ...(margins ? ['minmax(0, 0.7fr)'] : [])].join(' ') };
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
                <div role="row" style={grid} className="grid items-center gap-3 px-4 pt-1">
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
                <div role="row" key={rowKey(r)} style={grid} className={`grid min-h-[60px] items-center gap-3 border-t border-[var(--wh-border)] px-4 py-1 first:border-t-0 md:first:border-t`}>
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
      {adding ? (
        <ProductBox title="Add a product" saveLabel="Add" start={adding} onClose={() => setAdding(null)}
          onSaved={(p) => { setAdding(null); navigate(productHref(p.id)); }} />
      ) : null}
    </div>
  );
}
