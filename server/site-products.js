// The customer website's products (openspec/changes/website-browse, design 2
// and 3): a category's products with its filters, a product page, suggestions
// and search, each with one stock line for the chosen shop. Called from
// routes/site.js inside the shop the address names. Only what a customer may
// see leaves here: never a cost, supplier, barcode or stock figure on a card.
import { prepare } from './db.js';
import { MEASURE, keyOf } from './routes/stock-list.js';
import { OPEN } from './c2w/orders.js';

/** Thrown for a page that can't be found; routes/site.js answers 404. */
export class NotFound extends Error {}

const PAGE = 6;
const lower = (text) => String(text ?? '').toLocaleLowerCase('en-GB');
const byName = (a, b) => a.name.localeCompare(b.name, 'en-GB') || a.id - b.id;
const within = (category, path) => category === path || category.startsWith(`${path} › `);
const idOf = (value) => (/^\d{1,9}$/.test(String(value ?? '')) ? Number(value) : null);

// The fixed pages (design: Collection and returns, Privacy, Cookies, Contact us, Our shops).
const PAGES = [
  { key: 'collection-returns', name: 'Collection and returns' },
  { key: 'privacy', name: 'Privacy' },
  { key: 'cookies', name: 'Cookies' },
  { key: 'contact', name: 'Contact us' },
  { key: 'shops', name: 'Our shops' },
];

// Everything a customer can see, read once per answer: a shop's catalogue is a
// few thousand rows at most, as Stock reads it (routes/stock-list.js).
async function catalogue(query) {
  const products = await prepare(
    'SELECT id, sku, name, brand, category, price_pence, photo_url, description, group_id, size, colour, created_at FROM products WHERE show_online AND active = 1 AND price > 0 ORDER BY id'
  ).all();
  const ids = products.map((p) => p.id);
  const groups = new Map((await prepare('SELECT id, name, category, description, photo_url FROM product_groups').all()).map((g) => [g.id, g]));
  const details = new Map((await prepare('SELECT id, category_id, name, kind, unit, choices, position FROM category_details ORDER BY position, id').all()).map((x) => [x.id, x]));
  const answers = new Map(ids.map((id) => [id, new Map()]));
  for (const a of await prepare('SELECT product_id, detail_id, value_number, value_text FROM product_details WHERE product_id = ANY(?::int[])').all(ids)) {
    if (!details.has(a.detail_id)) continue;
    const value = a.value_number === null ? a.value_text : Number(a.value_number);
    answers.get(a.product_id).set(a.detail_id, { value, key: tickKey(details.get(a.detail_id), value) });
  }
  const sites = await prepare('SELECT id, name FROM sites ORDER BY id').all();
  // With one shop, that shop is always the chosen one; a shop that isn't this business's is ignored.
  const shop = sites.length === 1 ? sites[0] : sites.find((s) => s.id === idOf(query.get('shop'))) ?? null;
  const free = await freeStock(ids);
  const categories = await prepare('SELECT id, name, parent_id, path FROM product_categories ORDER BY path').all();
  return { units: unitsOf(products, groups, answers), details, sites, shop, free, categories };
}

// How many of each product are free at each site: its frames in stock there, or
// for a product with no frame numbers its stock figure less the Cycle to Work
// orders holding it there (c2w/orders.js freeHere, for every product at once).
async function freeStock(ids) {
  const free = new Map();
  const add = (productId, siteId, n) => free.set(`${productId}:${siteId}`, (free.get(`${productId}:${siteId}`) ?? 0) + n);
  const frames = await prepare("SELECT product_id, site_id, count(*) FILTER (WHERE state = 'in_stock')::int AS n FROM stock_frames WHERE product_id = ANY(?::int[]) GROUP BY product_id, site_id").all(ids);
  const framed = new Set(frames.map((f) => f.product_id));
  for (const f of frames) add(f.product_id, f.site_id, f.n);
  for (const s of await prepare('SELECT product_id, site_id, qty FROM product_stock WHERE product_id = ANY(?::int[])').all(ids)) if (!framed.has(s.product_id)) add(s.product_id, s.site_id, s.qty);
  for (const h of await prepare(`SELECT product_id, site_id, count(*)::int AS n FROM c2w_orders WHERE product_id = ANY(?::int[]) AND held_at IS NOT NULL AND stage IN ${OPEN} GROUP BY product_id, site_id`).all(ids)) {
    if (!framed.has(h.product_id)) add(h.product_id, h.site_id, -h.n);
  }
  return (productId, siteId) => Math.max(0, free.get(`${productId}:${siteId}`) ?? 0);
}

