import * as React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { penceText } from '@/lib/money.ts';
import { cn } from '@/lib/utils';
import { bookPath } from './address.ts';
import { usePageTitle } from './pages.tsx';
import { Box, Failed, H1, ShopByCategory, linkButton } from './parts.tsx';
import { AskTheShopRegion, FilterGroups, Listing, NothingMatches, plural, type ListChip } from './listing.tsx';
import {
  useCategories, useSearchDetailIds, useSearchProducts, useSiteContext, useSuggestions,
  type SearchPage as SearchAnswer, type Suggestions,
} from './site-query.ts';
import {
  NOTHING_TICKED, SEARCH_SORTS, anythingTicked, chipsOf, detailSlug, effective, readSelection, searchParams,
  searchSortOf, valueText, withoutMeasure, writeSelection, type SearchSort, type Selection,
} from './filters.ts';

/**
 * Search (openspec/changes/website-browse, tasks 6.1-6.3; wb-search-typing,
 * wb-search-no-suggestions, wb-search-results, wb-search-measure and
 * wb-search-none in browse.mjs): the shell's search box, which suggests as
 * the customer types, and the results page at /search?q=.
 */

/** How long typing must pause before suggestions are asked for (task 6.1). */
export const SUGGEST_WAIT_MS = 250;

/**
 * The most letters a search reads: mirrors QUERY_LETTERS in
 * server/site-products.js (server code, so not imported here). The box takes
 * no more, and the results show only these, as the server searches only these.
 */
export const QUERY_LETTERS = 100;
/** The words a results address searches: its first QUERY_LETTERS letters, trimmed. */
const wordsOf = (params: URLSearchParams) => (params.get('q') ?? '').trim().slice(0, QUERY_LETTERS);

const resultsPath = (q: string) => `/search?${new URLSearchParams({ q })}`;

type Option = { key: string; to?: string; href?: string; main: React.ReactNode; sub?: string; right?: React.ReactNode };

/**
 * The search box as a WAI-ARIA combobox (decision 4; audit H4, M9): the
 * list of suggestions sits inside the role="search" area, focus stays in the
 * box, and the arrow keys move the picked suggestion (aria-activedescendant).
 * As wb-search-typing draws it, the first row is picked when the list shows,
 * and again when a new answer arrives; while the list is still the answer for
 * older words, nothing is. Enter opens the picked one, or the results with
 * none picked; Escape closes the list. `top` is the search across the top
 * on a tablet or phone, with Cancel; `header` is the computer's box in the
 * header.
 */
