// A request's body is read before it takes a database connection, so clients
// that send part of a body and go quiet can't hold the connections every shop
// needs (openspec/changes/body-read-first). Real sockets against a real server,
// each test with a time limit, so a break fails rather than hangs.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { encryptSecret } from '../server/shopify.js';
import { createServer } from 'node:http';
import { createBodyReadGate, readBodyFirst } from '../server/lib/read-body-first.js';
import { holdRequestBody, readJsonBody, readRawBody } from '../server/lib/http.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { registerTill, tillRequest } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

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

const head = (method, path, headers = {}) => [
  `${method} ${path} HTTP/1.1`, 'Host: 127.0.0.1', 'Content-Type: application/json',
  ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), '', '',
].join('\r\n');
const sized = (length, headers = {}) => ({ 'Content-Length': length, ...headers });

// A socket that remembers what came back and whether it has closed.
async function open(baseUrl) {
  const socket = connect(new URL(baseUrl).port, '127.0.0.1');
  socket.on('error', () => {});
  const state = { socket, text: '', closed: false };
  socket.on('data', (d) => { state.text += d.toString('latin1'); });
  socket.on('close', () => { state.closed = true; });
  await once(socket, 'connect');
  return state;
}
async function until(what, ms, check) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`${what}: nothing after ${ms}ms`);
    await pause(10);
  }
}
const statuses = (text) => [...text.matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => Number(m[1]));

// `count` clients that send the headers and part of a body and then either go
// quiet or send one more byte now and again. Returns how to end them.
async function stalled(baseUrl, count, { path, headers = {}, length = 5000, method = 'POST', trickleMs = 0 }) {
  const clients = [];
  for (let i = 0; i < count; i++) {
    const client = await open(baseUrl);
    const extra = typeof headers === 'function' ? headers(i) : headers;
    client.socket.write(head(method, path, sized(length, extra)) + '{"a');
    clients.push(client);
  }
  const trickle = trickleMs ? setInterval(() => {
    for (const c of clients) if (!c.closed) c.socket.write('x');
  }, trickleMs) : null;
  return {
    clients,
    end() {
      if (trickle) clearInterval(trickle);
      for (const c of clients) c.socket.destroy();
    },
  };
}

let server;
let owner;
let other;
let till;
const staffOf = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

// Another shop's work, and the health check: all answered, and quickly. An
// exhausted pool answers 500 and 503 only after its 5-second wait.
async function assertOthersAnswered(what) {
  const start = Date.now();
  const health = await within(4000, `${what}: the health check`, fetch(`${server.baseUrl}/healthz`));
  assert.equal(health.status, 200, `${what}: the health check`);
  const list = await within(4000, `${what}: another shop's staff`, staffOf(other, '/api/customers'));
  assert.equal(list.status, 200, `${what}: another shop's staff`);
  const write = await within(4000, `${what}: another shop's staff sending a body`, staffOf(other, '/api/customers', { method: 'POST', body: {} }));
  assert.equal(write.status, 400, `${what}: another shop's staff sending a body`);
  const sync = await within(4000, `${what}: a till`, tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { items: [] } }));
  assert.equal(sync.status, 200, `${what}: a till`);
  assert.ok(Date.now() - start < 4000, `${what}: took ${Date.now() - start}ms`);
}

before(async () => {
  server = await startLiveServer();
  try {
    owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
    other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
    till = await registerTill(server.baseUrl, owner);
  } finally {
    await server.stop();
  }
});
after(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
    if (other) await deleteTestShop(other.shop.id);
  } finally {
    await pool.end();
  }
});

// Each on a server of its own: a pool one test used up can't fail the next.
const live = (name, fn, env = {}) => test(name, { timeout: 90_000 }, async () => {
  server = await startLiveServer({ env });
  try {
    await fn();
  } finally {
    await server.stop();
  }
});
const bookings = () => `/api/portal/${owner.shop.slug}/bookings`;

// ---------- Clients that go quiet, with no sign-in ----------

for (const count of [10, 50]) {
  live(`${count} clients gone quiet part-way through a public body hold up nobody`, async () => {
    const stall = await stalled(server.baseUrl, count, { path: bookings() });
    try {
      await pause(300);
      await assertOthersAnswered(`${count} quiet`);
    } finally {
      stall.end();
    }
  });

  live(`${count} clients sending one byte at a time hold up nobody`, async () => {
    const stall = await stalled(server.baseUrl, count, { path: bookings(), trickleMs: 200 });
    try {
      await pause(1000);
      await assertOthersAnswered(`${count} trickling`);
    } finally {
      stall.end();
    }
  });
}

