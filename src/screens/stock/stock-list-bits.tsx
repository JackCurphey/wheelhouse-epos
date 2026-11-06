import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { apiGet } from '@/lib/api/client.ts';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { useActiveOption } from '@/screens/stock-take/stock-take-bits.ts';
import { mono, type ListRow } from './stock-bits.tsx';

/**
 * Stock › a category picked and its details (openspec/changes/stock-list-categories-sizes;
 * drawn as st-filter-bearings, st-filter-derailleurs and st-search-measure; stock control
 * decisions 10 and 11; audit M11 and M12): the Category pill, a category's details as
 * filters and columns, and a measurement's line.
 */
export type Detail = { id: number; name: string; kind: 'number' | 'choice' | 'text'; unit: string | null; choices: string[] };
export type Category = { id: number; name: string; parentId: number | null; path: string; details: Detail[] };

export const useCategoryList = () => useQuery({
  queryKey: ['product-categories'],
  queryFn: () => apiGet<{ categories: Category[] }>('/api/product-categories'),
  select: (d) => (Array.isArray(d?.categories) ? d.categories : []),
});

/** A category's details and those passed down to it, top of the tree first. */
export function detailsFor(all: Category[], path: string): Detail[] {
  return all.filter((c) => path === c.path || path.startsWith(`${c.path} › `))
    .sort((a, b) => a.path.length - b.path.length)
    .flatMap((c) => c.details);
}

/** "30 mm", a choice or text as written; "—" for none. */
export function answerText(d: Detail, value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  return d.kind === 'number' && d.unit ? `${value} ${d.unit}` : String(value);
}

/** What a filter box sends: a number's own unit typed after it ("30 mm", "30mm") is the box's. */
export function filterValue(d: Detail, typed: string): string {
  const v = typed.trim();
  if (d.kind !== 'number' || !d.unit) return v;
  return v.toLowerCase().endsWith(d.unit.toLowerCase()) ? v.slice(0, v.length - d.unit.length).trim() : v;
}

/** "[n] in Bearings with Outer diameter 30 mm and …": the shop's own names, as written. */
export function inCategoryText(path: string, details: Detail[], values: Record<number, string>): string {
  const set = details.filter((d) => (values[d.id] ?? '').trim()).map((d) => `${d.name} ${answerText(d, values[d.id].trim())}`);
  return `in ${path}${set.length ? ` with ${set.join(' and ')}` : ''}`;
}

// A number written in the search, as the server reads a measurement: "30", "30mm", "9.5".
const searchedNumbers = (search: string) => search.split(/\s+/).map((w) => /^(-?\d{1,9}(?:\.\d{1,4})?)[a-z]*$/i.exec(w)?.[1]).filter((n): n is string => !!n).map(Number);

/**
 * A measurement searched (st-search-measure): the row's answered details on one line, the
 * answer equal to a number searched in bold, the unit once at the end when all share it.
 */
export function MeasureLine({ row, all, search }: { row: ListRow; all: Category[]; search: string }) {
  if (row.kind === 'group' || !row.details) return null;
  const answers = row.details;
  const shown = detailsFor(all, row.category).filter((d) => answers[d.id] !== undefined);
  const wanted = searchedNumbers(search);
  const hit = (d: Detail) => d.kind === 'number' && wanted.includes(Number(answers[d.id]));
  // Only when an answer is what was searched: a number found in a name leaves the line be.
  if (!shown.some(hit)) return null;
  const units = new Set(shown.map((d) => (d.kind === 'number' ? d.unit : null)));
  const oneUnit = units.size === 1 && [...units][0] ? [...units][0] : null;
  return (
    <>
      {shown.map((d, i) => {
        const value = answers[d.id];
        const text = `${d.name} ${oneUnit ? value : answerText(d, value)}`;
        return <Fragment key={d.id}>{i ? ' · ' : ''}{hit(d) ? <strong className="text-[var(--wh-ink)]">{text}</strong> : text}</Fragment>;
      })}
      {oneUnit ? ` ${oneUnit}` : ''}
    </>
  );
}

/**
 * Audit M11: a pill-sized search for a category; picked, a dark pill with ✕. The matches
 * are given apart, to sit under the pills: on a phone the pills scroll sideways, which
 * would cut a list hung from the pill.
 */
