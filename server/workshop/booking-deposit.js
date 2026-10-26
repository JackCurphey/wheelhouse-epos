// A booking's deposit, from the stored prices and the shop's settings
// (openspec/changes/deposit-payments design 4–5), never from the booking page.
import { prepare } from '../db.js';
import { paymentsConnected } from '../payments/provider.js';
import { depositPence } from './deposit.js';

/**
 * { pence, cancelHours }: the deposit in pence for these services (or "not
 * sure"), null when none is taken, and the shop's hours before the booking
 * it's free to cancel until; or { error } when a service isn't one that can
 * be booked online.
 */
export async function bookingDeposit({ serviceIds, notSure }) {
  const s = await prepare('SELECT deposit_on, deposit_kind, deposit_percent, deposit_fixed_pence, deposit_unknown_pence, deposit_cancel_hours FROM workshop_settings LIMIT 1').get();
  if (!s || s.deposit_on !== 1) return { pence: null };
  let prices = [];
  if (!notSure) {
    // Prices in pence, as stored (sales in pence, step A′).
    const rows = await prepare('SELECT id, price_pence FROM workshop_services WHERE id = ANY(?) AND active = 1 AND bookable_online = 1').all(serviceIds);
    if (rows.length !== new Set(serviceIds).size) return { error: 'That service is not available to book' };
    const byId = new Map(rows.map((r) => [r.id, r.price_pence]));
    prices = serviceIds.map((id) => byId.get(id));
  }
  return {
    cancelHours: s.deposit_cancel_hours,
    pence: depositPence({
      depositOn: true, depositKind: s.deposit_kind, depositPercent: s.deposit_percent, depositFixedPence: s.deposit_fixed_pence,
      depositUnknownPence: s.deposit_unknown_pence, paymentsConnected: paymentsConnected(),
    }, prices),
  };
}
