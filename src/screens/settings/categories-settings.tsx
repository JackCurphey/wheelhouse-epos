import { useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { useActiveOption } from '@/screens/stock-take/stock-take-bits.ts';

/**
 * Settings › Stockroom › Categories (drawn as st-categories and st-category-edit in
 * generator/stock.mjs; stock control decision 10; openspec/changes/categories-screens). Each
 * category with its own details on one line, one inside another set in, Edit, the drawn note
 * and "+ Add a category"; the box: where it sits, what it has from above with "Change it on
 * [parent]", its own details (a removed one undoable until Save, audit M15), Add a detail
 * asking for what each kind needs (audit H4), and what Save takes off. The server is
 * category-tree's; reading is anyone's, changing the Owner's.
 */
type Kind = 'number' | 'choice' | 'text';
type Detail = { id: number; name: string; kind: Kind; unit: string | null; choices: string[]; answered: number };
type Category = { id: number; name: string; parentId: number | null; path: string; products: number; details: Detail[] };
// A detail in the box: kept (with its id), new (none), or removed until Save.
type Draft = { id: number | null; name: string; kind: Kind; unit: string; choices: string[]; answered: number; removed: boolean; typing: string };

const KEY = ['product-categories'];
const useCategories = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<{ categories: Category[] }>('/api/product-categories') });
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const KINDS: [Kind, string][] = [['number', 'A number with a unit'], ['choice', 'A choice from a list'], ['text', 'Text']];
const field = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal';
const mono = 'font-[family-name:var(--wh-font-mono)]';

// "Inner diameter (mm)", "Number of gears (a choice)", "[Detail]", as the list draws them.
const shortly = (d: Detail) => (d.kind === 'number' ? `${d.name} (${d.unit})` : d.kind === 'choice' ? `${d.name} (a choice)` : d.name);
const above = (all: Category[], c: Category) => {
  const out: Category[] = [];
  for (let p = all.find((x) => x.id === c.parentId); p; p = all.find((x) => x.id === p?.parentId)) out.unshift(p);
  return out;
};
const inside = (all: Category[], c: Category) => {
  const ids = new Set([c.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of all) if (x.parentId !== null && ids.has(x.parentId) && !ids.has(x.id)) { ids.add(x.id); grew = true; }
  }
  return ids;
};

/** The fold's summary, as drawn: the first two by path, "and [n] more"; or none yet. */
// "Derailleurs’", "Drivetrain’s", as the box's heading draws it.
const whose = (name: string) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);
export function useCategoriesSummary(): string {
  const cats = useCategories();
  if (!cats.data) return '';
  const all = cats.data.categories;
  if (all.length === 0) return 'None yet';
  // The most particular ones, as drawn ("Drivetrain › Derailleurs", not Drivetrain too).
  const ends = all.filter((c) => !all.some((x) => x.parentId === c.id));
  const first = ends.slice(0, 2).map((c) => c.path).join(', ');
  return ends.length > 2 ? `${first} and ${ends.length - 2} more` : first;
}

