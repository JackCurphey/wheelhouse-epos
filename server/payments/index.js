// The online payments adapter (WP-1.11; openspec/changes/deposit-payments
// design 1): what the rest of the server calls to hold an amount on a card,
// take it, let it go, refund it, and read where it stands. Stripe's shape (a
// card payment held, then captured, cancelled or refunded), so Stripe slots in
// behind the same calls. Null when no provider is connected.
import { paymentsProvider } from './provider.js';
import { pretend } from './pretend.js';

export { PaymentError } from './errors.js';

const PROVIDERS = { pretend };

export function payments() {
  return PROVIDERS[paymentsProvider()] ?? null;
}
