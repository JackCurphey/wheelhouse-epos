import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Back, Card, Page, Row, Tag, day, type Order, type OrderItem } from './deliveries-bits.tsx';
import { Count, useSearch } from './new-order.tsx';

/**
 * Receive a delivery (rs-receive, rs-problem in receiving.mjs; receiving
 * decisions 3, 4 and 9; openspec/changes/receive-delivery design 1–8):
 * pick the order it's from, scan each item (each scan adds one, a count can
 * be typed), mark anything wrong, then Book in. Open to everyone. Against an
 * order only for now: receiving without one, frame numbers, a job waiting
 * for a part and Add this product come later.
 */
type Product = { id: number; sku: string | null; barcode: string | null; name: string };
type Kind = 'damaged' | 'wrong_item' | 'missing';
type Problem = { kind: Kind; qty: number; note: string };
type Scanned = { itemId: number; qty: number; problems: Problem[] };

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
// Damaged and wrong items are set aside; missing ones never arrived.
const setAside = (s: Scanned) => s.problems.filter((p) => p.kind !== 'missing').reduce((n, p) => n + p.qty, 0);
const missing = (s: Scanned) => s.problems.filter((p) => p.kind === 'missing').reduce((n, p) => n + p.qty, 0);
const problemText = (p: Problem) => (p.kind === 'missing' ? `Missing · ${p.qty}` : `${label(p.kind)} · ${p.qty}, set aside`);

export function ReceivePage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: () => apiGet<Order[]>('/api/purchase-orders') });
  const [picked, setPicked] = useState<string | null>(params.get('order'));
  const [text, setText] = useState('');
  const [scanned, setScanned] = useState<Scanned[]>([]);
  const [said, setSaid] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const matches = useSearch(text);

  // Newest first, as the hub lists them.
  const awaiting = (orders.data ?? []).filter((o) => AWAITING.includes(o.status)).sort((a, b) => b.id - a.id);
  // The newest when none was asked for. One asked for that isn't waiting (all
  // in, or a draft) picks nothing, so the person chooses (second review).
  const allIn = picked !== null && !awaiting.some((o) => String(o.id) === picked);
  const order = allIn ? undefined : awaiting.find((o) => String(o.id) === picked) ?? awaiting[0];
  const twice = (o: Order) => awaiting.filter((x) => x.supplierId === o.supplierId).length > 1;
  const scannedOf = (itemId: number) => scanned.find((s) => s.itemId === itemId);
  const lineOf = (itemId: number) => order?.items.find((it) => it.id === itemId);
  const missingOf = (itemId: number) => { const s = scannedOf(itemId); return s ? missing(s) : 0; };

  function pick(id: string) {
    // The list belongs to one order (logged: changing From clears it).
    setPicked(id);
    setScanned([]);
    setSaid('');
    setProblem(null);
  }

  function take(p: Product) {
    setText('');
    setProblem(null);
    if (!order) return;
    const lines = order.items.filter((it) => it.productId === p.id);
    if (lines.length === 0) { setSaid(`${p.name} isn’t on this order`); return; }
    const line = lines.find((it) => (scannedOf(it.id)?.qty ?? 0) + missingOf(it.id) < it.outstanding);
    if (!line) {
      const all = lines.reduce((n, it) => n + it.outstanding, 0);
      setSaid(`All ${all} ${p.name} still to come are counted`);
      return;
    }
    setScanned((ss) => (ss.some((s) => s.itemId === line.id) ? ss.map((s) => (s.itemId === line.id ? { ...s, qty: s.qty + 1 } : s)) : [...ss, { itemId: line.id, qty: 1, problems: [] }]));
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

  const setQty = (itemId: number, qty: number) => setScanned((ss) => ss.map((s) => (s.itemId === itemId && qty >= Math.max(1, setAside(s)) ? { ...s, qty } : s)));
  const remove = (itemId: number) => setScanned((ss) => ss.filter((s) => s.itemId !== itemId || s.problems.length > 0));
  const toBook = scanned.reduce((n, s) => n + s.qty - setAside(s), 0);
  const asideAll = scanned.reduce((n, s) => n + setAside(s), 0);

  async function bookIn() {
    if (!order) return;
    setBusy(true);
    setProblem(null);
    try {
      const next = await apiMutate<Order>(`/api/purchase-orders/${order.id}/receive`, {
        items: scanned.filter((s) => s.qty - setAside(s) > 0).map((s) => ({ itemId: s.itemId, qtyReceived: s.qty - setAside(s) })),
        problems: scanned.flatMap((s) => s.problems.map((p) => ({ itemId: s.itemId, ...p }))),
      });
      // Stay on this order: once it's all in, the page says so rather than
      // moving on to the next one.
      setPicked(String(next.id));
      queryClient.setQueryData(['purchase-order', next.id], next);
      queryClient.setQueryData<Order[]>(['purchase-orders'], (os) => os?.map((o) => (o.id === next.id ? next : o)));
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
  const markedLine = marking === null ? undefined : lineOf(marking);
  const from = (value: string | null) => (
    <div className="flex flex-wrap items-end gap-2">
      <PillGroup legend="From" value={value} onChange={pick}
        options={awaiting.map((o) => ({ value: String(o.id), label: twice(o) && o.orderedAt ? `${o.supplierName} · ordered ${day(o.orderedAt)}` : o.supplierName }))} />
      <span className="pb-3 text-size-13 text-[var(--wh-muted)]">Shows what’s still to come on its orders</span>
    </div>
  );
  const saidLine = <p role="status" className="m-0 min-h-5 text-sm text-[var(--wh-muted)]">{said}</p>;
  return (
    <Page>
      <Back />
      <Card id="t-scan-the-box" title="Scan the box">
        {orders.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the orders. Try again in a moment.</p>
          : !orders.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : allIn ? (
            <>
              {awaiting.length > 0 ? from(null) : null}
              <p className="m-0 text-sm text-[var(--wh-muted)]">This order is all in.</p>
              {saidLine}
            </>
          )
          : !order ? <p className="m-0 text-sm text-[var(--wh-muted)]">No orders are waiting for a delivery.</p>
          : (
            <>
              {from(String(order.id))}
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
                    const it = lineOf(s.itemId)!;
                    return (
                      <Row key={s.itemId} title={it.name}
                        sub={<>{`${it.sku ? `${it.sku} · ` : ''}on your order: ${it.outstanding}`}{s.problems.map((p) => <strong key={p.kind} className="text-[var(--wh-warn-ink)]">{` · ${problemText(p)}`}</strong>)}</>}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <Count name={it.name} value={s.qty} max={it.outstanding - missing(s)} onChange={(n) => setQty(s.itemId, n)} onBelowOne={() => remove(s.itemId)} />
                          <button type="button" aria-label={`Problem with ${it.name}`} onClick={() => setMarking(s.itemId)}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">Problem?</button>
                        </span>
                      </Row>
                    );
                  })}
                </ul>
              ) : null}
              <StillToCome order={order} scanned={scanned} />
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                <span className="text-sm text-[var(--wh-muted)]">{`${toBook} items to book in${asideAll ? ` · ${asideAll} set aside` : ''}`}</span>
                <Button variant="accent" disabled={busy || scanned.length === 0} onClick={() => void bookIn()}>{`Book in ${toBook} items`}</Button>
              </div>
              {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
            </>
          )}
      </Card>
      {marked && markedLine ? (
        <SomethingWrong key={marked.itemId} line={markedLine} scanned={marked}
          onCancel={() => setMarking(null)}
          onMark={(p) => {
            setScanned((ss) => ss.map((s) => (s.itemId === marked.itemId ? { ...s, problems: [...s.problems.filter((x) => x.kind !== p.kind), p] } : s)));
            setMarking(null);
          }}
          onUnmark={(kind) => {
            setScanned((ss) => ss.map((s) => (s.itemId === marked.itemId ? { ...s, problems: s.problems.filter((x) => x.kind !== kind) } : s)));
            setMarking(null);
          }} />
      ) : null}
    </Page>
  );
}

