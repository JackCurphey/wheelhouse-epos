// A malformed id in a URL is a missing resource, not a server error.
//
// Before this, a non-numeric, fractional or out-of-range id reached Postgres
// and the dispatcher answered 500 with the database's own message, e.g.
// 'invalid input syntax for type integer: "abc"'. Phase 4's screens build
// URLs from route params, where a missing param becomes "undefined" or "NaN",
// so the answer has to be a plain 404 on every route, staff and portal.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let staff;
let customer;

before(async () => {
  server = await startLiveServer();
  staff = await staffSignup(server.baseUrl);
  customer = await portalSignup(server.baseUrl, staff.shop.slug);
});

after(async () => {
  if (staff) await deleteTestShop(staff.shop.id);
  if (server) await server.stop();
});

// Ids are SERIAL (int4), so past 2147483647 Postgres refuses the value too.
const BAD_IDS = ['abc', 'undefined', 'NaN', '1.5', '-1', '0', '1e3', '2147483648'];

function assertPlain404(res, label) {
  assert.equal(res.status, 404, `${label}: expected 404, got ${res.status} ${JSON.stringify(res.body)}`);
  assert.doesNotMatch(JSON.stringify(res.body), /invalid input syntax|out of range|integer/i, `${label} leaked a database message`);
}

test('a staff read with a malformed id answers 404, never a database error', async () => {
  for (const id of BAD_IDS) {
    assertPlain404(await staffRequest(server.baseUrl, staff.cookie, `/api/workshop-jobs/${id}`), `GET job ${id}`);
    assertPlain404(await staffRequest(server.baseUrl, staff.cookie, `/api/customers/${id}`), `GET customer ${id}`);
  }
});

test('a guarded job action with a malformed id answers 404', async () => {
  for (const id of BAD_IDS) {
    const res = await staffRequest(server.baseUrl, staff.cookie, `/api/workshop-jobs/${id}/accept`, {
      method: 'POST',
      body: { version: 1 },
    });
    assertPlain404(res, `POST accept ${id}`);
  }
});

test('a nested id (jobId, then id) is checked too', async () => {
  assertPlain404(await staffRequest(server.baseUrl, staff.cookie, '/api/workshop-jobs/abc/attachments'), 'GET attachments abc');
  assertPlain404(await staffRequest(server.baseUrl, staff.cookie, '/api/workshop-jobs/1/attachments/abc'), 'GET attachment abc');
});

test('a portal read with a malformed id answers 404', async () => {
  for (const id of BAD_IDS) {
    const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${staff.shop.slug}/quotes/${id}`);
    assertPlain404(res, `portal quote ${id}`);
  }
});

test('a well-formed id that does not exist still answers the route\'s own 404', async () => {
  const res = await staffRequest(server.baseUrl, staff.cookie, '/api/workshop-jobs/2147483647');
  assert.equal(res.status, 404);
});

test('a param that is not a row id is left alone: a print job id is hex', async () => {
  // POST /api/print-agents/:deviceId/jobs mints randomBytes(8).toString('hex').
  const res = await staffRequest(server.baseUrl, staff.cookie, '/api/print-agents/jobs/9f2c4a1b7e3d5c60/complete', {
    method: 'POST',
    body: { ok: true },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});
