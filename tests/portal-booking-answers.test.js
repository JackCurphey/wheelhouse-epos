// A booking's answers to its service's questions: checked before anything is
// written, stored as a frozen copy.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
// Successful bookings are signed in; guest bookings are rate-limited per IP.
// Refused guest bookings stop before the limiter, so they don't count.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let svc;

const QUESTIONS = [
  { wording: 'What is wrong?', kind: 'text', required: true },
  { wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'] },
  { wording: 'Tubeless?', kind: 'choice', choices: ['Yes', 'No'], required: true, allowNotSure: false },
];

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const makeService = async (questions = QUESTIONS) => (await staff('/api/workshop-services', {
  method: 'POST', body: { name: 'Brake check', price: 20, minutes: 60, bookableOnline: true, questions },
})).body;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  svc = await makeService();
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };
const book = (body, { guest = false } = {}) => portalRequest(server.baseUrl, guest ? null : customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Brakes rub',
    newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId: svc.id,
    ...BOOKING_CONTACT, ...(guest ? GUEST : {}), ...body,
  },
});
const idOf = (service, wording) => service.questions.find((q) => q.wording === wording).id;
const goodAnswers = (service = svc) => [
  { questionId: idOf(service, 'What is wrong?'), text: 'Rubs at the back' },
  { questionId: idOf(service, 'Tubeless?'), choice: 'No' },
];
const stored = async (jobId) => (await runWithShop(owner.shop.id, () => prepare(
  'SELECT question_answers FROM workshop_jobs WHERE id = ?'
).get(jobId))).question_answers;
const counts = () => runWithShop(owner.shop.id, () => prepare(
  'SELECT (SELECT count(*)::int FROM workshop_jobs) AS jobs, (SELECT count(*)::int FROM customers) AS customers'
).get());

test('good answers store a frozen copy in question order', async () => {
  const res = await book({ answers: goodAnswers() });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await stored(res.body.id), [
    { id: idOf(svc, 'What is wrong?'), wording: 'What is wrong?', kind: 'text', answer: 'Rubs at the back' },
    { id: idOf(svc, 'E-bike?'), wording: 'E-bike?', kind: 'choice', answer: null },
    { id: idOf(svc, 'Tubeless?'), wording: 'Tubeless?', kind: 'choice', answer: 'No' },
  ]);
});

test('not sure is stored as { notSure: true }', async () => {
  const res = await book({ answers: [...goodAnswers(), { questionId: idOf(svc, 'E-bike?'), notSure: true }] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual((await stored(res.body.id))[1].answer, { notSure: true });
});

test('rewording and then deleting the questions leaves the booking unchanged', async () => {
  const own = await makeService();
  const res = await book({ serviceId: own.id, answers: goodAnswers(own) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const before = await stored(res.body.id);
  assert.deepEqual(before, [
    { id: idOf(own, 'What is wrong?'), wording: 'What is wrong?', kind: 'text', answer: 'Rubs at the back' },
    { id: idOf(own, 'E-bike?'), wording: 'E-bike?', kind: 'choice', answer: null },
    { id: idOf(own, 'Tubeless?'), wording: 'Tubeless?', kind: 'choice', answer: 'No' },
  ]);
  const reworded = own.questions.map((q) => ({ ...q, wording: `${q.wording} (new)` }));
  const put = (questions) => staff(`/api/workshop-services/${own.id}`, {
    method: 'PUT', body: { name: own.name, price: 20, minutes: 60, questions },
  });
  const putReworded = await put(reworded);
  assert.equal(putReworded.status, 200);
  assert.deepEqual(putReworded.body.questions.map((q) => q.wording), reworded.map((q) => q.wording));
  assert.deepEqual(await stored(res.body.id), before);
  const putEmptied = await put([]);
  assert.equal(putEmptied.status, 200);
  assert.deepEqual(putEmptied.body.questions, []);
  assert.deepEqual(await stored(res.body.id), before);
});

test('a service with no questions stores an empty copy', async () => {
  const plain = await makeService([]);
  const res = await book({ serviceId: plain.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await stored(res.body.id), []);
});

test('a not sure booking stores no answers', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await stored(res.body.id), null);
});

// Each refusal is sent as a guest, so it would create a customer row if the
// check came too late. Refusals stop before the guest limiter.
const refusedAsGuest = async (body, pattern) => {
  const before = await counts();
  const res = await book(body, { guest: true });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, pattern);
  assert.deepEqual(await counts(), before);
};

test('a missing required answer is refused, leaving nothing behind', () =>
  refusedAsGuest({ answers: [goodAnswers()[1]] }, /^Please answer: What is wrong\?$/));
test('a choice not on the list is refused', () =>
  refusedAsGuest({ answers: [goodAnswers()[0], { questionId: idOf(svc, 'Tubeless?'), choice: 'Maybe' }] }, /have changed/));
test('not sure where it is switched off is refused', () =>
  refusedAsGuest({ answers: [goodAnswers()[0], { questionId: idOf(svc, 'Tubeless?'), notSure: true }] }, /have changed/));
test('a text answer over 1,000 characters is refused', () =>
  refusedAsGuest({ answers: [{ questionId: idOf(svc, 'What is wrong?'), text: 'x'.repeat(1001) }, goodAnswers()[1]] }, /1,000 characters/));
test('an unknown question id is refused with the changed message', () =>
  refusedAsGuest({ answers: [...goodAnswers(), { questionId: 'q_gone00000000', text: 'x' }] },
    /^The questions for this service have changed — please check them and try again$/));
test('answers on a not sure booking are refused', () =>
  refusedAsGuest({ serviceId: undefined, notSure: true, answers: goodAnswers() }, /chosen service/));
test('a not sure booking with non-list answers is refused', () =>
  refusedAsGuest({ serviceId: undefined, notSure: true, answers: {} }, /chosen service/));

test('the staff job view shows the answers', async () => {
  const res = await book({ answers: goodAnswers() });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await staff(`/api/workshop-jobs/${res.body.id}`);
  assert.equal(job.status, 200, JSON.stringify(job.body));
  assert.deepEqual(job.body.questionAnswers, await stored(res.body.id));
});

test('the staff job view shows null questionAnswers for a job with no copy', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await stored(res.body.id), null);
  const job = await staff(`/api/workshop-jobs/${res.body.id}`);
  assert.equal(job.status, 200, JSON.stringify(job.body));
  assert.equal(job.body.questionAnswers, null);
});
