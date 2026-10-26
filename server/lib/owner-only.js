// Settings for the Owner only, until roles are built (Jack, 19 Oct,
// docs/decisions/2026-10-19-owner-only-settings.md). WP-1.1 replaces this
// with the roles and the "Can change settings" switch
// (docs/decisions/2026-10-05-roles-and-switches.md), in this one place.
// Returns true when it has already answered the request with a refusal.
// `message` names what was refused; purchase orders pass their own
// (openspec/changes/deliveries-orders).
import { currentSession } from './session.js';
import { sendJson } from './http.js';

export async function ownerOnly(req, res, message = "Only the shop's owner can change settings") {
  const ctx = await currentSession(req);
  if (!ctx) { sendJson(res, 401, { error: 'Not signed in' }); return true; }
  if (!ctx.login.is_owner) { sendJson(res, 403, { error: message, code: 'owner_only' }); return true; }
  return false;
}
