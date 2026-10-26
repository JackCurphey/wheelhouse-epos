// Audit item 24 (#336, docs/reviews/2026-10-22-flagged-merges-audit.md): with
// DB_TENANT_SCOPE=transaction a whole request is one database transaction, so
// a booking message that fails to queue (it is caught and logged) must not
// poison it: the staff answer it follows has been made and stands.
// The failure is made by a trigger on this shop's messages only, put in after
// the booking exists (the customer's own request message would fail the same way).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { bookOnline, jobRow, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
const nextDay = dayMaker();
// This server runs with DB_TENANT_SCOPE 'transaction', where a request's
// commit lands just after its reply goes (server/db.js), so a read straight
// after can come before it on a slow machine. Ask again for up to 2 seconds.
async function eventually(read, ok) {
  const end = Date.now() + 2000;
  for (;;) {
    const value = await read();
    if (ok(value) || Date.now() > end) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
}

before(async () => {
  server = await startLiveServer({ env: { DB_TENANT_SCOPE: 'transaction' } });
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) {
    await pool.query(`DROP TRIGGER IF EXISTS fail_message_${owner.shop.id} ON customer_messages`);
    await pool.query(`DROP FUNCTION IF EXISTS fail_message_${owner.shop.id}()`);
    await deleteTestShop(owner.shop.id);
  }
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('accepting a request stands when its confirmation message can’t be queued', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });

  await pool.query(`CREATE OR REPLACE FUNCTION fail_message_${owner.shop.id}() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'test: this message cannot be queued'; END $f$ LANGUAGE plpgsql`);
  await pool.query(`CREATE TRIGGER fail_message_${owner.shop.id} BEFORE INSERT ON customer_messages FOR EACH ROW WHEN (NEW.shop_id = ${owner.shop.id}) EXECUTE FUNCTION fail_message_${owner.shop.id}()`);
  const read = await staff(`/api/workshop-jobs/${booked.id}`);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  const version = read.body.version;
  const res = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'scheduled');
  const row = await eventually(() => jobRow(owner.shop.id, booked.id), (r) => r.booking_state === 'scheduled');
  assert.equal(row.booking_state, 'scheduled', 'the answer was rolled back with the failed message');
});

// The customer's own side has the same catch (portal.js sendLinkMessage): a
// booking made while its "Request received" message can't be queued stands.
test('a customer’s booking stands when its Request received message can’t be queued', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '14:00', serviceIds: [types.repair],
  });
  const read = await eventually(() => staff(`/api/workshop-jobs/${booked.id}`), (r) => r.status === 200);
  assert.equal(read.status, 200, JSON.stringify(read.body));
});
