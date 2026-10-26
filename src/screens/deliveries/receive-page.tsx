import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Back, Card, Page, Row, Tag, type Order, type OrderItem } from './deliveries-bits.tsx';
import { Count, useSearch } from './new-order.tsx';

/**
 * Receive a delivery (rs-receive, rs-problem in receiving.mjs; receiving
 * decisions 2, 3, 4 and 9; openspec/changes/receive-delivery and
 * receive-without-order): pick the supplier it's from if you like, scan each
 * item (each scan adds one, a count can be typed), mark anything wrong, then
 * Book in. A product still to come on the supplier's orders counts against
 * its line; any other is "not on an order". Open to everyone. Frame numbers,
 * a job waiting for a part and Add this product come later.
 */
type Product = { id: number; sku: string | null; barcode: string | null; name: string };
type Supplier = { id: number; name: string };
type Kind = 'damaged' | 'wrong_item' | 'missing';
type Problem = { kind: Kind; qty: number; note: string };
// A scanned line: on an order (`itemId`) or not on an order.
type Scanned = { key: string; itemId?: number; productId: number; name: string; sku: string | null; qty: number; problems: Problem[] };
type Booked = { booked: number; orders: Order[] };

const KINDS: { value: Kind; label: string }[] = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'missing', label: 'Missing' },
];
const label = (k: Kind) => KINDS.find((x) => x.value === k)!.label;
// The drawing's note for each (PROBLEM_NOTE in receiving.mjs).
const KIND_NOTE: Record<Kind, string> = {
  damaged: 'Damaged items aren’t added to stock. They go on “To return to [Supplier]” in Deliveries and orders until they’re sent back.',
  wrong_item: 'Wrong items aren’t added to stock. They go on “To return to [Supplier]” in Deliveries and orders until they’re sent back.',
  missing: 'Missing items stay “to come” on the order.',
};
const AWAITING = ['ordered', 'partially_received'];
const PILLS = 3;
// Damaged and wrong items are set aside; missing ones never arrived.
const setAside = (s: Scanned) => s.problems.filter((p) => p.kind !== 'missing').reduce((n, p) => n + p.qty, 0);
const missing = (s: Scanned) => s.problems.filter((p) => p.kind === 'missing').reduce((n, p) => n + p.qty, 0);
const problemText = (p: Problem) => (p.kind === 'missing' ? `Missing · ${p.qty}` : `${label(p.kind)} · ${p.qty}, set aside`);

