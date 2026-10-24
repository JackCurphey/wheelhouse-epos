// A booking's deposit, from the stored prices and the shop's settings
// (openspec/changes/deposit-payments design 4–5), never from the booking page.
import { prepare } from '../db.js';
import { paymentsConnected } from '../payments/provider.js';
import { depositPence, poundsToPence } from './deposit.js';

/**
 * The deposit in pence for these services (or "not sure"), null when none is
 * taken, or { error } when a service isn't one that can be booked online.
 */
export async function bookingDeposit({ serviceIds, notSure }) {
  const s = await prepare('SELECT deposit_on, deposit_kind, deposit_percent, deposit_fixed_pence, deposit_unknown_pence FROM workshop_settings LIMIT 1').get();
  if (!s || s.deposit_on !== 1) return { pence: null };
  let prices = [];
  if (!notSure) {
    const rows = await prepare('SELECT id, price FROM workshop_services WHERE id = ANY(?) AND active = 1 AND bookable_online = 1').all(serviceIds);
    if (rows.length !== new Set(serviceIds).size) return { error: 'That service is not available to book' };
    const byId = new Map(rows.map((r) => [r.id, r.price]));
    prices = serviceIds.map((id) => poundsToPence(byId.get(id)));
  }
  return {
    pence: depositPence({
      depositOn: true, depositKind: s.deposit_kind, depositPercent: s.deposit_percent, depositFixedPence: s.deposit_fixed_pence,
      depositUnknownPence: s.deposit_unknown_pence, paymentsConnected: paymentsConnected(),
    }, prices),
  };
}
