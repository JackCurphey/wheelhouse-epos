// Where a service sits: full or individual, which category, what order.
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
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
const category = async (who, name) =>
  (await as(who, '/api/workshop-service-categories', { method: 'POST', body: { name } })).body;
const service = (who, body) =>
  as(who, '/api/workshop-services', { method: 'POST', body: { name: 'Svc', price: 10, ...body } });

test('a new service is individual, uncategorised and at position 0 unless told otherwise', async () => {
  const res = await service(shopA, {});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'individual');
  assert.equal(res.body.categoryId, null);
  assert.equal(res.body.position, 0);
});

test('an individual service can be filed under a category with a position', async () => {
  const brakes = await category(shopA, 'Brakes');
  const res = await service(shopA, { kind: 'individual', categoryId: brakes.id, position: 3 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.categoryId, brakes.id);
  assert.equal(res.body.position, 3);
});

test('a full service carries no category', async () => {
  const brakes = await category(shopA, 'Brakes 2');
  const res = await service(shopA, { kind: 'full', categoryId: brakes.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'full');
  assert.equal(res.body.categoryId, null);
});

test('kind must be full or individual', async () => {
  const res = await service(shopA, { kind: 'premium' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /full|individual/);
});

test('a service cannot be filed under another shop\'s category', async () => {
  const theirs = await category(shopB, 'B only');
  const res = await service(shopA, { categoryId: theirs.id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /category/i);
});

test('a PUT that omits kind, categoryId and position keeps them', async () => {
  const gears = await category(shopA, 'Gears');
  const made = await service(shopA, { categoryId: gears.id, position: 5 });
  const res = await as(shopA, `/api/workshop-services/${made.body.id}`, {
    method: 'PUT',
    body: { name: 'Gear index', price: 15 },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'individual');
  assert.equal(res.body.categoryId, gears.id);
  assert.equal(res.body.position, 5);
});

test('deleting a category leaves its services, uncategorised', async () => {
  const wheels = await category(shopA, 'Wheels');
  const made = await service(shopA, { categoryId: wheels.id });
  await as(shopA, `/api/workshop-service-categories/${wheels.id}`, { method: 'DELETE' });
  const list = await as(shopA, '/api/workshop-services');
  const after = list.body.find((s) => s.id === made.body.id);
  assert.ok(after, 'the service was deleted with its category');
  assert.equal(after.categoryId, null);
});
