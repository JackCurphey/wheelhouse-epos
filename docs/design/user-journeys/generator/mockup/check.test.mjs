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

// Step 6: … "as each persona, at each size". The mockup shows a step at the
// chosen size, or desktop (then any size) where it isn't drawn at that size;
// at every size the step's named button must lead on.
test('every story clicks through at desktop, tablet and phone', async () => {
  const { stories } = await import('./stories.mjs');
  const broken = [];
  for (const size of ['desktop', 'tablet', 'phone']) for (const st of stories) st.steps.forEach((step, i) => {
    const next = st.steps[i + 1];
    if (!next || /^\(.*\)$/.test(String(step.does ?? '').trim())) return;
    // A size whose drawing genuinely lacks the button (`missingAt`, with
    // `missingWhy`) is a real gap in the drawings, not a click to fake.
    if (step.missingAt?.includes(size)) return;
    const d = drawings.get(step.id);
    const at =(dd) => dd?.sizes[size] ?? dd?.sizes.desktop ?? dd?.sizes.single ?? Object.values(dd?.sizes ?? {})[0];
    const s = at(d);
    // A step may name its button for one size (`doesAt: { phone: '…' }`) where the label differs.
    const label = String(step.doesAt?.[size] ?? step.does).trim();
    const leads = (dd, ss) => ss && controlsOf(ss.html).some((c) => c.label === label && resolve(c, dd, maps, fileToId)?.go === next.id);
    // On a phone or tablet the sidebar sits behind a menu: one tap to open it,
    // then the named item (a menu situation's drawing, id ending "-menu").
    const viaMenu = s && controlsOf(s.html).some((c) => { const t = resolve(c, d, maps, fileToId)?.go; return t && /-menu$/.test(t) && leads(drawings.get(t), at(drawings.get(t))); });
    const ok = leads(d, s) || viaMenu;
    if (!ok) broken.push(`${size}: story ${st.n}, step ${i + 1}: ${step.id} → ${next.id} (${step.does ?? ''})`);
  });
  assert.deepEqual(broken, []);
});

// Third walk, answer 7: under each drawing the mockup lists that screen's
// situation lines, the same lines as the canvas. Needs `node build.mjs` and
// `node mockup/build-mockup.mjs` run after the last change.
test('the mockup lists each screen’s situation lines, the same as the canvas', async () => {
  const { readFileSync } = await import('node:fs');
  const canvas = JSON.parse(readFileSync(new URL('../out/project/canvas.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../out-mockup/manifest.json', import.meta.url), 'utf8'));
  const onCanvas = {};
  for (const [key, n] of Object.entries(canvas.notes)) {
    const m = /^[a-z0-9]+_sit_(.+?)(?:_(\d+))?$/.exec(key);
    if (!m) continue;
    (onCanvas[m[1]] ??= []).push(...n.text.split('\n').filter((l) => l.startsWith('• ')));
  }
  const lines = manifest.lines ?? {};
  assert.ok(Object.keys(onCanvas).length > 100, `${Object.keys(onCanvas).length} situation notes on the canvas`);
  const bad = [];
  // A screen the mockup has no drawing of (a Release 1 picture) has no page to list them under.
  for (const [id, want] of Object.entries(onCanvas)) if (manifest.screens[id] && JSON.stringify(lines[id] ?? []) !== JSON.stringify(want)) bad.push(id);
  for (const id of Object.keys(lines)) if (!onCanvas[id]) bad.push(`${id} (not on the canvas)`);
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} screens whose lines differ`);
});
