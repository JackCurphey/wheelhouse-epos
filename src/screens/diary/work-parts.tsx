import { useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';

/**
 * A job's work and parts (journey 12; decision 46: labour above parts), on
 * the job's order. The server takes the whole list back each time
 * (PUT /api/sale-documents/:id/items), so every change sends every line.
 * Add item searches the shop's services and products; a scanner types a
 * barcode and Enter, which adds that product straight away.
 * Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md (piece 3)
 *
 * Not here yet (the server has nowhere to keep them): the Done tick, a note
 * per line, and the customer's approval per line (the quote stage).
 */

type Line = {
  id: number; productId: number | null; name: string; sku: string | null; unitPrice: number; qty: number;
  lineTotal: number; lineType: string | null; serviceId: number | null; minutes: number | null;
};
type Order = { id: number; status: string; total: number; items: Line[] };
type Product = { id: number; name: string; sku: string | null; barcode: string | null; price: number; stockQty: number };
type Service = { id: number; name: string; price: number; minutes: number; active: boolean };

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const isLabour = (l: Line) => l.lineType === 'labour';

/** A line as the server takes it back. */
function asInput(l: Line) {
  if (isLabour(l)) {
    const out: Record<string, unknown> = { lineType: 'labour', name: l.name, unitPrice: l.unitPrice };
    if (l.minutes) out.minutes = l.minutes;
    if (l.serviceId) out.serviceId = l.serviceId;
    return out;
  }
  return { productId: l.productId, qty: l.qty, unitPrice: l.unitPrice };
}

export function WorkParts({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['sale-document', orderId], queryFn: () => apiGet<Order>(`/api/sale-documents/${orderId}`) });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});

  const term = search.trim();
  const products = useQuery({
    queryKey: ['products', term],
    queryFn: () => apiGet<Product[]>(`/api/products?search=${encodeURIComponent(term)}`),
    enabled: adding && term.length >= 2,
  });
  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<Service[]>('/api/workshop-services'), enabled: adding });
  const serviceHits = term.length >= 2
    ? (services.data ?? []).filter((s) => s.active && s.name.toLowerCase().includes(term.toLowerCase()))
    : [];

  const lines = order.data?.items ?? [];
  const editable = order.data?.status === 'open';
  // Decision 46: labour first, then parts.
  const sorted = [...lines].sort((a, b) => Number(isLabour(b)) - Number(isLabour(a)));

  async function save(items: Record<string, unknown>[]) {
    setSaving(true);
    setError(null);
    try {
      await apiMutate(`/api/sale-documents/${orderId}/items`, { items }, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sale-document', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
      ]);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add(input: Record<string, unknown>) {
    if (await save([...sorted.map(asInput), input])) {
      setSearch('');
      setAdding(false);
    }
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // A scanner types the barcode, then Enter: add the product it matches exactly.
    const exact = (products.data ?? []).find((p) => p.barcode === term || p.sku === term);
    if (exact) void add({ productId: exact.id, qty: 1, unitPrice: exact.price });
  }

  function commitQty(line: Line) {
    const raw = qtyDraft[line.id];
    if (raw === undefined) return;
    const qty = Math.trunc(Number(raw));
    setQtyDraft((d) => {
      const next = { ...d };
      delete next[line.id];
      return next;
    });
    if (!Number.isFinite(qty) || qty <= 0 || qty === line.qty) return;
    void save(sorted.map((l) => (l.id === line.id ? { ...asInput(l), qty } : asInput(l))));
  }

  return (
    <div className="flex flex-col gap-2">
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>Add item</Button>
        </div>
      ) : null}
      {adding ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-2.5">
          <label htmlFor="wp-search" className="text-sm font-semibold">Search products or services, or scan a barcode</label>
          <input
            id="wp-search"
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            className="min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm"
          />
          <div className="flex flex-col gap-1">
            {serviceHits.map((s) => (
              <button key={`s${s.id}`} type="button" disabled={saving} onClick={() => add({ lineType: 'labour', serviceId: s.id })} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2.5 text-left text-sm hover:bg-[var(--wh-hover)]">
                <span>{`${s.name} · ${money(s.price)}`}</span>
                <span className="text-xs text-[var(--wh-muted)]">Labour</span>
              </button>
            ))}
            {(products.data ?? []).map((p) => (
              <button key={`p${p.id}`} type="button" disabled={saving} onClick={() => add({ productId: p.id, qty: 1, unitPrice: p.price })} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2.5 text-left text-sm hover:bg-[var(--wh-hover)]">
                <span>{`${p.name} · ${money(p.price)}`}</span>
                <span className="text-xs text-[var(--wh-muted)]">{p.stockQty > 0 ? `${p.stockQty} in stock` : 'None in stock'}</span>
              </button>
            ))}
            {term.length >= 2 && products.isSuccess && products.data.length === 0 && serviceHits.length === 0 ? (
              <span className="px-2.5 text-[13px] text-[var(--wh-muted)]">Nothing matches “{term}”.</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      {order.data ? (
        <div className="overflow-x-auto rounded-md border border-[var(--wh-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--wh-surface-muted)] text-left text-xs text-[var(--wh-muted)]">
                <th scope="col" className="px-3 py-2 font-semibold">Work or part</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                {editable ? <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id} className="border-t border-[var(--wh-border)]">
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editable && !isLabour(l) ? (
                      <input
                        type="number"
                        min={1}
                        aria-label={`Quantity of ${l.name}`}
                        value={qtyDraft[l.id] ?? String(l.qty)}
                        onChange={(e) => setQtyDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => commitQty(l)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitQty(l); }}
                        className="min-h-9 w-16 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 text-right"
                      />
                    ) : l.qty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.lineTotal)}</td>
                  {editable ? (
                    <td className="px-1 py-1 text-right">
                      <Button size="sm" variant="ghost" disabled={saving} aria-label={`Remove ${l.name}`} onClick={() => save(sorted.filter((x) => x.id !== l.id).map(asInput))}>Remove</Button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr><td colSpan={editable ? 5 : 4} className="px-3 py-2 text-[var(--wh-muted)]">Nothing added yet.</td></tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--wh-border)] font-bold">
                <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(order.data.total)}</td>
                {editable ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
      {order.data && !editable ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">This job&apos;s order is closed, so its work and parts can&apos;t be changed here.</p> : null}
    </div>
  );
}
