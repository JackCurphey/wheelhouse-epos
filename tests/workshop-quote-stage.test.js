// The quote stage, server side (journey 4; Jack, 3 Oct: "1"): build a quote
// with Needed/Optional and a reason, send it by text with a fresh booking
// link, let the customer answer on that link or staff record the answer, or
// withdraw it; approved lines join the job's work and parts.
// A pretend Twilio stands in for the real one (TWILIO_API_BASE), so nothing is
// really sent. Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let twilio;
const texts = [];
let owner;
let maya;
let mayaBike;
let noPhone;
let pads;

before(async () => {
  twilio = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      texts.push({ url: req.url, ...Object.fromEntries(new URLSearchParams(body)) });
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ sid: `SM${texts.length}` }));
    });
  });
  await new Promise((r) => twilio.listen(0, '127.0.0.1', r));
  server = await startLiveServer({
    env: {
      TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM_NUMBER: '+447000000000',
      TWILIO_API_BASE: `http://127.0.0.1:${twilio.address().port}`,
    },
  });
  owner = await staffSignup(server.baseUrl, { shopName: 'Quote Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  mayaBike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  noPhone = (await staff('/api/customers', { method: 'POST', body: { name: 'Sam Reed' } })).body;
  pads = (await staff('/api/products', { method: 'POST', body: { name: 'Brake pads (pair)', price: 18, sku: 'BP-01' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await new Promise((r) => twilio.close(r));
  await pool.end();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
async function portal(path, options = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let jobDay = 5;
async function jobWithQuote(customer = maya, bike = mayaBike) {
  const job = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: customer.id, bikeId: bike?.id ?? null },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  const quote = await staff(`/api/workshop-jobs/${job.body.id}/quotes`, {
    method: 'POST',
    body: { lines: [
      { kind: 'part', description: 'Brake pads (pair)', productId: pads.id, quantity: 1, unitAmount: 18, need: 'needed', reason: 'Worn down to 1mm' },
      { kind: 'labour', description: 'Fit new gear cable', unitAmount: 12, need: 'optional', reason: 'Shifting is stiff' },
    ] },
  });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { job: job.body, quote: quote.body };
}
const codeFrom = (link) => link.split('/booking/')[1];
const readQuote = async (id) => (await staff(`/api/quotes/${id}`)).body;
const orderNames = async (jobId) => {
  const job = (await staff(`/api/workshop-jobs/${jobId}`)).body;
  return (await staff(`/api/sale-documents/${job.orderId}`)).body.items.map((i) => i.name);
};

test('a quote line carries Needed or Optional and a reason for the customer', async () => {
  const { quote } = await jobWithQuote();
  const q = await readQuote(quote.id);
  assert.deepEqual(q.lines.map((l) => [l.description, l.need, l.reason]), [
    ['Brake pads (pair)', 'needed', 'Worn down to 1mm'],
    ['Fit new gear cable', 'optional', 'Shifting is stiff'],
  ]);
});

test("every read of a job carries its current quote's state", async () => {
  const { job, quote } = await jobWithQuote();
  const read = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  assert.deepEqual(read.quote, { id: quote.id, state: 'draft', revision: 1 });
  const list = (await staff(`/api/workshop-jobs?start=${job.jobDate}&end=${job.jobDate}`)).body;
  assert.equal(list.find((j) => j.id === job.id).quote.state, 'draft');
});

test('Send texts the customer a fresh booking link; the old link stops working', async () => {
  const { job, quote } = await jobWithQuote();
  const old = await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} });
  const oldCode = codeFrom(old.body.privateLink);
  const before = texts.length;
  const sent = await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal(sent.body.quote.state, 'sent');
  assert.ok(sent.body.quote.sentAt);
  assert.equal(sent.body.message.status, 'sent');
  assert.match(sent.body.link, new RegExp(`^${server.baseUrl}/book/${owner.shop.slug}/booking/[0-9a-f]{64}$`));
  assert.equal(texts.length, before + 1);
  assert.equal(texts.at(-1).To, '+447700900142');
  assert.ok(texts.at(-1).Body.includes(sent.body.link), texts.at(-1).Body);
  const history = (await staff(`/api/customers/${maya.id}/texts`)).body;
  assert.ok(history.some((m) => m.body.includes(sent.body.link)));
  assert.equal((await portal(`/booking-links/${oldCode}`)).status, 404);
  assert.equal((await portal(`/booking-links/${codeFrom(sent.body.link)}`)).status, 200);
});

test('a customer with no phone number is not texted, but the quote is sent and the link given', async () => {
  const { quote } = await jobWithQuote(noPhone, null);
  const before = texts.length;
  const sent = await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.deepEqual(sent.body.message, { status: 'not_sent', reason: 'Sam Reed has no phone number on file.' });
  assert.equal(sent.body.quote.state, 'sent');
  assert.match(sent.body.link, /\/booking\//);
  assert.equal(texts.length, before);
});

test('the customer answers on their link; approved lines join the job\'s work and parts', async () => {
  const { job, quote } = await jobWithQuote();
  const sent = (await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} })).body;
  const code = codeFrom(sent.link);
  const shown = await portal(`/booking-links/${code}/quote`);
  assert.equal(shown.status, 200, JSON.stringify(shown.body));
  assert.equal(shown.body.state, 'sent');
  const [padsLine, cableLine] = shown.body.lines;
  const answered = await portal(`/booking-links/${code}/quote/answer`, {
    method: 'POST',
    body: { revision: shown.body.revision, decisions: [{ lineId: padsLine.id, decision: 'approved' }, { lineId: cableLine.id, decision: 'declined' }] },
  });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal(answered.body.state, 'partly_approved');
  const q = await readQuote(quote.id);
  assert.deepEqual(q.lines.map((l) => [l.decision, l.decidedVia, Boolean(l.addedToOrderAt)]), [['approved', 'online', true], ['declined', 'online', false]]);
  assert.deepEqual(await orderNames(job.id), ['Brake pads (pair)']);
});

test('a draft is not shown on the link', async () => {
  const { job } = await jobWithQuote();
  const link = await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} });
  assert.equal((await portal(`/booking-links/${codeFrom(link.body.privateLink)}/quote`)).status, 404);
});

