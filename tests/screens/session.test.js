// The staff app's only identity source, with fetch stubbed.
//
// The signed-in body is serializeSession's real shape (server/server.js):
// flat, with the shop as shopName/shopSlug and no shop id.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSession } from '../../src/lib/auth/use-session.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  return calls;
}

const ME = { id: 3, name: 'Alex', email: 'a@example.com', isOwner: true, shopName: 'Spokes', shopSlug: 'spokes' };

test('useSession reports signed-out on 401 rather than throwing', async () => {
  stubFetch(401, { error: 'Not signed in' });
  const state = await resolveSession();
  assert.equal(state.status, 'signed-out');
});

test('useSession reads identity only from /api/auth/me', async () => {
  const calls = stubFetch(200, ME);
  await resolveSession();
  assert.deepEqual(calls.map((c) => c.url), ['/api/auth/me']);
});

test('a signed-in session carries the user and shop from the real response', async () => {
  stubFetch(200, ME);
  assert.deepEqual(await resolveSession(), {
    status: 'signed-in',
    user: { id: 3, name: 'Alex', email: 'a@example.com', isOwner: true },
    shop: { name: 'Spokes', slug: 'spokes' },
  });
});

test('a server failure is an error, not disguised as signed-out', async () => {
  // Otherwise an outage silently becomes a login screen.
  stubFetch(500, { error: 'Internal server error' });
  await assert.rejects(() => resolveSession(), (err) => err.status === 500);
});
