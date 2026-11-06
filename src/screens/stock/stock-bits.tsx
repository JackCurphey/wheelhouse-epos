import { AlertTriangle } from 'lucide-react';
import { ROUTES } from '@/staff/routes.ts';

/**
 * What the stock list and a product's page share (openspec/changes/stock-list):
 * the product as GET /api/products sends it, its stock state, margin and the
 * small tags, as stock.mjs draws them.
 */
export type Product = {
  id: number; sku: string | null; barcode: string | null; name: string; category: string;
  pricePence: number; costPence: number | null; stockQty: number; lowStockThreshold: number; supplier: string | null;
  active: boolean; showOnline: boolean; photoUrl: string | null; vatRateBp: number | null;
};

export const productHref = (id: number) => ROUTES['st-product'].replace(':id', String(id));

/**
 * A row of GET /api/stock-list (openspec/changes/stock-list-categories-sizes): a product, a
 * size found by a search, or a product with sizes as one. `details` comes only with a
 * category picked or a measurement searched.
 */
type Answers = { details?: Record<string, number | string> };
export type ProductRow = Omit<Product, 'showOnline' | 'photoUrl'> & Answers & { kind: 'product' };
export type SizeRow = Omit<Product, 'showOnline' | 'photoUrl'> & Answers & { kind: 'size'; groupId: number; size: string | null; colour: string | null };
export type GroupRow = {
  kind: 'group'; groupId: number; name: string; category: string; sizes: number; colours: number; stockQty: number;
  sizesBelowZero: number; sizesRunningLow: number; priceLowPence: number; priceHighPence: number;
  costLowPence: number | null; costHighPence: number | null; active: boolean; vatRateBp: number | null;
};
export type ListRow = ProductRow | SizeRow | GroupRow;
const several = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const rowKey = (r: ListRow) => (r.kind === 'group' ? `g${r.groupId}` : `${r.kind[0]}${r.id}`);
/** A product with sizes counts as below zero, or running low, when one of its sizes is. */
export const rowState = (r: ListRow) => (r.kind === 'group' ? (r.sizesBelowZero ? 'below' : r.sizesRunningLow ? 'low' : null) : stockState(r));
export const rowPrice = (r: ListRow) => (r.kind === 'group' ? r.priceLowPence : r.pricePence);
export const rowPriceText = (r: ListRow) => (r.kind !== 'group' ? money(r.pricePence) : r.priceLowPence === r.priceHighPence ? money(r.priceLowPence) : `${money(r.priceLowPence)}–${money(r.priceHighPence)}`);
/** A product with sizes has one margin only when every size has one price, cost and VAT rate. */
export function rowMargin(r: ListRow): number | null {
  if (r.kind !== 'group') return margin(r);
  if (r.priceLowPence !== r.priceHighPence || r.costLowPence === null || r.costLowPence !== r.costHighPence || r.vatRateBp === null) return null;
  return margin({ pricePence: r.priceLowPence, costPence: r.costLowPence, vatRateBp: r.vatRateBp });
}
export const rowHasCost = (r: ListRow) => (r.kind === 'group' ? r.costLowPence !== null : r.costPence !== null);
/** The line under its name, as st-list and st-search-size draw it. */
export function rowLine(r: ListRow): string {
  if (r.kind === 'size') return [r.size ? `Size ${r.size}` : null, r.colour, r.barcode].filter(Boolean).join(' · ');
  if (r.kind === 'product') return [r.sku, r.category, r.supplier].filter(Boolean).join(' · ');
  return [r.category, several(r.sizes, 'size', 'sizes'), several(r.colours, 'colour', 'colours'),
    r.sizesBelowZero ? `${several(r.sizesBelowZero, 'size', 'sizes')} below zero` : null,
    r.sizesRunningLow ? `${several(r.sizesRunningLow, 'size', 'sizes')} running low` : null].filter(Boolean).join(' · ');
}
export const mono = 'font-[family-name:var(--wh-font-mono)]';
export const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
// A count as drawn: a true minus sign below zero.
export const count = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** Below zero, or at or under a low-stock level above 0 (the Overview's rule, dashboard.js). */
export function stockState(p: Pick<Product, 'stockQty' | 'lowStockThreshold'>): 'below' | 'low' | null {
  if (p.stockQty < 0) return 'below';
  if (p.lowStockThreshold > 0 && p.stockQty <= p.lowStockThreshold) return 'low';
  return null;
}

/** Margin on the price before VAT, as the old app works it out, with the product's own rate. */
export function margin(p: Pick<Product, 'pricePence' | 'costPence' | 'vatRateBp'>): number | null {
  // No cost recorded (the old app saves 0) is no margin, not 100% (review 1).
  if (p.costPence === null || p.costPence === 0) return null;
  const net = p.pricePence / (1 + (p.vatRateBp ?? 0) / 10000);
  return net > 0 ? Math.round(((net - p.costPence) / net) * 100) : null;
}
export const marginText = (p: Pick<Product, 'pricePence' | 'costPence' | 'vatRateBp'>) => {
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
