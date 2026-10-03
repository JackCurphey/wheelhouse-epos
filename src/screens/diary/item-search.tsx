import { useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * Search the shop's services and products, or scan a barcode (the scanner
 * types it, then Enter, which picks the product with that exact barcode or
 * SKU). Used by Add item (the job's work and parts) and Add to quote.
 */
export type Product = { id: number; name: string; sku: string | null; barcode: string | null; price: number; stockQty: number };
export type Service = { id: number; name: string; price: number; minutes: number; active: boolean };
export type Picked = { type: 'service'; service: Service } | { type: 'product'; product: Product };

const money = (n: number) => `£${Number(n).toFixed(2)}`;

export function ItemSearch({ id, disabled, onPick }: { id: string; disabled?: boolean; onPick: (p: Picked) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const products = useQuery({
    queryKey: ['products', term],
    queryFn: () => apiGet<Product[]>(`/api/products?search=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
  });
  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<Service[]>('/api/workshop-services') });
  const serviceHits = term.length >= 2
    ? (services.data ?? []).filter((s) => s.active && s.name.toLowerCase().includes(term.toLowerCase()))
    : [];

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const exact = (products.data ?? []).find((p) => p.barcode === term || p.sku === term);
    if (exact) onPick({ type: 'product', product: exact });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-2.5">
      <label htmlFor={id} className="text-sm font-semibold">Search products or services, or scan a barcode</label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={onKey}
        className="min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm"
      />
      <div className="flex flex-col gap-1">
        {serviceHits.map((s) => (
          <button key={`s${s.id}`} type="button" disabled={disabled} onClick={() => onPick({ type: 'service', service: s })} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2.5 text-left text-sm hover:bg-[var(--wh-hover)]">
            <span>{`${s.name} · ${money(s.price)}`}</span>
            <span className="text-xs text-[var(--wh-muted)]">Labour</span>
          </button>
        ))}
        {(products.data ?? []).map((p) => (
          <button key={`p${p.id}`} type="button" disabled={disabled} onClick={() => onPick({ type: 'product', product: p })} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2.5 text-left text-sm hover:bg-[var(--wh-hover)]">
            <span>{`${p.name} · ${money(p.price)}`}</span>
            <span className="text-xs text-[var(--wh-muted)]">{p.stockQty > 0 ? `${p.stockQty} in stock` : 'None in stock'}</span>
          </button>
        ))}
        {term.length >= 2 && products.isSuccess && products.data.length === 0 && serviceHits.length === 0 ? (
          <span className="px-2.5 text-[13px] text-[var(--wh-muted)]">Nothing matches “{term}”.</span>
        ) : null}
      </div>
    </div>
  );
}
