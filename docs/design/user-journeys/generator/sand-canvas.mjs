// Builds a journey's own Soft sand Design canvas (out-<name>-sand/project/*):
// one board per screen per size it was drawn at, rows titled, and a Main
// overview board. Shared by build-app-map.mjs (journey A) and
// build-signin.mjs (journey B); same board format as build-diary.mjs.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { TW, TH } from './diary.mjs';
import { FONT_LINK, FONT, C, THEME } from './ui.mjs';

export function buildSandCanvas({ name, title, blurb, screens, ROWS, TITLES, singleSize = [1760, 1180] }) {
if (THEME !== 'sand') throw new Error(`${title} is drawn in Soft sand: run with --theme sand`);
const [MAP_W, MAP_H] = singleSize;
const here = new URL('./', import.meta.url).pathname;
const root = here + `out-${name}-sand/`;
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain quotes in <style>: entities there are not decoded (the serif-fallback gotcha).
function page(title, w, h, body) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${FONT_LINK.replace(/&/g, '&amp;')}">
<style>
body,button,input,select,textarea{font-family:${FONT}}
body{margin:0;color:${C.ink};background:${C.bg}}
a{color:${C.accent}}a:hover{color:${C.ink}}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

const SIZES = [['single', MAP_W, MAP_H], ['desktop', DW, DH], ['tablet', TW, TH], ['phone', PW, PH]]; // 'single' = the one large app map board
const GAP = 80, ROW_GAP = 160, TITLE_H = 223, TITLE_GAP = 40;

const boards = {}, order = [], notes = {}, rowSummaries = [];
let y = 0;
for (const rowDef of ROWS) {
  const boardY = y + TITLE_H + TITLE_GAP;
  let x = 0, rowMaxH = 0, first = null, count = 0;
  for (const id of rowDef.screens) {
    for (const [size, w, h] of SIZES) {
      if (!screens[id][size]) continue;
      const file = size === 'single' ? `${id}.dc.html` : `${id}-${size}.dc.html`;
      const title = TITLES[id] || id;
      writeFileSync(root + 'project/' + file, page(`${title} (${size})`, w, h, screens[id][size]));
      boards[file] = { x, y: boardY, w, h, title: `${title} · ${size}`, is_interactive: true };
      order.push(file);
      first ??= file;
      count++;
      x += w + GAP;
      rowMaxH = Math.max(rowMaxH, h);
    }
  }
  notes[`row_${rowDef.label.replace(/[^a-z0-9]+/gi, '_')}_title`] = { x: 0, y, text: rowDef.label, kind: 'title1', maxW: Math.max(x - GAP, 1600) };
  rowSummaries.push({ label: rowDef.label, count, first });
  y = boardY + rowMaxH + ROW_GAP;
}

const MW = 900, MH = 520;
const rowLine = (r) => `<a href="${r.first}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">
<span style="font-size: 17px; font-weight: 600">${esc(r.label)}</span>
<span style="font-size: 13px; color: ${C.muted}">${r.count} board${r.count === 1 ? '' : 's'} ›</span>
</a>`;
const main = `<div style="width: ${MW}px; height: ${MH}px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 24px; background: ${C.bg}">
<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 13px; font-weight: 700; letter-spacing: 1px; color: ${C.accent}">WHEELHOUSE</div>
<h1 style="margin: 0; font-size: 34px; line-height: 1.15; font-weight: 700; letter-spacing: -0.6px">${esc(title)}</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: ${C.ink}; max-width: 680px">${esc(blurb)}</p>
</div>
<div style="background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden">
${rowSummaries.map(rowLine).join('\n')}
</div>
</div>`;
writeFileSync(root + 'project/Main.dc.html', page(title, MW, MH, main));
boards['Main.dc.html'] = { x: 0, y: -(MH + 200), w: MW, h: MH, title: 'Overview', is_interactive: true };
order.unshift('Main.dc.html');

const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString() },
  title,
  launch: { view: 'canvas' },
  pages: [],
  boards,
  order,
  notes,
  designSystems: [],
};
writeFileSync(root + 'project/canvas.json', JSON.stringify(canvas, null, 1));
console.log(JSON.stringify({ theme: THEME, rows: ROWS.length, boards: order.length }));
}
