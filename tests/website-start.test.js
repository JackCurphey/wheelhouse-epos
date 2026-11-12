// Setting up the website and its main colour on the server
// (openspec/changes/website-management, design 4, tasks 3.1 and 3.2):
// POST /api/website/set-up once only, "Every product online" switching
// "Show on website" on for priced products, and the reading check on every
// colour.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, runWithShop, prepare } from '../server/db.js';
import { colourProblem } from '../server/website.js';
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

async function freshShop(t, name) {
  const s = await staffSignup(server.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(server.baseUrl, s.cookie, p, options);
  return { shop: s.shop, req };
}

// Three priced products (one with no photo, one already on the website) and
// one with no price that someone had switched on.
async function addProducts(shopId) {
  await runWithShop(shopId, async () => {
    const add = prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, show_online, photo_url, updated_at) VALUES (?, '[Product]', 'Parts', ?, 0, 0, ?, ?, now())");
    await add.run('[priced]', 5, false, '/uploads/a.jpg');
    await add.run('[priced no photo]', 5, false, null);
    await add.run('[priced on]', 5, true, '/uploads/b.jpg');
    await add.run('[no price]', 0, true, null);
  });
}
const switches = (shopId) => runWithShop(shopId, async () =>
  Object.fromEntries((await prepare('SELECT sku, show_online FROM products ORDER BY sku').all()).map((r) => [r.sku, r.show_online])));

const SET_UP = { kind: 'wheelhouse', startWith: 'every', mainColour: '#1A3F66' };

// ---------- 3.1 Set-up ----------

test('before set-up the page says so, with the counts "Every product online" would give', async (t) => {
  const { shop, req } = await freshShop(t, '[Start shop]');
  await addProducts(shop.id);
  const state = ok(await req('/api/website'));
  assert.equal(state.setUp, false);
  assert.deepEqual(state.startCounts, { goOnline: 3, noPhoto: 1, noPrice: 1 });
});

test('"Every product online" switches Show on website on for priced products only, and the website starts off', async (t) => {
  const { shop, req } = await freshShop(t, '[Every shop]');
  await addProducts(shop.id);
  const state = ok(await req('/api/website/set-up', { method: 'POST', body: SET_UP }));
  assert.equal(state.setUp, true);
  assert.equal(state.kind, 'wheelhouse');
  assert.equal(state.isOn, false);
  assert.equal(state.mainColour, '#1A3F66');
  assert.deepEqual(await switches(shop.id), { '[no price]': false, '[priced]': true, '[priced no photo]': true, '[priced on]': true });
  assert.deepEqual(state.productCounts, { goOnline: 3, noPhoto: 1, noPrice: 0 });
});

test('"Nothing online" leaves every product off', async (t) => {
  const { shop, req } = await freshShop(t, '[Nothing shop]');
  await addProducts(shop.id);
  ok(await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, startWith: 'nothing' } }));
  assert.deepEqual(await switches(shop.id), { '[no price]': false, '[priced]': false, '[priced no photo]': false, '[priced on]': false });
});

test('a second set-up is refused, and changes nothing', async (t) => {
  const { shop, req } = await freshShop(t, '[Twice shop]');
  ok(await req('/api/website/set-up', { method: 'POST', body: SET_UP }));
  await addProducts(shop.id);
  const again = await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, startWith: 'every', mainColour: '#2F6B4F' } });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'The website is already set up');
  assert.equal(ok(await req('/api/website')).mainColour, '#1A3F66');
  assert.equal((await switches(shop.id))['[priced]'], false);
});

test('a set-up without a start choice is refused', async (t) => {
  const { req } = await freshShop(t, '[Half shop]');
  assert.equal((await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, startWith: 'some' } })).status, 400);
  assert.equal((await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, kind: 'wix' } })).status, 400);
  assert.equal(ok(await req('/api/website')).setUp, false);
});

// ---------- 3.2 The reading check ----------

test('the reading check passes the drawn colours and refuses ones white text is hard to read on', () => {
  for (const colour of ['#1A3F66', '#2F6B4F', '#2A2822', '#1a3f66']) assert.equal(colourProblem(colour), null, colour);
  for (const colour of ['#F5D90A', '#FFFFFF', '#7FB3E0']) assert.match(colourProblem(colour), /hard to read/, colour);
  for (const colour of ['blue', '#12345', '', null]) assert.match(colourProblem(colour), /colour/, String(colour));
});

test('the main colour route saves a readable colour to the draft and refuses a pale one', async (t) => {
  const { req } = await freshShop(t, '[Colour shop]');
  ok(await req('/api/website/set-up', { method: 'POST', body: SET_UP }));
  const state = ok(await req('/api/website/colour', { method: 'PUT', body: { colour: '#2F6B4F' } }));
  assert.equal(state.mainColour, '#2F6B4F');
  const pale = await req('/api/website/colour', { method: 'PUT', body: { colour: '#F5D90A' } });
  assert.equal(pale.status, 400);
  assert.match(pale.body.error, /hard to read/);
  assert.equal(ok(await req('/api/website')).mainColour, '#2F6B4F');
});

test('set-up with a pale colour is refused, and the website is not set up', async (t) => {
  const { req } = await freshShop(t, '[Pale shop]');
  const res = await req('/api/website/set-up', { method: 'POST', body: { ...SET_UP, mainColour: '#F5D90A' } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /hard to read/);
  assert.equal(ok(await req('/api/website')).setUp, false);
});
