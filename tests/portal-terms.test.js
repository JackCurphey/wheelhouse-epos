// GET /api/portal/:shopSlug/terms: the terms text a customer is agreeing to
// - the shop's own when it has set one, else the standard Wheelhouse terms.
// Spec: docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { jsonRequest } from './helpers/http.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { STANDARD_BOOKING_TERMS } from '../server/standard-terms.js';

let server;
let shopA;
let shopB;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const terms = (who) => jsonRequest(server.baseUrl, null, `/api/portal/${who.shop.slug}/terms`);
const setTerms = (who, bookingTerms) =>
  staffRequest(server.baseUrl, who.cookie, '/api/workshop-settings', { method: 'PUT', body: { bookingTerms } });

test('an unknown shop answers 404', async () => {
  const res = await jsonRequest(server.baseUrl, null, '/api/portal/no-such-shop-anywhere/terms');
  assert.equal(res.status, 404);
});

test('a shop with none set gets the standard terms, exactly', async () => {
  const res = await terms(shopA);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { title: 'Booking terms', text: STANDARD_BOOKING_TERMS, standard: true });
});

test('a shop with its own terms gets those instead, and standard is false', async () => {
  const put = await setTerms(shopA, 'Bring your own terms.');
  assert.equal(put.status, 200, JSON.stringify(put.body));
  try {
    const res = await terms(shopA);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { title: 'Booking terms', text: 'Bring your own terms.', standard: false });
  } finally {
    await setTerms(shopA, null);
  }
});

test('one shop\'s own terms are never returned for another', async () => {
  const put = await setTerms(shopA, 'Shop A only terms.');
  assert.equal(put.status, 200, JSON.stringify(put.body));
  try {
    const res = await terms(shopB);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { title: 'Booking terms', text: STANDARD_BOOKING_TERMS, standard: true });
  } finally {
    await setTerms(shopA, null);
  }
});
