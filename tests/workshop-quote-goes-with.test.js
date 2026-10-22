// Quote lines that go together, and what happens without a Needed line
// (Jack, 1 Oct, docs/decisions/2026-10-01-drop-off-and-quote-review.md
// decisions 2 and 7; openspec/changes/quote-goes-with).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { customerIdForLogin } from './helpers/workshopFixtures.js';

let server;
let owner;
let maya;
let portalCustomer;
let portalCustomerId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Pair Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  portalCustomer = await portalSignup(server.baseUrl, owner.shop.slug);
  portalCustomerId = await customerIdForLogin(owner.shop.id, portalCustomer.loginId);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
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

const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads are worn down to 1mm.', without: 'The rear brake stays worn.' };
const FIT = { kind: 'labour', description: 'Fit and adjust brakes', unitAmount: 18, need: 'needed', reason: 'Needed with the new pads.', goesWith: 0 };
const CABLE = { kind: 'labour', description: 'Replace gear cable', unitAmount: 12, need: 'optional', reason: 'Shifting is a little stiff.' };

let jobDay = 5;
async function newJob(customerId = maya.id) {
  const job = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId } });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  return job.body;
}
const saveLines = (jobId, lines) => staff(`/api/workshop-jobs/${jobId}/quotes`, { method: 'POST', body: { lines } });
const readQuote = async (id) => (await staff(`/api/quotes/${id}`)).body;
async function sentQuote(lines = [PADS, FIT, CABLE], customerId = maya.id) {
  const job = await newJob(customerId);
  const saved = await saveLines(job.id, lines);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal((await staff(`/api/quotes/${saved.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  return { job, quote: await readQuote(saved.body.id) };
}
const byName = (q) => Object.fromEntries(q.lines.map((l) => [l.description, l]));

test('a labour line goes with a part, and a Needed line keeps what happens without it', async () => {
  const job = await newJob();
  const saved = await saveLines(job.id, [PADS, FIT, CABLE]);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const lines = byName(await readQuote(saved.body.id));
  assert.equal(lines['Fit and adjust brakes'].goesWithLineId, lines['Shimano brake pads'].id);
  assert.equal(lines['Shimano brake pads'].goesWithLineId, null);
  assert.equal(lines['Replace gear cable'].goesWithLineId, null);
  assert.equal(lines['Shimano brake pads'].without, 'The rear brake stays worn.');
  assert.equal(lines['Fit and adjust brakes'].without, null);
});

test('saving a draft again keeps the pair, with the new line ids', async () => {
  const job = await newJob();
  const first = await saveLines(job.id, [PADS, FIT]);
  const again = await saveLines(job.id, [CABLE, PADS, { ...FIT, goesWith: 1 }]);
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.id, first.body.id, 'still the same draft');
  const lines = byName(await readQuote(again.body.id));
  assert.equal(lines['Fit and adjust brakes'].goesWithLineId, lines['Shimano brake pads'].id);
});

test('a pair is refused (as other quote line refusals, 409) unless a labour line goes with a part in the same quote', async () => {
  const job = await newJob();
  for (const [lines, why] of [
    [[PADS, { ...FIT, goesWith: 5 }], 'not in the list'],
    [[PADS, { ...FIT, goesWith: 1 }], 'itself'],
    [[{ ...PADS, goesWith: 1 }, { ...FIT, goesWith: undefined }], 'a part going with something'],
    [[CABLE, { ...FIT, goesWith: 0 }], 'labour going with labour'],
    [[PADS, { ...FIT, goesWith: '0' }], 'not a whole number'],
  ]) {
    const res = await saveLines(job.id, lines);
    assert.equal(res.status, 409, `${why}: ${JSON.stringify(res.body)}`);
  }
});

test('what happens without it is up to 300 letters, and blank means none', async () => {
  const job = await newJob();
  assert.equal((await saveLines(job.id, [{ ...PADS, without: "x".repeat(301) }])).status, 409);
  assert.equal((await saveLines(job.id, [{ ...PADS, without: 7 }])).status, 409);
  const saved = await saveLines(job.id, [{ ...PADS, without: '   ' }]);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal((await readQuote(saved.body.id)).lines[0].without, null);
});

test('the customer sees the pair and the without words', async () => {
  const { job } = await sentQuote();
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  const res = await portal(`/booking-links/${code}/quote`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const lines = byName(res.body);
  assert.equal(lines['Fit and adjust brakes'].goesWithLineId, lines['Shimano brake pads'].id);
  assert.equal(lines['Shimano brake pads'].without, 'The rear brake stays worn.');
});

test('an answer that splits a pair is refused, and nothing is saved', async () => {
  const { job, quote } = await sentQuote();
  const lines = byName(quote);
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  const split = [
    { lineId: lines['Shimano brake pads'].id, decision: 'approved' },
    { lineId: lines['Fit and adjust brakes'].id, decision: 'declined' },
    { lineId: lines['Replace gear cable'].id, decision: 'declined' },
  ];
  const online = await portal(`/booking-links/${code}/quote/answer`, { method: 'POST', body: { revision: quote.revision, decisions: split } });
  assert.equal(online.status, 409, JSON.stringify(online.body));
  assert.match(online.body.error, /Fit and adjust brakes goes with Shimano brake pads/);
  const byPhone = await staff(`/api/quotes/${quote.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: split } });
  assert.equal(byPhone.status, 409, JSON.stringify(byPhone.body));
  const after = await readQuote(quote.id);
  assert.equal(after.state, 'sent');
  assert.ok(after.lines.every((l) => l.decision === 'pending'));
  // Together is fine.
  const together = split.map((d) => (d.lineId === lines['Fit and adjust brakes'].id ? { ...d, decision: 'approved' } : d));
  const ok = await portal(`/booking-links/${code}/quote/answer`, { method: 'POST', body: { revision: quote.revision, decisions: together } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test('one line at a time is refused for a line in a pair', async () => {
  const { quote } = await sentQuote([PADS, FIT, CABLE], portalCustomerId);
  const lines = byName(quote);
  const decide = (lineId) => portalRequest(server.baseUrl, portalCustomer.cookie,
    `/api/portal/${owner.shop.slug}/quotes/${quote.id}/lines/${lineId}/decision`, { method: 'POST', body: { decision: 'approved' } });
  for (const name of ['Shimano brake pads', 'Fit and adjust brakes']) {
    const res = await decide(lines[name].id);
    assert.equal(res.status, 409, `${name}: ${JSON.stringify(res.body)}`);
  }
  assert.equal((await decide(lines['Replace gear cable'].id)).status, 200);
  assert.ok((await readQuote(quote.id)).lines.filter((l) => l.description !== 'Replace gear cable').every((l) => l.decision === 'pending'));
});
