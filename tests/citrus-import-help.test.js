// Ask us to help, the server (openspec/changes/citrus-import-fix, design 15; mv-help;
// Jack, 15 Oct). The inbox is pretend: nothing leaves the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { helpInbox, sendHelp } from '../server/move/help-inbox.js';
import { runWithShop } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { aSite, body, bring, browser, byAccount, code, customers, deleteTestShop, deleted, inShop, key, owner, person, prepare, send, server, staff, staffFreshCookie, staffRequest, staffSignup } from './helpers/move-fix-kit.js';

test('Ask us to help is recorded once with the card and who asked, and nothing from the rows', async () => {
  const requestKey = key();
  const payload = { text: '  [What Jack wrote]  ', card: 'Here’s what came across', requestKey };
  const [a, b] = await Promise.all([staff('/api/move/help', { method: 'POST', body: payload }), staff('/api/move/help', { method: 'POST', body: payload })]);
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  const rows = await inShop(() => prepare('SELECT * FROM move_help_requests WHERE what_looks_wrong = ?').all('[What Jack wrote]'));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].card, rows[0].asked_by_name, rows[0].asked_by_login_id, rows[0].provider_id], ['Here’s what came across', 'Jack Lewis', owner.loginId, 'pretend']);
  assert.equal(rows[0].reply_to, owner.email, 'where a reply goes');
  const reused = await staff('/api/move/help', { method: 'POST', body: { ...payload, text: 'something else' } });
  assert.equal(reused.body.code, 'reused_key');
  assert.ok(!/file/.test(reused.body.error), reused.body.error);
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

