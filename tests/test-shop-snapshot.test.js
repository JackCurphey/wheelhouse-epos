// The test shop's data from the drawings, as a small file the app's image can
// carry (WP-0.5 task 3.6; openspec/changes/add-hosted-copy, design 7). The
// loader used to read docs/design/user-journeys/generator/diary.mjs, which the
// image leaves out (the generator folder is 169 MB), so it couldn't run on the
// hosted copy (fresh review, 24 Oct). The snapshot must match the drawings
// exactly, so the test shop still can't drift from them. When a drawing
// changes, run:
//   node scripts/dev/snapshot-test-shop.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(ROOT, 'scripts/dev/test-shop-drawings.json');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

test('the snapshot is exactly what the drawings say now', async () => {
  const { drawingsSnapshot } = await import('../scripts/dev/snapshot-test-shop.mjs');
  assert.deepEqual(JSON.parse(readFileSync(SNAPSHOT, 'utf8')), await drawingsSnapshot(),
    'the drawings changed: run node scripts/dev/snapshot-test-shop.mjs and commit the result');
});

test('the loader reads the snapshot, nothing from docs/', () => {
  // The code, not the comments, which cite the drawings they came from.
  const loader = read('scripts/dev/load-test-shop.mjs').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
  assert.doesNotMatch(loader, /docs\//);
  assert.match(loader, /test-shop-drawings\.json/);
});

// What the image carries: server/, the public folders, and from scripts/ only
// what the Dockerfile copies. Every import the loader makes must be in there.
test('everything the loader needs is in the app image', () => {
  const docker = read('Dockerfile');
  const runtime = docker.slice(docker.lastIndexOf('\nFROM '));
  assert.match(runtime, /^COPY scripts\/dev\/load-test-shop\.mjs scripts\/dev\/test-shop-drawings\.json \.\/scripts\/dev\/$/m);
  assert.doesNotMatch(read('.dockerignore'), /^scripts\/?$/m);
  const loader = read('scripts/dev/load-test-shop.mjs');
  const specs = [...loader.matchAll(/(?:import\s*\(|from\s+|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const spec of specs) {
    if (spec.startsWith('node:') || builtinModules.includes(spec)) continue;
    const target = path.relative(ROOT, path.resolve(ROOT, 'scripts/dev', spec));
    assert.ok(target.startsWith('server/') || target === 'scripts/dev/test-shop-drawings.json', `the image has no ${target}`);
  }
});
