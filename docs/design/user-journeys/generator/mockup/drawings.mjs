// Every drawing the mockup can show: each screen id in journeys.mjs, at each
// size its journey's Soft sand build drew it (out-<name>-sand/project/).
// Run the builds first (`node build.mjs` in the generator runs them all).
import { readFileSync, existsSync } from 'node:fs';
import { journeys } from '../journeys.mjs';
import { loadPlan } from '../consolidate/plan.mjs';

const gen = new URL('../', import.meta.url).pathname;
export const SIZES = ['single', 'desktop', 'tablet', 'phone'];
const sandDir = (src) => `${gen}out-${src}-sand/project/`;
const fileOf = (id, size) => (size === 'single' ? `${id}.dc.html` : `${id}-${size}.dc.html`);

const read = (f) => {
  const s = readFileSync(f, 'utf8');
  const helmet = /<helmet>\n([\s\S]*?)<\/helmet>\n/.exec(s)?.[1] ?? '';
  const inner = /<\/helmet>\n([\s\S]*)\n<\/x-dc>/.exec(s)?.[1] ?? '';
  const pv = /"\$preview":\{"width":(\d+),"height":(\d+)\}/.exec(s);
  return { helmet, html: inner, w: pv ? Number(pv[1]) : 1280, h: pv ? Number(pv[2]) : 800 };
};

// { id → { journey, title, role, owner, kind, sizes: { size → { html, w, h } } } }
export async function loadDrawings() {
  const { plan } = await loadPlan();
  const ownerOf = (id) => { const e = plan.get(id); return e.kind === 'keep' ? id : e.kind === 'into' || e.kind === 'same' ? ownerOf(e.id) : null; };
  const out = new Map();
  const helmets = new Set();
  for (const j of journeys) for (const r of j.rows) for (const x of r.screens) {
    const sizes = {};
    if (x.sand) for (const v of SIZES) { const f = sandDir(x.sand) + fileOf(x.id, v); if (existsSync(f)) { const d = read(f); helmets.add(d.helmet); sizes[v] = { html: d.html, w: d.w, h: d.h }; } }
    out.set(x.id, { id: x.id, journey: j.id, journeyName: j.name, row: r.label, title: x.title ?? x.id, role: x.role ?? '', kind: plan.get(x.id)?.kind, owner: ownerOf(x.id), sizes });
  }
  return { drawings: out, helmets: [...helmets] };
}
