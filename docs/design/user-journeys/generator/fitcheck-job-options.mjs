// Fit check for the job-page design exploration (job-options.mjs): renders
// every board with Playwright at 1280x800 and confirms every element's
// scrollHeight <= clientHeight inside the dialog (no scrolling anywhere) and
// nothing is clipped.
import { chromium } from '/Users/jackcurphey/wheelhouse-epos/node_modules/playwright/index.mjs';
import { boards } from './job-options.mjs';
import { DW, DH } from './stage1.mjs';
import { FONT_LINK } from './ui.mjs';

const b = await chromium.launch();
const bad = [];

for (const board of boards) {
  const page = await b.newPage({ viewport: { width: DW, height: DH } });
  await page.setContent(
    `<html><head><link rel="stylesheet" href="${FONT_LINK}"><style>body{margin:0;font-family:'Work Sans'}</style></head><body>${board.html}</body></html>`,
    { waitUntil: 'networkidle' }
  );
  const result = await page.evaluate(() => {
    const issues = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      // Deliberately does NOT skip elements with overflow:hidden/auto/scroll —
      // those are exactly the containers that can silently clip content with
      // no visible scrollbar, which is the case this check exists to catch.
      const dw = el.scrollWidth - el.clientWidth;
      const dh = el.scrollHeight - el.clientHeight;
      if (dw > 2 || dh > 2) {
        const label = el.tagName + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '') + (el.id ? `#${el.id}` : '');
        issues.push(`${label} over by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`);
      }
    }
    // The dialog itself: does its content (scrollHeight) exceed the box
    // (clientHeight) even though the box declares overflow:hidden? That is
    // exactly the "content overflows but is silently clipped" case the brief
    // asks to catch.
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
  if (result.issues.length) bad.push(`${board.id}: ${result.issues.join(' | ')}`);
  if (result.dialogOverflow) bad.push(`${board.id}: ${result.dialogOverflow}`);
  if (result.rootOver) bad.push(`${board.id}: root board exceeds its ${DW}x${DH} box`);
  await page.close();
}
await b.close();
console.log(bad.length ? bad.join('\n') : `all ${boards.length} boards fit (no unintentional overflow, no clipped content)`);
