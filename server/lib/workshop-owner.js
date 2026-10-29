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
import { workshopCookieToken, thisWorkshop, removedWorkshopHere } from '../till/this-workshop.js';
import { thisTill } from '../till/this-till.js';
import { currentCheckin, isTheOwner } from '../routes/till-pins.js';

// One answer per request, as session.js keeps one sign-in per request.
const decided = new WeakMap();

/** Records this request's session as the workshop computer's, unless it already is one's. */
export async function markSessionWorkshop(req, workshopComputerId) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return;
  await prepare('UPDATE sessions SET workshop_computer_id = ? WHERE token = ? AND workshop_computer_id IS NULL').run(workshopComputerId, token);
}

/**
 * Whether this signed-in Owner counts as the Owner on this browser. Runs
 * inside the request's shop scope (row-level security finds the workshop
 * computer and the check-in); `ctx` is the sign-in as stored.
 */
export function ownerHere(req, ctx) {
  if (!ctx?.login.is_owner) return Promise.resolve(false);
  if (!decided.has(req)) decided.set(req, decide(req));
  return decided.get(req);
}

async function decide(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? await prepare('SELECT workshop_computer_id FROM sessions WHERE token = ?').get(token) : null;
  let marked = session?.workshop_computer_id ?? null;
  if (marked === null) {
    // Not a workshop computer's session (yet): a till's key wins should a
    // browser carry both (workshop-computer design 1).
    if (await thisTill(req)) return true;
    const here = workshopCookieToken(req) ? await thisWorkshop(req) : null;
    // A removed workshop computer stays closed, not open: its Owner sign-in
    // isn't the Owner until someone signs out there, which clears the old key
    // (routes/auth.js; tills-list design 5, the reviews, 29 Oct).
    if (!here) return !(await removedWorkshopHere(req));
    await markSessionWorkshop(req, here.id);
    marked = here.id;
  }
  // The Owner checked in by PIN on that same workshop computer, and only then.
  const mine = await currentCheckin(req);
  return Boolean(mine) && mine.workshop_computer_id === marked && (await isTheOwner(mine));
}
