// The customer website is the third React app, served at the old website's
// addresses (openspec/changes/website-browse, design 1, task 3.1): every
// page of /store/<slug>/ and of <slug>.<base domain> gets the website app,
// an unknown or switched-off shop gets the same page with a 404, and the
// booking app stays at /book. Needs a built bundle (npm run build).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let on;
let off;
let websiteScript;
let bookScript;

before(async () => {
  server = await startLiveServer();
  on = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  off = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });
  assert.equal((await staffRequest(server.baseUrl, on.cookie, '/api/website')).status, 200);
  assert.equal((await staffRequest(server.baseUrl, on.cookie, '/api/website/turn-on', { method: 'POST' })).status, 200);
  const manifest = JSON.parse(await readFile(new URL('../public/dist/.vite/manifest.json', import.meta.url), 'utf8'));
  websiteScript = `/dist/${manifest['src/website/main.tsx'].file}`;
  bookScript = `/dist/${manifest['src/customer/main.tsx'].file}`;
});

after(async () => {
  for (const shop of [on, off]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
});

async function websitePage(path, status = 200) {
  const res = await fetch(`${server.baseUrl}${path}`, { redirect: 'manual' });
  assert.equal(res.status, status, path);
  assert.match(res.headers.get('content-type') || '', /text\/html/, path);
  assert.equal(res.headers.get('cache-control'), 'no-store', path);
  const html = await res.text();
  assert.match(html, /id="wh-site-root"/, `no website mount point at ${path}`);
  assert.ok(html.includes(`<script type="module" src="${websiteScript}"></script>`), `no website entry script at ${path}`);
  assert.ok(!html.includes('storefront.js'), `the old website was served at ${path}`);
  return html;
}

test('the store path serves the website app, and every page under it does too', async () => {
  for (const page of ['/', '/shop', '/contact', '/collection-returns', '/privacy', '/basket', '/no-such-page']) {
    await websitePage(`/store/${on.shop.slug}${page}`);
  }
});

test('the shop’s own address serves the website app at every page', async () => {
  // ?storefrontSlug= takes the same path as a <slug>.<base domain> host.
  for (const page of ['/', '/shop', '/contact']) {
    await websitePage(`${page}?storefrontSlug=${on.shop.slug}`);
  }
});

test('the store path without its slash still goes to the slash, so the app’s addresses line up', async () => {
  const res = await fetch(`${server.baseUrl}/store/${on.shop.slug}?a=1`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), `/store/${on.shop.slug}/?a=1`);
});

test('a switched-off shop and an unknown one get the same website page with a 404, naming neither', async () => {
  const offHtml = await websitePage(`/store/${off.shop.slug}/`, 404);
  const unknownHtml = await websitePage('/store/no-such-shop-anywhere/', 404);
  assert.equal(offHtml, unknownHtml);
  assert.ok(!offHtml.includes('South Road Bikes'));
  await websitePage(`/shop?storefrontSlug=${off.shop.slug}`, 404);
});

test('the booking app stays at /book on the store’s own address', async () => {
  const res = await fetch(`${server.baseUrl}/book/${on.shop.slug}?storefrontSlug=${on.shop.slug}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="wh-book-root"/);
  assert.ok(html.includes(bookScript));
});

test('the website app script it names is really there, on the shop’s own address too', async () => {
  // ?storefrontSlug= stands in for <slug>.<base domain>, where every path,
  // the built scripts' included, reaches the website's handler.
  for (const suffix of ['', `?storefrontSlug=${on.shop.slug}`]) {
    const res = await fetch(`${server.baseUrl}${websiteScript}${suffix}`);
    assert.equal(res.status, 200, suffix);
    assert.match(res.headers.get('content-type') || '', /javascript/, suffix);
    await res.arrayBuffer();
  }
});
