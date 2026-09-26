// The customer route table: atlas screen id -> URL under /book.
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CUSTOMER_ROUTES } from '../../src/customer/routes.ts';

const index = JSON.parse(
  await readFile(new URL('../../docs/design/release-1-journey/screen-index.json', import.meta.url), 'utf8'),
);
const BOOK_IDS = index.filter((s) => s.group === 'book').map((s) => s.id);

test('the table has exactly the six book screens from the atlas', () => {
  assert.equal(BOOK_IDS.length, 6, `atlas book group changed: ${BOOK_IDS}`);
  assert.deepEqual(Object.keys(CUSTOMER_ROUTES).sort(), [...BOOK_IDS].sort());
});

test('every customer route lives under /book, the path the server gives this app', () => {
  for (const [id, path] of Object.entries(CUSTOMER_ROUTES)) {
    assert.match(path, /^\/book\//, `${id} -> ${path}`);
  }
});

test('no two screens share a URL', () => {
  const paths = Object.values(CUSTOMER_ROUTES);
  assert.equal(new Set(paths).size, paths.length);
});

test('pending is the private link the server issues', () => {
  // server/booking-link.js linkPath: /book/<slug>/booking/<code>
  assert.equal(CUSTOMER_ROUTES.pending, '/book/:shopSlug/booking/:code');
});
