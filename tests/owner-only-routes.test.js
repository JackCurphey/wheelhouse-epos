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
  // Website settings and the Shopify connection (Jack, 22 Oct, Mark's audit P2 1).
  ['PUT', '/api/storefront-settings', {}],
  // A shop's own automatic messages (openspec/changes/own-messages-server design 6).
  ['POST', '/api/own-messages', {}],
  ['PUT', `/api/own-messages/${MISSING}`, {}],
  ['DELETE', `/api/own-messages/${MISSING}`],
  ['POST', '/api/shopify/connection', {}],
  ['POST', '/api/storefront-settings/logo', {}],
  ['POST', '/api/storefront-settings/hero', {}],
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
  // Added with the wider scan below (22 Oct audit, missing tests item 10).
  ['PUT', '/api/message-templates/no_such_message', {}],
  ['POST', '/api/sites', {}],
  ['POST', '/api/tills', {}],
  ['POST', `/api/tills/${MISSING}/deactivate`, {}],
  // Purchase orders: making, changing, ordering and closing one is for the
  // Owner until "Can order stock" comes with roles (receiving decision 4,
  // openspec/changes/deliveries-orders).
  ['POST', '/api/purchase-orders', {}],
  ['PUT', `/api/purchase-orders/${MISSING}`, {}],
  ['POST', `/api/purchase-orders/${MISSING}/mark-ordered`, {}],
  ['POST', `/api/purchase-orders/${MISSING}/cancel`, {}],
  // The float, and Seen on a short float (openspec/changes/opening-float-check).
  ['PUT', '/api/end-of-day-settings', { floatPence: 15000 }],
  ['POST', `/api/float-check/${MISSING}/seen`, {}],
  // Close the day and cash taken out, for owners and managers (cash-up
  // decision 5), so the Owner until roles (openspec/changes/close-the-day).
  ['POST', '/api/close-the-day', {}],
  ['POST', '/api/paid-outs', {}],
  // Clearing a forgotten till PIN, for owners and managers (signing in 6;
  // roles and switches 5), so the Owner until roles (openspec/changes/pins-and-checkin).
  ['POST', `/api/team/${MISSING}/clear-pin`, {}],
  // Set up this till: the Owner until roles, never by PIN (roles and
  // switches 2; openspec/changes/till-setup).
  ['GET', '/api/till-setup'],
  ['POST', '/api/till-setup', {}],
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

// A purchase order's refusal says what it's for, not "settings": the old app
// shows the server's words to whoever tried.
test('a staff member refused a purchase order is told it is for the owner, to order stock', async () => {
  const refused = await as(jo)('/api/purchase-orders', { method: 'POST', body: {} });
  assert.deepEqual(refused.body, { error: "Only the shop's owner can order stock", code: 'owner_only' });
});

