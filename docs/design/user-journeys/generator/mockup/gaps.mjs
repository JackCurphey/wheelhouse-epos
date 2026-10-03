// Writes ../../mockup-gaps.md: every page a mockup button leads to that no
// drawing shows yet ("Not drawn yet"), and everything that leaves Wheelhouse.
//   node mockup/gaps.mjs   (from the generator folder)
import { writeFileSync } from 'node:fs';
import { loadDrawings } from './drawings.mjs';
import { controlsOf, resolve, loadLinks } from './controls.mjs';

const { drawings } = await loadDrawings();
const maps = await loadLinks();
const fileToId = (f) => { const id = f.replace(/\.dc\.html$/, '').replace(/-(desktop|tablet|phone)$/, ''); return drawings.has(id) ? id : null; };
const gaps = new Map(), outs = new Map();
for (const d of drawings.values()) {
  if (d.kind === 'later') continue;
  for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) {
    const t = resolve(c, d, maps, fileToId);
    const bag = t?.act === 'notdrawn' ? gaps : t?.act === 'outside' ? outs : null;
    if (!bag) continue;
    const k = t.what;
    if (!bag.has(k)) bag.set(k, new Map());
    bag.get(k).set(`${d.journeyName}: ${c.label}`, true);
  }
}
const { stories } = await import('./stories.mjs');
const sizeGaps = stories.flatMap((st) => st.steps.map((step, i) => [st, step, i]).filter(([, step]) => step.missingAt?.length))
  .map(([st, step, i]) => `- **Story ${st.n}, step ${i + 1}** (${step.missingAt.join(', ')}): ${step.does} on \`${step.id}\` — ${step.missingWhy}`);
const list = (m) => [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([what, where]) => `- **${what}** — from ${[...where.keys()].slice(0, 3).join('; ')}${where.size > 3 ? ` (and ${where.size - 3} more)` : ''}`).join('\n');
writeFileSync(new URL('../../mockup-gaps.md', import.meta.url), `# Mockup gaps

Built by \`generator/mockup/gaps.mjs\` from the clickable mockup's wiring (issue #116 step 5).

## Pages a button leads to that no drawing shows yet (${gaps.size})

In the mockup these say "Not drawn yet". Each is a gap in the drawings for Jack to decide on: draw it, make it a line on an existing screen, or leave it for the build.

${list(gaps)}

## Story steps a smaller size can't click (${sizeGaps.length})

The check walks every story at desktop, tablet and phone. At these sizes the drawing has no button for the step, so the story can't be clicked there. Each is for Jack to decide on: draw the button at that size, or accept the longer way round.

${sizeGaps.join('\n')}

## Steps that leave Wheelhouse (${outs.size})

In the mockup these say "this happens outside Wheelhouse".

${list(outs)}
`);
console.log(JSON.stringify({ notDrawn: gaps.size, sizeGaps: sizeGaps.length, outside: outs.size }));
