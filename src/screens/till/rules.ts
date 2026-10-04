/**
 * The till's sums, kept in pence so £0.10 + £0.20 is £0.30.
 * Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
 */

export type TillLine = {
  key: number;
  kind: 'labour' | 'part';
  name: string;
  unitPrice: number;
  usualPrice: number;
  qty: number;
  serviceId?: number;
  minutes?: number | null;
  productId?: number;
  sku?: string | null;
  stockQty?: number;
};

export const pence = (pounds: number) => Math.round(Number(pounds) * 100);
export const money = (pounds: number) => `£${(pence(pounds) / 100).toFixed(2)}`;

export function lineTotal(l: TillLine) {
  return pence(l.unitPrice) * l.qty / 100;
}

export function saleTotal(lines: TillLine[]) {
  return lines.reduce((sum, l) => sum + pence(l.unitPrice) * l.qty, 0) / 100;
}

/** "Labour · 30 min", "Part · B05S-RX". */
export function lineSub(l: TillLine) {
  if (l.kind === 'labour') return l.minutes ? `Labour · ${l.minutes} min` : 'Labour';
  return l.sku ? `Part · ${l.sku}` : 'Part';
}

/** Decision 5: selling past stock is warned, never blocked. */
export function stockWarning(l: TillLine) {
  if (l.kind !== 'part' || l.stockQty === undefined || l.qty <= l.stockQty) return null;
  return `Stock says ${l.stockQty} — sold anyway`;
}

/**
 * The amounts a customer is likely to hand over: the exact amount, then the
 * next round £5, £10, £20, £50 and £100 above it, four at most.
 */
export function noteButtons(total: number) {
  const exact = pence(total);
  const out = [exact];
  for (const step of [500, 1000, 2000, 5000, 10000]) {
    const up = Math.ceil(exact / step) * step;
    if (up > exact && !out.includes(up)) out.push(up);
  }
  return out.slice(0, 4).map((p) => p / 100);
}

/** A line as POST /api/sales takes it. */
export function asSaleItem(l: TillLine) {
  if (l.kind === 'labour') {
    return { lineType: 'labour', serviceId: l.serviceId, name: l.name, unitPrice: l.unitPrice, minutes: l.minutes ?? null };
  }
  return { productId: l.productId, qty: l.qty, unitPrice: l.unitPrice };
}
