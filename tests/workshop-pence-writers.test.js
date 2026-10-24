// Step A′'s writers (openspec/changes/wp-1-6-sales-in-pence task 2.1; the money
// contract, design.md Decision 6): every write of a workshop amount writes its
// pence in the same statement, from 075 on, so the totals check stays clean on
// rows made after the migration: a service's price (added and changed), a
// booked service's price, and a quote line's unit amount.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let alex;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Pence Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const row = (sql, ...params) => runWithShop(owner.shop.id, () => prepare(sql).get(...params));

test('a service’s price is written in pence too, when added and when changed', async () => {
  const made = await staff('/api/workshop-services', { method: 'POST', body: { name: 'Gear adjustment', price: 33.33, minutes: 60 } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal((await row('SELECT price_pence FROM workshop_services WHERE id = ?', made.body.id)).price_pence, 3333);
  const changed = await staff(`/api/workshop-services/${made.body.id}`, { method: 'PUT', body: { name: 'Gear adjustment', price: 40.5, minutes: 60 } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await row('SELECT price_pence FROM workshop_services WHERE id = ?', made.body.id)).price_pence, 4050);
});

test('a booked service’s price is copied in pence too', async () => {
  const service = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65.5, minutes: 60 } })).body;
  const job = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex, serviceIds: [service.id] } });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  const booked = await row('SELECT booked_price::float AS pounds, booked_price_pence FROM workshop_job_services WHERE workshop_job_id = ?', job.body.id);
  assert.deepEqual({ ...booked }, { pounds: 65.5, booked_price_pence: 6550 });
});

test('a quote line’s unit amount is written in pence too', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-14', mechanicId: alex } })).body;
  const q = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'part', description: 'Brake pads', unitAmount: 24.5, need: 'needed' }] } });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  const line = await row('SELECT unit_amount::float AS pounds, unit_amount_pence FROM workshop_quote_lines WHERE workshop_quote_id = ?', q.body.id);
  assert.deepEqual({ ...line }, { pounds: 24.5, unit_amount_pence: 2450 });
});