// ---- Structural check ----
// Changing routes not owner-only, each with its reason. The 19 Oct decision
// covers settings and the team; the day-to-day ones are outside it, not
// approved by name.
const NOT_OWNER_ONLY = new Map([
  ['POST /api/messages/:id/undo', 'day-to-day: Undo a message in its minute, from the diary'],
  ['POST /api/messages/:id/send-now', 'day-to-day: Send now for a held Bike ready, from the diary'],
  ['POST /api/message-templates/:key/preview', 'changes nothing: fills in the wording being typed'],
  ['POST /api/till/:shopSlug/sync', "a till's own sync, signed in with its token, not a staff session"],
  ['POST /api/till-attention/:id/resolve', 'day-to-day: clearing a till sale that needs attention'],
  ['POST /api/purchase-orders/:id/receive', 'day-to-day: everyone can receive deliveries (receiving decision 4)'],
  ['POST /api/deliveries/receive', 'day-to-day: everyone can receive deliveries, with or without an order (receiving decisions 2 and 4)'],
  ['POST /api/float-check', 'day-to-day: the first person in who takes payments checks the float (opening the shop decision 2)'],
  ['POST /api/your-settings/till-pin/offer', 'each person their own: Wheelhouse picks their till PIN (signing in 6 and 7)'],
  ['POST /api/your-settings/till-pin/ask', 'each person their own: Skip for now on the first-time Your till PIN (UX walk-through 4 H1)'],
  ['POST /api/your-settings/till-pin', 'each person their own: keeping the PIN Wheelhouse picked (signing in 6 and 7)'],
  ['POST /api/till-checkin', 'day-to-day: checking in at the till with a PIN (signing in 4)'],
  ['POST /api/till-checkin/end', 'day-to-day: Switch, back to Enter your PIN (signing in 4)'],
  // The Owner checked in by PIN, not the sign-in: the check is giverHere, tested in give-pin-at-till.test.js.
  ['POST /api/till-checkin/give-pin/:id/offer', 'the Owner checked in at the till by PIN, whoever the browser is signed in as (giving a PIN, Jack 28 Oct)'],
  ['DELETE /api/till-checkin/give-pin/:id/offer', 'the Owner checked in at the till by PIN: Close without giving a PIN withdraws the PIN shown (review, 28 Oct)'],
  ['POST /api/till-checkin/give-pin/:id','the Owner checked in at the till by PIN, whoever the browser is signed in as (giving a PIN, Jack 28 Oct)'],
]);
// The settings and team files, and the ones the 22 Oct audit found unscanned
// (docs/reviews/2026-10-22-flagged-merges-audit.md, missing tests item 10).
const FILES = ['workshop-settings.js', 'shop-settings.js', 'team.js', 'website.js', 'messages.js', 'sites-tills.js', 'purchase-orders.js', 'float-check.js', 'close-the-day.js', 'till-pins.js'];

// Comments out, so a guard named only in a comment doesn't count. A "//"
// straight after ":" is left, as in a URL.
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const GUARD = /ownerOnly\(req, res[,)]|login\.is_owner/;

function unguardedRoutes(source, file) {
  const code = withoutComments(source);
  const starts = [...code.matchAll(/route\('(GET|POST|PUT|DELETE|PATCH)', '([^']+)'/g)];
  // Every route( call is one the pattern read, so a route written another way isn't skipped.
  assert.equal(starts.length, (code.match(/\broute\(/g) || []).length, `${file}: a route the scan can't read`);
  // And stripping comments removed none (a "/*" inside a string would).
  assert.equal(starts.length, (source.match(/route\('(GET|POST|PUT|DELETE|PATCH)', '/g) || []).length, `${file}: comment stripping removed a route`);
  const found = [];
  starts.forEach((m, i) => {
    if (m[1] === 'GET') return;
    const chunk = code.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : code.length);
    if (!GUARD.test(chunk)) found.push(`${m[1]} ${m[2]}`);
  });
  return { changing: starts.filter((m) => m[1] !== 'GET').length, found };
}

test('every POST/PUT/DELETE route in the scanned files is owner-only or on the allow-list', () => {
  const unguarded = [];
  const allowed = [];
  let seen = 0;
  for (const file of FILES) {
    const source = readFileSync(new URL(`../server/routes/${file}`, import.meta.url), 'utf8');
    const { changing, found } = unguardedRoutes(source, file);
    seen += changing;
    for (const route of found) (NOT_OWNER_ONLY.has(route) ? allowed : unguarded).push(`${route} (${file})`);
  }
  assert.ok(seen >= 35, `expected to find the changing routes, found ${seen}`);
  assert.deepEqual(unguarded, []);
  // The allow-list holds only routes that are still unguarded: one that gains
  // the check comes off the list.
  assert.equal(allowed.length, NOT_OWNER_ONLY.size, `allow-listed routes now guarded or gone: ${[...NOT_OWNER_ONLY.keys()].filter((r) => !allowed.some((a) => a.startsWith(`${r} (`)))}`);
});

test('the scan ignores a guard that is only in a comment', () => {
  const source = [
    "route('PUT', '/api/a', async (req, res) => {",
    '  // login.is_owner is checked elsewhere',
    '  /* if (await ownerOnly(req, res)) return; */',
    '});',
    "route('PUT', '/api/b', async (req, res) => {",
    '  if (await ownerOnly(req, res)) return;',
    "  sendJson(res, 200, { link: 'https://example.test' });",
    '});',
  ].join('\n');
  assert.deepEqual(unguardedRoutes(source, 'example').found, ['PUT /api/a']);
});
