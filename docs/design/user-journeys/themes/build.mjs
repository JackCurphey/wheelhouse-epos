import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { THEMES, STATUS, checks } from './themes.mjs';

const here = new URL('./', import.meta.url).pathname;
const root = here + 'out/';
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

const W = 1440, H = 1560;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const I = {
  today: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>',
  till: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/>',
  workshop: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  stock: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  customers: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  basket: '<path d="M5 8h14l-1.5 11h-11z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0">${I[n]}</svg>`;

function sheet(t) {
  const c = t.c, r = t.radius, rl = Math.max(r, t.radius ? r + 4 : 0);
  const F = { d: `'${t.fonts.display}', ui-sans-serif, system-ui, sans-serif`, b: `'${t.fonts.body}', ui-sans-serif, system-ui, sans-serif`, m: `'${t.fonts.mono}', ui-monospace, monospace` };
  const hd = (size, text, tag = 'h2', extra = '') => `<${tag} style="margin: 0; font-family: ${F.d}; font-size: ${size}px; line-height: 1.15; font-weight: ${t.heading.weight}; text-transform: ${t.heading.transform}; letter-spacing: ${t.heading.tracking}; color: ${c.foreground}; ${extra}">${esc(text)}</${tag}>`;
  const label = (text) => `<div style="font-family: ${F.b}; font-size: 12px; font-weight: 700; letter-spacing: 0.9px; text-transform: uppercase; color: ${c.mutedForeground}">${esc(text)}</div>`;
  const btn = (text, kind) => {
    const s = {
      primary: `background: ${c.primary}; color: ${c.primaryForeground}; border: 1px solid ${c.primary}`,
      secondary: `background: ${c.secondary}; color: ${c.secondaryForeground}; border: 1px solid ${c.secondary === c.background || c.secondary === '#ffffff' ? c.input : c.secondary}`,
      outline: `background: ${c.card}; color: ${c.foreground}; border: 1px solid ${c.input}`,
      ghost: `background: transparent; color: ${c.foreground}; border: 1px solid transparent`,
      destructive: `background: ${c.destructive}; color: #ffffff; border: 1px solid ${c.destructive}`,
    }[kind];
    return `<button type="button" style="${s}; min-height: 44px; padding: 0 18px; border-radius: ${r}px; font-family: ${F.b}; font-size: 15px; font-weight: 600; ${t.heading.transform === 'uppercase' ? 'text-transform: uppercase; letter-spacing: 0.4px;' : ''}">${esc(text)}</button>`;
  };
  const badge = (text, [bg, ink]) => `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: ${r ? 999 : 0}px; background: ${bg}; color: ${ink}; font-family: ${F.b}; font-size: 12px; font-weight: 600">${esc(text)}</span>`;
  const sw = (name, hex, fg) => `<div style="display: flex; flex-direction: column; gap: 8px"><div style="height: 72px; border-radius: ${r}px; background: ${hex}; border: 1px solid ${c.border}; display: flex; align-items: flex-end; padding: 8px; box-sizing: border-box; color: ${fg || c.foreground}; font-family: ${F.m}; font-size: 12px">Aa</div><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: ${F.b}; font-size: 13px; font-weight: 600; color: ${c.foreground}">${esc(name)}</span><span style="font-family: ${F.m}; font-size: 12px; color: ${c.mutedForeground}">${hex}</span></div></div>`;
  const card = (inner, extra = '') => `<div style="box-sizing: border-box; background: ${c.card}; border: 1px solid ${c.border}; border-radius: ${rl}px; ${t.id === 'fjell' ? 'box-shadow: 0 1px 2px rgba(28,30,25,0.06), 0 6px 18px rgba(28,30,25,0.06);' : ''} ${extra}">${inner}</div>`;

  const nav = [['today', 'Today'], ['till', 'Till'], ['workshop', 'Workshop'], ['stock', 'Stock'], ['customers', 'Customers'], ['reports', 'Reports'], ['settings', 'Settings']];
  const side = `<nav aria-label="Main" style="width: 200px; flex-shrink: 0; box-sizing: border-box; padding: 16px 10px; display: flex; flex-direction: column; gap: 4px; background: ${c.sidebar}; color: ${c.sidebarForeground}">
<div style="font-family: ${F.d}; font-size: 18px; font-weight: ${t.heading.weight}; text-transform: ${t.heading.transform}; letter-spacing: ${t.heading.tracking}; padding: 4px 10px 14px">Wheelhouse</div>
${nav.map(([k, l], i) => `<a href="#" style="display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px; border-radius: ${r}px; color: ${c.sidebarForeground}; text-decoration: none; font-family: ${F.b}; font-size: 14px; font-weight: ${i === 2 ? 700 : 500}; background: ${i === 2 ? c.sidebarActive : 'transparent'}; ${i === 2 && (t.id === 'sprint' || t.id === 'chapter') ? `box-shadow: inset 3px 0 0 ${c.accent};` : ''}">${icon(k, 17)}${l}</a>`).join('')}
</nav>`;
  const row = (job, who, bike, status, tone) => `<div style="display: grid; grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1fr) 130px; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid ${c.border}; font-family: ${F.b}; font-size: 14px; color: ${c.foreground}"><span style="font-family: ${F.m}; font-weight: 600">${job}</span><span>${who}</span><span style="color: ${c.mutedForeground}">${bike}</span><span>${badge(status, STATUS[tone])}</span></div>`;
  const app = `<div style="width: 900px; height: 470px; display: flex; overflow: hidden; border-radius: ${rl}px; border: 1px solid ${c.border}; background: ${c.background}">
${side}
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 58px; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 12px; background: ${c.card}; border-bottom: 1px solid ${c.border}">${hd(20, 'Workshop', 'h3', 'flex-grow: 1')}<div style="display: flex; align-items: center; gap: 8px; width: 220px; min-height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid ${c.input}; border-radius: ${r}px; color: ${c.mutedForeground}; font-family: ${F.b}; font-size: 13px">${icon('search', 15)}Search</div>${btn('New job', 'primary')}</header>
<div style="padding: 20px; display: flex; flex-direction: column; gap: 16px">
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
${[['Expected today', '8'], ['In the workshop', '12'], ['Ready to collect', '4']].map(([l, n]) => card(`<div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 6px">${label(l)}<span style="font-family: ${F.d}; font-size: 30px; font-weight: ${t.heading.weight}; color: ${c.foreground}">${n}</span></div>`)).join('')}
</div>
${card(`<div style="padding: 10px 16px; font-family: ${F.b}; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${c.mutedForeground}; display: grid; grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1fr) 130px; gap: 12px"><span>Job</span><span>Customer</span><span>Bike</span><span>Status</span></div>${row('WH-1042', 'Maya Patel', 'Trek Domane AL 3', 'Waiting for parts', 'waiting')}${row('WH-1045', 'Jamie Brooks', 'Giant Escape 2', 'Booked in', 'scheduled')}${row('WH-1047', 'Aisha Khan', 'Cannondale Quick', 'Ready', 'complete')}`, 'overflow: hidden')}
</div>
</div>
</div>`;
  const phone = `<div style="width: 340px; height: 470px; display: flex; flex-direction: column; overflow: hidden; border-radius: ${rl + 8}px; border: 1px solid ${c.border}; background: ${c.background}">
<header style="height: 52px; flex-shrink: 0; box-sizing: border-box; padding: 0 8px 0 16px; display: flex; align-items: center; gap: 6px; background: ${c.card}; border-bottom: 1px solid ${c.border}"><span style="flex-grow: 1; font-family: ${F.d}; font-size: 16px; font-weight: ${t.heading.weight}; text-transform: ${t.heading.transform}; letter-spacing: ${t.heading.tracking}; color: ${c.foreground}">North Street Cycles</span><span style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; color: ${c.foreground}">${icon('basket', 19)}</span><span style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; color: ${c.foreground}">${icon('menu', 20)}</span></header>
<div style="padding: 22px 18px; display: flex; flex-direction: column; gap: 14px">
${label('Workshop')}
${hd(28, 'Book a repair', 'h3')}
<p style="margin: 0; font-family: ${F.b}; font-size: 15px; line-height: 1.5; color: ${c.mutedForeground}">Pick a service and a day. We’ll confirm by text.</p>
<a href="#" style="display: flex; align-items: center; justify-content: center; min-height: 48px; border-radius: ${r}px; background: ${c.primary}; color: ${c.primaryForeground}; font-family: ${F.b}; font-size: 16px; font-weight: 600; text-decoration: none; ${t.heading.transform === 'uppercase' ? 'text-transform: uppercase; letter-spacing: 0.4px;' : ''}">Choose a service</a>
${card(`<div style="padding: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-family: ${F.b}; font-size: 15px; font-weight: 600; color: ${c.foreground}">Standard service</span><span style="font-family: ${F.b}; font-size: 13px; color: ${c.mutedForeground}">About 60 minutes</span></span><span style="font-family: ${F.m}; font-size: 15px; font-weight: 600; color: ${c.foreground}">£65.00</span></div>`)}
${card(`<div style="padding: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-family: ${F.b}; font-size: 15px; font-weight: 600; color: ${c.foreground}">Brake service</span><span style="font-family: ${F.b}; font-size: 13px; color: ${c.mutedForeground}">About 45 minutes</span></span><span style="font-family: ${F.m}; font-size: 15px; font-weight: 600; color: ${c.foreground}">from £35.00</span></div>`)}
</div>
</div>`;
  const cks = checks(t);
  const minCk = cks.reduce((a, x) => (x.r / x.min < a.r / a.min ? x : a));

  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 36px; background: ${c.background}; color: ${c.foreground}; font-family: ${F.b}">
<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 10px; max-width: 860px">
${label(`Option · inspired by ${t.inspired}`)}
${hd(64, t.name, 'h1')}
<p style="margin: 0; font-size: 19px; line-height: 1.5; color: ${c.mutedForeground}">${esc(t.mood)}. ${esc(t.note)}</p>
</div>
<div style="display: flex; flex-direction: column; gap: 6px; text-align: right; font-size: 14px; color: ${c.mutedForeground}">
<span><strong style="color: ${c.foreground}">Headings</strong> ${esc(t.fonts.display)}</span>
<span><strong style="color: ${c.foreground}">Text</strong> ${esc(t.fonts.body)}</span>
<span><strong style="color: ${c.foreground}">Numbers</strong> ${esc(t.fonts.mono)}</span>
<span><strong style="color: ${c.foreground}">Corners</strong> ${r}px</span>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 14px">
${sw('Background', c.background)}${sw('Card', c.card)}${sw('Text', c.foreground, c.background)}${sw('Muted text', c.mutedForeground, c.background)}${sw('Border', c.border)}${sw('Primary', c.primary, c.primaryForeground)}${sw('Accent', c.accent, c.accentForeground)}${sw('Sidebar', c.sidebar, c.sidebarForeground)}
</div>
<div style="display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 40px">
<div style="display: flex; flex-direction: column; gap: 14px">
${label('Type')}
${hd(40, 'Ready to collect')}
${hd(26, 'Standard service and rear brakes', 'h3')}
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: ${c.foreground}; max-width: 620px">The rear pads are worn. We recommend replacing the pads and adjusting the brake. The gear cable can wait.</p>
<div style="display: flex; gap: 28px; font-family: ${F.m}; font-size: 17px; font-weight: 600; color: ${c.foreground}"><span>£1,249.00</span><span>B1-1042</span><span>WH-1042</span></div>
</div>
<div style="display: flex; flex-direction: column; gap: 16px">
${label('Components')}
<div style="display: flex; flex-wrap: wrap; gap: 10px">${btn('Take payment', 'primary')}${btn('Save draft', 'outline')}${btn('Cancel', 'ghost')}${btn('Void sale', 'destructive')}</div>
<div style="display: flex; flex-direction: column; gap: 6px; max-width: 420px"><label for="${t.id}-email" style="font-size: 14px; font-weight: 600">Work email</label><input id="${t.id}-email" type="email" value="alex@northstreetcycles.example" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: ${r}px; border: 1px solid ${c.input}; background: ${c.card}; color: ${c.foreground}; font-family: ${F.b}; font-size: 15px"></div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${badge('Awaiting confirmation', STATUS.pending)}${badge('Booked in', STATUS.scheduled)}${badge('Waiting for parts', STATUS.waiting)}${badge('On hold', STATUS.hold)}${badge('Ready', STATUS.complete)}</div>
</div>
</div>
<div style="display: flex; gap: 28px; align-items: flex-start">${app}${phone}</div>
<div style="font-size: 13px; color: ${c.mutedForeground}">Contrast: every text and control pair meets WCAG AA. Tightest pair: ${esc(minCk.label.toLowerCase())}, ${minCk.r.toFixed(1)}:1 (needs ${minCk.min}:1). Status colours are shared across all options.</div>
</div>`;
}

function page(t) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${t.name} theme option</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${t.css}&amp;display=swap">
<style>
body{margin:0}
a{color:${t.c.primary}}a:hover{color:${t.c.foreground}}
</style>
</helmet>
${sheet(t)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${H}}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

const boards = {}, order = [];
THEMES.forEach((t, i) => {
  const file = i === 0 ? 'Main.dc.html' : `${t.id}.dc.html`;
  writeFileSync(root + 'project/' + file, page(t));
  const col = i % 3, rowN = Math.floor(i / 3);
  boards[file] = { x: col * (W + 120), y: rowN * (H + 360), w: W, h: H, title: `${i + 1} · ${t.name} (inspired by ${t.inspired})` };
  order.push(file);
});
const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
  title: 'Wheelhouse theme options',
  launch: { view: 'canvas' },
  pages: [],
  boards, order,
  notes: {
    t1: { x: 0, y: -360, text: 'Five theme options for Wheelhouse', kind: 'title1', maxW: 3 * W + 240 },
    t2: { x: 2 * (W + 120), y: H + 360, text: 'Pick one (or ask for a mix — e.g. Studio’s type with Fjell’s colours). The chosen tokens become the Tailwind theme for every component, and the journeys canvas is restyled with it.', w: W, size: 'l', fill: 'yellow' },
  },
  designSystems: [],
};
canvas.notes.t2.fill = 'orange';
writeFileSync(root + 'project/canvas.json', JSON.stringify(canvas, null, 1));
console.log(Object.keys(boards).join(', '));
