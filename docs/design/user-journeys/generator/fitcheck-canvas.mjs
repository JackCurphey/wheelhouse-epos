// Checks every board on the one canvas that build.mjs wrote (out/project/):
//   1. each board's page fits the size the canvas gives it (no scrollbars,
//      nothing pushed past its edge), and
//   2. every link between boards opens a board that is on the canvas, and
//   3. no note says "undefined" or sits on top of another note, and
//   4. the canvas is inside the Design type's limits: 200 notes, 512 files, and
//   7. every screen board names its building block (issue #116 step 6:
//      "each with its building block"),
//   6. no note is longer than the 5,000 characters the canvas editor keeps
//      (it cuts the rest off when it saves, seen 3 Oct), and
//   5. every Lightspeed situation line says it waits (Lightspeed shops, later
//      change of 3 Oct: "after the trading week (build-plan question 5)").
// Run after `node build.mjs`, from any machine:  node fitcheck-canvas.mjs
// Exits 1 and lists the boards that fail. Font downloads can stall: each page
// waits at most 6 s for fonts.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const dir = new URL('./out/project/', import.meta.url);
const canvas = JSON.parse(readFileSync(new URL('canvas.json', dir), 'utf8'));
const files = new Set(Object.keys(canvas.boards));
const bad = [];
const noteCount = Object.keys(canvas.notes ?? {}).length;
if (noteCount > 200) bad.push(`${noteCount} notes; a canvas holds at most 200`);
if (canvas.order.length + 1 > 512) bad.push(`${canvas.order.length} boards plus the index; a canvas holds at most 512 files`);
for (const [k, n] of Object.entries(canvas.notes ?? {})) if (n.text.length > 5000) bad.push(`note ${k} is ${n.text.length} characters; the canvas keeps 5,000`);
const LATER_TAG = 'after the trading week (build-plan question 5)';
for (const [k, n] of Object.entries(canvas.notes ?? {})) for (const line of n.text.split('\n')) if (line.startsWith('• ') && /Lightspeed/.test(line) && !line.endsWith(LATER_TAG)) bad.push(`note ${k}: a Lightspeed line without "${LATER_TAG}": ${line.slice(0, 80)}`);
const spots = new Map();
for (const [k, n] of Object.entries(canvas.notes ?? {})) {
  if (/\bundefined\b/.test(n.text)) bad.push(`note ${k} says "undefined"`);
  const at = `${n.x},${n.y}`;
  if (spots.has(at)) bad.push(`note ${k} sits on top of note ${spots.get(at)}`);
  spots.set(at, k);
}
const b = await chromium.launch();
for (const f of canvas.order) {
  const { w, h } = canvas.boards[f];
  const src = readFileSync(new URL(f, dir), 'utf8');
  for (const [, href] of src.matchAll(/ href="([^"#:]+\.dc\.html)"/g)) if (!files.has(href)) bad.push(`${f}: links to ${href}, which is not on the canvas`);
  if (!['Main.dc.html', 'Workflow.dc.html'].includes(f) && !/Block \d+: /.test(src)) bad.push(`${f}: doesn't name its building block`);
  const helmet = /<helmet>\n([\s\S]*?)<\/helmet>\n/.exec(src)?.[1] ?? '';
  const body = /<\/helmet>\n([\s\S]*)\n<\/x-dc>/.exec(src)?.[1] ?? '';
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`${helmet}${body}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await Promise.race([p.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 6000))]);
  const size = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  if (size.w > w + 1 || size.h > h + 1) {
    // Name what sticks out furthest, so a failure on another machine says why.
    const out = await p.evaluate(([bw, bh, wide]) => {
      // Content inside a scrolling or clipped box can't stretch the page.
      const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') return true; return false; };
      let worst = null, by = 0;
      for (const el of document.body.querySelectorAll('*')) {
        if (clipped(el)) continue;
        const r = el.getBoundingClientRect();
        const over = wide ? r.right - bw : r.bottom - bh;
        if (over > by) { by = over; worst = el; }
      }
      if (!worst) return '';
      const r = worst.getBoundingClientRect();
      return ` · furthest out: <${worst.tagName.toLowerCase()}> right ${Math.round(r.right)}, bottom ${Math.round(r.bottom)}, font ${getComputedStyle(worst).fontFamily.split(',')[0]}, "${(worst.textContent || '').trim().slice(0, 60)}"`;
    }, [w, h, size.w > w + 1]);
    bad.push(`${f}: page is ${size.w}×${size.h}, its board is ${w}×${h}${out}`);
  }
  await p.close();
}
await b.close();
console.log(`${canvas.order.length} boards checked, ${bad.length} problems`);
for (const line of bad) console.log('  ' + line);
process.exit(bad.length ? 1 : 0);
