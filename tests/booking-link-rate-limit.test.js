// The private link's attempt limit: 30 lookups per 15 minutes per IP.
// Its own file, so its own server and its own limiter.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('the 31st lookup inside the window is refused', async () => {
  const path = `/api/portal/${owner.shop.slug}/booking-links/${'0'.repeat(64)}`;
  for (let i = 0; i < 30; i++) {
    assert.equal((await jsonRequest(server.baseUrl, null, path)).status, 404, `lookup ${i + 1}`);
  }
  assert.equal((await jsonRequest(server.baseUrl, null, path)).status, 429);
});
