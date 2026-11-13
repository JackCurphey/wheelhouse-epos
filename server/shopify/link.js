// A shop's link to its own Shopify shop (openspec/changes/website-management
// design 7): the check before sending (ws-shopify-check), Send, Pause and
// Resume. Every function runs inside the request's shop (runWithShop). The
// sending itself is the background job in sending.js.
import { prepare } from '../db.js';
import { shopify } from './index.js';

export class ShopifyError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const NOT_CONNECTED = () => new ShopifyError(409, 'Connect Shopify first.', 'shopify_not_connected');
export const PROBLEM_WORDS = { no_price: 'No price yet', no_photo: 'No photo — Shopify needs one for this category', no_answer: 'Shopify didn’t answer — try sending again' };

/** The link with this server's Shopify, unless the shop has stopped using it. */
export async function readLink() {
  const provider = shopify();
  if (!provider) return null;
  return (await prepare("SELECT * FROM shopify_link WHERE provider = ? AND state <> 'stopped'").get(provider.name)) ?? null;
}

/** The Website page's Shopify part (ws-shopify-on, -sending, -problem), or null. */
export async function linkState() {
  const link = await readLink();
  if (!link) return null;
  return {
    address: link.address, state: link.state, total: link.total, sentCount: link.sent_count,
    lastSentAt: link.last_sent_at, products: link.product_count, problems: link.problems,
  };
}

/**
 * What Wheelhouse sends: active products shown online (design 7), as Shopify
 * takes them. The stock leaves out bikes held for Cycle to Work orders, so a
 * held bike shows as sold out (ws-shopify-connect; walk-through 5 M4).
 */
export async function productsToSend(ids = null) {
  const rows = await prepare(
    `SELECT p.id, p.sku, p.name, p.category, p.price, p.photo_url,
            p.stock_qty - (SELECT count(*) FROM stock_frames f WHERE f.product_id = p.id AND f.state = 'held') AS stock_qty
       FROM products p
      WHERE p.active = 1 AND p.show_online${ids ? ' AND p.id = ANY(?::int[])' : ''} ORDER BY p.id`
  ).all(...(ids ? [ids] : []));
  return rows.map((r) => ({
    wheelhouseId: r.id, sku: r.sku, title: r.name, category: r.category,
    pricePence: Math.round(Number(r.price) * 100), photoUrl: r.photo_url || null, stock: Math.max(0, Number(r.stock_qty)),
  }));
}

// Each Wheelhouse product against Shopify's: matched on Wheelhouse's id, then SKU.
export function compare(ours, theirs) {
  const byId = new Map(theirs.filter((p) => p.wheelhouseId != null).map((p) => [String(p.wheelhouseId), p]));
  const bySku = new Map(theirs.filter((p) => p.sku).map((p) => [p.sku, p]));
  const matched = new Set();
  const changing = [];
  const noPrice = [];
  for (const product of ours) {
    if (product.pricePence <= 0) { noPrice.push(product); continue; }
    const there = byId.get(String(product.wheelhouseId)) ?? bySku.get(product.sku);
    if (there) matched.add(there);
    const changes = !there ? ['added'] : [
      there.pricePence !== product.pricePence && 'price',
      product.photoUrl && there.photoUrl !== product.photoUrl && 'photo',
      there.stock !== product.stock && 'stock',
    ].filter(Boolean);
    if (changes.length) changing.push({ ...product, changes });
  }
  // Products only in Shopify are left as they are (defaults taken 12 Nov, item 2).
  return { changing, noPrice, onlyInShopify: theirs.filter((p) => !matched.has(p)) };
}

async function linkOrRefuse() {
  const link = await readLink();
  if (!link) throw NOT_CONNECTED();
  return link;
}

/** ws-shopify-check: what Send would change. Nothing is sent. */
export async function preview() {
  const link = await linkOrRefuse();
  const { changing, noPrice, onlyInShopify } = compare(await productsToSend(), await shopify().listProducts(link.address));
  const count = (kind) => changing.filter((p) => p.changes.includes(kind)).length;
  return {
    address: link.address, count: changing.length,
    newPrices: count('price'), newPhotos: count('photo'), newStock: count('stock'), added: count('added'),
    onlyInShopify: onlyInShopify.length, noPrice: noPrice.length,
    // Listed under the drawn “See the list of products” (defaults taken 12 Nov, item 2).
    onlyInShopifyProducts: onlyInShopify.map((p) => ({ sku: p.sku, name: p.title })),
    products: changing.map((p) => ({ id: p.wheelhouseId, sku: p.sku, name: p.title, changes: p.changes })),
  };
}

