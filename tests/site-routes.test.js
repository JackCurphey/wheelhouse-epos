// The customer website's read routes (openspec/changes/website-browse,
// design 2, tasks 1.1–1.9): GET /api/site and /api/site/categories, found
// from the shop's address, answering only what is published and public.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, setOpeningDays } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { runWithShop, prepare, pool } from '../server/db.js';

let server;
let north;
let south;
let jo;
let visitor = 0;
// Each test is its own visitor address, so the rate limit test is the only one that meets it.
const nextVisitor = () => `203.0.113.${++visitor}`;

before(async () => {
  // TRUST_PROXY lets each test name its own visitor address (X-Forwarded-For).
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  north = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  south = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });
  const made = await staffRequest(server.baseUrl, north.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  await runWithShop(north.shop.id, async () => {
    await prepare("UPDATE shops SET address = '[Bolton address]', phone = '[Bolton phone]', email = '[Bolton email]' WHERE id = ?").run(north.shop.id);
    await prepare("UPDATE sites SET name = 'Bolton', code = 'B'").run();
    await prepare("INSERT INTO sites (name, code) VALUES ('Bury', 'BY')").run();
    const top = (await prepare("INSERT INTO product_categories (name, path) VALUES ('Drivetrain', 'Drivetrain') RETURNING id").get()).id;
    await prepare("INSERT INTO product_categories (parent_id, name, path) VALUES (?, 'Derailleurs', 'Drivetrain › Derailleurs')").run(top);
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Bearings', 'Bearings')").run();
    const add = (name, category, price, online, active) => prepare(
      'INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, now())'
    ).run(`[sku ${name}]`, name, category, price, online, active);
    await add('[Rear mech]', 'Drivetrain › Derailleurs', 28, true, 1);
    await add('[Chain]', 'Drivetrain', 12, true, 1);
    await add('[Offline chain]', 'Drivetrain', 12, false, 1);
    await add('[Archived chain]', 'Drivetrain', 12, true, 0);
    await add('[Unpriced chain]', 'Drivetrain', 0, true, 1);
  });
  await runWithShop(south.shop.id, async () => {
    await prepare("INSERT INTO product_categories (name, path) VALUES ('[South only]', '[South only]')").run();
    await prepare("INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES ('[s]', '[South product]', '[South only]', 5, 1, true, 1, now())").run();
  });
  for (const shop of [north, south]) {
    const own = (p, o) => staffRequest(server.baseUrl, shop.cookie, p, o);
    assert.equal((await own('/api/website')).status, 200);
    assert.equal((await own('/api/website/turn-on', { method: 'POST' })).status, 200);
  }
});

