import { chromium } from '@playwright/test';
import * as s1 from './stage1.mjs'; import * as s2 from './stage2.mjs'; import { FONT_LINK } from './ui.mjs';
const all = { ...s1.screens, ...s2.screens };
const b = await chromium.launch(); let bad = [];
for (const [id, v] of Object.entries(all)) for (const k of ['desktop', 'phone']) {
  if (!v[k]) continue; const [w, h] = k === 'desktop' ? [1280, 800] : [390, 844];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<html><head><link rel="stylesheet" href="${FONT_LINK}"></head><body style="margin:0;font-family:'Work Sans'">${v[k]}</body></html>`, { waitUntil: 'networkidle' });
  const over = await p.evaluate(() => [...document.querySelectorAll('nav')].map((n) => n.scrollHeight - n.clientHeight).filter((d) => d > 1));
  if (over.length) bad.push(`${id}/${k}: nav over by ${over.join(',')}px`);
  if (id === 'desk' && k === 'desktop') await p.screenshot({ path: 'checks/desk-final.png' });
  await p.close();
}
await b.close(); console.log(bad.length ? bad.join('\n') : 'all sidebars fit');
