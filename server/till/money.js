// Whole-pence money for the till. UK shop prices include VAT, so VAT is
// extracted from the gross: gross × rate / (1 + rate). Rates are basis points
// (2000 = 20%) so every sum stays in integers.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md

export function vatFromGrossPence(grossPence, rateBp) {
  const sign = grossPence < 0 ? -1 : 1;
  const abs = Math.abs(grossPence);
  // Integer maths, rounding half up: floor((2·a·r + (10000 + r)) / (2·(10000 + r))).
  const denominator = 10000 + rateBp;
  return sign * Math.floor((2 * abs * rateBp + denominator) / (2 * denominator));
}

export function receiptLabel(tillCode, receiptNumber) {
  return `${tillCode}-${String(receiptNumber).padStart(4, '0')}`;
}
