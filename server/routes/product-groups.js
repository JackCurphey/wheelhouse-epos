// Making and changing a product with sizes and colours (openspec/changes/product-editing;
// stock control decision 4; Jack's answers 5 and 9, 4 and 5 Nov). Each size and colour is its
// own product, named with its size and colour ("Jersey M Blue"), its category the product's,
// all kept in step in the same transaction whenever the product, a size or a colour changes;
// a name typed by hand for one size goes the next time the product is saved. The Owner only
// (decision 11). Locks in the one order: categories, then the sizes in id order, then the
// product with sizes (piece 5). Reading it is GET /api/product-groups/:id (stock-list.js).
// Staff routes: they run with the shop's row-level security already bound.
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { categoryFor } from '../lib/categories.js';
import { notProductEditor } from '../lib/product-editor.js';
import { moveStock } from '../lib/stock.js';
import { CHECK_IN_FIRST, whoIsBooking } from './purchase-orders.js';
import { sentMoney, syncProductWithShopifyIfNeeded } from './products.js';

const db = { prepare, exec: dbExec };
const SAVE_LOCK_WAIT = '2s';
// A size's own name stays well within anything that shows it: 60 + 20 + 30 and two spaces.
const MAX_NAME = 60;
const MAX_SIZE = 20;
const MAX_COLOUR = 30;
const MAX_SIZES = 200;
const MAX_STOCK = 100000;

const same = (a, b) => (a ?? '').toLocaleLowerCase('en-GB') === (b ?? '').toLocaleLowerCase('en-GB');
const nameOf = (group, s) => [group, s.size, s.colour].filter(Boolean).join(' ');
const textOf = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// The sizes sent, checked: [{ id?, size, colour, sku, barcode, pricePence, costPence,
// lowStockThreshold, active, stockQty }]. `costs`: whether a cost is taken.
function sizesSent(sent, costs, { adding }) {
  if (!Array.isArray(sent) || sent.length > MAX_SIZES) return { problem: `Send its sizes and colours as a list, up to ${MAX_SIZES}` };
  if (adding && sent.length === 0) return { problem: 'A product with sizes needs at least one size or colour' };
  const out = [];
  for (const s of sent) {
    if (s === null || typeof s !== 'object') return { problem: 'Send each size with its size or colour' };
    const size = textOf(s.size);
    const colour = textOf(s.colour);
    if (!size && !colour) return { problem: 'Each needs a size or a colour' };
    if (size && size.length > MAX_SIZE) return { problem: `A size can be up to ${MAX_SIZE} characters` };
    if (colour && colour.length > MAX_COLOUR) return { problem: `A colour can be up to ${MAX_COLOUR} characters` };
    const label = [size, colour].filter(Boolean).join(' ');
    const twice = out.find((o) => same(o.size, size) && same(o.colour, colour));
    if (twice) return { problem: `${twice.label} is there twice` };
    const id = s.id === undefined || s.id === null ? null : Number(s.id);
    if (id !== null && !(Number.isSafeInteger(id) && id > 0 && id <= 2147483647)) return { problem: `${label} isn’t one of this product’s sizes` };
    const checked = sentMoney(s, costs);
    if (checked.refused) return { problem: checked.refused };
    // A price in whole pence, or in pounds, as a product's save takes it (sentMoney checks both).
    const money = checked;
    if (id === null && s.pricePence === undefined && s.price === undefined) return { problem: `Give ${label} a price` };
    const stock = s.stockQty === undefined ? 0 : s.stockQty;
    if (!Number.isInteger(stock) || Math.abs(stock) > MAX_STOCK || (id !== null && stock !== 0)) return { problem: `${label}’s starting stock is a whole number, for a new size only` };
    out.push({
      id, size, colour, label, money, stock,
      sku: s.sku === undefined ? undefined : textOf(s.sku),
      barcode: s.barcode === undefined ? undefined : textOf(s.barcode),
      lowStockThreshold: s.lowStockThreshold === undefined ? undefined : Math.trunc(Number(s.lowStockThreshold)) || 0,
      active: s.active === undefined ? undefined : (s.active ? 1 : 0),
    });
  }
  return { sizes: out };
}

