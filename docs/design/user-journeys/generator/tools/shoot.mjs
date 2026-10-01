// Renders every board of a Soft sand journey module to PNGs and reports
// overflow — the quick check used while designing (the canvas itself is the
// real thing; this strips <helmet>, so verify fonts from the "font" field).
//   WH_THEME=sand node tools/shoot.mjs <module.mjs> <out-dir>
// "over" = elements past the board's edge; "clipped" = elements whose
// content is cut off. Phone pages with a data-scroll area scroll on purpose.
// Font downloads can stall: each page waits at most 6 s for fonts.
import { chromium } from '/Users/jackcurphey/wheelhouse-epos/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [mod, out] = process.argv.slice(2);
if (!mod || !out || process.env.WH_THEME !== 'sand') throw new Error('usage: WH_THEME=sand node tools/shoot.mjs <module.mjs> <out-dir>');
const { screens } = await import(resolve(mod));
const { FONT_LINK, FONT, C } = await import('../ui.mjs');
mkdirSync(out, { recursive: true });
const sizes = { single: [1760, 1180], desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
const b = await chromium.launch();
for (const [id, s] of Object.entries(screens)) for (const [size, html] of Object.entries(s)) {
  const [w, h] = sizes[size];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<link rel="stylesheet" href="${FONT_LINK}"><style>body,button,input,select,textarea{font-family:${FONT}}body{margin:0;color:${C.ink};background:${C.bg}}</style>${html}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await Promise.race([p.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 6000))]);
  const info = await p.evaluate(([W, H]) => {
    const font = getComputedStyle(document.querySelector('h2, span, p, button')).fontFamily.split(',')[0];
    const over = [...document.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 0.5 || r.bottom > H + 0.5; }).length;
    const clipped = [...document.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).filter((e) => !['INPUT', 'HTML', 'BODY'].includes(e.tagName)).map((e) => e.tagName + ':' + (e.textContent || '').trim().slice(0, 30));
    return { font, over, clipped: clipped.slice(0, 5) };
  }, [w, h]);
  console.log(id, size, JSON.stringify(info));
  await p.screenshot({ path: `${out}/${id}-${size}.png` });
  await p.close();
}
await b.close();
