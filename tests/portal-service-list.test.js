// The customer booking page's service list: public, one shop only, grouped
// full / by category / uncategorised, prices only when the shop allows.
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

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

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const publicList = (who) => jsonRequest(server.baseUrl, null, `/api/portal/${who.shop.slug}/services`);
const category = async (who, name, position = 0) =>
  (await as(who, '/api/workshop-service-categories', { method: 'POST', body: { name, position } })).body;
const service = async (who, body) =>
  (await as(who, '/api/workshop-services', {
    method: 'POST',
    body: { price: 10, minutes: 30, bookableOnline: true, ...body },
  })).body;
const setShowPrices = (who, on) =>
  as(who, '/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: on } });
const allIds = (list) => [
  ...list.full, ...list.uncategorised, ...list.categories.flatMap((c) => c.services),
].map((s) => s.id);

test('an unknown shop answers 404', async () => {
  const res = await jsonRequest(server.baseUrl, null, '/api/portal/no-such-shop-anywhere/services');
  assert.equal(res.status, 404);
});

test('only this shop\'s active, bookable-online services are listed, with no sign-in', async () => {
  const shown = await service(shopA, { name: 'Shown' });
  const hidden = await service(shopA, { name: 'Not online', bookableOnline: false });
  const inactive = await service(shopA, { name: 'Retired' });
  await as(shopA, `/api/workshop-services/${inactive.id}`, { method: 'DELETE' });
  const other = await service(shopB, { name: 'Shop B only' });

  const res = await publicList(shopA);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const ids = allIds(res.body);
  assert.ok(ids.includes(shown.id), 'the bookable service is missing');
  for (const [s, why] of [[hidden, 'not bookable online'], [inactive, 'inactive'], [other, 'another shop\'s']]) {
    assert.ok(!ids.includes(s.id), `listed a service that is ${why}`);
  }
});

test('prices are null unless the shop shows prices online', async () => {
  await service(shopA, { name: 'Priced', price: 42.5 });
  await setShowPrices(shopA, false);
  let res = await publicList(shopA);
  assert.equal(res.body.showPrices, false);
  assert.ok(res.body.uncategorised.every((s) => s.price === null), 'a price leaked with the setting off');

  await setShowPrices(shopA, true);
  res = await publicList(shopA);
  assert.equal(res.body.showPrices, true);
  assert.equal(res.body.uncategorised.find((s) => s.name === 'Priced').price, 42.5);
});

test('full, categorised and uncategorised services are grouped and ordered', async () => {
  const shop = await staffSignup(server.baseUrl);
  try {
    // Every position contradicts alphabetical order, so the assertions below
    // fail if position is ignored.
    const wheels = await category(shop, 'Wheels', 1);
    const brakes = await category(shop, 'Brakes', 2);
    await service(shop, { name: 'Premium service', kind: 'full', position: 1 });
    await service(shop, { name: 'Basic service', kind: 'full', position: 2 });
    await service(shop, { name: 'Pad swap', categoryId: brakes.id, position: 1 });
    await service(shop, { name: 'Bleed', categoryId: brakes.id, position: 2 });
    await service(shop, { name: 'True wheel', categoryId: wheels.id });
    await service(shop, { name: 'Tubeless setup' });

    const res = await publicList(shop);
    assert.deepEqual(res.body.full.map((s) => s.name), ['Premium service', 'Basic service']);
    assert.deepEqual(res.body.categories.map((c) => c.name), ['Wheels', 'Brakes']);
    assert.deepEqual(res.body.categories[1].services.map((s) => s.name), ['Pad swap', 'Bleed']);
    assert.deepEqual(res.body.uncategorised.map((s) => s.name), ['Tubeless setup']);
    assert.deepEqual(Object.keys(res.body.full[0]).sort(), ['id', 'minutes', 'name', 'price']);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

test('a category with no bookable service is left out', async () => {
  const empty = await category(shopA, 'Nothing online');
  await service(shopA, { name: 'Staff only', categoryId: empty.id, bookableOnline: false });
  const res = await publicList(shopA);
  assert.ok(!res.body.categories.some((c) => c.id === empty.id), 'an empty category was listed');
});
