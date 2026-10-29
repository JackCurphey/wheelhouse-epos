// Owner pages on a workshop computer (openspec/changes/workshop-computer,
// design 9; the lead, 28 Oct, standing in for stage-1 gaps 1 until roles):
// a workshop computer stays signed in, usually as the Owner, while mechanics
// work on it by PIN. There the Owner's sign-in counts as the Owner only while
// the person checked in by PIN is the Owner (giverHere's rule in
// routes/till-pins.js): with nobody working, someone else working, or the
// Owner gone idle, it counts as staff; on one that has been removed, too, until
// someone signs out there (tills-list). Tills and other browsers are unchanged.
import { workshopCookieToken, thisWorkshop, removedWorkshopHere } from '../till/this-workshop.js';
import { thisTill } from '../till/this-till.js';
import { currentCheckin, isTheOwner } from '../routes/till-pins.js';

// One answer per request, as session.js keeps one sign-in per request.
const decided = new WeakMap();

/**
 * Whether this signed-in Owner counts as the Owner on this browser. Runs
 * inside the request's shop scope (row-level security finds the workshop
 * computer and the check-in); `ctx` is the sign-in as stored.
 */
export function ownerHere(req, ctx) {
  if (!ctx?.login.is_owner) return Promise.resolve(false);
  if (!workshopCookieToken(req)) return Promise.resolve(true);
  if (!decided.has(req)) decided.set(req, decide(req));
  return decided.get(req);
}

async function decide(req) {
  // A till's key wins should a browser carry both (workshop-computer design 1).
  if (await thisTill(req)) return true;
  // A removed workshop computer stays closed, not open: its Owner sign-in
  // isn't the Owner until someone signs out there, which clears the old key
  // (routes/auth.js; tills-list design 5, the reviews, 29 Oct).
  if (!(await thisWorkshop(req))) return !(await removedWorkshopHere(req));
  const mine = await currentCheckin(req);
  return Boolean(mine) && (await isTheOwner(mine));
}
