// Who adds and changes a product, its price and its cost (openspec/changes/product-editing;
// stock control decision 11: Staff "can't change prices, edit or add products"). The Owner
// only, until "Can order stock" exists (roles, WP-1.1), which replaces this in one place. The
// Owner's sign-in with someone else checked in by PIN is that person, so refused. Adjusting
// and counting stock, and receiving a delivery, stay with everyone.
// Returns true when it has already answered the request with a refusal.
import { ownerOnly } from './owner-only.js';
import { sendJson } from './http.js';
import { someoneElseCheckedIn } from '../routes/till-pins.js';

export const PRODUCT_OWNER_ONLY = 'Only the shop’s owner can add or change products';

export async function notProductEditor(req, res) {
  if (await ownerOnly(req, res, PRODUCT_OWNER_ONLY)) return true;
  if (await someoneElseCheckedIn(req)) {
    sendJson(res, 403, { error: PRODUCT_OWNER_ONLY, code: 'owner_only' });
    return true;
  }
  return false;
}
