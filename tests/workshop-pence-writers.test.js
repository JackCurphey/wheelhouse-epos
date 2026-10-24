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

// Part 2b's readers (task 2.1): a price is read from its pence, so what a
// service, a booked service and a deposit say is the pence over 100.
test('a service, a booked service and the booking page read their price from the pence', async () => {
  const service = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Brake service', price: 45, minutes: 45, bookableOnline: true } })).body;
  // Only the pence changed: anything still reading the pounds shows £45.00.
  await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_services SET price_pence = 4600 WHERE id = ?').run(service.id));
  const listed = (await staff('/api/workshop-services')).body.find((s) => s.id === service.id);
  assert.equal(listed.price, 46);
  assert.equal(listed.pricePence, 4600);
  expectOk(await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } }));
  const online = (await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/services`).then((r) => r.json()));
  const shown = [...online.full, ...online.uncategorised, ...online.categories.flatMap((c) => c.services)].find((s) => s.id === service.id);
  assert.equal(shown.price, 46);
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: '2026-10-15', mechanicId: alex, serviceIds: [service.id] } })).body;
  const labour = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', serviceId: service.id }] } });
  assert.equal(labour.body.items[0].unitPricePence, 4600, 'a labour line picks the service’s price in pence');
});

function expectOk(res) { assert.ok(res.status < 300, JSON.stringify(res.body)); }

// Fresh review (migration 076): a write that forgets the pence is refused,
// rather than storing £0.00 the readers would then show and charge.
test('a workshop amount written without its pence is refused', async () => {
  const inShop = (sql, ...params) => runWithShop(owner.shop.id, () => prepare(sql).run(...params));
  await assert.rejects(inShop("INSERT INTO workshop_services (name, price, updated_at) VALUES ('Pounds only', 10, now())"), /null value in column "price_pence"/);
  const service = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Brake bleed', price: 20, minutes: 30 } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake bleed', jobDate: '2026-10-14', mechanicId: alex } })).body;
  await assert.rejects(inShop('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES (?, ?, 20, 0)', job.id, service.id), /booked_price_pence/);
  const quote = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Bleed', unitAmount: 20 }] } })).body;
  await assert.rejects(inShop("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, unit_amount) VALUES (?, 'part', 'Pads', 18)", quote.id), /null value in column "unit_amount_pence"/);
});

// Fresh review: the pence are whole numbers up to £21,474,836.47, so a bigger
// price is refused in plain words, not a server error.
test('a price too big to keep in pence is refused in plain words', async () => {
  const big = await staff('/api/workshop-services', { method: 'POST', body: { name: 'Too dear', price: 21474836.48, minutes: 30 } });
  assert.equal(big.status, 400, JSON.stringify(big.body));
  assert.equal(big.body.error, 'A service’s price must be under £1,000,000');
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Dear', jobDate: '2026-10-15', mechanicId: alex } })).body;
  const line = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Gold leaf', unitAmount: 21474836.48 }] } });
  assert.equal(line.status, 409, JSON.stringify(line.body));
  assert.equal(line.body.error, 'A line’s price must be under £1,000,000.');
  // Its unit price is kept in pence too, whatever the quantity (review).
  const tiny = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'A moment', unitAmount: 30000000, quantity: 0.01 }] } });
  assert.equal(tiny.status, 409, JSON.stringify(tiny.body));
  assert.equal(tiny.body.error, 'A line’s price must be under £1,000,000.');
  // And the quote's lines together, as its totals are summed in pence (review).
  const many = Array.from({ length: 22 }, (_, i) => ({ kind: 'labour', description: `Line ${i + 1}`, unitAmount: 999999 }));
  const whole = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: many } });
  assert.equal(whole.status, 409, JSON.stringify(whole.body));
  assert.equal(whole.body.error, 'A quote’s total must be under £1,000,000.');
});

// Fresh review: a part of 0 would be quoted at £0.00 and charged as 1.
test('a quoted part needs a quantity of at least 1', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Pads', jobDate: '2026-10-16', mechanicId: alex } })).body;
  for (const quantity of [0, -2]) {
    const res = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'part', description: 'Pads', unitAmount: 20, quantity }] } });
    assert.equal(res.status, 409, `${quantity}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error, 'A part’s quantity must be a whole number of 1 or more.');
  }
});
