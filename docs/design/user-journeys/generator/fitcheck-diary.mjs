// Fit check for the workshop diary redesign: renders every board (diary.mjs
// screens at all three sizes) with Playwright and reports any element
// overflowing its own box, or the shell's sidebar/nav overflowing.
//
//   node fitcheck-diary.mjs [--desktop] [--theme sand]
//   node fitcheck-diary.mjs --strict [--theme sand]   (tablet + phone)
//
// --strict (decision 68): also looks INSIDE every overflow:hidden/auto
// element and reports any that actually cut content off — the plain check
// skips those as "intentional". Clipping that is by design is not reported:
// ellipsis truncation, the 1px visually-hidden technique, and the one kind
// of scrolling a phone page is allowed — an element marked data-scroll,
// which may only appear on the phone boards listed in PHONE_SCROLL below.
// Tablet boards (and every tablet pop-up) must not scroll at all.
import { chromium } from '@playwright/test';
import { screens } from './diary.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { TW, TH } from './diary.mjs';
import { FONT_LINK, FONT, THEME } from './ui.mjs';

const DESKTOP_ONLY = process.argv.includes('--desktop');
const STRICT = process.argv.includes('--strict');
console.log(JSON.stringify({ theme: THEME, strict: STRICT }));
const SIZES = STRICT ? { tablet: [TW, TH], phone: [PW, PH] } : DESKTOP_ONLY ? { desktop: [DW, DH] } : { desktop: [DW, DH], tablet: [TW, TH], phone: [PW, PH] };
// Phone boards that may scroll: the diary views, the job page (every stage),
// the customer page and New job.
const PHONE_SCROLL = new Set(['diary', 'diary-mechanic', 'waiting-open', 'diary-day', 'change-selected', 'diary-context-menu', 'diary-stack-hover', 'diary-stack-open', 'diary-hover-summary', 'new-job-pick',
  'job-overview', 'job-book-in', 'job-quote', 'job-mechanic', 'job-waiting-parts', 'job-finished', 'job-collection', 'customer', 'new-job', 'new-job-day']);
const b = await chromium.launch();
const bad = [];
let scrolling = 0;

for (const [id, v] of Object.entries(screens)) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    if (!v[size]) continue;
    const page = await b.newPage({ viewport: { width: w, height: h } });
    await page.setContent(
      `<html><head><link rel="stylesheet" href="${FONT_LINK}"><style>body{margin:0;font-family:${FONT}}</style></head><body>${v[size]}</body></html>`,
      { waitUntil: 'networkidle' }
    );
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate((strict) => {
      const issues = [];
      let scrollEls = 0;
      const all = document.querySelectorAll('body *');
      const clips = (v) => v === 'hidden' || v === 'auto' || v === 'scroll';
      const label = (el) => el.tagName + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '') + (el.id ? `#${el.id}` : '');
      for (const el of all) {
        const cs = getComputedStyle(el);
        const dw = el.scrollWidth - el.clientWidth;
        const dh = el.scrollHeight - el.clientHeight;
        if (el.hasAttribute('data-scroll')) scrollEls++;
        // Two-value overflow shorthand (e.g. "hidden auto" for a column that
        // scrolls vertically only) reports as that combined string, not as a
        // single keyword — check overflow-x/-y individually so an
        // intentionally-scrollable column isn't flagged as unintentional.
        if (clips(cs.overflowX) && clips(cs.overflowY)) {
          if (!strict) continue; // intentional clipping/scrolling
          if (cs.textOverflow === 'ellipsis') continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 1 && r.height <= 1) continue;
          if (el.hasAttribute('data-scroll')) { if (dw > 2) issues.push(`${label(el)} (scrolling page) clips sideways by w${dw}`); continue; } // allowed to scroll down only — checked by board below
          if (dw > 2 || dh > 2) issues.push(`${label(el)} clips by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`);
          continue;
        }
        if (dw > 2 || dh > 2) issues.push(`${label(el)} over by ${dw > 2 ? 'w' + dw : ''}${dh > 2 ? 'h' + dh : ''}`);
      }
      const root = document.body.firstElementChild;
      const rect = root ? root.getBoundingClientRect() : null;
      const rootOver = rect && (Math.round(rect.width) > document.documentElement.clientWidth + 1 || Math.round(rect.height) > document.documentElement.clientHeight + 1);
      return { issues: issues.slice(0, 6), rootOver, scrollEls };
    }, STRICT);
    if (result.issues.length) bad.push(`${id}/${size}: ${result.issues.join(' | ')}`);
    if (result.rootOver) bad.push(`${id}/${size}: root board exceeds its ${w}x${h} box`);
    if (STRICT && result.scrollEls) {
      scrolling++;
      if (size !== 'phone' || !PHONE_SCROLL.has(id)) bad.push(`${id}/${size}: has a scrolling area but isn't allowed to scroll`);
    }
    await page.close();
  }
}
await b.close();
const totalBoards = Object.values(screens).reduce((n, v) => n + Object.keys(SIZES).filter((s) => v[s]).length, 0);
console.log(bad.length ? bad.join('\n') : `all ${totalBoards} boards fit (no ${STRICT ? 'clipped content' : 'unintentional overflow'})`);
if (STRICT) console.log(`${scrolling} phone boards use their allowed scrolling area`);
