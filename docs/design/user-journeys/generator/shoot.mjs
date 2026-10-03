// Renders every current atlas screen to a PNG at its frame size, using a real browser.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const atlas = new URL('../../release-1-journey/Wheelhouse-Release-1-Screen-Designs.html', import.meta.url).href;
const out = new URL('./shots/', import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(atlas);
const screens = await page.evaluate(() => screens.map(s => ({ id: s.id, title: s.title, role: s.role, group: s.group, mobile: !!s.mobile, html: doc(s) })));
await writeFile(new URL('screens.json', out), JSON.stringify(screens.map(({ html, ...s }) => s), null, 1));
for (const s of screens) {
  const [w, h] = s.mobile ? [390, 844] : [1100, 760];
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.setContent(s.html, { waitUntil: 'load', baseURL: atlas });
  await p.screenshot({ path: new URL(`${s.id}.png`, out).pathname, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}
await browser.close();
console.log('rendered', screens.length);
