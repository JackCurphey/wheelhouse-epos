// When each service's reminder is due (openspec/changes/service-reminder-months;
// account and reminders decision 2; ac-service-edit): months from 1 to 60, or
// none, kept when a change leaves them out.
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
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const make = (body = {}) => staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, kind: 'full', ...body } });
const REFUSED = 'Remind after a whole number of months, from 1 to 60';

test('a service starts with no reminder, and returns its months once set', async () => {
  const made = await make();
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.reminderMonths, null);
  const set = await staff(`/api/workshop-services/${made.body.id}`, { method: 'PUT', body: { name: 'Standard service', price: 65, minutes: 60, reminderMonths: 12 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.reminderMonths, 12);
  const listed = (await staff('/api/workshop-services')).body.find((s) => s.id === made.body.id);
  assert.equal(listed.reminderMonths, 12);
});

test('a change that leaves the months out keeps them; null clears them', async () => {
  const made = await make({ reminderMonths: 6 });
  assert.equal(made.body.reminderMonths, 6);
  const kept = await staff(`/api/workshop-services/${made.body.id}`, { method: 'PUT', body: { name: 'Standard service', price: 70, minutes: 60 } });
  assert.equal(kept.body.reminderMonths, 6);
  const cleared = await staff(`/api/workshop-services/${made.body.id}`, { method: 'PUT', body: { name: 'Standard service', price: 70, minutes: 60, reminderMonths: null } });
  assert.equal(cleared.body.reminderMonths, null);
});

test('months outside 1 to 60, or not whole, are refused, and nothing is saved', async () => {
  for (const reminderMonths of [0, -1, 61, 1.5, '12', true]) {
    const res = await make({ reminderMonths });
    assert.equal(res.status, 400, `${JSON.stringify(reminderMonths)}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error, REFUSED);
  }
  for (const reminderMonths of [1, 60]) assert.equal((await make({ reminderMonths })).body.reminderMonths, reminderMonths);
});
