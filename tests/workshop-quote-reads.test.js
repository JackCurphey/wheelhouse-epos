import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { portalSignup } from './helpers/portal.js';
import { customerIdForLogin } from './helpers/workshopFixtures.js';
import { runWithShop } from '../server/db.js';
import { recordLineDecision } from '../server/workshop/quotes.js';

let server;
let session;

before(async () => {
  server = await startLiveServer();
  session = await staffSignup(server.baseUrl);
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
  const portal = await portalSignup(server.baseUrl, session.shop.slug);
  const customerId = await customerIdForLogin(session.shop.id, portal.loginId);

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
