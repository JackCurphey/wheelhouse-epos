// The website's cookie choices and the staff banner's switch
// (openspec/changes/website-browse, design 4 and 5; tasks 8.1, 8.4, 8.6).
// A tracking tool's ID reaches the page only once the visitor's wh_cookies
// choice turns its kind on; Turn it on and Turn off at /store/<slug>/ work
// only for this shop's Owner and use the Website page's own code; a customer
// and another shop's staff see only wb-off.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { runWithShop, prepare, pool } from '../server/db.js';

let server;
let north;
let south;
let jo;
let visitor = 0;
const nextVisitor = () => `198.51.100.${++visitor}`;

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  north = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  south = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });
  const made = await staffRequest(server.baseUrl, north.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  for (const shop of [north, south]) {
    assert.equal((await staffRequest(server.baseUrl, shop.cookie, '/api/website')).status, 200);
  }
});

after(async () => {
  for (const shop of [north, south]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function ask(path, { method = 'GET', host, cookie, fetchSite } = {}) {
  const base = new URL(server.baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: base.hostname, port: base.port, path, method,
      headers: {
        ...(host ? { host } : {}), ...(cookie ? { cookie } : {}), ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {}),
        'x-forwarded-for': nextVisitor(),
      },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(text); } catch { body = text; }
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}
const site = (shop, rest = '', opts) => ask(`/store/${shop.shop.slug}/api/site${rest}`, opts);
const turn = (shop, which, opts) => site(shop, `/turn-${which}`, { method: 'POST', fetchSite: 'same-origin', ...opts });
const OFF = { error: 'This website isn’t available' };
const state = (shop) => runWithShop(shop.shop.id, () => prepare('SELECT is_on, published, live_version_id FROM website').get());
const setOn = (shop, on) => runWithShop(shop.shop.id, () => prepare('UPDATE website SET is_on = ?').run(on));

test('a tracking tool’s ID reaches the page only when the visitor’s wh_cookies choice turns its kind on', async () => {
  assert.equal((await staffRequest(server.baseUrl, north.cookie, '/api/website/turn-on', { method: 'POST' })).status, 200);
  const tools = [
    { tool: 'google_analytics', on: true, id: 'G-MEASURE01' },
    { tool: 'meta_pixel', on: true, id: '1234567890' },
  ];
  await runWithShop(north.shop.id, () => prepare("UPDATE website SET published = jsonb_set(published, '{tracking}', ?::jsonb)").run(JSON.stringify(tools)));
  try {
    const kindAndName = [{ kind: 'Statistics', name: 'Google Analytics' }, { kind: 'Marketing', name: 'Meta (Facebook) Pixel' }];
    // No choice yet, and Reject all: kind and name only.
    // Half a choice is no choice: the page shows the banner for it, so the server sends no ID either.
    for (const cookie of [undefined, 'wh_cookies=measuring-off.advertising-off', 'wh_cookies=nonsense', 'wh_cookies=measuring-on', 'wh_cookies=advertising-on.measuring-maybe']) {
      const res = await site(north, '', { cookie });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.tracking, kindAndName, String(cookie));
      assert.ok(!JSON.stringify(res.body).includes('G-MEASURE01') && !JSON.stringify(res.body).includes('1234567890'), String(cookie));
    }
    // Measuring on, advertising off: the statistics tool's ID only.
    const measuring = (await site(north, '', { cookie: 'wh_cookies=measuring-on.advertising-off' })).body;
    assert.deepEqual(measuring.tracking, [
      { kind: 'Statistics', name: 'Google Analytics', tool: 'google_analytics', id: 'G-MEASURE01' },
      { kind: 'Marketing', name: 'Meta (Facebook) Pixel' },
    ]);
    // Accept all: both.
    const all = (await site(north, '', { cookie: 'other=1; wh_cookies=measuring-on.advertising-on' })).body;
    assert.deepEqual(all.tracking.map((t) => t.id), ['G-MEASURE01', '1234567890']);
  } finally {
    await runWithShop(north.shop.id, () => prepare("UPDATE website SET published = jsonb_set(published, '{tracking}', '[]'::jsonb)").run());
  }
});

test('Turn it on at the store path publishes the first time and switches on, with the Website page’s own code', async () => {
  await setOn(north, false);
  await runWithShop(north.shop.id, () => prepare('UPDATE website SET published = NULL, live_version_id = NULL').run());
  const draftHeadline = `[Draft ${randomUUID().slice(0, 8)}]`;
  await runWithShop(north.shop.id, () => prepare("UPDATE website SET draft = jsonb_set(draft, '{parts,headline,text}', to_jsonb(?::text))").run(draftHeadline));
  const on = await turn(north, 'on', { cookie: north.cookie });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.deepEqual(on.body, { on: true });
  const row = await state(north);
  assert.equal(row.is_on, true);
  assert.equal(row.published.parts.headline.text, draftHeadline);
  assert.ok(row.live_version_id != null, 'a version was made, as the Website page’s publish does');
  // The old switch moves with it, as the Website page's Turn it on does.
  const old = await runWithShop(north.shop.id, () => prepare('SELECT enabled FROM storefront_settings').get());
  assert.equal(old.enabled, true);
  // Customers see it now.
  assert.equal((await site(north)).status, 200);

  const off = await turn(north, 'off', { cookie: north.cookie });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.deepEqual(off.body, { on: false });
  assert.equal((await state(north)).is_on, false);
  assert.deepEqual((await site(north)).body, OFF);
  // Turned on again: nothing new is published (the website is already published).
  const before = (await state(north)).live_version_id;
  assert.equal((await turn(north, 'on', { cookie: north.cookie })).status, 200);
  assert.equal((await state(north)).live_version_id, before);
});

test('Turn it on works for a shop that has never opened the Website page (no website row yet)', async () => {
  // The old switch is off and there is no website row, so the shop's own
  // staff see the preview and its banner (server/storefront.js).
  const fresh = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });
  try {
    assert.equal(await runWithShop(fresh.shop.id, () => prepare('SELECT 1 AS yes FROM website').get()), undefined);
    const preview = await site(fresh, '', { cookie: fresh.cookie });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.preview, true);
    const on = await turn(fresh, 'on', { cookie: fresh.cookie });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    const row = await state(fresh);
    assert.equal(row.is_on, true);
    assert.ok(row.published && row.live_version_id != null, 'published the first time, with a version');
    assert.equal((await site(fresh)).status, 200);
  } finally {
    await deleteTestShop(fresh.shop.id);
  }
});

