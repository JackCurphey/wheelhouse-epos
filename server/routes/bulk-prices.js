// Changing prices in bulk (openspec/changes/bulk-price-change, design 3; st-prices,
// st-prices-done; stock control decisions 7 and 11): a preview, the change, and Undo. Staff
// routes under the dispatcher's /api/ branch, with the shop's row-level security bound, so
// another business's products and changes are never found. The Owner's, the one there, as
// editing a product is, until roles bring "Can order stock".
import { prepare, dbExec, runWithShop } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { notProductEditor } from '../lib/product-editor.js';
import { newPrices } from '../lib/bulk-prices.js';
import { recordPriceChanges } from '../lib/price-changes.js';
import { penceToPounds } from '../lib/pence.js';
import { whoIsBooking } from './purchase-orders.js';
import { SAVE_LOCK_WAIT, syncProductWithShopifyIfNeeded } from './products.js';

const db = { prepare, exec: dbExec };
const MOST = 2000;
const BUSY = { error: 'Wheelhouse is busy with one of these products just now. Try again in a moment.', code: 'busy' };
const COLUMNS = 'id, name, sku, size, colour, price_pence, cost_pence, vat_rate_bp';

// The ids sent: whole numbers above 0, at least one, at most MOST together.
function idsOf(body) {
  const lists = [body?.productIds ?? [], body?.groupIds ?? []];
  if (!lists.every((l) => Array.isArray(l) && l.every((id) => Number.isSafeInteger(id) && id > 0))) {
    throw new ValidationError('Each product is a number');
  }
  const total = lists[0].length + lists[1].length;
  if (total === 0) throw new ValidationError('Tick the products to change');
  if (total > MOST) throw new ValidationError(`Change at most ${MOST} products at once`);
  return lists;
}

// The products on sale named, and every size of the products with sizes named, by id.
// `lock`: FOR UPDATE, in id order so two changes at once can't hold each other.
function productsOf([productIds, groupIds], lock = false) {
  return db.prepare(
    `SELECT ${COLUMNS} FROM products WHERE active = 1 AND (id = ANY(?::int[]) OR group_id = ANY(?::int[])) ORDER BY id${lock ? ' FOR UPDATE' : ''}`
  ).all(productIds, groupIds);
}

const preview = (rows, worked) => worked.map((w, i) => ({ ...w, name: rows[i].name, sku: rows[i].sku, size: rows[i].size, colour: rows[i].colour }));

// Each changed product to Shopify, as a product's save does, but once the answer is sent and
// the request's connection is back (the review): many products mean many calls, and the screen
// must hear the change was made, not time out and send it again. A price change never changes
// whether a product is live, so the row as it is now stands for before and after.
function pushAfterAnswer(afterRelease, shopId, ids) {
  if (ids.length === 0) return;
  afterRelease.push(() => runWithShop(shopId, async () => {
    const rows = await db.prepare('SELECT * FROM products WHERE id = ANY(?::int[])').all(ids);
    for (const row of rows) await syncProductWithShopifyIfNeeded(row, row);
  }).catch((err) => console.error('Bulk price Shopify sync failed', err)));
}

async function inLockedTransaction(res, fn) {
  await db.exec('BEGIN');
  try {
    await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
    const out = await fn();
    if (out.refused) {
      await db.exec('ROLLBACK');
      sendJson(res, out.refused[0], { error: out.refused[1] });
      return null;
    }
    await db.exec('COMMIT');
    return out;
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err.code === '55P03') { sendJson(res, 503, BUSY); return null; }
    if (err instanceof ValidationError) { badRequest(res, err.message); return null; }
    throw err;
  }
}

export function register(route) {
  // screens: st-prices
  route('POST', '/api/stock/prices/preview', async (req, res) => {
    if (await notProductEditor(req, res)) return;
    const body = await readJsonBody(req);
    try {
      const rows = await productsOf(idsOf(body));
      sendJson(res, 200, { products: preview(rows, newPrices(rows, body)) });
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
  });

  // screens: st-prices, st-prices-done
  route('POST', '/api/stock/prices', async (req, res, params, query, afterRelease, shopId) => {
    if (await notProductEditor(req, res)) return;
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    const done = await inLockedTransaction(res, async () => {
      const ids = idsOf(body);
      // Worked out again from the prices as they are now, held until the commit.
      const rows = await productsOf(ids, true);
      const worked = newPrices(rows, body);
      const changed = rows.map((before, i) => ({ before, next: worked[i].newPence })).filter((c) => c.next !== Number(c.before.price_pence));
      if (changed.length === 0) return { refused: [400, 'None of these prices would change'] };
      const batchId = (await db.prepare('INSERT INTO price_change_batches (login_id, who_name) VALUES (?, ?)').run(who?.loginId ?? null, who?.name ?? null)).lastInsertRowid;
      for (const { before, next } of changed) {
        await db.prepare('UPDATE products SET price = ?, updated_at = ? WHERE id = ?').run(penceToPounds(next), nowIso(), before.id);
        await recordPriceChanges(before, { ...before, price_pence: next }, who, { batchId });
      }
      return { batchId, changed };
    });
    if (!done) return;
    pushAfterAnswer(afterRelease, shopId, done.changed.map((c) => c.before.id));
    sendJson(res, 200, { batchId: done.batchId, changed: done.changed.length });
  });

  // screens: st-prices-done
  route('POST', '/api/stock/prices/:id/undo', async (req, res, params, query, afterRelease, shopId) => {
    if (await notProductEditor(req, res)) return;
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return notFound(res, 'Price change not found');
    const who = await whoIsBooking(req);
    const done = await inLockedTransaction(res, async () => {
      const batch = await db.prepare('SELECT id, undone_at FROM price_change_batches WHERE id = ? FOR UPDATE').get(id);
      if (!batch) return { refused: [404, 'Price change not found'] };
      if (batch.undone_at) return { refused: [409, 'These prices have already been put back'] };
      const lines = await db.prepare("SELECT product_id, was_pence, now_pence FROM product_price_changes WHERE batch_id = ? AND field = 'price'").all(id);
      const rows = await db.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ANY(?::int[]) ORDER BY id FOR UPDATE`).all(lines.map((l) => l.product_id));
      const lineOf = new Map(lines.map((l) => [l.product_id, l]));
      const changed = [];
      let leftAlone = 0;
      for (const before of rows) {
        const line = lineOf.get(before.id);
        // A price changed since is someone's later decision: it stays.
        if (Number(before.price_pence) !== Number(line.now_pence)) { leftAlone += 1; continue; }
        const was = Number(line.was_pence);
        await db.prepare('UPDATE products SET price = ?, updated_at = ? WHERE id = ?').run(penceToPounds(was), nowIso(), before.id);
        await recordPriceChanges(before, { ...before, price_pence: was }, who);
        changed.push({ before });
      }
      await db.prepare('UPDATE price_change_batches SET undone_at = now() WHERE id = ?').run(id);
      return { changed, leftAlone };
    });
    if (!done) return;
    pushAfterAnswer(afterRelease, shopId, done.changed.map((c) => c.before.id));
    sendJson(res, 200, { undone: done.changed.length, leftAlone: done.leftAlone });
  });
}