export function SearchCombo({ variant, placeholder, onCancel }: { variant: 'header' | 'top'; placeholder?: string; onCancel?: () => void }) {
  const { address, chosen, several } = useSiteContext();
  const categories = useCategories(address);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const fromAddress = location.pathname === '/search' ? wordsOf(params) : null;
  const [text, setText] = useState(fromAddress ?? '');
  const [waited, setWaited] = useState('');
  const [open, setOpen] = useState(false);
  // The row an arrow key picked; null is the drawn default (the first row, once the list answers the box).
  const [active, setActive] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  // A new address: the list closes; on the results the box shows their words.
  const here = `${location.pathname}${location.search}`;
  const [seen, setSeen] = useState(here);
  if (seen !== here) {
    setSeen(here);
    setOpen(false);
    setActive(null);
    if (fromAddress !== null) setText(fromAddress);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (variant === 'top') input.current?.focus(); }, [variant]);

  const suggest = useSuggestions(address, waited.trim(), chosen?.id ?? null);
  const data = suggest.data;
  // A new answer: its first row is picked again.
  const [seenData, setSeenData] = useState(data);
  if (seenData !== data) {
    setSeenData(data);
    setActive(null);
  }

  // See all results says the words in the box, even while the list is the last answer's.
  const options = useMemo(() => (data ? optionsOf(data, text.trim(), categories.data ?? [], bookPath(address, several && chosen ? chosen.id : null)) : []), [data, text, categories.data, address, several, chosen]);
  const shown = open && text.trim().length >= 2 && waited.trim().length >= 2 && data !== undefined;
  // The list answers what is in the box: not older words still waiting, nor the last answer kept while the next loads.
  const current = text.trim() === waited.trim() && !suggest.isPlaceholderData;
  const picked = !shown ? -1
    : active !== null ? (active < options.length ? active : -1)
      : current && options.length > 0 ? 0 : -1;
  const optionId = (i: number) => `${listId}-${i}`;

  const type = (value: string) => {
    setText(value);
    setOpen(true);
    setActive(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setWaited(value), SUGGEST_WAIT_MS);
  };
  const close = () => { setOpen(false); setActive(null); };
  const go = (option: Option | null) => {
    close();
    // Gone from here: the suggestions waited for would be asked for nothing.
    if (timer.current) clearTimeout(timer.current);
    if (option?.href) { window.location.assign(option.href); return; }
    const to = option?.to ?? (text.trim() ? resultsPath(text.trim()) : null);
    if (to) void navigate(to, { flushSync: true });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const last = options.length - 1;
      if (!shown) { setOpen(true); setActive(e.key === 'ArrowDown' ? (last >= 0 ? 0 : null) : (last >= 0 ? last : null)); return; }
      if (last < 0) return;
      // Round the ends: past the last is the first, before the first the last.
      setActive(e.key === 'ArrowDown' ? (picked >= last ? 0 : picked + 1) : (picked <= 0 ? last : picked - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(picked >= 0 ? options[picked] : null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (shown) close();
      else onCancel?.();
    }
  };

  useEffect(() => {
    if (picked >= 0) document.getElementById(optionId(picked))?.scrollIntoView?.({ block: 'nearest' });
  });

  const groups: [string, Option[]][] = data ? [
    ['Products', options.filter((o) => o.key.startsWith('p'))],
    ['Repairs', options.filter((o) => o.key.startsWith('r'))],
    ['Categories', options.filter((o) => o.key.startsWith('c'))],
    ['Pages', options.filter((o) => o.key.startsWith('g'))],
  ] : [];
  const row = (o: Option) => {
    const i = options.indexOf(o);
    const props = {
      id: optionId(i),
      role: 'option',
      'aria-selected': i === picked,
      tabIndex: -1,
      onClick: close,
      className: cn(
        'flex min-h-12 items-center gap-3 rounded-lg px-3 py-1.5 text-[var(--wh-ink)] no-underline',
        i === picked && 'bg-[var(--wh-muted-bg)] outline outline-2 -outline-offset-2 outline-[var(--wh-ink)]',
      ),
    };
    const inner = (
      <>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-size-15 font-semibold">{o.main}</span>
          {o.sub && <span className="text-size-13 text-[var(--wh-muted)]">{o.sub}</span>}
        </span>
        {o.right}
      </>
    );
    return o.href ? <a key={o.key} href={o.href} {...props}>{inner}</a> : <Link key={o.key} to={o.to ?? '/'} {...props}>{inner}</Link>;
  };
  const seeAll = options.find((o) => o.key === 'all');

  const list = shown && (
    <div
      id={listId}
      role="listbox"
      aria-label="Suggestions"
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'box-border rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1.5 text-left text-[var(--wh-ink)] shadow-[0_16px_40px_rgba(28,30,25,0.22)]',
        variant === 'header' && 'absolute right-0 top-[calc(100%+6px)] z-10 w-[440px] max-w-[calc(100vw-32px)]',
      )}
    >
      {options.length > 0 ? (
        <>
          {groups.filter(([, rows]) => rows.length > 0).map(([label, rows]) => (
            <div key={label} role="group" aria-label={label}>
              <div aria-hidden className="px-3 pb-0.5 pt-2 text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--wh-muted)]">{label}</div>
              {rows.map(row)}
            </div>
          ))}
          {seeAll && (
            <Link
              to={seeAll.to ?? '/'}
              id={optionId(options.length - 1)}
              role="option"
              aria-selected={picked === options.length - 1}
              tabIndex={-1}
              onClick={close}
              className={cn(
                'flex min-h-12 items-center border-t border-[var(--wh-border)] px-3 text-size-15 font-bold text-[var(--wh-ink)] no-underline',
                picked === options.length - 1 && 'bg-[var(--wh-muted-bg)] outline outline-2 -outline-offset-2 outline-[var(--wh-ink)]',
              )}
            >
              {seeAll.main}
            </Link>
          )}
          <span aria-live="polite" className="sr-only">{plural(options.length, 'suggestion', 'suggestions')}</span>
        </>
      ) : (
        <>
          <p className="m-0 px-3 py-3.5 text-size-15">No suggestions for “{waited.trim()}” — press Enter to search.</p>
          <span aria-live="polite" className="sr-only">No suggestions</span>
        </>
      )}
    </div>
  );

  const box = (
    <input
      ref={input}
      type="search"
      role="combobox"
      aria-label="Search the shop"
      aria-autocomplete="list"
      aria-expanded={shown}
      aria-controls={shown ? listId : undefined}
      aria-activedescendant={picked >= 0 ? optionId(picked) : undefined}
      placeholder={placeholder}
      maxLength={QUERY_LETTERS}
      value={text}
      onChange={(e) => type(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={(e) => { if (!area.current?.contains(e.relatedTarget as Node | null)) close(); }}
      className={cn('min-w-0 bg-transparent text-[var(--wh-ink)] outline-none', variant === 'header' ? 'w-44 text-size-15' : 'grow text-[16px]')}
    />
  );

  if (variant === 'header') {
    return (
      <div ref={area} role="search" className="relative">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--wh-input-border)] bg-white px-3 text-[var(--wh-ink)]">
          <Search aria-hidden className="size-4 text-[var(--wh-muted)]" />
          {box}
        </label>
        {list}
      </div>
    );
  }
  return (
    <div ref={area} role="search" className="absolute inset-x-0 top-0 z-10 box-border flex flex-col gap-2 bg-[var(--wh-bg)] p-3 shadow-[0_8px_20px_rgba(28,30,25,0.12)]">
      <div className="flex items-center gap-2">
        <label className="flex min-h-12 grow items-center gap-2 rounded-lg border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3">
          <Search aria-hidden className="size-[18px]" />
          {box}
        </label>
        <button type="button" onClick={onCancel} className="min-h-12 bg-transparent px-2 text-size-15 font-semibold text-[var(--wh-ink)]">Cancel</button>
      </div>
      {list}
    </div>
  );
}

