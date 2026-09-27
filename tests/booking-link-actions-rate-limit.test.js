// The link's change routes share the read route's attempt limit (piece 12):
// 30 per 15 minutes per IP across every link route, not 30 each.
// Its own file, so its own server and its own limiter.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { linkActions } from './helpers/linkActions.js';

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

test('cancel attempts count against the same limit as reading the link', async () => {
  const link = linkActions(server.baseUrl, owner.shop.slug);
  const madeUp = '0'.repeat(64);
  for (let i = 0; i < 30; i++) {
    assert.equal((await link.cancel(madeUp)).status, 404, `attempt ${i + 1}`);
  }
  assert.equal((await link.read(madeUp)).status, 429);
});