// Two saves at once taking the same barcode or code, or size: the database keeps one.
const taken = (err) => {
  if (err.code !== '23505') return null;
  if (/barcode/.test(err.constraint ?? '')) return 'One of these barcodes was just used by another product. Try again.';
  if (/sku/.test(err.constraint ?? '')) return 'One of these codes was just used by another product. Try again.';
  return 'That size and colour is already in this product';
};

// A barcode or code another product has, said by which (the same words as a product's save).
async function inUse(sizes, own = []) {
  const barcodes = sizes.map((s) => s.barcode).filter(Boolean);
  const skus = sizes.map((s) => s.sku).filter(Boolean);
  const hit = await db.prepare(
    'SELECT barcode, sku FROM products WHERE (barcode = ANY(?::text[]) OR sku = ANY(?::text[])) AND NOT (id = ANY(?::int[])) LIMIT 1'
  ).get(barcodes, skus, own);
  if (!hit) return null;
  return hit.barcode && barcodes.includes(hit.barcode) ? `Barcode "${hit.barcode}" is already in use` : `SKU "${hit.sku}" is already in use`;
}

// A new size: its own product, then its starting stock, if any, through moveStock.
async function addSize(group, s, who) {
  const made = await db.prepare(
    `INSERT INTO products (name, sku, barcode, category, price, cost, low_stock_threshold, group_id, size, colour, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now()) RETURNING id`
  ).get(nameOf(group.name, s), s.sku ?? null, s.barcode ?? null, group.category, s.money.price ?? 0, s.money.cost ?? 0,
    s.lowStockThreshold ?? 3, group.id, s.size, s.colour, s.active ?? 1);
  if (s.stock) await moveStock([{ productId: made.id, change: s.stock, type: 'intake', note: 'Initial stock' }], who);
  return made.id;
}

