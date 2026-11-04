// Nothing waits for long behind the Citrus Lime import's locks (openspec/changes/
// citrus-import-fix, design 20 to 23; the re-check of 4 Nov). A stuck batch gives up, a
// merge says try again, a customer's page never waits, and a batch stops at its time
// limit and carries on where it left off. Every file is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { bringAcrossRound } from '../server/move/bring-across.js';
import { barcodes, bikes, bring, bringBatch, byAccount, bySku, countsRight, customers, deleteTestShop, finish, inShop, key, owner, pads, person, prepare, priceList, readNextFile, rowsOf, send, server, staff, staffRequest, staffSignup } from './helpers/move-fix-kit.js';

const within = (ms, what, going) => Promise.race([going, new Promise((_, no) => { setTimeout(() => no(new Error(`${what} took over ${ms}ms`)), ms); })]);

// A transaction holding something, until released: a batch, or anything else stuck.
async function holding(lock, run) {
  let release;
  const held = new Promise((r) => { release = r; });
  let locked;
  const isLocked = new Promise((r) => { locked = r; });
  const tx = inShop(async () => {
    await prepare('BEGIN').run();
    await lock();
    locked();
    await held;
    await prepare('ROLLBACK').run();
  });
  await isLocked;
  try {
    return await run();
  } finally {
    release();
    await tx;
  }
}
const holdFiles = () => prepare('SELECT id FROM move_files ORDER BY id FOR UPDATE').all();

async function twoCustomers() {
  const a = person();
  const b = person();
  await bring(customers(a, b));
  return [(await byAccount(a.v['Account Number'])).id, (await byAccount(b.v['Account Number'])).id];
}
const merge = (keptId, otherId) => staff(`/api/customers/${keptId}/merge`, { method: 'POST', body: { otherId, keep: {} } });
const isActive = async (id) => (await inShop(() => prepare('SELECT active FROM customers WHERE id = ?').get(id)))?.active;

test('a merge told to wait too long says try again, and changes nothing', async () => {
  const [kept, other] = await twoCustomers();
  const started = Date.now();
  const res = await holding(holdFiles, () => within(4000, 'the merge', merge(kept, other)));
  assert.deepEqual([res.status, res.body.code], [503, 'busy']);
  assert.match(res.body.error, /Try again/);
  assert.ok(Date.now() - started < 3500, 'within its limit');
  assert.equal(await isActive(other), 1);
  assert.equal((await merge(kept, other)).status, 200);
});

test('an Undo told to wait too long says try again, and changes nothing', async () => {
  const [kept, other] = await twoCustomers();
  const merged = await merge(kept, other);
  const res = await holding(holdFiles, () => within(4000, 'the Undo', staff(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} })));
  assert.deepEqual([res.status, res.body.code], [503, 'busy']);
  assert.equal(await isActive(other), 0);
  assert.equal((await staff(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} })).status, 200);
});

test('a customer\'s page never waits for removing a merged record: it skips, and a later call does it', async () => {
  const [kept, other] = await twoCustomers();
  const merged = await merge(kept, other);
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = now() - interval '31 days' WHERE id = ?").run(merged.body.id));
  const started = Date.now();
  const res = await holding(holdFiles, () => within(1500, 'the page', staff(`/api/customers/${kept}/merges`)));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
  assert.ok(Date.now() - started < 1500);
  assert.equal(await isActive(other), 0, 'still there, hidden');
  assert.equal((await staff(`/api/customers/${kept}/merges`)).status, 200);
  assert.equal(await isActive(other), undefined, 'gone on a later call');
});

test('a customer\'s page doesn\'t wait for something else holding what a removal moves, either', async () => {
  const [kept, other] = await twoCustomers();
  const merged = await merge(kept, other);
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = now() - interval '31 days' WHERE id = ?").run(merged.body.id));
  const res = await holding(() => prepare('SELECT id FROM customers WHERE id = ? FOR UPDATE').get(other), () => within(1500, 'the page', staff(`/api/customers/${kept}/merges`)));
  assert.equal(res.status, 200);
  assert.equal(await isActive(other), 0);
  assert.ok(!server.stderr.includes('couldn’t be removed yet'), 'being busy isn\'t a fault');
});