live('10 signed-in staff gone quiet part-way through a body hold up nobody either', async () => {
  const stall = await stalled(server.baseUrl, 10, { path: '/api/customers', headers: { Cookie: owner.cookie } });
  try {
    await pause(300);
    await assertOthersAnswered('staff quiet');
  } finally {
    stall.end();
  }
});

live('10 tills gone quiet part-way through a sync hold up nobody either', async () => {
  const stall = await stalled(server.baseUrl, 10, { path: `/api/till/${owner.shop.slug}/sync`, headers: { Authorization: `Bearer ${till.token}` } });
  try {
    await pause(300);
    await assertOthersAnswered('tills quiet');
  } finally {
    stall.end();
  }
});

live('10 clients gone quiet at each no-sign-in door: signing in, a customer, a webhook', async () => {
  for (const path of ['/api/auth/login', `/api/portal/${owner.shop.slug}/login`, `/webhooks/shopify/${owner.shop.id}/orders`]) {
    const stall = await stalled(server.baseUrl, 10, { path });
    try {
      await pause(200);
      await assertOthersAnswered(path);
    } finally {
      stall.end();
    }
    await pause(100);
  }
});

// ---------- The deadline ----------

const DEADLINES = { WH_BODY_DEADLINE_MS: '1500', WH_UPLOAD_BODY_DEADLINE_MS: '4000' };

for (const [name, trickleMs] of [['gone quiet', 0], ['still sending one byte at a time', 100]]) {
  live(`a body not finished by the deadline gets 408 and the connection closes, ${name}`, async () => {
    const stall = await stalled(server.baseUrl, 1, { path: `/api/portal/${owner.shop.slug}/login`, trickleMs });
    try {
      const [client] = stall.clients;
      await until('the 408', 3500, () => client.text.includes('HTTP/1.1 408'));
      await until('the close', 2000, () => client.closed);
    } finally {
      stall.end();
    }
  }, DEADLINES);
}

live('the deadline is at every door with no sign-in, and for a till and for staff', async () => {
  const doors = {
    'staff signing in': { path: '/api/auth/login' },
    'a customer signing in': { path: `/api/portal/${owner.shop.slug}/login` },
    'the shop\'s website': { path: `/api/portal/${owner.shop.slug}/booking-links/nope/cancel` },
    'a Shopify webhook': { path: `/webhooks/shopify/${owner.shop.id}/orders` },
    'a till': { path: `/api/till/${owner.shop.slug}/sync`, headers: { Authorization: `Bearer ${till.token}` } },
    'signed-in staff': { path: '/api/customers', headers: { Cookie: owner.cookie } },
  };
  const all = await Promise.all(Object.values(doors).map((door) => stalled(server.baseUrl, 1, door)));
  try {
    await pause(3000);
    Object.keys(doors).forEach((what, i) => assert.match(all[i].clients[0].text, /HTTP\/1\.1 408/, what));
  } finally {
    for (const stall of all) stall.end();
  }
}, DEADLINES);

