// The reminder tick on the in-shop ready page (openspec/changes/ready-remind-tick;
// account and reminders decision 2; Jack's answer 8 of 25 Oct): the booking
// link says whether the customer said yes, and takes their answer, a yes from
// collection or a no.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let alex;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
// Maya Patel (the drawings' example), booked in by staff, with her link.
async function mayasLink() {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id } })).body;
  const link = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink;
  return { customer, code: link.split('/booking/')[1] };
}
const at = (code, rest = '') => `${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}${rest}`;
const answer = (code, yes) => fetch(at(code, '/reminders'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ yes }) })
  .then(async (r) => ({ status: r.status, body: await r.json() }));
const answers = (id) => inShop(() => prepare('SELECT service_reminders, review_requests, reminders_said_yes_via, reminders_said_yes_at FROM customers WHERE id = ?').get(id));

test('the link says whether the customer said yes', async () => {
  const { customer, code } = await mayasLink();
  assert.equal((await fetch(at(code)).then((r) => r.json())).remindersYes, false);
  await inShop(() => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(customer.id));
  assert.equal((await fetch(at(code)).then((r) => r.json())).remindersYes, true);
});

test('ticking it is a yes to reminders and review requests, from collection; unticking turns reminders off', async () => {
  const { customer, code } = await mayasLink();
  const yes = await answer(code, true);
  assert.equal(yes.status, 200, JSON.stringify(yes.body));
  assert.equal(yes.body.remindersYes, true);
  const a = await answers(customer.id);
  assert.equal(a.service_reminders, true);
  assert.equal(a.review_requests, true);
  assert.equal(a.reminders_said_yes_via, 'collection');
  assert.ok(a.reminders_said_yes_at instanceof Date);
  const no = await answer(code, false);
  assert.equal(no.body.remindersYes, false);
  assert.equal((await answers(customer.id)).service_reminders, false);
});

test('a made-up link, or an answer that isn’t yes or no, is refused, and nothing changes', async () => {
  const { customer, code } = await mayasLink();
  assert.equal((await answer('e'.repeat(64), true)).status, 404);
  assert.equal((await answer(code, 'yes')).status, 400);
  assert.equal((await answers(customer.id)).service_reminders, false);
});
