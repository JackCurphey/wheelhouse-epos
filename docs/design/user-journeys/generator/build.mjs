// Builds the canvas files (project/canvas.json + one .dc.html per screen) from journeys.mjs.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { journeys } from './journeys.mjs';
import * as stage1 from './stage1.mjs';
import * as stage2 from './stage2.mjs';
const DRAWN = { ...stage1.screens, ...stage2.screens };
import { FONT_LINK } from './ui.mjs';
import { workflow, WF_W, WF_H } from './workflow.mjs';

const here = new URL('./', import.meta.url).pathname;
const root = here + 'out/';
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

const blobs = JSON.parse(readFileSync(here + 'blobs-fjell.json', 'utf8'));
const designs = Object.fromEntries(JSON.parse(readFileSync(here + 'shots/screens.json', 'utf8')).map((s) => [s.id, s]));

const STATUS = {
  review: { label: 'For review', long: 'NEW DRAWING · FOR YOUR REVIEW', bar: '#0e5f6f', tint: '#e2f1f3', ink: '#0e5f6f' },
  built: { label: 'Built', long: 'BUILT', bar: '#1f6f5c', tint: '#e8f5ec', ink: '#164f42' },
  designed: { label: 'Designed', long: 'DESIGNED · NOT BUILT', bar: '#2c5289', tint: '#eaf1fb', ink: '#2c5289' },
  old: { label: 'Old app', long: 'OLD APP ONLY · NEEDS A NEW DESIGN', bar: '#6a3ea1', tint: '#f1e8fb', ink: '#6a3ea1' },
  gap: { label: 'Not designed', long: 'NOT DESIGNED YET', bar: '#b8460f', tint: '#fbeee6', ink: '#93380b' },
};
const STRIP = 56;
const FONT = '&quot;Work Sans&quot;, ui-sans-serif, system-ui, sans-serif';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function roleOf(designRole) {
  const who = designRole.split('·')[0].trim();
  if (who.startsWith('Service desk')) return 'Staff';
  if (who.startsWith('Mechanic')) return 'Mechanic';
  if (who.startsWith('Manager')) return 'Manager';
  if (who.startsWith('Customer')) return 'Customer';
  return who;
}
const deviceOf = (role, mobile) => (mobile ?? role === 'Customer') ? 'phone' : role === 'Mechanic' ? 'tablet' : 'desktop';
const sizeOf = (device) => (device === 'phone' ? [390, 844] : [1100, 760]);

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
body{margin:0;font-family:${FONT};color:#1c1e19;background:#f3f2ee}
a{color:#3f4d33}a:hover{color:#1c1e19}
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

const navLink = (href, text, label) => href
  ? `<a href="${href}" aria-label="${label}" style="display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 8px; background: rgba(255,255,255,0.18); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none">${text}</a>`
  : `<span style="display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 8px; color: rgba(255,255,255,0.45); font-size: 14px; font-weight: 600">${text}</span>`;

function strip(st, meta, nav) {
  const s = STATUS[st];
  return `<div style="height: ${STRIP}px; box-sizing: border-box; padding: 0 10px 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${s.bar}; color: #ffffff">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 13px; font-weight: 700; letter-spacing: 0.6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${s.long}</span>
<span style="font-size: 12px; font-weight: 500; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(meta)} · ${nav.pos}</span>
</div>
<nav style="display: flex; gap: 6px; flex-shrink: 0">
${navLink(nav.prev, '‹ Prev', 'Previous screen')}
${navLink('Main.dc.html', 'Overview', 'Back to the overview')}
${navLink(nav.next, 'Next ›', 'Next screen')}
</nav>
</div>`;
}

function imageBoard(scr, w, h, meta, title, nav) {
  const src = `/_blob/${blobs[scr.id]}`;
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #ffffff">
${strip(scr.status, meta, nav)}
<img src="${src}" alt="${esc(title)}" style="width: ${w}px; height: ${h}px; display: block">
</div>`;
}

function drawnBoard(scr, w, h, meta, inner, nav) {
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #ffffff">
${strip(scr.status, meta, nav)}
<div style="width: ${w}px; height: ${h}px; overflow: hidden">${inner}</div>
</div>`;
}

function placeholderBoard(scr, w, h, meta, nav) {
  const s = STATUS[scr.status];
  const phone = w < 500;
  const pad = phone ? 24 : 48;
  const list = scr.content.length
    ? `<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: #56594f">WHAT GOES ON IT</div>
${scr.content.map((c) => `<div style="display: flex; gap: 10px; align-items: flex-start; font-size: ${phone ? 15 : 16}px; line-height: 1.45"><span style="flex-shrink: 0; width: 8px; height: 8px; margin-top: 8px; border-radius: 999px; background: ${s.bar}"></span><span>${esc(c)}</span></div>`).join('\n')}
</div>` : '';
  const today = scr.today
    ? `<div style="padding: 16px 18px; border-radius: 10px; background: ${STATUS.old.tint}; color: #3a2159; font-size: ${phone ? 14 : 15}px; line-height: 1.45"><strong style="display: block; margin-bottom: 4px; color: ${STATUS.old.ink}">Today</strong>${esc(scr.today)}</div>` : '';
  const source = scr.source ? `<div style="font-size: 13px; color: #56594f; line-height: 1.4">Source: ${esc(scr.source)}</div>` : '';
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #f3f2ee">
${strip(scr.status, meta, nav)}
<div style="flex-grow: 1; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column">
<div style="flex-grow: 1; box-sizing: border-box; padding: ${phone ? 24 : 40}px; border: 2px dashed #83867a; border-radius: 10px; background: #fbfbf9; display: flex; flex-direction: column; gap: ${phone ? 18 : 24}px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${s.ink}">${esc(scr.role.toUpperCase())} · ${esc(deviceOf(scr.role).toUpperCase())}</div>
<h1 style="margin: 0; font-size: ${phone ? 26 : 32}px; line-height: 1.2; font-weight: 700; letter-spacing: -0.4px">${esc(scr.title)}</h1>
<p style="margin: 0; font-size: ${phone ? 16 : 18}px; line-height: 1.5; color: #3d4038">${esc(scr.purpose)}</p>
</div>
${list}
${today}
<div style="flex-grow: 1"></div>
${source}
</div>
</div>
</div>`;
}

function navFor(list, file) {
  const i = list.indexOf(file);
  return { prev: list[i - 1] || null, next: list[i + 1] || null, pos: `${i + 1} of ${list.length}` };
}
const boards = {};
const order = [];
const notes = {};
const pages = [];
const counts = [];
const GAP_X = 80;
// One canvas: the overview on top, then every journey as a single left-to-right line, stacked.
let y = 360 + 60 + journeys.length * 58 + 140 + 1000;

// A screen becomes one board, or two (desktop + phone) when it is a new drawing.
const variantsOf = (j, x) => {
  if (!x.drawn) return [{ file: `${j.id}-${x.id}.dc.html`, v: null }];
  const d = DRAWN[x.id];
  if (!d) throw new Error(`no drawing for ${x.id}`);
  if (d.single) return [{ file: `${j.id}-${x.id}.dc.html`, v: 'single' }];
  return [{ file: `${j.id}-${x.id}-desktop.dc.html`, v: 'desktop' }, { file: `${j.id}-${x.id}-phone.dc.html`, v: 'phone' }];
};
const seq = journeys.map((j) => j.rows.flatMap((r) => r.screens.flatMap((x) => variantsOf(j, x).map((o) => o.file))));
let numbered = 0;
journeys.forEach((j, ji) => {
  const list = seq[ji];
  const num = j.num ?? String(++numbered).padStart(2, '0');
  const tally = { review: 0, built: 0, designed: 0, old: 0, gap: 0, first: null };
  let x = 0;
  let tallest = 0;
  for (const row of j.rows) {
    notes[`${j.id}_s${Object.keys(notes).length}`] = { x, y: y - 240, text: row.label, w: 520, size: 'l', bold: true, fill: 'gray', maxH: 150 };
    for (const scr0 of row.screens) {
      const scr = { ...scr0 };
      for (const { file, v } of variantsOf(j, scr)) {
        const nav = { ...navFor(list, file), };
        let title, meta, w, h, html;
        if (v) {
          const d = DRAWN[scr.id];
          if (v === 'single') { [w, h] = [stage1.MAP_W, stage1.MAP_H]; meta = scr.role; }
          else { [w, h] = v === 'desktop' ? [stage1.DW, stage1.DH] : [stage1.PW, stage1.PH]; meta = `${scr.role} · ${v}`; }
          title = v === 'single' ? scr.title : `${scr.title} (${v})`;
          html = drawnBoard(scr, w, h, meta, d[v], nav);
        } else if (scr.status === 'built' || scr.status === 'designed') {
          const dsg = designs[scr.id];
          if (!dsg) throw new Error(`no design for ${scr.id}`);
          const role = roleOf(dsg.role);
          const device = deviceOf(role, dsg.mobile);
          [w, h] = sizeOf(dsg.mobile ? 'phone' : 'desktop');
          title = dsg.title;
          meta = `${role} · ${device}`;
          html = imageBoard(scr, w, h, meta, title, nav);
        } else {
          const device = deviceOf(scr.role);
          [w, h] = sizeOf(device);
          title = scr.title;
          meta = `${scr.role} · ${device}`;
          html = placeholderBoard(scr, w, h, meta, nav);
        }
        if (boards[file]) throw new Error(`duplicate ${file}`);
        writeFileSync(root + 'project/' + file, page(`${title} (${STATUS[scr.status].label})`, w, h + STRIP, html));
        boards[file] = { x, y, w, h: h + STRIP, title: `${STATUS[scr.status].label} · ${title}`, is_interactive: true };
        order.push(file);
        tally[scr.status]++;
        tally.first ??= file;
        x += w + (v === 'desktop' ? 40 : GAP_X);
        tallest = Math.max(tallest, h + STRIP);
      }
    }
    x += 160; // a wider gap between sections of the same journey
  }
  notes[`${j.id}_title`] = { x: 0, y: y - 560, text: `${num} · ${j.name} — ${j.who}`, kind: 'title1', maxW: Math.max(x - 240, 1600) };
  counts.push({ num, name: j.name, who: j.who, ...tally });
  y += tallest + 1000;
});

// Overview board
const KEYS = ['review', 'built', 'designed', 'old', 'gap'];
const total = Object.fromEntries(KEYS.map((k) => [k, counts.reduce((a, c) => a + c[k], 0)]));
const all = KEYS.reduce((a, k) => a + total[k], 0);
const legend = [
  ['review', 'New shadcn-style drawing, desktop and phone. Waiting for your review.'],
  ['built', 'In the app today.'],
  ['designed', 'Drawn and agreed; not built yet.'],
  ['old', 'Only in the old staff app. Release 2 retires it, so it needs a new design.'],
  ['gap', 'Needed, but nothing exists yet. We design these one by one.'],
];
const cell = (n, st) => `<span style="display: inline-block; min-width: 44px; text-align: center; padding: 4px 10px; border-radius: 999px; font-size: 15px; font-weight: 700; ${n ? `background: ${STATUS[st].tint}; color: ${STATUS[st].ink}` : 'color: #83867a'}">${n}</span>`;
const rowsHtml = counts.map((c) => `<a href="${c.first}" style="display: grid; grid-template-columns: 64px minmax(0, 1fr) 220px 100px 90px 100px 100px 120px; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #dcdbd3; text-decoration: none; color: #1c1e19">
<span style="font-size: 15px; font-weight: 700; color: #56594f">${c.num}</span>
<span style="font-size: 17px; font-weight: 600">${esc(c.name)}</span>
<span style="font-size: 15px; color: #56594f">${esc(c.who)}</span>
<span>${cell(c.review, 'review')}</span><span>${cell(c.built, 'built')}</span><span>${cell(c.designed, 'designed')}</span><span>${cell(c.old, 'old')}</span><span>${cell(c.gap, 'gap')}</span>
</a>`).join('\n');
const OW = 1600;
const OH = 360 + 60 + counts.length * 58 + 140;
const overview = `<div style="width: ${OW}px; height: ${OH}px; box-sizing: border-box; padding: 64px; display: flex; flex-direction: column; gap: 36px; background: #f3f2ee">
<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #3f4d33">WHEELHOUSE</div>
<h1 style="margin: 0; font-size: 48px; line-height: 1.1; font-weight: 700; letter-spacing: -1px">User journeys</h1>
<p style="margin: 0; font-size: 19px; line-height: 1.5; color: #3d4038; max-width: 980px">Every screen customers and staff use, grouped by journey, with where each one stands. ${all} screens in ${counts.length} journeys. Scroll down to see every journey laid out left to right in the order it happens. In Play, click a row to jump to its first screen.</p>
</div>
<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px">
${legend.map(([st, text]) => `<div style="padding: 18px 20px; border-radius: 12px; background: #fbfbf9; border: 1px solid #dcdbd3; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between"><span style="padding: 5px 12px; border-radius: 999px; background: ${STATUS[st].bar}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.4px">${STATUS[st].label.toUpperCase()}</span><span style="font-size: 30px; font-weight: 700; color: ${STATUS[st].ink}">${total[st]}</span></div>
<div style="font-size: 15px; line-height: 1.45; color: #3d4038">${text}</div>
</div>`).join('\n')}
</div>
<div style="background: #fbfbf9; border: 1px solid #dcdbd3; border-radius: 12px; overflow: hidden">
<div style="display: grid; grid-template-columns: 64px minmax(0, 1fr) 220px 100px 90px 100px 100px 120px; gap: 12px; padding: 14px 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: #56594f">
<span>#</span><span>JOURNEY</span><span>WHO</span><span>FOR REVIEW</span><span>BUILT</span><span>DESIGNED</span><span>OLD APP</span><span>NOT DESIGNED</span>
</div>
${rowsHtml}
</div>
</div>`;
writeFileSync(root + 'project/Main.dc.html', page('User journeys overview', OW, OH, overview));
boards['Main.dc.html'] = { x: 0, y: 0, w: OW, h: OH, title: 'Overview', is_interactive: true };
order.unshift('Main.dc.html');
writeFileSync(root + 'project/Workflow.dc.html', page('How the journeys connect', WF_W, WF_H, workflow(counts)));
boards['Workflow.dc.html'] = { x: OW + 240, y: 0, w: WF_W, h: WF_H, title: 'Workflow: how the journeys connect' };
order.splice(1, 0, 'Workflow.dc.html');

const canvas = {
  v: 3,
  createdOnFiles: JSON.parse(readFileSync(here + 'live-canvas.json', 'utf8')).createdOnFiles,
  title: 'Wheelhouse user journeys',
  launch: { view: 'canvas' },
  attachments: JSON.parse(readFileSync(here + 'live-canvas.json', 'utf8')).attachments ?? [],
  pages,
  boards,
  order,
  notes,
  designSystems: JSON.parse(readFileSync(here + 'live-canvas.json', 'utf8')).designSystems ?? [],
};
writeFileSync(root + 'project/canvas.json', JSON.stringify(canvas, null, 1));
console.log(JSON.stringify({ files: order.length, total, pages: pages.length, notes: Object.keys(notes).length }));
