import { penceText } from '@/lib/money.ts';
import type { DetailFilter } from './site-query.ts';

/**
 * A category page's filters as the page's address keeps them (website-browse
 * design 6: "?inner-diameter=30&sort=price-asc"), and as /api/site/products
 * is asked for them (`d<id>=`, server/site-products.js). A detail is named in
 * the address by its name ("inner-diameter"), so a shared link reads plainly;
 * the server knows it by its id, which an answer gives.
 */
export type Selection = {
  /** Ticked values by detail name in the address ("inner-diameter" → ["30"]). */
  details: Record<string, string[]>;
  brands: string[];
  /** Pounds as typed ("20", "20.50"). */
  from: string | null;
  to: string | null;
  ready: boolean;
};

export const NOTHING_TICKED: Selection = { details: {}, brands: [], from: null, to: null, ready: false };

export const SORTS = [
  { value: 'az', label: 'A to Z' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'newest', label: 'Newest' },
] as const;
export type Sort = (typeof SORTS)[number]['value'];
export const sortOf = (value: string | null): Sort => SORTS.find((s) => s.value === value)?.value ?? 'az';

// The address's own keys; anything else names a detail. storefrontSlug is the
// shop's own address standing in for its host name (address.ts).
const OWN_KEYS = new Set(['sort', 'brand', 'from', 'to', 'ready', 'after', 'shop', 'category', 'q', 'storefrontSlug']);
// A campaign link's own keys ("utm_source=…") are never a detail, and stay in the address.
const isCampaign = (key: string) => key.startsWith('utm_');
// "30.0" or "030" in a shared link is the value 30, as the server writes it.
const valueOf = (text: string) => (/^\d+(\.\d+)?$/.test(text) ? String(Number(text)) : text);

/** A detail's name as the address writes it: "Inner diameter" is "inner-diameter". */
export function detailSlug(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'detail';
  // A detail called "Brand" or "Sort" mustn't be read as the address's own key.
  return OWN_KEYS.has(slug) ? `${slug}-detail` : slug;
}

/** Each detail's id by its name in the address, from an answer's filters. */
export const detailIdsOf = (details: DetailFilter[]): Record<string, number> =>
  Object.fromEntries(details.map((d) => [detailSlug(d.name), d.id]));

/** Pounds as typed, "£20" or "20.5", or null when it isn't a price. */
export function parsePounds(text: string): string | null {
  const t = text.trim().replace(/^£\s*/, '');
  return /^\d{1,7}(\.\d{1,2})?$/.test(t) ? t : null;
}
const poundsText = (pounds: string) => penceText(Math.round(Number(pounds) * 100));

export function readSelection(params: URLSearchParams): Selection {
  const details: Record<string, string[]> = {};
  for (const [key, value] of params) {
    if (OWN_KEYS.has(key) || isCampaign(key) || value === '') continue;
    const list = (details[key] ??= []);
    if (!list.includes(valueOf(value))) list.push(valueOf(value));
  }
  const from = parsePounds(params.get('from') ?? '');
  const to = parsePounds(params.get('to') ?? '');
  return { details, brands: [...new Set(params.getAll('brand').filter(Boolean))], from, to, ready: params.get('ready') === '1' };
}

/** The address with `selection` in place of its filters; the sort and anything else stay. */
export function writeSelection(prev: URLSearchParams, selection: Selection): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of prev) if ((OWN_KEYS.has(key) && !['brand', 'from', 'to', 'ready', 'after'].includes(key)) || isCampaign(key)) next.append(key, value);
  for (const [slug, values] of Object.entries(selection.details)) for (const v of values) next.append(slug, v);
  for (const b of selection.brands) next.append('brand', b);
  if (selection.from) next.set('from', selection.from);
  if (selection.to) next.set('to', selection.to);
  if (selection.ready) next.set('ready', '1');
  return next;
}

/** Only what this category can filter by: its own details, and ready when a shop is chosen. */
export function effective(selection: Selection, details: DetailFilter[], readyShop: string | null): Selection {
  const known = new Set(details.map((d) => detailSlug(d.name)));
  const own = Object.entries(selection.details).filter(([slug, values]) => known.has(slug) && values.length > 0);
  return { ...selection, details: Object.fromEntries(own), ready: selection.ready && readyShop !== null };
}

export const anythingTicked = (s: Selection) =>
  Object.values(s.details).some((v) => v.length > 0) || s.brands.length > 0 || s.from !== null || s.to !== null || s.ready;

/** The ticks as the server is asked for them: each known detail by id, and the rest as they are. */
function appendSelection(p: URLSearchParams, s: Selection, shopId: number | null, ids: Record<string, number>) {
  for (const [slug, values] of Object.entries(s.details)) {
    const id = ids[slug];
    if (id !== undefined) for (const v of values) p.append(`d${id}`, v);
  }
  for (const b of s.brands) p.append('brand', b);
  if (s.from) p.set('from', s.from);
  if (s.to) p.set('to', s.to);
  if (s.ready) p.set('ready', '1');
  if (shopId !== null) p.set('shop', String(shopId));
  return p;
}

/** What /api/site/products is asked: the category, each known detail by id, and the rest as they are. */
export function productsParams(categoryId: number, s: Selection, sort: Sort, shopId: number | null, ids: Record<string, number>): URLSearchParams {
  const p = new URLSearchParams({ category: String(categoryId) });
  appendSelection(p, s, null, ids);
  if (sort !== 'az') p.set('sort', sort);
  if (shopId !== null) p.set('shop', String(shopId));
  return p;
}

