// The "add a login" command (openspec/changes/add-hosted-copy design 7, task
// 3.6b): adds a person as the owner of a shop that has none, such as the test
// shop the loader makes, since staff sign in only through WorkOS (#504) and
// nobody can be signed in to that shop to add one from the app.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { AuthError, addOwnerLogin } from '../server/auth.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shops = [];
after(async () => {
  for (const id of shops) await deleteTestShop(id);
});

// A shop with no login at all, as the test shop loader leaves it.
async function shopWithoutOwner() {
  const slug = `test-no-owner-${randomUUID().slice(0, 8)}`;
  const { rows: [shop] } = await pool.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', $1) RETURNING *", [slug]);
  shops.push(shop.id);
  return shop;
}
const email = () => `jack-${randomUUID().slice(0, 8)}@example.com`;

test('adds the person as the shop’s owner, with a password nobody knows', async () => {
  const shop = await shopWithoutOwner();
  const who = email();
  const login = await addOwnerLogin({ shopSlug: shop.slug, name: ' Jack Curphey ', email: ` ${who.toUpperCase()} ` });
  assert.equal(login.shop_id, shop.id);
  assert.equal(login.email, who);
  assert.equal(login.name, 'Jack Curphey');
  assert.equal(login.is_owner, true);
  assert.equal(login.active, true);
  assert.match(login.password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('refuses a shop that isn’t there, one that has an owner, a taken or bad email, and no name', async () => {
  const shop = await shopWithoutOwner();
  await assert.rejects(addOwnerLogin({ shopSlug: 'no-such-shop-anywhere', name: 'Jack', email: email() }), (e) => e instanceof AuthError && /No shop at no-such-shop-anywhere/.test(e.message));
  const owned = await staffSignup('', { shopName: 'Elsewhere Cycles' });
  shops.push(owned.shop.id);
  await assert.rejects(addOwnerLogin({ shopSlug: owned.shop.slug, name: 'Jack', email: email() }), /already has an owner/);
  await assert.rejects(addOwnerLogin({ shopSlug: shop.slug, name: 'Jack', email: owned.email }), /already exists/);
  await assert.rejects(addOwnerLogin({ shopSlug: shop.slug, name: 'Jack', email: 'not-an-email' }), /valid email/);
  await assert.rejects(addOwnerLogin({ shopSlug: shop.slug, name: '  ', email: email() }), /Name is required/);
  const { rows } = await pool.query('SELECT id FROM logins WHERE shop_id = $1', [shop.id]);
  assert.equal(rows.length, 0, 'nothing was added');
});

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, 'server/scripts/add-login.mjs'), ...args], { cwd: ROOT }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code : 0, out: stdout + stderr }));
  });
}

test('the command says what it did, and refuses with a reason and a failing exit', async () => {
  const shop = await shopWithoutOwner();
  const who = email();
  const ok = await run(['--shop', shop.slug, '--email', who, '--name', 'Jack Curphey']);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, new RegExp(`Added Jack Curphey \\(${who.replace('.', '\\.')}\\) as the owner of North Street Cycles\\. Sign in through WorkOS with that email\\.`));
  const again = await run(['--shop', shop.slug, '--email', email(), '--name', 'Someone']);
  assert.equal(again.code, 1);
  assert.match(again.out, /Refused: North Street Cycles already has an owner/);
  const missing = await run([]);
  assert.equal(missing.code, 1);
  assert.match(missing.out, /--shop <address> --email <email> --name <name>/);
});
