// The booking screens use installed copies of the registry controls
// (src/components/ui/, the lint rule bans importing registry/ from src/).
// An installed copy that drifts from its registry source would ship the old
// behaviour, so each must match byte for byte. This test discovers the
// installed files itself (rather than hard-coding a list) so a control added
// to src/components/ui/ later is covered automatically.
//
// If the first installed control that imports a sibling registry item
// (e.g. registry/patterns/day-diary.tsx importing registry/primitives/button)
// is added, shadcn rewrites that import to `@/components/ui/button` on
// install, so a byte-for-byte comparison would need to normalise
// `@/registry/(primitives|patterns)/` to `@/components/ui/` in the registry
// source before comparing - none of the current controls need it.
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const KINDS = ['primitives', 'patterns'];

function registrySourceFor(name) {
  for (const kind of KINDS) {
    const path = `registry/${kind}/${name}.tsx`;
    if (existsSync(path)) return { kind, path };
  }
  return null;
}

const installedFiles = readdirSync('src/components/ui').filter((f) => f.endsWith('.tsx'));

for (const file of installedFiles) {
  const name = file.replace(/\.tsx$/, '');
  test(`${name} has a registry source and matches it`, () => {
    const source = registrySourceFor(name);
    assert.ok(source, `src/components/ui/${file} has no registry source in registry/primitives or registry/patterns`);
    const installed = readFileSync(`src/components/ui/${file}`, 'utf8');
    const original = readFileSync(source.path, 'utf8');
    assert.equal(
      installed,
      original,
      `src/components/ui/${file} differs from its registry source (${source.path}) - re-install it: ` +
        `npm run registry:build && npx shadcn add ./public/r/${name}.json --yes --overwrite`,
    );
  });
}
