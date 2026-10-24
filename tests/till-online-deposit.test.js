// A deposit paid online comes off at the till (Jack, 29 Sep, selling at the
// till decision 11; drawn as till-job-balance; openspec/changes/till-online-deposit):
// what's due says the deposit and what's left, the sale records it as its own
// payment for the amount the server holds, and once the job is paid the
// deposit can't be refunded from the job (Jack, 24 Oct,
// docs/decisions/2026-10-24-deposit-after-paid.md).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let maya;
let alex;
let jo;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Deposit Till Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  jo = await inShop(async () => (await prepare("INSERT INTO employees (name, is_mechanic, is_cashier) VALUES ('Jo Taylor', 0, 1) RETURNING id").get()).id);
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
function inShop(fn) {
  return runWithShop(owner.shop.id, fn);
}
let jobDay = 5;
let key = 0;
// Maya's finished job with one line, and a deposit in the given state.
async function jobWithDeposit({ price = 65, deposit = 1300, status = 'taken', noShow = false } = {}) {
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id, mechanicId: alex } })).body;
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: price }] } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  for (const step of ['book-in', 'start', 'finish']) {
    const r = await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: step === 'finish' ? { version: job.version, signedOffBy: alex } : { version: job.version } });
    assert.equal(r.status, 200, `${step}: ${JSON.stringify(r.body)}`);
    job = r.body;
  }
  if (deposit) {
    await inShop(async () => {
      await prepare('UPDATE workshop_jobs SET deposit_pence = ? WHERE id = ?').run(deposit, job.id);
      await prepare("INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, job_id) VALUES ('pretend', ?, ?, ?, ?, ?)")
        .run(`ref-${++key}`, deposit, status, `key-${key}`, job.id);
      if (noShow) await prepare('UPDATE workshop_jobs SET no_show_at = now() WHERE id = ?').run(job.id);
    });
  }
  return job;
}
const due = async (job) => (await staff(`/api/sale-documents/${job.orderId}/due`)).body;
const convert = (job, body) => staff(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cashAmount: 0, cashTendered: null, cashierId: jo, sellPastStock: true, signedOffBy: null, ...body } });
const salePayments = (saleId) => inShop(() => prepare('SELECT tender_type, amount::float AS amount FROM sale_payments WHERE sale_id = ? ORDER BY id').all(saleId));

test('what’s due says the deposit paid online and what’s left to pay', async () => {
  const d = await due(await jobWithDeposit());
  assert.equal(d.totalPence, 6500);
  assert.equal(d.depositUsedPence, 1300);
  assert.equal(d.leftToPayPence, 5200);
  assert.equal(d.leftToPay, 52);
  assert.ok(d.depositPaidAt, 'when it was paid');
});

test('a deposit refunded, only held, or kept after Didn’t come doesn’t come off', async () => {
  for (const over of [{ status: 'refunded' }, { status: 'held' }, { noShow: true }, { deposit: 0 }]) {
    const d = await due(await jobWithDeposit(over));
    assert.equal(d.depositUsedPence, 0, JSON.stringify(over));
    assert.equal(d.leftToPayPence, 6500, JSON.stringify(over));
  }
});

test('paying records Deposit paid online for the server’s amount, and the rest by card', async () => {
  const job = await jobWithDeposit();
  const res = await convert(job, { cardAmount: 52 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await salePayments(res.body.id), [{ tender_type: 'Deposit paid online', amount: 13 }]);
  const sale = await inShop(() => prepare('SELECT total::float AS total, card_amount::float AS card FROM sales WHERE id = ?').get(res.body.id));
  assert.deepEqual({ ...sale }, { total: 65, card: 52 });
});

test('a deposit the till claims is ignored: only the server’s counts', async () => {
  const job = await jobWithDeposit({ deposit: 0 });
  const res = await convert(job, { cardAmount: 0, payments: [{ tenderType: 'Deposit paid online', amount: 65 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, 'Payment amounts must add up to the total');
});

test('a deposit larger than the bill counts up to the bill, and nothing is left to pay', async () => {
  const job = await jobWithDeposit({ price: 10, deposit: 1300 });
  const d = await due(job);
  assert.equal(d.depositUsedPence, 1000);
  assert.equal(d.leftToPayPence, 0);
  const res = await convert(job, { cardAmount: 0 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await salePayments(res.body.id), [{ tender_type: 'Deposit paid online', amount: 10 }]);
});

test('once the job is paid, its deposit can’t be refunded from the job', async () => {
  const job = await jobWithDeposit();
  assert.equal((await convert(job, { cardAmount: 52 })).status, 201);
  const res = await staff(`/api/workshop-jobs/${job.id}/deposit-refund`, { method: 'POST', body: { reason: 'Goodwill' } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, 'This deposit paid part of the bill at the till, so it can’t be refunded from the job.');
  const pay = await inShop(() => prepare('SELECT status FROM online_payments WHERE job_id = ?').get(job.id));
  assert.equal(pay.status, 'taken');
});

test('a deposit only held when the job is paid in full is let go, so it’s never charged on top (review)', async () => {
  const job = await jobWithDeposit({ status: 'held' });
  const res = await convert(job, { cardAmount: 65 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const pay = await inShop(() => prepare('SELECT status, refund_due_reason FROM online_payments WHERE job_id = ?').get(job.id));
  assert.equal(pay.refund_due_reason, 'Paid in full at the till');
});

test('a refund and a till payment at the same moment: never both (review)', async () => {
  const job = await jobWithDeposit();
  const [paid, refund] = await Promise.all([
    convert(job, { cardAmount: 52 }),
    staff(`/api/workshop-jobs/${job.id}/deposit-refund`, { method: 'POST', body: { reason: 'Goodwill' } }),
  ]);
  const pay = await inShop(() => prepare('SELECT refund_due_reason FROM online_payments WHERE job_id = ?').get(job.id));
  const counted = paid.status === 201 ? (await salePayments(paid.body.id)).some((p) => p.tender_type === 'Deposit paid online') : false;
  assert.ok(!(counted && pay.refund_due_reason), `counted and refunded: sale ${paid.status}, refund ${refund.status}`);
});

