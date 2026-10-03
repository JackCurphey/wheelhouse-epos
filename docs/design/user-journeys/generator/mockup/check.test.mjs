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

// Step 6: every walk-through story can be clicked start to finish. A step's
// `does` in brackets is a hand-over (the next person picks up), not a click.
test('every story clicks from each step to the next', async () => {
  const { stories } = await import('./stories.mjs');
  const broken = [];
  for (const st of stories) st.steps.forEach((step, i) => {
    const next = st.steps[i + 1];
    if (!next || /^\(.*\)$/.test(String(step.does ?? '').trim())) return;
    const d = drawings.get(step.id);
    // The button the step names (its exact label) must itself lead on; a
    // sidebar link to the same place doesn't count.
    const ok = d && Object.values(d.sizes).some((s) => controlsOf(s.html).some((c) => c.label === String(step.does).trim() && resolve(c, d, maps, fileToId)?.go === next.id));
    if (!ok) broken.push(`story ${st.n}, step ${i + 1}: ${step.id} → ${next.id} (${step.does ?? ''})`);
  });
  assert.deepEqual(broken, []);
});