export function CategoriesSettings() {
  const cats = useCategories();
  const [open, setOpen] = useState<Category | 'new' | null>(null);
  const all = cats.data?.categories ?? [];
  const line = (c: Category) => {
    const own = c.details.map(shortly);
    const hasInside = all.some((x) => x.parentId === c.id);
    const parent = all.find((x) => x.id === c.parentId);
    const passedDown = above(all, c).some((a) => a.details.length > 0);
    const parts = [...own];
    if (own.length && hasInside) parts.push('passed down to its sub-categories');
    if (parent && passedDown) parts.push(`and ${parent.name}’s details`);
    return parts.length ? parts.join(' · ') : 'No details yet';
  };
  return (
    <div className="flex flex-col gap-2.5">
      {all.length ? (
        <div role="list">
          {all.map((c) => {
            const depth = above(all, c).length;
            const parent = all.find((x) => x.id === c.parentId);
            return (
              <div key={c.id} role="listitem" className="flex min-h-14 items-center gap-3 border-t border-[var(--wh-border)] py-2" style={{ paddingLeft: depth * 24 }}>
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-size-15 font-semibold">
                    {parent ? <><span aria-hidden="true" className="text-[var(--wh-muted)]">↳ </span><span className="sr-only">{`Inside ${parent.name}: `}</span></> : null}
                    {c.name}
                  </span>
                  <span className="text-size-13 text-[var(--wh-muted)]">{line(c)}</span>
                </span>
                <Button variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setOpen(c)}>Edit</Button>
              </div>
            );
          })}
        </div>
      ) : cats.data ? <p className="m-0 text-size-15 text-[var(--wh-muted)]">No categories yet.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Button onClick={() => setOpen('new')}>+ Add a category</Button>
        <p className="m-0 text-sm text-[var(--wh-muted)]">A product shows its category’s details to fill in, and Stock can filter by them.</p>
      </div>
      {open ? <CategoryBox key={open === 'new' ? 'new' : open.id} all={all} start={open === 'new' ? null : open} onOpen={setOpen} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function CategoryBox({ all, start, onOpen, onClose }: { all: Category[]; start: Category | null; onOpen: (c: Category) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const parentOf = start ? all.find((x) => x.id === start.parentId) ?? null : null;
  const [parent, setParent] = useState<Category | null>(parentOf);
  const [typedParent, setTypedParent] = useState(parentOf?.path ?? '');
  const [drafts, setDrafts] = useState<Draft[]>((start?.details ?? []).map((d) => ({ ...d, unit: d.unit ?? '', removed: false, typing: '' })));
  const [adding, setAdding] = useState<{ name: string; kind: Kind; unit: string; choices: string[]; typing: string }>({ name: '', kind: 'number', unit: '', choices: [], typing: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where it can sit: anywhere but itself or inside itself.
  const barred = start ? inside(all, start) : new Set<number>();
  const typed = typedParent.trim().toLowerCase();
  const matches = typed && typedParent !== parent?.path ? all.filter((c) => !barred.has(c.id) && c.path.toLowerCase().includes(typed)).slice(0, 8) : [];
  const keys = useActiveOption(matches.length);
  const pick = (c: Category) => { setParent(c); setTypedParent(c.path); keys.reset(); };
  const fromAbove = start || parent ? [...(parent ? [...above(all, parent), parent] : [])].filter((a) => a.details.length > 0) : [];
  const title = start ? start.name : 'Add a category';
  const label = start?.name ?? (name.trim() || 'this category');
  const removing = drafts.filter((d) => d.removed && d.id !== null);
  const losing = removing.reduce((n, d) => n + d.answered, 0);

  const change = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const addChoice = (i: number) => {
    const t = drafts[i].typing.trim();
    if (t && !drafts[i].choices.includes(t)) change(i, { choices: [...drafts[i].choices, t], typing: '' });
    else change(i, { typing: '' });
  };
  const onEnter = (e: KeyboardEvent<HTMLInputElement>, then: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); then(); }
  };
  const addDetail = () => {
    const n = adding.name.trim();
    if (!n) { setError('Give the detail a name'); return; }
    setError(null);
    const choices = adding.kind === 'choice' ? [...adding.choices, ...(adding.typing.trim() ? [adding.typing.trim()] : [])] : [];
    setDrafts((ds) => [...ds, { id: null, name: n, kind: adding.kind, unit: adding.unit.trim(), choices, answered: 0, removed: false, typing: '' }]);
    setAdding({ name: '', kind: adding.kind, unit: '', choices: [], typing: '' });
  };

  async function save() {
    setBusy(true);
    setError(null);
    // An emptied box is the top; a box typed but not picked from the list is that path, if any.
    const sitsIn = typedParent.trim() === '' ? null : parent?.path === typedParent ? parent : all.find((c) => c.path.toLowerCase() === typed) ?? null;
    if (typedParent.trim() !== '' && !sitsIn) { setError('Pick where it sits from the list'); setBusy(false); return; }
    const details = drafts.filter((d) => !d.removed).map((d) => ({
      ...(d.id !== null ? { id: d.id } : {}), name: d.name.trim(), kind: d.kind,
      ...(d.kind === 'number' ? { unit: d.unit.trim() } : {}), ...(d.kind === 'choice' ? { choices: d.choices } : {}),
    }));
    try {
      let id = start?.id;
      if (!id) id = (await apiMutate<Category>('/api/product-categories', { name: name.trim(), parentId: sitsIn?.id ?? null })).id;
      if (start || details.length) await apiMutate(`/api/product-categories/${id}`, { parentId: sitsIn?.id ?? null, details }, { method: 'PUT' });
      await queryClient.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (err) {
      // Made, but its details refused: it's there now, so the box stays to put them right.
      if (!start) await queryClient.invalidateQueries({ queryKey: KEY });
      setError(words(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="cat-title" className="md:max-w-[660px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="cat-title">{title}</DialogTitle>
          {parentOf ? <span className="text-size-13 text-[var(--wh-muted)]">{`A sub-category of ${parentOf.name}`}</span> : null}
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {start ? null : (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Name
            <input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <div className="relative flex flex-col gap-1.5">
          <label htmlFor="cat-parent" className="text-sm font-semibold">Sits inside</label>
          <span className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[var(--wh-muted)]">
            <NavIcon name="search" size={15} />
            <input id="cat-parent" role="combobox" aria-expanded={matches.length > 0} aria-controls="cat-parent-matches" aria-autocomplete="list" value={typedParent}
              aria-activedescendant={keys.index >= 0 ? `cat-parent-${keys.index}` : undefined}
              onKeyDown={(e) => { keys.onKeyDown(e, (i) => pick(matches[i])); }}
              onChange={(e) => { setTypedParent(e.target.value); if (e.target.value.trim() === '') setParent(null); keys.reset(); }}
              className="min-w-0 grow border-0 bg-transparent text-size-15 text-[var(--wh-ink)] focus:outline-none" />
          </span>
          {matches.length > 0 ? (
            <ul id="cat-parent-matches" role="listbox" aria-label="Matching categories" className="m-0 list-none rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
              {matches.map((c, i) => (
                <li key={c.id} id={`cat-parent-${i}`} role="option" aria-selected={keys.index === i} tabIndex={-1} onClick={() => pick(c)}
                  className={`flex min-h-11 cursor-pointer items-center border-t border-[var(--wh-border)] px-3 text-size-15 first:border-t-0 hover:bg-[var(--wh-hover)] ${keys.index === i ? 'bg-[var(--wh-hover)]' : ''}`}>{c.path}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {fromAbove.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-size-15 font-bold">{`From ${a.name}`}</span>
              <span className="text-sm text-[var(--wh-muted)]">{a.details.map((d) => d.name).join(' · ')}</span>
            </span>
            <Button variant="ghost" onClick={() => onOpen(a)}>{`Change it on ${a.name}`}</Button>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-size-15 font-bold">{`${whose(label)} own details`}</span>
          <div role="list">
            {drafts.map((d, i) => (d.removed ? (
              <div key={i} role="listitem" className="flex min-h-[52px] items-center gap-2.5 border-t border-[var(--wh-border)] text-sm text-[var(--wh-muted)]">
                <span className="grow"><s>{d.name}</s> · removed</span>
                <Button variant="ghost" aria-label={`Undo removing ${d.name}`} onClick={() => change(i, { removed: false })}>Undo</Button>
              </div>
            ) : (
              <div key={i} role="listitem" className="flex flex-col gap-2 border-t border-[var(--wh-border)] py-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input aria-label="Detail name" className={`${field} min-w-[12rem] grow`} value={d.name} maxLength={60} onChange={(e) => change(i, { name: e.target.value })} />
                  <span className="text-sm whitespace-nowrap text-[var(--wh-muted)]">{d.kind === 'number' ? `A number in ${d.unit}` : d.kind === 'choice' ? 'A choice from a list' : 'Text'}</span>
                  <button type="button" aria-label={`Remove ${d.name}`} onClick={() => change(i, { removed: true })} className="size-11 shrink-0 border-0 bg-transparent text-[var(--wh-muted)]">✕</button>
                </div>
                {d.kind === 'choice' ? (
                  <div role="group" aria-label={`Choices for ${d.name}`} className="flex flex-wrap items-center gap-1.5">
                    {d.choices.map((c) => (
                      <span key={c} className={`inline-flex min-h-11 items-center gap-0.5 rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] pl-3 text-sm ${mono}`}>
                        {c}
                        <button type="button" aria-label={`Remove the choice ${c}`} onClick={() => change(i, { choices: d.choices.filter((x) => x !== c) })} className="size-11 border-0 bg-transparent text-[var(--wh-muted)]">✕</button>
                      </span>
                    ))}
                    <input aria-label="Add a choice" placeholder="Add a choice" className={`${field} w-[140px]`} value={d.typing}
                      onChange={(e) => change(i, { typing: e.target.value })} onKeyDown={(e) => onEnter(e, () => addChoice(i))} onBlur={() => addChoice(i)} />
                  </div>
                ) : null}
              </div>
            )))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--wh-surface-muted)] p-3">
          <span className="text-sm font-bold">Add a detail</span>
          <input aria-label="New detail name" placeholder="Name, like “Cage length”" className={field} value={adding.name} maxLength={60}
            onChange={(e) => setAdding({ ...adding, name: e.target.value })} onKeyDown={(e) => onEnter(e, addDetail)} />
          <RadioPillGroup aria-label="Kind of answer" className="flex flex-wrap gap-2">
            {KINDS.map(([k, words]) => (
              <button key={k} type="button" role="radio" aria-checked={adding.kind === k} onClick={() => setAdding({ ...adding, kind: k })}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${adding.kind === k ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{words}</button>
            ))}
          </RadioPillGroup>
          {adding.kind === 'number' ? (
            <div className="flex items-center gap-2">
              <label htmlFor="cat-unit" className="text-sm font-semibold">Unit</label>
              <input id="cat-unit" placeholder="mm" className={`${field} w-[120px]`} value={adding.unit} maxLength={12}
                onChange={(e) => setAdding({ ...adding, unit: e.target.value })} onKeyDown={(e) => onEnter(e, addDetail)} />
            </div>
          ) : null}
          {adding.kind === 'choice' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {adding.choices.map((c) => <span key={c} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 text-sm ${mono}`}>{c}</span>)}
              <input aria-label="Choices for the new detail" placeholder="Add a choice" className={`${field} w-[160px]`} value={adding.typing}
                onChange={(e) => setAdding({ ...adding, typing: e.target.value })}
                onKeyDown={(e) => onEnter(e, () => { const t = adding.typing.trim(); if (t && !adding.choices.includes(t)) setAdding({ ...adding, choices: [...adding.choices, t], typing: '' }); })} />
            </div>
          ) : null}
          <div><Button onClick={addDetail}>Add this detail</Button></div>
        </div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">
          {`Every product in ${label} — already in stock or added later — gets these details.`}
          {removing.length && losing ? ` Saving removes ${removing.map((d) => d.name).join(', ')} from ${losing} product${losing === 1 ? '' : 's'}.` : ''}
        </p>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