export function useCategoryPicker({ all, picked, onPick }: { all: Category[]; picked: string | null; onPick: (path: string | null) => void }) {
  const [typed, setTyped] = useState('');
  const word = typed.trim().toLowerCase();
  const matches = word ? all.filter((c) => c.path.toLowerCase().includes(word)).slice(0, 8) : [];
  const keys = useActiveOption(matches.length);
  const choose = (c: Category) => { onPick(c.path); setTyped(''); keys.reset(); };
  // ✕ takes the pill away: focus goes back to the box, not lost with it.
  const box = useRef<HTMLInputElement>(null);
  const back = useRef(false);
  useEffect(() => { if (back.current && !picked) { box.current?.focus(); back.current = false; } }, [picked]);
  if (picked) {
    return { list: null, pill: (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full bg-[var(--wh-ink)] pl-4 text-sm font-semibold whitespace-nowrap text-[var(--wh-panel)]">
        {picked}
        <button type="button" aria-label={`Remove the ${picked} filter`} onClick={() => { back.current = true; onPick(null); }}
          className="inline-flex size-11 items-center justify-center border-0 bg-transparent text-[var(--wh-panel)]"><X aria-hidden="true" size={16} /></button>
      </span>
    ) };
  }
  return { pill: (
    <span className="shrink-0">
      <label className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
        <Search aria-hidden="true" size={15} />
        <input ref={box} role="combobox" aria-label="Category" placeholder="Category" value={typed} aria-expanded={matches.length > 0}
          aria-controls="stock-category-matches" aria-autocomplete="list"
          aria-activedescendant={keys.index >= 0 ? `stock-category-${keys.index}` : undefined}
          onChange={(e) => { setTyped(e.target.value); keys.reset(); }}
          onKeyDown={(e) => { keys.onKeyDown(e, (i) => choose(matches[i])); }}
          className="w-24 border-0 bg-transparent text-sm font-semibold text-[var(--wh-ink)] outline-none placeholder:text-[var(--wh-muted)]" />
      </label>
    </span>
  ), list: matches.length ? (
        <ul id="stock-category-matches" role="listbox" aria-label="Matching categories"
          className="m-0 list-none self-start rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0 md:min-w-72">
          {matches.map((c, i) => (
            <li key={c.id} id={`stock-category-${i}`} role="option" aria-selected={keys.index === i} tabIndex={-1} onClick={() => choose(c)}
              className={`flex min-h-11 cursor-pointer items-center border-t border-[var(--wh-border)] px-3 text-size-15 whitespace-nowrap first:border-t-0 hover:bg-[var(--wh-hover)] ${keys.index === i ? 'bg-[var(--wh-hover)]' : ''}`}>{c.path}</li>
          ))}
        </ul>
      ) : null };
}

/** Decision 10: a picked category's details to filter by — a number box with its unit, the choices, or text. */
export function DetailFilters({ name, details, values, onChange }: { name: string; details: Detail[]; values: Record<number, string>; onChange: (id: number, value: string) => void }) {
  if (details.length === 0) return null;
  const box = 'min-h-9 w-16 border-0 bg-transparent text-right text-size-15 text-[var(--wh-ink)] outline-none placeholder:text-[var(--wh-muted)]';
  return (
    <div role="group" aria-label={`${name} details`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[var(--wh-muted)]">{`${name} details:`}</span>
      {details.map((d) => (d.kind === 'choice' ? (
        <RadioPillGroup key={d.id} aria-label={d.name} className="flex flex-wrap items-center gap-1.5">
          <span aria-hidden="true" className="text-sm font-semibold">{d.name}</span>
          {['', ...d.choices].map((c) => (
            <button key={c || 'any'} type="button" role="radio" aria-checked={(values[d.id] ?? '') === c} onClick={() => onChange(d.id, c)}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap ${(values[d.id] ?? '') === c ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{c || 'Any'}</button>
          ))}
        </RadioPillGroup>
      ) : (
        <label key={d.id} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border bg-[var(--wh-panel)] pr-1.5 pl-3 text-sm font-semibold ${(values[d.id] ?? '').trim() ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-border)]'}`}>
          {d.name}
          <input aria-label={d.name} placeholder="Any" value={values[d.id] ?? ''} inputMode={d.kind === 'number' ? 'decimal' : undefined}
            onChange={(e) => onChange(d.id, e.target.value)} className={`${box} ${d.kind === 'number' ? mono : ''}`} />
          {d.kind === 'number' && d.unit ? <span>{d.unit}</span> : null}
        </label>
      )))}
    </div>
  );
}
