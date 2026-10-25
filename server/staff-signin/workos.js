// The real WorkOS (openspec/changes/staff-signin-workos design 2): three calls
// to its API, as its reference describes them (checked 25 Oct), with plain
// fetch rather than its SDK.
const API = 'https://api.workos.com';
const DEFAULT_REDIRECT = 'http://localhost:8080/api/auth/workos/callback';

// The session id is the access token's sid claim. The token comes straight
// from WorkOS over HTTPS and only sid is read, so it isn't verified.
function sidFrom(accessToken) {
  try {
    return JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString()).sid ?? null;
  } catch {
    return null;
  }
}

export function workosProvider(env, { fetch = globalThis.fetch, log = console.error } = {}) {
  const redirectUri = () => env.WORKOS_REDIRECT_URI || DEFAULT_REDIRECT;
  return {
    name: 'workos',
    redirectUri,

    authorizeUrl({ state, redirectUri }) {
      const url = new URL('/user_management/authorize', API);
      url.search = new URLSearchParams({
        client_id: env.WORKOS_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', provider: 'authkit', state,
      });
      return url.href;
    },

    /** The person WorkOS signed in and their WorkOS session, or null if it refused. */
    async authenticate({ code }) {
      let res;
      try {
        res = await fetch(`${API}/user_management/authenticate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_id: env.WORKOS_CLIENT_ID, client_secret: env.WORKOS_API_KEY, grant_type: 'authorization_code', code,
          }),
        });
      } catch (err) {
        log(`Staff sign-in: WorkOS couldn't be reached: ${err.message}`);
        return null;
      }
      if (!res.ok) return null;
      try {
        const { user, access_token: accessToken } = await res.json();
        if (!user?.id || !user.email) throw new Error('no user in the reply');
        const sessionId = sidFrom(accessToken);
        if (!sessionId) log('Staff sign-in: WorkOS gave no session id, so signing out ends only the Wheelhouse session.');
        return {
          user: { id: user.id, email: String(user.email).trim().toLowerCase(), emailVerified: user.email_verified === true },
          sessionId,
        };
      } catch (err) {
        log(`Staff sign-in: WorkOS's reply couldn't be read: ${err.message}`);
        return null;
      }
    },

    logoutUrl({ sessionId }) {
      if (!sessionId) return null;
      const url = new URL('/user_management/sessions/logout', API);
      url.searchParams.set('session_id', sessionId);
      // Back to the staff app's signed-out page, a Sign-out URI in WorkOS's Redirects.
      url.searchParams.set('return_to', new URL('/workshop/signed-out', redirectUri()).href);
      return url.href;
    },
  };
}