/** Each suggestion as a row, in the drawn order, then See all results. */
function optionsOf(data: Suggestions, q: string, tree: { id: number; products: number }[], book: string): Option[] {
  const stockText = (s: Suggestions['products'][number]['stock']) =>
    s.line === 'ready' ? `Ready today at ${s.shop}` : s.line === 'sold-out' ? `Sold out at ${s.shop}` : undefined;
  const count = (id: number) => {
    const c = tree.find((x) => x.id === id);
    return c ? plural(c.products, 'product', 'products') : undefined;
  };
  return [
    ...data.products.map((p) => ({
      key: `p${p.id}`,
      to: `/products/${p.id}`,
      main: <>{p.name}{p.code && <>{' '}<span className="font-mono">{p.code}</span></>}</>,
      sub: stockText(p.stock),
      right: <span className="font-mono text-size-15">{penceText(p.pricePence)}</span>,
    })),
    ...data.repairs.map((r) => ({
      key: `r${r.id}`,
      href: book,
      main: r.name,
      sub: 'Book a repair',
      right: r.pricePence != null ? <span className="font-mono text-size-15">{penceText(r.pricePence)}</span> : undefined,
    })),
    ...data.categories.map((c) => ({ key: `c${c.id}`, to: `/shop/${c.id}`, main: c.name, sub: count(c.id) })),
    ...data.pages.map((g) => ({ key: `g${g.key}`, to: `/${g.key}`, main: g.name, sub: 'Page' })),
    ...(data.products.length + data.repairs.length + data.categories.length + data.pages.length > 0
      ? [{ key: 'all', to: resultsPath(q), main: `See all results for “${q}”` }]
      : []),
  ];
}

// ---------- The results page ----------

type Draft = { selection: Selection; category: number | null };

/**
 * The results (wb-search-results, wb-search-measure, wb-search-none): the
 * products by Best match with the filters, the repairs and pages that match
 * above them, and, with nothing found, what to try and Ask the shop. The
 * words, the category narrowed to, the ticks and the sort live in the address.
 */