// What the customer sees as one product: a product on its own, or a product
// with sizes and colours as one, known by its first size on the website.
function unitsOf(products, groups, answers) {
  const units = [];
  const byGroup = new Map();
  for (const p of products) {
    const item = { ...p, answers: answers.get(p.id) };
    const g = p.group_id === null ? null : groups.get(p.group_id);
    if (!g) { units.push(unit(p.id, p.name, p.brand, p.category, p.description, p.photo_url, [item], null)); continue; }
    if (!byGroup.has(g.id)) {
      byGroup.set(g.id, unit(p.id, g.name, p.brand, g.category, g.description, g.photo_url ?? p.photo_url, [], g));
      units.push(byGroup.get(g.id));
    }
    byGroup.get(g.id).items.push(item);
  }
  for (const u of units) {
    const prices = u.items.map((i) => Number(i.price_pence));
    u.low = Math.min(...prices);
    u.high = Math.max(...prices);
    u.added = Math.min(...u.items.map((i) => new Date(i.created_at).getTime()));
  }
  return units;
}
const unit = (id, name, brand, category, description, photo, items, group) => ({ id, name, brand, category: category ?? '', description: description ?? '', photo: photo ?? null, items, group });

// A value as a filter compares it: a number by its value_key, as Stock's
// filters do; written words exactly.
function tickKey(detail, value) {
  if (detail.kind === 'number') {
    const m = MEASURE.exec(String(value).trim());
    return m && !m[2] ? `n${keyOf(m[1])}` : null;
  }
  if (detail.kind === 'choice') return `t${detail.choices.find((c) => lower(c) === lower(value)) ?? value}`;
  return `t${String(value).trim()}`;
}

// The filters asked for, the same for a category and a search. A detail of
// another category is no filter here: it matches nothing rather than everything.
function filtersFrom(query, details, own) {
  const ticks = new Map();
  for (const [key, value] of query.entries()) {
    const id = /^d(\d{1,9})$/.exec(key)?.[1];
    if (!id) continue;
    const detail = details.get(Number(id));
    if (!ticks.has(Number(id))) ticks.set(Number(id), new Set());
    ticks.get(Number(id)).add(detail && own.has(detail.id) ? tickKey(detail, value) : null);
  }
  const brands = query.getAll('brand').map((b) => b.trim()).filter(Boolean);
  const pence = (key) => { const n = Number(query.get(key)); return query.get(key) && Number.isFinite(n) ? Math.round(n * 100) : null; };
  return { ticks, brands: brands.length ? new Set(brands.map(lower)) : null, from: pence('from'), to: pence('to'), ready: query.get('ready') === '1' };
}

function passes(u, f, ctx, skip = null) {
  for (const [id, keys] of f.ticks) {
    if (skip === `d${id}`) continue;
    if (!u.items.some((i) => keys.has(i.answers.get(id)?.key))) return false;
  }
  if (skip !== 'brand' && f.brands && !f.brands.has(lower(u.brand))) return false;
  if (skip !== 'price' && f.from !== null && u.high < f.from) return false;
  if (skip !== 'price' && f.to !== null && u.low > f.to) return false;
  if (skip !== 'ready' && f.ready && ctx.shop && !ready(u, ctx)) return false;
  return true;
}
const ready = (u, { shop, free }) => u.items.some((i) => free(i.id, shop.id) > 0);

