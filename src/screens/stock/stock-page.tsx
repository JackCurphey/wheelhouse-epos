import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiGet } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { count, mono, productHref, rowHasCost, rowKey, rowLine, rowMargin, rowPrice, rowPriceText, rowState, StateTag, type ListRow } from './stock-bits.tsx';

/**
 * Stockroom › Stock (drawn as st-list in stock.mjs; stock control decisions
 * 2 and 11; openspec/changes/stock-list): one search box, All, Running low
 * and Below zero, and every product with its stock, price and (for the
 * Owner) margin, each opening its page. A product with sizes is one row, and a
 * size searched is its own (st-search-size; stock-list-categories-sizes). Read
 * only: adding and ticking come with later pieces.
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
  const [typed, setTyped] = useState('');
  const search = useTyped(typed);
  // Today's See them opens Stock with Below zero picked (st-today-below; stock-warnings-on-today design 8).
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(params.get('show') === 'below-zero' ? 'Below zero' : 'All');
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({ key: 'name', up: true });
  const [all, setAll] = useState(false);
  const list = useQuery({
    queryKey: ['stock', search],
    queryFn: async () => (await apiGet<{ rows: ListRow[] }>(`/api/stock-list${search ? `?${new URLSearchParams({ search })}` : ''}`)).rows,
    placeholderData: keepPreviousData,
  });

  const by = SORTS[sort.key];
  const rows = (list.data ?? [])
    .filter((r) => filter === 'All' || rowState(r) === (filter === 'Below zero' ? 'below' : 'low'))
    .sort((a, b) => {
      const [x, y] = [by(a), by(b)];
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.up ? 1 : -1);
    });
  const shown = all ? rows : rows.slice(0, SHOWN);
  // The sign-in can say Owner with someone else at the till: what the server sent decides.
  const margins = owner && (list.data ?? []).some(rowHasCost);
  const cols = isPhone ? 'grid-cols-[minmax(0,1fr)_auto]' : margins ? 'grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.7fr)]' : 'grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]';
  const pick = (f: Filter) => { setFilter(filter === f && f !== 'All' ? 'All' : f); setAll(false); };
  const head = (key: SortKey, label: string, right = false) => (
    <span role="columnheader" aria-sort={sort.key === key ? (sort.up ? 'ascending' : 'descending') : 'none'} className={right ? 'text-right' : ''}>
      <button type="button" onClick={() => setSort({ key, up: sort.key === key ? !sort.up : true })}
        className="inline-flex min-h-11 items-center gap-1 text-size-13 font-bold text-[var(--wh-muted)]">
        {label}{sort.key === key ? <span aria-hidden="true">{sort.up ? '▴' : '▾'}</span> : null}
      </button>
    </span>
  );
  const pill = (f: Filter) => (
    <button key={f} type="button" aria-pressed={filter === f} onClick={() => pick(f)}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${filter === f ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{f}</button>
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
        <Search aria-hidden="true" size={20} />
        <input type="search" aria-label="Search stock" value={typed} onChange={(e) => { setTyped(e.target.value); setAll(false); }}
          placeholder="Name, barcode, supplier code — or a measurement, like “bearing 30 mm”"
          className="min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] outline-none placeholder:text-[var(--wh-muted)]" />
      </label>
      <div className={`flex items-center gap-2 ${isPhone ? 'overflow-x-auto pb-0.5' : 'flex-wrap'}`}>{(['All', 'Running low', 'Below zero'] as Filter[]).map(pill)}</div>
      <p role="status" className="m-0 text-sm text-[var(--wh-muted)]">{list.data ? (rows.length ? plural(rows) : 'No products') : ''}</p>
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the stock. Try again in a moment.</p>
        : !list.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
        : rows.length === 0 ? (
          <div className="flex flex-col items-start gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-6">
            <h2 className="m-0 text-lg font-bold">{search ? `Nothing matches “${search}”` : filter === 'All' ? 'No products yet' : `Nothing is ${filter.toLowerCase()}`}</h2>
            {search ? <p className="m-0 text-sm text-[var(--wh-muted)]">Check the spelling, or try a supplier code or a supplier.</p> : null}
          </div>
        ) : (
          <div role="table" aria-label="Products" className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
            {isPhone ? null : (
              <div role="rowgroup">
                <div role="row" className={`grid ${cols} items-center gap-3 px-4 pt-1`}>
                  {head('name', 'Product')}{head('stock', 'In stock')}{head('price', 'Price', true)}{margins ? head('margin', 'Margin', true) : null}
                </div>
              </div>
            )}
            <div role="rowgroup">
              {shown.map((r) => {
                const label = (
                  <>
                    <span className="text-size-15 font-semibold underline decoration-[var(--wh-border)]">{r.name}</span>
                    <span className="text-size-13 text-[var(--wh-muted)]">{[rowLine(r), isPhone ? rowPriceText(r) : null].filter(Boolean).join(' · ')}</span>
                  </>
                );
                const m = rowMargin(r);
                return (
                <div role="row" key={rowKey(r)} className={`grid ${cols} min-h-[60px] items-center gap-3 border-t border-[var(--wh-border)] px-4 py-1 first:border-t-0 md:first:border-t`}>
                  <span role="cell" className="min-w-0">
                    {/* A product with sizes' own page is piece 10: until then its row opens nothing. */}
                    {r.kind === 'group' ? <span className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5">{label}</span>
                      : <Link to={productHref(r.id)} className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5 text-[var(--wh-ink)] no-underline">{label}</Link>}
                  </span>
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
    </div>
  );
}
