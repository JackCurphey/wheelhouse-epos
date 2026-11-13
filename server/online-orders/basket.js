// The website's basket (openspec/changes/website-buy-online, design 2; drawings
// on-basket, on-basket-changed, on-checkout-credit, on-checkout-credit-all).
// The browser keeps only which products and how many: every name, price, total
// and stock line is worked out here, from the shop's own products, each time.
import { prepare } from '../db.js';
import { parseCookies } from '../lib/http.js';
import { getCustomerSessionContext } from '../customer-auth.js';
import { paymentsConnected } from '../payments/provider.js';
import { creditOf } from '../lib/customer-money.js';
import { ONLINE, freeStock } from '../site-products.js';

export const NOT_TAKING = 'Not taking online orders right now. Ask in the shop, or call us, to buy this';
export const CHANGED = 'Something in your basket changed. Sort the lines marked below before checking out.';
export const REMOVE_FIRST = 'Remove the item that’s no longer in stock first.';
export const COVERS = 'Your store credit covers the whole order — nothing to pay by card.';

// A basket is a handful of lines; more than this, or more of one thing than a
// shop would hand over, isn't a customer's basket (decided while building,
// Jack's November file).
export const MOST_LINES = 50;
export const MOST_OF_ONE = 99;

export class BasketError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const id = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);

/** The lines asked for, the same product twice made one; throws BasketError when they aren't ids and counts. */
export function linesFrom(lines) {
  if (!Array.isArray(lines) || lines.length > MOST_LINES) throw new BasketError('That basket can’t be read');
  const merged = new Map();
  for (const line of lines) {
    const productId = id(line?.productId);
    const qty = id(line?.qty);
    if (productId === null || qty === null || qty > MOST_OF_ONE) throw new BasketError('That basket can’t be read');
    merged.set(productId, Math.min(MOST_OF_ONE, (merged.get(productId) ?? 0) + qty));
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

/** Whether the shop takes online orders now: buying online switched on and payments connected (design 2). */
export async function takingOrders() {
  // A plain read: onlineOrderSettings() makes the row, which a visitor never should.
  const settings = await prepare('SELECT buying_online, store_credit_on FROM online_order_settings LIMIT 1').get();
  return { taking: !!settings?.buying_online && (await paymentsConnected()), creditOnline: settings ? settings.store_credit_on : true };
}

/** The signed-in customer of this shop, or null: another shop's sign-in is a guest here. */
export async function customerOf(req, shop) {
  const ctx = await getCustomerSessionContext(parseCookies(req).wh_customer_session);
  if (!ctx || ctx.shop.id !== shop.id) return null;
  const customer = await prepare('SELECT id, name, phone FROM customers WHERE id = ? AND deleted_at IS NULL AND merged_into_id IS NULL').get(ctx.login.customer_id);
  return customer ? { id: customer.id, name: customer.name ?? '', email: ctx.login.email ?? '', phone: customer.phone ?? '' } : null;
}

// Store credit is offered online only when the shop has it on (Payments) and on
// for online orders (Online orders settings).
async function creditFor(customer, creditOnline, totalPence) {
  if (!customer || !creditOnline) return null;
  const shopWide = await prepare('SELECT store_credit_on FROM payment_settings LIMIT 1').get();
  if (!shopWide?.store_credit_on) return null;
  const availablePence = await creditOf(customer.id);
  if (availablePence <= 0) return null;
  const usePence = Math.min(availablePence, totalPence);
  return { availablePence, usePence, leftToPayPence: totalPence - usePence, coversAll: usePence === totalPence && totalPence > 0 ? COVERS : null };
}

function stockLine(productId, shop, sites, free) {
  if (!shop) return { line: 'none' };
  const qty = free(productId, shop.id);
  if (qty > 0) return { line: 'ready', shop: shop.name, qty };
  const at = sites.find((s) => s.id !== shop.id && free(productId, s.id) > 0);
  return at ? { line: 'elsewhere', shop: shop.name, at: at.name } : { line: 'sold-out', shop: shop.name };
}

// "Bolton or [Second site]"; with three, "Bolton, [Second site] or [Third site]".
const shopNames = (sites) => {
  const names = sites.map((s) => s.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names.join('');
};

function priced(asked, product, shop, sites, free) {
  if (!product) return { productId: asked.productId, name: null, code: null, pricePence: null, qty: asked.qty, linePence: 0, stock: null, note: null, gone: true };
  const stock = stockLine(product.id, shop, sites, free);
  const line = { productId: product.id, name: product.name, code: product.sku ?? null, pricePence: Number(product.price_pence), qty: asked.qty, stock, note: null, gone: false };
  if (stock.line === 'ready' && stock.qty < asked.qty) {
    line.qty = stock.qty;
    line.note = `Only ${stock.qty} left at ${shop.name} — we’ve changed it to ${stock.qty}`;
  } else if (stock.line === 'elsewhere') {
    line.gone = true;
    line.note = `Sold out at ${shop.name} — in stock at our ${stock.at} shop`;
  } else if (stock.line === 'sold-out') {
    line.gone = true;
    line.note = `No longer in stock at ${shopNames(sites)} — remove it to carry on`;
  }
  // No shop chosen ('none'): nothing to say per line; checkout asks for one.
  line.linePence = line.gone ? 0 : line.pricePence * line.qty;
  return line;
}

/**
 * The basket as the customer sees it: `lines` from linesFrom, collected from
 * the site `shopId` (the only site when there is one).
 */
export async function basketAnswer({ req, shop, lines, shopId }) {
  const sites = await prepare('SELECT id, name FROM sites ORDER BY id').all();
  const chosen = sites.length === 1 ? sites[0] : sites.find((s) => s.id === id(shopId)) ?? null;
  const ids = lines.map((l) => l.productId);
  const products = ids.length ? await prepare(`SELECT id, name, sku, price_pence FROM products WHERE id = ANY(?::int[]) AND ${ONLINE}`).all(ids) : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const free = await freeStock(ids);
  const priceLines = lines.map((l) => priced(l, byId.get(l.productId), chosen, sites, free));
  const { taking, creditOnline } = await takingOrders();
  const totalPence = priceLines.reduce((sum, l) => sum + l.linePence, 0);
  const customer = await customerOf(req, shop);
  const changed = priceLines.some((l) => l.gone || l.qty !== lines.find((a) => a.productId === l.productId).qty);
  return {
    taking,
    notTaking: taking ? null : NOT_TAKING,
    shop: chosen && { id: chosen.id, name: chosen.name },
    lines: priceLines,
    count: priceLines.reduce((n, l) => n + (l.gone ? 0 : l.qty), 0),
    totalPence,
    changed: changed ? CHANGED : null,
    blocked: priceLines.some((l) => l.gone) ? REMOVE_FIRST : null,
    you: customer && { name: customer.name, email: customer.email, phone: customer.phone },
    credit: await creditFor(customer, creditOnline, totalPence),
    customer,
  };
}
