// A client that goes away before the server has read its request: a phone losing
// signal, a till switched off (openspec/changes/dropped-request-releases).
// The first half drives the real server over real sockets, reset with a TCP RST.
// The second half uses a small server of its own, so "already gone when the read
// starts" happens every time rather than when the timing allows.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { createServer } from 'node:http';
import { once } from 'node:events';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { readJsonBody, readRawBody, sendJson } from '../server/lib/http.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { registerTill, tillRequest } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

// A break must fail, not hang: the body read that never ends is the bug itself.
async function within(ms, what, promise) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: nothing after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, limit]);
  } finally {
    clearTimeout(timer);
  }
}

const rawHead = (method, path, headers, length) => [
  `${method} ${path} HTTP/1.1`,
  'Host: 127.0.0.1',
  'Content-Type: application/json',
  `Content-Length: ${length}`,
  ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
  '', '',
].join('\r\n');

function opened(port) {
  const socket = connect(port, '127.0.0.1');
  socket.on('error', () => {});
  return once(socket, 'connect').then(() => socket);
}

// Sends the request (all of it, or `sent` of its bytes), then resets the connection.
async function dropped(baseUrl, { method = 'POST', path, headers = {}, body = '{}', sent = body, waitMs = 0 }) {
  const socket = await opened(new URL(baseUrl).port);
  socket.write(rawHead(method, path, headers, Buffer.byteLength(body)) + sent);
  await pause(waitMs);
  socket.resetAndDestroy();
  if (!socket.closed) await once(socket, 'close');
}

// Delays of 0 to 4 ms land a reset before the server starts reading, on some of
// the drops, whichever machine this runs on. Far more drops than the pool's 10.
async function burst(baseUrl, request, count = 60) {
  const going = [];
  for (let i = 0; i < count; i++) {
    going.push(dropped(baseUrl, { ...request, waitMs: i % 5 }));
    if (i % 10 === 9) await Promise.all(going.splice(0));
  }
  await Promise.all(going);
  // What the server does about a reset happens as its socket closes.
  await pause(100);
}

let server;
let owner;
let till;
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

async function assertStillAnswering(what) {
  const health = await within(3000, `${what}: the health check`, fetch(`${server.baseUrl}/healthz`));
  assert.equal(health.status, 200, `${what}: the health check`);
  const list = await within(3000, `${what}: a staff request`, staff('/api/customers'));
  assert.equal(list.status, 200, `${what}: a staff request`);
  const sync = await within(3000, `${what}: a till sync`, tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { items: [] } }));
  assert.equal(sync.status, 200, `${what}: a till sync`);
}

// The words a dropped request could leave in the log if it were treated as a fault.
function assertNothingLogged(from, what) {
  assert.doesNotMatch(server.stderr.slice(from), /ClientGone|aborted|ECONNRESET|transaction still open/, what);
}

before(async () => {
  server = await startLiveServer();
  try {
    owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
    till = await registerTill(server.baseUrl, owner);
  } finally {
    await server.stop();
  }
});
after(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    await pool.end();
  }
});

// Each on a server of its own, so a pool one test used up can't fail the next.
const live = (name, fn) => test(name, { timeout: 60_000 }, async () => {
  server = await startLiveServer();
  try {
    await fn();
  } finally {
    await server.stop();
  }
});

live('dropped till syncs leave the pool answering, with nothing in the log', async () => {
  const from = server.stderr.length;
  await burst(server.baseUrl, {
    path: `/api/till/${owner.shop.slug}/sync`,
    headers: { Authorization: `Bearer ${till.token}` },
    body: '{"items":[]}',
  });
  await assertStillAnswering('after dropped till syncs');
  assertNothingLogged(from, 'a dropped till sync is not a server fault');
});

live('dropped staff requests leave the pool answering, with nothing in the log', async () => {
  const from = server.stderr.length;
  // Empty, so a drop that lands after the read gets a refusal and writes nothing.
  await burst(server.baseUrl, { path: '/api/customers', headers: { Cookie: owner.cookie } });
  await assertStillAnswering('after dropped staff requests');
  assertNothingLogged(from, 'a dropped staff request is not a server fault');
});

live('a dropped Citrus Lime upload lets the shop go, so the next send is answered', async () => {
  await burst(server.baseUrl, { path: '/api/move/files', headers: { Cookie: owner.cookie } });
  await assertStillAnswering('after dropped uploads');
  // No file and no request key: refused as such (400), not "another send is going" (429).
  const next = await within(3000, 'the next send', staff('/api/move/files', { method: 'POST', body: {} }));
  assert.equal(next.status, 400, JSON.stringify(next.body));
});

