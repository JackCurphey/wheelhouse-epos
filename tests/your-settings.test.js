// Your settings › Accessibility, the server (openspec/changes/your-settings-accessibility;
// workshop day 57; Jack, 23 Oct, answer 1: saved on the signed-in account).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Settings Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

const call = (who, options) => staffRequest(server.baseUrl, who.cookie, '/api/your-settings', options);
// Show the diary legend starts on (diary-legend-box design 1); every other switch starts off.
const ALL_OFF = { showLegend: true, statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false };

test('every switch starts off, but Show the diary legend, which starts on', async () => {
  const res = await call(owner);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { accessibility: ALL_OFF });
});

test('a change saves for this login only, and comes back whole', async () => {
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.ok(made.status < 300, JSON.stringify(made.body));
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const res = await call(jo, { method: 'PUT', body: { accessibility: { largerText: true } } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { accessibility: { ...ALL_OFF, largerText: true } });
  const again = await call(jo, { method: 'PUT', body: { accessibility: { reduceMotion: true } } });
  assert.deepEqual(again.body.accessibility, { ...ALL_OFF, largerText: true, reduceMotion: true }, 'the earlier one is kept');
  assert.deepEqual((await call(jo)).body.accessibility, { ...ALL_OFF, largerText: true, reduceMotion: true });
  assert.deepEqual((await call(owner)).body.accessibility, ALL_OFF, 'the Owner’s are their own');
  assert.deepEqual((await call(other)).body.accessibility, ALL_OFF, 'another shop’s are their own');
});

test('an unknown switch, a value that isn’t on or off, or no switches is refused, and nothing is saved', async () => {
  for (const body of [{ accessibility: { biggerButtons: true } }, { accessibility: { largerText: 'yes' } }, { accessibility: [] }, {}, { accessibility: null }]) {
    const res = await call(owner, { method: 'PUT', body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await call(owner)).body.accessibility, ALL_OFF);
});

test('signed out is refused', async () => {
  const res = await fetch(`${server.baseUrl}/api/your-settings`);
  assert.equal(res.status, 401);
});

test('Show the diary legend switches off for this login, and back on', async () => {
  const off = await call(owner, { method: 'PUT', body: { accessibility: { showLegend: false } } });
  assert.equal(off.body.accessibility.showLegend, false);
  assert.equal((await call(owner)).body.accessibility.showLegend, false);
  assert.equal((await call(other)).body.accessibility.showLegend, true, 'nobody else’s');
  assert.equal((await call(owner, { method: 'PUT', body: { accessibility: { showLegend: true } } })).body.accessibility.showLegend, true);
});
