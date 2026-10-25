// The "remove a shop" command (openspec/changes/add-hosted-copy design 7,
// task 3.6c): clears the shop made at sign-up off the hosted copy, so the
// drawings' test shop can be loaded (the loader only loads onto a copy with
// no shops). Everything the shop owns goes; any other shop is untouched.
// Typing the shop's address twice is what stops a slip removing the wrong one.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { runWithShop, prepare } from '../server/db.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const left = [];
after(async () => {
  for (const id of left) {
    const { rows } = await pool.query('SELECT id FROM shops WHERE id = $1', [id]);
    if (rows[0]) await deleteTestShop(id);
  }
});

// A shop with an owner, a session, a mechanic, a customer and a job.
async function busyShop(name) {
  const made = await staffSignup('', { shopName: name });
  left.push(made.shop.id);
  const mechanic = await seedMechanic(made.shop.id);
  const customerId = await runWithShop(made.shop.id, async () =>
    (await prepare("INSERT INTO customers (name, email) VALUES ('Maya Patel', ?) RETURNING id").get(`maya-${randomUUID().slice(0, 8)}@example.com`)).id);
  await seedWorkshopJob({ shopId: made.shop.id, customerId, mechanicId: mechanic.id ?? mechanic });
  return made;
}

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, 'server/scripts/remove-shop.mjs'), ...args], { cwd: ROOT }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code : 0, out: stdout + stderr }));
  });
}
const count = async (sql, id) => Number((await pool.query(sql, [id])).rows[0].n);

test('removes the shop and everything it owns, leaving another shop alone', async () => {
  const gone = await busyShop('North Street Cycles');
  const kept = await busyShop('Elsewhere Cycles');
  const done = await run(['--shop', gone.shop.slug, '--confirm', gone.shop.slug]);
  assert.equal(done.code, 0, done.out);
  assert.match(done.out, new RegExp(`Removed ${gone.shop.name} \\(${gone.shop.slug}\\) and everything in it\\.`));
  assert.equal(await count('SELECT count(*) AS n FROM shops WHERE id = $1', gone.shop.id), 0);
  assert.equal(await count('SELECT count(*) AS n FROM logins WHERE shop_id = $1', gone.shop.id), 0);
  assert.equal(await count('SELECT count(*) AS n FROM sessions WHERE login_id = $1', gone.loginId), 0);
  assert.equal(await count('SELECT count(*) AS n FROM shops WHERE id = $1', kept.shop.id), 1);
  assert.equal(await count('SELECT count(*) AS n FROM logins WHERE shop_id = $1', kept.shop.id), 1);
  const keptJobs = await runWithShop(kept.shop.id, async () => (await prepare('SELECT count(*) AS n FROM workshop_jobs').get()).n);
  assert.equal(Number(keptJobs), 1);
});

test('without the address typed a second time, or with it typed differently, it says what it would remove and removes nothing', async () => {
  const shop = await busyShop('North Street Cycles');
  for (const args of [['--shop', shop.shop.slug], ['--shop', shop.shop.slug, '--confirm', `${shop.shop.slug}x`]]) {
    const r = await run(args);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /Refused: nothing was removed\./);
    assert.match(r.out, new RegExp(`would remove ${shop.shop.name} \\(${shop.shop.slug}\\): 1 login, 1 workshop job, 1 customer`));
    assert.match(r.out, new RegExp(`--confirm ${shop.shop.slug}`));
    assert.equal(await count('SELECT count(*) AS n FROM shops WHERE id = $1', shop.shop.id), 1);
  }
});

test('refuses a shop that isn’t there, and a typing slip, without a stack trace', async () => {
  const missing = await run(['--shop', 'no-such-shop-anywhere', '--confirm', 'no-such-shop-anywhere']);
  assert.equal(missing.code, 1);
  assert.match(missing.out, /Refused: no shop at no-such-shop-anywhere\. Nothing was removed\./);
  for (const args of [[], ['--shop'], ['--shop', 'a', 'b']]) {
    const slip = await run(args);
    assert.equal(slip.code, 1, args.join(' '));
    assert.match(slip.out, /--shop <address> --confirm <address>/);
    assert.doesNotMatch(slip.out, /\n\s+at /, 'no stack trace');
  }
});
