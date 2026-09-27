// server/till/attention.js
// The attention list: "check these" (stock below zero) and "needs attention"
// (a sale the server could not fully accept). A sale is never discarded; it is
// recorded and flagged here with the reason.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import { prepare } from '../db.js';

// Returns true when this call actually raised a new flag, false when it was a
// no-op (an open stock_below_zero item already exists for this product) - the
// caller only reports a kind in a sale's attention list when it was actually
// raised. For stock_below_zero this relies on the database, not a prior
// SELECT, to decide: INSERT ... ON CONFLICT DO NOTHING against the partial
// unique index (idx_till_attention_open_stock, on (shop_id, product_id) WHERE
// kind = 'stock_below_zero' AND resolved_at IS NULL) so two concurrent sales
// against the same product can't both slip past a check-then-insert race and
// both insert. prepare() auto-appends "RETURNING id" to a bare INSERT that
// doesn't already have one (see server/db.js, needsReturningId) - harmless
// here, since ON CONFLICT DO NOTHING RETURNING id returns zero rows when the
// conflict fires and one row otherwise, so .run()'s `changes` (rowCount) is
// exactly 1 when a flag was raised and 0 when it was not.
export async function flag(kind, { detail, tillSaleId = null, productId = null, customerId = null }) {
  if (kind === 'stock_below_zero') {
    const { changes } = await prepare(
      `INSERT INTO till_attention (kind, detail, till_sale_id, product_id, customer_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (shop_id, product_id) WHERE kind = 'stock_below_zero' AND resolved_at IS NULL
       DO NOTHING`
    ).run(kind, detail, tillSaleId, productId, customerId);
    return changes > 0;
  }
  await prepare(
    'INSERT INTO till_attention (kind, detail, till_sale_id, product_id, customer_id) VALUES (?, ?, ?, ?, ?)'
  ).run(kind, detail, tillSaleId, productId, customerId);
  return true;
}

export async function listOpen() {
  return prepare('SELECT * FROM till_attention WHERE resolved_at IS NULL ORDER BY created_at, id').all();
}

export async function resolve(id, loginId) {
  const { changes } = await prepare(
    'UPDATE till_attention SET resolved_at = now(), resolved_by_login_id = ? WHERE id = ? AND resolved_at IS NULL'
  ).run(loginId, id);
  return changes > 0;
}
