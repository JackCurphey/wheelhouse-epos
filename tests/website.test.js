// The website model on the server (openspec/changes/website-management,
// design 1 and 2, tasks 1.1 to 1.8): one row per shop with a draft and a
// published version, History, Publish, Discard, Turn it on and off, and the
// customer site reading only what is published.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '135_website.sql';

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}
async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

// ---------- 1.1 The migration ----------

test('135 runs from empty: website and website_versions, each shop sees only its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_web_empty_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const out = execFileSync('node', [MIGRATE], { env: { ...process.env, DATABASE_URL: url.href }, encoding: 'utf8', stdio: 'pipe' });
  assert.match(out, new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 'w1') RETURNING id")).id;
    const other = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 'w2') RETURNING id")).id;
    await asShop(c, shop);
    await c.query(`INSERT INTO website (draft) VALUES ('{"parts":{}}')`);
    await c.query(`INSERT INTO website_versions (kind, content, changed) VALUES ('published', '{"parts":{}}', '{}')`);
    await assert.rejects(c.query(`INSERT INTO website_versions (kind, content, changed) VALUES ('other', '{}', '{}')`), /check/i);
    await assert.rejects(c.query(`UPDATE website SET kind = 'wix'`), /check/i);
    await asShop(c, other);
    assert.equal((await c.query('SELECT 1 FROM website')).rowCount, 0);
    assert.equal((await c.query('SELECT 1 FROM website_versions')).rowCount, 0);
    // Writing a row for another shop is refused too.
    await asShop(c, shop);
    await assert.rejects(c.query(`INSERT INTO website (shop_id, draft) VALUES ($1, '{}')`, [other]), /row-level security/i);
    await assert.rejects(c.query(`INSERT INTO website_versions (shop_id, kind, content) VALUES ($1, 'published', '{}')`, [other]), /row-level security/i);
    // Safe to run twice.
    assert.doesNotThrow(() => execFileSync('node', [MIGRATE], { env: { ...process.env, DATABASE_URL: url.href }, stdio: 'pipe' }));
  });
});

// ---------- The routes ----------

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  // The old website settings a shop may already have: they seed the new draft.
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO storefront_settings (tagline, description, logo_url, hero_image_url) VALUES ('[Tagline]', '[Description]', '/uploads/logo.png', '/uploads/hero.jpg')").run();
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };
const page = async () => ok(await own('/api/website'));
const save = async (key, body) => ok(await own(`/api/website/parts/${key}`, { method: 'PUT', body }));
const PNG = { dataBase64: Buffer.from('[a test image]').toString('base64'), contentType: 'image/png' };
const customerInfo = () => fetch(`${server.baseUrl}/api/storefront/info?storefrontSlug=${owner.shop.slug}`);

test('the first GET makes the website, seeded from the old settings, with two pages to check', async () => {
  const state = await page();
  assert.equal(state.isOn, false);
  assert.equal(state.neverPublished, true);
  assert.deepEqual(state.changes, []);
  assert.deepEqual(state.parts.map((p) => p.key), ['headline', 'about_line', 'big_photo', 'workshop_words', 'shop_words', 'collection_returns', 'privacy']);
  const part = (key) => state.parts.find((p) => p.key === key);
  assert.equal(part('about_line').text, '[Tagline]');
  assert.equal(part('shop_words').text, '[Description]');
  assert.equal(part('big_photo').photo, '/uploads/hero.jpg');
  assert.equal(part('headline').text, owner.shop.name);
  assert.equal(state.logo, '/uploads/logo.png');
  assert.deepEqual(state.parts.filter((p) => !p.checked).map((p) => p.key), ['collection_returns', 'privacy']);
  // Starting wording is bracketed gaps: nothing invented reaches a customer.
  assert.match(part('collection_returns').text, /\[[^\]]+\]/);
  assert.match(part('privacy').text, /\[[^\]]+\]/);
  assert.equal(state.ready, false);
  assert.equal(state.address, `${owner.shop.slug}.wheelhouseepos.com`);
  // A second GET finds the same row.
  assert.equal((await page()).parts.find((p) => p.key === 'headline').text, owner.shop.name);
});

test('customers see nothing while the website has never been turned on', async () => {
  assert.equal((await customerInfo()).status, 404);
});

