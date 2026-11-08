// A product's price and cost changes (openspec/changes/product-page-sizes, design 1; stock
// control decisions 7 and 11). One place writes them, inside the caller's transaction, and
// one reads them for a product's page. Only someone who can see costs is sent them: a cost is
// a cost, and st-product-staff draws Jo's history without the price change line.
import { prepare } from '../db.js';

// `before` and `after`: the product's rows as read FOR UPDATE and as written (price_pence and
// cost_pence, generated from the pounds). `who`: whoIsBooking's { loginId, name }, or null.
export async function recordPriceChanges(before, after, who, { deliveryId = null } = {}) {
  for (const field of ['price', 'cost']) {
    const was = Number(before[`${field}_pence`]);
    const now = Number(after[`${field}_pence`]);
    if (was === now) continue;
    await prepare(
      `INSERT INTO product_price_changes (product_id, field, was_pence, now_pence, login_id, who_name, delivery_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(after.id, field, was, now, who?.loginId ?? null, who?.name ?? null, deliveryId);
  }
}

// The newest 200 changes of these products, as history lines; [] for someone who can't see costs.
// Each says the delivery's supplier when a delivery changed it.
export async function priceChangesOf(productIds, costs) {
  if (!costs || productIds.length === 0) return [];
  const rows = await prepare(
    `SELECT c.id, c.product_id, c.field, c.was_pence, c.now_pence, COALESCE(c.who_name, l.name) AS who, c.created_at,
            c.delivery_id, COALESCE(sp.name, d.supplier_name) AS supplier
       FROM product_price_changes c
       LEFT JOIN logins l ON l.id = c.login_id
       LEFT JOIN deliveries d ON d.id = c.delivery_id
       LEFT JOIN suppliers sp ON sp.id = d.supplier_id
      WHERE c.product_id = ANY(?::int[]) ORDER BY c.created_at DESC, c.id DESC LIMIT 200`
  ).all(productIds);
  return rows.map((c) => ({
    id: `p${c.id}`, productId: c.product_id, type: 'price_change', field: c.field,
    was: Number(c.was_pence), now: Number(c.now_pence), who: c.who, at: c.created_at,
    delivery: c.delivery_id === null ? null : { id: c.delivery_id, supplierName: c.supplier ?? null },
  }));
}

// Stock lines and price changes together, newest first.
export const newestFirst = (lines) => lines.sort((a, b) => new Date(b.at) - new Date(a.at));
