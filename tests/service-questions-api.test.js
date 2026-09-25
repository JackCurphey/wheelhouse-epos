// Staff set a service's questions through the service routes.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const BASE = { name: 'Brake bleed', price: 30, minutes: 45 };
const create = (body) => as('/api/workshop-services', { method: 'POST', body: { ...BASE, ...body } });
const update = (id, body) => as(`/api/workshop-services/${id}`, { method: 'PUT', body: { ...BASE, ...body } });
const listed = async (id) => (await as('/api/workshop-services')).body.find((s) => s.id === id);

const Q = [
  { wording: 'Which brakes?', kind: 'choice', choices: ['Front', 'Rear', 'Both'], required: true },
  { wording: 'Anything else?', kind: 'text' },
];

test('a new service without questions has an empty list', async () => {
  const res = await create({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions, []);
});

test('questions save in order with ids and come back from the list', async () => {
  const res = await create({ questions: Q });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions.map((q) => q.wording), ['Which brakes?', 'Anything else?']);
  for (const q of res.body.questions) assert.match(q.id, /^q_[0-9a-f]{12}$/);
  assert.equal(res.body.questions[0].allowNotSure, true);
  assert.deepEqual((await listed(res.body.id)).questions, res.body.questions);
});

test('rewording a question keeps its id; a new question gets a new one', async () => {
  const made = (await create({ questions: Q })).body;
  const [first] = made.questions;
  const res = await update(made.id, { questions: [{ ...first, wording: 'Which brake?' }, { wording: 'New', kind: 'text' }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.questions[0].id, first.id);
  assert.equal(res.body.questions[0].wording, 'Which brake?');
  assert.ok(!made.questions.some((q) => q.id === res.body.questions[1].id));
});

test('an id from another service is not taken', async () => {
  const a = (await create({ questions: Q })).body;
  const b = (await create({})).body;
  const res = await update(b.id, { questions: [{ ...a.questions[1] }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.notEqual(res.body.questions[0].id, a.questions[1].id);
});

test('a PUT without questions keeps the stored list', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { name: 'Renamed' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions, made.questions);
});

test('a PUT with an empty list removes every question', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { questions: [] });
  assert.deepEqual(res.body.questions, []);
});

test('a bad list is refused with a plain message and nothing changes', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { name: 'Changed', questions: [{ wording: 'Only one', kind: 'choice', choices: ['Yes'] }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2 to 10 choices/);
  const after = await listed(made.id);
  assert.equal(after.name, 'Brake bleed');
  assert.deepEqual(after.questions, made.questions);
});

test('a bad list on a new service is refused', async () => {
  const res = await create({ questions: [{ wording: '', kind: 'text' }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /needs wording/);
});