test('staff record an answer taken by phone, with who took it and when', async () => {
  const { job, quote } = await jobWithQuote();
  await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} });
  const q0 = await readQuote(quote.id);
  const answered = await staff(`/api/quotes/${quote.id}/answer`, {
    method: 'POST',
    body: { via: 'phone', decisions: q0.lines.map((l) => ({ lineId: l.id, decision: 'approved' })) },
  });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal(answered.body.state, 'approved');
  const q = await readQuote(quote.id);
  for (const l of q.lines) {
    assert.equal(l.decidedVia, 'phone');
    assert.ok(l.decidedAt);
    assert.equal(l.decidedByName, owner.login?.name ?? l.decidedByName);
    assert.ok(l.decidedByName, 'who took the answer is missing');
  }
  assert.deepEqual(await orderNames(job.id), ['Brake pads (pair)', 'Fit new gear cable']);
});

test('a recorded answer must decide every line', async () => {
  const { quote } = await jobWithQuote();
  await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} });
  const q0 = await readQuote(quote.id);
  const r = await staff(`/api/quotes/${quote.id}/answer`, { method: 'POST', body: { via: 'in_shop', decisions: [{ lineId: q0.lines[0].id, decision: 'approved' }] } });
  assert.equal(r.status, 409);
  assert.equal((await readQuote(quote.id)).state, 'sent');
});

test('a sent quote can be withdrawn; the customer sees it withdrawn and can no longer answer', async () => {
  const { quote } = await jobWithQuote();
  const sent = (await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} })).body;
  const w = await staff(`/api/quotes/${quote.id}/withdraw`, { method: 'POST', body: {} });
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(w.body.state, 'withdrawn');
  const code = codeFrom(sent.link);
  const shown = await portal(`/booking-links/${code}/quote`);
  assert.equal(shown.body.state, 'withdrawn');
  const tried = await portal(`/booking-links/${code}/quote/answer`, {
    method: 'POST', body: { revision: shown.body.revision, decisions: shown.body.lines.map((l) => ({ lineId: l.id, decision: 'approved' })) },
  });
  assert.equal(tried.status, 409);
});

test('an answer for an older revision is refused', async () => {
  const { job, quote } = await jobWithQuote();
  const sent = (await staff(`/api/quotes/${quote.id}/send`, { method: 'POST', body: {} })).body;
  const shown = (await portal(`/booking-links/${codeFrom(sent.link)}/quote`)).body;
  await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Bleed brakes', unitAmount: 20 }] } });
  const tried = await portal(`/booking-links/${codeFrom(sent.link)}/quote/answer`, {
    method: 'POST', body: { revision: shown.revision, decisions: shown.lines.map((l) => ({ lineId: l.id, decision: 'approved' })) },
  });
  assert.equal(tried.status, 409, JSON.stringify(tried.body));
});
