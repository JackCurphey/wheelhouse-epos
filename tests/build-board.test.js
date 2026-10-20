// The build board (docs/build-progress/build-board.html, published as Jack's
// and Mark's shared artifact) draws everything from its BOARD block with one
// script. On 20 Oct an unescaped apostrophe ("shop's") inside a quoted line
// broke that script and the whole board showed nothing; this loads the page
// as a browser would and checks every part drew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../docs/build-progress/build-board.html', import.meta.url), 'utf8');

test('the build board’s script runs and every section has content', () => {
  const doc = new JSDOM(html, { runScripts: 'dangerously' }).window.document;
  for (const id of ['updated', 'ov-now', 'lead', 'sub']) assert.ok(doc.getElementById(id).textContent.trim(), `#${id} is empty`);
  for (const id of ['ov-tally', 'ov-wait', 'ov-mark', 'ov-next', 'tally', 'screens', 'pieces', 'asks', 'journeys']) {
    assert.ok(doc.getElementById(id).children.length > 0, `#${id} has nothing in it`);
  }
});