/** Still to come on the order: each line with something not yet scanned. */
function StillToCome({ order, scanned }: { order: Order; scanned: Scanned[] }) {
  const left = (it: OrderItem) => it.outstanding - (scanned.find((s) => s.itemId === it.id)?.qty ?? 0);
  const lines = order.items.filter((it) => left(it) > 0);
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
 * missing ones are on top of it, up to what's still to come. A kind already
 * marked opens on its count and note, and − at 1 takes it off, as − at 1
 * takes a scanned line off (second review: undoing a mistake).
 */
function SomethingWrong({ line, scanned, onCancel, onMark, onUnmark }: { line: OrderItem; scanned: Scanned; onCancel: () => void; onMark: (p: Problem) => void; onUnmark: (kind: Kind) => void }) {
  const markedAs = (k: Kind) => scanned.problems.find((p) => p.kind === k);
  const [kind, setKindState] = useState<Kind>('damaged');
  const [note, setNote] = useState(markedAs('damaged')?.note ?? '');
  const others = scanned.problems.filter((p) => p.kind !== kind);
  const max = kind === 'missing'
    ? line.outstanding - scanned.qty - others.filter((p) => p.kind === 'missing').reduce((n, p) => n + p.qty, 0)
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
          <span className="text-size-13 text-[var(--wh-muted)]">{`${line.name} · ${line.sku ? `${line.sku} · ` : ''}${scanned.qty} scanned`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <PillGroup legend="What’s wrong" value={kind} onChange={(v) => setKind(v as Kind)} options={KINDS} />
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
