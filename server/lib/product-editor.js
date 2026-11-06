// Who adds and changes a product, its price and its cost (openspec/changes/product-editing;
// stock control decision 11: Staff "can't change prices, edit or add products"). The Owner
// only, until "Can order stock" exists (roles, WP-1.1), which replaces this in one place:
// the Owner's own sign-in, with the Owner the one there. Someone else checked in by PIN under
// it is that person, refused; a till or workshop computer with nobody checked in could be
// anyone, so it asks for a PIN, as changing stock there does. The same people canSeeCosts
// tells. Adjusting and counting stock, and receiving a delivery, stay with everyone.
// Each returns true when it has already answered the request with a refusal.
import { ownerOnly } from './owner-only.js';
import { sendJson } from './http.js';
import { currentCheckin, isTheOwner } from '../routes/till-pins.js';
import { thisTill } from '../till/this-till.js';
import { thisWorkshop } from '../till/this-workshop.js';

export const PRODUCT_OWNER_ONLY = 'Only the shop’s owner can add or change products';

// A till or workshop computer with nobody checked in: ask for a PIN. Also for changes
// anyone checked in may make, such as adding a supplier, whose words sit beside costs.
export async function emptyComputer(req, res) {
  if (await currentCheckin(req)) return false;
  if (!(await thisTill(req)) && !(await thisWorkshop(req))) return false;
  sendJson(res, 409, { error: 'Check in with your PIN first', code: 'check_in_first' });
  return true;
}

// The Owner, and the one there: for products, and what rewrites them (a Citrus Lime file,
// a category). `message` names what was refused.
export async function notOwnerHere(req, res, message) {
  if (await ownerOnly(req, res, message)) return true;
  const checkin = await currentCheckin(req);
  if (checkin && !(await isTheOwner(checkin))) {
    sendJson(res, 403, { error: message, code: 'owner_only' });
    return true;
  }
  return emptyComputer(req, res);
}

export const notProductEditor = (req, res) => notOwnerHere(req, res, PRODUCT_OWNER_ONLY);
