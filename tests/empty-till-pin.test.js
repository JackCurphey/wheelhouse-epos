// A till or workshop computer with nobody checked in could be anyone, so changes that
// touch products, prices or costs ask for a PIN there (openspec/changes/product-editing,
// the review): a Citrus Lime file sent, Fix and Leave it out; a category added or renamed;
// a supplier added or changed. Jack Lewis as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let pin;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const offer = await staffRequest(server.baseUrl, owner.cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.equal((await staffRequest(server.baseUrl, owner.cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status, 200);
  pin = offer.body.pin;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// The Owner's computer made a till, nobody checked in.
let tills = 0;
async function emptyTill() {
  const jar = new Map();
  const cookie = await staffFreshCookie(owner.loginId);
  const send = async (path, method = 'GET', body) => {
    const all = [cookie, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { cookie: all, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) { const [pair] = line.split(';'); const at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const site = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites')).body[0];
  tills += 1;
  assert.equal((await send('/api/till-setup', 'POST', { siteId: site.id, number: tills })).status, 201);
  return send;
}
const asksForPin = (res, what) => assert.deepEqual([res.status, res.body?.code], [409, 'check_in_first'], `${what}: ${JSON.stringify(res.body)}`);

test('a Citrus Lime file, Fix and Leave it out ask for a PIN at an empty till', async () => {
  const send = await emptyTill();
  asksForPin(await send('/api/move/files', 'POST', { fileName: '[Price list].csv', dataBase64: Buffer.from('a,b\n1,2\n').toString('base64'), requestKey: randomUUID() }), 'sending a file');
  asksForPin(await send('/api/move/rows/1/fix', 'POST', { requestKey: randomUUID(), seen: '', fields: {} }), 'Fix');
  asksForPin(await send('/api/move/rows/1/leave-out', 'POST', { requestKey: randomUUID(), seen: '' }), 'Leave it out');
  assert.equal((await send('/api/move')).status, 200, 'reading the page still works');
  // Checked in, the Owner gets past the PIN step.
  assert.equal((await send('/api/till-checkin', 'POST', { pin })).status, 201);
  const sent = await send('/api/move/files', 'POST', { fileName: '[Price list].csv', dataBase64: Buffer.from('a,b\n1,2\n').toString('base64'), requestKey: randomUUID() });
  assert.notEqual(sent.body?.code, 'check_in_first', JSON.stringify(sent.body));
});

test('adding or renaming a category asks for a PIN at an empty till', async () => {
  const made = (await staffRequest(server.baseUrl, owner.cookie, '/api/product-categories', { method: 'POST', body: { name: `[Cat ${randomUUID().slice(0, 4)}]` } })).body;
  const send = await emptyTill();
  asksForPin(await send('/api/product-categories', 'POST', { name: '[New]' }), 'adding');
  asksForPin(await send(`/api/product-categories/${made.id}`, 'PUT', { name: '[Renamed]' }), 'renaming');
});

test('adding or changing a supplier asks for a PIN at an empty till', async () => {
  const made = (await staffRequest(server.baseUrl, owner.cookie, '/api/suppliers', { method: 'POST', body: { name: `[Supplier ${randomUUID().slice(0, 4)}]`, adapterType: 'mock_csv' } })).body;
  const send = await emptyTill();
  asksForPin(await send('/api/suppliers', 'POST', { name: '[New supplier]', adapterType: 'mock_csv' }), 'adding');
  asksForPin(await send(`/api/suppliers/${made.id}`, 'PUT', { name: '[Renamed]' }), 'changing');
  assert.equal((await send('/api/till-checkin', 'POST', { pin })).status, 201);
  assert.equal((await send('/api/suppliers', 'POST', { name: '[Checked-in supplier]', adapterType: 'mock_csv' })).status, 201);
});
