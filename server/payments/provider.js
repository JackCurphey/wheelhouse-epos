// Which online payment provider this server uses, and whether a shop has
// connected its own account with it (openspec/changes/website-management
// design 6). Until a real account exists (Stripe, set up by Mark) the only
// provider is the pretend one, and only when asked for with
// PAYMENTS_PROVIDER=pretend (the tests, and a developer's .env): left out,
// there is none, so a shop running Wheelhouse for real never takes a pretend
// payment, whatever its stored connection says.
import { prepare } from '../db.js';

const PROVIDERS = ['pretend', 'none'];

export function paymentsProvider() {
  const set = process.env.PAYMENTS_PROVIDER;
  return PROVIDERS.includes(set) ? set : 'none';
}

/** This shop's account with this server's provider, or null. Runs in the shop's context. */
export async function paymentAccount() {
  const provider = paymentsProvider();
  if (provider === 'none') return null;
  const row = await prepare(
    `SELECT provider, status, connected_by, connected_at, to_char(needs_details_by, 'YYYY-MM-DD') AS needs_details_by,
            needs_what, test_paid_at, payout_last4, payout_timing
       FROM online_payment_account WHERE provider = ?`
  ).get(provider);
  return row ?? null;
}

// Connected, or connected and asked for more details by a date: either way
// payments still go through until that date (pay-settings-more).
export const isConnected = (account) => account?.status === 'connected' || account?.status === 'needs_details';

/** Deposits, "Pay now" and Buying online need this shop connected. Runs in the shop's context. */
/** What Settings and the Website page show: none, connected, tested (the £1 test payment made), failed or more (details wanted). */
export function paymentsState(account) {
  if (!account) return 'none';
  if (account.status === 'failed') return 'failed';
  if (account.status === 'needs_details') return 'more';
  return account.test_paid_at ? 'tested' : 'connected';
}

export async function paymentsConnected() {
  return isConnected(await paymentAccount());
}
