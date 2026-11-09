// Sizes and colours on the new Stock (openspec/changes/sizes-and-colours; stock control
// decision 4; Jack's answer 5). Each size and colour is its own row in products, joined in
// a group; these read them as one product. The screens are WP-1.5 pieces 9 (st-list,
// st-search-size) and 10 (st-product-sizes). Anyone signed in, as Stock is; a cost only to
// someone who can see costs. Staff routes: they run with the shop's row-level security bound.
import { dbExec, prepare } from '../db.js';
import { notFound, sendJson } from '../lib/http.js';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { newestFirst, priceChangesOf } from '../lib/price-changes.js';
import { oldestSite } from '../lib/stock.js';
import { siteHere } from './purchase-orders.js';
import { isBike } from '../lib/bikes.js';

const db = { prepare, exec: dbExec };

const same = (a, b) => a.toLocaleLowerCase('en-GB') === b.toLocaleLowerCase('en-GB');
const has = (text, word) => (text ?? '').toLocaleLowerCase('en-GB').includes(word.toLocaleLowerCase('en-GB'));
const below = (p) => p.stock_qty < 0;
const low = (p) => p.stock_qty >= 0 && p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold;

function productRow(p, costs) {
  return {
    kind: 'product', id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, category: p.category, supplier: p.supplier,
    stockQty: p.stock_qty, lowStockThreshold: p.low_stock_threshold, pricePence: p.price_pence, costPence: costs ? p.cost_pence : null, active: !!p.active,
    vatRateBp: p.vat_rate_bp,
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
    // A margin needs one rate: none when its sizes differ.
    vatRateBp: items.every((p) => p.vat_rate_bp === items[0].vat_rate_bp) ? items[0].vat_rate_bp : null,
  };
}

// Every word must be found. A word is found in a name, code, barcode or supplier, or is a
// size's or colour's whole name. A whole barcode or code is that size (decision 4: "Scanning
// a barcode or searching 'jersey M' opens that size and colour"); a size or colour named is
// that size in each colour it comes in; otherwise a group found is the group. A measurement,
// "30 mm" or "30mm", is found in a number detail with that unit and that value (decision 10:
// "bearing 30 mm"), or written so in a name; digits and letters with no detail of that unit
// ("700c") only in a name; a number on its own in a name or code, or any number detail.
function matches(p, g, conds, whole) {
  if (whole && [p.barcode, p.sku].some((v) => v && same(v, whole))) return 'exact';
  let bySize = false;
  for (const { w, also, ids } of conds) {
    if (!also && [p.size, p.colour].some((v) => v && same(v, w))) { bySize = true; continue; }
    // In its name, code, barcode or supplier (every word of a measurement written apart),
    // or a detail answering it.
    const inText = [w, ...(also ? [also] : [])].every((x) => [g?.name ?? p.name, p.sku, p.barcode, p.supplier].some((v) => has(v, x)));
    if (!inText && !ids?.has(p.id)) return null;
  }
  return bySize ? 'size' : 'name';
}

