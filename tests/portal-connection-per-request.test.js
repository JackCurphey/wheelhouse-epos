// A request holds one pooled connection for its shop (runWithShop) and must
// never need a second one while it does (openspec/changes/
// portal-connection-per-request). The shop's website asked "which customer is
// signed in?" from inside that scope, and three staff routes read the shop's
// slug there, each through a second connection from the same pool of 10: about
// ten such requests at once held all ten, all waited for an eleventh, and
// after the 5-second connection wait they all failed. On the website, a
// made-up cookie was enough to do it.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

// More than the pool's 10 connections, so a double checkout cannot all fit.
const AT_ONCE = 12;
// Under the pool's 5-second connection wait: a stall shows as a failure here
// rather than as a slow pass.
const QUICKLY_MS = 4000;
const MADE_UP = 'wh_customer_session=x';

let server;
let northStreet;
let elsewhere;
let maya;
let mayaCookie;
let mayaJob;
let walkIn;

const staff = (path, options, who = northStreet) => staffRequest(server.baseUrl, who.cookie, path, options);

// Each request from its own network, so the booking link's attempt limiter
// (30 refusals a network) never answers in place of the route.
let network = 0;
async function portal(path, { cookie, shop = northStreet } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    headers: { 'x-forwarded-for': `198.51.100.${++network % 250}`, ...(cookie ? { cookie } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function signIn(email, shop) {
  const ip = `203.0.113.${++network % 250}`;
  const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await runWithShop(shop.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

// Fire them all at once; every answer, and how long the slowest took.
async function burst(make) {
  const started = Date.now();
  const answers = await Promise.all(Array.from({ length: AT_ONCE }, (_, i) => make(i)));
  return { answers, took: Date.now() - started };
}
const statuses = (answers) => answers.map((a) => a.status);

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  northStreet = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  elsewhere = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  const email = `maya-${randomUUID().slice(0, 8)}@example.test`;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email, phone: '07700 900142' } })).body;
  // Maya booked as a guest, so her email is her own and her code sign-in joins her.
  await runWithShop(northStreet.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(maya.id));
  mayaCookie = await signIn(email, northStreet);
  mayaJob = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-05', customerId: maya.id } })).body;
  // No phone or email, so a quote's message can't go and Send hands staff the link.
  walkIn = (await staff('/api/customers', { method: 'POST', body: { name: '[walk-in]' } })).body;
  // Open all 10 of the server's pooled connections first, as a shop that has
  // been running for a while would have. With a cold pool, opening each new
  // connection is slow enough to spread a burst out and hide the stall.
  const warm = await burst(() => staff('/api/label-settings'));
  assert.deepEqual(statuses(warm.answers), Array(AT_ONCE).fill(200));
});

after(async () => {
  if (northStreet) await deleteTestShop(northStreet.shop.id);
  if (elsewhere) await deleteTestShop(elsewhere.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test(`${AT_ONCE} account requests at once with a made-up cookie are all refused quickly`, async () => {
  const { answers, took } = await burst(() => portal('/me', { cookie: MADE_UP }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(401), JSON.stringify(answers.map((a) => a.body)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test(`${AT_ONCE} repair-by-job requests at once with a made-up cookie are all refused quickly`, async () => {
  const { answers, took } = await burst(() => portal(`/booking-links/job-${mayaJob.id}`, { cookie: MADE_UP }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(404), JSON.stringify(answers.map((a) => a.body)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test(`${AT_ONCE} of Maya's own requests at once are all answered quickly`, async () => {
  const { answers, took } = await burst((i) => portal(i % 2 ? '/me' : `/booking-links/job-${mayaJob.id}`, { cookie: mayaCookie }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(200), JSON.stringify(answers.map((a) => a.body)));
  for (const a of answers.filter((_, i) => i % 2)) assert.equal(a.body.email, maya.email);
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test('a customer of North Street gets nothing from Elsewhere, alone or in a mixed burst', async () => {
  for (const path of ['/me', '/bikes', '/bookings', '/history']) {
    const got = await portal(path, { cookie: mayaCookie, shop: elsewhere });
    assert.equal(got.status, 401, `${path}: ${JSON.stringify(got.body)}`);
  }
  const byJob = await portal(`/booking-links/job-${mayaJob.id}`, { cookie: mayaCookie, shop: elsewhere });
  assert.equal(byJob.status, 404, JSON.stringify(byJob.body));

  // Each kind of asker at once: an answer must never reach another request.
  const kinds = [
    { cookie: mayaCookie, shop: northStreet, want: 200 },
    { cookie: MADE_UP, shop: northStreet, want: 401 },
    { cookie: undefined, shop: northStreet, want: 401 },
    { cookie: mayaCookie, shop: elsewhere, want: 401 },
  ];
  const { answers, took } = await burst((i) => portal('/me', kinds[i % kinds.length]));
  assert.deepEqual(statuses(answers), answers.map((_, i) => kinds[i % kinds.length].want), JSON.stringify(answers.map((a) => a.body)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test(`${AT_ONCE} private links at once are all issued quickly, each to the shop's own pages`, async () => {
  const { answers, took } = await burst(() => staff(`/api/workshop-jobs/${mayaJob.id}/private-link`, { method: 'POST', body: {} }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(201), JSON.stringify(answers.map((a) => a.body)));
  for (const a of answers) assert.match(a.body.privateLink, new RegExp(`^/book/${northStreet.shop.slug}/booking/[0-9a-f]{64}$`));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

const LINE = { kind: 'labour', description: 'Fit & adjust brakes', unitAmount: 18, need: 'needed', reason: 'Goes together with the new pads' };
async function jobWithDraftQuote(customerId, day) {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(day).padStart(2, '0')}`, customerId } })).body;
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [LINE] } });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { job, quoteId: quote.body.id };
}

test(`${AT_ONCE} photo codes at once are all made quickly, each on the shop's own pages`, async () => {
  const { job, quoteId } = await jobWithDraftQuote(maya.id, 6);
  const { answers, took } = await burst(() => staff(`/api/workshop-jobs/${job.id}/quote-photo-codes`, { method: 'POST', body: { quoteId, linePosition: 0 } }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(201), JSON.stringify(answers.map((a) => a.body)));
  for (const a of answers) assert.match(a.body.path, new RegExp(`^/book/${northStreet.shop.slug}/photo/[0-9a-f]{64}$`));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test(`${AT_ONCE} quotes sent at once each hand staff a link quickly (issueJobLink)`, async () => {
  const quotes = [];
  for (let i = 0; i < AT_ONCE; i++) quotes.push(await jobWithDraftQuote(walkIn.id, 7 + i));
  const { answers, took } = await burst((i) => staff(`/api/quotes/${quotes[i].quoteId}/send`, { method: 'POST', body: {} }));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(200), JSON.stringify(answers.map((a) => a.body)));
  for (const a of answers) assert.match(a.body.link, new RegExp(`^https://wh\\.test/book/${northStreet.shop.slug}/booking/[0-9a-f]{64}$`), JSON.stringify(a.body));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});
