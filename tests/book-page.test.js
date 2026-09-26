// The customer app is served at every /book address, on the main host and on
// a shop's storefront subdomain. Needs a built bundle (npm run build).
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let customerScript;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  const manifest = JSON.parse(await readFile(new URL('../public/dist/.vite/manifest.json', import.meta.url), 'utf8'));
  customerScript = `/dist/${manifest['src/customer/main.tsx'].file}`;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

async function assertCustomerPage(url) {
  const res = await fetch(url);
  assert.equal(res.status, 200, url);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  assert.match(html, /id="wh-book-root"/, 'no customer mount point');
  assert.ok(html.includes(`<script type="module" src="${customerScript}"></script>`), `no customer entry script in ${html}`);
  assert.ok(!html.includes('/book/portal.js'), 'the old booking page was served');
}

test('/book/<shop> serves the customer app', async () => {
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}`);
});

test('a private link opened cold gets the customer app', async () => {
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}/booking/${'a'.repeat(64)}`);
});

test('the customer app script it names is really there', async () => {
  const res = await fetch(`${server.baseUrl}${customerScript}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  await res.arrayBuffer();
});

test('on a storefront, /book serves the customer app too', async () => {
  await runWithShop(owner.shop.id, () => prepare(
    'INSERT INTO storefront_settings (enabled) VALUES (true) ON CONFLICT (shop_id) DO UPDATE SET enabled = true'
  ).run());
  // ?storefrontSlug= routes the request through the storefront handler, the
  // same path a <slug>.<base domain> host takes (server/storefront.js).
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}?storefrontSlug=${owner.shop.slug}`);
});
