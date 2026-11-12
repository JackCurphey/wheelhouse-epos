// The Workshop report, the server (openspec/changes/reports-ready-made,
// design 2; rp-workshop). The clock is pinned to Thursday 17 September 2026,
// so "this week" is Mon 14 to Thu 17 so far, against Mon 7 to Thu 10.
// Times are UTC; the shop is on British Summer Time, an hour ahead.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const workshop = (query, who = owner) => as(who)(`/api/reports/workshop?${query}`);

function seeder(shop) {
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const one = (sql, ...args) => inShop(() => prepare(sql).get(...args));
  return {
    mechanic: (name, days) => one('INSERT INTO employees (name, is_mechanic, working_days) VALUES (?, 1, ?) RETURNING id', name, JSON.stringify(days)),
    job: ({ date = '2026-09-14', mechanic = null, start = '', end = '', planned = null, state = 'scheduled', bookedIn = null, signedOff = null, collected = null } = {}) => one(
      `INSERT INTO workshop_jobs (title, job_date, mechanic_id, start_time, end_time, planned_minutes, booking_state, booked_in_at, signed_off_at, collected_at)
       VALUES ('Service', ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      date, mechanic, start, end, planned, state, bookedIn, signedOff, collected
    ),
    block: (jobId, date, mechanic, start, end, position = 2) => one(
      'INSERT INTO workshop_job_parts (workshop_job_id, part_date, mechanic_id, start_time, end_time, position) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      jobId, date, mechanic, start, end, position
    ),
    away: (mechanic, date, start, end) => one(
      "INSERT INTO workshop_unavailability (employee_id, kind, start_date, end_date, start_time, end_time) VALUES (?, 'dates', ?, ?, ?, ?) RETURNING id",
      mechanic, date, date, start, end
    ),
    quote: (jobId, state, sentAt, revision = 1) => one(
      'INSERT INTO workshop_quotes (workshop_job_id, revision, state, sent_at) VALUES (?, ?, ?, ?) RETURNING id', jobId, revision, state, sentAt
    ),
    // A sale in the old record, with labour and parts lines; linked to a job's
    // order when a job is given.
    sale: async ({ at, labour = 0, parts = 0, discount = 0, jobId = null }) => {
      const total = labour + parts - discount;
      const sale = await one(
        "INSERT INTO sales (created_at, subtotal, discount, total, payment_method, card_amount) VALUES (?, ?, ?, ?, 'Card', ?) RETURNING id",
        at, labour + parts, discount, total, total
      );
      if (labour) await one("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Labour', ?, 1, ?, 'labour') RETURNING id", sale.id, labour, labour);
      if (parts) {
        const product = await one("INSERT INTO products (name, price) VALUES ('Chain', ?) RETURNING id", parts);
        await one("INSERT INTO sale_items (sale_id, product_id, name, unit_price, qty, line_total, line_type) VALUES (?, ?, 'Chain', ?, 1, ?, 'product') RETURNING id", sale.id, product.id, parts, parts);
      }
      if (jobId) {
        await one(
          "INSERT INTO sale_documents (kind, status, subtotal, discount, total, workshop_job_id, converted_sale_id) VALUES ('order', 'converted', ?, ?, ?, ?, ?) RETURNING id",
          labour + parts, discount, total, jobId, sale.id
        );
      }
      return sale;
    },
  };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Cashier', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  const s = seeder(owner);
  // Jobs through the week. A: booked in Monday, signed off Wednesday, collected Thursday.
  const a = await s.job({ bookedIn: '2026-09-14T08:00:00Z', signedOff: '2026-09-16T08:00:00Z', collected: '2026-09-17T09:00:00Z' });
  // B: booked in Tuesday, signed off Tuesday then reopened and signed off again Thursday:
  // the job keeps only its latest sign-off.
  const b = await s.job({ bookedIn: '2026-09-15T08:00:00Z', signedOff: '2026-09-17T08:00:00Z' });
  // C: booked in Wednesday, not finished.
  await s.job({ bookedIn: '2026-09-16T09:00:00Z' });
  // E: 23:30 UTC on Sunday 13th is 00:30 on Monday 14th in the shop: this week.
  await s.job({ bookedIn: '2026-09-13T23:30:00Z' });
  // F: signed off Tuesday with no booking-in time: Finished, not in the average.
  await s.job({ signedOff: '2026-09-15T12:00:00Z' });
  // D: last week, booked in Tuesday 8th, finished and collected Wednesday 9th.
  const d = await s.job({ bookedIn: '2026-09-08T09:00:00Z', signedOff: '2026-09-09T09:00:00Z', collected: '2026-09-09T15:00:00Z' });
  // Friday 11th is not one of "the same days last week".
  await s.job({ bookedIn: '2026-09-11T09:00:00Z', signedOff: '2026-09-11T15:00:00Z' });

  // Workshop takings. A's sale on Wednesday: £60 labour, £40 parts, £10 off, so £54 and £36.
  await s.sale({ at: '2026-09-16T10:00:00Z', labour: 60, parts: 40, discount: 10, jobId: a.id });
  // B's on Thursday: £10 labour, £20 parts, £1 off: £29, shared £9.67 and £19.33.
  await s.sale({ at: '2026-09-17T09:30:00Z', labour: 10, parts: 20, discount: 1, jobId: b.id });
  // D's last Wednesday: £25 labour.
  await s.sale({ at: '2026-09-09T10:00:00Z', labour: 25, jobId: d.id });
  // A shop sale with no job is not workshop takings.
  await s.sale({ at: '2026-09-16T11:00:00Z', parts: 500 });

  // Quotes sent this week, by how they stand now.
  await s.quote(a.id, 'approved', '2026-09-14T10:00:00Z');
  await s.quote(b.id, 'partly_approved', '2026-09-15T10:00:00Z');
  await s.quote(d.id, 'declined', '2026-09-15T11:00:00Z', 2);
  await s.quote(a.id, 'sent', '2026-09-16T10:00:00Z', 2);   // no answer yet
  await s.quote(b.id, 'expired', '2026-09-14T11:00:00Z', 2); // no answer, ran out
  await s.quote(b.id, 'withdrawn', '2026-09-15T12:00:00Z', 3);
  await s.quote(b.id, 'superseded', '2026-09-15T13:00:00Z', 4);
  await s.quote(a.id, 'draft', null, 3);
  // Last week: one approved.
  await s.quote(d.id, 'approved', '2026-09-08T10:00:00Z');

  // How full. The workshop is open 09:00 to 18:00 every day (9 hours).
  // Jo Taylor works Monday to Wednesday: 27 hours, less 4 away on Tuesday morning = 23.
  const joT = await s.mechanic('Jo Taylor', [1, 2, 3]);
  await s.away(joT.id, '2026-09-15', '09:00', '13:00');
  await s.job({ date: '2026-09-14', mechanic: joT.id, start: '09:00', end: '12:00' });        // 3 hours
  await s.job({ date: '2026-09-15', mechanic: joT.id, start: '14:00', end: '16:00' });        // 2 hours
  const multi = await s.job({ date: '2026-09-16', mechanic: joT.id, planned: 120 });          // 2 hours, untimed
  await s.block(multi.id, '2026-09-16', joT.id, '16:00', '17:00');                            // its second block: 1 hour
  await s.block(multi.id, '2026-09-15', joT.id, '', '', 3);                                   // an untimed later block: its planned time is already on the first
  await s.job({ date: '2026-09-16', mechanic: joT.id, start: '09:00', end: '13:00', state: 'cancelled' }); // left out
  await s.job({ date: '2026-09-15', mechanic: joT.id, start: '14:00', end: '18:00', state: 'declined' }); // left out
  await s.job({ date: '2026-09-16', mechanic: joT.id, start: '13:00', end: '16:00', state: 'expired' });  // left out
  await s.job({ date: '2026-09-18', mechanic: joT.id, start: '09:00', end: '13:00' });        // Friday: not reached
  // Sam Lee works Thursdays but is away all but 20 minutes of it: under half an hour in is no set hours.
  const samL = await s.mechanic('Sam Lee', [4]);
  await s.away(samL.id, '2026-09-17', '09:20', '18:00');
  await s.job({ date: '2026-09-17', mechanic: samL.id, start: '09:00', end: '11:00' });
  // Alex Morgan has no working days: no set hours.
  const alex = await s.mechanic('Alex Morgan', []);
  await s.job({ date: '2026-09-14', mechanic: alex.id, start: '10:00', end: '11:00' });
  // The shared queue: a job with no mechanic.
  await s.job({ date: '2026-09-15', start: '10:00', end: '13:00' });

  // Another shop, on the same days.
  const t = seeder(other);
  const theirMechanic = await t.mechanic('Sam Other', [1, 2, 3, 4, 5]);
  const theirs = await t.job({ mechanic: theirMechanic.id, start: '09:00', end: '17:00', bookedIn: '2026-09-14T08:00:00Z', signedOff: '2026-09-15T08:00:00Z' });
  await t.sale({ at: '2026-09-15T10:00:00Z', labour: 777, jobId: theirs.id });
  await t.quote(theirs.id, 'approved', '2026-09-15T10:00:00Z');
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('the jobs figures count by booked in, the latest sign-off and collected, on the shop\'s day', async () => {
  const res = await workshop('period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { figures, period } = res.body;
  assert.equal(period.label, 'So far: Mon 14 – Thu 17 September');
  assert.equal(period.against, 'the same days last week');
  assert.deepEqual(figures.bookedIn, { count: 4, beforeCount: 1, diff: 3 });
  assert.deepEqual(figures.finished, { count: 3, beforeCount: 1, diff: 2 });
  assert.deepEqual(figures.collected, { count: 1, beforeCount: 1, diff: 0 });
  // A and B took 2 days each; F has no booking-in time. Last week D took 1.
  assert.deepEqual(figures.bookedInToReady, { days: 2, beforeDays: 1, diff: 1 });
});

test('jobs finished by day: one bar each day, the job reopened counted once on its latest day', async () => {
  const { rows } = (await workshop('period=this-week')).body;
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.deepEqual(rows.map((r) => r.key), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
  assert.deepEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map((k) => by[k].finished), [0, 1, 1, 1]);
  assert.equal(by['2026-09-18'].finished, null);
  assert.equal(by['2026-09-18'].notReached, true);
  assert.equal(by['2026-09-16'].beforeFinished, 1, 'Wednesday 9th');
  assert.equal(rows.reduce((n, r) => n + (r.finished ?? 0), 0), 3);
});

test('Last 12 months counts jobs finished by month, and Today by hour in the shop\'s time', async () => {
  const year = (await workshop('period=last-12-months')).body;
  const sep = year.rows.find((r) => r.key === '2026-09');
  assert.equal(sep.finished, 5, 'A, B and F this week; D and Friday 11th last week');
  assert.equal(year.rows.filter((r) => r.key !== '2026-09').reduce((n, r) => n + (r.finished ?? 0), 0), 0);
  const today = (await workshop('period=today')).body;
  // B was signed off at 08:00 UTC on Thursday: 09:00 in the shop.
  assert.deepEqual(today.rows.filter((r) => r.finished).map((r) => [r.key, r.finished]), [[9, 1]]);
});

test('workshop takings split labour and parts, a discount shared in proportion, adding up to the total', async () => {
  const { takings } = (await workshop('period=this-week')).body;
  assert.deepEqual(takings.labour, { pence: 5400 + 967, beforePence: 2500 });
  assert.deepEqual(takings.parts, { pence: 3600 + 1933, beforePence: 0 });
  assert.deepEqual(takings.total, { pence: 9000 + 2900, beforePence: 2500 });
});

test('quotes sent in the period, by how they stand: partly approved is Approved, expired is No answer', async () => {
  const { quotes } = (await workshop('period=this-week')).body;
  assert.deepEqual(quotes.approved, { count: 2, beforeCount: 1 });
  assert.deepEqual(quotes.declined, { count: 1, beforeCount: 0 });
  assert.deepEqual(quotes.noAnswer, { count: 2, beforeCount: 0 });
});

test('how full: diary hours against working days and the workshop\'s hours, less time away', async () => {
  const { mechanics, sharedQueue } = (await workshop('period=this-week')).body;
  const by = Object.fromEntries(mechanics.map((m) => [m.name, m]));
  assert.deepEqual(Object.keys(by).sort(), ['Alex Morgan', 'Jo Taylor', 'Sam Lee'], 'only this shop\'s mechanics');
  // 3 + 2 + 2 untimed + 1 block = 8 of 23 hours: 35% full. The cancelled and Friday jobs don't count.
  assert.deepEqual({ ...by['Jo Taylor'], id: undefined }, { id: undefined, name: 'Jo Taylor', bookedHours: 8, availableHours: 23, percent: 35, noSetHours: false });
  assert.deepEqual({ ...by['Alex Morgan'], id: undefined }, { id: undefined, name: 'Alex Morgan', bookedHours: 1, availableHours: 0, percent: null, noSetHours: true });
  assert.deepEqual({ ...by['Sam Lee'], id: undefined }, { id: undefined, name: 'Sam Lee', bookedHours: 2, availableHours: 0, percent: null, noSetHours: true });
  assert.deepEqual(sharedQueue, { bookedHours: 3 });
});

test('the period\'s spreadsheet is its three tables, each under its title', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/workshop.csv?period=this-week`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="workshop-[a-z0-9-]+-2026-09-14-to-2026-09-17\.csv"/);
  const lines = (await res.text()).replace(/^﻿/, '').split('\r\n').slice(0, -1);
  assert.deepEqual(lines, [
    'Workshop takings',
    'Money,This week so far,Same days last week',
    'Labour,63.67,25.00',
    'Parts,55.33,0.00',
    'Total,119.00,25.00',
    '',
    'Quotes',
    'Quote,This week so far,Same days last week',
    'Approved,2,1',
    'Declined,1,0',
    'No answer,2,0',
    '',
    'How full each mechanic was',
    'Mechanic,Hours booked,Hours they are in,Full',
    'Alex Morgan,1,no set hours,—',
    'Jo Taylor,8,23,35%',
    'Sam Lee,2,no set hours,—',
    'Shared queue,3,no set hours,—',
  ]);
});

test('Pick dates is checked as Sales is', async () => {
  const wrong = await workshop('period=dates&from=2026-09-10&to=2026-09-07');
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /To is before From/);
});

test('another shop\'s jobs never count', async () => {
  const res = await workshop('period=this-week', other);
  assert.equal(res.body.figures.bookedIn.count, 1);
  assert.equal(res.body.takings.labour.pence, 77700);
  assert.equal(res.body.quotes.approved.count, 1);
  assert.deepEqual(res.body.mechanics.map((m) => m.name), ['Sam Other']);
});

test('Staff are refused, and signed out is 401', async () => {
  for (const path of ['/api/reports/workshop?period=this-week', '/api/reports/workshop.csv?period=this-week']) {
    const staff = await as(jo)(path);
    assert.equal(staff.status, 403, path);
    assert.equal(staff.body.error, "Only the shop's owner can see reports");
    const out = await staffRequest(server.baseUrl, null, path);
    assert.equal(out.status, 401, path);
  }
});
