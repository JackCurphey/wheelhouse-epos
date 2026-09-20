// Asserts Jack's 17 September review notes have been applied to the atlas.
// Source of the notes: docs/reviews/2026-09-17-release-1-screen-review-jack.md
// Run after: python3 package.py && node check-static.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = new URL('./', import.meta.url), path = n => new URL(n, url);
const index = JSON.parse(await readFile(path('screen-index.json'), 'utf8'));
const source = (await readFile(path('screens.js'), 'utf8'))
  + (await readFile(path('branches.js'), 'utf8'));

const byId = id => {
  const screen = index.find(s => s.id === id);
  assert.ok(screen, `No screen with id "${id}"`);
  return screen;
};

// The add(...) call for one screen: from add('<id>' up to the next add(' at line start.
const sourceOf = id => {
  const start = source.indexOf(`add('${id}'`);
  assert.ok(start > -1, `No add() call for "${id}"`);
  const next = source.indexOf("\nadd('", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
};

// Note 82 — a customer may have several bikes, so the record needs a bike chooser.
{
  const body = sourceOf('customer-record');
  assert.match(body, /<select/, 'customer-record has no <select> for choosing a bike');
  assert.match(body, /bike/i, 'customer-record bike chooser is not identifiable as a bike chooser');
}

console.log('check-notes: all applied-note assertions passed');