test('the first Turn it on publishes the draft; the customer site shows the published words', async () => {
  const state = ok(await own('/api/website/turn-on', { method: 'POST' }));
  assert.equal(state.isOn, true);
  assert.equal(state.neverPublished, false);
  assert.deepEqual(state.changes, []);
  const info = await (await customerInfo()).json();
  assert.equal(info.headline, owner.shop.name);
  assert.equal(info.tagline, '[Tagline]');
  assert.equal(info.logoUrl, '/uploads/logo.png');
  const history = ok(await own('/api/website/history')).versions;
  assert.equal(history.length, 1);
  assert.equal(history[0].kind, 'published');
  assert.equal(history[0].current, true);
  assert.equal(history[0].firstPublished, true);
  assert.equal(history[0].by, 'Test Owner');
});

test('saving a part changes the draft only, marks it checked and lists the change by page', async () => {
  const before = await page();
  assert.equal(before.parts.find((p) => p.key === 'privacy').checked, false);
  let state = await save('headline', { text: '[New headline]' });
  state = await save('privacy', { text: '[Privacy words]' });
  assert.equal(state.parts.find((p) => p.key === 'privacy').checked, true);
  assert.deepEqual(state.changes, [
    { page: 'Home page', parts: ['Headline'] },
    { page: 'Privacy', parts: ['Privacy'] },
  ]);
  assert.equal(state.changeCount, 2);
  assert.ok(state.savedBy, 'saved by someone');
  assert.ok(state.savedAt);
  // Customers still see the published headline.
  assert.equal((await (await customerInfo()).json()).headline, owner.shop.name);
});

test('an unknown part, or words that are too long, are refused', async () => {
  assert.equal((await own('/api/website/parts/footer', { method: 'PUT', body: { text: 'x' } })).status, 404);
  assert.equal((await own('/api/website/parts/headline', { method: 'PUT', body: { text: 'x'.repeat(20001) } })).status, 400);
  assert.equal((await own('/api/website/parts/headline', { method: 'PUT', body: { text: 5 } })).status, 400);
});

test('two parts saved at the same moment both stay', async () => {
  await Promise.all([
    save('workshop_words', { text: '[Workshop words]' }),
    save('collection_returns', { text: '[Collection words]' }),
  ]);
  const state = await page();
  assert.equal(state.parts.find((p) => p.key === 'workshop_words').text, '[Workshop words]');
  assert.equal(state.parts.find((p) => p.key === 'collection_returns').text, '[Collection words]');
  assert.deepEqual(state.partsToCheck, []);
  // Ready also needs the three-step start, which this shop hasn't done.
  assert.equal(state.ready, false);
});

let newPhoto;
test('a photo with no description and no decoration tick is counted; decoration is not', async () => {
  let state = ok(await own('/api/website/parts/big_photo/photo', { method: 'POST', body: PNG }));
  newPhoto = state.parts.find((p) => p.key === 'big_photo').photo;
  assert.equal(state.photosWithoutDescription, 1);
  state = await save('big_photo', { description: '', decoration: true });
  assert.equal(state.photosWithoutDescription, 0);
  state = await save('big_photo', { description: '[A photo of the shop]', decoration: false });
  assert.equal(state.photosWithoutDescription, 0);
});

test('publish makes the draft live and keeps History; nothing to publish is refused', async () => {
  const state = ok(await own('/api/website/publish', { method: 'POST' }));
  assert.deepEqual(state.changes, []);
  const info = await (await customerInfo()).json();
  assert.equal(info.headline, '[New headline]');
  assert.equal(info.heroImageUrl, newPhoto);
  // The old customer site's own fields follow what is published.
  const old = await runWithShop(owner.shop.id, () => prepare('SELECT enabled, hero_image_url FROM storefront_settings').get());
  assert.equal(old.enabled, true);
  assert.equal(old.hero_image_url, newPhoto);
  const history = ok(await own('/api/website/history')).versions;
  assert.equal(history.length, 2);
  assert.equal(history[0].current, true);
  assert.equal(history[1].current, false);
  // History names the pages that changed, as ws-history draws "Home page, …".
  assert.ok(history[0].changed.includes('Home page'));
  assert.equal((await own('/api/website/publish', { method: 'POST' })).status, 409);
});

