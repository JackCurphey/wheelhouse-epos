// A shop's online payments account, as connecting through Settings › Front
// desk › Online orders leaves it (openspec/changes/website-management design
// 6). Booking deposits and "Pay now" need it connected, on a server whose
// provider is the pretend one (as liveServer sets). `status` and the other
// fields stand in for what the provider would say, e.g. that it needs more
// details by a date.
import { runWithShop, prepare } from '../../server/db.js';

export function connectPayments(shopId, { provider = 'pretend', status = 'connected', needsDetailsBy = null, needsWhat = null, testPaid = false } = {}) {
  return runWithShop(shopId, () => prepare(
    `INSERT INTO online_payment_account (provider, status, connected_at, needs_details_by, needs_what, test_paid_at)
     VALUES (?, ?, now(), ?, ?, CASE WHEN ? THEN now() END)
     ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = EXCLUDED.status,
       needs_details_by = EXCLUDED.needs_details_by, needs_what = EXCLUDED.needs_what, test_paid_at = EXCLUDED.test_paid_at, updated_at = now()
   RETURNING shop_id`
  ).run(provider, status, needsDetailsBy, needsWhat, testPaid));
}
