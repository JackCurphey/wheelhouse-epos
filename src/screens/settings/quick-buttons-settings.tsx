import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { ApiError, apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { poundsText } from '@/lib/money.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { useSavedNote } from './saved-note.tsx';

/**
 * Settings › Front desk › Till › Quick buttons (set-till-quick, set-till-quick-add,
 * set-till-quick-saved and set-till-empty in generator/setup.mjs;
 * openspec/changes/owner-setup-till-payments-eod, design 1 and 5): the shop's
 * groups as pills, each with a "…" menu to rename or remove it, and the chosen
 * group's buttons in till order, each with its name, line and price. Hover,
 * focus, right-click or long-press shows Edit and Remove; the handle moves a
 * button by drag or the arrow keys. Every change saves at once and shows
 * Settings' note (saved-note.tsx), with Undo, or a failed save kept here with
 * Try again; while a box is open, a failed save says so in the box. A
 * button's price is always its item's.
 */
type QuickButton = { id: number; groupId: number; productId: number | null; serviceId: number | null; label: string | null; name: string; itemName: string; kind: 'product' | 'service'; line: string; price: number; onSale: boolean };
type Group = { id: number; name: string; buttons: QuickButton[] };
type List = { groups: Group[] };
type Item = { kind: 'product' | 'service'; id: number; name: string; line: string; price: number };
type Req = { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: object };
type Editing = { id: number | null; groupId: number; item: Item | null; name: string; index?: number; label?: string | null };
type Back = () => HTMLElement | null;
type RunOptions = {
  text?: string; undo?: Req | ((id: number) => Req); kept?: (l: List) => List; back?: Back; done?: (id: number) => void;
  /** A box's own failure line; returning false leaves it to the note. */
  inline?: (words: string, err: unknown) => boolean | void;
  /** True while a later move waits, so its list isn't overwritten by this one's. */
  quiet?: () => boolean;
  /** What Try again does, in place of sending this one again (the moves still to send). */
  retry?: () => void;
};

const KEY = ['quick-buttons'];
const useQuickButtons = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<List>('/api/quick-buttons') });
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const PICK = 'Pick a product or service';
// A service's line as the till shows it (server/routes/quick-buttons.js serviceLine).
const serviceLine = (minutes: number | null) => (minutes ? `Labour · ${minutes} min` : 'Labour');
const pill = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`;
const INPUT = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';
const ALERT = 'm-0 text-sm font-semibold text-[var(--wh-danger-hover)]';
const itemOf = (b: QuickButton): Item => ({ kind: b.kind, id: (b.productId ?? b.serviceId)!, name: b.itemName, line: b.line, price: b.price });
const itemBody = (item: Item) => (item.kind === 'product' ? { productId: item.id } : { serviceId: item.id });
const withButtons = (l: List, groupId: number, fn: (b: QuickButton[]) => QuickButton[]) => ({ groups: l.groups.map((g) => (g.id === groupId ? { ...g, buttons: fn(g.buttons) } : g)) });
const find = (sel: string) => () => document.querySelector<HTMLElement>(sel);
const later = (fn: () => void) => setTimeout(fn, 0);

/** The fold's summary: the groups' names, as drawn, or "None yet" with no buttons at all (set-till-empty). */
export function useQuickButtonsSummary(): string {
  const groups = useQuickButtons().data?.groups;
  if (!Array.isArray(groups)) return '';
  return groups.some((g) => g.buttons?.length) ? groups.map((g) => g.name).join(', ') : 'None yet';
}

/**
 * Sends one change and shows the note. `kept` puts the change on screen
 * first, so a failed save stays here; the server's whole list then replaces it.
 */
function useQuickSave() {
  const queryClient = useQueryClient();
  const note = useSavedNote();
  async function run(req: Req, o: RunOptions = {}): Promise<boolean> {
    if (o.kept) queryClient.setQueryData<List>(KEY, (l) => l && o.kept!(l));
    if (!o.inline) note.busy(o.back);
    try {
      const res = await apiMutate<List & { id?: number }>(req.path, req.body ?? {}, { method: req.method });
      if (!o.quiet?.()) queryClient.setQueryData<List>(KEY, { groups: res.groups });
      o.done?.(res.id ?? 0);
      const undo = typeof o.undo === 'function' ? o.undo(res.id ?? 0) : o.undo;
      note.show({ text: o.text ?? 'Saved', back: o.back, action: undo ? { label: 'Undo', run: () => void run(undo, { back: o.back }) } : undefined });
      return true;
    } catch (err) {
      const retry = !(err instanceof ApiError) || err.status >= 500;
      // The server's own words for a refusal or its busy answer, as client.ts's serverSaid.
      const words = serverSaid(err) ? err.message : err instanceof ApiError ? SAVE_FAILED : NO_INTERNET;
      if (!retry) void queryClient.invalidateQueries({ queryKey: KEY });
      if (o.inline && o.inline(words, err) !== false) return false;
      note.show({ text: words, failed: true, back: o.back, action: retry ? { label: 'Try again', run: o.retry ?? (() => void run(req, o)) } : undefined });
      return false;
    }
  }
  return run;
}

export function QuickButtonsSettings() {
  const queryClient = useQueryClient();
  const list = useQuickButtons();
  const run = useQuickSave();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [groupBox, setGroupBox] = useState<{ id: number | null; name: string; thenButton?: boolean } | null>(null);
  const [groupMenu, setGroupMenu] = useState(false);
  const [removing, setRemoving] = useState<{ group: Group; count: number } | null>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef<number | null>(null);
  // Moves save one after another, so the server ends where the screen shows.
  // A move that fails stays first in line: the next move, or Try again, sends
  // it before the rest, so nothing on screen jumps back.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const toSend = useRef<{ req: Req; undo: Req; back: Back }[]>([]);
  const addGroupRef = useRef<HTMLButtonElement>(null);
  // After a group's box or menu: its "…" (the next group's, if it went), or + Add a group.
  const groupBack = () => moreRef.current ?? addGroupRef.current;
  const focusGroup = () => later(() => groupBack()?.focus());
  const groups = list.data?.groups ?? [];
  const chosen = groups.find((g) => g.id === chosenId) ?? groups[0];
  const handleAt = (i: number) => () => rowsRef.current?.querySelectorAll<HTMLElement>('[data-move]')[i] ?? find('[data-add-button]')();

  // From the list as it stands now, not as last drawn, so quick presses add up.
  function move(id: number, step: number | { to: number }) {
    const g = queryClient.getQueryData<List>(KEY)?.groups.find((x) => x.buttons.some((b) => b.id === id));
    if (!g) return;
    const from = g.buttons.findIndex((b) => b.id === id);
    const to = typeof step === 'number' ? from + step : step.to;
    if (to < 0 || to >= g.buttons.length || from === to) return;
    const b = g.buttons[from];
    const kept = (l: List) => withButtons(l, g.id, (bs) => { const n = bs.filter((x) => x.id !== id); n.splice(to, 0, b); return n; });
    queryClient.setQueryData<List>(KEY, (l) => l && kept(l));
    toSend.current.push({ req: { method: 'PUT', path: `/api/quick-buttons/${id}`, body: { position: to } }, back: find(`[data-move="${id}"]`), undo: { method: 'PUT', path: `/api/quick-buttons/${id}`, body: { position: from } } });
    sendMoves();
    // The handle keeps focus as its button moves, for the next arrow press.
    later(() => find(`[data-move="${id}"]`)()?.focus());
  }
  function sendMoves() {
    queue.current = queue.current.then(async () => {
      while (toSend.current.length) {
        const m = toSend.current[0];
        const ok = await run(m.req, {
          back: m.back, undo: m.undo, quiet: () => toSend.current.length > 1, retry: sendMoves,
          // Refused: the list is fetched again, so what's waiting goes.
          inline: (_w, err) => { if (err instanceof ApiError && err.status < 500) toSend.current = []; return false; },
        });
        if (!ok) return;
        toSend.current.shift();
      }
    });
  }
  const onKey = (b: QuickButton) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); move(b.id, e.key === 'ArrowUp' ? -1 : 1); }
  };
  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    if (dragging.current !== null) move(dragging.current, { to: i });
    dragging.current = null;
  };
  function remove(b: QuickButton, i: number, all: QuickButton[]) {
    setMenuId(null);
    void run({ method: 'DELETE', path: `/api/quick-buttons/${b.id}` }, {
      kept: (l) => withButtons(l, b.groupId, (bs) => bs.filter((x) => x.id !== b.id)),
      back: handleAt(i),
      undo: { method: 'POST', path: '/api/quick-buttons', body: { groupId: b.groupId, productId: b.productId, serviceId: b.serviceId, label: b.label, position: i } },
    });
    // The focus goes to the next row's handle (or the one before, or + Add a button), as Storage slots does.
    const next = all[i + 1] ?? all[i - 1];
    later(() => find(next ? `[data-move="${next.id}"]` : '[data-add-button]')()?.focus());
  }
  function removeGroup(g: Group) {
    setGroupMenu(false);
    focusGroup();
    void run({ method: 'DELETE', path: `/api/quick-button-groups/${g.id}` }, {
      back: groupBack,
      // A group with buttons asks first, saying how many.
      inline: (_w, err) => {
        const body = err instanceof ApiError ? err.body as { code?: string; count?: number } | null : null;
        if (body?.code !== 'has_buttons') return false;
        setRemoving({ group: g, count: body.count ?? 0 });
      },
    });
  }
  const addButton = () => (chosen ? setEditing({ id: null, groupId: chosen.id, item: null, name: '' }) : setGroupBox({ id: null, name: '', thenButton: true }));
  const add = <Button variant={chosen?.buttons.length ? 'default' : 'primary'} data-add-button onClick={addButton}>+ Add a button</Button>;

  if (list.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the quick buttons. Try again in a moment.</p>;
  if (!list.data) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div role="group" aria-label="Quick button groups" className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button key={g.id} type="button" aria-pressed={g.id === chosen?.id} className={pill(g.id === chosen?.id)}
              onClick={() => setChosenId(g.id)} onContextMenu={(e) => { e.preventDefault(); setChosenId(g.id); setGroupMenu(true); }}>{g.name}</button>
          ))}
          <button ref={addGroupRef} type="button" aria-pressed="false" className={pill(false)} onClick={() => setGroupBox({ id: null, name: '' })}>+ Add a group</button>
        </div>
        {chosen ? (
          <div className="relative ml-auto shrink-0">
            <button ref={moreRef} type="button" aria-label={`More for ${chosen.name}`} aria-haspopup="menu" aria-expanded={groupMenu} onClick={() => setGroupMenu(!groupMenu)}
              className={`inline-flex size-11 items-center justify-center rounded-lg border text-lg font-bold ${groupMenu ? 'border-[var(--wh-ink)] bg-[var(--wh-surface-muted)]' : 'border-[var(--wh-border)]'}`}>…</button>
            {groupMenu ? (
              <GroupMenu label={chosen.name} anchor={moreRef} onClose={(refocus) => { setGroupMenu(false); if (refocus) moreRef.current?.focus(); }}
                onRename={() => { setGroupMenu(false); setGroupBox({ id: chosen.id, name: chosen.name }); }} onRemove={() => removeGroup(chosen)} />
            ) : null}
          </div>
        ) : null}
      </div>
      {chosen?.buttons.length ? (
        <>
          <div ref={rowsRef} className="flex flex-col gap-2">
            {chosen.buttons.map((b, i, all) => (
              <Row key={b.id} b={b} pinned={menuId === b.id} onPin={() => setMenuId(b.id)} onKey={onKey(b)} onDrag={() => { dragging.current = b.id; }} onDrop={onDrop(i)}
                onEdit={() => setEditing({ id: b.id, groupId: b.groupId, item: itemOf(b), name: b.name, index: i, label: b.label })} onRemove={() => remove(b, i, all)} />
            ))}
          </div>
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            {add}
            <p className="m-0 text-sm text-[var(--wh-muted)]">Buttons show on the till in this order.</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2.5 rounded-[10px] border-2 border-dashed border-[var(--wh-border)] px-4 py-7 text-center">
          <span className="text-base font-bold">No quick buttons yet</span>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Add the things you sell most — they’ll show on the till, one tap each.</p>
          {add}
        </div>
      )}
      {editing ? (
        <ButtonBox start={editing} groups={groups} run={run} onClose={() => {
          // Only this box: a slow save finishing after Cancel leaves a newer box open.
          const mine = editing;
          setEditing((now) => (now === mine ? null : now));
          // Back to the button's Edit, or + Add a button.
          later(() => (find(`[data-edit="${mine.id}"]`)() ?? find('[data-add-button]')())?.focus());
        }} />
      ) : null}
      {groupBox ? (
        <GroupBox start={groupBox} run={run} back={groupBack} onClose={() => { const mine = groupBox; setGroupBox((now) => (now === mine ? null : now)); focusGroup(); }}
          onAdded={(id) => { setChosenId(id); if (groupBox.thenButton) setEditing({ id: null, groupId: id, item: null, name: '' }); }} />
      ) : null}
      {removing ? <RemoveGroupBox {...removing} run={run} back={groupBack} onClose={() => { const mine = removing; setRemoving((now) => (now === mine ? null : now)); focusGroup(); }} /> : null}
    </div>
  );
}

function Row({ b, pinned, onPin, onKey, onDrag, onDrop, onEdit, onRemove }: {
  b: QuickButton; pinned: boolean; onPin: () => void; onKey: (e: KeyboardEvent) => void; onDrag: () => void; onDrop: (e: DragEvent) => void; onEdit: () => void; onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  // Focus or a right-click keeps the row open until another row opens, so Tab
  // reaches Edit and Remove and the page doesn't shift under a tap elsewhere
  // (on a phone they take a line of their own).
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
          <button type="button" data-edit={b.id} aria-label={`Edit ${b.name}`} onClick={onEdit} className="min-h-11 px-3 text-sm font-semibold">Edit</button>
          <Button variant="danger" aria-label={`Remove ${b.name}`} onClick={onRemove}>Remove</Button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * A group's menu (design 5 point 3), drawn as the Tills "…" menu (sites.mjs
 * tillMenu, ms-tills) and working as the till's Serving menu (give-pin.tsx):
 * the first item takes the focus, the arrows, Home and End move it, Escape
 * or Tab closes back to "…", a click away closes. Move waits for Jack.
 */
function GroupMenu({ label, anchor, onClose, onRename, onRemove }: { label: string; anchor: RefObject<HTMLButtonElement | null>; onClose: (refocus: boolean) => void; onRename: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // Once, when it opens: the first item takes the focus.
  useEffect(() => {
    const t = later(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) close.current(false); };
    document.addEventListener('mousedown', away);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', away); };
  }, [anchor]);
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); items[(to + items.length) % items.length]?.focus(); }
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onClose(true); }
  }
  const item = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left text-size-15 font-semibold hover:bg-[var(--wh-hover)] focus-visible:bg-[var(--wh-hover)]';
  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKey}
      className="absolute top-12 right-0 z-40 flex w-[240px] max-w-[calc(100vw-32px)] flex-col gap-0.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1.5 shadow-[0_12px_32px_var(--wh-backdrop)]">
      <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={onRename}>Rename…</button>
      <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={onRemove}>Remove</button>
    </div>
  );
}

// The box's header as drawn (settings-frame.mjs popup): the title, a line under it, and a close.
function BoxHeader({ id, title, sub, onClose }: { id: string; title: string; sub?: string; onClose: () => void }) {
  return (
    <DialogHeader>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <DialogTitle id={id}>{title}</DialogTitle>
        {sub ? <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span> : null}
      </span>
      <DialogClose onClick={onClose} />
    </DialogHeader>
  );
}

/** Add a quick button (set-till-quick-add), and Edit's box: the same, filled in, with Save (design 5 point 2). */
function ButtonBox({ start, groups, run, onClose }: { start: Editing; groups: Group[]; run: ReturnType<typeof useQuickSave>; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Item | null>(start.item);
  const [name, setName] = useState(start.name);
  const [groupId, setGroupId] = useState(start.groupId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function save() {
    if (!picked) { setError(PICK); return; }
    const label = name.trim() === picked.name ? null : name.trim() || null;
    // A failure says so here, in front of the box's backdrop, not in the note behind it.
    const opts = { inline: (w: string) => setError(w), done: onClose };
    setError(null);
    setBusy(true);
    if (start.id === null) {
      await run({ method: 'POST', path: '/api/quick-buttons', body: { groupId, ...itemBody(picked), label } }, {
        ...opts, text: `Saved · ${label ?? picked.name} added to ${group?.name ?? ''}`,
        back: find('[data-add-button]'), undo: (id) => ({ method: 'DELETE', path: `/api/quick-buttons/${id}` }),
      });
    } else {
      const back = { groupId: start.groupId, productId: null, serviceId: null, ...itemBody(start.item!), label: start.label ?? null, position: start.index };
      await run({ method: 'PUT', path: `/api/quick-buttons/${start.id}`, body: { groupId, productId: null, serviceId: null, ...itemBody(picked), label } }, {
        ...opts, back: find(`[data-move="${start.id}"]`), undo: { method: 'PUT', path: `/api/quick-buttons/${start.id}`, body: back },
      });
    }
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="qb-title" className="md:max-w-[520px]">
      <BoxHeader id="qb-title" title={start.id === null ? 'Add a quick button' : start.name} sub={`To the ${group?.name ?? ''} group`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <label className="flex min-h-12 items-center gap-2.5 rounded-lg border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3 text-[var(--wh-muted)]">
          <Search size={18} aria-hidden="true" />
          <input aria-label="Find a product or service" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 grow border-0 bg-transparent text-size-15 text-[var(--wh-ink)] outline-none" />
        </label>
        {error === PICK ? <p role="alert" className={ALERT}>{error}</p> : null}
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
        {error && error !== PICK ? <p role="alert" className={ALERT}>{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>{start.id === null ? 'Add the button' : 'Save'}</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Add a group, or rename one from its menu (design 5 point 3; Customer groups' box, "Edit [name]"). */
function GroupBox({ start, run, back, onClose, onAdded }: { start: { id: number | null; name: string }; run: ReturnType<typeof useQuickSave>; back: Back; onClose: () => void; onAdded: (id: number) => void }) {
  const [name, setName] = useState(start.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setError(null);
    setBusy(true);
    const inline = (w: string) => setError(w);
    if (start.id === null) {
      await run({ method: 'POST', path: '/api/quick-button-groups', body: { name } }, { inline, back, done: (id) => { onAdded(id); onClose(); }, undo: (id) => ({ method: 'DELETE', path: `/api/quick-button-groups/${id}` }) });
    } else {
      await run({ method: 'PUT', path: `/api/quick-button-groups/${start.id}`, body: { name } }, { inline, back, done: onClose, undo: { method: 'PUT', path: `/api/quick-button-groups/${start.id}`, body: { name: start.name } } });
    }
    setBusy(false);
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="qbg-title" className="md:max-w-[480px]">
      <BoxHeader id="qbg-title" title={start.id === null ? 'Add a group' : `Edit ${start.name}`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Name
          <input className={`${INPUT} text-base font-normal`} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        {error ? <p role="alert" className={ALERT}>{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>{start.id === null ? 'Add the group' : 'Save'}</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Removing a group that still has buttons asks first, saying how many (design 5 point 3). */
function RemoveGroupBox({ group, count, run, back, onClose }: { group: Group; count: number; run: ReturnType<typeof useQuickSave>; back: Back; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    await run({ method: 'DELETE', path: `/api/quick-button-groups/${group.id}?confirm=1` }, { inline: (w) => setError(w), back, done: onClose });
    setBusy(false);
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="qbr-title" className="md:max-w-[480px]">
      <BoxHeader id="qbr-title" title={`Remove ${group.name}?`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <p role="alert" className="m-0 text-sm">{`${group.name} has ${count} button${count === 1 ? '' : 's'}. Removing the group removes ${count === 1 ? 'it' : 'them'} too.`}</p>
        {error ? <p role="alert" className={ALERT}>{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={() => void remove()}>Remove the group and its buttons</Button>
      </DialogFooter>
    </Dialog>
  );
}
