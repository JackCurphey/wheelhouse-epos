// tests/shopify-encryption-key-guard.test.js
//
// server/shopify.js derives its token-encryption key from
// SHOPIFY_TOKEN_ENCRYPTION_KEY at module load time, falling back to an
// insecure hardcoded key for local dev. In production that fallback must not
// happen silently - a misconfigured production deploy should fail loudly at
// startup instead of quietly encrypting real shop credentials under a key
// sitting in public source code.
//
// The guard runs once, at module-evaluation time, so it can't be exercised
// by importing shopify.js in this same process (every other test file in
// this suite already imported it, and ESM caches the module). Each case
// below spawns a fresh `node` subprocess instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shopifyModulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'shopify.js')
  .replace(/\\/g, '/');

function importShopifyInSubprocess(env) {
  return spawnSync(process.execPath, ['-e', `import(${JSON.stringify(`file://${shopifyModulePath}`)}).then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });`], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('importing server/shopify.js throws in production with no SHOPIFY_TOKEN_ENCRYPTION_KEY set', () => {
  const result = importShopifyInSubprocess({ NODE_ENV: 'production', SHOPIFY_TOKEN_ENCRYPTION_KEY: '' });
  assert.notEqual(result.status, 0, 'process should exit non-zero when the guard throws');
  assert.match(result.stderr, /SHOPIFY_TOKEN_ENCRYPTION_KEY/);
});

test('importing server/shopify.js succeeds in production when SHOPIFY_TOKEN_ENCRYPTION_KEY is set', () => {
  const result = importShopifyInSubprocess({ NODE_ENV: 'production', SHOPIFY_TOKEN_ENCRYPTION_KEY: 'a-real-production-secret' });
  assert.equal(result.status, 0, `expected clean import, got stderr: ${result.stderr}`);
});

test('importing server/shopify.js outside production does not require SHOPIFY_TOKEN_ENCRYPTION_KEY', () => {
  const result = importShopifyInSubprocess({ NODE_ENV: 'development', SHOPIFY_TOKEN_ENCRYPTION_KEY: '' });
  assert.equal(result.status, 0, `expected clean import, got stderr: ${result.stderr}`);
});
