// The coverage check (WP-W.5) counts the walk-4 coverage walks as a second,
// named source of evidence (generator/coverage-walks.mjs).
// Run: node --test docs/design/user-journeys/generator/consolidate/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const run = (args = [], env = {}) => spawnSync(process.execPath, ['docs/design/user-journeys/generator/coverage.mjs', ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env } });
const cell = (json, j, p) => JSON.parse(json).out.find((r) => r.id === j).cells[p];

test('each walk-4 file covers its cell, and taking one out turns it back to EMPTY', () => {
  const all = run(['--json']);
  assert.equal(all.status, 0, all.stderr);
  const c = cell(all.stdout, 'j15', 'Jack');
  assert.deepEqual(c.stories, []);
  assert.deepEqual(c.walks, ['coverage-12-privacy-delete.md']);
  const without = run(['--json', '--without', 'coverage-12-privacy-delete.md']);
  assert.equal(without.status, 0, without.stderr);
  assert.deepEqual(cell(without.stdout, 'j15', 'Jack').walks, []);
  const table = run(['--without', 'coverage-12-privacy-delete.md']).stdout;
  assert.match(table, /\| 15 Customer service \| — \| 9 \| — \| \*\*EMPTY\*\* \| — \|/);
  assert.match(run().stdout, /\| 15 Customer service \| — \| 9 \| — \| walk 4 \| — \|/);
});

test('every empty cell is walked: none left', () => {
  assert.match(run().stdout, /Empty cells: 0\b/);
});

test('a listed walk file that is missing fails the check', () => {
  const r = run([], { COVERAGE_WALKS_DIR: '/nonexistent-walk-4' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /missing/);
});
