import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMedia } from './shell.tsx';
import { Box, Grid, H1, ProductCard } from './parts.tsx';
import { hasDetails, useListPreview, useSiteContext, type DetailFilter, type ProductCardData, type ProductsPage } from './site-query.ts';
import { detailSlug, nothingSentence, parsePounds, valueText, type Selection } from './filters.ts';

/**
 * A list of products with its filters, as the category page and the search
 * results share it (website-browse design 6; wb-category* and wb-search-results,
 * wb-search-measure in browse.mjs, whose `listing` draws both): the heading
 * and its count, Filter on a phone, Sort, what goes under the heading, the
 * chips, the filters `aside` and the products six at a time with Show more.
 * On a phone the filters open in a full-screen panel whose ticks apply only
 * when "Show [n] products" is pressed. `D` is what the filters choose: the
 * ticks for a category, the ticks and the category for a search.
 */

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The filters an answer gives; a search's also lists the categories to narrow to. */
export type ListFilters = ProductsPage['filters'] & { categories?: { id: number; name: string; count: number }[] };
export type ListChip = { words: string; remove: () => void };

type ListingProps<D> = {
  heading: string;
  /** Above the heading: the category's path. */
  before?: React.ReactNode;
  /** Under the heading: a category's types, or a search's repairs and pages. */
  after?: React.ReactNode;
  count: string;
  /** The last answer, kept on the page while the one for new filters loads. */
  stale: boolean;
  sorts: readonly { value: string; label: string }[];
  sort: string;
  onSort: (value: string) => void;
  chips: ListChip[];
  clearAll: () => void;
  filters: ListFilters;
  renderFilters: (filters: ListFilters, chosen: D, onChange: (next: D) => void) => React.ReactNode;
  applied: D;
  onApply: (next: D) => void;
  /** The phone panel's Clear all. */
  cleared: (d: D) => D;
  /** Where the phone panel asks its count, and what it asks for a draft. */
  previewPath: '/api/site/products' | '/api/site/search';
  paramsOf: (d: D) => URLSearchParams;
  products: ProductCardData[];
  total: number;
  more: (() => Promise<{ isError: boolean }>) | null;
  loadingMore: boolean;
  /** What shows with no products (not while a new answer loads); `clear` clears every filter and moves focus to the heading. */
  empty: (clear: () => void) => React.ReactNode;
};

