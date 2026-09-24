// Staff CRUD for service categories. One level deep: a category holds
// individual services and never other categories (Jack, 24 Sep).
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

test('categories are created and listed by position, then name', async () => {
  // Positions deliberately contradict alphabetical order, so a sort by name
  // alone gives a different answer and the test can tell the two apart.
  for (const [name, position] of [['Wheels', 0], ['Gears', 1], ['Brakes', 1]]) {
    const res = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name, position } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['id', 'name', 'position']);
  }
  const list = await as(shopA, '/api/workshop-service-categories');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((c) => c.name), ['Wheels', 'Brakes', 'Gears']);
});

test('a category needs a name', async () => {
  const res = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: '   ' } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /name/i);
});

test('a PUT that omits position keeps it', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Susp', position: 7 } });
  const res = await as(shopA, `/api/workshop-service-categories/${made.body.id}`, { method: 'PUT', body: { name: 'Suspension' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { id: made.body.id, name: 'Suspension', position: 7 });
});

test('one shop cannot see or change another shop\'s categories', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Private to A' } });
  const listB = await as(shopB, '/api/workshop-service-categories');
  assert.equal(listB.status, 200);
  assert.ok(!listB.body.some((c) => c.id === made.body.id), 'shop B listed shop A\'s category');
  const put = await as(shopB, `/api/workshop-service-categories/${made.body.id}`, { method: 'PUT', body: { name: 'Taken' } });
  assert.equal(put.status, 404);
  const del = await as(shopB, `/api/workshop-service-categories/${made.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 404);
});

test('a deleted category is gone from the list', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Temporary' } });
  const del = await as(shopA, `/api/workshop-service-categories/${made.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const list = await as(shopA, '/api/workshop-service-categories');
  assert.ok(!list.body.some((c) => c.id === made.body.id));
});