test('checked in at a till, the request records who by their check-in', async () => {
  const b = browser();
  assert.equal((await b.post('/api/till-setup', { siteId: (await aSite()).id, number: 3 })).status, 201);
  const offer = await b.post('/api/your-settings/till-pin/offer');
  assert.equal((await b.post('/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  assert.equal((await b.post('/api/till-checkin', { pin: offer.body.pin })).status, 201);
  const text = `[Asked at the till ${key().slice(0, 6)}]`;
  assert.equal((await b.post('/api/move/help', { text, card: '[Card]', requestKey: key() })).status, 200);
  const { employee_id: ownerEmployee } = await inShop(() => prepare('SELECT employee_id FROM logins WHERE id = ?').get(owner.loginId));
  assert.ok(ownerEmployee);
  const row = await inShop(() => prepare('SELECT asked_by_employee_id AS e FROM move_help_requests WHERE what_looks_wrong = ?').get(text));
  assert.equal(row.e, ownerEmployee);
});

test('another shop can\'t see or be given a row of move_help_requests', async () => {
  const requestKey = key();
  assert.equal((await staff('/api/move/help', { method: 'POST', body: { text: '[Only this shop]', card: '[Card]', requestKey } })).status, 200);
  const other = await staffSignup(server.baseUrl, { shopName: '[Another shop]' });
  try {
    const seen = await runWithShop(other.shop.id, () => prepare('SELECT id FROM move_help_requests').all());
    assert.deepEqual(seen, [], 'it reads none of the first shop\'s');
    await runWithShop(other.shop.id, () => assert.rejects(
      prepare(`INSERT INTO move_help_requests (shop_id, what_looks_wrong, card, asked_by_name, request_key_hash, request_body_hash) VALUES (?, 'x', 'x', 'x', ?, 'x') RETURNING id`).get(owner.shop.id, key()),
      /row-level security/
    ));
    const changed = await runWithShop(other.shop.id, () => prepare(`UPDATE move_help_requests SET card = 'x' RETURNING id`).all());
    assert.deepEqual(changed, []);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('removing a staff record who asked for help works, and the request stays with nobody named', async () => {
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  const { employee_id: employeeId } = await inShop(() => prepare('SELECT employee_id FROM logins WHERE id = ?').get(made.body.loginId));
  const marker = `[Asked by Jo ${key().slice(0, 6)}]`;
  const { id } = await inShop(() => prepare(`INSERT INTO move_help_requests (what_looks_wrong, card, asked_by_employee_id, asked_by_name, request_key_hash, request_body_hash) VALUES (?, 'x', ?, 'Jo Taylor', ?, 'x') RETURNING id`).get(marker, employeeId, key()));
  const res = await staff(`/api/employees/${employeeId}/permanent`, { method: 'DELETE' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await inShop(() => prepare('SELECT asked_by_employee_id AS e FROM move_help_requests WHERE id = ?').get(id))).e, null);
});

// ---- Which inbox: Jack, 4 Nov, answer 3 ----

test('the pretend inbox only where it\'s known to be safe: unknown means none', () => {
  for (const env of [{ WHEELHOUSE_HOSTED_COPY: '1', NODE_ENV: 'production' }, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }]) {
    assert.ok(helpInbox(env), JSON.stringify(env));
  }
  for (const env of [{}, { NODE_ENV: '' }, { NODE_ENV: 'production' }, { NODE_ENV: ' Production ' }, { NODE_ENV: 'staging' }, { NODE_ENV: 'production', WHEELHOUSE_HOSTED_COPY: '0' }, { NODE_ENV: 'production', WHEELHOUSE_HOSTED_COPY: 'true' }, { WHEELHOUSE_HOSTED_COPY: '' }]) {
    assert.equal(helpInbox(env), null, JSON.stringify(env));
  }
});

test('tests are offered it', async () => {
  assert.equal((await staff('/api/move')).body.helpOffered, true);
});

for (const [what, env] of [['production', { NODE_ENV: 'production' }], ['a server that doesn\'t say what it is', { NODE_ENV: '' }]]) {
  test(`on ${what}, with no real inbox: it isn't offered, it's refused, and nothing is kept`, async () => {
    const real = await startLiveServer({ env: { ...env, WHEELHOUSE_HOSTED_COPY: '', SHOPIFY_TOKEN_ENCRYPTION_KEY: '0'.repeat(64) } });
    try {
      const shop = await staffSignup(real.baseUrl, { shopName: '[A real shop]' });
      try {
        const call = (path, options) => staffRequest(real.baseUrl, shop.cookie, path, options);
        assert.equal((await call('/api/move')).body.helpOffered, false);
        const res = await call('/api/move/help', { method: 'POST', body: { text: '[What they wrote]', card: '[Card]', requestKey: key() } });
        assert.deepEqual([res.status, res.body.code], [503, 'no_inbox']);
        const kept = await runWithShop(shop.shop.id, () => prepare('SELECT id FROM move_help_requests').all());
        assert.deepEqual(kept, []);
      } finally {
        await deleteTestShop(shop.shop.id);
      }
    } finally {
      await real.stop();
    }
  });
}

// ---- A customer named in a request, then deleted: Jack, 4 Nov, answer 2 ----

const asked = async (text, card = '[Card]') => {
  const res = await staff('/api/move/help', { method: 'POST', body: { text, card, requestKey: key() } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return text;
};
const stillThere = async (text) => (await inShop(() => prepare('SELECT id FROM move_help_requests WHERE what_looks_wrong = ?').all(text))).length > 0;
const aPerson = async (over = {}) => {
  const p = person(over);
  await bring(customers(p));
  return { p, id: (await byAccount(p.v['Account Number'])).id };
};

test('a request holding their exact email goes, in any case and in the middle of a sentence', async () => {
  const { p, id } = await aPerson();
  const a = await asked(`Row for ${p.v.Email.toUpperCase()}, it looks wrong.`);
  const b = await asked(`Ends with ${p.v.Email}.`);
  const other = await asked(`Row for x${p.v.Email}`);
  const longer = await asked(`Row for ${p.v.Email}.uk`);
  await deleted(id);
  assert.deepEqual([await stillThere(a), await stillThere(b), await stillThere(other), await stillThere(longer)], [false, false, true, true]);
});

test('a request holding their phone goes, in its usual forms, also beside another number', async () => {
  for (const write of [(d) => `0${d}`, (d) => `+44 ${d}`, (d) => `0044 ${d}`, (d) => `+44 (0)${d}`, (d) => `0${d.slice(0, 4)} ${d.slice(4)}`, (d) => `07700 000000 or 0${d}`]) {
    const { p, id } = await aPerson();
    const digits = p.v.Phone.replace(/\D/g, '').slice(1);
    const text = await asked(`Ring ${write(digits)} about it ${key().slice(0, 4)}`);
    await deleted(id);
    assert.equal(await stillThere(text), false, write('[n]'));
  }
});

test('a request holding their exact name goes, in any case and however it\'s spaced; a misspelt one stays, as Jack accepted', async () => {
  const { p, id } = await aPerson();
  const first = p.v['First Name'];
  const last = p.v['Last Name'];
  const a = await asked(`${first.toUpperCase()}   ${last.toLowerCase()} looks wrong`);
  const misspelt = await asked(`${first} ${last.slice(0, -1)} looks wrong`);
  const inAWord = await asked(`x${first} ${last}x looks wrong`);
  const someoneElse = await asked('[Someone else] looks wrong');
  await deleted(id);
  assert.deepEqual([await stillThere(a), await stillThere(misspelt), await stillThere(inAWord), await stillThere(someoneElse)], [false, true, true, true]);
});

test('a card holding their details counts too, and the whole request goes: nothing of it stays', async () => {
  const { p, id } = await aPerson();
  const text = await asked(`[Plain words ${key().slice(0, 6)}]`, `About ${p.v.Email}`);
  await deleted(id);
  assert.equal(await stillThere(text), false);
  const left = await inShop(() => prepare('SELECT count(*)::int AS n FROM move_help_requests WHERE card LIKE ? OR what_looks_wrong LIKE ?').get(`%${p.v.Email}%`, `%${p.v.Email}%`));
  assert.equal(left.n, 0);
});

// ---- How exactly it has to match: Jack, 4 Nov, answer 4 ----

test('a one-word name clears nothing: "Will" and a request about Sam Patel', async () => {
  const { id } = await aPerson({ 'First Name': 'Will', 'Last Name': null });
  const text = await asked(`The import will not finish for Sam Patel ${key().slice(0, 4)}`);
  await deleted(id);
  assert.equal(await stillThere(text), true);
});

test('a two-word name still clears a request in upper case', async () => {
  const { p, id } = await aPerson({ 'First Name': 'Sam', 'Last Name': `Patel${key().slice(0, 6)}` });
  const text = await asked(`THE IMPORT WILL NOT FINISH FOR ${p.name.toUpperCase()}`);
  await deleted(id);
  assert.equal(await stillThere(text), false);
});

test('a phone inside a longer number clears nothing: 555 1234 and a barcode', async () => {
  const { id } = await aPerson({ Phone: '555 1234' });
  const text = await asked(`barcode 5012345551234 ${key().slice(0, 4)}x`);
  await deleted(id);
  assert.equal(await stillThere(text), true);
});

test('a phone after a longer run of digits, or typed straight after another number, stays, as Jack accepted', async () => {
  const { p, id } = await aPerson();
  const digits = p.v.Phone.replace(/\D/g, '').slice(1);
  const longer = await asked(`Ref 9${digits}1 ${key().slice(0, 4)}x`);
  const straightAfter = await asked(`Ring 07700 000000 0${digits} ${key().slice(0, 4)}x`);
  await deleted(id);
  assert.deepEqual([await stillThere(longer), await stillThere(straightAfter)], [true, true]);
});

test('an international and a spaced phone still clear a request, on a line of their own', async () => {
  for (const write of [(d) => `+44 ${d.slice(0, 4)} ${d.slice(4)}`, (d) => `0${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`, (d) => `(0${d.slice(0, 4)}) ${d.slice(4)}`, (d) => `0${d}\n12345`]) {
    const { p, id } = await aPerson();
    const digits = p.v.Phone.replace(/\D/g, '').slice(1);
    const text = await asked(`Ring\n${write(digits)}\n[Note ${key().slice(0, 4)}]`);
    await deleted(id);
    assert.equal(await stillThere(text), false, write('0123456789'));
  }
});

test('the card holds this page\'s own headings: a name or phone isn\'t looked for there, an email still is', async () => {
  const { id } = await aPerson({ 'First Name': 'Came', 'Last Name': 'Across' });
  const text = await asked(`[Plain words ${key().slice(0, 6)}]`, 'Here’s what came across');
  await deleted(id);
  assert.equal(await stillThere(text), true);
});
