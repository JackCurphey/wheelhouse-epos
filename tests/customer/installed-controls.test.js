// The booking screens use installed copies of the registry controls
// (src/components/ui/, the lint rule bans importing registry/ from src/).
// An installed copy that drifts from its registry source would ship the old
// behaviour, so each must match byte for byte. After changing a registry item,
// re-install it: npx shadcn add ./public/r/<name>.json --yes --overwrite
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const INSTALLED = {
  button: 'primitives', input: 'primitives', label: 'primitives', checkbox: 'primitives',
  textarea: 'primitives', 'choice-card': 'primitives', 'pill-group': 'primitives',
  'photo-picker': 'patterns', 'month-calendar': 'patterns', 'day-diary': 'patterns',
};

for (const [name, kind] of Object.entries(INSTALLED)) {
  test(`${name} is installed and matches registry/${kind}/${name}.tsx`, () => {
    const installed = `src/components/ui/${name}.tsx`;
    assert.ok(existsSync(installed), `${installed} is not installed`);
    assert.equal(readFileSync(installed, 'utf8'), readFileSync(`registry/${kind}/${name}.tsx`, 'utf8'),
      `${installed} differs from its registry source - re-install it`);
  });
}