export function ReceivePage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: () => apiGet<Order[]>('/api/purchase-orders') });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => apiGet<Supplier[]>('/api/suppliers') });
  const asked = params.get('order');
  // The supplier: undefined until suppliers and orders first load, then set
  // once, so a refresh of the orders can't move it mid-delivery (review, 26 Oct).
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const [allIn, setAllIn] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState(false);
  const [text, setText] = useState('');
  const [scanned, setScanned] = useState<Scanned[]>([]);
  const [said, setSaid] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const matches = useSearch(text);

  const awaiting = (orders.data ?? []).filter((o) => AWAITING.includes(o.status));
  const askedOrder = asked === null ? undefined : awaiting.find((o) => String(o.id) === asked);
  // Set during render, React's pattern for state that follows loaded data.
  if (chosen === undefined && orders.data && suppliers.data) {
    const waiting = orders.data.filter((o) => AWAITING.includes(o.status));
    const wanted = asked === null ? undefined : waiting.find((o) => String(o.id) === asked);
    // An order asked for that isn't waiting (all in, or a draft) picks
    // nothing, so the person chooses (receive-delivery's second review).
    // Otherwise the asked order's supplier, or the supplier with the newest
    // order still to come; with none, none ("pick the supplier if you like").
    const newest = [...waiting].sort((a, b) => b.id - a.id)[0];
    const notWaiting = asked !== null && !wanted;
    setAllIn(notWaiting);
    setChosen(notWaiting ? null : wanted ? String(wanted.supplierId) : newest ? String(newest.supplierId) : null);
  }
  const supplierId = chosen ?? null;
  // The supplier's orders still to come: the one asked for first, then oldest first.
  const supplierOrders = awaiting.filter((o) => String(o.supplierId) === supplierId)
    .sort((a, b) => (askedOrder?.id === b.id ? 1 : 0) - (askedOrder?.id === a.id ? 1 : 0) || a.id - b.id);
  const orderLines = supplierOrders.flatMap((o) => o.items);
  // Suppliers as pills: the newest order still to come first, then by name
  // (as the server sends them); three, then Other… (New order's pattern).
  const newestOf = (s: Supplier) => Math.max(0, ...awaiting.filter((o) => o.supplierId === s.id).map((o) => o.id));
  const sorted = [...(suppliers.data ?? [])].sort((a, b) => newestOf(b) - newestOf(a));
  const shown = allSuppliers || sorted.findIndex((s) => String(s.id) === supplierId) >= PILLS ? sorted : sorted.slice(0, PILLS);
  const scannedOf = (key: string) => scanned.find((s) => s.key === key);
  const lineOf = (itemId: number | undefined) => (itemId === undefined ? undefined : orderLines.find((it) => it.id === itemId));
  // A refresh that finds a scanned line's order all in, or the line with
  // nothing left to come (booked in elsewhere), turns it into a line not on
  // an order, keeping its count and problems, so Book in isn't refused
  // again and again (review, 26 Oct).
  // Checked whenever the orders come back, during render as above.
  const [seenOrders, setSeenOrders] = useState(orders.data);
  if (orders.data !== seenOrders) {
    setSeenOrders(orders.data);
    const next = offOrder(scanned, new Map(orderLines.map((it) => [it.id, it.outstanding])));
    if (next !== scanned) setScanned(next);
  }

  function pick(id: string) {
    // The list belongs to one supplier's delivery (logged: changing From clears it).
    setChosen(id);
    setAllIn(false);
    setScanned([]);
    setSaid('');
    setProblem(null);
  }

  function add(key: string, s: Omit<Scanned, 'key' | 'qty' | 'problems'>) {
    setScanned((ss) => (ss.some((x) => x.key === key) ? ss.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) : [...ss, { key, ...s, qty: 1, problems: [] }]));
  }

  function take(p: Product) {
    setText('');
    setProblem(null);
    const lines = orderLines.filter((it) => it.productId === p.id);
    if (lines.length === 0) {
      // Not on any order still to come from this supplier: booked in as it is.
      add(`p${p.id}`, { productId: p.id, name: p.name, sku: p.sku });
      setSaid(`Added ${p.name} · 1`);
      return;
    }
    const counted = (it: OrderItem) => { const s = scannedOf(`i${it.id}`); return s ? s.qty + missing(s) : 0; };
    const line = lines.find((it) => counted(it) < it.outstanding);
    if (!line) {
      const all = lines.reduce((n, it) => n + it.outstanding, 0);
      setSaid(`All ${all} ${p.name} still to come are counted`);
      return;
    }
    add(`i${line.id}`, { itemId: line.id, productId: p.id, name: line.name, sku: line.sku });
    setSaid(`Added ${p.name} · 1`);
  }

  // A scanner types the code and presses Enter at once, so Enter looks it up
  // itself: an exact barcode or code, or the only match.
  async function onEnter() {
    const code = text.trim();
    if (!code) return;
    let found: Product[];
    try {
      found = await apiGet<Product[]>(`/api/products?${new URLSearchParams({ search: code })}`);
    } catch {
      setProblem('Wheelhouse couldn’t look that up. Try again in a moment.');
      return;
    }
    const lc = code.toLowerCase();
    const exact = found.find((p) => [p.barcode, p.sku].some((v) => v && v.toLowerCase() === lc));
    const one = exact ?? (found.length === 1 ? found[0] : undefined);
    if (one) take(one);
    else if (found.length === 0) { setText(''); setSaid(`Nothing in Wheelhouse has the barcode ${code}`); }
  }

  const setQty = (key: string, qty: number) => setScanned((ss) => ss.map((s) => (s.key === key && qty >= Math.max(1, setAside(s)) ? { ...s, qty } : s)));
  const remove = (key: string) => setScanned((ss) => ss.filter((s) => s.key !== key || s.problems.length > 0));
  const toBook = scanned.reduce((n, s) => n + s.qty - setAside(s), 0);
  const asideAll = scanned.reduce((n, s) => n + setAside(s), 0);

  async function bookIn() {
    setBusy(true);
    setProblem(null);
    try {
      const done = await apiMutate<Booked>('/api/deliveries/receive', {
        supplierId: supplierId === null ? null : Number(supplierId),
        items: scanned.filter((s) => s.qty - setAside(s) > 0)
          .map((s) => (s.itemId !== undefined ? { productId: s.productId, itemId: s.itemId, qty: s.qty - setAside(s) } : { productId: s.productId, qty: s.qty - setAside(s) })),
        problems: scanned.flatMap((s) => s.problems.map((p) => (s.itemId !== undefined ? { itemId: s.itemId, ...p } : { productId: s.productId, ...p }))),
      });
      // Stay on this supplier: once its orders are all in, nothing is left
      // still to come, rather than moving on to another.
      setChosen(supplierId);
      for (const next of done.orders) queryClient.setQueryData(['purchase-order', next.id], next);
      queryClient.setQueryData<Order[]>(['purchase-orders'], (os) => os?.map((o) => done.orders.find((n) => n.id === o.id) ?? o));
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setScanned([]);
      setSaid(`${toBook} items booked in · stock updated`);
    } catch (err) {
      // A refusal is usually counts that moved on: show the server's.
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t book the delivery in. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const marked = marking === null ? null : scannedOf(marking);
  const saidLine = <p role="status" className="m-0 min-h-5 text-sm text-[var(--wh-muted)]">{said}</p>;
  const failed = orders.isError || suppliers.isError;
  return (
    <Page>
      <Back />
      <Card id="t-scan-the-box" title="Scan the box">
        {failed ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the suppliers and orders. Try again in a moment.</p>
          : !orders.data || !suppliers.data || chosen === undefined ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : (
            <>
              {sorted.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No suppliers yet.</p> : (
                <div className="flex flex-wrap items-end gap-2">
                  <PillGroup legend="From" value={supplierId} onChange={pick} options={shown.map((s) => ({ value: String(s.id), label: s.name }))} />
                  {shown.length < sorted.length ? <Button variant="default" onClick={() => setAllSuppliers(true)}>Other…</Button> : null}
                  <span className="pb-3 text-size-13 text-[var(--wh-muted)]">Shows what’s still to come on its orders</span>
                </div>
              )}
              {allIn ? <p className="m-0 text-sm text-[var(--wh-muted)]">This order is all in.</p> : null}
              <div className="relative">
                <label className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
                  <NavIcon name="search" size={20} />
                  <input type="search" aria-label="Scan a barcode, or type to search" placeholder="Scan a barcode, or type to search" value={text}
                    aria-controls="rs-matches" aria-expanded={matches.length > 0}
                    onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onEnter(); } }}
                    className="min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)] focus:outline-none" />
                </label>
                {matches.length > 0 ? (
                  <ul id="rs-matches" role="listbox" aria-label="Matching products" className="m-0 mt-1 list-none rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
                    {matches.slice(0, 8).map((p) => (
                      <li key={p.id} role="option" aria-selected="false" tabIndex={-1} onClick={() => take(p)}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-[var(--wh-border)] px-3 first:border-t-0 hover:bg-[var(--wh-hover)]">
                        <span className="text-size-15 font-semibold">{p.name}</span>
                        <span className="text-size-13 text-[var(--wh-muted)]">{p.sku}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {saidLine}
              {scanned.length > 0 ? (
                <ul aria-label="Scanned" className="m-0 list-none p-0">
                  {scanned.map((s) => {
                    const it = lineOf(s.itemId);
                    return (
                      <Row key={s.key} title={s.name}
                        sub={<>{`${s.sku ? `${s.sku} · ` : ''}${it ? `on your order: ${it.outstanding}` : 'not on an order'}`}{s.problems.map((p) => <strong key={p.kind} className="text-[var(--wh-warn-ink)]">{` · ${problemText(p)}`}</strong>)}</>}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <Count name={s.name} value={s.qty} max={it ? it.outstanding - missing(s) : undefined} onChange={(n) => setQty(s.key, n)} onBelowOne={() => remove(s.key)} />
                          <button type="button" aria-label={`Problem with ${s.name}`} onClick={() => setMarking(s.key)}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">Problem?</button>
                        </span>
                      </Row>
                    );
                  })}
                </ul>
              ) : null}
              <StillToCome lines={orderLines} scanned={scanned} />
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                <span className="text-sm text-[var(--wh-muted)]">{`${toBook} items to book in${asideAll ? ` · ${asideAll} set aside` : ''}`}</span>
                <Button variant="accent" disabled={busy || scanned.length === 0} onClick={() => void bookIn()}>{`Book in ${toBook} items`}</Button>
              </div>
              {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
            </>
          )}
      </Card>
      {marked ? (
        <SomethingWrong key={marked.key} line={lineOf(marked.itemId)} scanned={marked}
          onCancel={() => setMarking(null)}
          onMark={(p) => {
            setScanned((ss) => ss.map((s) => (s.key === marked.key ? { ...s, problems: [...s.problems.filter((x) => x.kind !== p.kind), p] } : s)));
            setMarking(null);
          }}
          onUnmark={(kind) => {
            setScanned((ss) => ss.map((s) => (s.key === marked.key ? { ...s, problems: s.problems.filter((x) => x.kind !== kind) } : s)));
            setMarking(null);
          }} />
      ) : null}
    </Page>
  );
}

/**
 * Scanned lines with their order line gone from what's still to come (the
 * order all in) or with nothing left to come on it become lines not on an
 * order, merged with any for the same product; Missing goes, as it's only
 * for an order. Returns the same list when nothing changes.
 */
function offOrder(ss: Scanned[], open: Map<number, number>): Scanned[] {
  const gone = (s: Scanned) => s.itemId !== undefined && !((open.get(s.itemId) ?? 0) > 0);
  if (!ss.some(gone)) return ss;
  const out: Scanned[] = [];
  for (const s of ss) {
    const moved = gone(s) ? { ...s, key: `p${s.productId}`, itemId: undefined, problems: s.problems.filter((p) => p.kind !== 'missing') } : s;
    const i = out.findIndex((x) => x.key === moved.key);
    if (i < 0) { out.push(moved); continue; }
    const same = out[i];
    const problems = [...same.problems];
    for (const p of moved.problems) {
      const j = problems.findIndex((x) => x.kind === p.kind);
      if (j < 0) problems.push(p);
      else problems[j] = { ...problems[j], qty: problems[j].qty + p.qty, note: problems[j].note || p.note };
    }
    out[i] = { ...same, qty: same.qty + moved.qty, problems };
  }
  return out;
}

/** Still to come on the order: each line of the supplier's orders with something not yet scanned. */
function StillToCome({ lines: all, scanned }: { lines: OrderItem[]; scanned: Scanned[] }) {
  const left = (it: OrderItem) => it.outstanding - (scanned.find((s) => s.itemId === it.id)?.qty ?? 0);
  const lines = all.filter((it) => left(it) > 0);
  if (lines.length === 0) return null;
  return (
    <>
      <h3 id="t-still-to-come" className="m-0 mt-1.5 text-size-15 font-bold">Still to come on the order</h3>
      <ul aria-label="Still to come on the order" className="m-0 list-none p-0">
        {lines.map((it) => (
          <Row key={it.id} title={it.name} sub={`${it.sku ? `${it.sku} · ` : ''}ordered ${it.qtyOrdered}, arrived ${it.qtyReceived}`}>
            <Tag>{`${left(it)} to come`}</Tag>
          </Row>
        ))}
      </ul>
    </>
  );
}

/**
 * Something wrong? (rs-problem; decision 9): Damaged, Wrong item or Missing,
 * how many and a note. Damaged and wrong come out of what was scanned;
 * missing ones are on top of it, up to what's still to come, and offered only
 * on an order's line (the drawing's note: "offered only when there's an
 * order"). A kind already marked opens on its count and note, and − at 1
 * takes it off, as − at 1 takes a scanned line off (second review).
 */
function SomethingWrong({ line, scanned, onCancel, onMark, onUnmark }: { line: OrderItem | undefined; scanned: Scanned; onCancel: () => void; onMark: (p: Problem) => void; onUnmark: (kind: Kind) => void }) {
  const markedAs = (k: Kind) => scanned.problems.find((p) => p.kind === k);
  const kinds = line ? KINDS : KINDS.filter((k) => k.value !== 'missing');
  const [kind, setKindState] = useState<Kind>('damaged');
  const [note, setNote] = useState(markedAs('damaged')?.note ?? '');
  const others = scanned.problems.filter((p) => p.kind !== kind);
  const max = kind === 'missing'
    ? (line?.outstanding ?? 0) - scanned.qty - others.filter((p) => p.kind === 'missing').reduce((n, p) => n + p.qty, 0)
    : scanned.qty - others.filter((p) => p.kind !== 'missing').reduce((n, p) => n + p.qty, 0);
  const [qty, setQty] = useState(markedAs('damaged')?.qty ?? 1);
  const n = Math.min(qty, max);
  function setKind(k: Kind) {
    setKindState(k);
    const was = markedAs(k);
    if (was) { setQty(was.qty); setNote(was.note); }
  }
  const already = markedAs(kind);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }} aria-labelledby="pb-title">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="pb-title">Something wrong?</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{`${scanned.name} · ${scanned.sku ? `${scanned.sku} · ` : ''}${scanned.qty} scanned`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <PillGroup legend="What’s wrong" value={kind} onChange={(v) => setKind(v as Kind)} options={kinds} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-size-15 font-semibold">How many</span>
          {max >= 1 ? <Count name={label(kind).toLowerCase()} value={Math.max(1, n)} max={max} onChange={setQty} onBelowOne={already ? () => onUnmark(kind) : undefined} /> : <span className="text-sm text-[var(--wh-muted)]">0</span>}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Note (optional)
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{KIND_NOTE[kind]}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="default" onClick={onCancel}>Cancel</Button>
        <Button variant="accent" disabled={max < 1} onClick={() => onMark({ kind, qty: Math.max(1, n), note: note.trim() })}>{`Mark as ${label(kind).toLowerCase()}`}</Button>
      </DialogFooter>
    </Dialog>
  );
}
