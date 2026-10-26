/**
 * The note-and-coin counter's sums (building block 18; cash-up decision 3,
 * docs/decisions/2026-09-29-cash-up-review.md). Every amount is whole pence:
 * pounds are never worked out as decimals, so 10p + 20p is exactly 30.
 * Spec: openspec/changes/note-coin-counter
 */

export type Denomination = { label: string; pence: number };

/** £50 down to 1p, in the order the drawing shows them (cashup.mjs DENOMS). */
export const DENOMINATIONS: Denomination[] = [
  { label: '£50', pence: 5000 },
  { label: '£20', pence: 2000 },
  { label: '£10', pence: 1000 },
  { label: '£5', pence: 500 },
  { label: '£2', pence: 200 },
  { label: '£1', pence: 100 },
  { label: '50p', pence: 50 },
  { label: '20p', pence: 20 },
  { label: '10p', pence: 10 },
  { label: '5p', pence: 5 },
  { label: '2p', pence: 2 },
  { label: '1p', pence: 1 },
];

/** The boxes added up, in pence; null while every box is empty. */
export function countedPence(counts: Record<string, string>): number | null {
  let total = 0;
  let any = false;
  for (const d of DENOMINATIONS) {
    const n = counts[d.label];
    if (!n || !/^\d+$/.test(n)) continue;
    any = true;
    total += Number(n) * d.pence;
  }
  // A count too big to add up exactly is nothing counted (boxes take five digits).
  return any && Number.isSafeInteger(total) ? total : null;
}

/**
 * A typed total ("£208.70", "208.7", "150", "£1,234.50", "12.") read as
 * pence by splitting at the point, never by multiplying a decimal (0.29 × 100
 * is 28.999… in floating point). Empty, or a lone "£", is null; anything else
 * that isn't pounds and pence is invalid. Commas must group thousands, so
 * "12,34" is invalid rather than read as £1,234.
 */
export function parseTotal(text: string): { pence: number } | { invalid: true } | null {
  const t = text.replace(/\s+/g, '').replace(/^£/, '');
  if (t === '') return null;
  const m = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return { invalid: true };
  const pence = Number(m[1].replace(/,/g, '')) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(pence) ? { pence } : { invalid: true };
}

/** Pence as pounds: 20870 is "£208.70". Anything not whole pence is "", never "e+" or "NaN". */
export function penceText(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0) return '';
  const pounds = Math.floor(pence / 100);
  const rest = String(pence % 100).padStart(2, '0');
  return `£${pounds}.${rest}`;
}
