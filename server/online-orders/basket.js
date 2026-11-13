// The basket, priced by the shop (openspec/changes/website-buy-online, design
// 2; drawings on-basket, on-basket-changed). The browser keeps only which
// products and how many; every price, total and stock line is worked out here
// from the database, so nothing else it sends is read. Runs inside the shop
// the website's address names (runWithShop), so row-level security keeps it
// to that business: another business's product or shop is never found.
import { prepare } from '../db.js';
import { OPEN as C2W_OPEN } from '../c2w/orders.js';
import { paymentsConnected } from '../payments/provider.js';
import { payments } from '../payments/index.js';

export const NOT_TAKING = 'Not taking online orders right now. Ask in the shop, or call us, to buy this';
export const CHOOSE_SHOP = 'Choose a shop to see when it’s ready';
export const CHANGED = 'Something in your basket changed. Sort the lines marked below before checking out.';
export const GONE_FIRST = 'Remove the item that’s no longer in stock first.';
export const EMPTY = 'Your basket is empty.';

// What one basket may hold: a few dozen lines is far beyond a shop's counter,
// and a quantity beyond any shelf is answered by the stock check anyway.
const MAX_LINES = 50;
const MAX_QTY = 999;
const isId = (v) => Number.isInteger(v) && v > 0 && v <= 2_147_483_647;

/**
 * Whether this shop takes orders online now: Buying online on, payments
 * connected on a server with a provider, and a website that isn't its Shopify
 * shop (design 3; specs/website "With buying online off").
 */
export async function takingOrders() {
  const settings = await prepare('SELECT buying_online FROM online_order_settings').get();
  if (!settings?.buying_online || !payments()) return false;
  const website = await prepare('SELECT kind FROM website').get();
  if (website?.kind === 'shopify') return false;
  return paymentsConnected();
}

/** The lines as sent, product and quantity only, one per product; null when they aren't lines. */
export function readLines(lines) {
  if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;
  const byProduct = new Map();
  for (const line of lines) {
    if (!line || !isId(line.productId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) return null;
    byProduct.set(line.productId, Math.min(MAX_QTY, (byProduct.get(line.productId) ?? 0) + line.qty));
  }
  return [...byProduct].map(([productId, qty]) => ({ productId, qty }));
}

/** The collecting shop: the one asked for, or the only one. Null when it has to be chosen. */
export async function collectingShop(asked) {
  const sites = await prepare('SELECT id, name FROM sites ORDER BY id').all();
  if (sites.length === 1) return { site: sites[0], sites };
  const site = sites.find((s) => s.id === asked) ?? null;
  return site ? { site, sites } : null;
}

// How many of each product are free at each shop, in three queries for the
// whole basket: its frames in stock there, or for a product with no frame
// numbers its stock figure less the Cycle to Work orders holding it there.
// The same count as freeHere (c2w/orders.js), for every line at once.
async function freeStock(ids) {
  const free = new Map();
  const add = (productId, siteId, n) => free.set(`${productId}:${siteId}`, (free.get(`${productId}:${siteId}`) ?? 0) + n);
  const frames = await prepare(
    "SELECT product_id, site_id, count(*) FILTER (WHERE state = 'in_stock')::int AS n FROM stock_frames WHERE product_id = ANY(?::int[]) GROUP BY product_id, site_id"
  ).all(ids);
  const framed = new Set(frames.map((f) => f.product_id));
  for (const f of frames) add(f.product_id, f.site_id, f.n);
  for (const s of await prepare('SELECT product_id, site_id, qty FROM product_stock WHERE product_id = ANY(?::int[])').all(ids)) {
    if (!framed.has(s.product_id)) add(s.product_id, s.site_id, s.qty);
  }
  const holds = await prepare(
    `SELECT product_id, site_id, count(*)::int AS n FROM c2w_orders
      WHERE product_id = ANY(?::int[]) AND held_at IS NOT NULL AND stage IN ${C2W_OPEN} GROUP BY product_id, site_id`
  ).all(ids);
  for (const h of holds) if (!framed.has(h.product_id)) add(h.product_id, h.site_id, -h.n);
  return (productId, siteId) => Math.max(0, free.get(`${productId}:${siteId}`) ?? 0);
}

/**
 * Prices the lines at the collecting shop. Each line: the product's own price,
 * the stock line, and what changed — fewer left (the quantity comes down to
 * what's there) or gone (none here; it names the shops with none). A product
 * not on the website (hidden, inactive or unpriced) is gone too, and is
 * neither named nor priced, so the public basket can't list it.
 */
export async function priceBasket(lines, site, sites) {
  const ids = lines.map((l) => l.productId);
  const products = new Map((await prepare(
    'SELECT id, name, sku, price_pence FROM products WHERE id = ANY(?::int[]) AND show_online AND active = 1 AND price > 0'
  ).all(ids)).map((p) => [p.id, p]));
  const freeAt = await freeStock(ids);
  const priced = [];
  for (const { productId, qty } of lines) {
    const p = products.get(productId);
    const free = p ? freeAt(productId, site.id) : 0;
    const line = { productId, name: p?.name ?? null, code: p?.sku ?? null, qty, unitPence: p ? Number(p.price_pence) : null, linePence: 0, stockLine: null, change: null, message: null };
    if (free === 0) {
      const none = sites.filter((s) => s.id === site.id || !p || freeAt(productId, s.id) === 0).map((s) => s.name);
      Object.assign(line, { change: 'gone', message: `No longer in stock at ${none.join(' or ')} — remove it to carry on` });
    } else {
      if (free < qty) Object.assign(line, { qty: free, change: 'fewer', message: `Only ${free} left at ${site.name} — we’ve changed it to ${free}` });
      Object.assign(line, { linePence: line.unitPence * line.qty, stockLine: `Ready today at ${site.name}` });
    }
    priced.push(line);
  }
  const live = priced.filter((l) => l.change !== 'gone');
  const changed = priced.some((l) => l.change);
  const gone = priced.some((l) => l.change === 'gone');
  return {
    takingOrders: true,
    shop: { id: site.id, name: site.name },
    lines: priced,
    itemCount: live.reduce((n, l) => n + l.qty, 0),
    totalPence: live.reduce((n, l) => n + l.linePence, 0),
    collect: `Collect from ${site.name}`,
    changed: changed ? CHANGED : null,
    canCheckout: live.length > 0 && !changed,
    checkoutOff: gone ? GONE_FIRST : null,
  };
}
