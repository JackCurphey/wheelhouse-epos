// The old diary's save (PUT /api/workshop-jobs/:id) takes part in the version
// check the action routes use, and every save counts as a change.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { bookOnline, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const save = (id, body) => staff(`/api/workshop-jobs/${id}`, { method: 'PUT', body });
const book = () => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
});

test('a save with the version last read goes ahead and bumps it', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'Rang the customer', version: before.version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.version, before.version + 1);
  assert.equal(res.body.notes, 'Rang the customer');
});

test('a save with an older version is refused and changes nothing', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'Stale edit', version: before.version - 1 });
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
  const after = await read(booked.id);
  assert.equal(after.notes, before.notes);
  assert.equal(after.version, before.version);
});

test('a save without a version still works, and still counts as a change', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'No version sent' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.version, before.version + 1);
});

test('an accept on the copy read before a diary save is refused', async () => {
  const booked = await book();
  const seen = await read(booked.id);
  assert.equal((await save(booked.id, { startTime: '11:00', endTime: '12:00', version: seen.version })).status, 200);
  const res = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: seen.version } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'stale');
});

test('a version that is not a whole number is refused', async () => {
  const booked = await book();
  const res = await save(booked.id, { notes: 'x', version: 'one' });
  assert.equal(res.status, 400);
});