test('ten merges stuck behind the files all answer, and another shop is still served', async () => {
  const pairs = [];
  for (let i = 0; i < 10; i += 1) pairs.push(await twoCustomers());
  const other = await staffSignup(server.baseUrl, { shopName: '[Another shop]' });
  try {
    await holding(holdFiles, async () => {
      const merges = Promise.all(pairs.map(([a, b]) => merge(a, b)));
      await new Promise((r) => { setTimeout(r, 300); });
      const elsewhere = await within(4500, 'another shop', staffRequest(server.baseUrl, other.cookie, '/api/customers'));
      assert.equal(elsewhere.status, 200);
      const answers = await within(6000, 'ten merges', merges);
      assert.deepEqual(answers.map((a) => a.status), Array(10).fill(503));
    });
    // Nothing is left holding a connection: all ten work now, at once.
    const again = await within(10_000, 'ten merges again', Promise.all(pairs.map(([a, b]) => merge(a, b))));
    assert.deepEqual(again.map((a) => a.status), Array(10).fill(200));
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a batch stuck behind a product gives up, keeps nothing, holds nothing, and finishes later', async () => {
  const here = pads();
  await bring(priceList(here));
  const product = await bySku(here['Item Lookup Code']);
  const [kept, other] = await twoCustomers();
  const alias = `50${key().slice(0, 10)}`;
  const res = await send(barcodes({ ILC: here['Item Lookup Code'], Alias: alias }));
  while (await readNextFile(owner.shop.id));
  await holding(() => prepare('SELECT id FROM products WHERE id = ? FOR UPDATE').get(product.id), async () => {
    const did = await within(3000, 'the batch', inShop(() => bringBatch()));
    assert.equal(did, 'busy');
    assert.deepEqual((await rowsOf(res.body.id)).map((r) => r.state), ['waiting']);
    // It isn't holding the files now: a merge goes straight through.
    assert.equal((await within(1500, 'a merge', merge(kept, other))).status, 200);
  });
  await finish();
  assert.equal((await bySku(here['Item Lookup Code'])).barcode, alias);
  const f = await countsRight(res.body.id);
  assert.deepEqual([f.rowsIn, f.state], [1, 'done']);
});

test('a batch stuck behind a bike\'s customer gives up too, and the bike isn\'t added twice', async () => {
  const p = person();
  await bring(customers(p));
  const c = await byAccount(p.v['Account Number']);
  const res = await send(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': p.name, 'Email Address': p.v.Email }));
  while (await readNextFile(owner.shop.id));
  await holding(() => prepare('SELECT id FROM customers WHERE id = ? FOR UPDATE').get(c.id), async () => {
    assert.equal(await within(3000, 'the batch', inShop(() => bringBatch())), 'busy');
  });
  await finish();
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_bikes WHERE customer_id = ?').get(c.id))).n, 1);
  await countsRight(res.body.id);
});

test('a batch that can\'t get the files gives up', async () => {
  await bring(priceList(pads({ Price: null })));
  const res = await send(priceList(pads()));
  while (await readNextFile(owner.shop.id));
  await holding(holdFiles, async () => {
    assert.equal(await within(3000, 'the batch', inShop(() => bringBatch())), 'busy');
  });
  await finish();
  assert.equal((await countsRight(res.body.id)).rowsIn, 1);
});

test('storing a file that can\'t get its lock gives up, says nothing is wrong, and starts again next time with no row twice', async () => {
  const res = await send(priceList(pads(), pads()));
  const realError = console.error;
  const logged = [];
  console.error = (...args) => { logged.push(args.join(' ')); };
  try {
    await holding(holdFiles, async () => {
      await within(3000, 'the read', assert.rejects(readNextFile(owner.shop.id), (err) => err.code === '55P03'));
      const round = await within(3000, 'the round', bringAcrossRound(() => false, [owner.shop.id]));
      assert.ok(round.has(owner.shop.id), 'it tries again');
    });
  } finally {
    console.error = realError;
  }
  assert.deepEqual(logged, []);
  await finish();
  const f = await countsRight(res.body.id);
  assert.deepEqual([f.rowsTotal, f.rowsIn], [2, 2]);
});

test('choosing another file told to wait too long says try again', async () => {
  const res = await send(Buffer.from('not a spreadsheet'));
  while (await readNextFile(owner.shop.id));
  const answer = await holding(holdFiles, () => within(4000, 'the delete', staff(`/api/move/files/${res.body.id}`, { method: 'DELETE' })));
  assert.deepEqual([answer.status, answer.body.code], [503, 'busy']);
  assert.equal((await staff(`/api/move/files/${res.body.id}`, { method: 'DELETE' })).status, 200);
});

// ---- A batch stops at its time limit ----

// A clock that moves on each time it's read, so a batch's limit doesn't depend on real time.
const tickingClock = (step) => { let at = 0; return () => { at += step; return at; }; };

test('a batch stops at its limit and resumes where it left off: nothing twice, and the counts right', async () => {
  const people = Array.from({ length: 25 }, () => person());
  const res = await send(customers(...people));
  while (await readNextFile(owner.shop.id));
  const did = await inShop(() => bringBatch({ now: tickingClock(100), limitMs: 250 }));
  assert.equal(did, true);
  const first = await countsRight(res.body.id);
  assert.ok(first.rowsIn >= 1 && first.rowsIn <= 3, `stopped at its limit: ${first.rowsIn} rows`);
  let calls = 1;
  while (await inShop(() => bringBatch({ now: tickingClock(100), limitMs: 250 }))) {
    calls += 1;
    assert.ok(calls < 100, 'it keeps going round');
  }
  assert.ok(calls >= 8, `${calls} batches`);
  const f = await countsRight(res.body.id);
  assert.deepEqual([f.rowsIn, f.rowsSame, f.rowsLook, f.state], [25, 0, 0, 'done']);
  for (const p of people) assert.ok(await byAccount(p.v['Account Number']), 'each came across');
});

test('a batch of bikes stopped at its limit doesn\'t add any twice', async () => {
  const p = person();
  await bring(customers(p));
  const c = await byAccount(p.v['Account Number']);
  const res = await send(bikes(...Array.from({ length: 15 }, () => ({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': p.name, 'Email Address': p.v.Email }))));
  while (await readNextFile(owner.shop.id));
  while (await inShop(() => bringBatch({ now: tickingClock(100), limitMs: 150 })));
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_bikes WHERE customer_id = ?').get(c.id))).n, 15);
  assert.equal((await countsRight(res.body.id)).rowsIn, 15);
});

test('a batch still has a most it takes, however long it\'s allowed', async () => {
  const res = await send(priceList(...Array.from({ length: 130 }, () => pads({ 'Qty On Hand': 0 }))));
  while (await readNextFile(owner.shop.id));
  await inShop(() => bringBatch({ now: () => 0 }));
  assert.equal((await countsRight(res.body.id)).rowsIn, 100);
  await finish();
  assert.equal((await countsRight(res.body.id)).rowsIn, 130);
});

test('rows sent back when a file finishes go in small lots, with the file still coming across, and all arrive once', async () => {
  const people = Array.from({ length: 7 }, () => person());
  const bikeFile = await bring(bikes(...people.map((p) => ({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': p.name, 'Email Address': p.v.Email }))));
  assert.equal((await countsRight(bikeFile)).rowsLook, 7);
  const res = await send(customers(...people));
  while (await readNextFile(owner.shop.id));
  // The customers, then a first lot of three bikes: the file isn't done until none are left.
  await inShop(() => bringBatch({ retryLot: 3 }));
  await inShop(() => bringBatch({ retryLot: 3 }));
  const during = await countsRight(res.body.id);
  assert.equal(during.state, 'bringing');
  const states = (await rowsOf(bikeFile)).map((r) => r.state);
  assert.deepEqual([states.filter((s) => s === 'waiting').length, states.filter((s) => s === 'look').length], [3, 4]);
  assert.equal((await countsRight(bikeFile)).rowsLook, 4);
  while (await inShop(() => bringBatch({ retryLot: 3 })));
  assert.equal((await countsRight(res.body.id)).state, 'done');
  const f = await countsRight(bikeFile);
  assert.deepEqual([f.rowsIn, f.rowsLook, f.state], [7, 0, 'done']);
});

test('a round gives waiters a moment between batches, and stops at a stuck batch', async () => {
  const res = await send(priceList(...Array.from({ length: 130 }, () => pads({ 'Qty On Hand': 0 }))));
  while (await readNextFile(owner.shop.id));
  let breaths = 0;
  await bringAcrossRound(() => false, [owner.shop.id], { breathe: async () => { breaths += 1; } });
  assert.ok(breaths >= 2, `${breaths} breaths`);
  assert.equal((await countsRight(res.body.id)).rowsIn, 130);

  const next = await send(priceList(pads({ 'Qty On Hand': 0 })));
  while (await readNextFile(owner.shop.id));
  const started = Date.now();
  const more = await holding(holdFiles, () => within(3000, 'the round', bringAcrossRound(() => false, [owner.shop.id])));
  assert.ok(more.has(owner.shop.id), 'it tries again next tick');
  assert.ok(Date.now() - started < 2000, 'once, not twenty times');
  await finish();
  assert.equal((await countsRight(next.body.id)).rowsIn, 1);
});

test('the columns a row is matched by hold what they should, and have their indexes', async () => {
  const p = person({ Email: `  MIXED.${key().slice(0, 6)}@Example.Test `, Phone: '+44 (0)7700 900123', 'Account Number': `Ab-${key().slice(0, 6)}`, 'First Name': 'MAYA', 'Last Name': 'Patel' });
  await bring(customers(p));
  const c = await byAccount(p.v['Account Number']);
  assert.deepEqual(
    [c.email_key, c.phone_key, c.name_key, c.citrus_account_key],
    [p.v.Email.trim().toLowerCase(), '4407700900123', 'maya patel', p.v['Account Number'].toLowerCase()]
  );
  // Whether the planner picks them depends on how many customers there are: measured on a large file (design 23).
  const indexes = (await inShop(() => prepare("SELECT indexname FROM pg_indexes WHERE tablename = 'customers'").all())).map((r) => r.indexname);
  for (const name of ['idx_customers_email_key', 'idx_customers_phone_key', 'idx_customers_name_key2', 'idx_customers_citrus_account_key2']) assert.ok(indexes.includes(name), name);
});

