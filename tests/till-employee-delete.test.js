// tests/till-employee-delete.test.js
// Permanently removing a team member who has used a till: their till sales
// stay (unassigned, like any other sale history) and their check-ins go.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §11
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server; let owner; let b1;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);

test('a team member with till sales and check-ins can be permanently deleted', async () => {
  const sam = await inShop(async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Sam', 1)").run()).lastInsertRowid);
  const tube = await seedProduct(owner.shop.id);
  const saleItem = {
    kind: 'sale', clientId: randomUUID(), receiptNumber: 1, tillClockAt: '2026-09-01T09:30:00.000Z',
    employeeId: sam, lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }],
    payments: [{ method: 'cash', amountPence: 699 }],
  };
  const checkin = { kind: 'checkin', clientId: randomUUID(), employeeId: sam, checkedInAt: '2026-09-01T08:55:00.000Z' };
  const synced = await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/sync', { method: 'POST', body: { items: [saleItem, checkin] } });
  assert.deepEqual(synced.body.results.map((r) => r.status), ['recorded', 'recorded']);

  const res = await staffRequest(server.baseUrl, owner.cookie, `/api/employees/${sam}/permanent`, { method: 'DELETE' });
  assert.equal(res.status, 200);

  const kept = await inShop(() => prepare('SELECT employee_id FROM till_sales WHERE client_id = ?').get(saleItem.clientId));
  assert.ok(kept, 'the till sale stays');
  assert.equal(kept.employee_id, null);
  assert.equal(await inShop(() => prepare('SELECT 1 FROM staff_checkins WHERE client_id = ?').get(checkin.clientId)), undefined);
  assert.equal(await inShop(() => prepare('SELECT 1 FROM employees WHERE id = ?').get(sam)), undefined);
});

// All or nothing: a mechanic still named on a workshop capacity hold cannot be
// deleted (that foreign key is not unassigned by this route - a separate,
// pre-existing question), and the failed delete must leave the till sale's
// employee and the check-in exactly as they were.
test('a permanent delete that fails leaves the check-ins and till sales untouched', async () => {
  const kim = await inShop(async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Kim', 1)").run()).lastInsertRowid);
  const tube = await seedProduct(owner.shop.id);
  const saleItem = {
    kind: 'sale', clientId: randomUUID(), receiptNumber: 2, tillClockAt: '2026-09-01T09:30:00.000Z',
    employeeId: kim, lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }],
    payments: [{ method: 'cash', amountPence: 699 }],
  };
  const checkin = { kind: 'checkin', clientId: randomUUID(), employeeId: kim, checkedInAt: '2026-09-01T08:55:00.000Z' };
  const synced = await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/sync', { method: 'POST', body: { items: [saleItem, checkin] } });
  assert.deepEqual(synced.body.results.map((r) => r.status), ['recorded', 'recorded']);
  await inShop(() => prepare(
    "INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes, state) VALUES ('2026-10-01', '10:00', ?, 60, 'confirmed')"
  ).run(kim));

  const res = await staffRequest(server.baseUrl, owner.cookie, `/api/employees/${kim}/permanent`, { method: 'DELETE' });
  assert.notEqual(res.status, 200, 'the delete cannot succeed while a hold names this mechanic');

  assert.ok(await inShop(() => prepare('SELECT 1 FROM employees WHERE id = ?').get(kim)), 'the employee is still there');
  assert.ok(await inShop(() => prepare('SELECT 1 FROM staff_checkins WHERE client_id = ?').get(checkin.clientId)), 'the check-in is still there');
  const kept = await inShop(() => prepare('SELECT employee_id FROM till_sales WHERE client_id = ?').get(saleItem.clientId));
  assert.equal(kept.employee_id, kim, 'the till sale still names the employee');
});
