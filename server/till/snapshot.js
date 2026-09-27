// server/till/snapshot.js
// What a till copies locally so it can sell and find customers offline.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5
import { prepare } from '../db.js';

export async function buildSnapshot(till) {
  // prepare()'s get/all/run each issue one query on the single pg client
  // scoped to this request (see server/db.js currentClient()). Running four
  // of them via Promise.all does not throw - node-postgres still queues
  // concurrent query() calls on one Client - but it logs
  // "Calling client.query() when the client is already executing a query is
  // deprecated and will be removed in pg@9.0", so a future pg major would
  // break this. Sequential awaits get the same one-client-at-a-time
  // behaviour without depending on a deprecated queueing path.
  const products = await prepare(
    `SELECT id, sku, barcode, name, category, ROUND(price * 100)::int AS price_pence, vat_rate_bp
     FROM products WHERE active = 1 ORDER BY name`
  ).all();
  const customers = await prepare('SELECT id, name, email, phone FROM customers WHERE active = 1 ORDER BY name').all();
  const staff = await prepare(
    'SELECT id, name, pin_hash FROM employees WHERE active = 1 AND is_cashier = 1 AND pin_hash IS NOT NULL ORDER BY name'
  ).all();
  const last = await prepare('SELECT COALESCE(MAX(receipt_number), 0) AS n FROM till_sales WHERE till_id = ?').get(till.id);
  return {
    generatedAt: new Date().toISOString(),
    till: { id: till.id, code: till.code, name: till.name, siteId: till.site_id },
    lastReceiptNumber: Number(last.n),
    products: products.map((p) => ({
      id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, category: p.category,
      pricePence: p.price_pence, vatRateBp: p.vat_rate_bp,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })),
    staff: staff.map((s) => ({ id: s.id, name: s.name, pinHash: s.pin_hash })),
  };
}
