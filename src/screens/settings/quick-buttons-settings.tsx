import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { poundsText } from '@/lib/money.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { useSavedNote } from './saved-note.tsx';

/**
 * Settings › Front desk › Till › Quick buttons (set-till-quick, set-till-quick-add,
 * set-till-quick-saved and set-till-empty in generator/setup.mjs;
 * openspec/changes/owner-setup-till-payments-eod, design 1 and 5): the shop's
 * groups as pills, the chosen group's buttons in till order, each with its
 * name, line and price. Hover, right-click or long-press shows Edit and
 * Remove; the handle moves a button by drag or the arrow keys. Every change
 * saves at once and shows Settings' note (saved-note.tsx), with Undo, or a
 * failed save kept here with Try again. A button's price is always its item's.
 */
type QuickButton = { id: number; groupId: number; productId: number | null; serviceId: number | null; label: string | null; name: string; itemName: string; kind: 'product' | 'service'; line: string; price: number; onSale: boolean };
type Group = { id: number; name: string; buttons: QuickButton[] };
type List = { groups: Group[] };
type Item = { kind: 'product' | 'service'; id: number; name: string; line: string; price: number };
type Req = { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: object };
type Editing = { id: number | null; groupId: number; item: Item | null; name: string; index?: number; label?: string | null };

