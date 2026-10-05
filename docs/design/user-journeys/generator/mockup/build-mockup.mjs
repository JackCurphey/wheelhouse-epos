// Builds the clickable mockup into ../out-mockup/ (issue #116 step 5;
// docs/superpowers/specs/2026-10-03-clickable-mockup.md). Run the Soft sand
// builds first (`node build.mjs` in the generator folder).
//   index.html — the page; manifest.json — screens, situations, stories;
//   data/<journey>-<size>.json — each drawing's HTML, its buttons marked with
//   where they go.
import { mkdirSync, rmSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { loadDrawings } from './drawings.mjs';
import { controlsOf, resolve, loadLinks } from './controls.mjs';
import { VIEWS } from './views.mjs';
import { situationLines } from '../consolidate/situation-lines.mjs';

const here = new URL('./', import.meta.url).pathname;
const out = new URL('../out-mockup/', import.meta.url).pathname;
const { drawings, helmets } = await loadDrawings();
const maps = await loadLinks();
let stories = [];
try { ({ stories } = await import('./stories.mjs')); } catch { /* stories come later */ }
const fileToId = (f) => { const id = f.replace(/\.dc\.html$/, '').replace(/-(desktop|tablet|phone)$/, ''); return drawings.has(id) ? id : null; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Mark each control with its target: data-go="<id>" or data-act="back|stay|outside|notdrawn" (+ data-what).
const dead = [];
const mark = (d, html) => {
  let res = '', at = 0;
  for (const c of controlsOf(html)) {
    const t = resolve(c, d, maps, fileToId);
    if (!t) { dead.push(`${d.id} · ${c.label}`); continue; }
    const extra = t.go ? ` data-go="${esc(t.go)}"${t.say ? ` data-say="${esc(t.say)}"` : ''}${t.shop ? ` data-shop="${esc(t.shop)}"` : ''}${t.first ? ` data-first="${esc(t.first)}"` : ''}` : ` data-act="${t.act}"${t.what ? ` data-what="${esc(t.what)}"` : ''}`;
    res += html.slice(at, c.openEnd - 1) + extra + '>';
    at = c.openEnd;
  }
  return res + html.slice(at);
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out + 'data', { recursive: true });
const data = {};
const screens = {};
const helmetIndex = new Map(helmets.map((h, i) => [h, i]));
for (const d of drawings.values()) {
  if (d.kind === 'later' || !Object.keys(d.sizes).length) continue;
  const sizes = {};
  for (const [size, s] of Object.entries(d.sizes)) {
    const key = `${d.journey}-${size === 'single' ? 'desktop' : size}`;
    (data[key] ??= {})[d.id] = mark(d, s.html);
    sizes[size === 'single' ? 'desktop' : size] = { w: s.w, h: s.h, file: key };
  }
  screens[d.id] = { title: d.title, role: d.role, journey: d.journey, journeyName: d.journeyName, owner: d.owner, kept: d.kind === 'keep', sizes };
}
if (dead.length) { console.error(`${new Set(dead).size} controls have no target — run node mockup/dead.mjs`); process.exitCode = 1; }
for (const [k, v] of Object.entries(data)) writeFileSync(`${out}data/${k}.json`, JSON.stringify(v));
// Situations of each kept screen, in journeys.mjs order.
const situations = {};
for (const [id, s] of Object.entries(screens)) if (s.owner && s.owner !== id) (situations[s.owner] ??= []).push(id);
// Each kept screen's situation lines, the same as the canvas's note under its
// board (third walk, answer 7): shown under the drawing, read-only.
const linesOf = await situationLines();
const lines = {};
for (const [id, s] of Object.entries(screens)) if (s.kept) { const l = linesOf(id); if (l.length) lines[id] = l; }
const css = helmets.map((h) => h.replace(/<link[^>]*>/g, '').replace(/<\/?style>/g, '').replace(/\bbody\s*\{/g, ':host{')).join('\n');
// The views of a screen for another person or shop (views.mjs), as long as
// the drawing is still shown.
const views = {};
for (const [o, vs] of Object.entries(VIEWS)) { const ok = vs.filter((v) => screens[v.id]); if (screens[o] && ok.length) views[o] = ok; }
writeFileSync(out + 'manifest.json', JSON.stringify({ screens, situations, lines, stories, css, views }));
// The drawings' own font link (Soft sand: Public Sans). This process is Fjell,
// so ui.mjs's FONT_LINK here would be Work Sans (issue #123, point 12).
const fontLinks = new Set(helmets.map((h) => /<link rel="stylesheet" href="([^"]*fonts\.googleapis[^"]*)"/.exec(h)?.[1]).filter(Boolean));
if (fontLinks.size !== 1) throw new Error(`expected one font link across the drawings, found ${fontLinks.size}`);
const [FONT_LINK] = fontLinks;
writeFileSync(out + 'index.html', readFileSync(here + 'page.html', 'utf8').replace('%FONT_LINK%', FONT_LINK.includes('&amp;') ? FONT_LINK : FONT_LINK.replace(/&/g, '&amp;')));
const files = readdirSync(out + 'data');
const biggest = Math.max(...files.map((f) => statSync(out + 'data/' + f).size));
console.log(JSON.stringify({ screens: Object.keys(screens).length, dataFiles: files.length, biggestMB: +(biggest / 1e6).toFixed(1), dead: new Set(dead).size }));
