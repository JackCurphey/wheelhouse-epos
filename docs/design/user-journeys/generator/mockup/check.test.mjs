// Run: node --test docs/design/user-journeys/generator/mockup/
// Needs the Soft sand builds (node build.mjs in the generator).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDrawings } from './drawings.mjs';
import { controlsOf, resolve, loadLinks } from './controls.mjs';

const { drawings } = await loadDrawings();
const maps = await loadLinks();
const fileToId = (f) => { const id = f.replace(/\.dc\.html$/, '').replace(/-(desktop|tablet|phone)$/, ''); return drawings.has(id) ? id : null; };
const shown = [...drawings.values()].filter((d) => d.kind !== 'later' && Object.keys(d.sizes).length);

test('every button and link in the mockup goes somewhere', () => {
  const dead = new Map();
  for (const d of shown) for (const [size, s] of Object.entries(d.sizes)) for (const c of controlsOf(s.html)) if (!resolve(c, d, maps, fileToId)) { const k = `${d.id} · ${c.label || '(no label)'}`; dead.set(k, (dead.get(k) || 0) + 1); }
  assert.equal(dead.size, 0, `${dead.size} dead controls, e.g.\n${[...dead.keys()].slice(0, 40).join('\n')}`);
});

test('every target is a screen the mockup can show', () => {
  const bad = new Set();
  for (const d of shown) for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) { const t = resolve(c, d, maps, fileToId); if (t?.go && !(drawings.get(t.go) && Object.keys(drawings.get(t.go).sizes).length)) bad.add(`${d.id} · ${c.label} → ${t.go}`); }
  assert.deepEqual([...bad].slice(0, 40), []);
});