live('a deadline frees the client\'s place: a quiet caller can\'t keep it', async () => {
  const stall = await stalled(server.baseUrl, 10, { path: bookings(), length: 200_000 });
  stall.end();
  const login = await stalled(server.baseUrl, 10, { path: `/api/portal/${owner.shop.slug}/login` });
  try {
    await until('all answered 408', 4000, () => login.clients.every((c) => c.text.includes('HTTP/1.1 408')));
  } finally {
    login.end();
  }
  const res = await within(3000, 'the next', fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.notEqual(res.status, 429);
}, DEADLINES);

live('an upload route has the longer deadline: past the small one it is still being read', async () => {
  const stall = await stalled(server.baseUrl, 1, { path: `/api/portal/${owner.shop.slug}/photo-codes/nope` });
  try {
    const [client] = stall.clients;
    await pause(2200);
    assert.equal(client.text, '', 'the small deadline did not apply');
    await until('the 408', 3500, () => client.text.includes('HTTP/1.1 408'));
  } finally {
    stall.end();
  }
}, DEADLINES);

live('a slow, honest body inside the limit is read and answered', async () => {
  const body = JSON.stringify({ name: 'Maya Patel', phone: '07700 900142' });
  const client = await open(server.baseUrl);
  client.socket.write(head('POST', '/api/customers', sized(body.length, { Cookie: owner.cookie })));
  for (const ch of body) {
    client.socket.write(ch);
    await pause(1000 / body.length);
  }
  await until('the answer', 3000, () => statuses(client.text).length > 0);
  assert.deepEqual(statuses(client.text), [201], client.text);
  client.socket.destroy();
}, DEADLINES);

live('a slow, honest upload past the small deadline is still read and answered', async () => {
  const body = JSON.stringify({ dataBase64: 'A'.repeat(600_000) });
  const client = await open(server.baseUrl);
  client.socket.write(head('POST', `/api/products/999999/photo`, sized(body.length, { Cookie: owner.cookie })));
  const parts = 25;
  for (let i = 0; i < parts; i++) {
    client.socket.write(body.slice(Math.floor((i * body.length) / parts), Math.floor(((i + 1) * body.length) / parts)));
    await pause(100);
  }
  await until('the answer', 3000, () => statuses(client.text).length > 0);
  assert.deepEqual(statuses(client.text), [404], 'read whole, then no such product');
  client.socket.destroy();
}, DEADLINES);

// ---------- How many can be read at once ----------

const refusedCount = (clients) => clients.filter((c) => c.text.includes('HTTP/1.1 429')).length;

live('one address gets 10 reads at once; the rest are refused and closed, and a spoofed address changes nothing', async () => {
  const stall = await stalled(server.baseUrl, 13, { path: bookings(), headers: (i) => ({ 'X-Forwarded-For': `203.0.113.${i + 1}` }) });
  try {
    await until('the refusals', 3000, () => refusedCount(stall.clients) === 3);
    await until('the closes', 3000, () => stall.clients.filter((c) => c.closed).length === 3);
    await assertOthersAnswered('over the limit');
  } finally {
    stall.end();
  }
  await pause(200);
  // Their places come back when they end.
  const res = await within(3000, 'the next', fetch(server.baseUrl + bookings(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.notEqual(res.status, 429);
});

live('behind a trusted proxy each real address has its own limit', async () => {
  const stall = await stalled(server.baseUrl, 13, { path: bookings(), headers: (i) => ({ 'X-Forwarded-For': `203.0.113.${i + 1}` }) });
  const same = await stalled(server.baseUrl, 11, { path: bookings(), headers: { 'X-Forwarded-For': '198.51.100.9' } });
  try {
    await until('the one refused', 3000, () => refusedCount(same.clients) === 1);
    assert.equal(refusedCount(stall.clients), 0);
  } finally {
    stall.end();
    same.end();
  }
}, { TRUST_PROXY: '1' });

live('the whole gate has a limit, and signed-in staff and tills are outside it', async () => {
  const stall = await stalled(server.baseUrl, 205, { path: bookings(), headers: (i) => ({ 'X-Forwarded-For': `203.0.${100 + Math.floor(i / 250)}.${i % 250}` }) });
  try {
    await until('the refused', 5000, () => refusedCount(stall.clients) === 5);
    const write = await within(4000, 'staff', staffRequest(server.baseUrl, other.cookie, '/api/customers', { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.1' }, body: {} }));
    assert.equal(write.status, 400);
  } finally {
    stall.end();
  }
}, { TRUST_PROXY: '1' });

live('the bytes held for one address have a limit, and come back when its requests are over', async () => {
  const twelveMb = Buffer.alloc(12 * 1024 * 1024, 'x');
  const clients = [];
  for (let i = 0; i < 9; i++) {
    const client = await open(server.baseUrl);
    client.socket.write(head('POST', bookings(), sized(40 * 1024 * 1024)));
    client.socket.write(twelveMb);
    clients.push(client);
  }
  try {
    await until('over 100 MB refused', 15_000, () => refusedCount(clients) >= 1);
    await assertOthersAnswered('over the bytes');
  } finally {
    for (const c of clients) c.socket.destroy();
  }
  await pause(300);
  // 14 MB would not have fitted if what they held hadn't been given back.
  const res = await within(10_000, 'the next', fetch(server.baseUrl + bookings(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(14 * 1024 * 1024) }) }));
  assert.notEqual(res.status, 429);
});

live('over the limit, a request with no body is still answered: reading the website isn\'t a read', async () => {
  const stall = await stalled(server.baseUrl, 12, { path: bookings() });
  try {
    await until('the refusals', 3000, () => refusedCount(stall.clients) === 2);
    const page = await within(3000, 'a page', fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/services`));
    assert.equal(page.status, 200);
    const empty = await within(3000, 'an empty POST', fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/nope/cancel`, { method: 'POST' }));
    assert.notEqual(empty.status, 429);
  } finally {
    stall.end();
  }
});

// ---------- Honest customers, and who shares what ----------

live('100 complete small requests at once from one address: none refused', async () => {
  const answers = await Promise.all(Array.from({ length: 100 }, () => within(20_000, 'an answer',
    fetch(server.baseUrl + bookings(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status))));
  assert.deepEqual(answers.filter((status) => status === 429), [], 'the database pool limits the work, not this');
});

const doors = () => ({
  'the website': bookings(),
  'a customer signing in': `/api/portal/${owner.shop.slug}/login`,
  'staff signing in': '/api/auth/login',
  'a Shopify webhook': `/webhooks/shopify/${owner.shop.id}/orders`,
});

for (const door of ['the website', 'a customer signing in', 'staff signing in', 'a Shopify webhook']) {
  live(`${door}: one address gets 10 reads at once, whatever else it does`, async () => {
    const stall = await stalled(server.baseUrl, 11, { path: doors()[door] });
    try {
      await until('the one refused', 3000, () => refusedCount(stall.clients) === 1);
    } finally {
      stall.end();
    }
  });
}

live('10 stalled bookings from an address leave its staff signing in, and webhooks, alone; customers share them', async () => {
  const stall = await stalled(server.baseUrl, 10, { path: bookings() });
  try {
    await pause(200);
    const post = (path) => within(4000, path, fetch(server.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status));
    assert.notEqual(await post('/api/auth/login'), 429, 'staff signing in');
    assert.notEqual(await post(doors()['a Shopify webhook']), 429, 'a webhook');
    assert.equal(await post(doors()['a customer signing in']), 429, 'customers and bookings share a gate');
  } finally {
    stall.end();
  }
});

// ---------- Staff and tills: memory, per shop ----------

const TEN_MB = Buffer.alloc(10 * 1024 * 1024, 'x');

live('one shop\'s stalled uploads stop at its limit on bytes; another shop and the public aren\'t touched', async () => {
  const clients = [];
  for (let i = 0; i < 16; i++) {
    const client = await open(server.baseUrl);
    client.socket.write(head('POST', '/api/workshop-jobs/999999/attachments', sized(20 * 1024 * 1024, { Cookie: owner.cookie })));
    client.socket.write(TEN_MB);
    clients.push(client);
  }
  try {
    await until('over 150 MB refused', 15_000, () => refusedCount(clients) >= 1);
    await until('at most 150 MB held', 3000, () => clients.filter((c) => !c.closed).length <= 15);
    const theirs = await open(server.baseUrl);
    theirs.socket.write(head('POST', '/api/workshop-jobs/999999/attachments', sized(20 * 1024 * 1024, { Cookie: other.cookie })));
    theirs.socket.write(TEN_MB);
    await pause(300);
    assert.equal(refusedCount([theirs]), 0, 'another shop has its own');
    theirs.socket.destroy();
    const pub = await within(4000, 'a booking', fetch(server.baseUrl + bookings(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    assert.notEqual(pub.status, 429);
  } finally {
    for (const c of clients) c.socket.destroy();
  }
  await pause(300);
  const again = await within(4000, 'the shop again', staffOf(owner, '/api/customers', { method: 'POST', body: {} }));
  assert.equal(again.status, 400, 'its bytes came back');
});

live('a shop\'s stalled till syncs stop at the same limit', async () => {
  const part = Buffer.alloc(1_900_000, 'x');
  const clients = [];
  for (let i = 0; i < 85; i++) {
    const client = await open(server.baseUrl);
    client.socket.write(head('POST', `/api/till/${owner.shop.slug}/sync`, sized(1_950_000, { Authorization: `Bearer ${till.token}` })));
    client.socket.write(part);
    clients.push(client);
  }
  try {
    await until('over 150 MB refused', 15_000, () => refusedCount(clients) >= 1);
  } finally {
    for (const c of clients) c.socket.destroy();
  }
});

live('the upload deadline is on every upload route, and not on a small one', async () => {
  const uploads = {
    'a booking': { path: bookings() },
    'a photo for a line': { path: `/api/portal/${owner.shop.slug}/photo-codes/nope` },
    'a job\'s attachment': { path: '/api/workshop-jobs/999999/attachments', headers: { Cookie: owner.cookie } },
    'a product photo': { path: '/api/products/999999/photo', headers: { Cookie: owner.cookie } },
    'the logo': { path: '/api/storefront-settings/logo', headers: { Cookie: owner.cookie } },
    'the hero image': { path: '/api/storefront-settings/hero', headers: { Cookie: owner.cookie } },
    'a Citrus Lime file': { path: '/api/move/files', headers: { Cookie: owner.cookie } },
  };
  const all = await Promise.all(Object.values(uploads).map((u) => stalled(server.baseUrl, 1, u)));
  try {
    await pause(2200);
    Object.keys(uploads).forEach((what, i) => assert.equal(all[i].clients[0].text, '', `${what}: past the small deadline, still being read`));
    await until('the long deadline', 4000, () => all.every((a) => a.clients[0].text.includes('HTTP/1.1 408')));
  } finally {
    for (const a of all) a.end();
  }
}, DEADLINES);

// ---------- Paying for an order ----------

live('a payment on an order holds the order only once its whole body has arrived', async () => {
  const made = await staffOf(other, '/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15, minutes: 20 }] } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const path = `/api/sale-documents/${made.body.id}/convert`;

  // Held by another connection, so a route that had already opened its
  // transaction and locked the order would wait here rather than answer.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(other.shop.id)]);
    await client.query('SELECT id FROM sale_documents WHERE id = $1 FOR UPDATE', [made.body.id]);
    const res = await within(3000, 'a body that can\'t be read', fetch(server.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie: other.cookie }, body: '{"not json' }));
    assert.equal(res.status, 500);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }

  const stall = await stalled(server.baseUrl, 1, { path, headers: { Cookie: other.cookie } });
  try {
    await pause(200);
    // A second try at the same order isn't kept waiting by the first.
    const second = await within(3000, 'a second payment', staffOf(other, path, { method: 'POST', body: { cashAmount: 0 } }));
    assert.ok(second.status < 500, JSON.stringify(second.body));
  } finally {
    stall.end();
  }
});

// ---------- A large upload still works, on every upload route ----------

const THREE_MB = 'A'.repeat(3_000_000);

live('every upload route still takes a body far over the 2 MB of a small one', async () => {
  const job = (await staffOf(owner, '/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-05' } })).body;
  const product = (await staffOf(owner, '/api/products', { method: 'POST', body: { name: 'Inner tube', sku: `TUBE-${owner.shop.id}`, price: 6.99 } })).body;
  assert.ok(job.id && product.id);
  const uploads = {
    'a job\'s attachment': [`/api/workshop-jobs/${job.id}/attachments`, { filename: 'report.pdf', contentType: 'application/pdf', dataBase64: THREE_MB }, 201],
    // Refused for the image being no image: so it was read, whole.
    'a product photo': [`/api/products/${product.id}/photo`, { contentType: 'text/plain', dataBase64: THREE_MB }, 400],
    'the shop logo': ['/api/storefront-settings/logo', { contentType: 'text/plain', dataBase64: THREE_MB }, 400],
    'the hero image': ['/api/storefront-settings/hero', { contentType: 'text/plain', dataBase64: THREE_MB }, 400],
    'a Citrus Lime file': ['/api/move/files', { fileName: 'a.xlsx', dataBase64: THREE_MB }, 400],
  };
  for (const [what, [path, body, status]] of Object.entries(uploads)) {
    const res = await within(15_000, what, staffOf(owner, path, { method: 'POST', body }));
    assert.equal(res.status, status, `${what}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  // As big as a Citrus Lime file gets, read whole: refused only for having no request key.
  const whole = await within(30_000, 'a full-size Citrus Lime file', staffOf(owner, '/api/move/files', { method: 'POST', body: { fileName: 'a.xlsx', dataBase64: 'A'.repeat(Math.ceil(30 * 1024 * 1024 * 1.33)) } }));
  assert.equal(whole.status, 400, JSON.stringify(whole.body).slice(0, 200));
  assert.match(whole.body.error, /request key/i);
  for (const [what, path, status] of [
    ['a photo for a line', `/api/portal/${owner.shop.slug}/photo-codes/nope`, 400],
    ['a booking with photos', bookings(), 400],
  ]) {
    const res = await within(15_000, what, fetch(server.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataBase64: THREE_MB }) }));
    assert.equal(res.status, status, what);
    assert.doesNotMatch(await res.text(), /too large/i, what);
  }
});

// ---------- Normal requests are as they were ----------

async function exchange(raw, count, ms = 4000) {
  const client = await open(server.baseUrl);
  client.socket.write(raw);
  await until(`${count} answers`, ms, () => statuses(client.text).length >= count);
  return client;
}
const customer = (extra = {}) => JSON.stringify({ name: 'Maya Patel', phone: '07700 900142', ...extra });

live('normal: keep-alive, pipelined, chunked, Expect 100-continue, empty', async () => {
  const cookie = { Cookie: owner.cookie };

  const kept = await open(server.baseUrl);
  kept.socket.write(head('POST', '/api/customers', sized(2, cookie)) + '{}');
  await until('the first', 3000, () => statuses(kept.text).length === 1);
  const body = customer();
  kept.socket.write(head('POST', '/api/customers', sized(body.length, cookie)) + body);
  await until('the second, on the same connection', 3000, () => statuses(kept.text).length === 2);
  assert.deepEqual(statuses(kept.text), [400, 201], 'keep-alive');
  assert.equal(kept.closed, false);
  kept.socket.destroy();

  const piped = await exchange(`${head('POST', '/api/customers', sized(2, cookie))}{}${head('GET', '/healthz')}${head('POST', '/api/customers', sized(body.length, cookie))}${body}`, 3);
  assert.deepEqual(statuses(piped.text), [400, 200, 201], 'pipelined, in order');
  piped.socket.destroy();

  const chunked = await open(server.baseUrl);
  chunked.socket.write(head('POST', '/api/customers', { 'Transfer-Encoding': 'chunked', ...cookie }));
  const half = Math.floor(body.length / 2);
  for (const part of [body.slice(0, half), body.slice(half)]) {
    chunked.socket.write(`${part.length.toString(16)}\r\n${part}\r\n`);
    await pause(50);
  }
  chunked.socket.write('0\r\n\r\n');
  await until('the chunked answer', 3000, () => statuses(chunked.text).length === 1);
  assert.deepEqual(statuses(chunked.text), [201], 'chunked');
  chunked.socket.destroy();

  const expect = await open(server.baseUrl);
  expect.socket.write(head('POST', '/api/customers', sized(body.length, { Expect: '100-continue', ...cookie })));
  await until('the 100', 3000, () => expect.text.includes('HTTP/1.1 100'));
  expect.socket.write(body);
  await until('the final answer', 3000, () => statuses(expect.text).length === 2);
  assert.deepEqual(statuses(expect.text), [100, 201], 'Expect: 100-continue');
  expect.socket.destroy();

  for (const [what, headers] of [['Content-Length: 0', sized(0, cookie)], ['no length at all', cookie]]) {
    const empty = await exchange(head('POST', '/api/customers', headers), 1);
    assert.deepEqual(statuses(empty.text), [400], `empty: ${what}`);
    empty.socket.destroy();
  }
});

live('normal: the size limit, just under and just over, and a too-big booking answered', async () => {
  const cookie = { Cookie: owner.cookie };
  const under = JSON.stringify({ padding: 'x'.repeat(2_000_000 - 14) });
  assert.ok(under.length <= 2_000_000);
  const fits = await exchange(head('POST', '/api/customers', sized(under.length, cookie)) + under, 1, 8000);
  assert.deepEqual(statuses(fits.text), [400], 'read whole, then refused for its contents');
  fits.socket.destroy();

  // Over: cut off with no answer, as it always has been on a small route.
  const over = await open(server.baseUrl);
  over.socket.write(head('POST', '/api/customers', sized(2_000_001, cookie)));
  over.socket.write('x'.repeat(2_000_001));
  await until('the cut', 8000, () => over.closed);
  assert.deepEqual(statuses(over.text), []);

  // A booking too big is told so, in words, and closed.
  const size = Math.ceil(5 * 10 * 1024 * 1024 * 1.4) + 1000;
  const big = await open(server.baseUrl);
  big.socket.write(head('POST', bookings(), sized(size)));
  big.socket.write(Buffer.alloc(size, 'x'));
  await until('the answer', 30_000, () => statuses(big.text).length === 1);
  assert.deepEqual(statuses(big.text), [400]);
  assert.match(big.text, /too large to send/);
  assert.match(big.text, /connection: close/i);
  big.socket.destroy();

  // More than twice that isn't worth reading to the end: cut off.
  const huge = await open(server.baseUrl);
  huge.socket.write(head('POST', bookings(), sized(3 * size)));
  huge.socket.write(Buffer.alloc(3 * size, 'x'));
  await until('the cut', 30_000, () => huge.closed);
  assert.deepEqual(statuses(huge.text), []);

  await assertOthersAnswered('after the size limits');
});

live('normal: a webhook split inside a character with a good signature, and a bad signature', async () => {
  const secret = 'body-read-first-webhook-secret';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(other.shop.id)]);
    await client.query(
      `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
       VALUES ($1, $2, $3, $4, $5, '1', 'connected') ON CONFLICT DO NOTHING`,
      [other.shop.id, `body-first-${other.shop.id}.fake-shopify.invalid`, encryptSecret('fake'), encryptSecret('fake'), encryptSecret(secret)]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const path = `/webhooks/shopify/${other.shop.id}/orders`;
  // An order with nothing to sell: all this is about is the bytes the signature covers.
  const body = Buffer.from(JSON.stringify({ id: Date.now(), order_number: 1, note: 'Pâté £5', line_items: [] }), 'utf8');
  const good = createHmac('sha256', secret).update(body).digest('base64');
  const inside = body.indexOf(Buffer.from('£')) + 1;

  const split = await open(server.baseUrl);
  split.socket.write(head('POST', path, sized(body.length, { 'X-Shopify-Hmac-Sha256': good })));
  split.socket.write(body.subarray(0, inside));
  await pause(100);
  split.socket.write(body.subarray(inside));
  await until('the answer', 4000, () => statuses(split.text).length === 1);
  assert.deepEqual(statuses(split.text), [200], split.text);
  split.socket.destroy();

  const bad = await exchange(Buffer.concat([Buffer.from(head('POST', path, sized(body.length, { 'X-Shopify-Hmac-Sha256': 'bm90IGl0' }))), body]), 1);
  assert.deepEqual(statuses(bad.text), [401]);
  bad.socket.destroy();
});

// ---------- The limits, counted exactly ----------

test('the limits: reads at once, bytes held, per key and overall, and all given back', () => {
  const gate = createBodyReadGate({ readsPerKey: 2, reads: 3, bytesPerKey: 100, bytes: 150 });
  const a1 = gate.enter('a');
  const a2 = gate.enter('a');
  assert.ok(a1 && a2);
  assert.equal(gate.enter('a'), null, 'the key is full');
  const b1 = gate.enter('b');
  assert.ok(b1);
  assert.equal(gate.enter('c'), null, 'the gate is full');

  assert.equal(a1.hold(60), true);
  assert.equal(a2.hold(41), false, 'over the key\'s bytes');
  assert.equal(a2.hold(40), true);
  assert.equal(b1.hold(51), false, 'over all the bytes');
  assert.equal(b1.hold(50), true);

  // The read over: its place is free, its bytes aren't yet, and twice changes nothing.
  a1.readDone();
  a1.readDone();
  const a3 = gate.enter('a');
  assert.ok(a3, 'a place back, once');
  assert.equal(gate.enter('a'), null);
  assert.equal(a3.hold(1), false, 'the bytes are still held');

  a1.leave();
  a1.leave();
  assert.equal(a3.hold(60), true, 'and back when the request is over, once');
  assert.equal(a3.hold(1), false);
  for (const place of [a2, a3, b1]) place.leave();
  assert.ok(gate.enter('a') && gate.enter('a') && gate.enter('b'), 'all free again');
});

test('a body read twice: the second read is refused', async () => {
  for (const read of [readJsonBody, readRawBody]) {
    const req = {};
    holdRequestBody(req, { chunks: [Buffer.from('{}')], bytes: 2, overflowed: false });
    await read(req);
    await assert.rejects(within(1000, 'the second read', read(req)), /already read/);
  }
});

// ---------- The read itself, with the timing fixed ----------

// A request and its answer on a real connection, and the client's socket.
async function onRequest(handler, sent) {
  const srv = createServer((req, res) => { handler(req, res); });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const client = await open(`http://127.0.0.1:${srv.address().port}`);
  client.socket.write(sent);
  return { client, close: () => { srv.closeAllConnections(); return new Promise((r) => { srv.close(r); }); } };
}

test('a client gone before the read starts: nothing to wait for', { timeout: 15_000 }, async () => {
  let going;
  let heard;
  const arrived = new Promise((r) => { heard = r; });
  let result;
  const { client, close } = await onRequest(async (req, res) => {
    heard();
    await new Promise((r) => { req.once('close', r); });
    going = readBodyFirst(req, res);
    result = await going;
  }, `${head('POST', '/', sized(2))}{}`);
  try {
    await within(3000, 'the request', arrived);
    client.socket.resetAndDestroy();
    await until('the read to end', 1000, () => result !== undefined);
    assert.equal(result, false);
  } finally {
    await close();
  }
});

test('a request with no body and a client gone before its read: read as empty, not an error', { timeout: 15_000 }, async () => {
  let heard;
  const arrived = new Promise((r) => { heard = r; });
  let read;
  const { client, close } = await onRequest(async (req, res) => {
    heard();
    await new Promise((r) => { req.once('close', r); });
    assert.equal(await readBodyFirst(req, res), true);
    read = await readJsonBody(req).then((value) => ({ value }), (error) => ({ error }));
  }, head('POST', '/', sized(0)));
  try {
    await within(3000, 'the request', arrived);
    client.socket.resetAndDestroy();
    await until('the read to end', 1000, () => read !== undefined);
    assert.deepEqual(read, { value: {} });
  } finally {
    await close();
  }
});

test('a request closed with no error during the read: it ends', { timeout: 15_000 }, async () => {
  let result;
  const { close } = await onRequest(async (req, res) => {
    setTimeout(() => req.destroy(), 50);
    result = await readBodyFirst(req, res);
  }, `${head('POST', '/', sized(100))}{"a`);
  try {
    await until('the read to end', 1000, () => result !== undefined);
    assert.equal(result, false);
  } finally {
    await close();
  }
});

test('a client gone during the read: it ends, with nothing answered', { timeout: 15_000 }, async () => {
  let result;
  let response;
  let heard;
  const arrived = new Promise((r) => { heard = r; });
  const { client, close } = await onRequest(async (req, res) => {
    response = res;
    heard();
    result = await readBodyFirst(req, res);
  }, `${head('POST', '/', sized(100))}{"a`);
  try {
    await within(3000, 'the request', arrived);
    await pause(50);
    client.socket.resetAndDestroy();
    await until('the read to end', 1000, () => result !== undefined);
    assert.equal(result, false);
    assert.equal(response.headersSent, false);
  } finally {
    await close();
  }
});

// ---------- A place and its bytes, with the timing fixed ----------

const testGate = () => createBodyReadGate({ readsPerKey: 1, reads: 1, bytesPerKey: 10, bytes: 10 });
const allBack = (gate) => {
  const place = gate.enter('a');
  if (!place) return false;
  const fits = place.hold(10);
  place.leave();
  return fits;
};

test('a place is held only while the body is read; its bytes until the answer has gone', { timeout: 15_000 }, async () => {
  const gate = testGate();
  let read;
  let respond;
  const { client, close } = await onRequest(async (req, res) => {
    read = await readBodyFirst(req, res, {}, { gate, key: 'a' });
    await new Promise((r) => { respond = r; });
    res.end('{}');
  }, `${head('POST', '/', sized(6))}{"a":`);
  try {
    await pause(50);
    assert.equal(gate.enter('a'), null, 'read not over: the place is taken');
    client.socket.write('1');
    await until('the read', 3000, () => read === true);
    const next = gate.enter('a');
    assert.ok(next, 'read over: the place is free');
    assert.equal(next.hold(10), false, 'answer not gone: the bytes are held');
    next.leave();
    respond();
    await until('the answer', 3000, () => statuses(client.text).length === 1);
    await until('the bytes back, the connection still open', 1000, () => allBack(gate));
    assert.equal(client.closed, false);
  } finally {
    await close();
  }
});

// A pipelined second response has no socket while the first is unanswered. On Node 22
// its 'close' never fires when the client goes. Every outcome must give everything back.
for (const [name, second, whenRead] of [
  ['all of its body read', `${head('POST', '/b', sized(5))}{"a":`, true],
  ['part of its body read', `${head('POST', '/b', sized(5))}{"`, false],
]) {
  test(`a pipelined request, ${name}, its client gone before the first is answered: everything comes back`, { timeout: 15_000 }, async () => {
    const gate = testGate();
    let reached;
    let result;
    const { client, close } = await onRequest(async (req, res) => {
      if (req.url === '/a') { reached = true; return; } // never answered
      result = await readBodyFirst(req, res, {}, { gate, key: 'a' });
    }, `${head('GET', '/a')}${second}`);
    try {
      await until('the first', 3000, () => reached);
      if (whenRead) await until('the read', 3000, () => result === true);
      else await pause(100);
      assert.equal(allBack(gate), false, 'something is held before the client goes');
      client.socket.resetAndDestroy();
      await until('all back', 2000, () => allBack(gate));
    } finally {
      await close();
    }
  });
}

test('a body refused for going over gives everything back', { timeout: 20_000 }, async () => {
  const gate = testGate();
  let result;
  const { client, close } = await onRequest(async (req, res) => {
    result = await readBodyFirst(req, res, {}, { gate, key: 'a' });
  }, head('POST', '/', sized(100)));
  try {
    await pause(50);
    client.socket.write('x'.repeat(20));
    await until('the refusal', 3000, () => result === false);
    await until('the answer', 3000, () => statuses(client.text).length === 1);
    assert.deepEqual(statuses(client.text), [429]);
    assert.equal(allBack(gate), true, 'too much for the gate');
  } finally {
    await close();
  }
});
