// Lists the controls with no target yet, for some journeys:
//   node mockup/dead.mjs j11 j15        (from the generator folder)
// Each line: screen id (and the kept screen it's a situation of) · label · how many sizes.
import { loadDrawings } from './drawings.mjs';
import { controlsOf, resolve, loadLinks } from './controls.mjs';

const want = process.argv.slice(2);
const { drawings } = await loadDrawings();
const maps = await loadLinks();
const fileToId = (f) => { const id = f.replace(/\.dc\.html$/, '').replace(/-(desktop|tablet|phone)$/, ''); return drawings.has(id) ? id : null; };
const rows = new Map();
for (const d of drawings.values()) {
  if (d.kind === 'later' || (want.length && !want.includes(d.journey))) continue;
  for (const [size, s] of Object.entries(d.sizes)) for (const c of controlsOf(s.html)) if (!resolve(c, d, maps, fileToId)) {
    const k = `${d.journey} ${d.id}${d.owner && d.owner !== d.id ? ` (situation of ${d.owner})` : ''} · ${c.label || '(no label)'}`;
    rows.set(k, (rows.get(k) ?? 0) + 1);
  }
}
for (const [k, n] of [...rows].sort()) console.log(`${k}  [${n}]`);
console.error(`${rows.size} unwired`);
