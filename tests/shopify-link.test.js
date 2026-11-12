// Connecting the shop's own Shopify shop and sending products to it
// (openspec/changes/website-management design 7, tasks 6.1-6.2; drawings
// ws-shopify-connect, ws-shopify-check, ws-shopify-sending, ws-shopify-on,
// ws-shopify-problem and ws-shopify-failed in generator/website.mjs). Through
// the adapter's pretend Shopify: nothing is sent until Send, products that are
// only in Shopify are left alone (defaults taken 12 Nov, item 2), and sending
// carries on in the background.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';
import { sendRound } from '../server/shopify/sending.js';
import { pretendShopify as pretend } from '../server/shopify/pretend.js';

// sendRound runs here, in the test process, with the pretend Shopify the servers use.
process.env.SHOPIFY_PROVIDER = 'pretend';

let server;
let none;
before(async () => {
  server = await startLiveServer();
  none = await startLiveServer({ env: { SHOPIFY_PROVIDER: 'none' } });
});
after(async () => {
  if (server) await server.stop();
  if (none) await none.stop();
  await pool.end();
});
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };
const ADDRESS = 'north-street.myshopify.com';

async function freshShop(t, name, on = server) {
  const s = await staffSignup(on.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(on.baseUrl, s.cookie, p, options);
  const visit = async (address) => {
    const res = await fetch(new URL(address, on.baseUrl), { headers: { cookie: s.cookie }, redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  };
  const linkTo = (html, words) => {
    const found = html.match(new RegExp(`<a href="([^"]+)"[^>]*>${words}</a>`));
    assert.ok(found, `a link “${words}” on ${html}`);
    return found[1].replaceAll('&amp;', '&');
  };
  const inShop = (fn) => runWithShop(s.shop.id, fn);
  return { ...s, req, visit, linkTo, inShop };
}

// Connect → Shopify's page → Approve (or Cancel) → back to the Website page.
async function connectThrough(shop, address = ADDRESS, outcome = 'Approve') {
  const { address: page } = ok(await shop.req('/api/shopify/connect', { method: 'POST', body: { address } }));
  const opened = await shop.visit(page);
  assert.equal(opened.status, 200);
  return shop.visit(shop.linkTo(opened.html, outcome));
}
const addProduct = (shop, { sku, price = 10, photo = null, stock = 0, online = true, category = 'Parts', active = 1 }) => shop.inShop(() => prepare(
  `INSERT INTO products (sku, name, category, price, cost, stock_qty, show_online, photo_url, active, updated_at)
   VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, now()) RETURNING id`
).get(sku, `[${sku}]`, category, price, stock, online, photo, active)).then((r) => r.id);
const pretendShopify = (shop) => shop.inShop(() => prepare('SELECT * FROM pretend_shopify WHERE address = ?').get(ADDRESS));
const setPretend = (shop, fields) => shop.inShop(() => prepare(
  'UPDATE pretend_shopify SET products = ?::jsonb, needs_photo = ?::text[], refuses = ?::jsonb WHERE address = ?'
).run(JSON.stringify(fields.products ?? []), fields.needsPhoto ?? [], JSON.stringify(fields.refuses ?? {}), ADDRESS));
const website = async (shop) => ok(await shop.req('/api/website'));
// The background job's rounds, run here until it has nothing left.
async function sendAll(shop) {
  for (let i = 0; i < 20; i += 1) if (!(await sendRound(shop.shop.id))) return;
  assert.fail('sending didn’t finish');
}

test('Connect goes to Shopify’s page and Approve brings the Owner back connected, with nothing sent', async (t) => {
  const shop = await freshShop(t, 'Shopify connect');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  const back = await connectThrough(shop, ' https://North-Street.myshopify.com/ ');
  assert.equal(back.status, 302);
  assert.equal(back.location, '/workshop/website?shopify=connected');
  const state = await website(shop);
  assert.equal(state.kind, 'shopify');
  assert.equal(state.isOn, false, 'Wheelhouse’s own website is off while Shopify is the shop’s website');
  assert.deepEqual(
    { address: state.shopify.address, state: state.shopify.state, total: state.shopify.total, sentCount: state.shopify.sentCount, problems: state.shopify.problems },
    { address: ADDRESS, state: 'idle', total: 0, sentCount: 0, problems: [] }
  );
  assert.deepEqual((await pretendShopify(shop)).products, [], 'nothing is sent until the Owner says so');
});

test('Cancel on Shopify’s page, or an address Shopify doesn’t find, comes back failed and changes nothing', async (t) => {
  const shop = await freshShop(t, 'Shopify cancel');
  const cancelled = await connectThrough(shop, ADDRESS, 'Cancel');
  assert.equal(cancelled.location, `/workshop/website?shopify=failed&address=${encodeURIComponent(ADDRESS)}`);
  const unknown = await connectThrough(shop, 'not a shop', 'Back to Wheelhouse');
  assert.equal(unknown.location, `/workshop/website?shopify=failed&address=${encodeURIComponent('not a shop')}`);
  const state = await website(shop);
  assert.equal(state.kind, null);
  assert.equal(state.shopify, null);
  // A return link used twice, or by another shop, is turned away.
  const { address: page } = ok(await shop.req('/api/shopify/connect', { method: 'POST', body: { address: ADDRESS } }));
  const approve = shop.linkTo((await shop.visit(page)).html, 'Approve');
  const other = await freshShop(t, 'Shopify other shop');
  assert.equal((await other.visit(approve)).status, 400);
  assert.equal((await shop.visit(approve)).location, '/workshop/website?shopify=connected');
  assert.equal((await shop.visit(approve)).status, 400);
});

test('the check before sending counts each kind of change, and leaves products only in Shopify alone', async (t) => {
  const shop = await freshShop(t, 'Shopify preview');
  const same = await addProduct(shop, { sku: 'SAME', price: 10, photo: '/p/s.jpg', stock: 2 });
  const priced = await addProduct(shop, { sku: 'PRICE', price: 12.5, photo: '/p/p.jpg', stock: 1 });
  const photo = await addProduct(shop, { sku: 'PHOTO', price: 8, photo: '/p/new.jpg', stock: 1 });
  const stocked = await addProduct(shop, { sku: 'STOCK', price: 5, photo: '/p/st.jpg', stock: 7 });
  await addProduct(shop, { sku: 'NEW', price: 20, photo: '/p/n.jpg', stock: 3 });
  await addProduct(shop, { sku: 'UNPRICED', price: 0 });
  await addProduct(shop, { sku: 'OFFLINE', online: false });
  await addProduct(shop, { sku: 'GONE', active: 0 });
  await connectThrough(shop);
  const row = (id, sku, pricePence, photoUrl, stock) => ({ id: `gid-${sku}`, wheelhouseId: id, sku, title: `[${sku}]`, pricePence, photoUrl, stock });
  await setPretend(shop, { products: [
    row(same, 'SAME', 1000, '/p/s.jpg', 2), row(priced, 'PRICE', 1000, '/p/p.jpg', 1), row(photo, 'PHOTO', 800, null, 1),
    row(stocked, 'STOCK', 500, '/p/st.jpg', 3), { id: 'gid-ONLY', wheelhouseId: null, sku: 'ONLY', title: '[Only in Shopify]', pricePence: 100, photoUrl: null, stock: 1 },
  ] });
  const preview = ok(await shop.req('/api/shopify/preview'));
  assert.deepEqual(
    { address: preview.address, count: preview.count, newPrices: preview.newPrices, newPhotos: preview.newPhotos, newStock: preview.newStock, added: preview.added, onlyInShopify: preview.onlyInShopify, noPrice: preview.noPrice },
    { address: ADDRESS, count: 4, newPrices: 1, newPhotos: 1, newStock: 1, added: 1, onlyInShopify: 1, noPrice: 1 }
  );
  assert.deepEqual(preview.products.map((p) => p.sku).sort(), ['NEW', 'PHOTO', 'PRICE', 'STOCK']);
  // Defaults taken 12 Nov, item 2: listed under the drawn “See the list of products”.
  assert.deepEqual(preview.onlyInShopifyProducts, [{ sku: 'ONLY', name: '[Only in Shopify]' }]);
  assert.equal((await pretendShopify(shop)).products.length, 5, 'looking sends nothing');
});

test('Send carries on in the background: progress, then the products in Shopify, with only-in-Shopify left as it is', async (t) => {
  const shop = await freshShop(t, 'Shopify send');
  const a = await addProduct(shop, { sku: 'A', price: 10, photo: '/p/a.jpg', stock: 4 });
  await addProduct(shop, { sku: 'B', price: 3, photo: '/p/b.jpg', stock: 0 });
  // One of A's four is held for a Cycle to Work order, so Shopify is sent three (ws-shopify-connect).
  await shop.inShop(() => prepare(
    `INSERT INTO stock_frames (product_id, frame_number, frame_key, state) VALUES (?, 'WH1', 'WH1', 'held'), (?, 'WH2', 'WH2', 'in_stock')`
  ).run(a, a));
  await connectThrough(shop);
  await setPretend(shop, { products: [{ id: 'gid-ONLY', wheelhouseId: null, sku: 'ONLY', title: '[Only in Shopify]', pricePence: 100, photoUrl: null, stock: 1 }] });
  const sending = ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  assert.deepEqual({ state: sending.shopify.state, total: sending.shopify.total, sentCount: sending.shopify.sentCount }, { state: 'sending', total: 2, sentCount: 0 });
  await sendAll(shop);
  const done = (await website(shop)).shopify;
  assert.deepEqual({ state: done.state, total: done.total, sentCount: done.sentCount, problems: done.problems }, { state: 'idle', total: 2, sentCount: 2, problems: [] });
  assert.ok(done.lastSentAt);
  assert.equal(done.products, 2);
  const inShopify = (await pretendShopify(shop)).products;
  assert.deepEqual(inShopify.map((p) => p.sku).sort(), ['A', 'B', 'ONLY']);
  assert.deepEqual(inShopify.find((p) => p.sku === 'A'), { ...inShopify.find((p) => p.sku === 'A'), wheelhouseId: a, pricePence: 1000, photoUrl: '/p/a.jpg', stock: 3 });
  assert.deepEqual(inShopify.find((p) => p.sku === 'ONLY').pricePence, 100);
  assert.equal(ok(await shop.req('/api/shopify/preview')).count, 0, 'nothing left to change');
});

test('what couldn’t be sent: no price yet, no photo for a category Shopify needs one for, and Shopify’s own reason', async (t) => {
  const shop = await freshShop(t, 'Shopify problems');
  const unpriced = await addProduct(shop, { sku: 'NOPRICE', price: 0 });
  const bare = await addProduct(shop, { sku: 'BARE', price: 30, category: 'Bikes' });
  const refused = await addProduct(shop, { sku: 'REFUSED', price: 4, photo: '/p/r.jpg' });
  await addProduct(shop, { sku: 'FINE', price: 4, photo: '/p/f.jpg' });
  await connectThrough(shop);
  await setPretend(shop, { needsPhoto: ['Bikes'], refuses: { REFUSED: '[Shopify’s reason]' } });
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await sendAll(shop);
  const state = (await website(shop)).shopify;
  assert.equal(state.sentCount, 3, 'each product tried once');
  assert.deepEqual(state.problems.map((p) => [p.productId, p.kind, p.reason]).sort(), [
    [unpriced, 'no_price', 'No price yet'],
    [bare, 'no_photo', 'No photo — Shopify needs one for this category'],
    [refused, 'shopify', '[Shopify’s reason]'],
  ].sort());
  assert.deepEqual((await pretendShopify(shop)).products.map((p) => p.sku), ['FINE']);
  // Try sending again: the fixed one goes, the others are still listed.
  await shop.inShop(() => prepare("UPDATE products SET photo_url = '/p/bare.jpg' WHERE id = ?").run(bare));
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await sendAll(shop);
  assert.deepEqual((await website(shop)).shopify.problems.map((p) => p.kind).sort(), ['no_price', 'shopify']);
});

test('Pause stops sending until Resume, and Send while paused is refused', async (t) => {
  const shop = await freshShop(t, 'Shopify pause');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await connectThrough(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  assert.equal(ok(await shop.req('/api/shopify/pause', { method: 'POST' })).shopify.state, 'paused');
  assert.equal(await sendRound(shop.shop.id), false, 'a paused link sends nothing');
  assert.deepEqual((await pretendShopify(shop)).products, []);
  assert.equal((await shop.req('/api/shopify/send', { method: 'POST' })).status, 409);
  assert.equal(ok(await shop.req('/api/shopify/resume', { method: 'POST' })).shopify.state, 'sending', 'carries on with what was waiting');
  await sendAll(shop);
  assert.equal((await pretendShopify(shop)).products.length, 1);
});

test('Send while a send is still going is refused, so two sends never mix their counts', async (t) => {
  const shop = await freshShop(t, 'Shopify twice');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await connectThrough(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  const again = await shop.req('/api/shopify/send', { method: 'POST' });
  assert.equal(again.status, 409, JSON.stringify(again.body));
  assert.equal(again.body.code, 'shopify_sending');
  await sendAll(shop);
  assert.deepEqual((({ state, total, sentCount }) => ({ state, total, sentCount }))((await website(shop)).shopify), { state: 'idle', total: 1, sentCount: 1 });
});

test('Shopify not answering lists what wasn’t sent, keeps what was, and the send finishes', async (t) => {
  const shop = await freshShop(t, 'Shopify silent');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  const b = await addProduct(shop, { sku: 'B', photo: '/p/b.jpg' });
  const c = await addProduct(shop, { sku: 'C', photo: '/p/c.jpg' });
  await connectThrough(shop);
  await setPretend(shop, { refuses: { A: '[Shopify’s reason]' } });
  const real = pretend.send.bind(pretend);
  let calls = 0;
  t.mock.method(pretend, 'send', async (address, product) => {
    calls += 1;
    if (calls === 1) return real(address, product);
    throw Object.assign(new Error('no answer'), { code: 'ETIMEDOUT' });
  });
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await sendAll(shop);
  assert.equal(calls, 2, 'Wheelhouse stops asking once Shopify doesn’t answer, and doesn’t ask again by itself');
  const state = (await website(shop)).shopify;
  assert.deepEqual({ state: state.state, total: state.total, sentCount: state.sentCount }, { state: 'idle', total: 3, sentCount: 3 });
  assert.deepEqual(state.problems.map((p) => [p.sku, p.kind, p.reason]), [
    ['A', 'shopify', '[Shopify’s reason]'],
    ['B', 'no_answer', 'Shopify didn’t answer — try sending again'],
    ['C', 'no_answer', 'Shopify didn’t answer — try sending again'],
  ]);
  assert.deepEqual(state.problems.slice(1).map((p) => p.productId), [b, c]);
});

test('switching to Wheelhouse’s website while a round is with Shopify leaves nothing queued', async (t) => {
  const shop = await freshShop(t, 'Shopify switch mid-round');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await addProduct(shop, { sku: 'B', photo: '/p/b.jpg' });
  await connectThrough(shop);
  t.mock.method(pretend, 'send', async () => {
    ok(await shop.req('/api/shopify/switch-to-wheelhouse', { method: 'POST' }));
    throw new Error('no answer');
  });
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await sendRound(shop.shop.id);
  const link = await shop.inShop(() => prepare('SELECT state, to_send FROM shopify_link').get());
  assert.deepEqual({ state: link.state, waiting: link.to_send.length }, { state: 'stopped', waiting: 0 });
});

test('Pause pressed while the last batch is with Shopify still finishes the send', async (t) => {
  const shop = await freshShop(t, 'Shopify late pause');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await connectThrough(shop);
  const real = pretend.send.bind(pretend);
  t.mock.method(pretend, 'send', async (address, product) => {
    ok(await shop.req('/api/shopify/pause', { method: 'POST' }));
    return real(address, product);
  });
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await sendRound(shop.shop.id);
  const state = (await website(shop)).shopify;
  assert.deepEqual({ state: state.state, products: state.products }, { state: 'idle', products: 1 });
  assert.ok(state.lastSentAt);
});

test('a send cut off part way, by a restart, is finished rather than left sending', async (t) => {
  const shop = await freshShop(t, 'Shopify cut off');
  await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await connectThrough(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  // As a restart leaves it: the batch taken off the queue, never counted.
  await shop.inShop(() => prepare("UPDATE shopify_link SET to_send = '{}', updated_at = now() - interval '10 minutes' RETURNING shop_id").run());
  assert.equal(await sendRound(shop.shop.id), false, 'nothing to send');
  const state = (await website(shop)).shopify;
  assert.equal(state.state, 'idle');
  assert.ok(state.lastSentAt);
  assert.equal(ok(await shop.req('/api/shopify/preview')).count, 1, 'what wasn’t sent shows in the check, ready to send again');
});

test('using Wheelhouse’s website instead stops sending and keeps what is online and its orders', async (t) => {
  const shop = await freshShop(t, 'Shopify switch');
  const a = await addProduct(shop, { sku: 'A', photo: '/p/a.jpg' });
  await connectThrough(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  const state = ok(await shop.req('/api/shopify/switch-to-wheelhouse', { method: 'POST' }));
  assert.equal(state.kind, 'wheelhouse');
  assert.equal(state.isOn, false, 'off until the Owner turns it on');
  assert.equal(state.shopify, null);
  assert.equal(await sendRound(shop.shop.id), false);
  assert.equal((await shop.inShop(() => prepare('SELECT show_online FROM products WHERE id = ?').get(a))).show_online, true);
  assert.equal((await shop.req('/api/shopify/send', { method: 'POST' })).status, 409);
});

test('Send with nothing to change says how many products are in Shopify, leaving out products with no SKU', async (t) => {
  const shop = await freshShop(t, 'Shopify nothing to send');
  const a = await addProduct(shop, { sku: 'A', price: 10, photo: '/p/a.jpg', stock: 1 });
  // No SKU and no price yet: not sent, and not counted as in Shopify.
  await addProduct(shop, { sku: '', price: 0, photo: '/p/blank.jpg', stock: 1 });
  await connectThrough(shop);
  await setPretend(shop, { products: [
    { id: 'gid-A', wheelhouseId: a, sku: 'A', title: '[A]', pricePence: 1000, photoUrl: '/p/a.jpg', stock: 1 },
    { id: 'gid-X', wheelhouseId: null, sku: '', title: '[No SKU in Shopify]', pricePence: 100, photoUrl: null, stock: 1 },
  ] });
  assert.equal(ok(await shop.req('/api/shopify/preview')).count, 0);
  const sent = ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  assert.deepEqual({ state: sent.shopify.state, products: sent.shopify.products }, { state: 'idle', products: 1 });
  assert.ok(sent.shopify.lastSentAt);
});

test('the background job sends after a restart, in batches, without anyone pressing anything', async (t) => {
  const shop = await freshShop(t, 'Shopify restart');
  for (let i = 1; i <= 12; i += 1) await addProduct(shop, { sku: `R${i}`, photo: `/p/r${i}.jpg` });
  await connectThrough(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  // A server starting with this send left waiting: its first look at every shop picks it up.
  const fresh = await startLiveServer({ env: { WH_SHOPIFY_TICK_MS: '50', WH_SHOPIFY_SCAN_AT_START: 'on' } });
  t.after(() => fresh.stop());
  let state;
  for (let i = 0; i < 100; i += 1) {
    state = (await website(shop)).shopify;
    if (state.state === 'idle') break;
    await new Promise((r) => { setTimeout(r, 100); });
  }
  assert.deepEqual({ state: state.state, sentCount: state.sentCount, products: state.products }, { state: 'idle', sentCount: 12, products: 12 });
  assert.equal((await pretendShopify(shop)).products.length, 12);
});

test('Turn it on is refused while the website is the shop’s Shopify', async (t) => {
  const shop = await freshShop(t, 'Shopify turn on');
  await connectThrough(shop);
  const res = await shop.req('/api/website/turn-on', { method: 'POST' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal((await website(shop)).isOn, false);
});

test('staff who aren’t the Owner are turned away from every Shopify route', async (t) => {
  const shop = await freshShop(t, 'Shopify owner only');
  const staff = await staffLogin(shop.shop.id);
  for (const [path, method, body] of [
    ['/api/shopify/connect', 'POST', { address: ADDRESS }], ['/api/shopify/preview', 'GET'], ['/api/shopify/send', 'POST'],
    ['/api/shopify/pause', 'POST'], ['/api/shopify/resume', 'POST'], ['/api/shopify/switch-to-wheelhouse', 'POST'],
    ['/api/shopify/return?state=x', 'GET'],
  ]) {
    const res = await staffRequest(server.baseUrl, staff.cookie, path, { method, body });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
});

test('the Shopify routes are the Owner’s, need a connection, and are missing on a server without Shopify', async (t) => {
  const shop = await freshShop(t, 'Shopify guards');
  assert.equal((await shop.req('/api/shopify/preview')).status, 409);
  assert.equal((await shop.req('/api/shopify/send', { method: 'POST' })).status, 409);
  assert.equal((await shop.req('/api/shopify/connect', { method: 'POST', body: {} })).status, 400);
  const page = (await shop.visit('/api/shopify/pretend-approve?state=x'));
  assert.equal(page.status, 200, 'an unknown trip still shows the pretend page, whose links are turned away');
  const off = await freshShop(t, 'Shopify none', none);
  assert.equal((await off.req('/api/shopify/connect', { method: 'POST', body: { address: ADDRESS } })).status, 409);
  assert.equal((await off.visit('/api/shopify/pretend-approve?state=x')).status, 404);
  const signedOut = await fetch(new URL('/api/shopify/preview', server.baseUrl));
  assert.equal(signedOut.status, 401);
});
