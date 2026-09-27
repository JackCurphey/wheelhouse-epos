// Re-renders every Release 1 screen design with the Fjell tokens swapped in.
import { chromium } from '/Users/jackcurphey/wheelhouse-epos/node_modules/playwright/index.mjs';
const atlas = 'file:///Users/jackcurphey/wheelhouse-epos/docs/design/release-1-journey/Wheelhouse-Release-1-Screen-Designs.html';
const out = new URL('./shots-fjell/', import.meta.url).pathname;
// old colour -> Fjell token
const MAP = {
  '#164f42': '#3f4d33', '#2f5d4b': '#2a3024', '#324b41': '#2a3024', '#b8460f': '#3f4d33',
  '#1c231f': '#1c1e19', '#5f6a64': '#56594f', '#f4f5f3': '#f3f2ee', '#a5301f': '#a8321f',
  '#e8efe9': '#e8e7e1', '#dfe4de': '#dcdbd3', '#e0e5df': '#dcdbd3', '#e1e6e1': '#dcdbd3', '#e8ece7': '#e2e1da', '#dce5dd': '#dcdbd3',
  '#bac6bd': '#8e9185', '#ccd4cf': '#8e9185', '#d6ded5': '#dcdbd3', '#9eafa1': '#8e9185', '#c7dccd': '#c9cdb8',
  '#f5f7f4': '#eceae4', '#f3f6f1': '#eceae4', '#f2f5f0': '#eceae4', '#f0f3ee': '#eceae4', '#f3f7f1': '#eceae4', '#edf2e9': '#e8e7e1',
  '#e5eae2': '#e8e7e1', '#e3e9e1': '#e2e1da', '#eef0ed': '#eceae4', '#edf0ed': '#e8e7e1', '#eaf4ed': '#eef0e3', '#f4f7f1': '#eceae4', '#d7e5d6': '#e8e7e1',
  '#fff': '#fbfbf9',
};
const re = new RegExp(Object.keys(MAP).map((k) => k + '(?![0-9a-fA-F])').join('|'), 'gi');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap"><style>html,body{font-family:"Work Sans",ui-sans-serif,system-ui,sans-serif!important}.receiptlike{font-family:"DM Mono",ui-monospace,monospace!important}</style>';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(atlas);
const screens = await page.evaluate(() => screens.map((s) => ({ id: s.id, mobile: !!s.mobile, html: doc(s) })));
let unmapped = new Set();
for (const s of screens) {
  let html = s.html.replace(re, (m) => MAP[m.toLowerCase()]);
  html = html.replace(/-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif/g, '"Work Sans",ui-sans-serif,system-ui,sans-serif');
  html = html.includes('</head>') ? html.replace('</head>', FONT + '</head>') : FONT + html;
  for (const m of html.match(/#[0-9a-fA-F]{6}\b/g) || []) unmapped.add(m.toLowerCase());
  const [w, h] = s.mobile ? [390, 844] : [1100, 760];
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}${s.id}.png`, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}
await browser.close();
console.log('rendered', screens.length, 'colours left:', [...unmapped].sort().join(' '));
