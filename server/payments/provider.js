// Which online payment provider the shop's deposits go through
// (openspec/changes/deposit-settings design 3). Until a real account exists
// (Stripe, set up by Mark) the only one is the pretend one, and only when
// asked for with PAYMENTS_PROVIDER=pretend (the tests, and a developer's
// .env): left out, no provider is connected and deposits stay off, so a shop
// running Wheelhouse for real never takes a pretend deposit.
const PROVIDERS = ['pretend', 'none'];

export function paymentsProvider() {
  const set = process.env.PAYMENTS_PROVIDER;
  return PROVIDERS.includes(set) ? set : 'none';
}

export const paymentsConnected = () => paymentsProvider() !== 'none';
