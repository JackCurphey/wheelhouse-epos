// Owner pages on a workshop computer (openspec/changes/workshop-computer,
// design 9; the lead, 28 Oct, standing in for stage-1 gaps 1 until roles):
// a workshop computer stays signed in, usually as the Owner, while mechanics
// work on it by PIN. There the Owner's sign-in counts as the Owner only while
// the person checked in by PIN is the Owner (giverHere's rule in
// routes/till-pins.js): with nobody working, someone else working, or the
// Owner gone idle, it counts as staff; on one that has been removed, too, until
// someone signs out there (tills-list). Tills and other browsers are unchanged.
//
// Held on the server (openspec/changes/workshop-lock-server; 29 Oct answer
// 4): a signed-in session used on a workshop computer is recorded as that
// computer's (sessions.workshop_computer_id, migration 105), at setup or its
// first request there, and from then on the cookies don't open it: deleting
// or changing the workshop cookie, or sending a till's key, can only lock it
// further. It ends with the session (signing out).
import { prepare } from '../db.js';
import { SESSION_COOKIE } from '../auth.js';
import { parseCookies } from './http.js';
import { staffSigninProvider } from '../staff-signin/provider.js';
import { workshopCookieToken, thisWorkshop, removedWorkshopHere } from '../till/this-workshop.js';
import { thisTill } from '../till/this-till.js';
import { currentCheckin } from '../routes/till-pins.js';

// One answer per request, as session.js keeps one sign-in per request.
const decided = new WeakMap();

/**
 * Records this request's session as the workshop computer's, unless it
 * already is one's. A WorkOS sign-in's WorkOS session is then ended at WorkOS
 * (the review of #578): a workshop computer keeps no remembered WorkOS
 * session, so whoever is at it can't press Continue for a fresh sign-in.
 * Wheelhouse's own session stays.
 */
export async function markSessionWorkshop(req, workshopComputerId) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return;
  const marked = await prepare('UPDATE sessions SET workshop_computer_id = ? WHERE token = ? AND workshop_computer_id IS NULL RETURNING workos_session_id')
    .get(workshopComputerId, token);
  if (!marked?.workos_session_id) return;
  const provider = staffSigninProvider();
  if (provider?.revokeSession && (await provider.revokeSession({ sessionId: marked.workos_session_id }))) {
    await prepare('UPDATE sessions SET workos_session_id = NULL WHERE token = ?').run(token);
  }
}

// The workshop computer this request's sign-in belongs to, once a request:
// { id } for one (the session's record, or the browser's key, which records
// it), { id: null } for a removed one's key (closed: tills-list), or null for
// none. A session already recorded is held whatever the cookies say; an
// unrecorded one with a till's key is a till's (workshop-computer design 1).
const tiedOnce = new WeakMap();
function tiedWorkshop(req) {
  if (!tiedOnce.has(req)) tiedOnce.set(req, findTied(req));
  return tiedOnce.get(req);
}
async function findTied(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? await prepare('SELECT workshop_computer_id FROM sessions WHERE token = ?').get(token) : null;
  if (session?.workshop_computer_id) return { id: session.workshop_computer_id };
  if (await thisTill(req)) return null;
  const here = workshopCookieToken(req) ? await thisWorkshop(req) : null;
  if (here) {
    await markSessionWorkshop(req, here.id);
    return { id: here.id };
  }
  // A removed workshop computer stays closed, not open, until someone signs
  // out there, which clears the old key (routes/auth.js; tills-list design 5).
  return (await removedWorkshopHere(req)) ? { id: null } : null;
}

/**
 * Whether this sign-in is its own on this browser: anywhere but a workshop
 * computer, yes; on one (recorded on the server, so a deleted cookie doesn't
 * change it), only while the person checked in by PIN on that same workshop
 * computer is the sign-in's own team member. Shared by the Owner's pages
 * (`ownerHere`) and the sign-in's own PIN and settings (`ownAccountHere`).
 */
export async function ownSignInHere(req, ctx) {
  const tied = await tiedWorkshop(req);
  if (!tied) return true;
  if (tied.id === null) return false;
  const mine = await currentCheckin(req);
  if (!mine || mine.workshop_computer_id !== tied.id) return false;
  return Boolean(await prepare('SELECT 1 FROM logins WHERE id = ? AND employee_id = ?').get(ctx.login.id, mine.employee_id));
}

/**
 * Whether this signed-in Owner counts as the Owner on this browser. Runs
 * inside the request's shop scope (row-level security finds the workshop
 * computer and the check-in); `ctx` is the sign-in as stored.
 */
export function ownerHere(req, ctx) {
  if (!ctx?.login.is_owner) return Promise.resolve(false);
  if (!decided.has(req)) decided.set(req, ownSignInHere(req, ctx));
  return decided.get(req);
}
