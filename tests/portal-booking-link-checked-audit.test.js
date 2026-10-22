// "Checked by" on the booking link: the cases the 22 Oct audit found untested
// (docs/reviews/2026-10-22-flagged-merges-audit.md, missing tests item 9, #275).
// Jack, 16 and 18 Oct (docs/decisions/2026-10-16-mechanic-sign-off.md answers
// 3 and 4): reopening the work clears the sign-off, so the link names nobody
// until it is signed off again; and each shop's "Show who signed off to
// customers" applies to its own links only.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let shopA;
let shopB;
before(async () => {
  server = await startLiveServer();
  shopA = await shopWithBooker();
  shopB = await shopWithBooker();
  shopA.jo = await seedMechanic(shopA.shop.id, { name: 'Jo Taylor' });
});
after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
  await pool.end();
});

async function shopWithBooker() {
  const owner = await staffSignup(server.baseUrl);
  owner.sam = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  owner.types = await seedJobTypes(owner.shop.id);
  owner.customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  return owner;
}

let n = 0;
const staff = (shop, path, options) => staffRequest(server.baseUrl, shop.cookie, path, options);
async function book(shop) {
  const res = await portalRequest(server.baseUrl, shop.customer.cookie, `/api/portal/${shop.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: shop.sam, jobDate: futureDate(1 + (n++ % 5)), startTime: n % 2 ? '10:00' : '14:00', description: 'Squeaky brakes', newBike: { make: 'Trek', model: 'Domane AL 3' }, serviceIds: [shop.types.service], ...BOOKING_CONTACT },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const code = res.body.privateLink.split('/').pop();
  const job = await runWithShop(shop.shop.id, () => prepare('SELECT id FROM workshop_jobs WHERE reference = ?').get(res.body.reference));
  return { code, id: job.id };
}
const read = (shop, code) => jsonRequest(server.baseUrl, null, `/api/portal/${shop.shop.slug}/booking-links/${code}`);
const jobRow = (shop, id) => runWithShop(shop.shop.id, () => prepare('SELECT version, signed_off_name FROM workshop_jobs WHERE id = ?').get(id));
const show = (shop, on) => staff(shop, '/api/workshop-settings', { method: 'PUT', body: { showSignOffToCustomers: on } });
// In the shop and in progress; the finish below signs it off through the job's own action.
const inProgress = (shop, id) => runWithShop(shop.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'in_progress' WHERE id = ?").run(id));
async function act(shop, id, action, extra = {}) {
  const { version } = await jobRow(shop, id);
  const res = await staff(shop, `/api/workshop-jobs/${id}/${action}`, { method: 'POST', body: { version, ...extra } });
  assert.equal(res.status, 200, `${action}: ${JSON.stringify(res.body)}`);
}

test('reopened, the sign-off is cleared and the link names nobody; signed off again, it names the new mechanic', async () => {
  const { code, id } = await book(shopA);
  await inProgress(shopA, id);
  await act(shopA, id, 'finish', { signedOffBy: shopA.sam });
  assert.equal((await show(shopA, true)).status, 200);
  try {
    assert.equal((await read(shopA, code)).body.checkedBy, 'Alex Morgan', 'signed off and ready');

    await act(shopA, id, 'reopen-work');
    // The real check that reopening clears the sign-off: the link alone can't
    // tell, as it names nobody while the work is in progress either way.
    assert.ok((await jobRow(shopA, id)).signed_off_name === null, 'reopening left the sign-off on the job');
    const reopened = await read(shopA, code);
    assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
    assert.equal(reopened.body.checkedBy, null, 'a reopened job still names who signed it off before');

    await act(shopA, id, 'finish', { signedOffBy: shopA.jo });
    assert.equal((await read(shopA, code)).body.checkedBy, 'Jo Taylor');
  } finally {
    await show(shopA, false);
  }
});

test("each shop's setting covers its own links only", async () => {
  const a = await book(shopA);
  const b = await book(shopB);
  for (const [shop, job] of [[shopA, a], [shopB, b]]) {
    await inProgress(shop, job.id);
    await act(shop, job.id, 'finish', { signedOffBy: shop.sam });
  }
  // Shop B shows who signed off; shop A doesn't.
  assert.equal((await show(shopB, true)).status, 200);
  try {
    assert.equal((await read(shopB, b.code)).body.checkedBy, 'Alex Morgan');
    assert.equal((await read(shopA, a.code)).body.checkedBy, null, "shop B's setting showed on shop A's link");
  } finally {
    await show(shopB, false);
  }
  // And the other way round.
  assert.equal((await show(shopA, true)).status, 200);
  try {
    assert.equal((await read(shopA, a.code)).body.checkedBy, 'Alex Morgan');
    assert.equal((await read(shopB, b.code)).body.checkedBy, null, "shop A's setting showed on shop B's link");
  } finally {
    await show(shopA, false);
  }
});
