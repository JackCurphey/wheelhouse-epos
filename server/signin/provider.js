// Who sends and checks a customer's sign-in code (openspec/changes/customer-code-signin
// design 1). WorkOS Magic Auth does, once a real account exists (signing-in
// decision 5); until then the only one is the pretend one, and only when asked
// for with CUSTOMER_SIGNIN_PROVIDER=pretend (the tests, and a developer's .env):
// left out, nothing is connected and sign-in by code says so, so a shop
// running Wheelhouse for real never signs anyone in with a pretend code.
import { pretend } from './pretend.js';

const PROVIDERS = { pretend };

/** The provider, or null when none is connected. */
export function signinProvider() {
  return PROVIDERS[process.env.CUSTOMER_SIGNIN_PROVIDER] ?? null;
}