// Part of a body, then a reset once the server is reading it, on each kind of
// route the dispatcher handles a failure for.
live('a body cut off part-way, on each kind of route, is nothing in the log', async () => {
  const slug = owner.shop.slug;
  const routes = {
    'a till': { path: `/api/till/${slug}/sync`, headers: { Authorization: `Bearer ${till.token}` } },
    'signed-in staff': { path: '/api/customers', headers: { Cookie: owner.cookie } },
    'staff signing in': { path: '/api/auth/login' },
    'a customer signing in': { path: `/api/portal/${slug}/login` },
    'the shop\'s website': { path: `/api/portal/${slug}/bookings` },
    'a Shopify webhook': { path: `/webhooks/shopify/${owner.shop.id}/orders` },
  };
  for (const [what, route] of Object.entries(routes)) {
    const from = server.stderr.length;
    await dropped(server.baseUrl, { ...route, body: '{"name":"Maya Patel"}', sent: '{"na', waitMs: 150 });
    await pause(150);
    assertNothingLogged(from, what);
  }
  await assertStillAnswering('after bodies cut off part-way');
});

live('a booking cancel that never arrived whole cancels nothing; one that did still cancels', async () => {
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${owner.shop.id}@example.test`, phone: '07700 900142' } })).body;
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  const makeJob = async () => {
    const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-05', customerId: maya.id, bikeId: bike.id } })).body;
    await staff(`/api/workshop-jobs/${job.id}/accept`, { method: 'POST', body: {} });
    const link = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink;
    return { id: job.id, code: link.split('/booking/')[1] };
  };
  const stateOf = (id) => runWithShop(owner.shop.id, () => prepare('SELECT booking_state, cancelled_by FROM workshop_jobs WHERE id = ?').get(id));
  const cancelPath = (code) => `/api/portal/${owner.shop.slug}/booking-links/${code}/cancel`;

  const kept = await makeJob();
  const was = await stateOf(kept.id);
  const from = server.stderr.length;
  await dropped(server.baseUrl, { path: cancelPath(kept.code), body: '{"losesDeposit":true}', sent: '{"lo', waitMs: 150 });
  await pause(300);
  assertNothingLogged(from, 'a website request that passes the failure up to the dispatcher');
  const now = await stateOf(kept.id);
  assert.deepEqual(now, was, 'the customer never finished asking');
  assert.equal(now.cancelled_by, null);

  const gone = await makeJob();
  const res = await within(5000, 'a whole cancel', fetch(`${server.baseUrl}${cancelPath(gone.code)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(res.status, 200, await res.text());
  assert.equal((await stateOf(gone.id)).cancelled_by, 'customer');
});

// ---------- The body read itself, with the timing fixed ----------

// A server whose one handler is `handler(req, res)`; returns its port and closer.
async function smallServer(handler) {
  const srv = createServer((req, res) => {
    handler(req, res).catch((err) => { res.destroy(); throw err; });
  });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  return {
    port: srv.address().port,
    close: () => { srv.closeAllConnections(); return new Promise((r) => { srv.close(r); }); },
  };
}

const settled = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

// Runs `then(req, res)` on a request whose client has already reset the
// connection: the whole request sent, nothing read, a reset, and only then this.
async function onRequestAlreadyGone(then) {
  let heard;
  const arrived = new Promise((r) => { heard = r; });
  let finish;
  const finished = new Promise((r) => { finish = r; });
  const srv = await smallServer(async (req, res) => {
    heard();
    // Not events.once: its own 'error' listener would change what the request does.
    await new Promise((r) => { req.once('close', r); });
    assert.equal(req.destroyed, true, 'the request really is gone');
    finish(await settled(then(req, res)));
  });
  try {
    const socket = await opened(srv.port);
    socket.write(rawHead('POST', '/', {}, 2) + '{}');
    await within(3000, 'the request arriving', arrived);
    socket.resetAndDestroy();
    const { value, error } = await within(5000, 'the request already gone', finished);
    if (error) throw error;
    return value;
  } finally {
    await srv.close();
  }
}

for (const [name, read] of [['readJsonBody', readJsonBody], ['readRawBody', readRawBody]]) {
  test(`${name}: a request already gone when the read starts ends the read, as a client gone`, { timeout: 15_000 }, async () => {
    const { error } = await onRequestAlreadyGone((req) => within(1000, 'the read', settled(read(req))));
    assert.equal(error?.name, 'ClientGoneError', String(error));
  });

  test(`${name}: reset part-way through the body ends the read, as a client gone`, { timeout: 15_000 }, async () => {
    let result;
    const srv = await smallServer(async (req) => {
      result = settled(read(req));
    });
    try {
      const socket = await opened(srv.port);
      socket.write(`${rawHead('POST', '/', {}, 100)}{"a`);
      await pause(100);
      assert.ok(result, 'the server is reading');
      socket.resetAndDestroy();
      const { error } = await within(1000, 'the read', result);
      assert.equal(error?.name, 'ClientGoneError', String(error));
    } finally {
      await srv.close();
    }
  });

  test(`${name}: a request closed with no error while it is read ends the read, as a client gone`, { timeout: 15_000 }, async () => {
    let result;
    const srv = await smallServer(async (req) => {
      result = settled(read(req));
      setTimeout(() => req.destroy(), 50);
    });
    try {
      const socket = await opened(srv.port);
      socket.write(`${rawHead('POST', '/', {}, 100)}{"a`);
      await pause(10);
      const { error } = await within(1000, 'the read', result);
      assert.equal(error?.name, 'ClientGoneError', String(error));
      socket.destroy();
    } finally {
      await srv.close();
    }
  });

  test(`${name}: a body read twice ends the second read, and isn't called a client gone`, { timeout: 15_000 }, async () => {
    let second;
    const srv = await smallServer(async (req, res) => {
      await read(req);
      second = await within(1000, 'the second read', settled(read(req)));
      res.end('{}');
    });
    try {
      await within(3000, 'the answer', fetch(`http://127.0.0.1:${srv.port}/`, { method: 'POST', body: '{}' }));
      assert.ok(second.error, 'the second read refuses');
      assert.notEqual(second.error.name, 'ClientGoneError');
    } finally {
      await srv.close();
    }
  });
}

test('a normal request still reads its body, or an empty one', { timeout: 15_000 }, async () => {
  const seen = [];
  const srv = await smallServer(async (req, res) => {
    seen.push(await settled(readJsonBody(req, 10)));
    sendJson(res, 200, {});
  });
  try {
    const post = (body) => within(3000, 'the answer', fetch(`http://127.0.0.1:${srv.port}/`, { method: 'POST', body }));
    await post('{"a":1}');
    await post('');
    assert.deepEqual(seen[0], { value: { a: 1 } });
    assert.deepEqual(seen[1], { value: {} });
  } finally {
    await srv.close();
  }
});

test('a normal request whose answer takes a while still gets all of it', { timeout: 15_000 }, async () => {
  const srv = await smallServer(async (req, res) => {
    const body = await readJsonBody(req);
    // Long enough for the server to have finished with the request's own stream.
    await pause(100);
    sendJson(res, 200, { echoed: body, padding: 'x'.repeat(5_000_000) });
  });
  try {
    const res = await within(5000, 'the answer', fetch(`http://127.0.0.1:${srv.port}/`, { method: 'POST', body: '{"a":1}' }));
    assert.equal(res.status, 200);
    const answer = await res.json();
    assert.deepEqual(answer.echoed, { a: 1 });
    assert.equal(answer.padding.length, 5_000_000);
  } finally {
    await srv.close();
  }
});

test('nothing is written to a client already gone', { timeout: 15_000 }, async () => {
  const res = await onRequestAlreadyGone(async (req, r) => {
    sendJson(r, 500, { error: 'Internal server error' });
    return r;
  });
  assert.equal(res.headersSent, false);
  assert.equal(res.writableEnded, false);
});

test('a second answer after a finished one is still the error it always was', { timeout: 15_000 }, async () => {
  let second;
  const srv = await smallServer(async (req, res) => {
    sendJson(res, 200, {});
    await new Promise((r) => { res.once('close', r); });
    assert.equal(res.destroyed, true, 'the answer really has finished');
    second = await settled((async () => sendJson(res, 500, {}))());
  });
  try {
    await within(3000, 'the answer', fetch(`http://127.0.0.1:${srv.port}/`));
    await within(3000, 'the second answer', (async () => { while (!second) await pause(5); })());
    assert.equal(second.error?.code, 'ERR_HTTP_HEADERS_SENT');
  } finally {
    await srv.close();
  }
});

test('a dropped request inside a transaction rolls it back and gives its connection back', { timeout: 15_000 }, async () => {
  const name = `Dropped ${owner.shop.id}`;
  const { error } = await onRequestAlreadyGone((req) => settled(runWithShop(owner.shop.id, async () => {
    await dbExec('BEGIN');
    await prepare('INSERT INTO customers (name) VALUES (?)').run(name);
    await within(1000, 'the read', readJsonBody(req));
  })));
  assert.equal(error?.name, 'ClientGoneError', String(error));
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM customers WHERE name = ?').get(name));
  assert.ok(!row, 'the write went with the transaction');
  assert.equal(pool.totalCount, pool.idleCount, 'every connection is back');
});
