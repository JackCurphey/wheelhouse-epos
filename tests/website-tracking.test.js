// Tracking tools on the server (openspec/changes/website-management,
// design 5, task 4.2): a fixed list of four tools, each switched on with an
// ID in the draft; a wrong ID is kept and waits; off keeps the ID; customers
// get only the published tools whose ID is right, each with its kind.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };

async function setUpShop(t, name) {
  const s = await staffSignup(server.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(server.baseUrl, s.cookie, p, options);
  ok(await req('/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'nothing', mainColour: '#1A3F66' } }));
  const tool = (key, body) => req(`/api/website/tracking/${key}`, { method: 'PUT', body });
  const info = async () => (await fetch(`${server.baseUrl}/api/storefront/info?storefrontSlug=${s.shop.slug}`)).json();
  return { req, tool, info };
}
const byKey = (state, key) => state.tracking.find((t) => t.tool === key);

test('the four tools are listed in the drawn order with their kinds, all off', async (t) => {
  const { req } = await setUpShop(t, '[Tools shop]');
  const state = ok(await req('/api/website'));
  assert.deepEqual(state.tracking.map((x) => [x.tool, x.name, x.kind, x.on]), [
    ['google_analytics', 'Google Analytics', 'Statistics', false],
    ['microsoft_clarity', 'Microsoft Clarity', 'Statistics', false],
    ['meta_pixel', 'Meta (Facebook) Pixel', 'Marketing', false],
    ['tiktok_pixel', 'TikTok Pixel', 'Marketing', false],
  ]);
  assert.equal(byKey(state, 'google_analytics').idHelp, 'From your Google Analytics account. It starts with G-');
});

test('switching a tool on saves it to the draft only, as one change to publish', async (t) => {
  const { req, tool, info } = await setUpShop(t, '[Draft tools shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  const state = ok(await tool('google_analytics', { on: true, id: 'G-PSW1MY7HB4' }));
  assert.deepEqual(byKey(state, 'google_analytics'), {
    ...byKey(state, 'google_analytics'), on: true, id: 'G-PSW1MY7HB4', waiting: false, idProblem: null,
  });
  assert.deepEqual(state.changes, [{ page: 'Tracking tools', parts: ['Tracking tools'] }]);
  assert.deepEqual((await info()).tracking, []);
});

test('a wrong ID is kept and waits, with the drawn words; it is no change customers would see', async (t) => {
  const { req, tool } = await setUpShop(t, '[Wrong ID shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  const state = ok(await tool('google_analytics', { on: true, id: 'UA-[number]' }));
  const ga = byKey(state, 'google_analytics');
  assert.equal(ga.id, 'UA-[number]');
  assert.equal(ga.on, true);
  assert.equal(ga.waiting, true);
  assert.equal(ga.idProblem, 'That doesn’t look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings.');
  assert.deepEqual(state.changes, []);
});

test('switched on with no ID yet, a tool waits without a problem to show', async (t) => {
  const { tool } = await setUpShop(t, '[No ID shop]');
  const ga = byKey(ok(await tool('google_analytics', { on: true })), 'google_analytics');
  assert.equal(ga.id, '');
  assert.equal(ga.waiting, true);
  assert.equal(ga.idProblem, null);
});

test('switching a tool off keeps its ID, and on again brings it back', async (t) => {
  const { tool } = await setUpShop(t, '[Off keeps shop]');
  ok(await tool('meta_pixel', { on: true, id: '123456789012345' }));
  const off = byKey(ok(await tool('meta_pixel', { on: false })), 'meta_pixel');
  assert.equal(off.on, false);
  assert.equal(off.id, '123456789012345');
  const again = byKey(ok(await tool('meta_pixel', { on: true })), 'meta_pixel');
  assert.equal(again.on, true);
  assert.equal(again.id, '123456789012345');
  assert.equal(again.waiting, false);
});

test('published, customers get only the tools that are on with a right ID, each with its kind', async (t) => {
  const { req, tool, info } = await setUpShop(t, '[Live tools shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  ok(await tool('google_analytics', { on: true, id: 'G-PSW1MY7HB4' }));
  ok(await tool('microsoft_clarity', { on: true, id: 'not an id!' }));
  ok(await tool('tiktok_pixel', { on: true, id: 'C4A1B2C3D4E5F6G7H8I9' }));
  ok(await tool('tiktok_pixel', { on: false }));
  ok(await req('/api/website/publish', { method: 'POST' }));
  assert.deepEqual((await info()).tracking, [{ tool: 'google_analytics', kind: 'Statistics', id: 'G-PSW1MY7HB4' }]);
});

test('the letters-and-numbers tools take a plain ID, trimmed; pasted code or anything around an ID waits and never reaches customers', async (t) => {
  const { req, tool, info } = await setUpShop(t, '[ID checks shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  const meta = byKey(ok(await tool('meta_pixel', { on: true, id: '  123456789012345 ' })), 'meta_pixel');
  assert.equal(meta.id, '123456789012345');
  assert.equal(meta.waiting, false);
  assert.equal(byKey(ok(await tool('tiktok_pixel', { on: true, id: 'C4A1B2C3D4E5F6G7H8I9' })), 'tiktok_pixel').waiting, false);
  for (const [key, id] of [
    ['microsoft_clarity', '<script>alert(1)</script>abc'],
    ['microsoft_clarity', "fbq('init','123')"],
    ['google_analytics', 'G-1"><script>x</script>'],
    ['google_analytics', 'G-'],
  ]) assert.equal(byKey(ok(await tool(key, { on: true, id })), key).waiting, true, id);
  ok(await req('/api/website/publish', { method: 'POST' }));
  assert.deepEqual((await info()).tracking, [
    { tool: 'meta_pixel', kind: 'Marketing', id: '123456789012345' },
    { tool: 'tiktok_pixel', kind: 'Marketing', id: 'C4A1B2C3D4E5F6G7H8I9' },
  ]);
});

test('with the website off, customers get no answer at all, so no tracking, even when tools are published', async (t) => {
  const { req, tool, info } = await setUpShop(t, '[Off tracking shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  ok(await tool('google_analytics', { on: true, id: 'G-PSW1MY7HB4' }));
  ok(await req('/api/website/publish', { method: 'POST' }));
  ok(await req('/api/website/turn-off', { method: 'POST' }));
  assert.deepEqual(await info(), { error: 'Storefront not found' });
});

test('one shop’s tools never reach another shop’s customers or draft', async (t) => {
  const a = await setUpShop(t, '[Shop A tools]');
  const b = await setUpShop(t, '[Shop B tools]');
  ok(await a.req('/api/website/turn-on', { method: 'POST' }));
  ok(await a.tool('google_analytics', { on: true, id: 'G-AAA' }));
  ok(await a.req('/api/website/publish', { method: 'POST' }));
  ok(await b.req('/api/website/turn-on', { method: 'POST' }));
  ok(await b.tool('google_analytics', { on: true, id: 'G-BBB' }));
  assert.deepEqual((await b.info()).tracking, []);
  assert.equal(byKey(ok(await a.req('/api/website')), 'google_analytics').id, 'G-AAA');
});

test('an unknown tool, a missing on, an ID that isn’t text and a tool before set-up are refused', async (t) => {
  const { tool } = await setUpShop(t, '[Refused shop]');
  for (const key of ['hotjar', '__proto__', 'constructor']) assert.equal((await tool(key, { on: true, id: 'x' })).status, 404, key);
  assert.equal((await tool('google_analytics', { id: 'G-1' })).status, 400);
  assert.equal((await tool('google_analytics', { on: true, id: 42 })).status, 400);
  assert.equal((await tool('google_analytics', { on: true, id: `G-${'A'.repeat(200)}` })).status, 400);
  const early = await staffSignup(server.baseUrl, { shopName: '[Early tools shop]' });
  t.after(() => deleteTestShop(early.shop.id));
  const res = await staffRequest(server.baseUrl, early.cookie, '/api/website/tracking/google_analytics', { method: 'PUT', body: { on: true, id: 'G-1' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'Set up the website first');
});

