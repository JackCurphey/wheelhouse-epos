import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const ids = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(new URL('../../release-1-journey/Wheelhouse-Release-1-Screen-Designs.html', import.meta.url).href);
const out = await p.evaluate((ids) => screens.filter((s) => ids.includes(s.id)).map((s) => {
  const d = document.createElement('div'); d.innerHTML = s.html || ''; 
  return { id: s.id, title: s.title, role: s.role, note: s.note, next: s.next, branches: s.branches, html: doc(s) };
}), ids);
for (const s of out) { const q = await b.newPage(); await q.setContent(s.html); s.text = (await q.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, '\n'); delete s.html; await q.close(); }
writeFileSync('ws-text.json', JSON.stringify(out, null, 1)); await b.close(); console.log(out.length);
