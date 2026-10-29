// The real WorkOS (openspec/changes/staff-signin-workos design 2): its calls
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

    // provider: 'authkit' for WorkOS's own page, 'GoogleOAuth' straight to Google.
    authorizeUrl({ state, redirectUri, provider = 'authkit' }) {
      const url = new URL('/user_management/authorize', API);
      url.search = new URLSearchParams({
        client_id: env.WORKOS_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', provider, state,
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

    /**
     * Ends a WorkOS session from the server (POST /user_management/sessions/revoke,
     * workos.com/docs/reference/user-management/session/revoke, checked 29 Oct):
     * a workshop computer keeps no remembered WorkOS session
     * (openspec/changes/workshop-lock-server). True when it is over: WorkOS
     * took it, or refused it for good with a 4xx other than 429 (an unknown
     * or ended session; the reference doesn't say which status that gets,
     * and its errors page has 404 "The resource was not found"). False to
     * try again: not reached, 429, or a WorkOS fault (5xx).
     */
    async revokeSession({ sessionId }) {
      if (!sessionId) return false;
      try {
        const res = await fetch(`${API}/user_management/sessions/revoke`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.WORKOS_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
        const retry = res.status === 429 || res.status >= 500;
        log(`Staff sign-in: WorkOS didn't end a workshop computer's session (${res.status})${retry ? ', to try again' : ''}.`);
        return !retry;
      } catch (err) {
        log(`Staff sign-in: WorkOS couldn't be reached to end a workshop computer's session: ${err.message}`);
        return false;
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
