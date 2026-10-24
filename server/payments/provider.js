// Which online payment provider the shop's deposits go through
// (openspec/changes/deposit-settings design 3). Until a real account exists
// (Stripe, set up by Mark) it is the pretend one, never in production: there,
// with nothing set, no provider is connected and deposits stay off.
const PROVIDERS = ['pretend', 'none'];

export function paymentsProvider() {
  const set = process.env.PAYMENTS_PROVIDER;
  if (PROVIDERS.includes(set)) return set;
  return process.env.NODE_ENV === 'production' ? 'none' : 'pretend';
}

export const paymentsConnected = () => paymentsProvider() !== 'none';
