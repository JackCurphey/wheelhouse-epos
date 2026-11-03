// Who is sent what things cost: the one place every cost check goes through
// (openspec/changes/delivery-booked-in, design 7).
//
// Follows Reports and accounts decisions 5 and 9
// (docs/decisions/2026-10-01-reports-and-accounts-review.md): each person has a
// "Can see costs and margin" switch in Staff and roles (drawing rp-person), off
// to start. Until roles (WP-1.1) bring that switch, it is off for everyone but
// the Owner. When roles land, the person's switch plugs in here, and nowhere else.
//
// The person is who's at the computer: the one checked in by PIN if there is
// one, otherwise the sign-in. On a workshop computer currentSession already
// counts the Owner's sign-in as staff unless the Owner is the one working
// (workshop-owner.js); on a till a staff member can be checked in under it.
import { currentSession } from './session.js';
import { currentCheckin, isTheOwner } from '../routes/till-pins.js';

export async function canSeeCosts(req) {
  const ctx = await currentSession(req);
  if (!ctx) return false;
  const checkin = await currentCheckin(req);
  return checkin ? isTheOwner(checkin) : ctx.login.is_owner === true;
}