test('only this shop’s Owner can turn it on or off; anyone else is refused and nothing changes', async () => {
  await setOn(north, false);
  try {
    // A cashier of this shop is told who can.
    const cashier = await turn(north, 'on', { cookie: jo.cookie });
    assert.equal(cashier.status, 403);
    assert.equal(cashier.body.error, 'Only the shop’s owner can turn the website on');
    assert.deepEqual(cashier.body.owners, ['Test Owner']);
    assert.equal((await turn(north, 'off', { cookie: jo.cookie })).status, 403);
    // A customer, another shop's Owner and a made-up cookie get what customers get.
    for (const cookie of [undefined, south.cookie, 'wh_session=made-up']) {
      const res = await turn(north, 'on', { cookie });
      assert.equal(res.status, 404, String(cookie));
      assert.deepEqual(res.body, OFF, String(cookie));
    }
    // The staff banner works at the store path only (Jack's answer 4).
    const byHost = await ask('/api/site/turn-on', { method: 'POST', host: `${north.shop.slug}.wheelhouseepos.com`, cookie: north.cookie, fetchSite: 'same-origin' });
    assert.equal(byHost.status, 404);
    // Another site's page can't make the Owner's browser do it.
    const crossSite = await turn(north, 'on', { cookie: north.cookie, fetchSite: 'cross-site' });
    assert.equal(crossSite.status, 403);
    assert.equal((await state(north)).is_on, false);
    // Another shop's Owner can't turn this shop's website off either.
    await setOn(north, true);
    assert.equal((await turn(north, 'off', { cookie: south.cookie })).status, 404);
    assert.equal((await state(north)).is_on, true);
  } finally {
    await setOn(north, true);
  }
});

test('a customer, and staff of another shop, get only wb-off: the 404 page and answer, nothing of the banner', async () => {
  await setOn(north, false);
  try {
    for (const cookie of [undefined, south.cookie]) {
      const page = await ask(`/store/${north.shop.slug}/`, { cookie });
      assert.equal(page.status, 404, String(cookie));
      assert.ok(!String(page.body).includes('North Street Cycles'), 'the page names no shop');
      const answer = await site(north, '', { cookie });
      assert.equal(answer.status, 404);
      assert.deepEqual(answer.body, OFF);
    }
    // This shop's Owner gets the page and the preview answer.
    assert.equal((await ask(`/store/${north.shop.slug}/`, { cookie: north.cookie })).status, 200);
    assert.equal((await site(north, '', { cookie: north.cookie })).body.preview, true);
  } finally {
    await setOn(north, true);
  }
});

test('the switch answers no-store, and a GET to it is not a page of answers', async () => {
  await setOn(north, false);
  try {
    const res = await turn(north, 'on', { cookie: north.cookie });
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal((await site(north, '/turn-on', { cookie: north.cookie })).status, 404);
  } finally {
    await setOn(north, true);
  }
});
