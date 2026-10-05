// WP-0.2: a shop's "today" runs midnight to midnight on its own clock, not
// UTC. The live server's clock is pinned to 07:00 UK time on 1 Sep 2026
// (British Summer Time), so the shop's day is 23:00 UTC 31 Aug to 23:00 UTC
// 1 Sep.
// Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

const addSale = (createdAt, total) => runWithShop(owner.shop.id, () => prepare(
  "INSERT INTO sales (created_at, subtotal, total, payment_method) VALUES (?, ?, ?, 'Cash')"
).run(createdAt, total, total));

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  await addSale('2026-08-31T22:30:00Z', 1); // 23:30 UK, 31 Aug: yesterday
  await addSale('2026-08-31T23:30:00Z', 10); // 00:30 UK, 1 Sep: today
  await addSale('2026-09-01T22:30:00Z', 100); // 23:30 UK, 1 Sep: today
  await addSale('2026-09-01T23:30:00Z', 1000); // 00:30 UK, 2 Sep: tomorrow
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test("the dashboard counts the shop's own day", async () => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/dashboard');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(Number(res.body.todayCount), 2);
  assert.equal(Number(res.body.todayTotal), 110);
});

test("the sales list's today is the shop's own day", async () => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/sales?date=today');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.map((s) => Number(s.total)).sort((a, b) => a - b), [10, 100]);
});

test('a named date is the shop\'s day too', async () => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/sales?date=2026-09-02');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.map((s) => Number(s.total)), [1000]);
});
