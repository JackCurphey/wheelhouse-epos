// A Done tick and a staff note on each line of a job's work and parts (Jack,
// 24 Oct, docs/decisions/2026-10-24-line-notes.md; drawn as job-page.mjs's
// Done and Note columns; openspec/changes/line-done-notes). They live on the
// order's lines, kept when the lines are saved again, refused on finished
// work or a paid order, and never shown to the customer.
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
let pads;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Line Notes Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  pads = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO products (name, sku, price, stock_qty) VALUES ('Shimano brake pads', 'B05S-RX', 28, 5) RETURNING id"
  ).get()).id);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
let jobDay = 5;
// Maya's job with two lines on its order: labour, then the pads.
async function mayasJob() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id, mechanicId: alex } })).body;
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [
    { lineType: 'labour', name: 'Standard service', unitPrice: 65 },
    { productId: pads, qty: 1, unitPrice: 28 },
  ] } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  return { job, lines: put.body.items };
}
const progress = (orderId, itemId, body) => staff(`/api/sale-documents/${orderId}/items/${itemId}/progress`, { method: 'PUT', body });
const lineOf = async (orderId, name) => (await staff(`/api/sale-documents/${orderId}`)).body.items.find((l) => l.name === name);

test('a line is ticked done and unticked, and starts unticked with no note', async () => {
  const { job, lines } = await mayasJob();
  const padsLine = lines.find((l) => l.name === 'Shimano brake pads');
  assert.equal(padsLine.done, false);
  assert.equal(padsLine.note, null);
  const res = await progress(job.orderId, padsLine.id, { done: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await lineOf(job.orderId, 'Shimano brake pads')).done, true);
  assert.equal((await progress(job.orderId, padsLine.id, { done: false })).status, 200);
  assert.equal((await lineOf(job.orderId, 'Shimano brake pads')).done, false);
});

test('a note is saved trimmed, an empty one clears it, and 500 characters is the most', async () => {
  const { job, lines } = await mayasJob();
  const id = lines.find((l) => l.name === 'Shimano brake pads').id;
  assert.equal((await progress(job.orderId, id, { note: '  Rear pads worn — replacing  ' })).status, 200);
  assert.equal((await lineOf(job.orderId, 'Shimano brake pads')).note, 'Rear pads worn — replacing');
  assert.equal((await progress(job.orderId, id, { note: '   ' })).status, 200);
  assert.equal((await lineOf(job.orderId, 'Shimano brake pads')).note, null);
  const long = await progress(job.orderId, id, { note: 'x'.repeat(501) });
  assert.equal(long.status, 400);
});

test('changing the lines keeps each line’s tick and note, matched by its id', async () => {
  const { job, lines } = await mayasJob();
  const padsLine = lines.find((l) => l.name === 'Shimano brake pads');
  await progress(job.orderId, padsLine.id, { done: true, note: 'Rear pads worn — replacing' });
  const labour = lines.find((l) => l.name === 'Standard service');
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [
    { id: labour.id, lineType: 'labour', name: 'Standard service', unitPrice: 65 },
    { id: padsLine.id, productId: pads, qty: 2, unitPrice: 28 },
  ] } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const after = await lineOf(job.orderId, 'Shimano brake pads');
  assert.equal(after.qty, 2);
  assert.equal(after.done, true);
  assert.equal(after.note, 'Rear pads worn — replacing');
  assert.equal((await lineOf(job.orderId, 'Standard service')).done, false);
});

test('a line added without an id starts unticked, even beside ticked ones', async () => {
  const { job, lines } = await mayasJob();
  const padsLine = lines.find((l) => l.name === 'Shimano brake pads');
  await progress(job.orderId, padsLine.id, { done: true });
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [
    { productId: pads, qty: 1, unitPrice: 28 },
  ] } });
  assert.equal(put.status, 200);
  assert.equal(put.body.items[0].done, false);
});

test('finished work, a paid order, or another order’s line is refused, changing nothing', async () => {
  const { job, lines } = await mayasJob();
  const padsLine = lines.find((l) => l.name === 'Shimano brake pads');
  const other = await mayasJob();
  const elsewhere = await progress(job.orderId, other.lines[0].id, { done: true });
  assert.equal(elsewhere.status, 404);

  let j = job;
  for (const step of ['book-in', 'start']) j = (await staff(`/api/workshop-jobs/${j.id}/${step}`, { method: 'POST', body: { version: j.version } })).body;
  const fin = await staff(`/api/workshop-jobs/${j.id}/finish`, { method: 'POST', body: { version: j.version, signedOffBy: alex } });
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  const finished = await progress(job.orderId, padsLine.id, { done: true });
  assert.equal(finished.status, 409);
  assert.equal(finished.body.error, 'This work is finished, so its work and parts can’t change. Reopen the work first.');
  assert.equal((await lineOf(job.orderId, 'Shimano brake pads')).done, false);

  const paid = await mayasJob();
  await runWithShop(owner.shop.id, () => prepare("UPDATE sale_documents SET status = 'converted' WHERE id = ?").run(paid.job.orderId));
  const refused = await progress(paid.job.orderId, paid.lines[0].id, { done: true });
  assert.equal(refused.status, 409);
});

test('an approved quote line joins the work with its reason as the note', async () => {
  const { job } = await mayasJob();
  const q = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [
    { kind: 'labour', description: 'True the rear wheel', unitAmount: 15, need: 'needed', reason: 'Rear wheel rubs the pads' },
  ] } })).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  const quoteLines = (await staff(`/api/quotes/${q.id}`)).body.lines;
  const answered = await staff(`/api/quotes/${q.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: quoteLines.map((l) => ({ lineId: l.id, decision: 'approved' })) } });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal((await lineOf(job.orderId, 'True the rear wheel')).note, 'Rear wheel rubs the pads');
});

test('the note never reaches the customer’s booking page', async () => {
  const { job, lines } = await mayasJob();
  await progress(job.orderId, lines.find((l) => l.name === 'Shimano brake pads').id, { note: 'Staff only: customer was rude' });
  const link = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink;
  const [, slug, code] = new URL(link, server.baseUrl).pathname.match(/^\/book\/([^/]+)\/booking\/([0-9a-f]+)$/);
  const view = await fetch(`${server.baseUrl}/api/portal/${slug}/booking-links/${code}`);
  assert.equal(view.status, 200);
  assert.doesNotMatch(await view.text(), /customer was rude/);
});

test('one line’s id sent twice passes its tick and note on once (review)', async () => {
  const { job, lines } = await mayasJob();
  const padsLine = lines.find((l) => l.name === 'Shimano brake pads');
  await progress(job.orderId, padsLine.id, { done: true, note: 'Rear pads worn — replacing' });
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [
    { id: padsLine.id, productId: pads, qty: 1, unitPrice: 28 },
    { id: padsLine.id, productId: pads, qty: 1, unitPrice: 28 },
  ] } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.items.map((l) => l.done).sort(), [false, true]);
});