const MEASURE = /^(-?\d{1,9}(?:\.\d{1,4})?)([a-z]+)?$/i;
const keyOf = (n) => Math.round(Number(n) * 10000);
// The products with a number answer of `n`, in any of `detailIds`: an = on whole numbers,
// which row-level security lets the index serve (migration 121).
async function answering(detailIds, n) {
  if (detailIds.length === 0) return new Set();
  return new Set((await db.prepare('SELECT product_id FROM product_details WHERE detail_id = ANY(?::int[]) AND value_key = ?')
    .all(detailIds, keyOf(n))).map((r) => r.product_id));
}
// The words, with a measurement as one: each with the products whose details it names.
async function conditionsOf(words) {
  if (!words.some((w) => MEASURE.test(w))) return words.map((w) => ({ w }));
  const numbers = await db.prepare("SELECT id, unit FROM category_details WHERE kind = 'number'").all();
  const withUnit = (u) => numbers.filter((d) => d.unit && same(d.unit, u)).map((d) => d.id);
  const conds = [];
  for (let i = 0; i < words.length; i += 1) {
    const m = MEASURE.exec(words[i]);
    if (!m) { conds.push({ w: words[i] }); continue; }
    // "700c", "29er", "12v": a measurement only where some detail has that unit; and
    // either way found in a name too (the review).
    if (m[2]) {
      const ids = withUnit(m[2]).length ? await answering(withUnit(m[2]), m[1]) : undefined;
      conds.push({ w: words[i], ids });
    } else if (words[i + 1] && withUnit(words[i + 1]).length) {
      conds.push({ w: words[i], also: words[i + 1], ids: await answering(withUnit(words[i + 1]), m[1]) });
      i += 1;
    } else {
      conds.push({ w: words[i], ids: await answering(numbers.map((d) => d.id), m[1]) });
    }
  }
  return conds;
}
// A category picked takes those inside it; each detail picked narrows it (st-filter-bearings).
async function filtersOf(query) {
  const category = String(query.get('category') ?? '').trim() || null;
  const sets = [];
  for (const [key, value] of query.entries()) {
    const id = /^d(\d{1,9})$/.exec(key)?.[1];
    if (!id) continue;
    const detail = await db.prepare('SELECT id, kind, choices FROM category_details WHERE id = ?').get(Number(id));
    if (!detail) { sets.push(new Set()); continue; }
    if (detail.kind === 'number') {
      sets.push(MEASURE.test(value) && !MEASURE.exec(value)[2] ? await answering([detail.id], value) : new Set());
    } else {
      const text = detail.kind === 'choice' ? detail.choices.find((c) => same(c, value)) ?? value : value.trim();
      sets.push(new Set((await db.prepare('SELECT product_id FROM product_details WHERE detail_id = ? AND value_text = ?').all(detail.id, text)).map((r) => r.product_id)));
    }
  }
  const keep = (p) => (!category || p.category === category || p.category.startsWith(`${category} › `)) && sets.every((s) => s.has(p.id));
  keep.category = category;
  return keep;
}

// Each product and size row's answers, { detailId: value }, a number as a number.
async function withAnswers(rows) {
  const ids = rows.filter((r) => r.kind !== 'group').map((r) => r.id);
  const answers = ids.length ? await db.prepare('SELECT product_id, detail_id, value_number, value_text FROM product_details WHERE product_id = ANY(?::int[])').all(ids) : [];
  const byProduct = new Map(ids.map((id) => [id, {}]));
  for (const a of answers) byProduct.get(a.product_id)[a.detail_id] = a.value_number === null ? a.value_text : Number(a.value_number);
  for (const r of rows) if (r.kind !== 'group') r.details = byProduct.get(r.id);
}

