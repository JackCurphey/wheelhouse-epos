// Run: node --test docs/design/user-journeys/generator/consolidate/
import test from 'node:test';
import assert from 'node:assert/strict';
import { blocks, screens, loadPlan } from './plan.mjs';

const all = screens();
const { plan, dupes } = await loadPlan();
const ids = new Set(all.map((s) => s.id));

test('every screen in journeys.mjs has a plan entry', () => {
  const missing = all.filter((s) => !plan.has(s.id)).map((s) => s.id);
  assert.deepEqual(missing, [], `${missing.length} screens have no entry`);
});

test('no screen is planned twice, and no entry names a screen that does not exist', () => {
  assert.deepEqual(dupes, []);
  assert.deepEqual([...plan.keys()].filter((id) => !ids.has(id)), []);
});

test('every "into" points at a kept screen', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'into' && plan.get(e.id)?.kind !== 'keep').map(([id, e]) => `${id} → ${e.id}`);
  assert.deepEqual(bad, []);
});

test('every kept screen names a building block from the README', () => {
  const B = blocks();
  assert.ok(B.size >= 15, 'README building-block list not found');
  const bad = [...plan].filter(([, e]) => e.kind === 'keep' && !B.has(e.block)).map(([id, e]) => `${id}: ${e.block}`);
  assert.deepEqual(bad, []);
});

test('every "later" says why', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'later' && !String(e.reason || '').trim()).map(([id]) => id);
  assert.deepEqual(bad, []);
});

test('the canvas fits: at most 450 screen boards', () => {
  const boards = [...plan.values()].filter((e) => e.kind === 'keep').reduce((n, e) => n + (e.sizes?.length || 1), 0);
  assert.ok(boards <= 450, `${boards} boards`);
});