// Each filter's counts leave its own ticks out, so another value can still be added.
function facets(units, f, ctx, ownDetails) {
  const count = (skip) => units.filter((u) => passes(u, f, ctx, skip));
  const details = ownDetails.map((detail) => {
    const seen = new Map();
    for (const u of count(`d${detail.id}`)) {
      const mine = new Map();
      for (const i of u.items) { const a = i.answers.get(detail.id); if (a?.key) mine.set(a.key, a.value); }
      for (const [key, value] of mine) seen.set(key, { value, count: (seen.get(key)?.count ?? 0) + 1 });
    }
    const values = [...seen.values()];
    if (detail.kind === 'number') values.sort((a, b) => a.value - b.value);
    else if (detail.kind === 'choice') values.sort((a, b) => detail.choices.indexOf(a.value) - detail.choices.indexOf(b.value));
    else values.sort((a, b) => a.value.localeCompare(b.value, 'en-GB'));
    return { id: detail.id, name: detail.name, kind: detail.kind, unit: detail.unit, values };
  });
  const brands = new Map();
  for (const u of count('brand')) if (u.brand) brands.set(u.brand, (brands.get(u.brand) ?? 0) + 1);
  const priced = count('price');
  return {
    details,
    brands: [...brands].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value, 'en-GB')),
    price: priced.length ? { lowPence: Math.min(...priced.map((u) => u.low)), highPence: Math.max(...priced.map((u) => u.high)) } : null,
    // No shop chosen: the filter asks for one (wb-category).
    ready: ctx.shop ? { shop: ctx.shop.name, count: count('ready').filter((u) => ready(u, ctx)).length } : null,
  };
}

const SORTS = {
  az: byName,
  'price-asc': (a, b) => a.low - b.low || byName(a, b),
  'price-desc': (a, b) => b.low - a.low || byName(a, b),
  newest: (a, b) => b.added - a.added || b.id - a.id,
};

function page(units, query, best) {
  const sort = SORTS[query.get('sort')] ?? best ?? byName;
  const after = Math.max(0, Number.parseInt(query.get('after') ?? '0', 10) || 0);
  const sorted = [...units].sort(sort);
  return { sorted, after, next: after + PAGE < sorted.length ? after + PAGE : null, shown: sorted.slice(after, after + PAGE) };
}

// The details every size of it shares, in its category's order.
function sharedDetails(u, details) {
  const out = [];
  for (const [id, detail] of details) {
    const first = u.items[0].answers.get(id);
    if (!first || !u.items.every((i) => i.answers.get(id)?.key === first.key)) continue;
    out.push({ name: detail.name, value: first.value, unit: detail.kind === 'number' ? detail.unit : null });
  }
  return out;
}

// A card's line: ready at the chosen shop, or sold out there; none with no shop chosen.
const cardStock = (u, ctx) => (!ctx.shop ? { line: 'none' } : { line: ready(u, ctx) ? 'ready' : 'sold-out', shop: ctx.shop.name });
// A product page's line: how many are ready, or the first other shop that has one.
function pageStock(productId, { shop, sites, free }) {
  if (!shop) return { line: 'none' };
  const qty = free(productId, shop.id);
  if (qty > 0) return { line: 'ready', shop: shop.name, qty };
  const at = sites.find((s) => s.id !== shop.id && free(productId, s.id) > 0);
  return at ? { line: 'elsewhere', shop: shop.name, at: at.name } : { line: 'sold-out', shop: shop.name };
}

function card(u, ctx) {
  return {
    id: u.id, name: u.name, brand: u.brand ?? null, photo: u.photo ?? u.items.find((i) => i.photo_url)?.photo_url ?? null,
    pricePence: u.low, priceHighPence: u.high > u.low ? u.high : null,
    details: sharedDetails(u, ctx.details), stock: cardStock(u, ctx),
  };
}

function listAnswer(units, f, ctx, ownDetails, query, best) {
  const found = units.filter((u) => passes(u, f, ctx));
  const { sorted, next, shown } = page(found, query, best);
  return { products: shown.map((u) => card(u, ctx)), total: sorted.length, after: next, filters: facets(units, f, ctx, ownDetails), shop: ctx.shop && { id: ctx.shop.id, name: ctx.shop.name } };
}

