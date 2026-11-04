// Whole pence, the one way money is carried (openspec/changes/products-in-pence).

// The most a product's pounds column (NUMERIC(10,2)) holds, in pence.
export const MAX_PENCE = 9_999_999_999;

// The most a price can be: what a sale line can carry (till_sale_lines and the till's
// sync, server/till/sync.js, hold INTEGER pence). A price above this could be stored
// but never sold. A cost isn't sold, so it can be as much as its column holds.
export const MAX_PRICE_PENCE = 2_147_483_647;

// Pounds, as any old writer sends them, over that either way. A third decimal is
// rounded as the pounds column would round it.
export const priceTooBig = (pounds) => Math.abs(Math.round(Number(pounds) * 100)) > MAX_PRICE_PENCE;

// A whole number of pence from nothing up to the most the column holds. A JSON
// number only: "2800", true and 28.5 aren't figures.
export const wholePence = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_PENCE;

// "19.99" from 1999, from the whole pounds and the remainder, so nothing is rounded
// and the pounds written beside the pence are exact.
export function penceToPounds(pence) {
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
}
