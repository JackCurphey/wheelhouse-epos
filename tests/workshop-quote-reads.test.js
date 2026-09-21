import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { customerIdForLogin } from './helpers/workshopFixtures.js';
import { runWithShop } from '../server/db.js';
import { recordLineDecision } from '../server/workshop/quotes.js';

let server;
let session;
// One portal customer, shared across every test below except the
// other-customer ownership test, which needs a genuinely distinct second
// customer. portalSignupLimiter caps new portal accounts at 5/hour/IP inside
// this file's own server process - a real anti-abuse control this dispatch
// does not touch - so tests reuse one signed-up customer for unrelated
// fixtures rather than minting a fresh one per test.
let portalCustomer;
let portalCustomerId;

before(async () => {
  server = await startLiveServer();
  session = await staffSignup(server.baseUrl);
  portalCustomer = await portalSignup(server.baseUrl, session.shop.slug);
  portalCustomerId = await customerIdForLogin(session.shop.id, portalCustomer.loginId);
});

after(async () => {
  if (session) await deleteTestShop(session.shop.id);
  if (server) await server.stop();
});

async function jobWithQuote(lines) {
  const job = await staffRequest(server.baseUrl, session.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Quote read fixture', jobDate: '2026-10-01' },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  const quote = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${job.body.id}/quotes`,
    { method: 'POST', body: { lines } },
  );
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { jobId: job.body.id, quoteId: quote.body.id };
}

// Like jobWithQuote, but the job is linked to a real customer - required for
// the portal read, which is only ever visible to the customer the job belongs
// to (see quoteForCustomer in server/workshop/quotes.js).
async function jobWithQuoteForCustomer(customerId, lines) {
  const job = await staffRequest(server.baseUrl, session.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Portal quote read fixture', jobDate: '2026-10-01', customerId },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  const quote = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${job.body.id}/quotes`,
    { method: 'POST', body: { lines } },
  );
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { jobId: job.body.id, quoteId: quote.body.id };
}

test('reads a quote back with its lines and a total', async () => {
  const { quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
    { kind: 'part', description: 'Chain', quantity: 2, unitAmount: 24.5 },
  ]);

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.id, quoteId);
  assert.equal(res.body.revision, 1);
  assert.equal(res.body.state, 'draft');
  assert.equal(res.body.lines.length, 2);
  assert.equal(res.body.lines[1].lineTotal, 49);
  assert.equal(res.body.totals.all, 134);
  assert.equal(res.body.totals.pending, 134);
  assert.equal(res.body.totals.approved, 0);
});