const ownDetailsOf = (ctx, categoryId) => [...ctx.details.values()].filter((x) => x.category_id === categoryId);

/** GET /api/site/products?category=&d<id>=&brand=&from=&to=&ready=&sort=&shop=&after= */
export async function productsAnswer({ query }) {
  const ctx = await catalogue(query);
  const category = ctx.categories.find((c) => c.id === idOf(query.get('category')));
  if (!category) throw new NotFound();
  const own = ownDetailsOf(ctx, category.id);
  const units = ctx.units.filter((u) => within(u.category, category.path));
  const f = filtersFrom(query, ctx.details, new Set(own.map((x) => x.id)));
  const types = ctx.categories.filter((c) => c.parent_id === category.id).map((c) => ({ id: c.id, name: c.name, products: units.filter((u) => within(u.category, c.path)).length }));
  return {
    category: { id: category.id, name: category.name, path: category.path, parentId: category.parent_id },
    types,
    ...listAnswer(units, f, ctx, own, query),
  };
}

/** GET /api/site/products/:id: a product, or a product with sizes opened from any of its sizes. */
export async function productAnswer({ query, params }) {
  const id = idOf(params.id);
  if (id === null) throw new NotFound();
  const ctx = await catalogue(query);
  const u = ctx.units.find((x) => x.items.some((i) => i.id === id));
  if (!u) throw new NotFound();
  const category = ctx.categories.find((c) => c.path === u.category);
  const photos = [...new Set([u.photo, ...u.items.map((i) => i.photo_url)].filter(Boolean))];
  const distinct = (key) => [...new Set(u.items.map((i) => i[key]).filter((v) => v !== null))];
  return {
    id: u.id, name: u.name, brand: u.brand ?? null, description: u.description,
    pricePence: u.low, priceHighPence: u.high > u.low ? u.high : null,
    category: category ? { id: category.id, name: category.name, path: category.path } : null,
    photos,
    specifications: sharedDetails(u, ctx.details),
    sizes: u.group ? distinct('size') : [],
    colours: u.group ? distinct('colour') : [],
    items: u.group ? u.items.map((i) => ({ id: i.id, size: i.size, colour: i.colour, pricePence: Number(i.price_pence), stock: pageStock(i.id, ctx) })) : [],
    // A product with sizes has its line once a size and colour are picked.
    stock: u.group ? null : pageStock(u.id, ctx),
  };
}

// Searching: every word found in a name, brand, part code, category, size or
// colour; never a supplier or barcode. Best match puts a name match first.
const wordsOf = (q) => lower(q).split(/\s+/).filter(Boolean);
const fieldsOf = (u) => [u.name, u.brand, u.category, ...u.items.flatMap((i) => [i.sku, i.size, i.colour])].map(lower);
const found = (u, words) => { const fields = fieldsOf(u); return words.every((w) => fields.some((x) => x.includes(w))); };
const inName = (u, words) => words.every((w) => lower(u.name).includes(w));
const bestFor = (words) => (a, b) => Number(!inName(a, words)) - Number(!inName(b, words)) || byName(a, b);
const named = (name, words) => words.length > 0 && words.every((w) => lower(name).includes(w));

async function repairsFor(words) {
  if (!words.length) return [];
  const prices = !!(await prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get())?.show_prices_online;
  const all = await prepare('SELECT id, name, price_pence FROM workshop_services WHERE active = 1 AND bookable_online = 1 ORDER BY name, id').all();
  return all.filter((s) => named(s.name, words)).map((s) => ({ id: s.id, name: s.name, pricePence: prices ? s.price_pence : null }));
}
const pagesFor = (words) => PAGES.filter((p) => named(p.name, words));