export function register(route) {
  route('POST', '/api/product-groups', async (req, res) => {
    if (await notProductEditor(req, res)) return;
    const body = (await readJsonBody(req)) ?? {};
    const name = textOf(body.name);
    if (!name) return badRequest(res, 'A product needs a name');
    if (name.length > MAX_NAME) return badRequest(res, `A product’s name can be up to ${MAX_NAME} characters`);
    const costs = await canSeeCosts(req);
    const sent = sizesSent(body.sizes, costs, { adding: true });
    if (sent.problem) return badRequest(res, sent.problem);
    if (sent.sizes.some((s) => s.id !== null)) return badRequest(res, 'A new product’s sizes are new too');
    // Starting stock needs someone to name (stock-movements-say-who).
    const who = sent.sizes.some((s) => s.stock) ? await whoIsBooking(req) : null;
    if (sent.sizes.some((s) => s.stock) && !who) return sendJson(res, 409, CHECK_IN_FIRST);
    await db.exec('BEGIN');
    let id;
    try {
      await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
      // Categories first: its path found or made (category-tree).
      const clash = await inUse(sent.sizes);
      if (clash) {
        await db.exec('ROLLBACK');
        return sendJson(res, 409, { error: clash });
      }
      const category = await categoryFor(body.category);
      id = (await db.prepare('INSERT INTO product_groups (name, category, description) VALUES (?, ?, ?) RETURNING id')
        .get(name, category, textOf(body.description) ?? '')).id;
      for (const s of sent.sizes) await addSize({ id, name, category }, s, who);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      const why = taken(err);
      if (why) return sendJson(res, 409, { error: why });
      throw err;
    }
    sendJson(res, 201, { id });
  });

  // Save: its name, category and description, and its sizes: one sent with its id is changed,
  // one without is added, one left out stays as it is (taken off sale with active: false).
  route('PUT', '/api/product-groups/:id', async (req, res, params) => {
    if (await notProductEditor(req, res)) return;
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return notFound(res, 'Product not found');
    const body = (await readJsonBody(req)) ?? {};
    const name = body.name === undefined ? undefined : textOf(body.name);
    if (body.name !== undefined && !name) return badRequest(res, 'A product needs a name');
    if (name && name.length > MAX_NAME) return badRequest(res, `A product’s name can be up to ${MAX_NAME} characters`);
    const costs = await canSeeCosts(req);
    const sent = body.sizes === undefined ? { sizes: [] } : sizesSent(body.sizes, costs, { adding: false });
    if (sent.problem) return badRequest(res, sent.problem);
    const who = sent.sizes.some((s) => s.stock) ? await whoIsBooking(req) : null;
    if (sent.sizes.some((s) => s.stock) && !who) return sendJson(res, 409, CHECK_IN_FIRST);
    let before;
    await db.exec('BEGIN');
    try {
      await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
      // Categories, then its sizes in id order, then the product with sizes: the one order.
      const category = body.category === undefined ? undefined : await categoryFor(body.category);
      before = await db.prepare('SELECT * FROM products WHERE group_id = ? ORDER BY id FOR UPDATE').all(id);
      const group = await db.prepare('SELECT * FROM product_groups WHERE id = ? FOR UPDATE').get(id);
      if (!group) {
        await db.exec('ROLLBACK');
        return notFound(res, 'Product not found');
      }
      const now = { id, name: name ?? group.name, category: category ?? group.category };
      // Each size as it will be, refused if one is another product's or would be there twice.
      const after = before.map((p) => ({ ...p }));
      for (const s of sent.sizes) {
        if (s.id === null) continue;
        const p = after.find((x) => x.id === s.id);
        if (!p) {
          await db.exec('ROLLBACK');
          return badRequest(res, `${s.label} isn’t one of this product’s sizes`);
        }
        Object.assign(p, { size: s.size, colour: s.colour, sent: s });
      }
      for (const s of sent.sizes.filter((x) => x.id === null)) {
        if (after.some((p) => same(p.size, s.size) && same(p.colour, s.colour))) {
          await db.exec('ROLLBACK');
          return badRequest(res, `${s.label} is already in this product`);
        }
      }
      const clash = await inUse(sent.sizes, before.map((p) => p.id));
      if (clash) {
        await db.exec('ROLLBACK');
        return sendJson(res, 409, { error: clash });
      }
      await db.prepare('UPDATE product_groups SET name = ?, category = ?, description = ?, updated_at = now() WHERE id = ?')
        .run(now.name, now.category, body.description === undefined ? group.description : textOf(body.description) ?? '', id);
      // Every size whose size or colour changes is moved aside first, so two swapping
      // labels (M and L) never meet in the one-of-each index on the way (the review).
      const relabelled = after.filter((p) => p.sent && before.some((b) => b.id === p.id && (b.size !== p.size || b.colour !== p.colour)));
      if (relabelled.length) {
        // Longer than any size can be (20 characters), so never one a size already has.
        await db.prepare("UPDATE products SET size = '~ being relabelled ~ ' || id::text, colour = NULL WHERE id = ANY(?::int[])").run(relabelled.map((p) => p.id));
      }
      for (const p of after) {
        const s = p.sent;
        await db.prepare(
          `UPDATE products SET name = ?, category = ?, size = ?, colour = ?, sku = ?, barcode = ?, price = ?, cost = ?,
             low_stock_threshold = ?, active = ?, updated_at = now() WHERE id = ?`
        ).run(nameOf(now.name, p), now.category, p.size, p.colour,
          s?.sku === undefined ? p.sku : s.sku, s?.barcode === undefined ? p.barcode : s.barcode,
          s?.money.price ?? p.price, s?.money.cost ?? p.cost,
          s?.lowStockThreshold ?? p.low_stock_threshold, s?.active ?? p.active, p.id);
      }
      for (const s of sent.sizes.filter((x) => x.id === null)) await addSize(now, s, who);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      const why = taken(err);
      if (why) return sendJson(res, 409, { error: why });
      throw err;
    }
    // After COMMIT, as a product's save: a size on the website follows its new name.
    for (const was of before) {
      const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(was.id);
      await syncProductWithShopifyIfNeeded(was, row);
    }
    sendJson(res, 200, { id });
  });
}
