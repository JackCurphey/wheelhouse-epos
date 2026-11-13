import * as React from 'react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ApiError } from '@/lib/api/client.ts';
import { usePageTitle, NotFoundPage } from './pages.tsx';
import { Failed } from './parts.tsx';
import { FilterGroups, Listing, NothingMatches, plural } from './listing.tsx';
import {
  useCategories, useCategoryProducts, useDetailIds, useSiteContext,
  type Category, type ProductsPage,
} from './site-query.ts';
import {
  NOTHING_TICKED, SORTS, anythingTicked, chipsOf, effective, productsParams,
  readSelection, sortOf, writeSelection, type Selection, type Sort,
} from './filters.ts';

export { AskTheShop } from './listing.tsx';

/**
 * A category's page (website-browse tasks 4.1-4.7, design 6; wb-category,
 * wb-category-filtered, wb-category-empty, wb-category-parent,
 * wb-category-child and wb-category-no-shop in browse.mjs): the path, the
 * heading and its count, Sort, the chips, the filters `aside` and the
 * products six at a time. Filters and sort live in the page's address, so
 * Back and a shared link keep them; each change is a new step for Back.
 * On a phone the filters open in a full-screen panel whose ticks apply only
 * when "Show [n] products" is pressed.
 */
export function CategoryPage() {
  const { id: raw = '' } = useParams();
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  const { address, chosen } = useSiteContext();
  const [params] = useSearchParams();
  const selection = useMemo(() => readSelection(params), [params]);
  const sort = sortOf(params.get('sort'));
  const named = Object.keys(selection.details).length > 0;
  const ids = useDetailIds(address, id, id > 0 && named);
  const shopId = chosen?.id ?? null;
  const asking = id > 0 && (!named || ids.data !== undefined) ? productsParams(id, selection, sort, shopId, ids.data ?? {}) : null;
  const products = useCategoryProducts(address, id, asking);

  const failed = ids.error ?? products.error;
  if (id === 0 || (failed instanceof ApiError && failed.status === 404)) return <NotFoundPage />;
  if (failed) return <Failed onRetry={() => { void (ids.error ? ids.refetch() : products.refetch()); }} />;
  const pages = products.data?.pages;
  if (!pages || pages[0].category.id !== id) return null;
  return (
    <CategoryView
      pages={pages}
      selection={selection}
      sort={sort}
      ids={ids.data ?? {}}
      shopId={shopId}
      more={products.hasNextPage ? () => products.fetchNextPage() : null}
      loadingMore={products.isFetchingNextPage}
      stale={products.isPlaceholderData}
    />
  );
}

type ViewProps = {
  pages: ProductsPage[];
  selection: Selection;
  sort: Sort;
  ids: Record<string, number>;
  shopId: number | null;
  more: (() => Promise<{ isError: boolean }>) | null;
  loadingMore: boolean;
  /** The last answer, kept on the page while the one for new filters loads. */
  stale: boolean;
};

function CategoryView({ pages, selection, sort, ids, shopId, more, loadingMore, stale }: ViewProps) {
  const first = pages[0];
  const { category, filters, total } = first;
  usePageTitle(category.name);
  const { address } = useSiteContext();
  const categories = useCategories(address);
  const [, setParams] = useSearchParams();
  const readyShop = filters.ready?.shop ?? null;
  const applied = effective(selection, filters.details, readyShop);
  const ticked = anythingTicked(applied);

  // Each change is a new step in the history, so Back steps back through them.
  // flushSync: the router otherwise applies an address change as a React
  // transition, and a ticked box shows unticked until it lands.
  const apply = (next: Selection) => setParams((prev) => writeSelection(prev, next), { flushSync: true });
  const setSort = (value: string) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value === 'az') next.delete('sort'); else next.set('sort', value);
    return next;
  }, { flushSync: true });

  const count = !ticked ? plural(total, 'product', 'products') : total === 0 ? 'Nothing matches' : plural(total, 'product matches', 'products match');
  const types = first.types.filter((t) => t.products > 0);

  return (
    <Listing<Selection>
      heading={category.name}
      before={<Crumbs category={category} categories={categories.data ?? []} />}
      after={types.length > 0 && (
        <nav aria-label={`Types of ${category.name.toLowerCase()}`}>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {types.map((t) => (
              <li key={t.id}>
                <Link to={`/shop/${t.id}`} className="inline-flex min-h-11 items-center rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-[14px] font-semibold text-[var(--wh-ink)] no-underline">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      count={count}
      stale={stale}
      sorts={SORTS}
      sort={sort}
      onSort={setSort}
      chips={chipsOf(applied, filters.details, readyShop).map((c) => ({ words: c.words, remove: () => apply(c.without(applied)) }))}
      clearAll={() => apply(NOTHING_TICKED)}
      filters={filters}
      renderFilters={(f, chosen, onChange) => <FilterGroups filters={f} selection={chosen} onChange={onChange} />}
      applied={applied}
      onApply={apply}
      cleared={() => NOTHING_TICKED}
      previewPath="/api/site/products"
      paramsOf={(d) => productsParams(category.id, d, sort, shopId, ids)}
      products={pages.flatMap((p) => p.products)}
      total={total}
      more={more}
      loadingMore={loadingMore}
      empty={(clear) => (ticked
        ? <NothingMatches selection={applied} details={filters.details} readyShop={readyShop} onClear={clear} />
        : <p className="m-0 text-size-15 leading-relaxed">This shop hasn’t put any products in {category.name} online yet.</p>)}
    />
  );
}

/**
 * "Shop › Drivetrain › Derailleurs": each step up linked, this page marked
 * (browse.mjs `crumbs`). A product's page passes its name as `current`, and
 * its category becomes a step; its category's parent comes from the tree.
 */
export function Crumbs({ category, categories, current }: { category: { id: number; name: string; parentId?: number | null }; categories: Category[]; current?: string }) {
  const above: Category[] = [];
  let parentId = category.parentId !== undefined ? category.parentId : (categories.find((c) => c.id === category.id)?.parentId ?? null);
  // Twenty steps at most, so a loop in the tree can't hang the page.
  while (parentId !== null && above.length < 20) {
    const at = categories.find((c) => c.id === parentId);
    if (!at) break;
    above.unshift(at);
    parentId = at.parentId;
  }
  const step = 'inline-flex min-h-11 items-center text-inherit';
  return (
    <nav aria-label="You are here" className="text-[14px] text-[var(--wh-muted)]">
      <Link to="/shop" className={step} style={{ color: 'inherit' }}>Shop</Link>
      {' › '}
      {above.map((c) => (
        <React.Fragment key={c.id}>
          <Link to={`/shop/${c.id}`} className={step} style={{ color: 'inherit' }}>{c.name}</Link>
          {' › '}
        </React.Fragment>
      ))}
      {current !== undefined && (
        <>
          <Link to={`/shop/${category.id}`} className={step} style={{ color: 'inherit' }}>{category.name}</Link>
          {' › '}
        </>
      )}
      <span aria-current="page">{current ?? category.name}</span>
    </nav>
  );
}
