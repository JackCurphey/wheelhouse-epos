import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Back, Card, ONLY_OWNER, Page, money, mono, orderHref, type Order } from './deliveries-bits.tsx';

/**
 * New order (rs-order in receiving.mjs; receiving decision 2, audit H2 and
 * M8; openspec/changes/deliveries-orders design 3): the supplier as pills,
 * products scanned or searched for, each line's count and cost, the total,
 * then Save as draft or Mark as ordered.
 */
type Supplier = { id: number; name: string };
type Product = { id: number; sku: string | null; barcode: string | null; name: string; cost: number | null };
// `typed` is a cost typed for a product with none recorded.
type Line = { product: Product; qty: number; typed: string };
const PILLS = 3;
// The most a line can order: the server refuses more (review of 26 Oct).
const MAX_COUNT = 100000;
// Whole pence, so 3 × £1.10 is £3.30 and not £3.3000000000000003.
const pence = (pounds: number) => Math.round(pounds * 100);
// No cost recorded (null, or 0 as the old app saves it) is no cost, as on the
// stock list (review of 26 Oct): the line takes a typed one instead.
const recorded = (p: Product) => (p.cost !== null && p.cost > 0 ? p.cost : null);
const typedCost = (typed: string) => {
  const n = Number(typed.trim());
  return typed.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
/** The line's cost each: the product's, else a good typed one, else none. */
const costOf = (l: Line) => recorded(l.product) ?? typedCost(l.typed);

/** A count: type it, or step it with − and + (audit H2). Repeated buttons name their row. */
export function Count({ name, value, onChange }: { name: string; value: number; onChange: (n: number) => void }) {
  const step = 'size-11 shrink-0 border-0 bg-[var(--wh-panel)] text-xl text-[var(--wh-ink)]';
  return (
    <span role="group" aria-label={name} className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-[var(--wh-border)]">
      <button type="button" aria-label={`One fewer: ${name}`} className={step} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <input inputMode="numeric" aria-label={`How many: ${name}`} value={String(value)}
        onChange={(e) => { const n = Math.trunc(Number(e.target.value)); if (n >= 1) onChange(Math.min(MAX_COUNT, n)); }}
        className={`h-11 w-[52px] border-x border-y-0 border-[var(--wh-border)] bg-[var(--wh-panel)] text-center text-size-15 ${mono}`} />
      <button type="button" aria-label={`One more: ${name}`} className={step} onClick={() => onChange(Math.min(MAX_COUNT, value + 1))}>+</button>
    </span>
  );
}

function useSearch(text: string) {
  const [asked, setAsked] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAsked(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);
  const found = useQuery({ queryKey: ['po-products', asked], queryFn: () => apiGet<Product[]>(`/api/products?${new URLSearchParams({ search: asked })}`), enabled: asked.length > 0 });
  return asked && asked === text.trim() ? found.data ?? [] : [];
}

export function NewOrderPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => apiGet<Supplier[]>('/api/suppliers'), enabled: owner });
  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: () => apiGet<Order[]>('/api/purchase-orders'), enabled: owner });
  const [picked, setPicked] = useState<string | null>(null);
  const [allSuppliers, setAllSuppliers] = useState(false);
  const [text, setText] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = useSearch(text);

  if (session.status !== 'signed-in') return null;
  if (!owner) return <Page><Back /><p className="m-0 text-sm text-[var(--wh-muted)]">{ONLY_OWNER}</p></Page>;

  // The supplier ordered from last first (audit M8), then in the server's order (by name).
  const lastOrdered = (s: Supplier) => Math.max(0, ...(orders.data ?? []).filter((o) => o.supplierId === s.id).map((o) => o.id));
  const sorted = [...(suppliers.data ?? [])].sort((a, b) => lastOrdered(b) - lastOrdered(a));
  const supplierId = picked ?? (sorted[0] ? String(sorted[0].id) : null);
  const shown = allSuppliers || sorted.findIndex((s) => String(s.id) === supplierId) >= PILLS ? sorted : sorted.slice(0, PILLS);

  const add = (p: Product) => {
    setLines((ls) => (ls.some((l) => l.product.id === p.id) ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: Math.min(MAX_COUNT, l.qty + 1) } : l)) : [...ls, { product: p, qty: 1, typed: '' }]));
    setText('');
    setProblem(null);
  };
  const setQty = (id: number, qty: number) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, qty } : l)));
  const setTyped = (id: number, typed: string) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, typed } : l)));
  const onEnter = () => {
    const typed = text.trim().toLowerCase();
    const exact = matches.find((p) => [p.barcode, p.sku].some((v) => v && v.toLowerCase() === typed));
    const only = matches.length === 1 ? matches[0] : undefined;
    if (exact ?? only) add((exact ?? only)!);
  };
  const total = lines.reduce((sum, l) => sum + pence(costOf(l) ?? 0) * l.qty, 0) / 100;

  async function save(ordered: boolean) {
    if (!supplierId) { setProblem('Pick a supplier first.'); return; }
    if (lines.length === 0) { setProblem('Add a product first.'); return; }
    // A draft can wait for its costs; an order can't (review of 26 Oct).
    if (ordered && lines.some((l) => costOf(l) === null)) { setProblem('Type a cost for every line first.'); return; }
    setProblem(null);
    setBusy(true);
    try {
      // Made already ordered in one request, so a failure can't leave a
      // draft behind for a retry to duplicate (review of 26 Oct).
      const made = await apiMutate<Order>('/api/purchase-orders', {
        supplierId: Number(supplierId),
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, unitCost: costOf(l) ?? 0 })),
        ...(ordered ? { markOrdered: true } : {}),
      });
      queryClient.setQueryData(['purchase-order', made.id], made);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate(orderHref(made.id));
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save the order. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <Page>
      <Back />
      <Card id="t-what-to-order" title="What to order">
        {suppliers.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the suppliers. Try again in a moment.</p>
          : !suppliers.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : sorted.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No suppliers yet.</p>
          : (
            <div className="flex flex-wrap items-end gap-2">
              <PillGroup legend="Supplier" value={supplierId} onChange={setPicked} options={shown.map((s) => ({ value: String(s.id), label: s.name }))} />
              {shown.length < sorted.length ? <Button variant="default" onClick={() => setAllSuppliers(true)}>Other…</Button> : null}
            </div>
          )}
        <div className="relative">
          <label className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
            <NavIcon name="search" size={20} />
            <input type="search" aria-label="Add a product: scan, or type to search" placeholder="Add a product: scan, or type to search" value={text}
              aria-controls="po-matches" aria-expanded={matches.length > 0}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
              className="min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)] focus:outline-none" />
          </label>
          {matches.length > 0 ? (
            <ul id="po-matches" role="listbox" aria-label="Matching products" className="m-0 mt-1 list-none rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
              {matches.slice(0, 8).map((p) => (
                <li key={p.id} role="option" aria-selected="false" tabIndex={-1} onClick={() => add(p)}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-[var(--wh-border)] px-3 first:border-t-0 hover:bg-[var(--wh-hover)]">
                  <span className="text-size-15 font-semibold">{p.name}</span>
                  <span className="text-size-13 text-[var(--wh-muted)]">{p.sku}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {lines.length > 0 ? (
          <ul aria-label="Lines" className="m-0 list-none p-0">
            {lines.map((l) => { const { product: p, qty } = l; const cost = costOf(l); return (
              <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[var(--wh-border)] py-1.5">
                <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
                  <span className="text-size-15 font-semibold">{p.name}</span>
                  {p.sku ? <span className="text-size-13 text-[var(--wh-muted)]">{p.sku}</span> : null}
                </span>
                <Count name={p.name} value={qty} onChange={(n) => setQty(p.id, n)} />
                {recorded(p) === null ? (
                  <label className="inline-flex shrink-0 items-center gap-1.5 text-size-13 text-[var(--wh-muted)]">
                    {cost === null ? 'No cost recorded' : null}
                    <span className="inline-flex items-center gap-1">£<input inputMode="decimal" aria-label={`Cost each: ${p.name}`} value={l.typed}
                      onChange={(e) => setTyped(p.id, e.target.value)}
                      className={`h-11 w-[80px] rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-2 text-right text-size-15 text-[var(--wh-ink)] ${mono}`} /></span>
                  </label>
                ) : null}
                {cost === null ? null : <span className={`min-w-[72px] text-right text-size-15 ${mono}`}>{money((pence(cost) * qty) / 100)}</span>}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setLines((ls) => ls.filter((l) => l.product.id !== p.id))}
                  className="inline-flex size-11 items-center justify-center border-0 bg-transparent text-[var(--wh-muted)]"><NavIcon name="close" size={18} /></button>
              </li>
            ); })}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
          <span className="text-size-15">Total cost <span className={`text-base font-bold ${mono}`}>{money(total)}</span></span>
          <span className="flex flex-wrap gap-2">
            <Button variant="default" disabled={busy} onClick={() => void save(false)}>Save as draft</Button>
            <Button variant="accent" disabled={busy} onClick={() => void save(true)}>Mark as ordered</Button>
          </span>
        </div>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Order it however you usually do — on the supplier’s website or by phone — then mark it as ordered so deliveries can be checked against it.</p>
      </Card>
    </Page>
  );
}
