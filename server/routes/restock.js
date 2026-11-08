// The restock list: /api/restock (openspec/changes/restock-list, design 3; rs-restock,
// rs-restock-customers, rs-hub, rs-today-restock). Staff routes under the dispatcher's /api/
// branch, with the shop's row-level security bound. The Owner's until roles bring "Can order
// stock" (receiving decision 4), as orders are.
import { prepare, dbExec } from '../db.js';
import { sendJson, badRequest, readJsonBody, nowIso, ValidationError } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';
import { csvOf } from '../lib/csv.js';
import { restockList, newSince, markSeen } from '../lib/restock.js';
import { loadPoLineItems, MAX_QTY } from './purchase-orders.js';

const db = { prepare, exec: dbExec };
const ORDER_STOCK = "Only the shop's owner can order stock";
const BAD_LINE = 'Each item needs a valid productId and positive qty';

// A download's lines: a product of this business, a whole count from 1 to the most a line can
// order. In the order sent.
async function downloadLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw new ValidationError('Tick something to download');
  const out = [];
  for (const l of lines) {
    const productId = Number(l?.productId);
    const qty = Number(l?.qty);
    if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty <= 0) throw new ValidationError(BAD_LINE);
    if (qty > MAX_QTY) throw new ValidationError(`A line can order at most ${MAX_QTY}`);
    const p = await db.prepare('SELECT name, sku, barcode FROM products WHERE id = ?').get(productId);
    if (!p) throw new ValidationError(`Product ${productId} not found or inactive`);
    out.push({ ...p, qty });
  }
  return out;
}
const fileSlug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'supplier';

export function register(route) {
  // screens: rs-restock, rs-restock-customers, rs-hub
  route('GET', '/api/restock', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const ctx = await currentSession(req);
    const { keys, ...list } = await restockList();
    sendJson(res, 200, { ...list, ...(await newSince(ctx.login.id, keys)) });
  });

  // Opening the list clears Today's line until something new comes on (audit M11). A GET
  // never writes, so the screen says it has opened.
  // screens: rs-restock
  route('POST', '/api/restock/seen', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const ctx = await currentSession(req);
    await markSeen(ctx.login.id, (await restockList()).keys);
    sendJson(res, 200, { ok: true });
  });

  // Download for [Supplier]'s basket: a CSV file of the ticked lines. Each supplier's own
  // basket format is still to be checked (receiving decision 2), so the columns are the
  // ones a basket upload asks for most: code and quantity, then name and barcode to check by.
  // screens: rs-restock
  route('POST', '/api/restock/download', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    let lines;
    try {
      lines = await downloadLines(body.lines);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    await markSeen(ctx.login.id, (await restockList()).keys);
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="restock-${fileSlug(body.supplier)}-${nowIso().slice(0, 10)}.csv"`,
    });
    res.end(csvOf([['Supplier code', 'Quantity', 'Product', 'Barcode'], ...lines.map((l) => [l.sku ?? '', l.qty, l.name, l.barcode ?? ''])]));
  });

  // Add to an order: the ticked lines onto the supplier's draft order, made if there isn't
  // one; a product already there for the same job (or none) goes up. A line for a job keeps
  // its job ("for job WH-1042"), so it leaves For customers.
  // screens: rs-restock, rs-restock-customers
  route('POST', '/api/restock/add-to-order', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const body = await readJsonBody(req);
    const supplierId = Number(body.supplierId);
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!Number.isInteger(supplierId)) return badRequest(res, 'Supplier not found');
    if (!(await db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(supplierId))) return badRequest(res, 'Supplier not found');
    if (lines.length === 0) return badRequest(res, 'Tick something to add');
    let loaded;
    try {
      // The Owner sees costs, so each line takes the product's cost, as New order's.
      loaded = await loadPoLineItems(lines, true);
      for (const [i, l] of lines.entries()) {
        if (l.forJobId === undefined || l.forJobId === null) { loaded[i].jobId = null; continue; }
        const jobId = Number(l.forJobId);
        if (!Number.isInteger(jobId) || !(await db.prepare('SELECT 1 FROM workshop_jobs WHERE id = ?').get(jobId))) throw new ValidationError('Job not found');
        loaded[i].jobId = jobId;
      }
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }

    await db.exec('BEGIN');
    try {
      // The supplier first, so two adds at once make one draft between them.
      await db.prepare('SELECT id FROM suppliers WHERE id = ? FOR UPDATE').get(supplierId);
      let order = await db.prepare("SELECT id FROM purchase_orders WHERE supplier_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1 FOR UPDATE").get(supplierId);
      if (!order) {
        order = { id: (await db.prepare("INSERT INTO purchase_orders (supplier_id, reference, notes, status, updated_at) VALUES (?, '', '', 'draft', ?)").run(supplierId, nowIso())).lastInsertRowid };
      }
      for (const { product, qty, unitCost, jobId } of loaded) {
        const there = await db.prepare(
          'SELECT id, qty_ordered FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND workshop_job_id IS NOT DISTINCT FROM ? ORDER BY id LIMIT 1'
        ).get(order.id, product.id, jobId);
        if (there && there.qty_ordered + qty > MAX_QTY) throw new ValidationError(`A line can order at most ${MAX_QTY}`);
        if (there) await db.prepare('UPDATE purchase_order_items SET qty_ordered = qty_ordered + ? WHERE id = ?').run(qty, there.id);
        else {
          await db.prepare(
            `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, qty_ordered, unit_cost, workshop_job_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(order.id, product.id, product.name, product.sku, qty, unitCost, jobId);
        }
      }
      await db.prepare('UPDATE purchase_orders SET updated_at = ? WHERE id = ?').run(nowIso(), order.id);
      await db.exec('COMMIT');
      sendJson(res, 200, { orderId: order.id });
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
  });
}
