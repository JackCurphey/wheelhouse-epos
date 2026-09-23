// Quotes supersede rather than mutate, and approval is per line.
//
// The case this whole design exists for is the stale link: the shop revises a
// price while the customer has the old approval link open, and the old link
// must not be able to approve the new amount. It has its own atlas screen (51).
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { customerIdForLogin } from './helpers/workshopFixtures.js';
import { recordLineDecision } from '../server/workshop/quotes.js';

const MONDAY = '2026-09-07';
let server;
let tenant;
let otherTenant;

before(async () => {
  server = await startLiveServer();
  tenant = await makeTenant();
  otherTenant = await makeTenant();
});

after(async () => {
  if (tenant) await deleteTestShop(tenant.shop.id);
  if (otherTenant) await deleteTestShop(otherTenant.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// Every test takes its own job on the shared tenant, and each job needs a slot
// inside the shop's 09:00-18:00 opening hours that does not overlap the last
// one. Half-hour slots give eighteen; whole hours gave nine, and the ninth test
// to want a job failed on opening hours rather than on what it was testing.
let slotMinutes = 9 * 60;
function clock(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function nextTimes() {
  const startTime = clock(slotMinutes);
  slotMinutes += 30;
  return { startTime, endTime: clock(slotMinutes) };
}

// Portal signup is rate-limited to a handful of accounts per IP per hour, and
// weakening a real abuse control to suit tests is the wrong trade. So each
// tenant is built once, in before(), and every test takes a fresh JOB on it
// rather than a fresh shop and customer.
async function makeTenant() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const mechanicId = await seedMechanic(shop.id);
  const signup = await portalSignup(server.baseUrl, shop.slug, {});
  // The job has to belong to this customer, or the quote is not theirs to
  // decide and the ownership check hides it - which is the behaviour the
  // cross-customer test below relies on.
  const customerId = await customerIdForLogin(shop.id, signup.loginId);
  return { cookie, shop, slug: shop.slug, mechanicId, customerId, customerCookie: signup.cookie };
}

// A fresh job on an existing tenant. Each test needs its own, because creating
// a quote revision supersedes whatever came before it on that job.
async function newJob(tenant) {
  const created = await staffRequest(server.baseUrl, tenant.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: {
      title: 'Quote me',
      jobDate: MONDAY,
      mechanicId: tenant.mechanicId,
      customerId: tenant.customerId,
      ...nextTimes(),
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return { ...tenant, jobId: created.body.id };
}

const createQuote = async (ctx, lines) => {
  const res = await staffRequest(server.baseUrl, ctx.cookie, `/api/workshop-jobs/${ctx.jobId}/quotes`, {
    method: 'POST',
    body: { lines },
  });
  return res;
};

const sendQuote = (ctx, quoteId) =>
  staffRequest(server.baseUrl, ctx.cookie, `/api/quotes/${quoteId}/send`, { method: 'POST' });

const decideLine = (ctx, quoteId, lineId, decision) =>
  portalRequest(server.baseUrl, ctx.customerCookie, `/api/portal/${ctx.slug}/quotes/${quoteId}/lines/${lineId}/decision`, {
    method: 'POST',
    body: { decision },
  });

const approve = (ctx, quoteId, revision) =>
  portalRequest(server.baseUrl, ctx.customerCookie, `/api/portal/${ctx.slug}/quotes/${quoteId}/approve`, {
    method: 'POST',
    body: { revision },
  });

const readLines = (shopId, quoteId) =>
  runWithShop(shopId, () =>
    prepare('SELECT * FROM workshop_quote_lines WHERE workshop_quote_id = ? ORDER BY id').all(quoteId));

// No endpoint expires a quote - expiry is a timer nobody has built yet, and
// inventing an endpoint for it would be building something no screen consumes.
const expireQuote = (shopId, quoteId) =>
  runWithShop(shopId, () =>
    prepare("UPDATE workshop_quotes SET state = 'expired' WHERE id = ?").run(quoteId));

test('an approval from a link for an older revision is refused', async () => {
  const ctx = await newJob(tenant);
  {
    const q1 = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
    assert.equal(q1.status, 201, JSON.stringify(q1.body));
    await sendQuote(ctx, q1.body.id);

    // The shop revises the price while the customer has the old link open.
    const q2 = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 85 }]);
    assert.equal(q2.status, 201, JSON.stringify(q2.body));

    const res = await approve(ctx, q2.body.id, q1.body.revision);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /this link is for revision 1; the current quote is revision 2/);
  }
});

test('an expired quote cannot be approved even at the current revision number', async () => {
  // canApprove checks two reasons independently, and this isolates the second:
  // an expired quote is still the newest revision, so the revision check passes
  // and only the state check can refuse it. A superseded quote can never reach
  // this branch - a newer revision exists by definition.
  const ctx = await newJob(tenant);
  {
    const q = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
    await sendQuote(ctx, q.body.id);
    await expireQuote(ctx.shop.id, q.body.id);

    const res = await approve(ctx, q.body.id, q.body.revision);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /a quote that is expired cannot be approved/);
  }
});

test('approving some lines and declining others leaves the quote partly approved', async () => {
  const ctx = await newJob(tenant);
  {
    const q = await createQuote(ctx, [
      { kind: 'labour', description: 'Fit pads', unitAmount: 20 },
      { kind: 'part', description: 'Gear cable', unitAmount: 6 },
    ]);
    await sendQuote(ctx, q.body.id);
    const [labour, part] = await readLines(ctx.shop.id, q.body.id);
    assert.equal((await decideLine(ctx, q.body.id, labour.id, 'approved')).status, 200);
    assert.equal((await decideLine(ctx, q.body.id, part.id, 'declined')).status, 200);

    const res = await approve(ctx, q.body.id, q.body.revision);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.state, 'partly_approved');

    const after = await readLines(ctx.shop.id, q.body.id);
    assert.equal(after.find((l) => l.id === labour.id).decision, 'approved');
    assert.equal(after.find((l) => l.id === part.id).decision, 'declined');
  }
});