export const noPriceProblem = (p) => ({ productId: p.wheelhouseId, sku: p.sku, name: p.title, kind: 'no_price', reason: PROBLEM_WORDS.no_price });

/** Send [n] products, and Try sending again: queues what changes for the background job. */
export async function startSending() {
  const link = await linkOrRefuse();
  if (link.state === 'paused') throw new ShopifyError(409, 'Sending is paused. Resume it first.', 'shopify_paused');
  const { changing, noPrice } = compare(await productsToSend(), await shopify().listProducts(link.address));
  const ids = changing.map((p) => p.wheelhouseId);
  // Only from idle: a send still going would mix its counts into this one.
  const done = await prepare(
    `UPDATE shopify_link SET state = CASE WHEN cardinality(?::int[]) = 0 THEN 'idle' ELSE 'sending' END,
            to_send = ?::int[], total = cardinality(?::int[]), sent_count = 0, problems = ?::jsonb,
            last_sent_at = CASE WHEN cardinality(?::int[]) = 0 THEN now() ELSE last_sent_at END,
            product_count = CASE WHEN cardinality(?::int[]) = 0 THEN ? ELSE product_count END, updated_at = now()
      WHERE provider = ? AND state = 'idle' RETURNING state`
  ).get(ids, ids, ids, JSON.stringify(noPrice.map(noPriceProblem)), ids, ids, ids.length ? 0 : await countInShopify(link.address), link.provider);
  if (!done) throw new ShopifyError(409, 'Wheelhouse is still sending to Shopify. Wait for it to finish.', 'shopify_sending');
  return done.state === 'sending';
}

export async function pause() {
  const done = await prepare(
    "UPDATE shopify_link SET state = 'paused', updated_at = now() WHERE provider = ? AND state IN ('idle', 'sending') RETURNING shop_id"
  ).get((await linkOrRefuse()).provider);
  if (!done) throw new ShopifyError(409, 'Sending is already paused.', 'shopify_paused');
}

/** Carries on with what was waiting; true when there is some. */
export async function resume() {
  const link = await linkOrRefuse();
  const done = await prepare(
    `UPDATE shopify_link SET state = CASE WHEN cardinality(to_send) > 0 THEN 'sending' ELSE 'idle' END, updated_at = now()
      WHERE provider = ? AND state = 'paused' RETURNING state`
  ).get(link.provider);
  if (!done) throw new ShopifyError(409, 'Sending isn’t paused.', 'shopify_not_paused');
  return done.state === 'sending';
}

/** Back from approving on Shopify: linked, with nothing sent yet. */
export async function saveLink(provider, address, loginId) {
  await prepare(
    `INSERT INTO shopify_link (provider, address, connected_by) VALUES (?, ?, ?)
     ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, address = EXCLUDED.address,
       connected_by = EXCLUDED.connected_by, connected_at = now(), state = 'idle', to_send = '{}', total = 0,
       sent_count = 0, problems = '[]', last_sent_at = NULL, product_count = 0, updated_at = now()
     RETURNING shop_id`
  ).run(provider, address, loginId);
  // A new link starts from Send, so nothing queued for an earlier one carries over.
  await prepare('DELETE FROM shopify_changed RETURNING product_id').run();
}

/** Using Wheelhouse's website instead (ws-shopify-switch): nothing more is sent. */
export async function stopLink() {
  await prepare("UPDATE shopify_link SET state = 'stopped', to_send = '{}', updated_at = now() RETURNING shop_id").run();
  await prepare('DELETE FROM shopify_changed RETURNING product_id').run();
}

/** After a send finishes: how many of the shop's products are in Shopify. */
export async function countInShopify(address) {
  const ours = await productsToSend();
  const theirs = await shopify().listProducts(address);
  const ids = new Set(theirs.map((p) => String(p.wheelhouseId)));
  // An empty SKU matches nothing, as in compare().
  const skus = new Set(theirs.filter((p) => p.sku).map((p) => p.sku));
  return ours.filter((p) => ids.has(String(p.wheelhouseId)) || skus.has(p.sku)).length;
}
