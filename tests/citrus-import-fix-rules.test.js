// A person decides, one row at a time; a deletion holds (openspec/changes/
// citrus-import-fix, design 3, 5 and 10; Jack's 3 and 4 Nov answers, especially 3 to 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { SHARED_CONTACT, SAME_PERSON } from '../server/move/bring-customers.js';
import { aDeletedCustomer, aSharedRow, bikes, body, bring, byAccount, code, countsRight, customers, deleted, finish, fix, inShop, key, leaveOut, lookIn, newPhone, oneLook, person, prepare, rowsOf } from './helpers/move-fix-kit.js';

// ---- A deleted customer's details ----

test('a row sharing a deleted customer\'s email needs a person\'s tick, and nothing else brings it across', async () => {
  const { gone, son, fileId, row } = await aSharedRow();
  assert.equal(row.why, SHARED_CONTACT);
  assert.equal(row.sameAs, undefined);
  const res = await fix(row);
  assert.deepEqual([res.status, res.body.code, res.body.decide], [422, 'still_needs_a_look', 'shared']);
  assert.equal(await byAccount(son.v['Account Number']), undefined, 'no customer');
  // Another customers file finishing doesn't bring it across either.
  await bring(customers(person()));
  await finish();
  assert.deepEqual((await rowsOf(fileId)).map((r) => r.state), ['look']);
  const ticked = await fix(row, {}, { decided: { shared: true } });
  assert.deepEqual([ticked.status, ticked.body.state], [200, 'in'], JSON.stringify(ticked.body));
  const c = await byAccount(son.v['Account Number']);
  assert.notEqual(c.id, gone.id, 'a new customer, not the deleted one');
  assert.equal(c.name, son.name);
  const blank = await inShop(() => prepare('SELECT * FROM customers WHERE id = ?').get(gone.id));
  assert.equal(blank.email, '', 'the deleted record stays blank');
  assert.notEqual(blank.name, son.name);
  assert.ok(blank.deleted_at);
  assert.equal(blank.citrus_account, null);
  assert.equal((await rowsOf(fileId))[0].customer_id, null);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsIn, f.rowsLook, f.rowsFixed], [1, 0, 1]);
});

test('a shared row still needs the tick when the fix takes the email and phone away: it may be theirs (answer 6)', async () => {
  const { son, row } = await aSharedRow();
  const res = await fix(row, { Email: '', Phone: '' });
  assert.deepEqual([res.status, res.body.decide], [422, 'shared']);
  assert.equal(await byAccount(son.v['Account Number']), undefined);
  const another = await fix(row, { Email: `new.${key().slice(0, 6)}@example.test` });
  assert.deepEqual([another.status, another.body.decide], [422, 'shared'], 'nor a new email alone');
  assert.equal(await byAccount(son.v['Account Number']), undefined);
});

test('a row with another reason fixed to a deleted customer\'s email or phone asks in the same way', async () => {
  const gone = await aDeletedCustomer();
  for (const change of [{ Email: gone.p.v.Email.toUpperCase() }, { Phone: `+44 (0)${gone.p.v.Phone.replace(/\D/g, '').slice(1)}` }]) {
    const p = person({ 'First Name': null, 'Last Name': null });
    const fileId = await bring(customers(p));
    const look = await oneLook(fileId);
    assert.equal(look.why, 'No name');
    const res = await fix(look, { 'First Name': 'Maya', 'Last Name': 'Person', ...change });
    assert.deepEqual([res.status, res.body.decide, res.body.why], [422, 'shared', SHARED_CONTACT], JSON.stringify(change));
    assert.equal(await byAccount(p.v['Account Number']), undefined);
    const ticked = await fix(look, { 'First Name': 'Maya', 'Last Name': 'Person', ...change }, { decided: { shared: true } });
    assert.deepEqual([ticked.status, ticked.body.state], [200, 'in']);
  }
});

