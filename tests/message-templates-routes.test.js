// Settings › Messages (the messages engine, Jack 20 Oct;
// openspec/changes/messages-engine/design.md, drawings set-msg-list and
// set-msg-edit): every message with its wording, the Owner changing one or
// going back to Wheelhouse's, and the preview with the drawing's example.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { TEMPLATES } from '../server/messaging/templates.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

test('every message, with Wheelhouse’s wording and which can be sent today', async () => {
  const res = await as(jo)('/api/message-templates');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.map((m) => m.key), Object.keys(TEMPLATES));
  const ready = res.body.find((m) => m.key === 'bike_ready');
  assert.equal(ready.name, 'Bike ready');
  assert.equal(ready.when, 'When a job is marked ready');
  assert.equal(ready.enabled, true);
  assert.equal(ready.changed, false);
  assert.equal(ready.live, true);
  assert.equal(ready.wording, TEMPLATES.bike_ready.wording);
  assert.equal(ready.subject, TEMPLATES.bike_ready.subject);
  assert.deepEqual(ready.tapIns, TEMPLATES.bike_ready.tapIns);
  assert.equal(res.body.find((m) => m.key === 'booking_confirmed').live, false);
});

test('the Owner rewords a message, switches it off, then goes back to Wheelhouse’s wording', async () => {
  const put = (body) => as(owner)('/api/message-templates/bike_ready', { method: 'PUT', body });
  let res = await put({ wording: 'Hi [Customer’s first name], ready! [Job number]', subject: 'Ready' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.wording, 'Hi [Customer’s first name], ready! [Job number]');
  assert.equal(res.body.subject, 'Ready');
  assert.equal(res.body.changed, true);
  res = await put({ enabled: false });
  assert.equal(res.body.enabled, false);
  assert.equal(res.body.wording, 'Hi [Customer’s first name], ready! [Job number]', 'left as it was');
  res = await put({ enabled: true, wording: null, subject: '  ' });
  assert.equal(res.body.wording, TEMPLATES.bike_ready.wording);
  assert.equal(res.body.subject, TEMPLATES.bike_ready.subject);
  assert.equal(res.body.changed, false);
  assert.equal((await as(owner)('/api/message-templates')).body.find((m) => m.key === 'bike_ready').changed, false);
});

test('only the Owner can change a message; bad changes are refused', async () => {
  const jos = await as(jo)('/api/message-templates/bike_ready', { method: 'PUT', body: { enabled: false } });
  assert.equal(jos.status, 403);
  assert.equal(jos.body.code, 'owner_only');
  assert.equal((await as(owner)('/api/message-templates/nope', { method: 'PUT', body: { enabled: false } })).status, 404);
  assert.equal((await as(owner)('/api/message-templates/bike_ready', { method: 'PUT', body: { enabled: 'yes' } })).status, 400);
  assert.equal((await as(owner)('/api/message-templates/bike_ready', { method: 'PUT', body: { wording: 'x'.repeat(2001) } })).status, 400);
});

test('the preview fills the drawing’s example, as a text and as an email', async () => {
  // The shop's own name (a test shop's carries a suffix).
  const shop = (await as(owner)('/api/shop-details')).body.name;
  assert.match(shop, /^North Street Cycles/);
  const res = await as(jo)('/api/message-templates/bike_ready/preview', { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.text, `Hi Maya, your Trek Domane AL 3 is ready to collect from ${shop}. £111.00 to pay on collection. See what we did: [link]. Job WH-1042. We’re open [opening hours].`);
  assert.equal(res.body.email.subject, `Your bike is ready — ${shop}`);
  assert.equal(res.body.email.body, res.body.text);
  const typed = await as(jo)('/api/message-templates/bike_ready/preview', { method: 'POST', body: { wording: 'Hi [Customer’s first name] — [Bike]', subject: '[Shop name] says hi' } });
  assert.equal(typed.body.text, 'Hi Maya — Trek Domane AL 3');
  assert.equal(typed.body.email.subject, `${shop} says hi`);
  assert.equal((await as(jo)('/api/message-templates/nope/preview', { method: 'POST', body: {} })).status, 404);
});