test('discard keeps the draft in History and puts the published version back', async () => {
  await save('headline', { text: '[Discarded headline]' });
  const state = ok(await own('/api/website/discard', { method: 'POST' }));
  assert.deepEqual(state.changes, []);
  assert.equal(state.parts.find((p) => p.key === 'headline').text, '[New headline]');
  const history = ok(await own('/api/website/history')).versions;
  assert.equal(history[0].kind, 'discarded');
  assert.deepEqual(history[0].changed, ['Home page']);
  assert.equal((await own('/api/website/discard', { method: 'POST' })).status, 409);
});

test('going back keeps unpublished changes as a discarded draft first, and customers see no change', async () => {
  const discarded = ok(await own('/api/website/history')).versions.find((v) => v.kind === 'discarded');
  await save('about_line', { text: '[Pending line]' });
  const state = ok(await own(`/api/website/history/${discarded.id}/restore`, { method: 'POST' }));
  assert.equal(state.parts.find((p) => p.key === 'headline').text, '[Discarded headline]');
  assert.equal(state.parts.find((p) => p.key === 'about_line').text, '[Tagline]');
  const history = ok(await own('/api/website/history')).versions;
  assert.equal(history[0].kind, 'discarded');
  assert.deepEqual(history[0].changed, ['Home page']);
  assert.equal((await (await customerInfo()).json()).headline, '[New headline]');
  assert.equal((await own('/api/website/history/999999/restore', { method: 'POST' })).status, 404);
});

test('History keeps 90 days, and never removes what customers see now', async () => {
  await runWithShop(owner.shop.id, async () => {
    await prepare("UPDATE website_versions SET made_at = now() - interval '100 days'").run();
  });
  const history = ok(await own('/api/website/history')).versions;
  assert.equal(history.length, 1);
  assert.equal(history[0].current, true);
  assert.equal(ok(await own('/api/website/history')).keepDays, 90);
});

test('turn off hides the website and keeps what is published; turn on shows it again', async () => {
  ok(await own('/api/website/turn-off', { method: 'POST' }));
  assert.equal((await customerInfo()).status, 404);
  const old = await runWithShop(owner.shop.id, () => prepare('SELECT enabled FROM storefront_settings').get());
  assert.equal(old.enabled, false);
  // The old settings switch no longer decides once the new Website page is in use.
  // The old Settings route and uploads are refused, so they can neither turn
  // it back on nor change words that the next publish would overwrite.
  assert.equal((await own('/api/storefront-settings', { method: 'PUT', body: { enabled: true } })).status, 409);
  assert.equal((await own('/api/storefront-settings/logo', { method: 'POST', body: PNG })).status, 409);
  assert.equal((await own('/api/storefront-settings/hero', { method: 'POST', body: PNG })).status, 409);
  assert.equal((await customerInfo()).status, 404);
  const state = ok(await own('/api/website/turn-on', { method: 'POST' }));
  assert.equal(state.isOn, true);
  assert.equal((await (await customerInfo()).json()).headline, '[New headline]');
});

test('the customer site never sees the draft', async () => {
  await save('headline', { text: '[Draft only]' });
  const info = await (await customerInfo()).json();
  assert.equal(info.headline, '[New headline]');
  assert.ok(!JSON.stringify(info).includes('[Draft only]'));
});

test('only an Owner can read or change the website; staff are told who can', async () => {
  const asJo = (p, options) => staffRequest(server.baseUrl, jo.cookie, p, options);
  const read = await asJo('/api/website');
  assert.equal(read.status, 403);
  assert.equal(read.body.code, 'owner_only');
  // Only this shop's Owners: logins has no row-level security, so another
  // shop's Owner must never be named.
  const elsewhere = await staffSignup(server.baseUrl, { shopName: '[Elsewhere]' });
  try {
    const again = await asJo('/api/website');
    assert.deepEqual(again.body.owners, ['Test Owner']);
  } finally {
    await deleteTestShop(elsewhere.shop.id);
  }
  for (const [method, p] of [
    ['PUT', '/api/website/parts/headline'], ['POST', '/api/website/publish'], ['POST', '/api/website/discard'],
    ['POST', '/api/website/turn-on'], ['POST', '/api/website/turn-off'], ['GET', '/api/website/history'],
    ['POST', '/api/website/history/1/restore'], ['POST', '/api/website/logo'], ['POST', '/api/website/parts/big_photo/photo'],
  ]) {
    const res = await asJo(p, { method, body: method === 'GET' ? undefined : { text: 'x' } });
    assert.equal(res.status, 403, `${method} ${p}`);
  }
  assert.equal((await page()).parts.find((p) => p.key === 'headline').text, '[Draft only]');
});

