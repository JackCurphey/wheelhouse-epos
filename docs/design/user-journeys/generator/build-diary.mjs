// Builds the Workshop diary redesign canvas (out-diary/project/*) from diary.mjs.
// Separate from build.mjs: does not touch out/ or the user journeys canvas.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { screens, ROWS, TW, TH } from './diary.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { FONT_LINK, FONT, FONT_DISPLAY, C, THEME } from './ui.mjs';

const here = new URL('./', import.meta.url).pathname;
// Sand builds land in their own out-diary-sand/ directory so out-diary/
// (the published Fjell set) is left untouched and either can replace the
// other one for one — same board ids, same canvas.json layout.
const root = here + (THEME === 'sand' ? 'out-diary-sand/' : 'out-diary/');
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

// --desktop: build desktop boards only, while the design is being iterated
// (decision 25, 27 Sep 2026 round). Tablet/phone code stays in diary.mjs but
// isn't emitted in this mode.
const DESKTOP_ONLY = process.argv.includes('--desktop');

// page()'s body font/colours — was a Fjell-only literal; now themed via
// ui.mjs's FONT/C so a sand build's HTML <body> (and its default text/link
// colours, before any board's own styles take over) matches the theme too.
const FONT_HTML = FONT; // plain quotes: entities inside <style> are not decoded, which silently dropped the font
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
body,button,input,select,textarea{font-family:${FONT_HTML}}
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

const SIZES = DESKTOP_ONLY ? [['desktop', DW, DH]] : [['desktop', DW, DH], ['tablet', TW, TH], ['phone', PW, PH]];
// waiting-open/change-selected keep their file ids (so existing links still
// work) but read with fuller titles on the canvas — decision 14/19's
// one-click-highlights state. The job boards use the brief's exact titles
// (decision 20: one page, no tabs, per stage).
const TITLE_OVERRIDE = {
  'waiting-open': 'Pending request selected',
  'change-selected': 'Change request selected',
  'diary-context-menu': 'Diary · right-click a job',
  'job-quick-overview': 'Diary · job overview (quick look)',
  'diary-day': 'Day view',
  'diary-settings': 'Diary settings',
  'new-job-day': 'New job (from the day view)',
  'job-overview': 'Job · expected',
  'job-book-in': 'Job · booked in, tag printed',
  'job-quote': 'Job · quote',
  'job-mechanic': 'Job · in the workshop (mechanic)',
  'job-waiting-parts': 'Job · waiting for parts',
  'job-finished': 'Job · finished',
  'job-collection': 'Job · collection',
  'job-checklist': 'Job · full service checklist',
};
const TITLE = (id) => TITLE_OVERRIDE[id] || id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const boards = {};
const order = [];
const notes = {};
const GAP_SIZE = 80; // between a screen's three sizes
const GAP_SCREEN = 160; // between screens in a row
const ROW_GAP = 160;
const TITLE_H = 223;
const TITLE_GAP = 40;
const ROW_H = Math.max(DH, TH, PH); // 844 (phone)

let y = 0;
let rowFirstFile = null;
const rowSummaries = [];
// Desktop-only mode lays out each row with just the desktop boards, 80px
// apart, plus Main — no per-screen/per-size gap distinction needed since
// there's only one size.
const BOARD_GAP = DESKTOP_ONLY ? GAP_SIZE : null;

for (const rowDef of ROWS) {
  const rowTop = y;
  const boardY = rowTop + TITLE_H + TITLE_GAP;
  let x = 0;
  let firstFileInRow = null;
  let trailingGap = 0;
  for (const id of rowDef.screens) {
    const scr = screens[id];
    for (const [size, w, h] of SIZES) {
      const file = `${id}-${size}.dc.html`;
      const html = page(`${TITLE(id)} (${size})`, w, h, scr[size]);
      writeFileSync(root + 'project/' + file, html);
      boards[file] = { x, y: boardY, w, h, title: `${TITLE(id)} · ${size}`, is_interactive: true };
      order.push(file);
      firstFileInRow ??= file;
      x += w + GAP_SIZE;
      trailingGap = GAP_SIZE;
    }
    if (!DESKTOP_ONLY) { x += GAP_SCREEN - GAP_SIZE + 80; trailingGap = GAP_SCREEN - GAP_SIZE + 80; } // wider gap between screens than between a screen's own sizes
  }
  const rowWidth = Math.max(x - trailingGap, 1600);
  notes[`row_${rowDef.label.replace(/[^a-z0-9]+/gi, '_')}_title`] = { x: 0, y: rowTop, text: rowDef.label, kind: 'title1', maxW: rowWidth };
  rowSummaries.push({ label: rowDef.label, count: rowDef.screens.length, first: firstFileInRow });
  y = boardY + ROW_H + ROW_GAP;
}

// Main.dc.html — title, one short paragraph, list of rows with links to each row's first board.
const MW = 900, MH = 620;
const boardsPerScreen = DESKTOP_ONLY ? 1 : 3;
const rowLine = (r) => `<a href="${r.first}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">
<span style="font-size: 17px; font-weight: 600">${esc(r.label)}</span>
<span style="font-size: 13px; color: ${C.muted}">${r.count} screen${r.count === 1 ? '' : 's'} · ${r.count * boardsPerScreen} board${r.count * boardsPerScreen === 1 ? '' : 's'} ›</span>
</a>`;
const main = `<div style="width: ${MW}px; height: ${MH}px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 24px; background: ${C.bg}">
<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 13px; font-weight: 700; letter-spacing: 1px; color: ${C.accent}">WHEELHOUSE</div>
<h1 style="margin: 0; font-family: ${FONT_DISPLAY}; font-size: 34px; line-height: 1.15; font-weight: 700; letter-spacing: -0.6px">Workshop day — diary redesign</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: ${C.ink}; max-width: 680px">This is the Workshop day redesign, organised around the diary, for review. Customer names, bikes and job numbers shown are examples.</p>
${DESKTOP_ONLY ? `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}; max-width: 680px">Desktop only for now — tablet and phone will be redrawn once the desktop design is agreed.</p>` : ''}
</div>
<div style="background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden">
${rowSummaries.map(rowLine).join('\n')}
</div>
</div>`;
writeFileSync(root + 'project/Main.dc.html', page('Workshop day — diary redesign', MW, MH, main));
boards['Main.dc.html'] = { x: 0, y: -400, w: MW, h: MH, title: 'Overview', is_interactive: true };
order.unshift('Main.dc.html');

const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString() },
  title: 'Workshop day — diary redesign',
  launch: { view: 'canvas' },
  pages: [],
  boards,
  order,
  notes,
  designSystems: [{ title: 'Wheelhouse', namespace: 'wheelhouse', artifact: 'https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH', version: null, copiedAt: new Date().toISOString() }],
};
writeFileSync(root + 'project/canvas.json', JSON.stringify(canvas, null, 1));

const screenCount = Object.keys(screens).length;
console.log(JSON.stringify({ desktopOnly: DESKTOP_ONLY, screens: screenCount, boards: order.length, expected: screenCount * boardsPerScreen + 1 }));
