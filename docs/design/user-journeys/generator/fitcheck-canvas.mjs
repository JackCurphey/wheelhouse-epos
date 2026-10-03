// Checks every board on the one canvas that build.mjs wrote (out/project/):
//   1. each board's page fits the size the canvas gives it (no scrollbars,
//      nothing pushed past its edge), and
//   2. every link between boards opens a board that is on the canvas, and
//   3. no note says "undefined" or sits on top of another note, and
//   4. the canvas is inside the Design type's limits: 200 notes, 512 files.
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
  const helmet = /<helmet>\n([\s\S]*?)<\/helmet>\n/.exec(src)?.[1] ?? '';
  const body = /<\/helmet>\n([\s\S]*)\n<\/x-dc>/.exec(src)?.[1] ?? '';
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`${helmet}${body}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await Promise.race([p.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 6000))]);
  const size = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  if (size.w > w + 1 || size.h > h + 1) bad.push(`${f}: page is ${size.w}×${size.h}, its board is ${w}×${h}`);
  await p.close();
}
await b.close();
console.log(`${canvas.order.length} boards checked, ${bad.length} problems`);
for (const line of bad) console.log('  ' + line);
process.exit(bad.length ? 1 : 0);