test('a shop already live on the old website starts on and published, so customers see no change', async () => {
  const live = await staffSignup(server.baseUrl, { shopName: '[Live shop]' });
  try {
    await runWithShop(live.shop.id, () => prepare("INSERT INTO storefront_settings (enabled, tagline) VALUES (true, '[Live tagline]')").run());
    const state = ok(await staffRequest(server.baseUrl, live.cookie, '/api/website'));
    assert.equal(state.isOn, true);
    assert.equal(state.neverPublished, false);
    assert.deepEqual(state.changes, []);
    const info = await (await fetch(`${server.baseUrl}/api/storefront/info?storefrontSlug=${live.shop.slug}`)).json();
    assert.equal(info.tagline, '[Live tagline]');
  } finally {
    await deleteTestShop(live.shop.id);
  }
});

// ---------- Found in self-review ----------

async function freshShop(t, name) {
  const s = await staffSignup(server.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(server.baseUrl, s.cookie, p, options);
  const info = () => fetch(`${server.baseUrl}/api/storefront/info?storefrontSlug=${s.shop.slug}`);
  return { shop: s.shop, req, info };
}

test('a new photo clears its description and decoration tick; a part with no photo refuses one', async (t) => {
  const { req } = await freshShop(t, '[Photo shop]');
  ok(await req('/api/website/parts/big_photo', { method: 'PUT', body: { description: '[The old photo]', decoration: true } }));
  const state = ok(await req('/api/website/parts/big_photo/photo', { method: 'POST', body: PNG }));
  const part = state.parts.find((p) => p.key === 'big_photo');
  assert.match(part.photo, /^\/api\/uploaded-images\//);
  assert.equal(part.description, '');
  assert.equal(part.decoration, false);
  assert.equal(state.photosWithoutDescription, 1);
  assert.equal((await req('/api/website/parts/headline/photo', { method: 'POST', body: PNG })).status, 404);
});

test('a new logo goes in the draft and is listed under Every page', async (t) => {
  const { req, info } = await freshShop(t, '[Logo shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  const state = ok(await req('/api/website/logo', { method: 'POST', body: PNG }));
  assert.match(state.logo, /^\/api\/uploaded-images\//);
  assert.deepEqual(state.changes, [{ page: 'Every page', parts: ['Logo'] }]);
  assert.equal((await (await info()).json()).logoUrl, null);
});

test('publishing while the website is off keeps it off', async (t) => {
  const { shop, req, info } = await freshShop(t, '[Off shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  ok(await req('/api/website/turn-off', { method: 'POST' }));
  ok(await req('/api/website/parts/headline', { method: 'PUT', body: { text: '[Published while off]' } }));
  const state = ok(await req('/api/website/publish', { method: 'POST' }));
  assert.equal(state.isOn, false);
  assert.deepEqual(state.changes, []);
  assert.equal((await info()).status, 404);
  const old = await runWithShop(shop.id, () => prepare('SELECT enabled FROM storefront_settings').get());
  assert.equal(old.enabled, false);
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  assert.equal((await (await info()).json()).headline, '[Published while off]');
});

test('turning on a website published before shows what was published, not the unpublished changes', async (t) => {
  const { shop, req, info } = await freshShop(t, '[Again shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  ok(await req('/api/website/turn-off', { method: 'POST' }));
  ok(await req('/api/website/parts/headline', { method: 'PUT', body: { text: '[Not yet]' } }));
  const state = ok(await req('/api/website/turn-on', { method: 'POST' }));
  assert.equal(state.changeCount, 1);
  assert.equal((await (await info()).json()).headline, shop.name);
});

test('a part saved while another save holds the row keeps both', async (t) => {
  const { shop, req } = await freshShop(t, '[Clash shop]');
  ok(await req('/api/website'));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  t.after(() => client.end());
  await asShop(client, shop.id);
  await client.query('BEGIN');
  await client.query(`UPDATE website SET draft = jsonb_set(draft, '{parts,headline,text}', '"[Held]"') WHERE shop_id = $1`, [shop.id]);
  // This save starts while the row is held, and has to wait for it.
  const saving = req('/api/website/parts/workshop_words', { method: 'PUT', body: { text: '[Waited]' } });
  await new Promise((r) => setTimeout(r, 400));
  await client.query('COMMIT');
  ok(await saving);
  const state = ok(await req('/api/website'));
  assert.equal(state.parts.find((p) => p.key === 'headline').text, '[Held]');
  assert.equal(state.parts.find((p) => p.key === 'workshop_words').text, '[Waited]');
});

// ---------- Found in /review ----------

test('a photo is only set by uploading it: saving a part with a web address as its photo is refused', async (t) => {
  const { req } = await freshShop(t, '[Address shop]');
  const refused = await req('/api/website/parts/big_photo', { method: 'PUT', body: { photo: 'https://example.test/pixel.gif' } });
  assert.equal(refused.status, 400);
  const state = ok(await req('/api/website'));
  assert.ok(state.parts.find((p) => p.key === 'big_photo').photo === null);
  // Taking a photo away is still allowed.
  ok(await req('/api/website/parts/big_photo/photo', { method: 'POST', body: PNG }));
  const cleared = ok(await req('/api/website/parts/big_photo', { method: 'PUT', body: { photo: null } }));
  assert.ok(cleared.parts.find((p) => p.key === 'big_photo').photo === null);
});

test('"no price" counts only products that would go online', async (t) => {
  const { shop, req } = await freshShop(t, '[Count shop]');
  await runWithShop(shop.id, async () => {
    const add = prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, show_online, updated_at) VALUES (?, '[Product]', 'Parts', ?, 0, 0, ?, now())");
    await add.run('[online no price]', 0, 1);
    await add.run('[shop only no price]', 0, 0);
    await add.run('[online priced]', 5, 1);
  });
  const { productCounts } = ok(await req('/api/website'));
  // An unpriced product stays off until priced, so it isn't among those going online.
  assert.equal(productCounts.goOnline, 1);
  assert.equal(productCounts.noPrice, 1);
});

test('the old Settings route can still change the theme once the Website page is in use, and nothing else', async (t) => {
  const { req } = await freshShop(t, '[Theme shop]');
  ok(await req('/api/website'));
  const theme = ok(await req('/api/storefront-settings', { method: 'PUT', body: { themePreset: 'plum' } }));
  assert.equal(theme.themePreset, 'plum');
  assert.equal((await req('/api/storefront-settings', { method: 'PUT', body: { themePreset: 'plum', tagline: '[Old]' } })).status, 409);
});

test('discarding keeps the "checked" marks of pages saved unchanged', async (t) => {
  const { req } = await freshShop(t, '[Checked shop]');
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  const before = ok(await req('/api/website'));
  const privacy = before.parts.find((p) => p.key === 'privacy');
  ok(await req('/api/website/parts/privacy', { method: 'PUT', body: { text: privacy.text } }));
  ok(await req('/api/website/parts/headline', { method: 'PUT', body: { text: '[Thrown away]' } }));
  const after = ok(await req('/api/website/discard', { method: 'POST' }));
  assert.equal(after.parts.find((p) => p.key === 'privacy').checked, true);
  assert.deepEqual(after.partsToCheck, ['Collection and returns']);
  assert.equal(after.parts.find((p) => p.key === 'headline').text, before.parts.find((p) => p.key === 'headline').text);
});

// ---------- Found in the drawing check ----------

test('the page says who published last and how long History keeps changes; View opens one version', async (t) => {
  const { shop, req } = await freshShop(t, '[View shop]');
  const first = ok(await req('/api/website'));
  assert.ok(first.publishedBy === null);
  assert.equal(first.keepDays, 90);
  ok(await req('/api/website/turn-on', { method: 'POST' }));
  ok(await req('/api/website/parts/headline', { method: 'PUT', body: { text: '[Second]' } }));
  const state = ok(await req('/api/website/publish', { method: 'POST' }));
  assert.equal(state.publishedBy, 'Test Owner');
  const versions = ok(await req('/api/website/history')).versions;
  const older = versions.find((v) => v.firstPublished);
  const view = ok(await req(`/api/website/history/${older.id}`));
  assert.equal(view.content.parts.headline.text, shop.name);
  assert.equal(view.firstPublished, true);
  assert.equal((await req('/api/website/history/999999999')).status, 404);
});
