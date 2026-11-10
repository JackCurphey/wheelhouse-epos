// Bike warranties (openspec/changes/finish-customers, design 6; Jack, 9 Nov, answer 3): a
// brand's or a model's lines, checked as sent and read back. Lines are [{ part, years }] in the
// order Frame, Components, Electronics; years null is lifetime.
import { prepare } from '../db.js';
import { bikeKindOf } from './bikes.js';

export const PARTS = ['frame', 'components', 'electronics'];
export const YEARS_REFUSED = 'Type whole years, from 1 to 50, or choose Lifetime';
const MAX_BRAND = 60;

// A brand as compared: capitals and spaces at either end ignored (as brand_key is).
export const brandKey = (brand) => String(brand ?? '').trim().toLowerCase();

// A brand's name as sent: { brand } or { problem }.
export function brandSent(brand) {
  const name = typeof brand === 'string' ? brand.trim() : '';
  if (!name) return { problem: 'A brand needs a name' };
  if (name.length > MAX_BRAND) return { problem: `A brand can be up to ${MAX_BRAND} characters` };
  return { brand: name };
}

// Lines as sent: { lines } in part order, or { problem }.
export function linesSent(sent) {
  if (!Array.isArray(sent)) return { problem: 'Send the warranty’s lines as a list' };
  const out = [];
  for (const l of sent) {
    if (l === null || typeof l !== 'object' || !PARTS.includes(l.part)) return { problem: 'Each line is Frame, Components or Electronics' };
    if (out.some((o) => o.part === l.part)) return { problem: 'Each line can be there once' };
    if (l.years !== null && !(Number.isInteger(l.years) && l.years >= 1 && l.years <= 50)) return { problem: YEARS_REFUSED };
    out.push({ part: l.part, years: l.years });
  }
  return { lines: out.sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part)) };
}

const ordered = (rows) => rows
  .map((r) => ({ part: r.part, years: r.years ?? null }))
  .sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part));

// Replaces an owner's lines: { brandWarrantyId } or { productId }. Inside the caller's transaction.
export async function writeLines(owner, lines) {
  const [column, id] = owner.brandWarrantyId ? ['brand_warranty_id', owner.brandWarrantyId] : ['product_id', owner.productId];
  await prepare(`DELETE FROM warranty_lines WHERE ${column} = ?`).run(id);
  for (const l of lines) await prepare(`INSERT INTO warranty_lines (${column}, part, years) VALUES (?, ?, ?)`).run(id, l.part, l.years);
}

// Every listed brand with its lines, by name.
export async function brandWarranties(only = null) {
  const brands = await prepare(`SELECT id, brand FROM bike_brand_warranties ${only ? 'WHERE id = ?' : ''} ORDER BY brand_key`).all(...(only ? [only] : []));
  if (brands.length === 0) return [];
  const lines = await prepare('SELECT brand_warranty_id, part, years FROM warranty_lines WHERE brand_warranty_id = ANY(?::int[])').all(brands.map((b) => b.id));
  return brands.map((b) => ({ id: b.id, brand: b.brand, lines: ordered(lines.filter((l) => l.brand_warranty_id === b.id)) }));
}

// The warranty a product gets: its own lines if it has any (question 17), else its listed
// brand's; Electronics only for an e-bike (its category marked E-bikes). Null with neither.
export async function productWarranty(product, kinds) {
  const ebike = bikeKindOf(product.category, kinds) === 'ebikes';
  const forBike = (rows) => ordered(rows).filter((l) => ebike || l.part !== 'electronics');
  const listed = product.brand
    ? await prepare('SELECT id, brand FROM bike_brand_warranties WHERE brand_key = ?').get(brandKey(product.brand))
    : null;
  const own = await prepare('SELECT part, years FROM warranty_lines WHERE product_id = ?').all(product.id);
  if (own.length) return { own: true, brand: listed?.brand ?? null, lines: forBike(own) };
  if (!listed) return null;
  return { own: false, brand: listed.brand, lines: forBike(await prepare('SELECT part, years FROM warranty_lines WHERE brand_warranty_id = ?').all(listed.id)) };
}
