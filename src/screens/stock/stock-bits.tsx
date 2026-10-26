import { AlertTriangle } from 'lucide-react';
import { ROUTES } from '@/staff/routes.ts';

/**
 * What the stock list and a product's page share (openspec/changes/stock-list):
 * the product as GET /api/products sends it, its stock state, margin and the
 * small tags, as stock.mjs draws them.
 */
export type Product = {
  id: number; sku: string | null; barcode: string | null; name: string; category: string;
  price: number; cost: number | null; stockQty: number; lowStockThreshold: number; supplier: string | null;
  active: boolean; showOnline: boolean; photoUrl: string | null; vatRateBp: number | null;
};

export const productHref = (id: number) => ROUTES['st-product'].replace(':id', String(id));
export const mono = 'font-[family-name:var(--wh-font-mono)]';
export const money = (pounds: number) => `£${pounds.toFixed(2)}`;
// A count as drawn: a true minus sign below zero.
export const count = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** Below zero, or at or under a low-stock level above 0 (the Overview's rule, dashboard.js). */
export function stockState(p: Pick<Product, 'stockQty' | 'lowStockThreshold'>): 'below' | 'low' | null {
  if (p.stockQty < 0) return 'below';
  if (p.lowStockThreshold > 0 && p.stockQty <= p.lowStockThreshold) return 'low';
  return null;
}

/** Margin on the price before VAT, as the old app works it out, with the product's own rate. */
export function margin(p: Pick<Product, 'price' | 'cost' | 'vatRateBp'>): number | null {
  // No cost recorded (the old app saves 0) is no margin, not 100% (review 1).
  if (p.cost === null || p.cost === 0) return null;
  const net = p.price / (1 + (p.vatRateBp ?? 0) / 10000);
  return net > 0 ? Math.round(((net - p.cost) / net) * 100) : null;
}
export const marginText = (p: Pick<Product, 'price' | 'cost' | 'vatRateBp'>) => {
  const m = margin(p);
  return m === null ? '—' : `${m}%`;
};

export function StateTag({ state }: { state: 'below' | 'low' | null }) {
  if (!state) return null;
  return state === 'below' ? (
    <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full bg-[var(--wh-warn-bg)] px-2.5 text-xs font-bold whitespace-nowrap text-[var(--wh-warn-ink)]">
      <AlertTriangle aria-hidden="true" size={13} />Below zero
    </span>
  ) : (
    <span className="inline-flex min-h-[26px] items-center rounded-full bg-[var(--wh-surface-muted)] px-2.5 text-xs font-bold whitespace-nowrap text-[var(--wh-muted)]">Running low</span>
  );
}