const KEY = ['quick-buttons'];
const useQuickButtons = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<List>('/api/quick-buttons') });
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const PICK = 'Pick a product or service';
// A service's line as the till shows it (server/routes/quick-buttons.js serviceLine).
const serviceLine = (minutes: number | null) => (minutes ? `Labour · ${minutes} min` : 'Labour');
const pill = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`;
const INPUT = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';
const itemOf = (b: QuickButton): Item => ({ kind: b.kind, id: (b.productId ?? b.serviceId)!, name: b.itemName, line: b.line, price: b.price });
const itemBody = (item: Item) => (item.kind === 'product' ? { productId: item.id } : { serviceId: item.id });
const withButtons = (l: List, groupId: number, fn: (b: QuickButton[]) => QuickButton[]) => ({ groups: l.groups.map((g) => (g.id === groupId ? { ...g, buttons: fn(g.buttons) } : g)) });

/** The fold's summary: the groups' names, as drawn, or "None yet" (set-till-empty). */
export function useQuickButtonsSummary(): string {
  const groups = useQuickButtons().data?.groups;
  if (!Array.isArray(groups)) return '';
  return groups.length ? groups.map((g) => g.name).join(', ') : 'None yet';
}

/**
 * Sends one change and shows the note. `kept` puts the change on screen first,
 * so a failed save stays here; the server's whole list then replaces it.
 * `inline` takes a refusal's words for a box, in place of the note.
 */
function useQuickSave() {
  const queryClient = useQueryClient();
  const note = useSavedNote();
  async function run(req: Req, o: { text?: string; undo?: Req | ((id: number) => Req); kept?: (l: List) => List; back?: () => HTMLElement | null; inline?: (words: string, err: ApiError) => void; done?: (id: number) => void } = {}): Promise<void> {
    if (o.kept) queryClient.setQueryData<List>(KEY, (l) => l && o.kept!(l));
    note.busy(o.back);
    try {
      const res = await apiMutate<List & { id?: number }>(req.path, req.body ?? {}, { method: req.method });
      queryClient.setQueryData<List>(KEY, { groups: res.groups });
      o.done?.(res.id ?? 0);
      const undo = typeof o.undo === 'function' ? o.undo(res.id ?? 0) : o.undo;
      note.show({ text: o.text ?? 'Saved', back: o.back, action: undo ? { label: 'Undo', run: () => void run(undo, { back: o.back }) } : undefined });
    } catch (err) {
      const retry = !(err instanceof ApiError) || err.status >= 500;
      const words = !(err instanceof ApiError) ? NO_INTERNET : !retry && err.hasServerMessage ? err.message : SAVE_FAILED;
      if (!retry) void queryClient.invalidateQueries({ queryKey: KEY });
      if (!retry && o.inline) return o.inline(words, err as ApiError);
      note.show({ text: words, failed: true, back: o.back, action: retry ? { label: 'Try again', run: () => void run(req, o) } : undefined });
    }
  }
  return run;
}

export function QuickButtonsSettings() {
  const list = useQuickButtons();
  const run = useQuickSave();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [groupBox, setGroupBox] = useState<{ id: number | null; name: string; thenButton?: boolean } | null>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const groups = list.data?.groups ?? [];
  const chosen = groups.find((g) => g.id === chosenId) ?? groups[0];
  const handle = (id: number) => () => rowsRef.current?.querySelector<HTMLElement>(`[data-move="${id}"]`) ?? null;

  function move(b: QuickButton, from: number, to: number) {
    if (!chosen || to < 0 || to >= chosen.buttons.length || from === to) return;
    const order = (f: number, t: number) => (l: List) => withButtons(l, b.groupId, (bs) => { const n = bs.filter((x) => x.id !== b.id); n.splice(t, 0, bs[f]); return n; });
    void run({ method: 'PUT', path: `/api/quick-buttons/${b.id}`, body: { position: to } }, { kept: order(from, to), undo: { method: 'PUT', path: `/api/quick-buttons/${b.id}`, body: { position: from } }, back: handle(b.id) });
    // The handle keeps focus as its button moves, for the next arrow press.
    setTimeout(() => handle(b.id)()?.focus(), 0);
  }
  const onKey = (b: QuickButton, i: number) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(b, i, i - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(b, i, i + 1); }
  };
  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    const from = chosen?.buttons.findIndex((x) => x.id === dragging.current) ?? -1;
    if (chosen && from >= 0) move(chosen.buttons[from], from, i);
    dragging.current = null;
  };
  function remove(b: QuickButton, i: number) {
    setMenuId(null);
    void run({ method: 'DELETE', path: `/api/quick-buttons/${b.id}` }, {
      kept: (l) => withButtons(l, b.groupId, (bs) => bs.filter((x) => x.id !== b.id)),
      undo: { method: 'POST', path: '/api/quick-buttons', body: { groupId: b.groupId, productId: b.productId, serviceId: b.serviceId, label: b.label, position: i } },
    });
  }
  const addButton = () => (chosen ? setEditing({ id: null, groupId: chosen.id, item: null, name: '' }) : setGroupBox({ id: null, name: '', thenButton: true }));

  if (list.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the quick buttons. Try again in a moment.</p>;
  if (!list.data) return null;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Quick button groups" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g.id} type="button" aria-pressed={g.id === chosen?.id} className={pill(g.id === chosen?.id)}
            onClick={() => setChosenId(g.id)} onContextMenu={(e) => { e.preventDefault(); setGroupBox({ id: g.id, name: g.name }); }}>{g.name}</button>
        ))}
        <button type="button" aria-pressed="false" className={pill(false)} onClick={() => setGroupBox({ id: null, name: '' })}>+ Add a group</button>
      </div>
      {chosen ? (
        <>
          <div ref={rowsRef} className="flex flex-col gap-2">
            {chosen.buttons.map((b, i) => (
              <Row key={b.id} b={b} pinned={menuId === b.id} onPin={() => setMenuId(b.id)} onKey={onKey(b, i)} onDrag={() => { dragging.current = b.id; }} onDrop={onDrop(i)}
                onEdit={() => { setMenuId(null); setEditing({ id: b.id, groupId: b.groupId, item: itemOf(b), name: b.name, index: i, label: b.label }); }} onRemove={() => remove(b, i)} />
            ))}
          </div>
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <Button variant="default" onClick={addButton}>+ Add a button</Button>
            <p className="m-0 text-sm text-[var(--wh-muted)]">Buttons show on the till in this order.</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2.5 rounded-[10px] border-2 border-dashed border-[var(--wh-border)] px-4 py-7 text-center">
          <span className="text-base font-bold">No quick buttons yet</span>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Add the things you sell most — they’ll show on the till, one tap each.</p>
          <Button variant="primary" onClick={addButton}>+ Add a button</Button>
        </div>
      )}
      {editing ? <ButtonBox start={editing} groups={groups} run={run} onClose={() => setEditing(null)} /> : null}
      {groupBox ? (
        <GroupBox start={groupBox} run={run} onClose={() => setGroupBox(null)}
          onAdded={(id) => { setChosenId(id); if (groupBox.thenButton) setEditing({ id: null, groupId: id, item: null, name: '' }); }} />
      ) : null}
    </div>
  );
}

function Row({ b, pinned, onPin, onKey, onDrag, onDrop, onEdit, onRemove }: {
  b: QuickButton; pinned: boolean; onPin: () => void; onKey: (e: KeyboardEvent) => void; onDrag: () => void; onDrop: (e: DragEvent) => void; onEdit: () => void; onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  // Focus or a right-click keeps the row open until another row opens, so the
  // page doesn't shift under a tap elsewhere (on a phone Edit and Remove wrap).
  const open = hover || pinned;
  return (
    <div data-quick-button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => { if (!pinned) onPin(); }}
      onContextMenu={(e) => { e.preventDefault(); onPin(); }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
      className={`flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-[var(--wh-panel)] py-1 pr-2 pl-3 md:flex-nowrap ${open ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-border)]'}`}>
      <button type="button" data-move={b.id} draggable aria-label={`Move ${b.name} — drag, or use the arrow keys`} onKeyDown={onKey}
        onDragStart={(e) => { onDrag(); e.dataTransfer.setData('text/plain', b.name); }}
        className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center text-base text-[var(--wh-muted)]">⋮⋮</button>
      <span className="flex min-w-0 grow basis-0 flex-col gap-px">
        <span data-part="name" className="text-size-15 font-semibold">{b.name}</span>
        <span data-part="line" className="text-xs text-[var(--wh-muted)]">{b.onSale ? b.line : `${b.line} · Not on sale`}</span>
      </span>
      <span data-part="price" className="font-[family-name:var(--wh-font-mono)] text-size-15">{poundsText(b.price)}</span>
      {open ? (
        <span className="ml-auto inline-flex items-center gap-2 max-md:basis-full max-md:justify-end">
          <button type="button" aria-label={`Edit ${b.name}`} onClick={onEdit} className="min-h-11 px-3 text-sm font-semibold">Edit</button>
          <Button variant="danger" aria-label={`Remove ${b.name}`} onClick={onRemove}>Remove</Button>
        </span>
      ) : null}
    </div>
  );
}

