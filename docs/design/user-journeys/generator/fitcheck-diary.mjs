// Fit check for the workshop diary redesign: renders every board (diary.mjs
// screens at all three sizes) with Playwright and reports any element
// overflowing its own box, or the shell's sidebar/nav overflowing.
import { chromium } from '/Users/jackcurphey/wheelhouse-epos/node_modules/playwright/index.mjs';
import { screens } from './diary.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { TW, TH } from './diary.mjs';
import { FONT_LINK, FONT, THEME } from './ui.mjs';

const DESKTOP_ONLY = process.argv.includes('--desktop');
console.log(JSON.stringify({ theme: THEME }));
const SIZES = DESKTOP_ONLY ? { desktop: [DW, DH] } : { desktop: [DW, DH], tablet: [TW, TH], phone: [PW, PH] };
const b = await chromium.launch();
const bad = [];

for (const [id, v] of Object.entries(screens)) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    if (!v[size]) continue;
    const page = await b.newPage({ viewport: { width: w, height: h } });
    await page.setContent(
      `<html><head><link rel="stylesheet" href="${FONT_LINK}"><style>body{margin:0;font-family:${FONT}}</style></head><body>${v[size]}</body></html>`,
      { waitUntil: 'networkidle' }
    );
    const result = await page.evaluate(() => {
      const issues = [];
      // Any element whose content overflows its own box (scrollable overflow larger than client box),
      // where that element does not itself declare overflow:auto/scroll (i.e. an unintentional overflow).
      const all = document.querySelectorAll('body *');
      const clips = (v) => v === 'hidden' || v === 'auto' || v === 'scroll';
      for (const el of all) {
        const cs = getComputedStyle(el);
        // Two-value overflow shorthand (e.g. "hidden auto" for a column that
        // scrolls vertically only) reports as that combined string, not as a
        // single keyword — check overflow-x/-y individually so an
        // intentionally-scrollable column isn't flagged as unintentional.
        if (clips(cs.overflowX) && clips(cs.overflowY)) continue; // intentional clipping/scrolling
        const dw = el.scrollWidth - el.clientWidth;
        const dh = el.scrollHeight - el.clientHeight;
        if (dw > 2 || dh > 2) {
          const label = el.tagName + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '') + (el.id ? `#${el.id}` : '');
          issues.push(`${label} over by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`);
        }
      }
      // Root-level check: does the whole board fit its declared width/height?
      const root = document.body.firstElementChild;
      const rect = root ? root.getBoundingClientRect() : null;
      const rootOver = rect && (Math.round(rect.width) > document.documentElement.clientWidth + 1 || Math.round(rect.height) > document.documentElement.clientHeight + 1);
      return { issues: issues.slice(0, 6), rootOver };
    });
    if (result.issues.length) bad.push(`${id}/${size}: ${result.issues.join(' | ')}`);
    if (result.rootOver) bad.push(`${id}/${size}: root board exceeds its ${w}x${h} box`);
    await page.close();
  }
}
await b.close();
const totalBoards = Object.keys(screens).length * Object.keys(SIZES).length;
console.log(bad.length ? bad.join('\n') : `all ${totalBoards} boards fit (no unintentional overflow)`);
