// The reference printed on the bike tag and quoted to the customer.
//
// Per shop, not global: a customer reading WH-1042 on their tag would otherwise
// be reading how many jobs every shop on the system has taken between them.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { allocateReference } from '../server/workshop/references.js';

const MONDAY = '2026-09-07';
let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function newShop() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const mechanicId = await seedMechanic(shop.id);
  return { cookie, shop, mechanicId };
}

let slot = 9;
// Each job needs its own hour, or the diary's own overlap rule rejects it and
// the test fails for a reason that has nothing to do with references.
function nextTimes() {
  const start = `${String(slot++).padStart(2, '0')}:00`;
  const end = `${String(slot).padStart(2, '0')}:00`;
  return { startTime: start, endTime: end };
}

const createJobViaApi = async (cookie, mechanicId) => {
  const times = nextTimes();
  const res = await staffRequest(server.baseUrl, cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Reference test', jobDate: MONDAY, mechanicId, ...times },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

test('references count per shop, starting at WH-1000', async () => {
  const a = await newShop();
  const b = await newShop();
  try {
    const first = await createJobViaApi(a.cookie, a.mechanicId);
    const other = await createJobViaApi(b.cookie, b.mechanicId);
    assert.equal(first.reference, 'WH-1000');
    assert.equal(
      other.reference,
      'WH-1000',
      "one shop's job volume must not leak to another shop's customers"
    );
  } finally {
    await deleteTestShop(a.shop.id);
    await deleteTestShop(b.shop.id);
  }
});

test('concurrent allocations in one shop never hand out the same number', async () => {
  // Driven at the database level, not over HTTP. Two HTTP requests in a
  // Promise.all do not reliably overlap inside the server, so that version of
  // this test passed even against a check-then-act implementation - it was
  // proving nothing. runWithShop checks out its own pool client per call, so
  // these genuinely interleave.
  const { shop } = await newShop();
  try {
    const allocate = () => runWithShop(shop.id, () => allocateReference());
    const refs = await Promise.all(Array.from({ length: 10 }, allocate));
    assert.equal(new Set(refs).size, refs.length, `duplicate references handed out: ${refs.join(', ')}`);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a reference is never reused after a job is deleted', async () => {
  // A tag may already be printed and stuck to a bike, so a spent number stays
  // spent.
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const first = await createJobViaApi(cookie, mechanicId);
    const deleted = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${first.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    const second = await createJobViaApi(cookie, mechanicId);
    assert.notEqual(second.reference, first.reference);
  } finally {
    await deleteTestShop(shop.id);
  }
});