// The three totals share no line, so a swapped FILTER clause (approved for
// declined, or either for pending) lands on a value none of the others could
// produce - 85, 49 and 10 are chosen so all four totals (those three plus
// their sum, 144) are pairwise distinct.
test('per-decision totals and each line decision read back correctly', async () => {
  const customerId = portalCustomerId;

  const job = await staffRequest(server.baseUrl, session.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Quote decision fixture', jobDate: '2026-10-02', customerId },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));

  const quote = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${job.body.id}/quotes`,
    {
      method: 'POST',
      body: {
        lines: [
          { kind: 'labour', description: 'Approved line', quantity: 1, unitAmount: 85 },
          { kind: 'part', description: 'Declined line', quantity: 1, unitAmount: 49 },
          { kind: 'part', description: 'Pending line', quantity: 1, unitAmount: 10 },
        ],
      },
    },
  );
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  const quoteId = quote.body.id;

  const sendResult = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendResult.status, 200, JSON.stringify(sendResult.body));

  // Fetch the lines to find their ids before deciding any of them.
  const before = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}`);
  assert.equal(before.status, 200);
  const [approvedLine, declinedLine, pendingLine] = before.body.lines;

  // recordLineDecision() is not exposed over the staff API - a customer
  // decides through the portal, authenticated as a customer, not staff (see
  // POST /api/portal/:shopSlug/quotes/:id/lines/:lineId/decision in
  // server/server.js). Calling the module function directly inside the
  // shop's tenant context exercises the real decision logic (state checks,
  // the UPDATE) without standing up a second HTTP round trip through the
  // portal auth layer just to reach it.
  await runWithShop(session.shop.id, () =>
    recordLineDecision({
      quoteId,
      lineId: approvedLine.id,
      decision: 'approved',
      customerId,
    }),
  );
  await runWithShop(session.shop.id, () =>
    recordLineDecision({
      quoteId,
      lineId: declinedLine.id,
      decision: 'declined',
      customerId,
    }),
  );
  // pendingLine is left undecided on purpose.

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}`);
  assert.equal(res.status, 200);

  const byDescription = Object.fromEntries(res.body.lines.map((l) => [l.description, l]));
  assert.equal(byDescription['Approved line'].decision, 'approved');
  assert.equal(byDescription['Declined line'].decision, 'declined');
  assert.equal(byDescription['Pending line'].decision, 'pending');

  assert.equal(res.body.totals.approved, 85);
  assert.equal(res.body.totals.declined, 49);
  assert.equal(res.body.totals.pending, 10);
  assert.equal(res.body.totals.all, 144);
});

test('a quote that does not exist is 404, not an empty quote', async () => {
  const res = await staffRequest(server.baseUrl, session.cookie, '/api/quotes/999999');
  assert.equal(res.status, 404);
});

test('lists a job\'s quote revisions newest first, with the superseded one visible', async () => {
  const { jobId, quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);

  // createRevision() replaces a draft's lines in place rather than spending a
  // revision number on a proposal nobody has seen yet (see server/workshop/
  // quotes.js). Revision 1 has to leave 'draft' before creating a second
  // quote actually produces a new revision, so send it first.
  const sendFirst = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendFirst.status, 200, JSON.stringify(sendFirst.body));

  const second = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${jobId}/quotes`,
    { method: 'POST', body: { lines: [
      { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 95 },
    ] } },
  );
  assert.equal(second.status, 201, JSON.stringify(second.body));

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${jobId}/quotes`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.equal(res.body[0].revision, 2);
  assert.equal(res.body[1].revision, 1);
  // Phase 3 supersedes rather than mutates: revision 1 must still be readable.
  assert.equal(res.body[1].id, quoteId);
  assert.equal(res.body[1].state, 'superseded');
});

test('a job with no quotes lists as an empty array, not a 404', async () => {
  const job = await staffRequest(server.baseUrl, session.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'No quotes yet', jobDate: '2026-10-03' },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${job.body.id}/quotes`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('an unauthenticated portal read of a quote is refused', async () => {
  const { quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);
  const res = await staffRequest(
    server.baseUrl,
    null,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  assert.equal(res.status, 401);
});

test('a portal read against the wrong shop slug is refused', async () => {
  const otherShop = await staffSignup(server.baseUrl);
  try {
    const { quoteId } = await jobWithQuote([
      { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
    ]);
    const res = await portalRequest(
      server.baseUrl,
      portalCustomer.cookie,
      `/api/portal/${otherShop.shop.slug}/quotes/${quoteId}`,
    );
    assert.equal(res.status, 401);
  } finally {
    await deleteTestShop(otherShop.shop.id);
  }
});

test('the owning customer reads their quote with the same totals staff see', async () => {
  const { quoteId } = await jobWithQuoteForCustomer(portalCustomerId, [
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
    { kind: 'part', description: 'Chain', quantity: 2, unitAmount: 24.5 },
  ]);

  // A draft is not visible to the customer (showing it is a deliberate staff
  // act - see send() in server/workshop/quotes.js), so this fixture has to
  // send it before the portal read can see it at all.
  const sendResult = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendResult.status, 200, JSON.stringify(sendResult.body));

  const staffRes = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}`);
  assert.equal(staffRes.status, 200, JSON.stringify(staffRes.body));

  const res = await portalRequest(
    server.baseUrl,
    portalCustomer.cookie,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.id, quoteId);
  assert.equal(res.body.lines.length, 2);
  assert.equal(res.body.totals.all, staffRes.body.totals.all);
});

// This is the test that proves the controller ruling: quoteForCustomer scopes
// ownership within the shop, so a second customer of the SAME shop cannot
// read the first customer's quote by trying its id. It must come back 404 -
// byte-for-byte the same as a quote id that never existed - not 403, which
// would let a customer learn which ids are real.
test('a quote belonging to another customer in the same shop is 404, indistinguishable from a nonexistent quote', async () => {
  // The shared customer owns this one; send it so the negative case below is
  // proven by ownership, not incidentally by the draft rule too.
  const { quoteId } = await jobWithQuoteForCustomer(portalCustomerId, [
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);
  const sendResult = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendResult.status, 200, JSON.stringify(sendResult.body));

  const other = await portalSignup(server.baseUrl, session.shop.slug);

  const otherCustomersQuote = await portalRequest(
    server.baseUrl,
    other.cookie,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  const nonexistentQuote = await portalRequest(
    server.baseUrl,
    other.cookie,
    `/api/portal/${session.shop.slug}/quotes/999999`,
  );

  assert.equal(otherCustomersQuote.status, 404);
  assert.equal(nonexistentQuote.status, 404);
  assert.deepEqual(otherCustomersQuote.body, nonexistentQuote.body);
});

// Showing a quote to a customer is a deliberate staff act (send(), screen 20
// - see server/workshop/quotes.js). Until that happens the portal must not
// leak that the draft exists, even to its own owner - same 404, same body as
// a quote id nobody has ever used.
test('the owning customer cannot read their own quote while it is still draft', async () => {
  const { quoteId } = await jobWithQuoteForCustomer(portalCustomerId, [
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);

  const draftRes = await portalRequest(
    server.baseUrl,
    portalCustomer.cookie,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  const nonexistentRes = await portalRequest(
    server.baseUrl,
    portalCustomer.cookie,
    `/api/portal/${session.shop.slug}/quotes/999999`,
  );

  assert.equal(draftRes.status, 404);
  assert.equal(nonexistentRes.status, 404);
  assert.deepEqual(draftRes.body, nonexistentRes.body);
});

test('the same quote becomes readable to its owner once it is sent', async () => {
  const { quoteId } = await jobWithQuoteForCustomer(portalCustomerId, [
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);

  const sendResult = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendResult.status, 200, JSON.stringify(sendResult.body));

  const res = await portalRequest(
    server.baseUrl,
    portalCustomer.cookie,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.state, 'sent');
});

// Screen 51 (stale) shows a customer a revision their approval link named
// even after a later revision supersedes it - it has to stay readable, not
// vanish behind the draft rule.
test("a superseded revision stays readable to its owner, naming its state", async () => {
  const { jobId, quoteId } = await jobWithQuoteForCustomer(portalCustomerId, [
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);

  const sendResult = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}/send`, {
    method: 'POST',
  });
  assert.equal(sendResult.status, 200, JSON.stringify(sendResult.body));

  const revision = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${jobId}/quotes`,
    { method: 'POST', body: { lines: [
      { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 95 },
    ] } },
  );
  assert.equal(revision.status, 201, JSON.stringify(revision.body));

  const res = await portalRequest(
    server.baseUrl,
    portalCustomer.cookie,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.state, 'superseded');
});