/** The results' sorts (wb-search-results): Best match first, then a category's. */
export const SEARCH_SORTS = [{ value: 'best', label: 'Best match' }, ...SORTS] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number]['value'];
/** Best match unless the address names another; Best match is never written. */
export const searchSortOf = (value: string | null): SearchSort => SEARCH_SORTS.find((s) => s.value === value)?.value ?? 'best';

/** What /api/site/search is asked: the words, the category narrowed to, the ticks, the sort. */
export function searchParams(q: string, categoryId: number | null, s: Selection, sort: SearchSort, shopId: number | null, ids: Record<string, number>): URLSearchParams {
  const p = new URLSearchParams({ q });
  if (categoryId !== null) p.set('category', String(categoryId));
  appendSelection(p, s, null, ids);
  if (sort !== 'best') p.set('sort', sort);
  if (shopId !== null) p.set('shop', String(shopId));
  return p;
}

// A measurement as the server reads one word of a search ("30mm", "30"; server/routes/stock-list.js MEASURE).
const MEASURE = /^(-?\d{1,9}(?:\.\d{1,4})?)([a-z]+)?$/i;

/**
 * The words without the measurement the server read from them ("bearing
 * 30mm" with 30 mm is "bearing"): the first word that is the value, in the
 * detail's unit or with none. Words with no such word stay as they are.
 */
export function withoutMeasure(q: string, value: number, unit: string | null): string {
  const words = q.trim().split(/\s+/);
  const at = words.findIndex((w) => {
    const m = MEASURE.exec(w);
    return m !== null && Number(m[1]) === value && (!m[2] || (unit !== null && m[2].toLowerCase() === unit.toLowerCase()));
  });
  return at < 0 ? q.trim() : words.filter((_, i) => i !== at).join(' ');
}

/** A value as the filter shows it: a number with its unit ("30 mm"), words as written. */
export const valueText = (detail: Pick<DetailFilter, 'kind' | 'unit'>, value: string | number) =>
  detail.kind === 'number' && detail.unit ? `${value} ${detail.unit}` : String(value);

/**
 * A category page's card line from a product's details (wb-category "[n] ×
 * [n] × [n] mm"): one unit for all, written once at the end; otherwise each
 * value with its own unit, joined by " · ". Null with no details.
 */
export function detailsLine(details: { value: string | number; unit: string | null }[]): string | null {
  if (details.length === 0) return null;
  const unit = details[0].unit;
  if (unit && details.every((d) => d.unit === unit)) return `${details.map((d) => d.value).join(' × ')} ${unit}`;
  return details.map((d) => (d.unit ? `${d.value} ${d.unit}` : String(d.value))).join(' · ');
}

export type Chip = { words: string; without: (s: Selection) => Selection };

/** Each tick as a chip (wb-category-filtered): ready, then the details in order, brand, then price. */
export function chipsOf(s: Selection, details: DetailFilter[], readyShop: string | null): Chip[] {
  const chips: Chip[] = [];
  if (s.ready && readyShop) chips.push({ words: `Ready today at ${readyShop}`, without: (x) => ({ ...x, ready: false }) });
  for (const d of details) {
    const slug = detailSlug(d.name);
    for (const v of s.details[slug] ?? []) {
      chips.push({ words: `${d.name}: ${valueText(d, v)}`, without: (x) => ({ ...x, details: { ...x.details, [slug]: (x.details[slug] ?? []).filter((y) => y !== v) } }) });
    }
  }
  for (const b of s.brands) chips.push({ words: `Brand: ${b}`, without: (x) => ({ ...x, brands: x.brands.filter((y) => y !== b) }) });
  if (s.from) chips.push({ words: `From ${poundsText(s.from)}`, without: (x) => ({ ...x, from: null }) });
  if (s.to) chips.push({ words: `To ${poundsText(s.to)}`, without: (x) => ({ ...x, to: null }) });
  return chips;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
/** "a", "a and b", "a, b and c". */
export const andList = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * wb-category-empty's sentence, in two parts: the bold start ("Nothing is
 * ready today at Bolton") and the rest (" with an inner diameter of 30 mm and
 * a height of 10 mm."). With no ready tick it is "Nothing" and " has …".
 */
export function nothingSentence(s: Selection, details: DetailFilter[], readyShop: string | null): { bold: string; rest: string } {
  const brands = s.brands.length ? ` from ${s.brands.join(' or ')}` : '';
  const bold = `Nothing${brands}${s.ready && readyShop ? ` is ready today at ${readyShop}` : ''}`;
  const parts = details
    .filter((d) => (s.details[detailSlug(d.name)] ?? []).length > 0)
    .map((d) => {
      const name = d.name.toLowerCase();
      return `${article(name)} ${name} of ${(s.details[detailSlug(d.name)] ?? []).map((v) => valueText(d, v)).join(' or ')}`;
    });
  let rest = parts.length ? `${s.ready && readyShop ? ' with' : ' has'} ${andList(parts)}` : '';
  if (s.from || s.to) rest += ` costing${s.from ? ` from ${poundsText(s.from)}` : ''}${s.to ? ` up to ${poundsText(s.to)}` : ''}`;
  return { bold, rest: `${rest}.` };
}
