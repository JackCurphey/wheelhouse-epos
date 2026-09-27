// server/till/attention.js
// The attention list: "check these" (stock below zero) and "needs attention"
// (a sale the server could not fully accept). A sale is never discarded; it is
// recorded and flagged here with the reason.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import { prepare } from '../db.js';

export async function flag(kind, { detail, tillSaleId = null, productId = null, customerId = null }) {
  if (kind === 'stock_below_zero') {
    const open = await prepare(
      "SELECT 1 FROM till_attention WHERE kind = 'stock_below_zero' AND product_id = ? AND resolved_at IS NULL"
    ).get(productId);
    if (open) return;
  }
  await prepare(
    'INSERT INTO till_attention (kind, detail, till_sale_id, product_id, customer_id) VALUES (?, ?, ?, ?, ?)'
  ).run(kind, detail, tillSaleId, productId, customerId);
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
