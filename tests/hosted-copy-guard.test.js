// The hosted test copy refuses anything unsafe at start-up (add-hosted-copy
// design §5, tasks 2.1–2.2; the messages engine, Jack 20 Oct: pretend for now):
// any real sending key, a NODE_ENV other than production, or transaction-scoped
// tenancy. Checked before any migration runs, naming the setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostedCopyRefusal } from '../server/hosted-copy-guard.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAFE = { WHEELHOUSE_HOSTED_COPY: '1', NODE_ENV: 'production' };

test('off unless the setting is on', () => {
  assert.equal(hostedCopyRefusal({ TWILIO_ACCOUNT_SID: 'x', NODE_ENV: 'development' }), null);
});

test('it refuses any real sending key, naming it', () => {
  for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_FROM_NUMBER', 'EMAIL_API_KEY', 'WHATSAPP_TOKEN']) {
    const why = hostedCopyRefusal({ ...SAFE, [key]: 'x' });
    assert.ok(why && why.includes(key), `${key}: ${why}`);
  }
});

test('it refuses without NODE_ENV=production, and with transaction-scoped tenancy', () => {
  assert.match(hostedCopyRefusal({ WHEELHOUSE_HOSTED_COPY: '1', NODE_ENV: 'development' }), /NODE_ENV/);
  assert.match(hostedCopyRefusal({ ...SAFE, DB_TENANT_SCOPE: 'transaction' }), /DB_TENANT_SCOPE/);
});

// staff-signin-workos design 6: a live WorkOS key would sign people in to
// WorkOS's real environment; a test key only reaches its test one.
test('it refuses a live WorkOS key, and allows a test one', () => {
  const why = hostedCopyRefusal({ ...SAFE, WORKOS_API_KEY: 'sk_live_abc' });
  assert.ok(why && why.includes('WORKOS_API_KEY'), why);
  assert.equal(hostedCopyRefusal({ ...SAFE, WORKOS_API_KEY: 'sk_test_abc', WORKOS_CLIENT_ID: 'client_123' }), null);
});

test('it starts with none of these', () => {
  assert.equal(hostedCopyRefusal(SAFE), null);
  assert.equal(hostedCopyRefusal({ ...SAFE, DB_TENANT_SCOPE: 'session' }), null);
});

test('the real server refuses before any migration runs', async () => {
  // Production needs a Shopify key before the server loads; a dummy one, never used.
  // A database nobody answers at (fresh review, 24 Oct): a guard that ran
  // after migrations would fail trying to reach it, not name the setting.
  const env = { ...process.env, ...SAFE, SHOPIFY_TOKEN_ENCRYPTION_KEY: 'test-only-'.padEnd(64, 'x'), TWILIO_ACCOUNT_SID: 'x', PORT: '0', DATABASE_URL: 'postgres://nobody:x@127.0.0.1:1/none' };
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  // A server that starts instead of refusing never exits: stop it and fail.
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve('still running after 15 s'); }, 15_000);
    child.on('exit', (c) => { clearTimeout(timer); resolve(c); });
  });
  assert.equal(code, 1, out);
  assert.match(out, /TWILIO_ACCOUNT_SID/);
  assert.doesNotMatch(out, /Applied migration|Migrations up to date|ECONNREFUSED|connect/i);
});