test('a quote with an undecided line cannot be approved', async () => {
  const ctx = await newJob(tenant);
  {
    const q = await createQuote(ctx, [
      { kind: 'labour', description: 'Fit pads', unitAmount: 20 },
      { kind: 'part', description: 'Gear cable', unitAmount: 6 },
    ]);
    await sendQuote(ctx, q.body.id);
    const [labour] = await readLines(ctx.shop.id, q.body.id);
    await decideLine(ctx, q.body.id, labour.id, 'approved');

    const res = await approve(ctx, q.body.id, q.body.revision);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /every line needs a decision/);
  }
});

test('a revision snapshots its amounts - superseding does not rewrite what was agreed', async () => {
  const ctx = await newJob(tenant);
  {
    const q1 = await createQuote(ctx, [{ kind: 'part', description: 'Chain', unitAmount: 24.5 }]);
    await sendQuote(ctx, q1.body.id);
    const [chain] = await readLines(ctx.shop.id, q1.body.id);
    await decideLine(ctx, q1.body.id, chain.id, 'approved');
    assert.equal((await approve(ctx, q1.body.id, q1.body.revision)).status, 200);

    await createQuote(ctx, [{ kind: 'part', description: 'Chain', unitAmount: 31 }]);

    const stored = await readLines(ctx.shop.id, q1.body.id);
    assert.equal(stored[0].unit_amount, 24.5, 'the amount the customer agreed to must stay recoverable');
  }
});

test('a line decision on a quote that is not sent is refused', async () => {
  const ctx = await newJob(tenant);
  {
    const q = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
    const [line] = await readLines(ctx.shop.id, q.body.id);
    const res = await decideLine(ctx, q.body.id, line.id, 'approved');
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /a quote that is draft is not open for decisions/);
  }
});

test("a customer cannot decide lines on another shop's quote", async () => {
  const mine = await newJob(tenant);
  const theirs = await newJob(otherTenant);
  {
    const q = await createQuote(theirs, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
    await sendQuote(theirs, q.body.id);
    const [line] = await readLines(theirs.shop.id, q.body.id);

    // mine's customer session, theirs' quote.
    const res = await portalRequest(
      server.baseUrl, mine.customerCookie,
      `/api/portal/${mine.slug}/quotes/${q.body.id}/lines/${line.id}/decision`,
      { method: 'POST', body: { decision: 'approved' } }
    );
    assert.equal(res.status, 404, `another shop's quote must be invisible: ${JSON.stringify(res.body)}`);
  }
});

test('a customer cannot decide lines on another customer of the same shop', async () => {
  // The test above crosses SHOPS, so RLS hides the row and the ownership join
  // is never exercised. This is the within-shop case, which only the join in
  // quotes.js catches. Driven at the module level: a second portal signup would
  // trip the rate limiter that the shared-tenant setup above exists to respect.
  const ctx = await newJob(tenant);
  const q = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
  await sendQuote(ctx, q.body.id);
  const [line] = await readLines(ctx.shop.id, q.body.id);

  const strangerId = await runWithShop(ctx.shop.id, async () => {
    const { lastInsertRowid } = await prepare(
      "INSERT INTO customers (name, active) VALUES ('Someone Else', 1)"
    ).run();
    return lastInsertRowid;
  });

  const refused = await runWithShop(ctx.shop.id, () =>
    recordLineDecision({
      quoteId: q.body.id,
      lineId: line.id,
      decision: 'approved',
      customerId: strangerId,
    }));
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'not_found', "another customer's quote must be invisible, not merely refused");

  // And the line is untouched.
  const after = await readLines(ctx.shop.id, q.body.id);
  assert.equal(after[0].decision, 'pending');
});

// A line decision is final (docs/decisions/2026-09-23-quote-line-decisions-are-final.md).
// A customer who changes their mind contacts the shop, and the shop issues a new
// revision - which supersedes per line and already exists. Without this guard a
// customer can flip a line between approved and declined right up to submitting,
// so work the shop has already started can silently become un-agreed, with no
// record of why.
test('a line already decided cannot be decided again', async () => {
  const ctx = await newJob(tenant);
  const q = await createQuote(ctx, [{ kind: 'labour', description: 'Service', unitAmount: 60 }]);
  await sendQuote(ctx, q.body.id);
  const [line] = await readLines(ctx.shop.id, q.body.id);

  const first = await runWithShop(ctx.shop.id, () =>
    recordLineDecision({
      quoteId: q.body.id,
      lineId: line.id,
      decision: 'approved',
      customerId: tenant.customerId,
    }));
  assert.equal(first.ok, true, JSON.stringify(first));

  const second = await runWithShop(ctx.shop.id, () =>
    recordLineDecision({
      quoteId: q.body.id,
      lineId: line.id,
      decision: 'declined',
      customerId: tenant.customerId,
    }));

  assert.equal(second.ok, false, 'a decided line must not be re-decided');
  assert.equal(second.code, 'illegal');
  assert.match(second.message, /already/);

  // The first answer stands, unchanged.
  const settled = await readLines(ctx.shop.id, q.body.id);
  assert.equal(settled[0].decision, 'approved');
});
