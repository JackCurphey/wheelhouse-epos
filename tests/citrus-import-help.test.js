// Ask us to help, the server (openspec/changes/citrus-import-fix, design 15; mv-help;
// Jack, 15 Oct). The inbox is pretend: nothing leaves the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { sendHelp } from '../server/move/help-inbox.js';
import { aSite, body, browser, code, inShop, key, owner, prepare, send, server, staff, staffFreshCookie, staffRequest } from './helpers/move-fix-kit.js';

test('Ask us to help is recorded once with the card and who asked, and nothing from the rows', async () => {
  const requestKey = key();
  const payload = { text: '  [What Jack wrote]  ', card: 'Here’s what came across', requestKey };
  const [a, b] = await Promise.all([staff('/api/move/help', { method: 'POST', body: payload }), staff('/api/move/help', { method: 'POST', body: payload })]);
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  const rows = await inShop(() => prepare('SELECT * FROM move_help_requests WHERE what_looks_wrong = ?').all('[What Jack wrote]'));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].card, rows[0].asked_by_name, rows[0].asked_by_login_id, rows[0].provider_id], ['Here’s what came across', 'Jack Lewis', owner.loginId, 'pretend']);
  assert.ok(rows[0].reply_to.includes('@'), 'where a reply goes');
  assert.equal((await staff('/api/move/help', { method: 'POST', body: { ...payload, text: 'something else' } })).body.code, 'reused_key');
});

test('Ask us to help waits for something written, and asks for a card and a key', async () => {
  const post = (b) => staff('/api/move/help', { method: 'POST', body: b });
  assert.equal((await post({ text: '   ', card: 'x', requestKey: key() })).status, 400);
  assert.equal((await post({ text: 'x', card: '', requestKey: key() })).status, 400);
  assert.equal((await post({ text: 'x', card: 'x' })).status, 400);
  assert.equal((await post({ text: 'x'.repeat(4001), card: 'x', requestKey: key() })).status, 400);
  assert.equal((await post({ text: 5, card: 'x', requestKey: key() })).status, 400);
});

test('a help request that couldn\'t be sent stays recorded and unsent, and trying again doesn\'t add a second', async () => {
  const hash = key();
  const ask = { text: '[What Jack wrote, unsent]', card: '[Card]', who: { loginId: owner.loginId, employeeId: null, name: 'Jack Lewis' }, replyTo: 'jack@example.test', shopName: 'North Street Cycles', keyHash: hash, bodyHash: 'b' };
  const failing = { send: async () => { throw new Error('no connection'); } };
  await inShop(() => assert.rejects(sendHelp(ask, failing), /no connection/));
  const stored = () => inShop(() => prepare('SELECT provider_id FROM move_help_requests WHERE request_key_hash = ?').all(hash));
  assert.deepEqual(await stored(), [{ provider_id: null }]);
  const seen = [];
  const working = { send: async (what) => { seen.push(what); return { providerId: 'pretend' }; } };
  await inShop(() => sendHelp(ask, working));
  assert.deepEqual(await stored(), [{ provider_id: 'pretend' }]);
  assert.deepEqual(Object.keys(seen[0]).sort(), ['card', 'replyTo', 'shopName', 'text', 'who']);
  // Already sent: not sent again.
  await inShop(() => sendHelp(ask, working));
  assert.equal(seen.length, 1);
});

test('Ask us to help on a till with nobody checked in is refused, and only the Owner asks', async () => {
  const b = browser();
  assert.equal((await b.post('/api/till-setup', { siteId: (await aSite()).id, number: 2 })).status, 201);
  const res = await b.post('/api/move/help', { text: '[What Jack wrote]', card: 'Here’s what came across', requestKey: key() });
  assert.deepEqual([res.status, res.body.code], [409, 'check_in_first']);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  const jo = await staffFreshCookie(made.body.loginId);
  assert.equal((await staffRequest(server.baseUrl, jo, '/api/move/help', { method: 'POST', body: { text: 'x', card: 'x', requestKey: key() } })).status, 403);
});