export function SearchPage() {
  const { address, chosen } = useSiteContext();
  const [params] = useSearchParams();
  const q = wordsOf(params);
  const categoryParam = /^\d{1,9}$/.test(params.get('category') ?? '') ? Number(params.get('category')) : null;
  const selection = useMemo(() => readSelection(params), [params]);
  const sort = searchSortOf(params.get('sort'));
  const named = Object.keys(selection.details).length > 0;
  const shopId = chosen?.id ?? null;
  const ids = useSearchDetailIds(address, q, categoryParam, q !== '' && named);
  const asking = q !== '' && (!named || ids.data !== undefined) ? searchParams(q, categoryParam, selection, sort, shopId, ids.data ?? {}) : null;
  const results = useSearchProducts(address, q, categoryParam, asking);

  if (q === '') return <NoResults q="" />;
  const failed = ids.error ?? results.error;
  if (failed) return <Failed onRetry={() => { void (ids.error ? ids.refetch() : results.refetch()); }} />;
  const pages = results.data?.pages;
  if (!pages) return null;
  return (
    <SearchView
      q={q}
      categoryParam={categoryParam}
      pages={pages}
      selection={selection}
      sort={sort}
      ids={ids.data ?? {}}
      shopId={shopId}
      more={results.hasNextPage ? () => results.fetchNextPage() : null}
      loadingMore={results.isFetchingNextPage}
      stale={results.isPlaceholderData}
    />
  );
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

function SearchView({ q, categoryParam, pages, selection, sort, ids, shopId, more, loadingMore, stale }: {
  q: string;
  categoryParam: number | null;
  pages: SearchAnswer[];
  selection: Selection;
  sort: SearchSort;
  ids: Record<string, number>;
  shopId: number | null;
  more: (() => Promise<{ isError: boolean }>) | null;
  loadingMore: boolean;
  stale: boolean;
}) {
  const first = pages[0];
  const { filters, total, measure, repairs } = first;
  const { address, chosen, several } = useSiteContext();
  const categories = useCategories(address);
  const [, setParams] = useSearchParams();
  const readyShop = filters.ready?.shop ?? null;
  const measureSlug = measure ? detailSlug(measure.detail.name) : null;
  const measureValue = measure ? String(measure.value) : null;
  // A measurement narrows to its category, and ticks its value unless the address ticks another.
  const category = measure ? measure.category.id : categoryParam;
  const asked = measureSlug && measureValue && !(selection.details[measureSlug] ?? []).length
    ? { ...selection, details: { ...selection.details, [measureSlug]: [measureValue] } }
    : selection;
  const applied = effective(asked, filters.details, readyShop);
  const ticked = anythingTicked(applied);
  const empty = total === 0 && !ticked && category === null && repairs.length === 0 && first.pages.length === 0;
  usePageTitle(empty ? `No results for “${q}”` : `Results for “${q}”`);

  /**
   * The words, category and ticks a choice means. Leaving a measurement (its
   * value unticked, or its category left) searches the other words: the server
   * reads the measurement from the words, so it would come straight back.
   */
  const resolve = (d: Draft) => {
    if (!measure || !measureSlug || !measureValue) return { q, category: d.category, selection: d.selection };
    const values = d.selection.details[measureSlug] ?? [];
    const rest = withoutMeasure(q, measure.value, measure.detail.unit);
    if (d.category !== measure.category.id) return { q: rest, category: d.category, selection: d.selection };
    if (values.length === 0) return { q: rest, category: d.category, selection: d.selection };
    // Just the measurement ticked: the words say it already.
    const own = values.length === 1 && values[0] === measureValue
      ? { ...d.selection, details: { ...d.selection.details, [measureSlug]: [] } }
      : d.selection;
    return { q, category: null, selection: own };
  };
  const apply = (d: Draft) => {
    const r = resolve(d);
    setParams((prev) => {
      const next = new URLSearchParams({ q: r.q });
      if (r.category !== null) next.set('category', String(r.category));
      for (const [key, value] of prev) if (key !== 'q' && key !== 'category') next.append(key, value);
      return writeSelection(next, r.selection);
    }, { flushSync: true });
  };
  const setSort = (value: string) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value === 'best') next.delete('sort'); else next.set('sort', value);
    return next;
  }, { flushSync: true });

  const appliedDraft: Draft = { selection: applied, category };
  // Leaving the category leaves its details too.
  const withoutCategory: Draft = { selection: { ...applied, details: {} }, category: null };
  const clearAll = () => apply({ selection: NOTHING_TICKED, category: null });
  const categoryName = category === null ? null
    : measure?.category.name ?? filters.categories.find((c) => c.id === category)?.name ?? categories.data?.find((c) => c.id === category)?.name ?? null;
  const chips: ListChip[] = [
    ...(category !== null ? [{ words: `Category: ${categoryName ?? category}`, remove: () => apply(withoutCategory) }] : []),
    ...chipsOf(applied, filters.details, readyShop).map((c) => ({ words: c.words, remove: () => apply({ selection: c.without(applied), category }) })),
  ];

  if (empty) return <NoResults q={q} />;

  const found = plural(total, 'product', 'products');
  const measured = measure && measureSlug ? (applied.details[measureSlug] ?? []) : [];
  const count = measure && measured.length > 0
    ? `${measure.category.name} with ${article(measure.detail.name)} ${measure.detail.name.toLowerCase()} of ${measured.map((v) => valueText({ kind: 'number', unit: measure.detail.unit }, v)).join(' or ')} · ${found}`
    : !ticked && category === null ? found : total === 0 ? 'Nothing matches' : plural(total, 'product matches', 'products match');
  const book = bookPath(address, several && chosen ? chosen.id : null);
  const link = 'inline-flex min-h-11 items-center text-size-15 font-semibold text-[var(--wh-ink)]';

  return (
    <Listing<Draft>
      heading={`Results for “${q}”`}
      after={(repairs.length > 0 || first.pages.length > 0) && (
        <Box>
          <div className="flex flex-wrap items-center gap-3.5">
            {repairs.length > 0 && <span className="grow text-[16px] font-bold">Repairs for “{q}”</span>}
            {repairs.map((s) => (
              <a key={s.id} href={book} className={cn(link, 'gap-2.5 rounded-lg border border-[var(--wh-border)] px-3.5 no-underline')}>
                {s.name}
                {s.pricePence != null && <span className="font-mono">{penceText(s.pricePence)}</span>}
              </a>
            ))}
            {first.pages.map((g) => <Link key={g.key} to={`/${g.key}`} className={link}>Page: {g.name}</Link>)}
          </div>
        </Box>
      )}
      count={count}
      stale={stale}
      sorts={SEARCH_SORTS}
      sort={sort}
      onSort={setSort}
      chips={chips}
      clearAll={clearAll}
      filters={filters}
      renderFilters={(f, chosenDraft, onChange) => (
        <FilterGroups
          filters={f}
          selection={chosenDraft.selection}
          onChange={(s) => onChange({ ...chosenDraft, selection: s })}
          onCategory={chosenDraft.category === null ? (id) => onChange({ selection: { ...chosenDraft.selection, details: {} }, category: id }) : undefined}
          brand={chosenDraft.category !== null}
        />
      )}
      applied={appliedDraft}
      onApply={apply}
      cleared={() => ({ selection: NOTHING_TICKED, category: null })}
      previewPath="/api/site/search"
      paramsOf={(d) => { const r = resolve(d); return searchParams(r.q, r.category, r.selection, sort, shopId, ids); }}
      products={pages.flatMap((p) => p.products)}
      total={total}
      more={more}
      loadingMore={loadingMore}
      empty={(clear) => (ticked
        ? <NothingMatches selection={applied} details={filters.details} readyShop={readyShop} onClear={clear} />
        : <Box><p className="m-0 text-size-15 leading-relaxed">Check the spelling, try a shorter word, or look through the categories.</p></Box>)}
    />
  );
}

/** wb-search-none: the words, what to try, Book a repair, Ask the shop open, and Shop by category. */
function NoResults({ q }: { q: string }) {
  const { address, chosen, several } = useSiteContext();
  usePageTitle(`No results for “${q}”`);
  return (
    <>
      <H1 tabIndex={-1}>No results for “{q}”</H1>
      <Box>
        <p className="m-0 text-size-15 leading-relaxed">Check the spelling, try a shorter word, or look through the categories.</p>
        <div className="flex flex-wrap gap-2.5">
          <a href={bookPath(address, several && chosen ? chosen.id : null)} className={linkButton('default')}>Book a repair</a>
        </div>
        <AskTheShopRegion />
      </Box>
      <ShopByCategory />
    </>
  );
}
