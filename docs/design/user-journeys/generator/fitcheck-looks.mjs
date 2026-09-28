// Fit check for the look-options design exploration (looks.mjs): renders
// every board with Playwright at its own size (1280x800 for all five here),
// waits for fonts to be ready, and confirms:
//  1. no unintentional overflow anywhere (scrollHeight/scrollWidth vs
//     clientHeight/clientWidth), including the job dialog itself — as
//     fitcheck-job-options.mjs does;
//  2. every interactive control (button, link, select) is at least 44x44 —
//     reports the smallest found across all boards.
import { chromium } from '/Users/jackcurphey/wheelhouse-epos/node_modules/playwright/index.mjs';
import { LOOKS, buildLook, buildIntro } from './looks.mjs';

const boards = [...LOOKS.map(buildLook), buildIntro()];
const b = await chromium.launch();
const bad = [];
let smallest = { w: Infinity, h: Infinity, board: null, tag: null };

for (const board of boards) {
  const page = await b.newPage({ viewport: { width: board.w, height: board.h } });
  await page.setContent(
    `<html><head><link rel="stylesheet" href="${board.fontLink}"></head><body style="margin:0">${board.html}</body></html>`,
    { waitUntil: 'networkidle' }
  );
  await page.evaluate(() => document.fonts.ready);

  const overflow = await page.evaluate(() => {
    const issues = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const dw = el.scrollWidth - el.clientWidth;
      const dh = el.scrollHeight - el.clientHeight;
      if (dw > 2 || dh > 2) {
        const label = el.tagName + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '') + (el.id ? `#${el.id}` : '');
        issues.push(`${label} over by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`);
      }
    }
    const dialog = document.querySelector('[role="dialog"]');
    let dialogOverflow = null;
    if (dialog) {
      const dh = dialog.scrollHeight - dialog.clientHeight;
      const dw = dialog.scrollWidth - dialog.clientWidth;
      if (dh > 2 || dw > 2) dialogOverflow = `dialog over by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`;
    }
    const root = document.body.firstElementChild;
    const rect = root ? root.getBoundingClientRect() : null;
    const rootOver = rect && (Math.round(rect.width) > document.documentElement.clientWidth + 1 || Math.round(rect.height) > document.documentElement.clientHeight + 1);
    return { issues: issues.slice(0, 8), dialogOverflow, rootOver };
  });
  if (overflow.issues.length) bad.push(`${board.id}: ${overflow.issues.join(' | ')}`);
  if (overflow.dialogOverflow) bad.push(`${board.id}: ${overflow.dialogOverflow}`);
  if (overflow.rootOver) bad.push(`${board.id}: root board exceeds its ${board.w}x${board.h} box`);

  const controls = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a[href], select');
    return Array.from(els).map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.tagName + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24));
      return { w: Math.round(r.width), h: Math.round(r.height), label };
    });
  });
  for (const ctl of controls) {
    if (ctl.w < 44 || ctl.h < 44) bad.push(`${board.id}: control "${ctl.label}" is ${ctl.w}x${ctl.h} (< 44px)`);
    if (Math.min(ctl.w, ctl.h) < Math.min(smallest.w, smallest.h)) smallest = { w: ctl.w, h: ctl.h, board: board.id, tag: ctl.label };
  }

  await page.close();
}
await b.close();

console.log(bad.length ? bad.join('\n') : `all ${boards.length} boards fit (no unintentional overflow, no clipped content)`);
console.log(`smallest control: ${smallest.w}x${smallest.h} — ${smallest.tag} on ${smallest.board}`);
