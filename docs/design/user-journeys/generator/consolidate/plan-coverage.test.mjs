// The build plan covers the one canvas (issue #116 step 6).
// Run: node --test docs/design/user-journeys/generator/consolidate/
// Reads docs/superpowers/plans/2026-10-03-release-2-build-plan.md: each work
// package has a <!-- screens X --> region (kept screens in bold, situations
// plain) and each later or dropped group a <!-- later X --> region. Checks
// that every entry in the consolidation files lands in exactly one region,
// and every building block is built in exactly one package, never after a
// package that uses it. PLAN_FILE overrides the path (to test a broken copy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, loadPlan } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.env.PLAN_FILE || join(here, '..', '..', '..', '..', 'superpowers', 'plans', '2026-10-03-release-2-build-plan.md');
const md = readFileSync(file, 'utf8');
const { plan, lines } = await loadPlan();

const regions = [...md.matchAll(/<!-- (screens|later) ([\w.-]+) -->([\s\S]*?)<!-- \/(?:screens|later) -->/g)]
  .map(([, kind, where, body]) => ({ kind, where, body }));
const order = regions.map((r) => r.where);
const keptAt = new Map();
const otherAt = new Map();
const add = (m, id, where) => m.set(id, [...(m.get(id) || []), where]);
for (const { where, body } of regions) {
  const cleaned = body.replace(/the `[^`]+` board/g, '').replace(/same drawing as `[^`]+`/g, '');
  for (const m of cleaned.matchAll(/\*\*`([^`]+)`\*\*/g)) add(keptAt, m[1], where);
  for (const m of cleaned.replace(/\*\*`[^`]+`\*\*/g, '').matchAll(/`([^`]+)`/g)) add(otherAt, m[1], where);
}

test('the plan file has its screen regions, each once', () => {
  assert.ok(regions.length > 30, `${regions.length} regions found`);
  assert.deepEqual(order.filter((w, i) => order.indexOf(w) !== i), []);
});

test('every kept screen is built in exactly one package', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'keep').map(([id]) => [id, keptAt.get(id) || []]).filter(([, at]) => at.length !== 1).map(([id, at]) => `${id}: ${at.length} (${at.join(', ')})`);
  assert.deepEqual(bad, []);
});

test('every situation, same and later entry is in exactly one place', () => {
  const bad = [...plan].filter(([, e]) => e.kind !== 'keep').map(([id, e]) => [id, e, otherAt.get(id) || []]).filter(([, , at]) => at.length !== 1).map(([id, e, at]) => `${e.kind} ${id}: ${at.length} (${at.join(', ')})`);
  assert.deepEqual(bad, []);
});

test('no situation comes before the package that builds its screen', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'into').filter(([id, e]) => {
    const s = otherAt.get(id)?.[0]; const k = keptAt.get(e.id)?.[0];
    return s && k && order.indexOf(s) < order.indexOf(k);
  }).map(([id, e]) => `${id} before ${e.id}`);
  assert.deepEqual(bad, []);
});

test('the plan names no screen id the consolidation files lack', () => {
  assert.deepEqual([...keptAt.keys(), ...otherAt.keys()].filter((id) => !plan.has(id)), []);
});

test('the written lines add up', () => {
  let n = 0;
  for (const { body } of regions) for (const m of body.matchAll(/plus (?:(\d+) of its \d+|(\d+)) written lines?/g)) n += Number(m[1] || m[2]);
  assert.equal(n, lines.length);
});

test('every building block 1–47 is built exactly once, never after a package that uses it', () => {
  const B = blocks();
  const builtAt = new Map();
  const usedAt = [];
  for (const { kind, where, body } of regions) {
    if (kind !== 'screens') continue;
    const built = body.match(/\*Building blocks built here:\* (.*)\.\n/)?.[1] || '';
    for (const m of built.matchAll(/(?:^|; )(\d+) /g)) add(builtAt, Number(m[1]), where);
    const reused = body.match(/\*Reused, already built:\* (.*)\.\n/)?.[1] || '';
    for (const m of reused.matchAll(/(?:^|; )(\d+) /g)) usedAt.push([Number(m[1]), where]);
    for (const m of body.matchAll(/\*\*`[^`]+`\*\* \(block (\d+),/g)) usedAt.push([Number(m[1]), where]);
  }
  const bad = [...B.keys()].filter((b) => (builtAt.get(b) || []).length !== 1).map((b) => `block ${b}: built ${(builtAt.get(b) || []).length} times`);
  for (const [b, where] of usedAt) {
    const at = builtAt.get(b)?.[0];
    if (at && order.indexOf(at) > order.indexOf(where)) bad.push(`block ${b} used in ${where} before it is built in ${at}`);
  }
  assert.deepEqual(bad, []);
});
