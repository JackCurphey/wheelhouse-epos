// What a full service includes, through the staff interface: kept in order,
// kept when a save leaves it out, and refused when it breaks a rule.
// Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const create = (body, who = owner) =>
  as(who, '/api/workshop-services', { method: 'POST', body: { price: 10, minutes: 30, ...body } });
const made = async (body, who = owner) => {
  const res = await create(body, who);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const put = (id, body) => as(owner, `/api/workshop-services/${id}`, { method: 'PUT', body });
const listed = async (id) =>
  (await as(owner, '/api/workshop-services')).body.find((s) => s.id === id);

test('a full service keeps its included services in the order given', async () => {
  const brake = await made({ name: 'Brake service' });
  const gear = await made({ name: 'Gear service' });
  const full = await made({ name: 'General service', kind: 'full', includes: [gear.id, brake.id] });
  assert.deepEqual(full.includes, [gear.id, brake.id]);
  assert.deepEqual((await listed(full.id)).includes, [gear.id, brake.id]);
});

test('a service created without includes has an empty list, individual ones too', async () => {
  const full = await made({ name: 'Plain full', kind: 'full' });
  const part = await made({ name: 'Plain part' });
  assert.deepEqual(full.includes, []);
  assert.deepEqual(part.includes, []);
  assert.deepEqual((await listed(part.id)).includes, []);
});

test('a save that leaves includes out keeps the list; one that sends it replaces it', async () => {
  const a = await made({ name: 'Keep A' });
  const b = await made({ name: 'Keep B' });
  const full = await made({ name: 'Keep full', kind: 'full', includes: [a.id] });
  let res = await put(full.id, { name: 'Keep full renamed', price: 12 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.includes, [a.id]);
  res = await put(full.id, { name: 'Keep full renamed', price: 12, includes: [b.id, a.id] });
  assert.deepEqual(res.body.includes, [b.id, a.id]);
  res = await put(full.id, { name: 'Keep full renamed', price: 12, includes: [] });
  assert.deepEqual(res.body.includes, []);
});

test('each broken rule is refused with its message and nothing changes', async () => {
  const part = await made({ name: 'Rule part' });
  const otherFull = await made({ name: 'Rule other full', kind: 'full' });
  const foreign = await made({ name: 'Other shop part' }, other);
  const full = await made({ name: 'Rule full', kind: 'full', includes: [part.id] });
  const many = [];
  for (let i = 0; i < 51; i++) many.push((await made({ name: `Many ${i}` })).id);
  const cases = [
    [{ includes: 'nope' }, 'That service does not exist'],
    [{ includes: [1.5] }, 'That service does not exist'],
    [{ includes: [2147483647] }, 'That service does not exist'],
    [{ includes: [foreign.id] }, 'That service does not exist'],
    [{ includes: [otherFull.id] }, 'Rule other full is not an individual service'],
    [{ includes: [full.id] }, 'Rule full is not an individual service'],
    [{ includes: [part.id, part.id] }, "A service can't be included twice"],
    [{ includes: many }, 'A full service can include at most 50 services'],
  ];
  for (const [body, message] of cases) {
    const res = await put(full.id, { name: 'Rule full', price: 10, ...body });
    assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 60)} -> ${res.status}`);
    assert.equal(res.body.error, message);
  }
  assert.deepEqual((await listed(full.id)).includes, [part.id]);
  const onCreate = await create({ name: 'Bad new', kind: 'full', includes: [otherFull.id] });
  assert.equal(onCreate.status, 400);
  assert.equal(onCreate.body.error, 'Rule other full is not an individual service');
});

test('exactly 50 is allowed', async () => {
  const fifty = [];
  for (let i = 0; i < 50; i++) fifty.push((await made({ name: `Fifty ${i}` })).id);
  const full = await made({ name: 'Fifty full', kind: 'full', includes: fifty });
  assert.equal(full.includes.length, 50);
});

test('an individual service cannot include anything', async () => {
  const part = await made({ name: 'Solo part' });
  const res = await create({ name: 'Solo individual', includes: [part.id] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Only a full service can include other services');
});

test('changing a full service to individual clears its list', async () => {
  const part = await made({ name: 'Demote part' });
  const full = await made({ name: 'Demote full', kind: 'full', includes: [part.id] });
  const res = await put(full.id, { name: 'Demote full', price: 10, kind: 'individual' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.includes, []);
  const back = await put(full.id, { name: 'Demote full', price: 10, kind: 'full' });
  assert.deepEqual(back.body.includes, [], 'the old list came back');
});

test('an individual service that is included cannot become full until taken out', async () => {
  const part = await made({ name: 'Brake check' });
  await made({ name: 'Zeta service', kind: 'full', includes: [part.id] });
  const alpha = await made({ name: 'Alpha service', kind: 'full', includes: [part.id] });
  let res = await put(part.id, { name: 'Brake check', price: 10, kind: 'full' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Brake check is part of Alpha service - take it out of that first');
  assert.equal((await listed(part.id)).kind, 'individual');
  await put(alpha.id, { name: 'Alpha service', price: 10, includes: [] });
  res = await put(part.id, { name: 'Brake check', price: 10, kind: 'full' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Brake check is part of Zeta service - take it out of that first');
});

test('a service cannot include itself when promoted to full', async () => {
  const part = await made({ name: 'Self part' });
  const res = await put(part.id, { name: 'Self part', price: 10, kind: 'full', includes: [part.id] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Self part is not an individual service');
  const row = await listed(part.id);
  assert.equal(row.kind, 'individual');
  assert.deepEqual(row.includes, []);
});

test('a removed service stays in the staff list', async () => {
  const part = await made({ name: 'Retired part' });
  const full = await made({ name: 'Retired full', kind: 'full', includes: [part.id] });
  await as(owner, `/api/workshop-services/${part.id}`, { method: 'DELETE' });
  assert.deepEqual((await listed(full.id)).includes, [part.id]);
});
