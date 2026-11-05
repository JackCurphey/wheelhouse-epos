// A body made of tiny values costs far more to parse than its size suggests: 69 MB of
// {},{},{} ran JSON.parse out of memory and stopped every shop, with no sign-in
// (openspec/changes/json-shape). Each server here has the heap of the Node 22 container
// at 1 GB, so a break crashes it on any machine, rather than only in the container.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { encryptSecret } from '../server/shopify.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';
import { tinyJpeg, JPEG_OVERHEAD } from './helpers/pictures.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate, purgeAttachmentFiles } from './helpers/workshopFixtures.js';
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from '../server/booking-photos.js';
import { holdRequestBody, readJsonBody } from '../server/lib/http.js';

const HEAP = { NODE_OPTIONS: '--max-old-space-size=524' };
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function within(ms, what, promise) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: nothing after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, limit]);
  } finally {
    clearTimeout(timer);
  }
}

// Valid JSON of `size` bytes holding `structures` of the characters that make values,
// the rest one long string, as a photo's base64 is.
function bodyWith(structures, size) {
  const list = '0,'.repeat(Math.max(0, structures - 3));
  const start = Buffer.from(`{"a":[${list}0],"b":"`);
  const body = Buffer.alloc(Math.max(size, start.length + 2), 'A');
  start.copy(body);
  Buffer.from('"}').copy(body, body.length - 2);
  return body;
}
// As many {} as fit: the body that crashed the server.
function tinyObjects(size) {
  const body = Buffer.alloc(size, ' ');
  let at = body.write('{"a":[');
  while (at + 6 < size) at += body.write('{},', at);
  body.write('0]}', at);
  return body;
}

let server;
let owner;
let other;
let mechanic;
let customer;
let service;