test('a deleted customer\'s account number is always left out, ticked or not, and the row is emptied', async () => {
  const gone = await aDeletedCustomer();
  for (const decided of [undefined, { shared: true }]) {
    const p = person({ 'First Name': null, 'Last Name': null });
    const fileId = await bring(customers(p));
    const res = await fix(await oneLook(fileId), { 'First Name': 'Maya', 'Last Name': 'Person', 'Account Number': gone.p.v['Account Number'] }, { decided });
    assert.deepEqual([res.status, res.body.state], [200, 'skipped'], JSON.stringify(res.body));
    assert.deepEqual((await rowsOf(fileId)).map((r) => [r.state, r.data]), [['skipped', {}]]);
    assert.equal(await byAccount(gone.p.v['Account Number']), undefined, 'nobody made or restored');
    const f = await countsRight(fileId);
    assert.deepEqual([f.rowsSkipped, f.rowsLook, f.rowsFixed], [1, 0, 1]);
  }
  // Also from a row that's already sharing their details, ticked.
  const { fileId, row } = await aSharedRow();
  const res = await fix(row, { 'Account Number': gone.p.v['Account Number'] }, { decided: { shared: true } });
  assert.equal(res.body.state, 'skipped');
  await countsRight(fileId);
});

test('a bike sharing a deleted customer\'s email needs the tick, and never goes on the deleted customer', async () => {
  const gone = await aDeletedCustomer();
  const live = person();
  await bring(customers(live));
  const fileId = await bring(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': live.name, 'Email Address': gone.p.v.Email }));
  const look = await oneLook(fileId);
  assert.equal(look.why, SHARED_CONTACT);
  const res = await fix(look);
  assert.deepEqual([res.status, res.body.decide], [422, 'shared']);
  const c = await byAccount(live.v['Account Number']);
  const bikesOf = (id) => inShop(() => prepare('SELECT id FROM customer_bikes WHERE customer_id = ?').all(id));
  assert.equal((await bikesOf(c.id)).length, 0);
  const ticked = await fix(look, {}, { decided: { shared: true } });
  assert.deepEqual([ticked.status, ticked.body.state], [200, 'in'], JSON.stringify(ticked.body));
  assert.equal((await bikesOf(c.id)).length, 1);
  assert.equal((await bikesOf(gone.id)).length, 0);
  await countsRight(fileId);
});

// ---- Looks like the same person ----

test('a row like someone here comes across only with a new email or phone, or a tick for that person; nothing merges', async () => {
  const mum = person();
  await bring(customers(mum));
  const mumBefore = await byAccount(mum.v['Account Number']);
  const son = person({ Email: mum.v.Email });
  const fileId = await bring(customers(son));
  const look = await oneLook(fileId);
  const res = await fix(look);
  assert.deepEqual([res.status, res.body.decide, res.body.sameAs?.name], [422, 'same_person', mum.name]);
  assert.equal((await fix(look, {}, { decided: { notSameAs: mumBefore.id + 1000 } })).status, 422, 'a tick about someone else');
  const ticked = await fix(look, {}, { decided: { notSameAs: mumBefore.id } });
  assert.deepEqual([ticked.status, ticked.body.state], [200, 'in'], JSON.stringify(ticked.body));
  const made = await byAccount(son.v['Account Number']);
  assert.notEqual(made.id, mumBefore.id);
  assert.deepEqual(await byAccount(mum.v['Account Number']), mumBefore, 'unchanged');
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_merges WHERE kept_id = ? OR other_id = ?').get(made.id, made.id))).n, 0);
  assert.equal((await rowsOf(fileId))[0].customer_id, null);
  await countsRight(fileId);

  const sister = person({ Email: mum.v.Email });
  const secondFile = await bring(customers(sister));
  const corrected = await fix(await oneLook(secondFile), { Email: `sister.${key().slice(0, 6)}@example.test` });
  assert.deepEqual([corrected.status, corrected.body.state], [200, 'in']);
});

// ---- A row left open while something changes it ----

test('a deletion while the pop-up is open: a row sharing their details isn\'t saved over it, and shows its new reason', async () => {
  const mum = person();
  await bring(customers(mum));
  const son = person({ Email: mum.v.Email });
  const fileId = await bring(customers(son));
  const open = await oneLook(fileId);
  const c = await byAccount(mum.v['Account Number']);
  await deleted(c.id);
  for (const save of [() => fix(open, {}, { decided: { notSameAs: c.id, shared: true } }), () => leaveOut(open)]) {
    const res = await save();
    assert.deepEqual([res.status, res.body.code], [409, 'row_changed'], JSON.stringify(res.body));
  }
  assert.equal(await byAccount(son.v['Account Number']), undefined);
  const now = await oneLook(fileId);
  assert.equal(now.why, SHARED_CONTACT);
  await countsRight(fileId);
});

test('a deletion while the pop-up is open: their own row, gone, isn\'t put back', async () => {
  const mum = person();
  await bring(customers(mum));
  const copy = person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'], Email: mum.v.Email });
  const fileId = await bring(customers(copy));
  const open = await oneLook(fileId);
  await deleted((await byAccount(mum.v['Account Number'])).id);
  assert.deepEqual(await rowsOf(fileId), []);
  for (const save of [() => fix(open, {}, { decided: { shared: true } }), () => leaveOut(open)]) {
    const res = await save();
    assert.deepEqual([res.status, res.body.code], [409, 'row_gone'], JSON.stringify(res.body));
  }
  assert.equal(await byAccount(copy.v['Account Number']), undefined);
  assert.deepEqual(await rowsOf(fileId), []);
  await countsRight(fileId);
});

test('a fix and a deletion at the same moment: no deadlock, nothing lost, and the counts hold', async () => {
  const logged = [];
  const realWarn = console.warn;
  console.warn = (...args) => { logged.push(args.join(' ')); };
  try {
    for (let i = 0; i < 6; i += 1) {
      const mum = person();
      await bring(customers(mum));
      const son = person({ Email: mum.v.Email });
      const fileId = await bring(customers(son));
      const open = await oneLook(fileId);
      const c = await byAccount(mum.v['Account Number']);
      const [saved, gone] = await Promise.all([fix(open, {}, { decided: { notSameAs: c.id } }), deleted(c.id)]);
      assert.notEqual(gone?.status, 503, JSON.stringify(gone));
      const made = await byAccount(son.v['Account Number']);
      if (saved.status === 200) {
        // The save got there first: a new customer, a real person, untouched by the deletion.
        assert.equal(made.name, son.name);
      } else {
        assert.equal(saved.status, 409, JSON.stringify(saved.body));
        assert.equal(made, undefined, 'refused, so nobody was made');
        assert.equal((await oneLook(fileId)).why, SHARED_CONTACT);
      }
      await countsRight(fileId);
    }
  } finally {
    console.warn = realWarn;
  }
  assert.ok(!logged.some((l) => l.includes('40P01')), `no deadlock: ${logged.join('; ')}`);
});

test('a row left out, then the customer deleted: their own goes, with the count; one only sharing stays with answer 3\'s reason', async () => {
  const mum = person();
  await bring(customers(mum));
  const byAcc = person({ 'First Name': null, 'Last Name': null, Email: mum.v.Email, Phone: newPhone() });
  const ownRow = person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'], Email: mum.v.Email });
  const sharing = person({ Email: mum.v.Email });
  const fileId = await bring(customers(ownRow, sharing, byAcc));
  for (const row of await lookIn(fileId)) assert.equal((await leaveOut(row)).status, 200);
  const before = await countsRight(fileId);
  assert.equal(before.rowsLeftOut, 3);
  await deleted((await byAccount(mum.v['Account Number'])).id);
  const rows = await rowsOf(fileId);
  const f = await countsRight(fileId);
  assert.equal(f.rowsLeftOut, 2);
  assert.deepEqual(rows.map((r) => r.state), ['left_out', 'left_out']);
  assert.ok(!rows.some((r) => r.data.Email === mum.v.Email && r.data['Last Name'] === mum.v['Last Name']), 'their own has gone');
  assert.ok(rows.every((r) => r.why === SHARED_CONTACT && r.customer_id === null));
  assert.deepEqual(await lookIn(fileId), [], 'left out stays left out');
});

test('a row left out with their account number goes at the deletion', async () => {
  const mum = person();
  await bring(customers(mum));
  const c = await byAccount(mum.v['Account Number']);
  const fileId = await bring(customers(person({ 'First Name': null, 'Last Name': null })));
  // The row's own account number is theirs, as if it had been left out before they came across.
  await inShop(() => prepare(`UPDATE move_rows SET data = jsonb_set(data, '{Account Number}', to_jsonb(?::text)) WHERE file_id = ?`).run(mum.v['Account Number'], fileId));
  assert.equal((await leaveOut(await oneLook(fileId))).status, 200);
  await deleted(c.id);
  assert.deepEqual(await rowsOf(fileId), []);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsTotal, f.rowsLeftOut], [0, 0]);
});
