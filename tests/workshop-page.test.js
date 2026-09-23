import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';

// Needs a built bundle: public/dist/.vite/manifest.json comes from
// `npm run build`, which CI runs before `npm test`.

let server;
before(async () => { server = await startLiveServer(); });
after(async () => { if (server) await server.stop(); });

test('GET /workshop serves a page with a mount point', async () => {
  const res = await fetch(`${server.baseUrl}/workshop`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="wh-root"/);
});

test('the page loads the hashed bundle from the manifest, not a guessed path', async () => {
  const res = await fetch(`${server.baseUrl}/workshop`);
  const html = await res.text();
  // Vite content-hashes filenames. A hardcoded /dist/main.js would 404 after
  // any rebuild, so the page must carry a hashed name from the manifest.
  const script = html.match(/<script type="module" src="(\/dist\/assets\/[^"]+\.js)"/);
  assert.ok(script, 'no module script tag pointing into /dist/assets/');
  // A tag that names a file which is not there is a blank page in a browser.
  // Status alone cannot show that: the static fallback answers a missing file
  // with index.html and a 200. Only a JavaScript content type proves the file
  // behind the tag is the bundle.
  const bundle = await fetch(`${server.baseUrl}${script[1]}`);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('content-type') || '', /javascript/);
  await bundle.arrayBuffer();
});

test('a deep link under /workshop gets the same page, not the old app', async () => {
  // The router (Task 3) owns /workshop/*. A browser opening one of those URLs
  // directly must get this page; the catch-all static fallback would hand it
  // public/index.html, the old vanilla app.
  const res = await fetch(`${server.baseUrl}/workshop/link-expired`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="wh-root"/);
});
