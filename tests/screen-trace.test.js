// The checker is itself checked, because a checker that passes on anything is
// worse than no checker - it is a green light that means nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSource, screenIdsFromIndex } from '../scripts/ci/assert-screen-trace.mjs';

const screenIds = screenIdsFromIndex();

test('a route naming an unknown screen is rejected', () => {
  const result = checkSource(
    "// screens: not-a-real-screen\njobActionRoute('start', work, 'start');",
    screenIds
  );
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /not-a-real-screen/);
});

test('a workshop route with no screens comment is rejected', () => {
  const result = checkSource("jobActionRoute('start', work, 'start');", screenIds);
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /names no screen/);
});

test('a route whose comment is separated from it by a blank line is rejected', () => {
  // The next person to read the file would lose the trace too.
  const result = checkSource(
    "// screens: queue\n\njobActionRoute('start', work, 'start');",
    screenIds
  );
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /names no screen/);
});

test('routes outside the covered set are not required to name a screen', () => {
  // The till, inventory and storefront routes predate the atlas. Demanding a
  // screen id from them would fail the build for routes the rule is not about.
  const result = checkSource("route('GET', '/api/products', handler);", screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('a correctly traced route passes', () => {
  const result = checkSource("// screens: queue, job-page\njobActionRoute('start', work, 'start');", screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('the real server.js passes', () => {
  const source = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
  const result = checkSource(source, screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('a GET quote route with no screens comment is reported', () => {
  const result = checkSource(
    "route('GET', '/api/quotes/:id', async (req, res, params) => {\n});",
    screenIds
  );
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /names no screen/);
});

test('a GET quote route naming a real screen passes', () => {
  const result = checkSource(
    "// screens: quote-editor\nroute('GET', '/api/quotes/:id', async (req, res, params) => {\n});",
    screenIds
  );
  assert.equal(result.ok, true, result.problems.join('\n'));
});
