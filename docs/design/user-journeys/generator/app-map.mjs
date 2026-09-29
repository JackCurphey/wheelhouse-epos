// Journey A — App map and navigation, redrawn in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-app-map-review.md
//
// Reuses the approved Workshop day shells (diary.mjs) so the frame stays one
// design. Example data is only what the generator already has: North Street
// Cycles, Bolton, Till B1, Jo Taylor, and Maya Patel's job WH-1042 with its
// approved lines (£111.00).
import { C, MONO, esc, icon, button, card, logoSlot } from './ui.mjs';
import { DW, DH } from './stage1.mjs';
import { shellDesktop, ROOMS_DIARY, LINES_APPROVED, WORK_TOTAL_APPROVED, screens as diaryScreens, a11ySettingRow, symbolsPreview, largerTextPreview } from './diary.mjs';

const SHOP = 'North Street Cycles';
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const money = (n) => `£${n.toFixed(2)}`;

// Decision 2: one search box in the staff header on every page.
export const headerSearch = (w = 320) => `<label style="display: flex; align-items: center; gap: 8px; width: ${w}px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}; font-size: 14px">${icon('search', 16)}<input type="search" aria-label="Search jobs, customers, products" placeholder="Search jobs, customers, products" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; color: ${C.ink}"></label>`;

