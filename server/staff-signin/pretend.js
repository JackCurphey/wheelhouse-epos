// The pretend WorkOS (openspec/changes/staff-signin-workos design 2): its own
// sign-in page, /api/auth/workos/pretend, asks only for an email and whether
// WorkOS has checked it, then goes back to the callback with a code, as
// WorkOS does. Codes live in this process's memory: the pretend one is for
// tests and a developer's machine, never production (provider.js).
import { createHash, randomBytes } from 'node:crypto';

const VALID_MS = 10 * 60 * 1000;
const codes = new Map(); // code -> { user, sessionId, expiresAt }

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export const pretend = {
  name: 'pretend',
  redirectUri: () => '/api/auth/workos/callback',

  authorizeUrl({ state, redirectUri, provider = 'authkit' }) {
    return `/api/auth/workos/pretend?${new URLSearchParams({ state, redirect_uri: redirectUri, provider })}`;
  },

  /** The pretend page: the form a developer fills in where WorkOS's page would be. */
  page({ state, provider }) {
    // Says which way was asked for, so a test can tell Google from WorkOS's page.
    const heading = provider === 'GoogleOAuth' ? 'Pretend WorkOS · Google' : 'Pretend WorkOS';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${heading}</title></head>
<body><main><h1>${heading}</h1><p>WorkOS's sign-in page goes here when it's connected.</p>
<form method="post" action="/api/auth/workos/pretend">
<input type="hidden" name="state" value="${escapeHtml(state)}">
<label>Email <input type="email" name="email" required autofocus></label>
<label><input type="checkbox" name="verified" checked> WorkOS has checked this email</label>
<button type="submit">Sign in</button></form></main></body></html>`;
  },

  /** A one-use code for what the form said, and where it goes back to. */
  issue({ email, verified, user, state }) {
    email = String(email || '').trim().toLowerCase();
    const id = user || `user_pretend_${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
    const code = randomBytes(16).toString('hex');
    codes.set(code, {
      user: { id, email, emailVerified: !!verified },
      sessionId: `session_pretend_${randomBytes(8).toString('hex')}`,
      expiresAt: Date.now() + VALID_MS,
    });
    return `/api/auth/workos/callback?${new URLSearchParams({ code, state: state || '' })}`;
  },

  async authenticate({ code }) {
    const found = codes.get(code);
    codes.delete(code);
    if (!found || found.expiresAt < Date.now()) return null;
    return { user: found.user, sessionId: found.sessionId };
  },

  // Ending a session from the server, as WorkOS's revoke does
  // (workshop-lock-server): the pretend one keeps nothing to end, and, like
  // WorkOS with an id it doesn't know, refuses one it didn't make.
  revokeSession: async ({ sessionId }) => typeof sessionId === 'string' && sessionId.startsWith('session_pretend_'),

  // WorkOS's sign-out page would come back to the signed-out page; the pretend one goes straight there.
  logoutUrl: ({ sessionId }) => (sessionId ? '/workshop/signed-out' : null),
};
