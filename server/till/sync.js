// server/till/sync.js
// Records what a till sends, exactly once. Each item carries a UUID made on
// the till; an item already held is acknowledged as a duplicate and ignored.
// Each item is its own transaction so one bad item never loses the rest. A
// sale is never refused or discarded: whatever cannot be matched is recorded
// as the till sent it and flagged. The price charged at the till stands.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §3, §5, §8
import { prepare, dbExec } from '../db.js';
import { vatFromGrossPence, receiptLabel } from './money.js';
import { flag } from './attention.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(['sale']);
const KNOWN_PAYMENT_METHODS = new Set(['cash', 'card']);

// Shape checks only: a batch that fails these is refused whole (400). Anything
// that passes is recorded, however wrong its contents turn out to be.
export function batchProblem(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return 'Send { items: [...] }';
  for (const item of body.items) {
    if (!item || typeof item !== 'object') return 'Every item must be an object';
    if (typeof item.clientId !== 'string' || !UUID.test(item.clientId)) return 'Every item needs a UUID clientId';
    if (!KINDS.has(item.kind)) return `Unknown item kind: ${item.kind}`;
    if (item.kind === 'sale') {
      if (!Number.isInteger(item.receiptNumber) || item.receiptNumber < 1) return 'A sale needs a receiptNumber';
      if (Number.isNaN(Date.parse(item.tillClockAt))) return 'A sale needs tillClockAt';
      if (!Array.isArray(item.lines) || item.lines.length === 0) return 'A sale needs lines';
      if (!Array.isArray(item.payments)) return 'A sale needs payments';
      for (const l of item.lines) {
        if (!Number.isInteger(l.qty) || l.qty < 1) return 'A line needs a whole qty of at least 1';
        if (!Number.isInteger(l.unitPricePence)) return 'A line needs unitPricePence';
        if (!Number.isInteger(l.vatRateBp) || l.vatRateBp < 0 || l.vatRateBp > 10000) return 'A line needs vatRateBp';
        if (typeof l.description !== 'string') return 'A line needs a description';
      }
      for (const p of item.payments) {
        if (typeof p.method !== 'string' || !Number.isInteger(p.amountPence)) return 'A payment needs method and amountPence';
      }
    }
  }
  return null;
}

async function recordSale(till, item) {
  const held = await prepare('SELECT id FROM till_sales WHERE client_id = ?').get(item.clientId);
  if (held) return { status: 'duplicate', attention: [] };

  const attention = [];
  const raise = async (kind, fields) => { attention.push(kind); await flag(kind, fields); };
  const label = receiptLabel(till.code, item.receiptNumber);

  const lines = item.lines.map((l) => {
    const lineTotal = l.qty * l.unitPricePence;
    return { ...l, lineTotal, vat: vatFromGrossPence(lineTotal, l.vatRateBp) };
  });
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);

  const employee = Number.isInteger(item.employeeId)
    ? await prepare('SELECT id FROM employees WHERE id = ?').get(item.employeeId) : null;
  const customer = Number.isInteger(item.customerId)
    ? await prepare('SELECT id FROM customers WHERE id = ?').get(item.customerId) : null;

  const reused = await prepare('SELECT 1 FROM till_sales WHERE till_id = ? AND receipt_number = ?').get(till.id, item.receiptNumber);

  const { lastInsertRowid: saleId } = await prepare(
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, employee_id, customer_id, made_offline, till_clock_at, total_pence, vat_pence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(item.clientId, till.id, till.site_id, item.receiptNumber, employee?.id ?? null, customer?.id ?? null,
    item.madeOffline === true, new Date(item.tillClockAt).toISOString(), total, vat);

  if (reused) await raise('receipt_number_reused', { detail: `${label} was already used on this till`, tillSaleId: saleId });
  if (item.employeeId != null && !employee) await raise('unknown_employee', { detail: `${label}: staff member ${item.employeeId} not found`, tillSaleId: saleId });
  if (item.customerId != null && !customer) await raise('unknown_customer', { detail: `${label}: customer ${item.customerId} not found`, tillSaleId: saleId });

  for (const l of lines) {
    const product = Number.isInteger(l.productId)
      ? await prepare('SELECT id FROM products WHERE id = ?').get(l.productId) : null;
    await prepare(
      `INSERT INTO till_sale_lines (till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(saleId, product?.id ?? null, l.description, l.qty, l.unitPricePence, l.lineTotal, l.vatRateBp, l.vat);
    if (!product) {
      await raise('unknown_product', { detail: `${label}: "${l.description}" is not a product we hold`, tillSaleId: saleId });
      continue;
    }
    // Relative update, so two tills' sales both count however they interleave.
    const { stock_qty: after } = await prepare(
      'UPDATE products SET stock_qty = stock_qty - ?, updated_at = now() WHERE id = ? RETURNING stock_qty'
    ).get(l.qty, product.id);
    await prepare("INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'till_sale', ?)")
      .run(product.id, -l.qty, `Till sale ${label}`);
    if (after < 0) await raise('stock_below_zero', { detail: `"${l.description}" is at ${after} after ${label}`, productId: product.id });
  }

  let paid = 0;
  for (const p of item.payments) {
    await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?)').run(saleId, p.method, p.amountPence);
    paid += p.amountPence;
    if (!KNOWN_PAYMENT_METHODS.has(p.method)) {
      await raise('unsupported_payment_method', { detail: `${label}: payment method "${p.method}" is not handled yet`, tillSaleId: saleId });
    }
  }
  if (paid !== total) await raise('payments_do_not_match', { detail: `${label}: paid ${paid}p against a total of ${total}p`, tillSaleId: saleId });

  return { status: 'recorded', attention };
}

export async function processSyncItems(till, items) {
  const results = [];
  for (const item of items) {
    await dbExec('BEGIN');
    try {
      const outcome = await recordSale(till, item);
      await dbExec('COMMIT');
      results.push({ clientId: item.clientId, ...outcome });
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  }
  return results;
}
