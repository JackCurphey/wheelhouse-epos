// The checker is itself checked, because a checker that passes on anything is
// worse than no checker - it is a green light that means nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERED, checkSource, checkRouteFiles, routeSources, screenIdsFromIndex } from '../scripts/ci/assert-screen-trace.mjs';

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
  // The till, stock and website routes predate the screen designs. Demanding a
  // screen id from them would fail the build for routes the rule is not about.
  const result = checkSource("route('GET', '/api/products', handler);", screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('a correctly traced route passes', () => {
  const result = checkSource("// screens: queue, job-page\njobActionRoute('start', work, 'start');", screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

// WP-0.4 (split plan §4.1 step 5): routes are moving out of server.js into
// server/routes/<area>.js, so the check reads both, and a read that finds no
// screen-tagged route at all fails rather than passing on nothing.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the real server.js and route files pass', () => {
  const files = routeSources(ROOT);
  assert.ok(files.some((f) => f.file === 'server/server.js'), 'server.js was not read');
  const result = checkRouteFiles(files, screenIds);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

function fakeRepo(routeFiles) {
  const root = mkdtempSync(path.join(tmpdir(), 'trace-'));
  mkdirSync(path.join(root, 'server', 'routes'), { recursive: true });
  writeFileSync(path.join(root, 'server', 'server.js'), routeFiles['server.js'] ?? '');
  for (const [name, source] of Object.entries(routeFiles)) {
    if (name !== 'server.js') writeFileSync(path.join(root, 'server', 'routes', name), source);
  }
  return root;
}

test('an empty read fails rather than passing', () => {
  const root = fakeRepo({});
  try {
    const result = checkRouteFiles(routeSources(root), screenIds);
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /no screen-tagged routes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a route moved into server/routes/ is still checked, and the file is named', () => {
  const root = fakeRepo({
    'server.js': "// screens: queue\njobActionRoute('start', work, 'start');",
    'workshop.js': "export function register(route) {\n  route('GET', '/api/workshop-capacity', h);\n}",
  });
  try {
    const result = checkRouteFiles(routeSources(root), screenIds);
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /server\/routes\/workshop\.js: \/api\/workshop-capacity \(line 2\) names no screen/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

test('the service catalogue and public service list routes must name their screens', () => {
  for (const line of [
    "route('GET', '/api/portal/:shopSlug/services', h);",
    "route('POST', '/api/workshop-services', h);",
    "route('PUT', '/api/workshop-service-categories/:id', h);",
  ]) {
    const result = checkSource(line, screenIds);
    assert.equal(result.ok, false, `${line} passed with no screens comment`);
    assert.match(result.problems.join('\n'), /names no screen/);
  }
});

// A moved route the line patterns can't read (double quotes, a template
// literal, a call split over lines, another local name for route) would just
// not be counted, and the rest would keep the total above zero. So the count
// is tied to the route table itself: tests/fixtures/route-list.txt, which
// tests/route-list.test.js pins to listRoutes().
test('every covered route in the route table is found and checked', () => {
  const table = readFileSync(path.join(ROOT, 'tests/fixtures/route-list.txt'), 'utf8')
    .split('\n').filter(Boolean).map((line) => line.split(' ')[1]);
  const expected = table.filter((p) => COVERED.some((re) => re.test(p))).length;
  assert.ok(expected > 0, 'no covered routes in the route table');
  assert.equal(checkRouteFiles(routeSources(ROOT), screenIds).covered, expected);
});