after(async () => {
  for (const shop of [north, south]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A request as a browser makes it: by path (/store/<slug>/…) or by host
// (<slug>.wheelhouseepos.com), from one visitor address, with an optional cookie.
function ask(path, { host, cookie, from = nextVisitor() } = {}) {
  const base = new URL(server.baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: base.hostname, port: base.port, path, method: 'GET',
      headers: { ...(host ? { host } : {}), ...(cookie ? { cookie } : {}), 'x-forwarded-for': from },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(text); } catch { body = text; }
        resolve({ status: res.status ?? res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}
const site = (shop, rest = '', opts) => ask(`/store/${shop.shop.slug}/api/site${rest}`, opts);
const ok = (res) => { assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body; };
const setOn = (shop, on) => runWithShop(shop.shop.id, () => prepare('UPDATE website SET is_on = ?').run(on));
const OFF = { error: 'This website isn’t available' };

test('GET /api/site finds the shop by its store path and by its own address, with its published words and its shops', async () => {
  const byPath = ok(await site(north));
  const byHost = ok(await ask('/api/site', { host: `${north.shop.slug}.wheelhouseepos.com` }));
  assert.deepEqual(byHost, byPath);
  assert.equal(byPath.name, north.shop.name);
  assert.equal(byPath.parts.headline, north.shop.name);
  for (const key of ['headline', 'aboutLine', 'shopWords', 'bigPhoto', 'shopPhoto', 'workshopWords', 'collectionReturns', 'privacy']) {
    assert.ok(key in byPath.parts, `parts.${key}`);
  }
  assert.ok('logo' in byPath && 'mainColour' in byPath);
  assert.deepEqual(byPath.shops.map((s) => s.name), ['Bolton', 'Bury']);
  // The shared address, phone and hours sit on the first shop's card only (Jack's answer 1).
  const [bolton, bury] = byPath.shops;
  assert.equal(bolton.address, '[Bolton address]');
  assert.equal(bolton.phone, '[Bolton phone]');
  assert.equal(bolton.email, '[Bolton email]');
  assert.ok(Array.isArray(bolton.hours) && bolton.hours.length > 0);
  assert.deepEqual(Object.keys(bury).sort(), ['id', 'name']);
  // Neither shop sees the other.
  const southSite = ok(await site(south));
  assert.equal(southSite.name, south.shop.name);
  assert.ok(!southSite.shops.some((s) => s.name === 'Bolton' || s.name === 'Bury'));
  assert.ok(!JSON.stringify(byPath).includes('South'));
});

test('a switched-off website, an unknown shop and a Shopify website all answer the same 404', async () => {
  await setOn(north, false);
  try {
    const off = await site(north);
    const unknown = await ask(`/store/no-such-shop-${randomUUID().slice(0, 8)}/api/site`);
    assert.equal(off.status, 404);
    assert.equal(unknown.status, 404);
    assert.deepEqual(off.body, OFF);
    assert.deepEqual(unknown.body, OFF);
    assert.deepEqual((await site(north, '/categories')).body, OFF);
  } finally {
    await setOn(north, true);
  }
  await runWithShop(north.shop.id, () => prepare("UPDATE website SET kind = 'shopify'").run());
  try {
    const shopify = await site(north);
    assert.equal(shopify.status, 404);
    assert.deepEqual(shopify.body, OFF);
  } finally {
    await runWithShop(north.shop.id, () => prepare("UPDATE website SET kind = 'wheelhouse'").run());
  }
});

test('the draft never reaches the answer, and tracking tools come with kind and name only', async () => {
  const marker = `[Draft only ${randomUUID().slice(0, 8)}]`;
  const tracked = [{ tool: 'google_analytics', on: true, id: 'G-SECRETID1' }];
  await runWithShop(north.shop.id, () => prepare(
    `UPDATE website SET draft = jsonb_set(draft, '{parts,headline,text}', to_jsonb(?::text)),
            published = jsonb_set(published, '{tracking}', ?::jsonb)`
  ).run(marker, JSON.stringify(tracked)));
  const body = ok(await site(north));
  const text = JSON.stringify(body);
  assert.ok(!text.includes(marker), 'the draft headline is not in the answer');
  assert.ok(!text.includes('G-SECRETID1'), 'no tracking ID before consent');
  assert.deepEqual(body.tracking, [{ kind: 'Statistics', name: 'Google Analytics' }]);
});

test('preview and canTurnOn are set only for signed-in staff of this shop, with the website off', async () => {
  const anon = ok(await site(north));
  assert.equal(anon.preview, false);
  assert.equal(anon.canTurnOn, false);
  // On: even the Owner gets no preview.
  assert.equal(ok(await site(north, '', { cookie: north.cookie })).preview, false);
  await setOn(north, false);
  try {
    const owner = ok(await site(north, '', { cookie: north.cookie }));
    assert.equal(owner.preview, true);
    assert.equal(owner.canTurnOn, true);
    const cashier = ok(await site(north, '', { cookie: jo.cookie }));
    assert.equal(cashier.preview, true);
    assert.equal(cashier.canTurnOn, false);
    assert.deepEqual(cashier.ownerNames, ['Test Owner']);
    // Staff of another shop, and a made-up cookie, are customers here.
    assert.deepEqual((await site(north, '', { cookie: south.cookie })).body, OFF);
    assert.deepEqual((await site(north, '', { cookie: 'wh_session=made-up' })).body, OFF);
    // The staff banner works at the store path only (Jack's answer 4); a
    // session cookie sent to the shop's own address is ignored.
    assert.deepEqual((await ask('/api/site', { host: `${north.shop.slug}.wheelhouseepos.com`, cookie: north.cookie })).body, OFF);
  } finally {
    await setOn(north, true);
  }
});

const savedPublished = async (shop) => (await runWithShop(shop.shop.id, () => prepare('SELECT published FROM website').get())).published;
const restorePublished = (shop, published) => runWithShop(shop.shop.id, () => prepare('UPDATE website SET is_on = true, published = ?::jsonb').run(JSON.stringify(published)));

test('preview shows what is published, or the draft when nothing has been published yet', async () => {
  const marker = `[Draft headline ${randomUUID().slice(0, 8)}]`;
  const published = await savedPublished(north);
  await runWithShop(north.shop.id, () => prepare("UPDATE website SET is_on = false, draft = jsonb_set(draft, '{parts,headline,text}', to_jsonb(?::text))").run(marker));
  try {
    // Published, then switched off: staff see what customers would, not the unpublished edits.
    const wasPublished = ok(await site(north, '', { cookie: north.cookie }));
    assert.equal(wasPublished.preview, true);
    assert.equal(wasPublished.parts.headline, north.shop.name);
    assert.ok(!JSON.stringify(wasPublished).includes(marker));
    // Never published: staff see what Turn it on would publish, the draft
    // (decided while building, Jack's November file). Customers see nothing.
    await runWithShop(north.shop.id, () => prepare('UPDATE website SET published = NULL').run());
    assert.equal(ok(await site(north, '', { cookie: north.cookie })).parts.headline, marker);
    assert.deepEqual((await site(north)).body, OFF);
  } finally {
    await restorePublished(north, published);
  }
});

test('a shop that has not opened the Website page yet previews by the old switch', async () => {
  const fresh = await staffSignup(server.baseUrl, { shopName: 'East Lane Cycles' });
  try {
    assert.ok(!(await runWithShop(fresh.shop.id, () => prepare('SELECT 1 FROM website').get())), 'no website row yet');
    // The old switch (storefront_settings) is off, so its own staff get the banner.
    const owner = ok(await site(fresh, '', { cookie: fresh.cookie }));
    assert.equal(owner.preview, true);
    assert.equal(owner.canTurnOn, true);
    assert.deepEqual((await site(fresh)).body, OFF);
  } finally {
    await deleteTestShop(fresh.shop.id);
  }
});

test('twelve staff previews at once each get an answer, more than the server has connections', async () => {
  // Each request holds one database connection; the staff session found
  // before it must be reused inside it, not looked up on a second one.
  await setOn(north, false);
  try {
    const answers = await Promise.all(Array.from({ length: 12 }, () => site(north, '', { cookie: jo.cookie })));
    for (const res of answers) assert.equal(ok(res).preview, true);
  } finally {
    await setOn(north, true);
  }
});

test('each published part reaches its own place in the answer, and a decoration photo has no description', async () => {
  const published = await savedPublished(north);
  const parts = {
    headline: { text: '[Headline]' },
    about_line: { text: '[About line]' },
    big_photo: { photo: '/uploads/[big].jpg', description: '[Big photo description]', decoration: false },
    shop_words: { text: '[Shop words]', photo: '/uploads/[shop].jpg', description: '[Shop photo description]', decoration: true },
    workshop_words: { text: '[Workshop words]' },
    collection_returns: { text: '[Collection and returns]' },
    privacy: { text: '[Privacy]' },
  };
  await runWithShop(north.shop.id, () => prepare("UPDATE website SET published = jsonb_set(published, '{parts}', ?::jsonb)").run(JSON.stringify(parts)));
  try {
    assert.deepEqual(ok(await site(north)).parts, {
      headline: '[Headline]',
      aboutLine: '[About line]',
      shopWords: '[Shop words]',
      bigPhoto: { url: '/uploads/[big].jpg', description: '[Big photo description]' },
      shopPhoto: { url: '/uploads/[shop].jpg', description: '' },
      workshopWords: '[Workshop words]',
      collectionReturns: '[Collection and returns]',
      privacy: '[Privacy]',
    });
  } finally {
    await restorePublished(north, published);
  }
});

test('GET /api/site/categories answers the tree, counting online, active, priced products only', async () => {
  const tree = ok(await site(north, '/categories'));
  const byPath = Object.fromEntries(tree.map((c) => [c.path, c]));
  assert.deepEqual(Object.keys(byPath).sort(), ['Bearings', 'Drivetrain', 'Drivetrain › Derailleurs']);
  assert.equal(byPath['Drivetrain › Derailleurs'].products, 1);
  assert.equal(byPath['Drivetrain › Derailleurs'].parentId, byPath.Drivetrain.id);
  // Drivetrain's own chain plus the derailleur beneath it; offline, archived and £0 left out.
  assert.equal(byPath.Drivetrain.products, 2);
  assert.equal(byPath.Bearings.products, 0);
  assert.deepEqual(Object.keys(byPath.Bearings).sort(), ['id', 'name', 'parentId', 'path', 'products']);
});

test('the rate limit turns away one visitor past the limit, and not another', async () => {
  const from = '198.51.100.7';
  let last;
  for (let i = 0; i < 301; i++) last = await site(north, '', { from });
  assert.equal(last.status, 429);
  assert.match(last.body.error, /too many/i);
  assert.equal((await site(north, '', { from: '198.51.100.8' })).status, 200);
});

test('a failed read answers 503 and the server keeps running', async () => {
  // A time zone the clock can't use makes the read throw inside the route.
  await runWithShop(north.shop.id, () => prepare("UPDATE workshop_settings SET time_zone = 'Not/AZone'").run());
  try {
    const failed = await site(north);
    assert.equal(failed.status, 503);
    assert.deepEqual(failed.body, { error: 'Something went wrong — try again' });
  } finally {
    await runWithShop(north.shop.id, () => prepare("UPDATE workshop_settings SET time_zone = 'Europe/London'").run());
  }
  assert.equal(ok(await site(north)).name, north.shop.name);
});

test("today's hours and the next opening are worked out in the shop's time zone", async () => {
  // The test clock is 06:00 UTC on Tuesday 1 Sep 2026: 07:00 in Bolton.
  await runWithShop(north.shop.id, () => prepare("UPDATE workshop_settings SET opening_time = '09:00', closing_time = '17:30', weekday_hours = '{}', time_zone = 'Europe/London'").run());
  await setOpeningDays(north.shop.id, [1, 2, 3, 4, 5, 6]);
  let bolton = ok(await site(north)).shops[0];
  assert.deepEqual(bolton.today, { open: '09:00', close: '17:30' });
  assert.equal(bolton.nextOpening, null);
  // Today's date, so the shop's page can put today in bold (wb-shop-page).
  assert.equal(bolton.todayDate, '2026-09-01');

  // Closed on Tuesdays: opens Wednesday.
  await setOpeningDays(north.shop.id, [1, 3, 4, 5, 6]);
  bolton = ok(await site(north)).shops[0];
  assert.equal(bolton.today, null);
  assert.deepEqual(bolton.nextOpening, { date: '2026-09-02', open: '09:00' });

  // A closure from Tuesday to Thursday: opens Friday, and the closure is listed.
  await setOpeningDays(north.shop.id, [1, 2, 3, 4, 5, 6]);
  await runWithShop(north.shop.id, () => prepare("INSERT INTO workshop_unavailability (kind, start_date, end_date, reason) VALUES ('dates', '2026-09-01', '2026-09-03', '[staff-only reason]')").run());
  try {
    const body = ok(await site(north));
    bolton = body.shops[0];
    assert.equal(bolton.today, null);
    assert.deepEqual(bolton.nextOpening, { date: '2026-09-04', open: '09:00' });
    assert.deepEqual(bolton.closures, [{ from: '2026-09-01', to: '2026-09-03' }]);
    assert.ok(!JSON.stringify(body).includes('staff-only reason'), 'the reason is for staff only');
  } finally {
    await runWithShop(north.shop.id, () => prepare('DELETE FROM workshop_unavailability').run());
  }

  // A mechanic's day off leaves the shop open: it isn't a closure.
  await runWithShop(north.shop.id, () => prepare("INSERT INTO workshop_unavailability (kind, employee_id, start_date, end_date) VALUES ('dates', (SELECT id FROM employees LIMIT 1), '2026-09-01', '2026-09-01')").run());
  try {
    bolton = ok(await site(north)).shops[0];
    assert.deepEqual(bolton.today, { open: '09:00', close: '17:30' });
    assert.deepEqual(bolton.closures, []);
  } finally {
    await runWithShop(north.shop.id, () => prepare('DELETE FROM workshop_unavailability').run());
  }

  // 06:00 UTC on Tuesday is still 20:00 on Monday in Honolulu (UTC-10).
  await runWithShop(north.shop.id, () => prepare("UPDATE workshop_settings SET time_zone = 'Pacific/Honolulu'").run());
  try {
    await setOpeningDays(north.shop.id, [1]);
    assert.deepEqual(ok(await site(north)).shops[0].today, { open: '09:00', close: '17:30' });
    assert.equal(ok(await site(north)).shops[0].todayDate, '2026-08-31');
    await setOpeningDays(north.shop.id, [2]);
    bolton = ok(await site(north)).shops[0];
    assert.equal(bolton.today, null);
    assert.deepEqual(bolton.nextOpening, { date: '2026-09-01', open: '09:00' });
  } finally {
    await runWithShop(north.shop.id, () => prepare("UPDATE workshop_settings SET time_zone = 'Europe/London'").run());
    await setOpeningDays(north.shop.id, [0, 1, 2, 3, 4, 5, 6]);
  }
});
