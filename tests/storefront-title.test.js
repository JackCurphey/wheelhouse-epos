// tests/storefront-title.test.js
//
// The public website's browser tab shows the shop's own name (Jack, 27 Sep
// 2026), and "Website" when there is no shop name to show. Loads the plain
// browser script public-storefront/storefront.js in a node:vm sandbox, the
// same way tests/storefront-shopify-cart.test.js does, and lets its own
// boot() run against a fake fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public-storefront', 'storefront.js'),
  'utf8'
);

// Runs the script with /api/storefront/info answering `info` (or failing when
// `info` is null) and resolves with the sandbox once boot() has finished.
async function bootWith(info) {
  const sandbox = {
    document: {
      title: 'Website',
      documentElement: { style: { setProperty() {} } },
      getElementById: () => ({ innerHTML: '', style: {} }),
      querySelectorAll: () => [],
    },
    location: { pathname: '/store/test-shop' },
    fetch: async (url) => {
      if (info && String(url).startsWith('/api/storefront/info')) {
        return { ok: true, status: 200, json: async () => info };
      }
      if (info && String(url).startsWith('/api/storefront/products')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    },
    alert() {},
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  // boot() is async and not awaited by the script; let its fetches settle.
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
  return sandbox;
}

test('the tab title is the shop name', async () => {
  const sandbox = await bootWith({ enabled: true, shopName: 'North Street Cycles', themePreset: 'forest' });
  assert.equal(sandbox.document.title, 'North Street Cycles');
});

test('the tab title falls back to "Website" when the shop has no name', async () => {
  const sandbox = await bootWith({ enabled: true, shopName: '', themePreset: 'forest' });
  assert.equal(sandbox.document.title, 'Website');
});

test('the tab title stays "Website" when the website cannot load', async () => {
  const sandbox = await bootWith(null);
  assert.equal(sandbox.document.title, 'Website');
});
