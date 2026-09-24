// Fails if a workshop route does not name the atlas screen it serves.
//
// Why this exists: the Release 1 screen-build design sets one rule for the API
// layer - "every endpoint traces to a named screen in screen-index.json; an
// endpoint no screen consumes is not built". That is the specific guard against
// layer-first's usual failure, which is building endpoints for screens nobody
// specified. Written as a sentence in a design document it is a promise; here
// it is a check that runs, so a route added without a screen fails the build
// rather than being noticed in review or not at all.
//
// It is deliberately NOT applied to every route in server.js. The till,
// inventory, supplier and storefront routes predate the atlas and serve no
// screen in it; demanding a screen id from them would fail the build for
// routes the rule was never about. COVERED below is the list of path shapes
// this phase owns, and it grows as Phase 4 and Phase 5 land.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Route paths this rule applies to. Anything matching one of these must carry a
// `// screens: ...` comment immediately above it.
//
// The quotes pattern's trailing `(\/[a-z-]+)?` is optional so that a read route
// with no action segment - GET /api/quotes/:id itself, not just an action
// hanging off it - is still checked. This list grows as later phases add route
// shapes; a shape absent from it is not checked at all.
const COVERED = [
  /^\/api\/workshop-jobs\/:id\/[a-z-]+$/,
  /^\/api\/quotes\/:id(\/[a-z-]+)?$/,
  /^\/api\/portal\/:shopSlug\/quotes\//,
  /^\/api\/workshop-services(\/|$)/,
  /^\/api\/workshop-service-categories(\/|$)/,
  /^\/api\/portal\/:shopSlug\/services$/,
  /^\/api\/workshop-settings$/,
  /^\/api\/workshop-unavailability(\/|$)/,
  /^\/api\/portal\/:shopSlug\/availability$/,
  /^\/api\/workshop-capacity$/,
];

export function screenIdsFromIndex(indexPath = path.join(ROOT, 'docs/design/release-1-journey/screen-index.json')) {
  return new Set(JSON.parse(readFileSync(indexPath, 'utf8')).map((s) => s.id));
}

// Reads the `// screens: a, b` comment attached to the line a route is declared
// on. "Attached" means the comment lines immediately above it, so a route that
// grows a blank line between itself and its comment loses its trace and is
// reported - which is the right answer, since the next person to read it would
// lose it too.
function screensAbove(lines, i) {
  const named = [];
  for (let j = i - 1; j >= 0; j--) {
    const line = lines[j].trim();
    if (!line.startsWith('//')) break;
    const match = line.match(/^\/\/\s*screens:\s*(.+)$/);
    if (match) named.push(...match[1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return named;
}

export function checkSource(source, screenIds) {
  const lines = source.split('\n');
  const problems = [];

  lines.forEach((line, i) => {
    // Two shapes: a bare route(...) with a literal path, and the
    // jobActionRoute(action, ...) helper, whose path is built from its first
    // argument.
    const direct = line.match(/^\s*route\(\s*'[A-Z]+'\s*,\s*'([^']+)'/);
    const viaHelper = line.match(/^\s*jobActionRoute\(\s*'([a-z-]+)'/);
    if (!direct && !viaHelper) return;

    const routePath = direct ? direct[1] : `/api/workshop-jobs/:id/${viaHelper[1]}`;
    if (!COVERED.some((re) => re.test(routePath))) return;

    const named = screensAbove(lines, i);
    if (named.length === 0) {
      problems.push(`${routePath} (line ${i + 1}) names no screen`);
      return;
    }
    for (const id of named) {
      if (!screenIds.has(id)) {
        problems.push(`${routePath} (line ${i + 1}) names screen "${id}", which is not in screen-index.json`);
      }
    }
  });

  return { ok: problems.length === 0, problems };
}

// Run as a script rather than imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const source = readFileSync(path.join(ROOT, 'server/server.js'), 'utf8');
  const { ok, problems } = checkSource(source, screenIdsFromIndex());
  if (!ok) {
    console.error('Screen trace FAILED. Every workshop route must name the atlas screen it serves:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nAdd a `// screens: <id>` comment above the route, using an id from');
    console.error('docs/design/release-1-journey/screen-index.json. If no screen consumes it,');
    console.error('the endpoint should not exist - that is the rule, not a formality.');
    process.exit(1);
  }
  console.log('Screen trace OK: every covered workshop route names a screen that exists.');
}
