// Working out new prices for a bulk change (openspec/changes/bulk-price-change, design 2; stock
// control decision 7): a new price for each, up or down by a percentage, or a target margin,
// rounded to an ending. One place, used by the preview and by the change, so what the Owner
// sees is what is written.
import { ValidationError } from './http.js';
import { MAX_PRICE_PENCE } from './pence.js';

const HOWS = ['each', 'percent', 'margin'];
const ENDINGS = ['leave', '99', '00'];
const PRICE_LIMIT = '£21,474,836.47';
// Up to two decimal places, as typed: 10, 12.5 or 7.25, never 10.005.
const twoPlaces = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

// The nearest price ending in .99, or the nearest whole pound; halfway goes up. £0.00 stays
// £0.00, and nothing above it rounds to £0.00.
export function roundTo(pence, ending) {
  if (ending === 'leave' || pence === 0) return pence;
  if (ending === '00') return Math.max(100, Math.floor((pence + 50) / 100) * 100);
  const up = Math.floor(pence / 100) * 100 + 99;
  const down = up - 100;
  if (down < 0) return up;
  return up - pence <= pence - down ? up : down;
}

const noCostRecorded = (p) => p.cost_pence === null || p.cost_pence === undefined || Number(p.cost_pence) === 0;

// Checks the rule, then works out each product's new price. `products`: rows with id, name,
// price_pence, cost_pence and vat_rate_bp. Throws a ValidationError for a rule it can't use.
export function newPrices(products, rule) {
  const { how, value, ending = 'leave', prices = {} } = rule ?? {};
  if (!HOWS.includes(how)) throw new ValidationError('Pick how to change the prices');
  if (how !== 'each' && !ENDINGS.includes(ending)) throw new ValidationError('Pick what the prices end in');
  if (how === 'percent' && !(twoPlaces(value) && value >= -99 && value <= 1000)) {
    throw new ValidationError('A percentage change is a number from −99 to +1000, to two decimal places');
  }
  if (how === 'margin' && !(twoPlaces(value) && value >= 0 && value < 100)) {
    throw new ValidationError('A target margin is a number from 0 up to 99.99, to two decimal places');
  }
  if (how === 'each' && (typeof prices !== 'object' || prices === null || Array.isArray(prices))) {
    throw new ValidationError('A new price is a whole number of pence for each product');
  }
  return products.map((p) => {
    const now = Number(p.price_pence);
    const cost = p.cost_pence === null || p.cost_pence === undefined ? null : Number(p.cost_pence);
    const vat = Number(p.vat_rate_bp ?? 0);
    let next = now;
    let noCost = false;
    if (how === 'each') {
      const typed = prices[p.id];
      if (typed !== undefined) {
        if (!Number.isSafeInteger(typed) || typed < 0 || typed > MAX_PRICE_PENCE) {
          throw new ValidationError(`A new price is a number of pounds, from nothing up to ${PRICE_LIMIT}`);
        }
        next = typed;
      }
    } else if (how === 'percent') {
      next = roundTo(Math.round((now * Math.round((100 + value) * 100)) / 10000), ending);
    } else if (noCostRecorded(p)) {
      noCost = true;
    } else {
      // The margin on the price before VAT, as the list works it out (stock-bits.tsx margin()).
      next = roundTo(Math.round((cost * (10000 + vat)) / ((100 - value) * 100)), ending);
    }
    if (next > MAX_PRICE_PENCE) throw new ValidationError(`${p.name}’s new price would be over ${PRICE_LIMIT}, the most a price can be`);
    const belowCost = !noCostRecorded(p) && next / (1 + vat / 10000) < cost;
    return { id: p.id, nowPence: now, newPence: next, costPence: cost, vatRateBp: p.vat_rate_bp ?? null, belowCost, noCost };
  });
}