// "bearing 30 mm" or "bearing 30mm": the other words in a category's name, and
// that category's first number detail with that unit that a product answers
// with that value (Stock's reading, by value_key; wb-search-measure).
function measureOf(words, ctx) {
  for (let i = 0; i < words.length; i += 1) {
    const m = MEASURE.exec(words[i]);
    if (!m) continue;
    const unitWord = m[2] ?? (words[i + 1] && !MEASURE.test(words[i + 1]) ? words[i + 1] : null);
    if (!unitWord) continue;
    const rest = words.filter((_, j) => j !== i && !(j === i + 1 && !m[2]));
    if (!rest.length) continue;
    const key = `n${keyOf(m[1])}`;
    for (const category of ctx.categories.filter((c) => named(c.name, rest))) {
      const units = ctx.units.filter((u) => within(u.category, category.path));
      const detail = ownDetailsOf(ctx, category.id).find((x) => x.kind === 'number' && lower(x.unit) === lower(unitWord)
        && units.some((u) => u.items.some((it) => it.answers.get(x.id)?.key === key)));
      if (detail) return { category, detail, value: Number(m[1]), key };
    }
  }
  return null;
}

/** GET /api/site/search?q=&category=&d<id>=&brand=&from=&to=&ready=&sort=&shop=&after= */
export async function searchAnswer({ query }) {
  const words = wordsOf(query.get('q'));
  const ctx = await catalogue(query);
  const measure = measureOf(words, ctx);
  const chosen = measure?.category ?? ctx.categories.find((c) => c.id === idOf(query.get('category'))) ?? null;
  const own = chosen ? ownDetailsOf(ctx, chosen.id) : [];
  const f = filtersFrom(query, ctx.details, new Set(own.map((x) => x.id)));
  let matched;
  if (measure) {
    matched = ctx.units.filter((u) => within(u.category, measure.category.path));
    if (!f.ticks.has(measure.detail.id)) f.ticks.set(measure.detail.id, new Set([measure.key]));
  } else {
    matched = words.length ? ctx.units.filter((u) => found(u, words)) : [];
  }
  // The categories to narrow to count everything found, whatever category is picked.
  const counted = new Map();
  for (const u of matched.filter((x) => passes(x, f, ctx))) {
    const c = ctx.categories.find((x) => x.path === u.category);
    if (c) counted.set(c.id, { id: c.id, name: c.name, count: (counted.get(c.id)?.count ?? 0) + 1, path: c.path });
  }
  const units = chosen && !measure ? matched.filter((u) => within(u.category, chosen.path)) : matched;
  const answer = listAnswer(units, f, ctx, own, query, measure ? byName : bestFor(words));
  answer.filters.categories = [...counted.values()].sort((a, b) => a.path.localeCompare(b.path, 'en-GB')).map(({ id, name, count }) => ({ id, name, count }));
  return {
    ...answer,
    repairs: await repairsFor(words),
    pages: pagesFor(words),
    measure: measure && {
      category: { id: measure.category.id, name: measure.category.name },
      detail: { id: measure.detail.id, name: measure.detail.name, unit: measure.detail.unit },
      value: measure.value,
    },
  };
}

const SUGGESTED = 4;

/** GET /api/site/suggest?q=&shop=: from the second letter, a few of each kind (wb-search-typing). */
export async function suggestAnswer({ query }) {
  const q = String(query.get('q') ?? '').trim();
  if (q.length < 2) return { products: [], repairs: [], categories: [], pages: [] };
  const words = wordsOf(q);
  const ctx = await catalogue(query);
  const products = ctx.units.filter((u) => found(u, words)).sort(bestFor(words)).slice(0, SUGGESTED);
  return {
    products: products.map((u) => ({ id: u.id, name: u.name, code: u.group ? null : u.items[0].sku ?? null, pricePence: u.low, stock: cardStock(u, ctx) })),
    repairs: (await repairsFor(words)).slice(0, SUGGESTED),
    categories: ctx.categories.filter((c) => named(c.name, words)).slice(0, SUGGESTED).map((c) => ({ id: c.id, name: c.name, path: c.path })),
    pages: pagesFor(words),
  };
}
