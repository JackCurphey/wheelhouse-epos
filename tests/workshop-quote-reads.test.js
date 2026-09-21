import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

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

test('a quote that does not exist is 404, not an empty quote', async () => {
  const res = await staffRequest(server.baseUrl, session.cookie, '/api/quotes/999999');
  assert.equal(res.status, 404);
});
