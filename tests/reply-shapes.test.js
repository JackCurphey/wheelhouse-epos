// One place that says what each reply the screens read looks like (Mark's
// working agreement, #349, design 3 and task 2.4; review issue #354 item 3):
// the server's real replies are checked against it here, and the screens'
// test mocks are checked against it in their own tests, so a reply that
// changes shape fails both rather than leaving mocks quietly out of date.
// Needs `npm run pretest` (the shapes are read from .test-build).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { dayMaker } from './helpers/linkActions.js';

const SHAPES = new URL('../.test-build/lib/api/shapes.js', import.meta.url).href;
let server;
let owner;
let sam;
let shapes;
const nextDay = dayMaker();

before(async () => {
  shapes = await import(SHAPES);
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

test('the shape check finds a missing field, an extra one and a wrong type', () => {
  const shape = { id: ['number'], name: ['string', 'null'] };
  assert.deepEqual(shapes.shapeProblems(shape, { id: 1, name: null }), []);
  assert.deepEqual(shapes.shapeProblems(shape, { id: '1', extra: true }), ['id: string, wanted number', 'name: missing', 'extra: not in the shape']);
});

test('a workshop job, from the list and on its own, is the shape the screens expect', async () => {
  const cust = await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel' } });
  const bike = await staff(`/api/customers/${cust.body.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'green' } });
  const day = nextDay();
  const full = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: day, startTime: '10:00', endTime: '11:00', mechanicId: sam, customerId: cust.body.id, bikeId: bike.body.id } });
  const bare = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Wheel build', jobDate: day, startTime: '12:00', endTime: '13:00', mechanicId: null } });
  assert.equal(full.status, 201, JSON.stringify(full.body));
  assert.equal(bare.status, 201, JSON.stringify(bare.body));
  const list = (await staff(`/api/workshop-jobs?start=${day}&end=${day}`)).body;
  assert.equal(list.length, 2);
  for (const job of [...list, (await staff(`/api/workshop-jobs/${full.body.id}`)).body, full.body]) {
    assert.deepEqual(shapes.shapeProblems(shapes.WORKSHOP_JOB, job), [], `job ${job.id}`);
    assert.ok(job.parts.length > 0, `job ${job.id} has its days`);
    for (const part of job.parts) assert.deepEqual(shapes.shapeProblems(shapes.JOB_PART, part), [], `job ${job.id} part ${part.position}`);
  }
});
