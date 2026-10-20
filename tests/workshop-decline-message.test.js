// Declining a booking request with a message (Workshop day 15; Jack, 20 Oct;
// openspec/changes/decline-message): the message is kept with the job and the
// customer's link shows it once declined.
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { jsonRequest } from './helpers/http.js';
import { linkActions, bookOnline, liveHolds, jobRow, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const book = () => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
});
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;
const decline = async (id, extra = {}) => staff(`/api/workshop-jobs/${id}/decline`, { method: 'POST', body: { version: await version(id), ...extra } });

test('declining with a message keeps it, trimmed, and the customer’s link shows it', async () => {
  const booked = await book();
  const before = (await link.read(booked.code)).body;
  assert.equal(before.declineMessage, null, 'nothing before it is declined');
  const res = await decline(booked.id, { message: '  Sorry, we can’t fit this in. Please try another day.  ' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await jobRow(owner.shop.id, booked.id)).decline_message, 'Sorry, we can’t fit this in. Please try another day.');
  const view = (await link.read(booked.code)).body;
  assert.equal(view.stage, 'declined');
  assert.equal(view.declineMessage, 'Sorry, we can’t fit this in. Please try another day.');
});

test('declining without a message still works, and shows none', async () => {
  const booked = await book();
  assert.equal((await decline(booked.id)).status, 200);
  assert.equal((await link.read(booked.code)).body.declineMessage, null);
});

test('a message too long, or not text, is refused and nothing is declined', async () => {
  const booked = await book();
  const long = await decline(booked.id, { message: 'x'.repeat(1001) });
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'The message can be up to 1,000 characters');
  const notText = await decline(booked.id, { message: 42 });
  assert.equal(notText.status, 400);
  assert.equal(notText.body.error, 'The message must be text');
  assert.equal((await jobRow(owner.shop.id, booked.id)).booking_state, 'pending');
});
