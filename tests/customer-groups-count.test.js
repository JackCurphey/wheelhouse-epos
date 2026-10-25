// Settings › Front desk › Payments › Customer groups (openspec/changes/customer-groups-settings;
// cs-groups): the list gives each group's count of current customers.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('each group comes with how many current customers are in it', async () => {
  const club = (await staff('/api/customer-groups', { method: 'POST', body: { name: 'Club members', discountPercent: 10 } })).body;
  const add = async (name, groupIds) => (await staff('/api/customers', { method: 'POST', body: { name, phone: '07700 900142', groupIds } })).body;
  await add('Maya Patel', [club.id]);
  await add('Sam Reed', [club.id]);
  const gone = await add('Jo Taylor', [club.id]);
  await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET active = 0 WHERE id = ?').run(gone.id));
  const list = (await staff('/api/customer-groups')).body;
  const row = list.find((g) => g.id === club.id);
  assert.deepEqual([row.name, row.discountPercent, row.customerCount], ['Club members', 10, 2]);
  // createShop's own groups, with nobody in them yet.
  assert.ok(list.filter((g) => g.id !== club.id).every((g) => g.customerCount === 0));
});

// Review: a missing discount (as "10%" read as a number would send) is refused,
// not saved as 0.
test('a discount that isn’t a number is refused, not saved as 0', async () => {
  const res = await staff('/api/customer-groups', { method: 'POST', body: { name: 'Odd', discountPercent: null } });
  assert.equal(res.status, 400);
});
