// Whole pence, the one way money is carried (openspec/changes/products-in-pence).

// The most a product's pounds column (NUMERIC(10,2)) holds, in pence.
export const MAX_PENCE = 9_999_999_999;

// A whole number of pence from nothing up to the most the column holds. A JSON
// number only: "2800", true and 28.5 aren't figures.
export const wholePence = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_PENCE;

// "19.99" from 1999, by whole-number arithmetic: no float is ever divided, so the
// pounds written beside the pence are exact.
export function penceToPounds(pence) {
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
}
