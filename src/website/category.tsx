import * as React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { X } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMedia } from './shell.tsx';
import { usePageTitle, NotFoundPage } from './pages.tsx';
import { Box, Failed, Grid, H1, ProductCard } from './parts.tsx';
import {
  hasDetails, useCategories, useCategoryProducts, useDetailIds, useProductsPreview, useSiteContext,
  type Category, type ProductsPage,
} from './site-query.ts';
import {
  NOTHING_TICKED, SORTS, anythingTicked, chipsOf, detailSlug, effective, nothingSentence, parsePounds, productsParams,
  readSelection, sortOf, valueText, writeSelection, type Selection, type Sort,
} from './filters.ts';

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function CategoryView({ pages, selection, sort, ids, shopId, more, loadingMore, stale }: ViewProps) {
  const first = pages[0];
  const { category, filters, total } = first;
  usePageTitle(category.name);
  const { address } = useSiteContext();
  const categories = useCategories(address);
  const [, setParams] = useSearchParams();
  const phone = useMedia('(max-width: 767px)');
  const readyShop = filters.ready?.shop ?? null;
  const applied = effective(selection, filters.details, readyShop);
  const ticked = anythingTicked(applied);
  const chips = chipsOf(applied, filters.details, readyShop);
  const products = pages.flatMap((p) => p.products);
  const headingRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const focusFrom = useRef<number | null>(null);
  const [panel, setPanel] = useState(false);
  // The window widened past a phone's: the panel goes, its ticks thrown away.
  if (panel && !phone) setPanel(false);

  // Each change is a new step in the history, so Back steps back through them.
  // flushSync: the router otherwise applies an address change as a React
  // transition, and a ticked box shows unticked until it lands.
  // A Show more still on its way no longer moves focus once the filters change.
  const apply = (next: Selection) => { focusFrom.current = null; setParams((prev) => writeSelection(prev, next), { flushSync: true }); };
  const setSort = (value: string) => { focusFrom.current = null; setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value === 'az') next.delete('sort'); else next.set('sort', value);
    return next;
  }, { flushSync: true }); };

  // A removed chip hands focus to the one after it (or Clear all); with none left, to the heading.
  const chipFocus = useRef<number | null>(null);
  const chipWords = chips.map((c) => c.words).join('\n');
  useEffect(() => {
    if (chipFocus.current === null) return;
    const target = chipsRef.current?.querySelectorAll('button')[chipFocus.current] ?? headingRef.current?.querySelector('h1');
    chipFocus.current = null;
    target?.focus();
  }, [chipWords]);

  // Show more: focus moves to the first of the new products (spec, "Show more").
  useEffect(() => {
    if (focusFrom.current === null || products.length <= focusFrom.current) return;
    gridRef.current?.querySelectorAll('a')[focusFrom.current]?.focus();
    focusFrom.current = null;
  }, [products.length]);

  // The panel closed, by any way: focus goes back to Filter.
  const panelWasOpen = useRef(false);
  useEffect(() => {
    if (panelWasOpen.current && !panel) filterButton.current?.focus();
    panelWasOpen.current = panel;
  }, [panel]);

  const count = !ticked ? plural(total, 'product', 'products') : total === 0 ? 'Nothing matches' : plural(total, 'product matches', 'products match');
  // While the answer for new filters loads, the count keeps its last words:
  // the old total with the new ticks would say something untrue.
  const [said, setSaid] = useState(count);
  if (!stale && said !== count) setSaid(count);
  const types = first.types.filter((t) => t.products > 0);
  const sortId = useId();

  const results = products.length > 0 ? (
    <div className="flex min-w-0 flex-col gap-[18px]">
      <div ref={gridRef}>
        <Grid cols={3}>{products.map((p) => <ProductCard key={p.id} product={p} withDetails />)}</Grid>
      </div>
      {more && total > products.length && (
        <div className="flex flex-col items-center gap-2 pt-1.5">
          <span aria-live="polite" className="text-[14px] text-[var(--wh-muted)]">Showing {products.length} of {total} products</span>
          <Button
            variant="default"
            className="min-h-11 text-size-15"
            disabled={loadingMore || stale}
            onClick={() => {
              focusFrom.current = products.length;
              void more().then((r) => { if (r.isError) focusFrom.current = null; });
            }}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  ) : stale ? null : ticked ? (
    <NothingMatches selection={applied} page={first} onClear={() => { chipFocus.current = 0; apply(NOTHING_TICKED); }} />
  ) : (
    <p className="m-0 text-size-15 leading-relaxed">This shop hasn’t put any products in {category.name} online yet.</p>
  );

  return (
    <>
      <Crumbs category={category} categories={categories.data ?? []} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div ref={headingRef} className="flex flex-col gap-1">
          <H1 tabIndex={-1}>{category.name}</H1>
          <span aria-live="polite" className="text-[14px] text-[var(--wh-muted)]">{stale ? said : count}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {phone && (
            <Button ref={filterButton} variant="default" className="min-h-11 text-size-15" onClick={() => setPanel(true)}>Filter</Button>
          )}
          <span className="inline-flex items-center gap-2 text-[14px]">
            <label htmlFor={sortId}>Sort by</label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[14px] text-[var(--wh-ink)]"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </span>
        </div>
      </div>
      {types.length > 0 && (
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
      {chips.length > 0 && (
        <div ref={chipsRef} className="flex flex-wrap items-center gap-2">
          {chips.map((c, i) => (
            <button
              key={c.words}
              type="button"
              aria-label={`Remove filter ${c.words}`}
              onClick={() => { chipFocus.current = i; apply(c.without(applied)); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3 text-[14px] text-[var(--wh-ink)]"
            >
              {c.words}
              <X aria-hidden className="size-3.5" />
            </button>
          ))}
          <button type="button" onClick={() => { chipFocus.current = 0; apply(NOTHING_TICKED); }} className="min-h-11 px-1.5 text-[14px] font-semibold text-[var(--wh-ink)] underline">
            Clear all
          </button>
        </div>
      )}
      {phone ? results : (
        <div className="grid items-start gap-7 md:grid-cols-[240px_minmax(0,1fr)]">
          <FilterGroups filters={filters} selection={applied} onChange={apply} />
          {results}
        </div>
      )}
      {panel && (
        <FilterPanel
          page={first}
          applied={applied}
          sort={sort}
          ids={ids}
          shopId={shopId}
          onApply={(draft) => { apply(draft); setPanel(false); }}
          onClose={() => setPanel(false)}
        />
      )}
    </>
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

/** One value to tick, with how many products it would show at the right (browse.mjs `check`). */
function Check({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-size-15">
      <input type="checkbox" checked={checked} onChange={onChange} className="m-0 size-5 shrink-0 accent-[var(--wh-ink)]" />
      <span className="grow">{label}</span>
      <span aria-hidden className="text-size-13 text-[var(--wh-muted)]">{count}</span>
      <span className="sr-only">, {plural(count, 'product', 'products')}</span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col border-0 border-t border-solid border-[var(--wh-border)] p-0 pt-3">
      <legend className="p-0 text-size-15 font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

const SHOWN = 3;

/** A group of values: the first three, then "Show [n] more" for the rest (design 6). */
function ValuesGroup({ title, values, ticked, labelOf, onToggle }: {
  title: string;
  labelOf: (value: string) => string;
  values: { value: string; label: string; count: number }[];
  ticked: string[];
  onToggle: (value: string) => void;
}) {
  // A ticked value no product now has still shows, so it can be unticked.
  const all = [...values, ...ticked.filter((t) => !values.some((v) => v.value === t)).map((t) => ({ value: t, label: labelOf(t), count: 0 }))];
  const [opened, setOpen] = useState(false);
  // A tick past the first three keeps the group open, however the address got it (Back included).
  const tickPastShown = all.findIndex((v) => ticked.includes(v.value)) >= SHOWN;
  const open = opened || tickPastShown;
  const shown = open ? all : all.slice(0, SHOWN);
  return (
    <Group title={title}>
      {shown.map((v) => <Check key={v.value} label={v.label} count={v.count} checked={ticked.includes(v.value)} onChange={() => onToggle(v.value)} />)}
      {all.length > SHOWN && !tickPastShown && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="min-h-11 self-start p-0 text-[14px] font-semibold text-[var(--wh-ink)] underline">
          {open ? 'Show fewer' : `Show ${all.length - SHOWN} more`}
        </button>
      )}
    </Group>
  );
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** The filters (browse.mjs `filters`): Availability, the category's details, Brand, Price. */
function FilterGroups({ filters, selection, onChange }: { filters: ProductsPage['filters']; selection: Selection; onChange: (s: Selection) => void }) {
  const hint = useId();
  return (
    <aside aria-label="Filters" className="flex min-w-0 flex-col gap-3">
      <Group title="Availability">
        {filters.ready ? (
          <Check
            label={`Ready today at ${filters.ready.shop}`}
            count={filters.ready.count}
            checked={selection.ready}
            onChange={() => onChange({ ...selection, ready: !selection.ready })}
          />
        ) : (
          <Link to="/shops" className="inline-flex min-h-11 items-center text-size-15 font-semibold text-[var(--wh-ink)] underline">Choose a shop to collect from</Link>
        )}
      </Group>
      {filters.details.filter((d) => d.values.length > 0 || (selection.details[detailSlug(d.name)] ?? []).length > 0).map((d) => {
        const slug = detailSlug(d.name);
        const ticked = selection.details[slug] ?? [];
        return (
          <ValuesGroup
            key={d.id}
            title={d.name}
            values={d.values.map((v) => ({ value: String(v.value), label: valueText(d, v.value), count: v.count }))}
            ticked={ticked}
            labelOf={(v) => valueText(d, v)}
            onToggle={(v) => onChange({ ...selection, details: { ...selection.details, [slug]: toggle(ticked, v) } })}
          />
        );
      })}
      {(filters.brands.length > 0 || selection.brands.length > 0) && (
        <ValuesGroup
          title="Brand"
          values={filters.brands.map((b) => ({ value: b.value, label: b.value, count: b.count }))}
          ticked={selection.brands}
          labelOf={(b) => b}
          onToggle={(v) => onChange({ ...selection, brands: toggle(selection.brands, v) })}
        />
      )}
      <Group title="Price">
        <div className="grid grid-cols-2 gap-2">
          <PriceField label="From" value={selection.from} hint={hint} onCommit={(from) => onChange({ ...selection, from })} />
          <PriceField label="To" value={selection.to} hint={hint} onCommit={(to) => onChange({ ...selection, to })} />
        </div>
        <span id={hint} className="pt-1.5 text-size-13 text-[var(--wh-muted)]">Applies when you leave the box or press Enter</span>
      </Group>
    </aside>
  );
}

/** From or To: applied when the box is left or Enter is pressed; anything not a price clears it. */
function PriceField({ label, value, hint, onCommit }: { label: string; value: string | null; hint: string; onCommit: (v: string | null) => void }) {
  const id = useId();
  const [text, setText] = useState(value ?? '');
  // The address changed (Back, a chip, Clear all): the box shows it.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value ?? '');
  }
  const commit = (typed: string) => {
    const pounds = parsePounds(typed);
    setText(pounds ?? '');
    if (pounds !== value) onCommit(pounds);
  };
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-size-13 font-semibold">{label}</label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="£"
        aria-describedby={hint}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); } }}
        className="min-h-11 text-size-15"
      />
    </span>
  );
}

/**
 * The phone's Filter panel (wb-category-filtered on a phone): the same
 * groups, as a draft. The page changes only on "Show [n] products", [n]
 * asked from the server as the ticks change; Close and Esc throw the draft
 * away (not-drawn row 62).
 */
function FilterPanel({ page, applied, sort, ids, shopId, onApply, onClose }: {
  page: ProductsPage;
  applied: Selection;
  sort: Sort;
  ids: Record<string, number>;
  shopId: number | null;
  onApply: (s: Selection) => void;
  onClose: () => void;
}) {
  const { address } = useSiteContext();
  const [draft, setDraft] = useState(applied);
  const titleId = useId();
  const draftParams = productsParams(page.category.id, draft, sort, shopId, ids);
  const same = draftParams.toString() === productsParams(page.category.id, applied, sort, shopId, ids).toString();
  const preview = useProductsPreview(address, draftParams, !same);
  const shown = same ? page : (preview.data ?? page);
  // A count that couldn't be asked isn't guessed from the page behind.
  const words = !same && preview.isError ? 'Show products' : `Show ${plural(shown.total, 'product', 'products')}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      aria-labelledby={titleId}
      aria-modal="true"
      dismissOnBackdrop={false}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none bg-[var(--wh-bg)] shadow-none"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-2 pl-4 pr-2">
          <h2 id={titleId} className="m-0 text-[18px] font-bold">Filter</h2>
          <button type="button" aria-label="Close filters" onClick={onClose} className="inline-flex size-11 items-center justify-center text-[var(--wh-ink)]">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="min-h-0 grow overflow-y-auto px-4 py-1">
          <FilterGroups filters={shown.filters} selection={draft} onChange={setDraft} />
        </div>
        <div className="flex gap-2.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 pb-4 pt-3">
          <Button variant="ghost" className="min-h-11 text-size-15" onClick={() => setDraft(NOTHING_TICKED)}>Clear all</Button>
          <Button variant="accent" block className="min-h-11 text-size-15" onClick={() => onApply(draft)}>
            {words}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * wb-category-empty: what's ticked, in the drawn sentence; Clear all
 * filters; and Ask the shop about it, showing each shop's phone and email in
 * place (audit H5). "Show ones ready in [n] days" waits for WP-6.3 (Jack's answer 2).
 */
function NothingMatches({ selection, page, onClear }: { selection: Selection; page: ProductsPage; onClear: () => void }) {
  const { bold, rest } = nothingSentence(selection, page.filters.details, page.filters.ready?.shop ?? null);
  return (
    <Box>
      <p role="status" className="m-0 text-[16px] leading-normal"><strong>{bold}</strong>{rest}</p>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="default" className="min-h-11 text-size-15" onClick={onClear}>Clear all filters</Button>
      </div>
      <AskTheShop />
    </Box>
  );
}

/** "Ask the shop about it" (or `label`), showing each shop's phone and email in place. */
export function AskTheShop({ label = 'Ask the shop about it' }: { label?: string }) {
  const { site, several } = useSiteContext();
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const shops = site.shops.filter(hasDetails).filter((s) => s.phone || s.email);
  const link = 'text-[var(--wh-ink)]';
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? regionId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center self-start p-0 text-size-15 font-semibold text-[var(--wh-ink)] underline"
      >
        {label}
      </button>
      {open && (
        <div id={regionId} role="region" aria-label="Ask the shop" className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 text-size-15 leading-normal">
          <strong>Ask the shop</strong>
          {shops.map((s) => {
            const phone = s.phone && <a href={`tel:${s.phone.replace(/\s+/g, '')}`} className={link}>{s.phone}</a>;
            const email = s.email && <a href={`mailto:${s.email}`} className={link}>{s.email}</a>;
            return (
              <span key={s.id}>
                {several && `${s.name}: `}
                {phone && <>Call {phone}</>}
                {phone && email && ' or email '}
                {!phone && email && 'Email '}
                {email}
              </span>
            );
          })}
          {shops.length === 0 && <span><Link to="/contact" className={cn(link, 'inline-flex min-h-11 items-center')}>Contact us</Link></span>}
        </div>
      )}
    </>
  );
}
