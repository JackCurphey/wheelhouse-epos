// Privacy requests (openspec/changes/delete-account; Jack's 30 Oct answer 3;
// ac-delete). Runs in the request's shop, so row-level security keeps
// everything to that shop. Dates are the shop's, worked out by the database.
import { prepare } from './db.js';

export const shopZone = async () => (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';

// Open: neither done nor cancelled.
const OPEN = 'r.done_at IS NULL AND r.cancelled_at IS NULL';
// Asked on, and one calendar month on (UK data protection), in the shop's days.
const ASKED_ON = "to_char((r.asked_at AT TIME ZONE ?)::date, 'YYYY-MM-DD')";
const DUE_BY = "to_char((r.asked_at AT TIME ZONE ?)::date + interval '1 month', 'YYYY-MM-DD')";

/** The customer's open deletion request, as the account shows it, or null. */
export async function openDeletion(customerId) {
  const zone = await shopZone();
  const row = await prepare(
    `SELECT ${ASKED_ON} AS "askedOn", ${DUE_BY} AS "finishBy" FROM privacy_requests r
      WHERE r.customer_id = ? AND r.kind = 'delete' AND ${OPEN}`
  ).get(zone, zone, customerId);
  return row ? { askedOn: row.askedOn, finishBy: row.finishBy } : null;
}