export function Listing<D>(props: ListingProps<D>) {
  const { heading, before, after, count, stale, sorts, sort, onSort, chips, clearAll, filters, renderFilters, applied, onApply, products, total, more, loadingMore } = props;
  const phone = useMedia('(max-width: 767px)');
  const headingRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const focusFrom = useRef<number | null>(null);
  const [panel, setPanel] = useState(false);
  // The window widened past a phone's: the panel goes, its ticks thrown away.
  if (panel && !phone) setPanel(false);

  // A Show more still on its way no longer moves focus once the filters change.
  const act = (fn: () => void) => { focusFrom.current = null; fn(); };
  const apply = (next: D) => act(() => onApply(next));

  // A removed chip hands focus to the one after it (or Clear all); with none left, to the heading.
  const chipFocus = useRef<number | null>(null);
  const chipWords = chips.map((c) => c.words).join('\n');
  useEffect(() => {
    if (chipFocus.current === null) return;
    const target = chipsRef.current?.querySelectorAll('button')[chipFocus.current] ?? headingRef.current?.querySelector('h1');
    chipFocus.current = null;
    target?.focus();
  }, [chipWords]);
  const clear = () => { chipFocus.current = 0; act(clearAll); };

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

  // While the answer for new filters loads, the count keeps its last words:
  // the old total with the new ticks would say something untrue.
  const [said, setSaid] = useState(count);
  if (!stale && said !== count) setSaid(count);
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
  ) : stale ? null : <Slot render={props.empty} arg={clear} />;

  return (
    <>
      {before}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div ref={headingRef} className="flex flex-col gap-1">
          <H1 tabIndex={-1}>{heading}</H1>
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
              onChange={(e) => act(() => onSort(e.target.value))}
              className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[14px] text-[var(--wh-ink)]"
            >
              {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </span>
        </div>
      </div>
      {after}
      {chips.length > 0 && (
        <div ref={chipsRef} className="flex flex-wrap items-center gap-2">
          {chips.map((c, i) => (
            <button
              key={c.words}
              type="button"
              aria-label={`Remove filter ${c.words}`}
              onClick={() => { chipFocus.current = i; act(c.remove); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3 text-[14px] text-[var(--wh-ink)]"
            >
              {c.words}
              <X aria-hidden className="size-3.5" />
            </button>
          ))}
          <button type="button" onClick={clear} className="min-h-11 px-1.5 text-[14px] font-semibold text-[var(--wh-ink)] underline">
            Clear all
          </button>
        </div>
      )}
      {phone ? results : (
        <div className="grid items-start gap-7 md:grid-cols-[240px_minmax(0,1fr)]">
          <FiltersSlot render={renderFilters} filters={filters} chosen={applied} onChange={apply} />
          {results}
        </div>
      )}
      {panel && (
        <FilterPanel
          {...props}
          onApply={(draft) => { apply(draft); setPanel(false); }}
          onClose={() => setPanel(false)}
        />
      )}
    </>
  );
}

// The page's own pieces, drawn as components so their handlers are props, called only on a click.
function Slot<A>({ render, arg }: { render: (arg: A) => React.ReactNode; arg: A }) {
  return <>{render(arg)}</>;
}
function FiltersSlot<D>({ render, filters, chosen, onChange }: { render: ListingProps<D>['renderFilters']; filters: ListFilters; chosen: D; onChange: (next: D) => void }) {
  return <>{render(filters, chosen, onChange)}</>;
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

/**
 * The filters (browse.mjs `filters`): Availability, a search's Category,
 * the details, Brand, Price. A search not narrowed to a category shows
 * Category in place of the details and Brand, as wb-search-results draws it.
 */
export function FilterGroups({ filters, selection, onChange, onCategory, brand = true }: {
  filters: ListFilters;
  selection: Selection;
  onChange: (s: Selection) => void;
  /** A search's categories to narrow to; picking one narrows to it. */
  onCategory?: (id: number) => void;
  brand?: boolean;
}) {
  const hint = useId();
  const { openChooser } = useSiteContext();
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
          <button type="button" onClick={(e) => openChooser(e.currentTarget)} className="inline-flex min-h-11 items-center border-0 bg-transparent p-0 text-left text-size-15 font-semibold text-[var(--wh-ink)] underline">Choose a shop to collect from</button>
        )}
      </Group>
      {onCategory && (filters.categories ?? []).length > 0 && (
        <ValuesGroup
          title="Category"
          values={(filters.categories ?? []).map((c) => ({ value: String(c.id), label: c.name, count: c.count }))}
          ticked={[]}
          labelOf={(v) => v}
          onToggle={(v) => onCategory(Number(v))}
        />
      )}
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
      {brand && (filters.brands.length > 0 || selection.brands.length > 0) && (
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
function FilterPanel<D>({ applied, filters, total, renderFilters, cleared, previewPath, paramsOf, onApply, onClose }: ListingProps<D> & { onClose: () => void }) {
  const { address } = useSiteContext();
  const [draft, setDraft] = useState(applied);
  const titleId = useId();
  const draftParams = paramsOf(draft);
  const same = draftParams.toString() === paramsOf(applied).toString();
  const preview = useListPreview<{ total: number; filters: ListFilters }>(address, previewPath, draftParams, !same);
  const shown = same ? { total, filters } : (preview.data ?? { total, filters });
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
          <FiltersSlot render={renderFilters} filters={shown.filters} chosen={draft} onChange={setDraft} />
        </div>
        <div className="flex gap-2.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 pb-4 pt-3">
          <Button variant="ghost" className="min-h-11 text-size-15" onClick={() => setDraft(cleared(draft))}>Clear all</Button>
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
export function NothingMatches({ selection, details, readyShop, onClear }: { selection: Selection; details: DetailFilter[]; readyShop: string | null; onClear: () => void }) {
  const { bold, rest } = nothingSentence(selection, details, readyShop);
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
  const [open, setOpen] = useState(false);
  const regionId = useId();
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
      {open && <AskTheShopRegion id={regionId} />}
    </>
  );
}

/** "Ask the shop": each shop's phone and email (browse.mjs `askOpen`), shown open on wb-search-none. */
export function AskTheShopRegion({ id }: { id?: string }) {
  const { site, several } = useSiteContext();
  const shops = site.shops.filter(hasDetails).filter((s) => s.phone || s.email);
  const link = 'text-[var(--wh-ink)]';
  return (
    <div id={id} role="region" aria-label="Ask the shop" className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 text-size-15 leading-normal">
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
  );
}
