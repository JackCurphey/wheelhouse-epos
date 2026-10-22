// Every route that changes settings or the team is for the Owner only, until
// roles are built (Jack, 19 Oct, docs/decisions/2026-10-19-owner-only-settings.md).
// Part 1 calls each route as a non-owner and as the Owner. Part 2 reads the
// route files so a new changing route added without the check fails here.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

// Ids that don't exist: the check must come before any lookup, so a non-owner
// gets 403 (not 404), and the Owner gets something else (404 or 400, not 403).
const MISSING = 999999;
const ROUTES = [
  ['POST', '/api/workshop-unavailability', {}],
  ['PUT', `/api/workshop-unavailability/${MISSING}`, {}],
  ['DELETE', `/api/workshop-unavailability/${MISSING}`],
  ['POST', '/api/workshop-service-categories', {}],
  ['PUT', `/api/workshop-service-categories/${MISSING}`, {}],
  ['DELETE', `/api/workshop-service-categories/${MISSING}`],
  ['POST', '/api/workshop-services', {}],
  ['PUT', `/api/workshop-services/${MISSING}`, {}],
  ['DELETE', `/api/workshop-services/${MISSING}`],
  ['POST', '/api/storage-slots', {}],
  ['DELETE', `/api/storage-slots/${MISSING}`],
  ['POST', '/api/workshop-checklists', {}],
  ['PUT', `/api/workshop-checklists/${MISSING}`, {}],
  ['DELETE', `/api/workshop-checklists/${MISSING}`],
  ['PUT', '/api/label-settings', { widthMm: 50, heightMm: 30 }],
  ['PUT', '/api/shop-theme', {}],
  ['PUT', `/api/employees/${MISSING}`, {}],
  ['DELETE', `/api/employees/${MISSING}/permanent`],
  ['POST', '/api/team', {}],
  ['POST', `/api/team/${MISSING}/deactivate`, {}],
  ['POST', `/api/team/${MISSING}/reactivate`, {}],
  ['POST', `/api/team/${MISSING}/attach-login`, {}],
  ['POST', `/api/team/logins/${MISSING}/attach-roles`, {}],
  ['POST', `/api/team/logins/${MISSING}/deactivate`, {}],
  ['POST', `/api/team/logins/${MISSING}/reactivate`, {}],
];

for (const [method, path, body] of ROUTES) {
  test(`${method} ${path}: refused for a staff member, not refused for the Owner`, async () => {
    const options = body === undefined ? { method } : { method, body };
    const refused = await as(jo)(path, options);
    assert.equal(refused.status, 403, JSON.stringify(refused.body));
    const allowed = await as(owner)(path, options);
    assert.notEqual(allowed.status, 403, JSON.stringify(allowed.body));
    assert.notEqual(allowed.status, 401, JSON.stringify(allowed.body));
  });
}

// ---- Structural check ----
// Changing routes deliberately NOT owner-only. Empty today: anything added
// here needs a reason, in a comment beside it.
const NOT_OWNER_ONLY = new Set([
  // 'POST /api/example', // reason
]);
const FILES = ['workshop-settings.js', 'shop-settings.js', 'team.js'];

test('every POST/PUT/DELETE route in the settings and team files is owner-only or on the allow-list', () => {
  const unguarded = [];
  let seen = 0;
  for (const file of FILES) {
    const source = readFileSync(new URL(`../server/routes/${file}`, import.meta.url), 'utf8');
    const starts = [...source.matchAll(/route\('(GET|POST|PUT|DELETE|PATCH)', '([^']+)'/g)];
    starts.forEach((m, i) => {
      if (m[1] === 'GET') return;
      seen += 1;
      const chunk = source.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : source.length);
      const guarded = /ownerOnly\(req, res\)/.test(chunk) || /login\.is_owner/.test(chunk);
      if (!guarded && !NOT_OWNER_ONLY.has(`${m[1]} ${m[2]}`)) unguarded.push(`${m[1]} ${m[2]} (${file})`);
    });
  }
  assert.ok(seen >= 20, `expected to find the changing routes, found ${seen}`);
  assert.deepEqual(unguarded, []);
});
