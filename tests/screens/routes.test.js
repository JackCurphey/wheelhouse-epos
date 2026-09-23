// The route table: atlas screen id -> URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROUTES } from '../../src/staff/routes.ts';

const index = JSON.parse(
  await readFile(new URL('../../docs/design/release-1-journey/screen-index.json', import.meta.url), 'utf8'),
);
const ATLAS_IDS = new Set(index.map((s) => s.id));

test('the five standalone edge screens have their own URLs', () => {
  // Entered from an emailed link or a stale bookmark, never by navigation -
  // screen-index.json records no inbound branch for any of them.
  for (const id of ['reschedule', 'cancel', 'expired', 'preferences', 'service-status']) {
    assert.ok(ROUTES[id], `${id} has no route`);
  }
});

test('every route is keyed by a screen id that exists in the atlas', () => {
  for (const id of Object.keys(ROUTES)) {
    assert.ok(ATLAS_IDS.has(id), `${id} is not a screen in screen-index.json`);
  }
});

test('every route lives under /workshop, the only path the server gives this app', () => {
  // server.js hands /workshop and /workshop/* the React page; anything else
  // is the old app or a 404, so a route outside it cannot be opened directly.
  for (const [id, path] of Object.entries(ROUTES)) {
    assert.match(path, /^\/workshop(\/|$)/, `${id} -> ${path}`);
  }
});

test('no two screens share a URL', () => {
  const paths = Object.values(ROUTES);
  assert.equal(new Set(paths).size, paths.length);
});
