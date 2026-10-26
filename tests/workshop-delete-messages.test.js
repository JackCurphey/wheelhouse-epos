// Deleting a job (#265) and what the audit found it missed
// (docs/reviews/2026-10-22-flagged-merges-audit.md, P3 items 11 and 14;
// openspec/changes/delete-job-messages): a deleted job's messages still
// waiting to go are stopped in the delete's transaction, and a quote answered
// while the job is deleted waits its turn instead of deadlocking.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let alex;
before(async () => {
  // The timer kept from claiming the test's due message before the delete.
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '3600000' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const admin = async () => {
  const client = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL.replace(/\/[^/]*$/, new URL(process.env.DATABASE_URL).pathname) });
  await client.connect();
  return client;
};
const message = (id) => inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(id));
// A message for the job written straight in, in the given state and due at the
// given time, beside the one the engine queued.
const addMessage = (customerId, jobId, intentState, sendAfter) => inShop(async () => (await prepare(
  `INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, template_key, to_address, send_after)
   VALUES (?, ?, 'Your quote is ready', ?, ?, 'sms', 'quote_to_approve', '07700 900142', ?) RETURNING id`
).get(customerId, jobId, intentState === 'delivered' ? 'sent' : 'queued', intentState, sendAfter)).id);

// Maya Patel's Trek Domane AL 3 (the drawings' example).
async function mayasJob() {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id } })).body;
  assert.ok(job.id, JSON.stringify(job));
  return { customer, job };
}
const step = async (job, name, body = {}) => {
  const res = await staff(`/api/workshop-jobs/${job.id}/${name}`, { method: 'POST', body: { version: job.version, ...body } });
  assert.equal(res.status, 200, `${name}: ${JSON.stringify(res.body)}`);
  return res.body;
};

test('deleting a job stops its messages still waiting to go, and leaves a sent one as it was', async () => {
  const { customer, job: made } = await mayasJob();
  let job = made;
  for (const name of ['book-in', 'start']) job = await step(job, name);
  const finished = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
  assert.equal(finished.status, 200, JSON.stringify(finished.body));
  const ready = finished.body.readyMessage;
  assert.ok(ready?.id, `setup: Bike ready queued, ${JSON.stringify(finished.body)}`);
  job = await step(finished.body, 'collect');
  // Its minute is up but the timer hasn't claimed it yet.
  const due = await addMessage(customer.id, job.id, 'intended', new Date(Date.now() - 1000).toISOString());
  const sent = await addMessage(customer.id, job.id, 'delivered', new Date(Date.now() - 60_000).toISOString());

  const del = await staff(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200, JSON.stringify(del.body));

  for (const [name, id] of [['Bike ready in its minute', ready.id], ['the message whose minute is up', due]]) {
    const row = await message(id);
    assert.deepEqual([row.intent_state, row.status], ['undone', 'undone'], `${name} is stopped`);
  }
  const kept = await message(sent);
  assert.deepEqual([kept.intent_state, kept.status], ['delivered', 'sent'], 'the sent message is left as it was');
});

test('a refused delete stops nothing', async () => {
  const { customer, job: made } = await mayasJob();
  const job = await step(made, 'book-in');
  const waiting = await addMessage(customer.id, job.id, 'intended', new Date(Date.now() + 60_000).toISOString());
  const del = await staff(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
  assert.equal(del.status, 409, JSON.stringify(del.body));
  assert.equal(del.body.code, 'settle_first');
  assert.equal((await message(waiting)).intent_state, 'intended');
});

test('a quote answered while its job is deleted waits its turn: neither gets a server error', async () => {
  const { job } = await mayasJob();
  assert.ok(job.orderId, `setup: the job has an order, ${JSON.stringify(job)}`);
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, {
    method: 'POST',
    body: { lines: [{ kind: 'labour', description: 'Fit new gear cable', unitAmount: 12, need: 'optional', reason: 'Shifting is stiff' }] },
  });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  const sentQuote = await staff(`/api/quotes/${quote.body.id}/send`, { method: 'POST', body: {} });
  assert.equal(sentQuote.status, 200, JSON.stringify(sentQuote.body));
  const [line] = await inShop(() => prepare('SELECT id FROM workshop_quote_lines WHERE workshop_quote_id = ?').all(quote.body.id));

  // Makes adding the approved line to the order slow, so the delete arrives
  // after the answer has recorded its lines and before it reaches the order.
  const db = await admin();
  const fn = `slow_quote_line_${owner.shop.id}`;
  await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.document_id = ${job.orderId} THEN PERFORM pg_sleep(1.5); END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON sale_document_items FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const answer = staff(`/api/quotes/${quote.body.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: [{ lineId: line.id, decision: 'approved' }] } });
    await new Promise((r) => setTimeout(r, 600));
    const del = staff(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
    const [answered, deleted] = await Promise.all([answer, del]);
    assert.equal(answered.status, 200, `the answer: ${JSON.stringify(answered.body)}`);
    assert.equal(deleted.status, 200, `the delete: ${JSON.stringify(deleted.body)}`);
    const items = await inShop(() => prepare('SELECT name FROM sale_document_items WHERE document_id = ?').all(job.orderId));
    assert.deepEqual(items.map((i) => i.name), ['Fit new gear cable'], 'the order keeps the approved line');
    const order = await inShop(() => prepare('SELECT workshop_job_id FROM sale_documents WHERE id = ?').get(job.orderId));
    assert.equal(order.workshop_job_id, null, 'the order is kept, unlinked');
  } finally {
    await db.query(`DROP TRIGGER ${fn} ON sale_document_items`);
    await db.query(`DROP FUNCTION ${fn}()`);
    await db.end();
  }
});

test('a quote answered while its job is being deleted is refused as not found once the delete is in', async () => {
  const { job } = await mayasJob();
  assert.ok(job.orderId, `setup: the job has an order, ${JSON.stringify(job)}`);
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, {
    method: 'POST',
    body: { lines: [{ kind: 'labour', description: 'Fit new gear cable', unitAmount: 12, need: 'optional', reason: 'Shifting is stiff' }] },
  });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  assert.equal((await staff(`/api/quotes/${quote.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const [line] = await inShop(() => prepare('SELECT id FROM workshop_quote_lines WHERE workshop_quote_id = ?').all(quote.body.id));

  // Makes the delete slow once it has locked the order and the job, so the
  // answer arrives while the delete is under way.
  const db = await admin();
  const fn = `slow_unlink_${owner.shop.id}`;
  await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = ${job.orderId} AND NEW.workshop_job_id IS NULL THEN PERFORM pg_sleep(1.5); END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER ${fn} BEFORE UPDATE ON sale_documents FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const del = staff(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
    await new Promise((r) => setTimeout(r, 600));
    const answer = staff(`/api/quotes/${quote.body.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: [{ lineId: line.id, decision: 'approved' }] } });
    const [deleted, answered] = await Promise.all([del, answer]);
    assert.equal(deleted.status, 200, `the delete: ${JSON.stringify(deleted.body)}`);
    assert.equal(answered.status, 404, `the answer: ${JSON.stringify(answered.body)}`);
    const items = await inShop(() => prepare('SELECT name FROM sale_document_items WHERE document_id = ?').all(job.orderId));
    assert.deepEqual(items, [], 'nothing was added to the order');
  } finally {
    await db.query(`DROP TRIGGER ${fn} ON sale_documents`);
    await db.query(`DROP FUNCTION ${fn}()`);
    await db.end();
  }
});
