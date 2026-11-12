// Change what's shown on Workshop (openspec/changes/reports-your-own, design 2 and 3; tasks group 4):
// Jobs (finished, as the Workshop report counts them) and Hours (diary time, as "how full each mechanic
// was" counts it) by Day, Week, Staff member and Service; Only lists the workshop's service categories
// and there is no Supplier; the sales measures are greyed. The clock is pinned to Thursday
// 17 September 2026, so "this week" is Mon 14 to Thu 17 so far, against Mon 7 to Thu 10.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const changed = (query) => as(owner)(`/api/reports/changed?base=workshop&period=this-week&${query}`);
const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));
const SALES_ONLY = 'sales only — choose it from the Sales report';

async function seed(shop) {
  const one = (sql, ...args) => runWithShop(shop.shop.id, () => prepare(sql).get(...args));
  const servicing = await one("INSERT INTO workshop_service_categories (name) VALUES ('Servicing') RETURNING id");
  const repairs = await one("INSERT INTO workshop_service_categories (name) VALUES ('Repairs') RETURNING id");
  const service = (name, cat) => one('INSERT INTO workshop_services (name, price, price_pence, category_id) VALUES (?, 10, 1000, ?) RETURNING id', name, cat.id);
  const full = await service('Full service', servicing);
  const basic = await service('Basic service', servicing);
  const puncture = await service('Puncture', repairs);
  const mechanic = (name) => one("INSERT INTO employees (name, is_mechanic, working_days) VALUES (?, 1, '[0,1,2,3,4,5,6]') RETURNING id", name);
  const mia = await mechanic('Mia');
  const noah = await mechanic('Noah');
  // A job's own date, times and mechanic are its first block (the database makes that block); more blocks follow it.
  const job = async ({ mech = null, signedOff = null, state = 'scheduled', services = [], parts = [] }) => {
    const [date = '2026-09-14', , start = '', end = ''] = parts[0] ?? [];
    const j = await one(
      "INSERT INTO workshop_jobs (title, job_date, start_time, end_time, mechanic_id, booking_state, signed_off_at) VALUES ('Service', ?, ?, ?, ?, ?, ?) RETURNING id",
      date, start, end, mech, state, signedOff
    );
    let position = 0;
    for (const sv of services) await one('INSERT INTO workshop_job_services (workshop_job_id, service_id, position) VALUES (?, ?, ?) RETURNING id', j.id, sv.id, ++position);
    position = 1;
    for (const [pdate, who, pstart, pend] of parts.slice(1)) {
      await one('INSERT INTO workshop_job_parts (workshop_job_id, part_date, mechanic_id, start_time, end_time, position) VALUES (?, ?, ?, ?, ?, ?) RETURNING id', j.id, pdate, who, pstart, pend, ++position);
    }
    return j;
  };
  return { full, basic, puncture, mia, noah, job };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });

  const s = await seed(owner);
  // Finished this week. J1: Mia, a full service and a puncture, 2 hours on Tuesday and 1 on Wednesday.
  await s.job({ mech: s.mia.id, signedOff: '2026-09-15T10:00:00Z', services: [s.full, s.puncture], parts: [['2026-09-15', s.mia.id, '09:00', '11:00'], ['2026-09-16', s.mia.id, '09:00', '10:00']] });
  // J2: Noah, a basic service, 1.5 hours on Wednesday.
  await s.job({ mech: s.noah.id, signedOff: '2026-09-16T10:00:00Z', services: [s.basic], parts: [['2026-09-16', s.noah.id, '10:00', '11:30']] });
  // J3: nobody's (the shared queue), no service kept, an hour on Thursday.
  await s.job({ signedOff: '2026-09-17T09:00:00Z', parts: [['2026-09-17', null, '14:00', '15:00']] });
  // A cancelled booking's five hours are left out of Hours, as the Workshop report leaves them out.
  await s.job({ mech: s.mia.id, state: 'cancelled', parts: [['2026-09-15', s.mia.id, '09:00', '14:00']] });
  // Last week, Wednesday 9th: finished, with an hour of Mia's time.
  await s.job({ mech: s.mia.id, signedOff: '2026-09-09T09:00:00Z', services: [s.puncture], parts: [['2026-09-09', s.mia.id, '09:00', '10:00']] });
  // Another shop's job this week, which must never count.
  const t = await seed(other);
  await t.job({ mech: t.mia.id, signedOff: '2026-09-15T10:00:00Z', services: [t.full], parts: [['2026-09-15', t.mia.id, '09:00', '17:00']] });
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('Workshop opens on Jobs by Day, and the title and line say it was changed from Workshop', async () => {
  const res = await as(owner)('/api/reports/changed?base=workshop&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.measure, res.body.split], ['jobs', 'day']);
  assert.equal(res.body.title, 'Workshop: jobs by day');
  assert.equal(res.body.line, 'Changed from Workshop · So far: Mon 14 – Thu 17 September, against the same days last week');
});

test('Jobs by Day counts jobs finished on each day, as the Workshop report does', async () => {
  const res = await changed('measure=jobs&split=day');
  const by = Object.fromEntries(res.body.rows.map((r) => [r.key, r]));
  assert.deepEqual([by['2026-09-15'].value, by['2026-09-16'].value, by['2026-09-17'].value, by['2026-09-14'].value], [1, 1, 1, 0]);
  assert.equal(by['2026-09-18'].notReached, true);
  assert.equal(res.body.total.value, 3);
  assert.deepEqual(res.body.columns, ['Day', 'Jobs']);
  assert.equal(res.body.figures.beforeValue, 1, 'last week\'s finished job');
  const workshop = (await as(owner)('/api/reports/workshop?period=this-week')).body;
  assert.equal(res.body.total.value, workshop.figures.finished.count, 'adds up to the Workshop report');
});

test('Jobs by Staff member names the job\'s mechanic, and the shared queue', async () => {
  const res = await changed('measure=jobs&split=staff');
  assert.deepEqual(res.body.rows.map((r) => [r.label, r.value]).sort(), [['Mia', 1], ['Noah', 1], ['Shared queue', 1]]);
  assert.equal(byLabel(res.body.rows).Mia.beforeValue, 1);
});

test('Jobs by Service counts a job under each of its services, and the total counts each job once', async () => {
  const res = await changed('measure=jobs&split=service');
  assert.deepEqual(res.body.rows.map((r) => [r.label, r.value]).sort(), [['Basic service', 1], ['Full service', 1], ['No service', 1], ['Puncture', 1]]);
  assert.equal(res.body.total.value, 3);
  assert.equal(res.body.title, 'Workshop: jobs by service');
});

test('Only lists the service categories, limits the jobs to those with a service in one, and there is no Supplier', async () => {
  const res = await changed('measure=jobs&split=service&only=Repairs');
  assert.deepEqual(res.body.choices.only.map((c) => c.value), ['Repairs', 'Servicing']);
  assert.deepEqual(res.body.choices.suppliers, []);
  assert.deepEqual(res.body.rows.map((r) => [r.label, r.value]), [['Puncture', 1]]);
  assert.equal(res.body.total.value, 1);
  assert.equal(res.body.total.label, 'Total, Repairs only');
  assert.equal(res.body.line, 'Changed from Workshop · Repairs only · So far: Mon 14 – Thu 17 September, against the same days last week');
  const byDay = await changed('measure=jobs&split=day&only=Servicing');
  assert.equal(byDay.body.total.value, 2, 'J1 and J2 have a servicing service');
  assert.equal((await changed('measure=jobs&split=day&supplier=Acme')).body.line.includes('Acme'), false, 'a supplier means nothing to the workshop');
});

test('Hours by Day is the diary time of the period\'s days, leaving cancelled bookings out', async () => {
  const res = await changed('measure=hours&split=day');
  const by = Object.fromEntries(res.body.rows.map((r) => [r.key, r.value]));
  assert.deepEqual([by['2026-09-15'], by['2026-09-16'], by['2026-09-17']], [2, 2.5, 1]);
  assert.equal(res.body.total.value, 5.5);
  assert.equal(res.body.figures.beforeValue, 1);
  assert.deepEqual(res.body.columns, ['Day', 'Hours']);
});

test('Hours by Staff member and by Service', async () => {
  const staff = await changed('measure=hours&split=staff');
  assert.deepEqual(staff.body.rows.map((r) => [r.label, r.value]).sort(), [['Mia', 3], ['Noah', 1.5], ['Shared queue', 1]]);
  const service = await changed('measure=hours&split=service');
  assert.deepEqual(service.body.rows.map((r) => [r.label, r.value]).sort(), [['Basic service', 1.5], ['Full service', 1.5], ['No service', 1], ['Puncture', 1.5]]);
  assert.equal(service.body.total.value, 5.5, 'a job\'s hours are shared between its services, so they add up');
  const only = await changed('measure=hours&split=service&only=Repairs');
  assert.deepEqual(only.body.rows.map((r) => [r.label, r.value]), [['Puncture', 3]]);
});

test('Week groups the days into weeks from Monday', async () => {
  const res = await as(owner)('/api/reports/changed?base=workshop&measure=jobs&split=week&period=last-12-months');
  const by = Object.fromEntries(res.body.rows.map((r) => [r.key, r.value]));
  assert.deepEqual([by['2026-09-14'], by['2026-09-07']], [3, 1]);
});

test('from Workshop the sales measures are greyed with their reason, and there is a Service split', async () => {
  const { choices } = (await changed('')).body;
  const why = (group, value) => group.find((c) => c.value === value)?.why;
  for (const m of ['takings', 'items', 'margin']) assert.equal(why(choices.measure, m), SALES_ONLY, m);
  assert.equal(why(choices.measure, 'jobs'), undefined);
  assert.equal(why(choices.measure, 'hours'), undefined);
  assert.equal(why(choices.split, 'category'), 'jobs aren’t split by product');
  assert.equal(why(choices.split, 'product'), 'jobs aren’t split by product');
  assert.equal(why(choices.split, 'payment'), SALES_ONLY);
  assert.equal(why(choices.split, 'service'), undefined);
  assert.ok(choices.split.some((c) => c.value === 'service'));
  const sales = (await as(owner)('/api/reports/changed?base=sales&period=this-week')).body.choices;
  assert.ok(!sales.split.some((c) => c.value === 'service'), 'Service is for Workshop');
});

test('what does not fit is refused, in both directions', async () => {
  for (const [query, reason] of [['measure=items', SALES_ONLY], ['measure=takings', SALES_ONLY], ['split=payment', SALES_ONLY], ['split=product', 'jobs aren’t split by product']]) {
    const res = await changed(query);
    assert.equal(res.status, 400, query);
    assert.equal(res.body.error, reason, query);
  }
  const fromSales = await as(owner)('/api/reports/changed?base=sales&measure=takings&split=service&period=this-week');
  assert.deepEqual([fromSales.status, fromSales.body.error], [400, 'workshop only']);
  const choices = await as(owner)('/api/reports/changed/choices?base=workshop&measure=items&period=this-week');
  assert.equal(choices.body.selection.measure, 'jobs', 'a measure that does not fit moves to Jobs');
});

test('the download is the table as shown, and another shop\'s jobs never count', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/changed.csv?base=workshop&measure=hours&split=staff&period=this-week`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="workshop-changed-.+-2026-09-14-to-2026-09-17\.csv"$/);
  const lines = new TextDecoder().decode((await res.arrayBuffer()).slice(3)).trim().split(/\r?\n/);
  assert.equal(lines[0], 'Staff member,Hours');
  assert.ok(lines.includes('Mia,3'));
  assert.equal(lines.at(-1), 'Total,5.5', 'the other shop\'s eight hours are not in it');
});

test('a Workshop report can be saved, and the sales measures can not', async () => {
  const ok = await as(owner)('/api/reports/saved', { method: 'POST', body: { name: 'Jobs by service', base: 'workshop', measure: 'jobs', split: 'service', only: ['Repairs'], supplier: '', period: 'this-week', shared: false } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.what, 'Workshop: jobs by service · Repairs only');
  const bad = await as(owner)('/api/reports/saved', { method: 'POST', body: { name: 'Bad', base: 'workshop', measure: 'items', split: 'day', only: [], supplier: '', period: 'this-week', shared: false } });
  assert.deepEqual([bad.status, bad.body.error], [400, SALES_ONLY]);
});

test('Workshop compares with the period before from the workshop\'s own history, not the first sale', async () => {
  const res = await changed('measure=jobs&split=day');
  assert.equal(res.body.nothingBefore, false, 'this shop has jobs last week, and no sales at all');
  assert.equal(res.body.showBefore, true);
  assert.equal(res.body.figures.diffValue, 2);
});

test('a saved report can only be one the panel could show: no Service on Sales, no supplier on Workshop', async () => {
  const sales = await as(owner)('/api/reports/saved', { method: 'POST', body: { name: 'Odd', base: 'sales', measure: 'takings', split: 'service', only: [], supplier: '', period: 'this-week', shared: false } });
  assert.deepEqual([sales.status, sales.body.error], [400, 'workshop only']);
  const supplier = await as(owner)('/api/reports/saved', { method: 'POST', body: { name: 'With supplier', base: 'workshop', measure: 'jobs', split: 'day', only: [], supplier: 'Shimano', period: 'this-week', shared: false } });
  assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
  assert.equal(supplier.body.supplier, '');
  assert.equal(supplier.body.what, 'Workshop: jobs by day');
});

test('the choices never leave a split that has no chip: Service on Sales moves to one that fits', async () => {
  const res = await as(owner)('/api/reports/changed/choices?base=sales&split=service&period=this-week');
  assert.notEqual(res.body.selection.split, 'service');
});