before(async () => {
  server = await startLiveServer({ env: HEAP });
  try {
    owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
    other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
    mechanic = await seedMechanic(owner.shop.id, { name: 'Sam' });
    customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
    service = (await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', { method: 'POST', body: { name: 'Brake check', price: 20, minutes: 60, bookableOnline: true, questions: [] } })).body;
  } finally {
    await server.stop();
  }
});
after(async () => {
  try {
    if (owner) {
      await purgeAttachmentFiles(owner.shop.id);
      await deleteTestShop(owner.shop.id);
    }
    if (other) await deleteTestShop(other.shop.id);
  } finally {
    await pool.end();
  }
});

const live = (name, fn) => test(name, { timeout: 120_000 }, async () => {
  server = await startLiveServer({ env: HEAP });
  try {
    await fn();
  } finally {
    await server.stop();
  }
});

// Sends the head and the body on a raw socket; ends when answered or closed.
async function send(path, body, headers = {}) {
  const socket = connect(new URL(server.baseUrl).port, '127.0.0.1');
  const state = { text: '', closed: false };
  socket.on('error', () => {});
  socket.on('data', (d) => { state.text += d.toString('latin1'); });
  socket.on('close', () => { state.closed = true; });
  await once(socket, 'connect');
  const lines = [`POST ${path} HTTP/1.1`, 'Host: 127.0.0.1', 'Content-Type: application/json', `Content-Length: ${body.length}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), '', ''];
  socket.write(lines.join('\r\n'));
  socket.write(body);
  const end = Date.now() + 60_000;
  while (!state.text && !state.closed) {
    if (Date.now() > end) throw new Error(`${path}: nothing after 60s`);
    await pause(10);
  }
  await pause(20);
  socket.destroy();
  const [, status] = /^HTTP\/1\.1 (\d{3})/.exec(state.text) ?? [];
  const words = state.text.split('\r\n\r\n')[1] ?? '';
  return { status: status ? Number(status) : null, words, closed: state.closed };
}
async function assertAlive(what) {
  const health = await within(5000, `${what}: the health check`, fetch(`${server.baseUrl}/healthz`));
  assert.equal(health.status, 200, what);
  const list = await within(5000, `${what}: another shop`, staffRequest(server.baseUrl, other.cookie, '/api/customers'));
  assert.equal(list.status, 200, what);
}
const TOO_MUCH = /too much to send/;
const bookings = () => `/api/portal/${owner.shop.slug}/bookings`;

// ---------- The crash ----------

live('the 69 MB of tiny objects that stopped the server: refused, in words, and everyone else still answered', async () => {
  const res = await send(bookings(), tinyObjects(69 * 1024 * 1024));
  assert.equal(res.status, 400, JSON.stringify(res));
  assert.match(res.words, TOO_MUCH);
  await assertAlive('after it');
});

live('14.7 MB of tiny objects to a photo for a line: the same', async () => {
  const res = await send(`/api/portal/${owner.shop.slug}/photo-codes/nope`, tinyObjects(14 * 1024 * 1024));
  assert.equal(res.status, 400, JSON.stringify(res));
  assert.match(res.words, TOO_MUCH);
  await assertAlive('after it');
});

// ---------- The limit on what a body is made of, at each door ----------

const PUBLIC_LIMIT = 10_000;
const SIGNED_IN_LIMIT = 200_000;

live('with no sign-in: just over the limit refused, just under reaches the route', async () => {
  for (const [what, path] of [
    ['a booking', bookings()],
    ['a photo for a line', `/api/portal/${owner.shop.slug}/photo-codes/nope`],
    ['a customer signing in', `/api/portal/${owner.shop.slug}/login`],
    ['the website\'s small routes', `/api/portal/${owner.shop.slug}/booking-links/nope/cancel`],
    ['a staff account', '/api/auth/login'],
  ]) {
    const over = await send(path, bodyWith(PUBLIC_LIMIT + 10, 0));
    assert.equal(over.status, 400, `${what}: ${JSON.stringify(over)}`);
    assert.match(over.words, TOO_MUCH, what);
    const under = await send(path, bodyWith(PUBLIC_LIMIT - 10, 0));
    assert.doesNotMatch(under.words, TOO_MUCH, what);
    assert.notEqual(under.status, null, `${what}: answered`);
  }
  await assertAlive('after each');
});

live('signed in: just over the higher limit refused, just under reaches the route', async () => {
  for (const [what, path] of [
    ['a small body', '/api/customers'],
    ['an upload', '/api/workshop-jobs/999999/attachments'],
  ]) {
    const over = await send(path, bodyWith(SIGNED_IN_LIMIT + 10, 0), { Cookie: owner.cookie });
    assert.equal(over.status, 400, what);
    assert.match(over.words, TOO_MUCH, what);
    const under = await send(path, bodyWith(SIGNED_IN_LIMIT - 10, 0), { Cookie: owner.cookie });
    assert.doesNotMatch(under.words, TOO_MUCH, what);
  }
});

live('a till: the higher limit too, as a shop\'s', async () => {
  const siteRes = await staffRequest(server.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: 'Shop', code: 'B' } });
  assert.ok(siteRes.status < 500);
  const sites = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites')).body;
  const till = (await staffRequest(server.baseUrl, owner.cookie, '/api/tills', { method: 'POST', body: { siteId: sites[0].id, number: 7, name: 'Till 7' } })).body;
  const headers = { Authorization: `Bearer ${till.token}` };
  const path = `/api/till/${owner.shop.slug}/sync`;
  assert.match((await send(path, bodyWith(SIGNED_IN_LIMIT + 10, 0), headers)).words, TOO_MUCH);
  assert.doesNotMatch((await send(path, bodyWith(PUBLIC_LIMIT + 10, 0), headers)).words, TOO_MUCH, 'over the no-sign-in limit is fine for a till');
});

live('a Shopify order is only parsed once its signature is good, so a long one is left alone', async () => {
  const secret = 'json-shape-webhook-secret';
  await runWithShop(other.shop.id, () => prepare(
    `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
     VALUES (?, ?, ?, ?, ?, '1', 'connected') ON CONFLICT DO NOTHING RETURNING shop_id`
  ).get(other.shop.id, `json-shape-${other.shop.id}.fake-shopify.invalid`, encryptSecret('fake'), encryptSecret('fake'), encryptSecret(secret)));
  const items = Array.from({ length: 2500 }, () => ({ title: 'x', quantity: 1, price: '1.00' }));
  const body = Buffer.from(JSON.stringify({ id: Date.now(), order_number: 1, line_items: items }));
  const res = await send(`/webhooks/shopify/${other.shop.id}/orders`, body, { 'X-Shopify-Hmac-Sha256': createHmac('sha256', secret).update(body).digest('base64') });
  assert.equal(res.status, 200, JSON.stringify(res));
});

live('each character that makes a value counts, alone', async () => {
  for (const ch of ['{', '[', ',', ':']) {
    const res = await send(`/api/portal/${owner.shop.slug}/login`, Buffer.alloc(PUBLIC_LIMIT + 10, ch));
    assert.equal(res.status, 400, ch);
    assert.match(res.words, TOO_MUCH, ch);
  }
});

live('counted across the pieces a body arrives in, not per piece', async () => {
  const socket = connect(new URL(server.baseUrl).port, '127.0.0.1');
  let text = '';
  socket.on('error', () => {});
  socket.on('data', (d) => { text += d.toString('latin1'); });
  await once(socket, 'connect');
  socket.write(`POST /api/portal/${owner.shop.slug}/login HTTP/1.1\r\nHost: a\r\nContent-Type: application/json\r\nContent-Length: ${3 * PUBLIC_LIMIT}\r\n\r\n`);
  for (let i = 0; i < 3 && !text; i++) {
    socket.write(','.repeat(Math.floor(PUBLIC_LIMIT * 0.6)));
    await pause(100);
  }
  socket.destroy();
  assert.match(text, TOO_MUCH);
});

test('a body handed to its route no longer holds its bytes', async () => {
  const held = { chunks: [Buffer.from('{}')], bytes: 2, overflowed: false };
  const req = {};
  holdRequestBody(req, held);
  assert.deepEqual(await readJsonBody(req), {});
  assert.deepEqual(held.chunks, []);
});

// ---------- Lower limits where a route has no reason for more ----------

const OVER_SMALL = 200 * 1024;

live('with no sign-in, a small route has no reason for 2 MB: told so in words, and closed', async () => {
  for (const [what, path] of [
    ['a customer signing in', `/api/portal/${owner.shop.slug}/login`],
    ['a customer signing up', `/api/portal/${owner.shop.slug}/signup`],
    ['a staff account', '/api/auth/login'],
  ]) {
    // By a real client, which finds a connection cut under it an error (UND_ERR_SOCKET),
    // at sizes from just over the limit to about where the old one was.
    for (const size of [101 * 1024, 150_000, OVER_SMALL, 1_500_000]) {
      for (let i = 0; i < 3; i++) {
        const res = await within(10_000, what, fetch(server.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bodyWith(100, size) }));
        assert.equal(res.status, 400, `${what}, ${size}`);
        assert.match((await res.json()).error, TOO_MUCH, `${what}, ${size}`);
        assert.equal(res.headers.get('connection'), 'close', `${what}, ${size}`);
      }
    }
    const under = await within(10_000, what, fetch(server.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bodyWith(100, 90_000) }));
    assert.doesNotMatch(await under.text(), TOO_MUCH, `${what}, under it`);
  }
  // Under 2 MB it reads on to the end before answering, which is what lets the client
  // hear it: nothing comes back while part of the body is still to come.
  const near = connect(new URL(server.baseUrl).port, '127.0.0.1');
  let early = '';
  near.on('error', () => {});
  near.on('data', (d) => { early += d.toString('latin1'); });
  await once(near, 'connect');
  near.write(`POST /api/portal/${owner.shop.slug}/login HTTP/1.1\r\nHost: a\r\nContent-Type: application/json\r\nContent-Length: 1500000\r\n\r\n`);
  near.write(Buffer.alloc(1_400_000, 'A'));
  await pause(300);
  const beforeTheRest = early;
  near.write(Buffer.alloc(100_000, 'A'));
  const by = Date.now() + 3000;
  while (!early && Date.now() < by) await pause(10);
  near.destroy();
  assert.equal(beforeTheRest, '', 'nothing while the rest is still to come');
  assert.match(early, TOO_MUCH, 'then the words');

  // Far over: nobody reads on for ever. Past 2 MB the server answers and closes with the
  // rest of the body unread, and closing with bytes unread resets the connection, which
  // can reach the client before the answer does (about 1 in 12 here; the design says so).
  // So this asks only that the server ends it without waiting for the rest: answered, or
  // closed. Waiting, it would do neither, with the other 17 MB never sent.
  const far = connect(new URL(server.baseUrl).port, '127.0.0.1');
  let heard = '';
  let closed = false;
  far.on('error', () => {});
  far.on('data', (d) => { heard += d.toString('latin1'); });
  far.on('close', () => { closed = true; });
  await once(far, 'connect');
  far.write(`POST /api/portal/${owner.shop.slug}/login HTTP/1.1\r\nHost: a\r\nContent-Type: application/json\r\nContent-Length: ${20 * 1024 * 1024}\r\n\r\n`);
  far.write(Buffer.alloc(3 * 1024 * 1024, 'A'));
  const end = Date.now() + 3000;
  while (!heard && !closed && Date.now() < end) await pause(10);
  far.destroy();
  assert.ok(closed || /^HTTP\/1\.1 400/.test(heard), `ended without waiting for the rest: ${JSON.stringify({ heard: heard.slice(0, 40), closed })}`);
  if (heard) assert.match(heard, TOO_MUCH, 'and if heard, in words');
  await assertAlive('after each');
});

live('signed in, and for the routes with photos, the larger sizes still hold', async () => {
  const signedIn = await send('/api/customers', bodyWith(100, OVER_SMALL), { Cookie: owner.cookie });
  assert.equal(signedIn.status, 400, 'read whole, then refused for its contents');
  for (const path of [bookings(), `/api/portal/${owner.shop.slug}/photo-codes/nope`]) {
    const res = await send(path, bodyWith(100, 2 * 1024 * 1024));
    assert.notEqual(res.status, null, path);
    assert.doesNotMatch(res.words, /too large|too much/, path);
  }
});

// ---------- Honest bookings ----------

live('an honest booking at the largest allowed, 5 photos of 10 MB, is taken, on the same small heap', async () => {
  const photo = tinyJpeg('', MAX_PHOTO_BYTES - JPEG_OVERHEAD).toString('base64');
  const body = Buffer.from(JSON.stringify({
    mechanicId: mechanic, jobDate: futureDate(3), startTime: '10:00', description: 'Brakes rub, and it creaks, on the left, going uphill', serviceIds: [service.id], newBike: { make: 'Dawes', model: 'Galaxy' },
    ...BOOKING_CONTACT, photos: Array.from({ length: MAX_PHOTOS }, () => ({ dataBase64: photo })),
  }));
  assert.ok(body.length > 66 * 1024 * 1024, `${body.length} bytes`);
  const res = await send(bookings(), body, { Cookie: customer.cookie });
  assert.equal(res.status, 201, JSON.stringify(res).slice(0, 300));
  await assertAlive('after it');
});

live('words with commas in them count, and a long honest note is well inside the limit', async () => {
  const note = 'a, b: c, '.repeat(200);
  const res = await send(bookings(), Buffer.from(JSON.stringify({ description: note })));
  assert.doesNotMatch(res.words, TOO_MUCH);
});
