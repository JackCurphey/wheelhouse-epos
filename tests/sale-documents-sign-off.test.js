// The mechanic sign-off, piece 2 (Jack, 16 Oct, answer 5,
// docs/decisions/2026-10-16-mechanic-sign-off.md; openspec/changes/sign-off-at-till):
// paying a job's order that finishes its work records the sign-off sent with
// it. The card is taken before this call, so the payment is never refused
// over the sign-off: an invalid one finishes the work unsigned, with a warning.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function jobInProgress() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  const alex = await seedMechanic(shop.id, { name: 'Alex Morgan' });
  const cashier = await runWithShop(shop.id, async () => (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Jo Taylor', 1, 1)").run()).lastInsertRowid);
  let job = (await req('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex } })).body;
  for (const step of ['book-in', 'start']) job = (await req(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const items = await req(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  const pay = (extra = {}) => req(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 65, cashierId: cashier, ...extra } });
  return { shop, req, alex, job, pay };
}
const history = (shopId, jobId) => runWithShop(shopId, () => prepare('SELECT employee_name, cleared_at FROM workshop_job_sign_offs WHERE workshop_job_id = ?').all(jobId));

test('paying for work in progress with a sign-off finishes it, signed', async () => {
  const { shop, req, alex, job, pay } = await jobInProgress();
  try {
    const paid = await pay({ signedOffBy: alex });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    assert.equal(paid.body.jobWarning, undefined);
    const now = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.deepEqual([now.workState, now.signedOffBy, now.signedOffByName], ['complete', alex, 'Alex Morgan']);
    assert.deepEqual(await history(shop.id, job.id), [{ employee_name: 'Alex Morgan', cleared_at: null }]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a sign-off that is no longer valid never refuses the payment: finished unsigned, with a warning', async () => {
  const { shop, req, alex, job, pay } = await jobInProgress();
  try {
    await runWithShop(shop.id, () => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(alex));
    const paid = await pay({ signedOffBy: alex });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    assert.match(paid.body.jobWarning, /^Paid and finished, but not signed off: .+\.$/);
    assert.equal(/Check the job/.test(paid.body.jobWarning), false, 'Paid adds its own check-the-job words');
    const now = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.deepEqual([now.workState, now.signedOffBy], ['complete', null]);
    assert.deepEqual(await history(shop.id, job.id), []);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// The old app never takes payment for a workshop job (Jack, 21 Oct,
// docs/decisions/2026-10-21-old-app-placeholder.md): a job's payment that
// doesn't answer the sign-off question (only the old app sends none) is
// refused, nothing is sold, and the job stays as it was.
test('a job’s payment with no sign-off answer is refused: take it at the till', async () => {
  const { shop, req, job, pay } = await jobInProgress();
  try {
    const paid = await pay();
    assert.equal(paid.status, 400, JSON.stringify(paid.body));
    assert.equal(paid.body.code, 'use_till');
    assert.match(paid.body.error, /Take payment for a workshop job at the till/);
    const now = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(now.workState, 'in_progress');
    const order = (await req(`/api/sale-documents/${job.orderId}`)).body;
    assert.equal(order.status, 'open', 'nothing sold');
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Fresh review, 21 Oct: Jack's words are about a finished job, which the
// route reaches by its own path; the refusal covers it too.
test('a finished job’s payment with no sign-off answer is refused too', async () => {
  const { shop, req, alex, job, pay } = await jobInProgress();
  try {
    const done = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const paid = await pay();
    assert.equal(paid.status, 400, JSON.stringify(paid.body));
    assert.equal(paid.body.code, 'use_till');
    assert.equal((await req(`/api/sale-documents/${job.orderId}`)).body.status, 'open');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an order with no workshop job still converts with no sign-off answer', async () => {
  const { shop, req } = await jobInProgress();
  try {
    const product = (await req('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: `TUBE-${shop.id}`, stockQty: 5 } })).body;
    const order = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ productId: product.id, qty: 1, unitPrice: 5 }] } })).body;
    const cashier = (await req('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${shop.id}-${Date.now()}@example.test`, password: 'password123' } })).body.employeeId;
    const paid = await req(`/api/sale-documents/${order.id}/convert`, { method: 'POST', body: { cashAmount: 5, cashTendered: 5, cashierId: cashier } });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('paying for work already signed off keeps that sign-off', async () => {
  const { shop, req, alex, job, pay } = await jobInProgress();
  try {
    const jo = await seedMechanic(shop.id, { name: 'Jo Taylor' });
    const done = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const paid = await pay({ signedOffBy: jo });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    const now = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(now.signedOffByName, 'Alex Morgan');
    assert.equal((await history(shop.id, job.id)).length, 1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Fresh review: the till sends signedOffBy: null when it didn't ask (the work
// read as finished). If the work was reopened meanwhile, paying finishes it
// unsigned, and the reply says so. A payment with no key at all is refused.
test('a till that saw finished work, reopened since, gets a warning that nobody signed it off', async () => {
  const { shop, req, job, pay } = await jobInProgress();
  try {
    const paid = await pay({ signedOffBy: null });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    assert.equal(paid.body.jobWarning, 'Paid and finished, but not signed off: the work was reopened while the till was open.');
    assert.equal((await req(`/api/workshop-jobs/${job.id}`)).body.signedOffBy, null);
  } finally {
    await deleteTestShop(shop.id);
  }
});
