// Who signs staff in (openspec/changes/staff-signin-workos design 2): WorkOS's
// own page, through the real WorkOS or a pretend one that answers as it does.
// STAFF_SIGNIN_PROVIDER=workos or pretend chooses; left out, nothing is
// connected and nobody can sign in (WorkOS only, Jack 25 Oct), so a
// developer's .env names one.
import { pretend } from './pretend.js';
import { workosProvider } from './workos.js';

/** The provider, or null when none is connected (and the log says why). */
export function staffSigninProvider(env = process.env, { log = console.error, fetch } = {}) {
  const name = env.STAFF_SIGNIN_PROVIDER;
  if (name === 'pretend') {
    // Anyone could sign in as anyone on the pretend page (review): never in
    // production, and never on the hosted test copy.
    if (env.NODE_ENV === 'production' || env.WHEELHOUSE_HOSTED_COPY === '1') {
      log('Staff sign-in: the pretend WorkOS never runs in production or on the hosted copy. Set STAFF_SIGNIN_PROVIDER=workos.');
      return null;
    }
    return pretend;
  }
  if (name === 'workos') {
    const missing = ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID'].filter((k) => !env[k]);
    if (missing.length) {
      log(`Staff sign-in: WorkOS isn't connected. Set ${missing.join(' and ')}.`);
      return null;
    }
    return workosProvider(env, { fetch, log });
  }
  return null;
}
