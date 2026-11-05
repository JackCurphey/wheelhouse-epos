/**
 * A product's second line on a count: a size says which, "Size M · [Colour 1]", in place of
 * its code (tk-count-below, tk-diff; openspec/changes/sizes-and-colours); anything else
 * its code, as before.
 */
export type Named = { sku: string | null; size?: string | null; colour?: string | null };

export function lineOf(p: Named): string | null {
  if (!p.size && !p.colour) return p.sku;
  return [p.size ? `Size ${p.size}` : null, p.colour ?? null].filter(Boolean).join(' · ');
}