// ---------- Till pieces ----------
const onlinePill = (dark = true) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: ${dark ? 'rgba(255,255,255,0.12)' : C.okBg}; color: ${dark ? '#ffffff' : C.successInk}">${icon('wifi', 14)}Online</span>`;
const barBtn = (inner, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; min-width: 44px; justify-content: center; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 600">${inner}</button>`;

// The till's own charcoal bar (full-screen and rail options).
function tillBar({ back = false } = {}) {
  return `<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 14px; background: ${C.accentDark}; color: #ffffff">
${back ? `<a href="#" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px 0 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600">${icon('back', 18)}Back to the shop</a>` : ''}
<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">${mono('Till B1')}</span><span style="font-size: 12px; opacity: 0.8">Bolton · ${SHOP}</span></span>
<span style="flex-grow: 1"></span>
${onlinePill()}
${barBtn(`${icon('user', 16)}Serving: Jo Taylor`)}
${barBtn(icon('menu', 18), 'Till menu')}
</header>`;
}

// Left: product search and the shop's product buttons (not designed yet — journey 11).
function productArea() {
  return `<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px">
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.input}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input type="search" aria-label="Search or scan a product" placeholder="Search or scan a product" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; color: ${C.muted}; font-size: 14px; line-height: 1.5">Product buttons and search results<br>(designed with Selling at the till, journey 11)</div>
</div>`;
}

// Right: the basket, loaded with Maya Patel's approved job.
function basket(width) {
  const lines = LINES_APPROVED.filter((l) => l.approval === 'Approved');
  return card(`<div style="height: 100%; box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">Basket</h2><a href="#" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Clear</a></div>
<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid ${C.border}; border-radius: 8px"><span style="font-size: 14px; font-weight: 600">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">Workshop job ${mono('WH-1042')} · approved work</span></div>
<div style="display: flex; flex-direction: column">${lines.map((l) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">${esc(l.work)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(l.sub)}</span></span>${mono(money(l.price), 'font-size: 15px')}</div>`).join('')}</div>
<div style="flex-grow: 1"></div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">Total</span>${mono(money(WORK_TOTAL_APPROVED), 'font-size: 24px; font-weight: 500')}</div>
${button(`Take payment · ${money(WORK_TOTAL_APPROVED)}`, { block: true })}
</div>`, `width: ${width}px; flex-shrink: 0; height: 100%`);
}

const tillBody = (basketW, pad = 20) => `<div style="height: 100%; box-sizing: border-box; padding: ${pad}px; display: flex; gap: 20px">${productArea()}${basket(basketW)}</div>`;

// Folded rail (decisions 4, 5): the tablet rail's look at desktop size. Resting
// the pointer on it for 300 ms (or focusing into it with the keyboard)
// unfolds the full sidebar over the page; moving away folds it again. The
// Unfold button does the same with a click or tap. Reduce motion drops the
// slide, not the unfolding.
const railItemStyle = (on) => `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 48px; box-sizing: border-box; padding: 4px 3px; border-radius: 8px; text-decoration: none; color: ${C.sidebarInk}; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.highlight}` : 'none'}`;
const sideItemStyle = (on) => `display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 0 12px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: ${on ? 700 : 500}; color: ${C.sidebarInk}; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.highlight}` : 'none'}`;
const staffRooms = () => ROOMS_DIARY.map(([room, items]) => [room, items.filter((i) => i[3].includes(STAFF.role))]).filter(([, items]) => items.length);
const initials = (n) => n.split(' ').map((x) => x[0]).join('');

// Decision 8: your name opens "Your settings" — same block as the full sidebar in diary.mjs.
const personBlock = () => `<div style="display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2)"><a href="your-settings-desktop.dc.html" aria-label="Your settings — ${STAFF.person}, ${STAFF.roleName}" title="Your settings" style="display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 4px 8px; border-radius: 8px; color: #ffffff; text-decoration: none"><span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700; flex-shrink: 0">${initials(STAFF.person)}</span><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 14px; font-weight: 600">${STAFF.person}</span><span style="font-size: 12px; opacity: 0.8">${STAFF.roleName}</span></span><span style="display: inline-flex; opacity: 0.8">${icon('settings', 16)}</span></a><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; font-size: 13px; color: #ffffff">Sign out</a></div>`;

function unfoldedPanel(active, forced) {
  return `<nav aria-label="Main" class="wh-rail-full" style="position: absolute; top: 0; left: 0; bottom: 0; width: 248px; box-sizing: border-box; padding: 14px 12px; display: flex; flex-direction: column; gap: 12px; background: ${C.accentDark}; color: #ffffff; box-shadow: 8px 0 24px rgba(38,36,32,0.28); z-index: 5; ${forced ? '' : 'visibility: hidden; opacity: 0;'}">
<div style="display: flex; align-items: center; gap: 10px; padding: 0 0 0 6px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700; flex-grow: 1">Wheelhouse</span><button type="button" aria-label="Fold the menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff"><span style="display: inline-flex; transform: rotate(90deg)">${icon('chevron', 16)}</span></button></div>
<button type="button" aria-label="Switch site" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #ffffff; font-family: inherit; text-align: left"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; opacity: 0.8">${SHOP}</span><span style="font-size: 14px; font-weight: 600">Bolton</span></span>${icon('chevron', 16)}</button>
<div style="display: flex; flex-direction: column; gap: 8px">${staffRooms().map(([room, items]) => `<div style="display: flex; flex-direction: column; gap: 2px"><div style="padding: 2px 12px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(243,242,238,0.75)">${room}</div>${items.map(([key, label, ic]) => `<a href="#" aria-current="${key === active ? 'page' : 'false'}" style="${sideItemStyle(key === active)}">${icon(ic, 18)}<span>${esc(label)}</span></a>`).join('')}</div>`).join('')}</div>
<div style="flex-grow: 1"></div>
${personBlock()}
</nav>`;
}

const RAIL_CSS = `<style>
.wh-rail:hover .wh-rail-full,.wh-rail:focus-within .wh-rail-full{visibility: visible !important; opacity: 1 !important;}
.wh-rail .wh-rail-full{transition: visibility 0s linear 250ms, opacity 0s linear 250ms;}
.wh-rail:hover .wh-rail-full{transition-delay: 300ms;}
.wh-rail:focus-within .wh-rail-full{transition-delay: 0s;}
@media (prefers-reduced-motion: no-preference) {
  .wh-rail .wh-rail-full{transition: visibility 0s linear 250ms, opacity 160ms ease 90ms, transform 160ms ease 90ms; transform: translateX(-12px);}
  .wh-rail:hover .wh-rail-full{transition: visibility 0s linear 300ms, opacity 160ms ease 300ms, transform 160ms ease 300ms; transform: none;}
  .wh-rail:focus-within .wh-rail-full{transform: none; transition-delay: 0s;}
}
</style>`;

function foldedRail(active, { forced = false } = {}) {
  const groups = staffRooms().map(([, items]) => items);
  return `${forced ? '' : RAIL_CSS}<div class="wh-rail" style="position: relative; width: 84px; flex-shrink: 0; display: flex">
<nav aria-label="Main, folded" style="width: 84px; box-sizing: border-box; padding: 8px 6px; display: flex; flex-direction: column; gap: 6px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; justify-content: center; padding-bottom: 2px">${logoSlot('Wheelhouse logo', true)}</div>
<button type="button" aria-label="Unfold the menu" aria-expanded="${forced}" style="display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 44px; justify-content: center; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 12px; font-weight: 600"><span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 16)}</span>Unfold</button>
${groups.map((g, i) => `<div style="display: flex; flex-direction: column; gap: 1px; ${i ? 'padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.18)' : ''}">${g.map(([key, label, ic]) => `<a href="#" aria-current="${key === active ? 'page' : 'false'}" style="${railItemStyle(key === active)}">${icon(ic, 19)}<span style="font-size: 12px; font-weight: ${key === active ? 700 : 500}; line-height: 1.12; text-align: center">${esc(label)}</span></a>`).join('')}</div>`).join('')}
<div style="flex-grow: 1"></div>
<a href="your-settings-desktop.dc.html" aria-label="Your settings — ${STAFF.person}, ${STAFF.roleName}" title="Your settings" style="display: flex; justify-content: center; align-items: center; min-height: 44px; color: #ffffff; text-decoration: none"><span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700">${initials(STAFF.person)}</span></a>
</nav>
${unfoldedPanel(active, forced)}
</div>`;
}

const tillRail = (forced) => `<div style="position: relative; width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">${foldedRail('till', { forced })}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar()}<main style="flex-grow: 1; min-height: 0">${tillBody(400)}</main></div></div>`;

// ---------- Screens ----------
export const screens = {};

// Decision 4: on the Till page the sidebar folds to the rail. Rest the
// pointer on the rail (300 ms) to unfold it — this board really does it.
screens['till-rail'] = { desktop: tillRail(false) };
// The same moment frozen: the rail unfolded over the till.
screens['till-rail-open'] = { desktop: tillRail(true) };

// Decision 8: "Your settings" pop-up, opened from your name, for every role.
// Holds the Accessibility settings (Workshop day decision 57 plus decision 7's
// folded sidebar). Decision 6: each switch applies at once — no Save button.
function yourSettingsDialog() {
  const rows = [
    a11ySettingRow('ys-symbols', 'Show status symbols', 'Adds a small symbol to each diary job so its status doesn’t rely on colour alone. Helpful for colour blindness.', false, symbolsPreview('desktop')),
    a11ySettingRow('ys-motion', 'Reduce motion', 'Turns off animations, such as the arrow that shows where a customer wants to move a job. Also switches on automatically when your computer is set to reduce motion.', false),
    a11ySettingRow('ys-text', 'Larger text', 'Makes text across Wheelhouse a step larger.', false, largerTextPreview('desktop')),
    a11ySettingRow('ys-rail', 'Folded sidebar', 'Folds the sidebar down to icons on every page, for more room. Rest the pointer on it to unfold it. The Till always has it folded.', false),
  ];
  return `<div role="dialog" aria-modal="true" aria-labelledby="ys-title" style="width: 640px; max-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 48px rgba(38,36,32,0.28)">
<div style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="ys-title" style="margin: 0; font-size: 20px; font-weight: 700">Your settings</h2><span style="font-size: 13px; color: ${C.muted}">${STAFF.person} · ${STAFF.roleName} · just for you, they don’t change what others see</span></div>
<a href="diary-desktop.dc.html" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</div>
<div style="padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 12px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">Accessibility</div>
${rows.join('')}
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Changes apply straight away.</p>
</div>
</div>`;
}
screens['your-settings'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${diaryScreens.diary.desktop}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 28px; box-sizing: border-box">${yourSettingsDialog()}</div></div>`,
};

// ---------- Customer website (decision 3) ----------
// The frame takes its colours from a theme object, so a shop's own theme
// swaps in without touching the layout. Soft sand is the default; Ocean Blue
// is a real preset from the current app's website Theme menu
// (public/app.js THEME_PRESETS.ocean: topbar #1a3f66, accent #2f5f96).
const SITE_THEMES = {
  sand: { name: 'Soft sand', headerBg: C.panel, headerInk: C.ink, headerBorder: C.border, accent: C.accent, ground: C.bg, mutedInk: C.muted },
  ocean: { name: 'Ocean Blue', headerBg: '#1a3f66', headerInk: '#ffffff', headerBorder: '#1a3f66', accent: '#2f5f96', ground: '#ffffff', mutedInk: '#4a5560' },
};
function siteDesktop(themeKey, active = 'Shop') {
  const t = SITE_THEMES[themeKey];
  const dark = t.headerInk === '#ffffff';
  const navLink = (label) => `<a href="#"${label === active ? ' aria-current="page"' : ''} style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: ${label === active ? 700 : 500}; color: ${t.headerInk}; text-decoration: ${label === active ? 'underline' : 'none'}; text-decoration-thickness: 2px; text-underline-offset: 8px">${label}</a>`;
  const headerBtn = (ic, label, text) => `<a href="#" aria-label="${label}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 6px; font-size: 15px; font-weight: 500; color: ${t.headerInk}; text-decoration: none">${icon(ic, 20)}${text}</a>`;
  return `${dark ? '<style>.site-search-dark::placeholder{color: rgba(255,255,255,0.85); opacity: 1}</style>' : ''}<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; background: ${t.ground}">
<header style="height: 72px; flex-shrink: 0; box-sizing: border-box; padding: 0 40px; display: flex; align-items: center; gap: 28px; background: ${t.headerBg}; color: ${t.headerInk}; border-bottom: 1px solid ${t.headerBorder}">
<a href="#" style="display: flex; align-items: center; gap: 10px; color: ${t.headerInk}; text-decoration: none">${logoSlot('Shop logo', dark)}<span style="font-size: 18px; font-weight: 700">${SHOP}</span></a>
<nav aria-label="Website" style="display: flex; gap: 24px; flex-grow: 1">${['Shop', 'Book a repair', 'Our shops'].map(navLink).join('')}</nav>
<label style="display: flex; align-items: center; gap: 8px; width: 240px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${dark ? 'rgba(255,255,255,0.4)' : C.input}; background: ${dark ? 'rgba(255,255,255,0.1)' : '#ffffff'}; color: ${dark ? 'rgba(255,255,255,0.85)' : C.muted}">${icon('search', 16)}<input class="${dark ? 'site-search-dark' : ''}" type="search" aria-label="Search the shop" placeholder="Search the shop" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; color: inherit"></label>
${headerBtn('user', 'Your account', 'Account')}
${headerBtn('basket', 'Basket, 0 items', 'Basket')}
</header>
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 40px; display: flex; flex-direction: column; gap: 20px">
<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${dark ? '#b8c4d0' : C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; color: ${t.mutedInk}; font-size: 15px; line-height: 1.5">Page content — the shop’s pages, laid out in its theme<br>(designed with Find the shop and browse the website, journey 1)</div>
</main>
<footer style="flex-shrink: 0; box-sizing: border-box; padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${dark ? '#d5dde6' : C.border}; font-size: 13px; color: ${t.mutedInk}"><span>${SHOP} · Bolton</span><span style="display: flex; gap: 20px"><a href="#" style="color: inherit">Contact us</a><a href="#" style="color: inherit">Delivery and returns</a><a href="#" style="color: inherit">Privacy</a></span></footer>
</div>`;
}
screens['site'] = { desktop: siteDesktop('sand') };
screens['site-ocean'] = { desktop: siteDesktop('ocean') };

export const TITLES = {
  'site': 'Customer website — default theme (Soft sand)',
  'site-ocean': 'Customer website — a shop’s own theme (example: Ocean Blue)',
  'your-settings': 'Your settings — opened from your name',
  'till-rail': 'Till — sidebar folded to the rail (rest on it to unfold)',
  'till-rail-open': 'Till — rail unfolded',
};

export const ROWS = [
  { label: 'Till mode', screens: ['till-rail', 'till-rail-open'] },
  { label: 'Your settings', screens: ['your-settings'] },
  { label: 'Customer website', screens: ['site', 'site-ocean'] },
];