export function register(route) {
  route('GET', '/api/stock-list', async (req, res, params, query) => {
    const costs = await canSeeCosts(req);
    const all = query.get('all') === '1';
    const search = String(query.get('search') ?? '').trim();
    const words = await conditionsOf(search.split(/\s+/).filter(Boolean));
    const kept = await filtersOf(query);
    const groups = new Map((await db.prepare('SELECT id, name, category FROM product_groups').all()).map((g) => [g.id, g]));
    const products = await db.prepare(`SELECT * FROM products ${all ? '' : 'WHERE active = 1'} ORDER BY category, name, id`).all();
    const singles = new Map();
    const grouped = new Map();
    for (const p of products) {
      if (!kept(p)) continue;
      const g = p.group_id === null ? null : groups.get(p.group_id);
      if (!g) {
        if (!words.length || matches(p, null, words, search)) singles.set(p.id, productRow(p, costs));
        continue;
      }
      if (!grouped.has(g.id)) grouped.set(g.id, { g, items: [], found: [], sized: false });
      const entry = grouped.get(g.id);
      entry.items.push(p);
      const how = words.length ? matches(p, g, words, search) : 'name';
      if (how) entry.found.push(p);
      if (how === 'exact' || how === 'size') entry.sized = true;
    }
    // A bike's frames in stock, for its line (st-list: "[n] bikes, each by frame number").
    const bikes = [...singles.values()].filter((r) => isBike(r.category)).map((r) => r.id);
    if (bikes.length) {
      const counts = new Map((await db.prepare(
        "SELECT product_id, count(*)::int AS n FROM stock_frames WHERE state = 'in_stock' AND product_id = ANY(?::int[]) GROUP BY product_id"
      ).all(bikes)).map((c) => [c.product_id, c.n]));
      for (const id of bikes) singles.get(id).framesInStock = counts.get(id) ?? 0;
    }
    // Products and products with sizes together, by category then name, as the database
    // orders them; a size found by a search sits where its product with sizes would.
    const order = await db.prepare(
      `SELECT 'product' AS kind, id, category, name FROM products WHERE group_id IS NULL ${all ? '' : 'AND active = 1'}
       UNION ALL SELECT 'group', id, category, name FROM product_groups
       ORDER BY category, name, kind, id`
    ).all();
    const rows = [];
    for (const o of order) {
      if (o.kind === 'product') {
        if (singles.has(o.id)) rows.push(singles.get(o.id));
        continue;
      }
      const entry = grouped.get(o.id);
      if (!entry?.found.length) continue;
      const { g, items, found, sized } = entry;
      if (sized) rows.push(...found.filter((p) => matches(p, g, words, search) !== 'name').map((p) => sizeRow(p, g, costs)));
      else rows.push(groupRow(g, items, costs));
    }
    // A category's details as columns (st-filter-bearings) and a measurement's line
    // (st-search-measure) need each row's answers: only then, for just the rows sent.
    // A measurement is one some detail answers: a number found only in a name isn't (the review).
    if (kept.category || words.some((c) => c.ids?.size)) await withAnswers(rows);
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
    const ids = items.map((p) => p.id);
    // Its page (product-page-sizes, design 3): each shop's total of its sizes, as a product's
    // page has its own, and one history for all its sizes, each line saying which.
    const shops = await db.prepare(
      `SELECT s.id, s.name, COALESCE(SUM(ps.qty), 0)::int AS qty FROM sites s
         LEFT JOIN product_stock ps ON ps.site_id = s.id AND ps.product_id = ANY(?::int[]) GROUP BY s.id, s.name ORDER BY s.id`
    ).all(ids);
    const here = (await siteHere(req)) ?? await oldestSite();
    const moves = await db.prepare(
      `SELECT m.id, m.product_id, m.type, m.change_qty, m.note, m.reason, COALESCE(m.who_name, l.name) AS who, m.created_at
         FROM stock_movements m LEFT JOIN logins l ON l.id = m.login_id
        WHERE m.product_id = ANY(?::int[]) ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
    ).all(ids);
    const which = (productId) => {
      const p = items.find((x) => x.id === productId);
      return { size: p?.size ?? null, colour: p?.colour ?? null };
    };
    const rates = distinct(items.map((p) => (p.vat_rate_bp === null ? null : String(p.vat_rate_bp))));
    sendJson(res, 200, {
      id: g.id, name: g.name, category: g.category, description: g.description, photoUrl: g.photo_url,
      sizes: distinct(items.map((p) => p.size)), colours: distinct(items.map((p) => p.colour)),
      items: items.map((p) => ({ ...productRow(p, costs), size: p.size, colour: p.colour })),
      // One VAT rate when every size shares it, for a margin; none otherwise.
      vatRateBp: rates.length === 1 && items.every((p) => p.vat_rate_bp !== null) ? Number(rates[0]) : null,
      stockAtShops: shops.map((s) => ({ id: s.id, name: s.name, qty: s.qty, here: s.id === here })),
      history: newestFirst([
        ...moves.map((m) => ({ id: m.id, type: m.type, change: m.change_qty, reason: m.reason, note: m.note || '', who: m.who, at: m.created_at, ...which(m.product_id) })),
        ...(await priceChangesOf(ids, costs)).map((c) => ({ ...c, ...which(c.productId) })),
      ]),
    });
  });
}