/** Add a quick button (set-till-quick-add), and Edit's box: the same, filled in, with Save (design 5 point 2). */
function ButtonBox({ start, groups, run, onClose }: { start: Editing; groups: Group[]; run: ReturnType<typeof useQuickSave>; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Item | null>(start.item);
  const [name, setName] = useState(start.name);
  const [groupId, setGroupId] = useState(start.groupId);
  const [error, setError] = useState<string | null>(null);
  const term = search.trim();
  const products = useQuery({ queryKey: ['products', term], queryFn: () => apiGet<{ id: number; name: string; price: number }[]>(`/api/products?search=${encodeURIComponent(term)}`), enabled: term.length >= 2 });
  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<{ id: number; name: string; price: number; minutes: number | null; active: boolean }[]>('/api/workshop-services') });
  const hits: Item[] = term.length < 2 ? [] : [
    ...(services.data ?? []).filter((s) => s.active && s.name.toLowerCase().includes(term.toLowerCase())).map((s) => ({ kind: 'service' as const, id: s.id, name: s.name, line: serviceLine(s.minutes), price: s.price })),
    ...(products.data ?? []).map((p) => ({ kind: 'product' as const, id: p.id, name: p.name, line: 'Part', price: Number(p.price) })),
  ];
  const same = (a: Item | null, b: Item) => !!a && a.kind === b.kind && a.id === b.id;
  const shown = picked && !hits.some((h) => same(picked, h)) ? [picked, ...hits] : hits;
  const group = groups.find((g) => g.id === groupId);

  function save() {
    if (!picked) { setError(PICK); return; }
    const label = name.trim() === picked.name ? null : name.trim() || null;
    const words = label ?? picked.name;
    const opts = { inline: (w: string) => setError(w), done: onClose };
    if (start.id === null) {
      void run({ method: 'POST', path: '/api/quick-buttons', body: { groupId, ...itemBody(picked), label } }, {
        ...opts, text: `Saved · ${words} added to ${group?.name ?? ''}`, undo: (id) => ({ method: 'DELETE', path: `/api/quick-buttons/${id}` }),
      });
    } else {
      const back = { groupId: start.groupId, productId: null, serviceId: null, ...itemBody(start.item!), label: start.label ?? null, position: start.index };
      void run({ method: 'PUT', path: `/api/quick-buttons/${start.id}`, body: { groupId, productId: null, serviceId: null, ...itemBody(picked), label } }, {
        ...opts, undo: { method: 'PUT', path: `/api/quick-buttons/${start.id}`, body: back },
      });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="qb-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="qb-title">{start.id === null ? 'Add a quick button' : start.name}</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{`To the ${group?.name ?? ''} group`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <label className="flex min-h-12 items-center gap-2.5 rounded-lg border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3 text-[var(--wh-muted)]">
          <Search size={18} aria-hidden="true" />
          <input aria-label="Find a product or service" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 grow border-0 bg-transparent text-size-15 text-[var(--wh-ink)] outline-none" />
        </label>
        {error === PICK ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        {shown.length ? (
          <div className="flex flex-col gap-2">
            {shown.map((it) => {
              const on = same(picked, it);
              return (
                <button key={`${it.kind}-${it.id}`} type="button" aria-pressed={on}
                  onClick={() => { setPicked(it); if (!name.trim() || name === picked?.name) setName(it.name); setError(null); }}
                  className={`flex min-h-[52px] items-center gap-3 rounded-lg border px-3 text-left ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-surface-muted)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>
                  <span className="flex grow flex-col gap-px"><span className="text-size-15 font-semibold">{it.name}</span><span className="text-xs text-[var(--wh-muted)]">{it.line}</span></span>
                  <span className="font-[family-name:var(--wh-font-mono)] text-size-15">{poundsText(it.price)}</span>
                  {on ? <Check size={18} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qb-name" className="text-sm font-semibold">Name on the button</label>
          <input id="qb-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={INPUT} />
          <span className="text-size-13 text-[var(--wh-muted)]">The price always comes from the product.</span>
        </div>
        <div role="group" aria-label="Group" className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Group</span>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => <button key={g.id} type="button" aria-pressed={g.id === groupId} className={pill(g.id === groupId)} onClick={() => setGroupId(g.id)}>{g.name}</button>)}
          </div>
        </div>
        {error && error !== PICK ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>{start.id === null ? 'Add the button' : 'Save'}</Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Add a group, or right-click or long-press a pill to rename or remove it
 * (design 5 point 3; Customer groups' box). Removing a group with buttons
 * says how many and asks first.
 */
function GroupBox({ start, run, onClose, onAdded }: { start: { id: number | null; name: string }; run: ReturnType<typeof useQuickSave>; onClose: () => void; onAdded: (id: number) => void }) {
  const [name, setName] = useState(start.name);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const inline = (w: string, err: ApiError) => {
    const n = (err.body as { code?: string; count?: number } | null)?.code === 'has_buttons' ? (err.body as { count: number }).count : null;
    if (n !== null) setCount(n); else setError(w);
  };
  function save() {
    setError(null);
    if (start.id === null) {
      void run({ method: 'POST', path: '/api/quick-button-groups', body: { name } }, { inline, done: (id) => { onAdded(id); onClose(); }, undo: (id) => ({ method: 'DELETE', path: `/api/quick-button-groups/${id}` }) });
    } else {
      void run({ method: 'PUT', path: `/api/quick-button-groups/${start.id}`, body: { name } }, { inline, done: onClose, undo: { method: 'PUT', path: `/api/quick-button-groups/${start.id}`, body: { name: start.name } } });
    }
  }
  const remove = () => void run({ method: 'DELETE', path: `/api/quick-button-groups/${start.id}${count ? '?confirm=1' : ''}` }, { inline, done: onClose });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="qbg-title" className="md:max-w-[480px]">
      <DialogHeader><DialogTitle id="qbg-title">{start.id === null ? 'Add a group' : start.name}</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Name
          <input className={`${INPUT} text-base font-normal`} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        {count ? <p className="m-0 text-sm">{`${start.name} has ${count} button${count === 1 ? '' : 's'}. Removing the group removes ${count === 1 ? 'it' : 'them'} too.`}</p> : null}
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        {start.id !== null ? <Button variant="danger" onClick={remove}>{count ? 'Remove the group and its buttons' : 'Remove group'}</Button> : <span />}
        <span className="flex gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{start.id === null ? 'Add the group' : 'Save'}</Button>
        </span>
      </DialogFooter>
    </Dialog>
  );
}
