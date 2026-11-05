// Sizes and colours on the new Stock (openspec/changes/sizes-and-colours; stock control
// decision 4; Jack's answer 5). Each size and colour is its own row in products, joined in
// a group; these read them as one product. The screens are WP-1.5 pieces 9 (st-list,
// st-search-size) and 10 (st-product-sizes). Anyone signed in, as Stock is; a cost only to
// someone who can see costs. Staff routes: they run with the shop's row-level security bound.
import { dbExec, prepare } from '../db.js';
import { notFound, sendJson } from '../lib/http.js';
import { canSeeCosts } from '../lib/can-see-costs.js';

const db = { prepare, exec: dbExec };

const same = (a, b) => a.toLocaleLowerCase('en-GB') === b.toLocaleLowerCase('en-GB');
const has = (text, word) => (text ?? '').toLocaleLowerCase('en-GB').includes(word.toLocaleLowerCase('en-GB'));
const below = (p) => p.stock_qty < 0;
const low = (p) => p.stock_qty >= 0 && p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold;

function productRow(p, costs) {
  return {
    kind: 'product', id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, category: p.category, supplier: p.supplier,
    stockQty: p.stock_qty, lowStockThreshold: p.low_stock_threshold, pricePence: p.price_pence, costPence: costs ? p.cost_pence : null, active: !!p.active,
  };
}
function sizeRow(p, g, costs) {
  return { ...productRow(p, costs), kind: 'size', name: g.name, groupId: g.id, size: p.size, colour: p.colour };
}
const distinct = (values) => values.filter((v, i) => v !== null && values.findIndex((o) => o !== null && same(o, v)) === i);
function groupRow(g, items, costs) {
  const prices = items.map((p) => p.price_pence);
  const cost = items.map((p) => p.cost_pence);
  return {
    kind: 'group', groupId: g.id, name: g.name, category: g.category,
    sizes: distinct(items.map((p) => p.size)).length, colours: distinct(items.map((p) => p.colour)).length,
    stockQty: items.reduce((n, p) => n + p.stock_qty, 0),
    sizesBelowZero: items.filter(below).length, sizesRunningLow: items.filter(low).length,
    // Facts, not words: how a range of prices reads is the screen's (piece 9).
    priceLowPence: Math.min(...prices), priceHighPence: Math.max(...prices),
    costLowPence: costs ? Math.min(...cost) : null, costHighPence: costs ? Math.max(...cost) : null,
    active: items.some((p) => p.active),
  };
}

// Every word must be found. A word is found in a name, code, barcode or supplier, or is a
// size's or colour's whole name. A whole barcode or code is that size (decision 4: "Scanning
// a barcode or searching 'jersey M' opens that size and colour"); a size or colour named is
// that size in each colour it comes in; otherwise a group found is the group.
function matches(p, g, words, whole) {
  if (whole && [p.barcode, p.sku].some((v) => v && same(v, whole))) return 'exact';
  let bySize = false;
  for (const w of words) {
    if ([p.size, p.colour].some((v) => v && same(v, w))) { bySize = true; continue; }
    if (![g?.name ?? p.name, p.sku, p.barcode, p.supplier].some((v) => has(v, w))) return null;
  }
  return bySize ? 'size' : 'name';
}

export function register(route) {
  route('GET', '/api/stock-list', async (req, res, params, query) => {
    const costs = await canSeeCosts(req);
    const all = query.get('all') === '1';
    const search = String(query.get('search') ?? '').trim();
    const words = search.split(/\s+/).filter(Boolean);
    const groups = new Map((await db.prepare('SELECT id, name, category FROM product_groups').all()).map((g) => [g.id, g]));
    const products = await db.prepare(`SELECT * FROM products ${all ? '' : 'WHERE active = 1'} ORDER BY category, name, id`).all();
    const rows = [];
    const grouped = new Map();
    for (const p of products) {
      const g = p.group_id === null ? null : groups.get(p.group_id);
      if (!g) {
        if (!words.length || matches(p, null, words, search)) rows.push(productRow(p, costs));
        continue;
      }
      if (!grouped.has(g.id)) grouped.set(g.id, { g, items: [], found: [], sized: false });
      const entry = grouped.get(g.id);
      entry.items.push(p);
      const how = words.length ? matches(p, g, words, search) : 'name';
      if (how) entry.found.push(p);
      if (how === 'exact' || how === 'size') entry.sized = true;
    }
    for (const { g, items, found, sized } of grouped.values()) {
      if (!found.length) continue;
      if (sized) rows.push(...found.filter((p) => matches(p, g, words, search) !== 'name').map((p) => sizeRow(p, g, costs)));
      else rows.push(groupRow(g, items, costs));
    }
    sendJson(res, 200, { rows });
  });

  // A group's page (st-product-sizes): its sizes and colours in the order they were made,
  // and each one with its own barcode, stock and price, for the grid.
  route('GET', '/api/product-groups/:id', async (req, res, params) => {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return notFound(res, 'Product not found');
    const g = await db.prepare('SELECT * FROM product_groups WHERE id = ?').get(id);
    if (!g) return notFound(res, 'Product not found');
    const costs = await canSeeCosts(req);
    const items = await db.prepare('SELECT * FROM products WHERE group_id = ? ORDER BY id').all(id);
    sendJson(res, 200, {
      id: g.id, name: g.name, category: g.category, description: g.description, photoUrl: g.photo_url,
      sizes: distinct(items.map((p) => p.size)), colours: distinct(items.map((p) => p.colour)),
      items: items.map((p) => ({ ...productRow(p, costs), size: p.size, colour: p.colour })),
    });
  });
}
