// The jobs list asked for the bikes in the shop (Jack, 21 Oct,
// docs/decisions/2026-10-21-workshop-overview.md; openspec/changes/workshop-overview):
// `custody` returns the jobs in that custody whatever their days, so the
// Overview finds a bike in the shop since another day.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const make = async (title, jobDate) => {
  const res = await staff('/api/workshop-jobs', { method: 'POST', body: { title, jobDate, startTime: '10:00', endTime: '11:00', mechanicId: sam } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const ids = (res) => res.body.map((j) => j.id);

test('custody=in_shop lists the bikes in the shop, whatever their days; expected lists the rest', async () => {
  const day = nextDay();
  const kept = await make('In since another day', day);
  const booked = await staff(`/api/workshop-jobs/${kept.id}/book-in`, { method: 'POST', body: { version: kept.version } });
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
  const waiting = await make('Not in yet', nextDay());

  const inShop = await staff('/api/workshop-jobs?custody=in_shop');
  assert.equal(inShop.status, 200, JSON.stringify(inShop.body));
  assert.ok(ids(inShop).includes(kept.id));
  assert.ok(!ids(inShop).includes(waiting.id));
  assert.ok(inShop.body.every((j) => j.custodyState === 'in_shop'));

  const expected = await staff('/api/workshop-jobs?custody=expected');
  assert.ok(ids(expected).includes(waiting.id));
  assert.ok(!ids(expected).includes(kept.id));
});

test('custody combines with a date range', async () => {
  const day = nextDay();
  const job = await make('On its day', day);
  await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } });
  const other = nextDay();
  assert.ok(ids(await staff(`/api/workshop-jobs?custody=in_shop&start=${day}&end=${day}`)).includes(job.id));
  assert.ok(!ids(await staff(`/api/workshop-jobs?custody=in_shop&start=${other}&end=${other}`)).includes(job.id));
  assert.ok(!ids(await staff(`/api/workshop-jobs?custody=expected&start=${day}&end=${day}`)).includes(job.id), 'the custody still applies');
});

test('any other custody is refused', async () => {
  const res = await staff('/api/workshop-jobs?custody=somewhere');
  assert.equal(res.status, 400);
});
