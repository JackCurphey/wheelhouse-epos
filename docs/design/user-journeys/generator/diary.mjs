// Workshop diary redesign — a separate canvas for Jack's review.
// Decisions: docs/decisions/2026-09-27-workshop-day-review.md
// Brief: docs/design/user-journeys/workshop-diary-brief.md
//
// Reuses ui.mjs tokens/helpers and copies the small private helpers/example
// data from stage2.mjs that this needs (per the brief: copy, don't refactor
// stage2). Every screen returns { desktop, tablet, phone } inner markup at
// 1280x800, 1180x820 and 390x844.
import { C, MONO, FONT_DISPLAY, THEME, esc, icon, button, field, card, badge, logoSlot } from './ui.mjs';
import { DW, DH, PW, PH, h1, p, link, stack } from './stage1.mjs';
import { settingsPage, workshopFolds, WORKSHOP_INTRO, withSize } from './settings-frame.mjs';
import { customerPageAt } from './customer.mjs';
// The settled job page (decision 40, 28 Sep 2026 round) — board job-final-2
// in job-options.mjs. Shared with that file via job-page.mjs so neither file
// depends on the other's internals (see that module's header comment).
import {
  jobPopupContent, jobLeftCol as jpJobLeftCol, fullChecklistDialog, togglePill, jobPhoneSections, fullChecklistItemCollapsed,
  CHECKLIST_10, CUSTOMER_NOTE, STAFF_NOTE_BOOKED_IN, STAFF_NOTE_BRAKES,
  panel as jpPanel, row as jpRow, h2 as jpH2, mono as jpMono,
} from './job-page.mjs';

export const TW = 1180, TH = 820;
const SHOP = 'North Street Cycles';

// ---------- Small helpers copied from stage2.mjs (private there; not exported) ----------
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const DISPLAY_FONT_STYLE = THEME === 'sand' ? `font-family: ${FONT_DISPLAY}; ` : '';
const h2 = (t, size = 16) => `<h2 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: ${size}px; line-height: 1.3; font-weight: 700">${esc(t)}</h2>`;
const txt = (t, size = 14, extra = '') => `<p style="margin: 0; font-size: ${size}px; line-height: 1.45; color: ${C.ink}; ${extra}">${t}</p>`;
const note = (t, size = 13) => p(t, size);
const eyebrow = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;
const panel = (inner, extra = '', pad = 18, gap = 12) => card(`<div style="padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`, extra);
const row = (inner, gap = 12, extra = '') => `<div style="display: flex; align-items: center; gap: ${gap}px; ${extra}">${inner}</div>`;
const grid = (cols, inner, gap = 16, extra = '') => `<div style="display: grid; grid-template-columns: ${cols}; gap: ${gap}px; align-items: start; ${extra}">${inner}</div>`;
const banner = (t, tone = 'ok') => {
  const [bg, fg, ic] = { ok: [C.okBg, C.accentDark, 'check'], warn: [C.warnBg, C.warnInk, 'alert'], info: [C.mutedBg, C.ink, 'alert'] }[tone];
  return `<div role="status" style="display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 8px; background: ${bg}; color: ${fg}; font-size: 14px; line-height: 1.45; font-weight: 500">${icon(ic, 18)}<span>${t}</span></div>`;
};
const check = (label, checked, id) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 28px"><input id="${id}" type="checkbox"${checked ? ' checked' : ''} style="width: 18px; height: 18px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0"><label for="${id}" style="font-size: 14px; color: ${C.ink}">${esc(label)}</label></div>`;
const area = (label, value, id, rows = 3) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><textarea id="${id}" rows="${rows}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 9px 10px; font-size: 14px; line-height: 1.4; font-family: inherit; color: ${C.ink}; resize: none">${esc(value)}</textarea></div>`;
const select = (label, options, id) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><select id="${id}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 0 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">${options.map((o, i) => `<option${i === 0 ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
const btnRow = (inner, extra = '') => `<div style="display: flex; flex-wrap: wrap; gap: 10px; ${extra}">${inner}</div>`;
// Decision 67 (29 Sep): a thin full outline, not a heavy coloured left edge.
const quote = (t) => `<blockquote style="margin: 0; padding: 8px 12px; border: 1px solid ${C.border}; border-radius: 6px; font-size: 14px; line-height: 1.5; color: ${C.ink}">${esc(t)}</blockquote>`;
const table = (cols, rows, { size = 14, pad = '9px 12px' } = {}) => `<table style="width: 100%; border-collapse: collapse; font-size: ${size}px">
<thead><tr>${cols.map(([c, a]) => `<th scope="col" style="text-align: ${a || 'left'}; padding: 8px 12px; font-size: 12px; font-weight: 600; color: ${C.muted}; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">${c ? esc(c) : '<span style="position: absolute; width: 1px; height: 1px; overflow: hidden">Action</span>'}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align: ${cols[i][1] || 'left'}; vertical-align: middle; padding: ${pad}; border-bottom: 1px solid ${C.border}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const two = (a, b) => `<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">${a}</span><span style="font-size: 13px; color: ${C.muted}">${b}</span></div>`;
const segmented = (items, activeIdx, label, minH = 36, fontSize = 13) => `<div role="group" aria-label="${esc(label)}" style="display: inline-flex; gap: 6px; flex-wrap: wrap">${items.map((t, i) => `<button type="button" aria-pressed="${i === activeIdx}" style="min-height: ${minH}px; padding: 0 12px; border-radius: 6px; font-family: inherit; font-size: ${fontSize}px; font-weight: 600; border: 1px solid ${i === activeIdx ? C.accent : C.input}; background: ${i === activeIdx ? C.accent : C.panel}; color: ${i === activeIdx ? '#ffffff' : C.ink}">${esc(t)}</button>`).join('')}</div>`;

// ---------- Wheelhouse status colours (brief exception to "ui.mjs tokens only") ----------
// Sand values are look-4's own `status` object (looks.mjs, decision 48) —
// the same five status colours Jack reviewed on the job-page look boards.
export const ST = THEME === 'sand' ? {
  pending: ['#ECE3F2', '#5C3E87', 'Pending'],
  scheduled: ['#E4EAF3', '#294872', 'Scheduled'],
  waiting: ['#F5E3D0', '#8B4715', 'Waiting for parts'],
  hold: ['#F7EAC2', '#7A5A10', 'Change requested'],
  ready: ['#E1EEDD', '#295C39', 'Ready'],
  cancelled: [C.mutedBg, C.muted, 'Cancelled'],
} : {
  pending: ['#f1e8fb', '#6a3ea1', 'Pending'],
  scheduled: ['#eaf1fb', '#2c5289', 'Scheduled'],
  waiting: ['#fff0e3', '#a8420f', 'Waiting for parts'],
  hold: ['#fff7e0', '#8a6100', 'Change requested'],
  ready: ['#e8f5ec', '#164f42', 'Ready'],
  cancelled: [C.mutedBg, C.muted, 'Cancelled'],
};
const statusBadge = (key, textOverride) => { const [bg, ink, label] = ST[key]; return `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${esc(textOverride || label)}</span>`; };

// Audit H1/S1 (29 Sep): a Week-view block is only ~95px wide — too narrow for
// "Waiting for parts" or even "Scheduled" once a bike name and job title are
// already on the block, so the status word used to get appended to a line and
// truncated mid-word ("Sc...", "Wa..."). Below, a status is shown as a small
// shape in the block's top-right corner instead, with the full word kept in
// the block's aria-label/title (unchanged) and in Day view, which has the
// width to spell it out. Shape (not just colour/lightness) tells the six
// statuses apart, matching the legend (H2) — a colour-blind mechanic scanning
// fast still gets a distinct mark, not six identical dots.
const STATUS_SHAPE = {
  pending: (ink) => `<circle cx="5" cy="5" r="4" fill="${ink}"/>`,
  scheduled: (ink) => `<rect x="1.25" y="1.25" width="7.5" height="7.5" rx="1.25" fill="${ink}"/>`,
  waiting: (ink) => `<path d="M5 0.3L9.7 5L5 9.7L0.3 5Z" fill="${ink}"/>`,
  hold: (ink) => `<path d="M5 0.6L9.6 9.2H0.4Z" fill="${ink}"/>`,
  ready: (ink) => `<path d="M1.3 5.1L3.9 7.7L8.7 2.1" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  cancelled: (ink) => `<path d="M1.6 1.6L8.4 8.4M8.4 1.6L1.6 8.4" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
};
// Decision 57 (29 Sep): status is colour-only by default — the shapes above
// were H1/S1's fix for the Week-view block being too narrow for a status
// word, but a shape is still a second, always-on signal on top of colour.
// Jack now wants colour alone by default, with the shape kept only as an
// opt-in per-person accessibility setting (Settings › Accessibility, "Show
// status symbols" — screens['settings-accessibility'] below), since a mark
// that helps colour-blind readers is exactly what a11y settings are for. The
// full status stays in every block's aria-label/title regardless of this
// flag. SHOW_STATUS_SYMBOLS is this canvas's stand-in for that per-person
// setting, drawn OFF (its real default) — exported so audit-ideas.mjs (which
// reuses jobBlock/weekGrid for its before/after boards) sees the same
// default rather than diverging from it.
export const SHOW_STATUS_SYMBOLS = false;
function statusDot(key, size = 13) {
  const [, ink] = ST[key];
  return `<svg width="${size}" height="${size}" viewBox="0 0 10 10" aria-hidden="true" style="position: absolute; top: 4px; right: 4px; flex-shrink: 0; filter: drop-shadow(0 0 1px rgba(255,255,255,0.9))">${STATUS_SHAPE[key](ink)}</svg>`;
}

// ---------- Rooms — Workshop is now Diary (main page) + Overview (brief) ----------
export const ROOMS_DIARY = [
  ['Front desk', [['till', 'Till', 'till', 'OMS'], ['orders', 'Online orders', 'orders', 'OMS'], ['customers', 'Customers', 'customers', 'OMS'], ['messages', 'Messages', 'mail', 'OMS']]],
  ['Workshop', [['diary', 'Diary', 'today', 'OMSK'], ['overview', 'Overview', 'workshop', 'OMSK']]],
  ['Stockroom', [['stock', 'Stock', 'stock', 'OMS'], ['deliveries', 'Deliveries and orders', 'purchasing', 'OM'], ['stocktake', 'Stock take', 'check', 'OMS']]],
  ['Office', [['today', 'Today', 'reports', 'OMS'], ['reports', 'Reports', 'reports', 'OM'], ['website', 'Website', 'website', 'OM'], ['settings', 'Settings', 'settings', 'OM']]],
];
const roomsFor = (role) => ROOMS_DIARY.map(([room, items]) => [room, items.filter((i) => i[3].includes(role))]).filter(([, items]) => items.length);

export function sideItem([key, label, ic], active) {
  const on = key === active;
  return `<a href="${key}-desktop.dc.html" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 12px; min-height: 30px; padding: 0 12px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: ${on ? 700 : 500}; color: ${C.sidebarInk}; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.highlight}` : 'none'}">${icon(ic, 18)}<span>${esc(label)}</span></a>`;
}
const navList = (role, active) => roomsFor(role).map(([room, items]) => `<div style="display: flex; flex-direction: column; gap: 2px"><div style="padding: 2px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(243,242,238,0.7)">${room}</div>${items.map((n) => sideItem(n, active)).join('')}</div>`).join('');

export function railItem([key, label, ic], active) {
  const on = key === active;
  // Decision 68: the tablet's charcoal icon rail — a real label under every
  // icon at 12px (the labels-≥12px floor), each item a ≥44px touch target;
  // the amber inset edge is the rail's active marker (the one thick edge the
  // Soft sand look keeps, as on the desktop sidebar).
  return `<a href="${key}-tablet.dc.html" aria-current="${on ? 'page' : 'false'}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 46px; flex-shrink: 0; box-sizing: border-box; padding: 4px 3px; border-radius: 8px; text-decoration: none; color: ${C.sidebarInk}; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.highlight}` : 'none'}">${icon(ic, 19)}<span style="font-size: 12px; font-weight: ${on ? 700 : 500}; line-height: 1.12; text-align: center">${esc(label)}</span></a>`;
}
const railList = (role, active) => roomsFor(role).map(([, items], i) => `<div style="display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; ${i ? 'padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.18)' : ''}">${items.map((n) => railItem(n, active)).join('')}</div>`).join('');

function siteSwitcher() {
  return `<button type="button" aria-label="Switch site" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 40px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #ffffff; font-family: inherit; text-align: left">
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; opacity: 0.8">${SHOP}</span><span style="font-size: 14px; font-weight: 600">Bolton</span></span>${icon('chevron', 16)}</button>`;
}

// ---------- Shells (copied/adapted from stage1.mjs staffDesktop/staffPhone: same look, new rooms) ----------
// Journey A decision 2 (29 Sep): one search box in the staff header on every page.
export const headerSearch = (w = 320) => `<label style="display: flex; align-items: center; gap: 8px; width: ${w}px; flex-shrink: 0; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}; font-size: 14px">${icon('search', 16)}<input type="search" aria-label="Search jobs, customers, products" placeholder="Search jobs, customers, products" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; color: ${C.ink}"></label>`;
export function shellDesktop(active, title, content, { role = 'S', person = 'Jo Taylor', roleName = 'Staff', actions = '', height = DH, search = true } = {}) {
  return `<div style="width: ${DW}px; height: ${height}px; display: flex; background: ${C.bg}">
<nav aria-label="Main" style="width: 248px; flex-shrink: 0; box-sizing: border-box; padding: 14px 12px; display: flex; flex-direction: column; gap: 12px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700">Wheelhouse</span></div>
${siteSwitcher()}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2)">
<a href="your-settings-desktop.dc.html" aria-label="Your settings — ${esc(person)}, ${esc(roleName)}" title="Your settings" style="display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 4px 8px; border-radius: 8px; color: #ffffff; text-decoration: none">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700; flex-shrink: 0">${esc(person.split(' ').map((x) => x[0]).join(''))}</span>
<span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 14px; font-weight: 600">${esc(person)}</span><span style="font-size: 12px; opacity: 0.8">${esc(roleName)}</span></span>
<span style="display: inline-flex; opacity: 0.8">${icon('settings', 16)}</span>
</a>
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; font-size: 13px; color: #ffffff">Sign out</a>
</div>
</nav>
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<h1 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 20px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${search ? headerSearch() : ''}${actions}
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 18px 28px; overflow: hidden; min-height: 0">${content}</main>
</div>
</div>`;
}

const RAIL_W = 84;
// Journey A decisions 2, 8, 9, 13: on tablet and phone the header search is a
// magnifying-glass button, and your name badge (with a small cog) opens Your
// settings.
export const searchIconBtn = (dark = false) => `<button type="button" aria-label="Search jobs, customers, products" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: ${dark ? '0' : `1px solid ${C.input}`}; background: transparent; color: ${dark ? '#ffffff' : C.ink}">${icon('search', 20)}</button>`;
export const avatarWithCog = (ini) => `<span style="position: relative; display: inline-block; width: 38px; height: 37px"><span style="position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700">${ini}</span>${cogBadge()}</span>`;
export const cogBadge = () => `<span aria-hidden="true" style="position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: ${C.accentDark}; border: 1px solid rgba(255,255,255,0.45)">${icon('settings', 11)}</span>`;
export function shellTablet(active, title, content, { role = 'S', person = 'Jo Taylor', roleName = 'Staff', actions = '', search = true } = {}) {
  return `<div style="width: ${TW}px; height: ${TH}px; display: flex; background: ${C.bg}">
<nav aria-label="Main" style="width: ${RAIL_W}px; flex-shrink: 0; min-height: 0; box-sizing: border-box; padding: 8px 6px; display: flex; flex-direction: column; gap: 6px; background: ${C.accentDark}; color: #ffffff; align-items: stretch">
<div style="display: flex; justify-content: center; padding: 0 0 2px; flex-shrink: 0">${logoSlot('Wheelhouse logo', true)}</div>
<div style="flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 3px">${railList(role, active)}</div>
<a href="your-settings-tablet.dc.html" aria-label="Your settings — ${esc(person)}, ${esc(roleName)}" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 44px; justify-content: center; color: #ffffff; text-decoration: none">${avatarWithCog(esc(person.split(' ').map((x) => x[0]).join('')))}</a>
</nav>
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 60px; flex-shrink: 0; box-sizing: border-box; padding: 0 22px; display: flex; align-items: center; gap: 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<h1 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 20px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${search ? searchIconBtn() : ''}${actions}
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 16px 22px; overflow: hidden; min-height: 0">${content}</main>
</div>
</div>`;
}
// Phone (decision 68): a charcoal top bar with the menu button, the page
// title and an optional action (the diary's + New job), then the page.
// `overlay` is drawn over the whole phone (bottom sheets, dimmed backdrops);
// `pad` lets a page with its own full-bleed scrolling area drop main's padding.
export function shellPhone(title, content, { menuOpen = false, role = 'S', active = 'diary', actions = '', overlay = '', pad = 14, person = 'Jo Taylor', roleName = 'Staff', search = true } = {}) {
  const bar = `<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 6px; display: flex; align-items: center; gap: 6px; background: ${C.accentDark}; color: #ffffff">
<button type="button" aria-label="Open menu" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: #ffffff">${icon('menu', 22)}</button>
<h1 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 18px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${search ? searchIconBtn(true) : ''}${actions}
</header>`;
  const sheet = menuOpen ? `<div style="position: absolute; inset: 0; background: rgba(20,24,22,0.45)"></div>
<nav aria-label="Main" style="position: absolute; top: 0; left: 0; bottom: 0; width: 300px; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 14px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700; flex-grow: 1">Wheelhouse</span><button type="button" aria-label="Close menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('close', 20)}</button></div>
${siteSwitcher()}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2)"><a href="your-settings-phone.dc.html" aria-label="Your settings — ${esc(person)}, ${esc(roleName)}" style="display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 0; min-height: 44px; padding: 4px 8px; border-radius: 8px; color: #ffffff; text-decoration: none"><span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700; flex-shrink: 0">${esc(person.split(' ').map((x) => x[0]).join(''))}</span><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 14px; font-weight: 600">${esc(person)}</span><span style="font-size: 12px; opacity: 0.8">${esc(roleName)}</span></span><span style="display: inline-flex; opacity: 0.8">${icon('settings', 16)}</span></a><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; font-size: 13px; color: #ffffff">Sign out</a></div>
</nav>` : '';
  return `<div style="position: relative; width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">${bar}<main style="flex-grow: 1; box-sizing: border-box; padding: ${pad}px; overflow: hidden; min-height: 0; display: flex; flex-direction: column">${content}</main>${sheet}${overlay}</div>`;
}

// ---------- Dialog (requests and jobs open as a centred pop-up over the dimmed diary — decisions 15, 16) ----------
// Request pop-ups (decision 15): moderate size, centred, height to content.
const DIALOG_W = 600;
function dialogOverlay(baseShell, w, h, dialogHtml, { pad = 40, full = false, maxWidth = DIALOG_W, labelledby } = {}) {
  const sizeStyle = full ? 'width: 100%; height: 100%;' : `width: 100%; max-width: ${maxWidth}px; max-height: 100%;`;
  return `<div style="position: relative; width: ${w}px; height: ${h}px; overflow: hidden">
${baseShell}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${pad}px">
<div role="dialog" aria-modal="true"${labelledby ? ` aria-labelledby="${labelledby}"` : ''} style="${sizeStyle} box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">${dialogHtml}</div>
</div>
</div>`;
}
function dialogHeader(title, closeHref, sub = '', id, size = 'desktop') {
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><h2 id="${id}" style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 18px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h2>${sub ? `<span style="font-size: 12px; color: ${C.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${sub}</span>` : ''}</div>
<a href="${closeHref}" aria-label="Close" style="width: ${size === 'desktop' ? 40 : 44}px; height: ${size === 'desktop' ? 40 : 44}px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
const dialogBody = (inner, pad = 20, gap = 14) => `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
const dialogFooter = (inner) => `<div style="flex-shrink: 0; box-sizing: border-box; padding: 14px 20px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 8px; background: ${C.panel}">${inner}</div>`;
// Phone: the pop-up fills the screen, with a title bar and a back/close control (decision 15, 16; brief item 3).
function dialogPhone(title, backHref, bodyInner, footerInner = '', sub = '', { scroll = false, titleExtra = '', headerAction = '', backLabel = 'Close, back to the diary', bodyPad = 14, bodyGap = 12 } = {}) {
  // Decision 68: on a phone every pop-up fills the screen with a title bar
  // and a back/close control. `scroll`: only the pages allowed to scroll on a
  // phone (the job page, New job) set it — their body is the one scrolling
  // area (data-scroll marks it for the strict fit check); the footer with the
  // main action stays pinned below it.
  const bodyScroll = scroll ? 'overflow-x: hidden; overflow-y: auto;' : 'overflow: hidden;';
  return `<div style="width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.panel}; overflow: hidden">
<header style="min-height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 6px 8px 6px 4px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid ${C.border}">
<a href="${backHref}" aria-label="${esc(backLabel)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('back', 22)}</a>
<div style="display: flex; flex-direction: column; gap: 1px; min-width: 0; flex-grow: 1"><div style="display: flex; align-items: center; gap: 8px; min-width: 0"><h1 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 17px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>${titleExtra}</div>${sub ? `<span style="font-size: 12px; color: ${C.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${sub}</span>` : ''}</div>
${headerAction}
</header>
<main${scroll ? ' data-scroll="page"' : ''} style="flex-grow: 1; min-height: 0; ${bodyScroll} box-sizing: border-box; padding: ${bodyPad}px; display: flex; flex-direction: column; gap: ${bodyGap}px">${bodyInner}</main>
${footerInner ? `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid ${C.border}; background: ${C.panel}">${footerInner}</div>` : ''}
</div>`;
}

// The diary content shown, dimmed, behind a pop-up opened over it on desktop/tablet
// (decision 15: "with the Waiting column, on the right week, the relevant block
// highlighted as in waiting-open"). highlightJob marks the one block a request
// pop-up belongs to: { type: 'pending' } for the purple pending block, or
// { type: 'job', job: 'WH-xxxx' } for an ordinary job block.
function diaryFrozenContent(size, { highlightJob = null } = {}) {
  if (size !== 'desktop') return tabletDiaryContent({ highlightJob });
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { newJob: defaultNewJobHref(size) })}
${row(`${waitingColumn(size, -1)}${weekGrid({ days, size, slotH, mechFilter: 'Everyone', highlightJob })}`, 16, 'align-items: flex-start')}`, 12);
}
// Same, but for the mechanic's diary (decision 13: filtered to Alex, no Waiting column).
export function diaryFrozenContentMechanic(size) {
  if (size !== 'desktop') return tabletDiaryContent({ mechanic: true, newJob: 'new-job-tablet.dc.html' });
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${mechToolbar(true, size, { newJob: `new-job-${size}.dc.html` })}${row(weekGrid({ days, size, slotH, mechFilter: 'Alex' }), 16, 'align-items: flex-start')}`, 12);
}
// A request pop-up: moderate size, centred over the dimmed diary at desktop/tablet.
function requestDialog(size, w, h, { id, title, sub, body, footer, highlightJob }) {
  const base = size === 'desktop'
    ? shellDesktop('diary', 'Workshop diary', diaryFrozenContent('desktop', { highlightJob }))
    : shellTablet('diary', 'Workshop diary', diaryFrozenContent('tablet', { highlightJob }));
  return dialogOverlay(base, w, h, `${dialogHeader(title, `diary-${size}.dc.html`, sub, id, size)}${dialogBody(body(size))}${footer ? dialogFooter(footer(size)) : ''}`, { pad: 40, maxWidth: DIALOG_W, labelledby: id });
}

// ---------- Bike tag barcode (real-looking Code 128 style bars) ----------
function barcode128(value, w = 220, h = 46) {
  const bits = [];
  for (const ch of String(value)) { const code = ch.codePointAt(0); for (let i = 0; i < 8; i++) bits.push((code >> i) & 1); }
  while (bits.length < 88) bits.push((bits.length * 7) % 2);
  const n = bits.length, bw = w / n;
  let x = 0, bars = '';
  for (const b of bits) { if (b) bars += `<rect x="${x.toFixed(2)}" y="0" width="${(bw * 0.62).toFixed(2)}" height="${h}" fill="${C.ink}"/>`; x += bw; }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Code 128 barcode for ${esc(value)}" style="display: block">${bars}</svg>`;
}

// ---------- Example data (only names/bikes/jobs/prices already in stage2.mjs) ----------
// The one customer/job every job board and the new customer-desktop board
// share (27 Sep round, item 24): Maya Patel's email is the one already used
// in newJobBody's custResult ("maya@example.test"); nothing here is invented.
const JOB_CUSTOMER = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards' };
// Service options for new-job-desktop's service select (item 23): durations
// match what's already used across the example week's JOBS below, so the
// "60 min" the warning quotes is the real duration of the first (default) option.
const SERVICE_OPTIONS = [['Standard service', 60], ['Safety check', 60], ['Gear adjustment', 60], ['Brake service', 45]];
// Decision 66: the work is chosen as branching pills — a first-level group
// (Full service / Individual service), then that group's own services as
// pills. Grouping used (shops group their own services in service settings,
// per the decision): Full service holds the one all-in service; Individual
// service holds every single-item service — all four names are the ones
// already in SERVICE_OPTIONS above, nothing invented.
const SERVICE_GROUPS = { 'Full service': ['Standard service'], 'Individual service': ['Safety check', 'Gear adjustment', 'Brake service'] };
const serviceGroupOf = (name) => Object.keys(SERVICE_GROUPS).find((g) => SERVICE_GROUPS[g].includes(name));
const serviceDurationOf = (name) => (SERVICE_OPTIONS.find(([n]) => n === name) || [])[1];
const CONCERN = '“My rear brake squeals and feels weak. The gears could use a tune-up too.”';
const LINES = [
  ['Standard service', 'Labour · 60 min', '£65.00'],
  ['Shimano brake pads', `Part · ${mono('B05S-RX')}`, '£28.00'],
  ['Fit &amp; adjust brakes', 'Labour · 30 min', '£18.00'],
  ['Replace gear cable', 'Optional · cable still serviceable', '£12.00'],
];
const DECISIONS = [['Approved', 'green'], ['Approved', 'green'], ['Approved', 'green'], ['Declined', 'red']];
// Item 46 (decision 46): labour lines first, then parts, in their original
// order within each group; a line that's neither (here, "Replace gear cable
// · Optional · cable still serviceable" — an optional extra, not a stocked
// part or a timed labour line) sorts after the parts. Applied at render via
// LINE_ORDER (an index permutation), not by hand-reordering LINES/DECISIONS,
// so the two arrays stay index-aligned everywhere else they're used.
const classifyLineSub = (sub) => (/^Labour\b/i.test(sub) ? 0 : /^Part\b/i.test(sub) ? 1 : 2);
const LINE_ORDER = LINES.map((_, i) => i).sort((a, b) => classifyLineSub(LINES[a][1]) - classifyLineSub(LINES[b][1]) || a - b);
// Checklist (decision 21): each item is a checkbox with an optional note — a
// mix of ticked-with-no-note (customer sees "All working well"), one written
// note (the brakes item, stage2 copy), and an "Add note" link on the rest.
// Moved up here (was just above checklistRow/checklistPanel, further down
// this file) so it — and QUICK_NOTES below, which reads from it — are
// initialized before jobBlock's WH-1042 hover summary (decision 65) can call
// jobQuickOverviewBody while building the plain diary screens, which happens
// at this file's top level well before its own original position.
const CHECKLIST = [
  { t: 'Frame & fork', checked: true, note: '' },
  { t: 'Wheels & tyres', checked: true, note: '' },
  { t: 'Gears indexed', checked: true, note: '' },
  { t: 'Brakes bled & adjusted', checked: true, note: 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' },
  { t: 'Cables & housing', checked: false, note: '' },
];
// ---------- Job overview quick-look box (decision 37, 28 Sep round) — the
// small box a "View overview" click opens over the (lightly dimmed) diary:
// just the job's notes, line items and cost, no customer details or
// mechanic. Reuses the exact texts already in this file — Maya's booking
// concern (CONCERN), the 09:05 booked-in note (HISTORY_ALL) attributed to
// Jo Taylor (the default staff person throughout this file) and the brakes
// checklist note (CHECKLIST) attributed to Alex Morgan, the mechanic who
// starts work at 11:30 per HISTORY_ALL — nothing invented beyond those two
// small, already-used timestamps. Chronological order: the customer's own
// note from her booking, then staff notes as they were written. Also the
// content of WH-1042's hover summary card (decision 65).
const QUICK_NOTES = [
  { who: 'Customer', when: '', text: CONCERN.replace(/[“”]/g, '') },
  { who: 'Jo Taylor', when: '09:05', text: 'Bike booked in, tag printed.' },
  { who: 'Alex Morgan', when: '12:10', text: CHECKLIST.find((c) => c.t === 'Brakes bled & adjusted').note },
];

// Mon 14 – Sun 20 Sep 2026; today is Thu 17 Sep.
export const DAYS = [['Mon', 14], ['Tue', 15], ['Wed', 16], ['Thu', 17], ['Fri', 18], ['Sat', 19], ['Sun', 20]];
export const TODAY = 3;
const HINT_SLOT = { day: 1, start: 10 * 60, mech: 'Alex', label: '10:00 · Alex Morgan' }; // Tue 15 Sep · 10:00 · Alex Morgan

// Jobs already booked in / scheduled (from stage2.mjs COLS and ARRIVALS), plus a
// fuller example week (Mon–Sat) reusing only stage2/diary customers, bikes and
// services so both the standard and mechanic diaries read like a normal working
// week. New WH-10xx numbers continue on from the ones already used (1038–1048).
export const JOBS = [
  // Thu 17 Sep (today) — as already drawn, plus more of the same day's load.
  { day: TODAY, start: 9 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1038', svc: 'Safety check', title: 'Safety check', detail: '09:00–10:00' },
  { day: TODAY, start: 9 * 60, dur: 90, mech: 'Jo', key: 'scheduled', job: 'WH-1040', svc: 'Gear service', title: 'Gear service', detail: '09:00–10:30' },
  { day: TODAY, start: 11 * 60 + 30, dur: 90, mech: 'Alex', key: 'scheduled', job: 'WH-1042', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '11:30–13:00 · approved £111' },
  { day: TODAY, start: 14 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1067', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '14:00–15:00 · safety check' },
  { day: TODAY, start: 13 * 60 + 30, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1068', svc: 'Standard service', title: 'Oliver Chen · Brompton C Line', detail: '13:30–14:30 · standard service' },
  { day: TODAY, start: 15 * 60, dur: 60, mech: 'Jo', key: 'waiting', job: 'WH-1069', svc: 'Gear adjustment', title: 'Aisha Khan · Cannondale Quick', detail: '15:00–16:00 · gear adjustment' },
  // Mon 14 Sep — Oliver Chen's Brompton has a pending change request (10:00 → 14:00).
  { day: 0, start: 9 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1049', svc: 'Gear adjustment', title: 'Jamie Brooks · Giant Escape 2', detail: '09:00–10:00 · gear adjustment' },
  { day: 0, start: 11 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1050', svc: 'Safety check', title: 'Aisha Khan · Cannondale Quick', detail: '11:00–12:00 · safety check' },
  { day: 0, start: 16 * 60, dur: 60, mech: 'Alex', key: 'waiting', job: 'WH-1051', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '16:00–17:00 · standard service' },
  { day: 0, start: 10 * 60, dur: 60, mech: 'Jo', key: 'hold', job: 'WH-1052', svc: 'Gear adjustment', title: 'Oliver Chen · Brompton C Line', detail: 'Requested move to 14:00', link: 'change-selected' },
  { day: 0, start: 12 * 60, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1053', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '12:00–13:00 · safety check' },
  { day: 0, start: 15 * 60, dur: 60, mech: 'Jo', key: 'ready', job: 'WH-1054', svc: 'Gear adjustment', title: 'Maya Patel · Trek Domane AL 3', detail: '15:00–16:00 · gear adjustment' },
  // Tue 15 Sep — Aisha Khan's Cannondale is cancelled by the customer; 10:00 Alex
  // stays free — the New job pick slot (item 2 of the 27 Sep round). Alex's
  // next job now starts 10:30 (added for the "only 30 minutes free" warning
  // example in new-job-desktop), so 10:00 has 30 minutes free, not 60.
  { day: 1, start: 10 * 60 + 30, dur: 30, mech: 'Alex', key: 'scheduled', job: 'WH-1081', svc: 'Gear adjustment', title: 'Oliver Chen · Brompton C Line', detail: '10:30–11:00 · gear adjustment' },
  { day: 1, start: 11 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1055', svc: 'Gear adjustment', title: 'Jamie Brooks · Giant Escape 2', detail: '11:00–12:00 · gear adjustment' },
  { day: 1, start: 13 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1056', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '13:00–14:00 · standard service' },
  { day: 1, start: 15 * 60, dur: 60, mech: 'Alex', key: 'waiting', job: 'WH-1057', svc: 'Safety check', title: 'Oliver Chen · Brompton C Line', detail: '15:00–16:00 · safety check' },
  { day: 1, start: 9 * 60, dur: 60, mech: 'Jo', key: 'cancelled', job: 'WH-1058', svc: 'Safety check', title: 'Aisha Khan · Cannondale Quick', detail: 'Safety check · cancelled' },
  { day: 1, start: 12 * 60, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1059', svc: 'Gear adjustment', title: 'Maya Patel · Trek Domane AL 3', detail: '12:00–13:00 · gear adjustment' },
  { day: 1, start: 16 * 60, dur: 60, mech: 'Jo', key: 'ready', job: 'WH-1060', svc: 'Standard service', title: 'Jamie Brooks · Giant Escape 2', detail: '16:00–17:00 · standard service' },
  // Wed 16 Sep. WH-1061 and WH-1064 are a deliberate partial overlap
  // (decision 59, 29 Sep round 2): Alex's WH-1061 now runs 09:00–11:00 and
  // Jo's WH-1064 now runs 10:00–12:00 (both were 60 min, ending exactly
  // where the next job in their own column starts, so lengthening them to
  // 120 min doesn't collide with WH-1062/WH-1065) — different mechanics,
  // different start times, sharing 10:00–11:00, in the Everyone week view.
  // This is the calendar-style side-by-side case; every other protected
  // example (WH-1042 Thu 11:30, Oliver Chen's Mon 10:00 change request, Sam
  // Reed's Fri 10:00 pending request, Tue 10:00 free for new-job-pick, Jo's
  // Thu 16:00 free) is untouched.
  { day: 2, start: 9 * 60, dur: 120, mech: 'Alex', key: 'scheduled', job: 'WH-1061', svc: 'Gear adjustment', title: 'Aisha Khan · Cannondale Quick', detail: '09:00–11:00 · gear adjustment' },
  { day: 2, start: 11 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1062', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '11:00–12:00 · standard service' },
  { day: 2, start: 14 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1063', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '14:00–15:00 · safety check' },
  { day: 2, start: 10 * 60, dur: 120, mech: 'Jo', key: 'scheduled', job: 'WH-1064', svc: 'Gear adjustment', title: 'Oliver Chen · Brompton C Line', detail: '10:00–12:00 · gear adjustment' },
  { day: 2, start: 12 * 60, dur: 60, mech: 'Jo', key: 'waiting', job: 'WH-1065', svc: 'Standard service', title: 'Aisha Khan · Cannondale Quick', detail: '12:00–13:00 · standard service' },
  { day: 2, start: 15 * 60, dur: 60, mech: 'Jo', key: 'ready', job: 'WH-1066', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '15:00–16:00 · safety check' },
  // Fri 18 Sep — Sam Reed's pending request sits alongside the day's jobs
  // (drawn separately below as the purple "Pending" block).
  { day: 4, start: 9 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1070', svc: 'Safety check', title: 'Aisha Khan · Cannondale Quick', detail: '09:00–10:00 · safety check' },
  { day: 4, start: 12 * 60 + 30, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1071', svc: 'Gear adjustment', title: 'Maya Patel · Trek Domane AL 3', detail: '12:30–13:30 · gear adjustment' },
  { day: 4, start: 15 * 60, dur: 60, mech: 'Alex', key: 'waiting', job: 'WH-1072', svc: 'Standard service', title: 'Jamie Brooks · Giant Escape 2', detail: '15:00–16:00 · standard service' },
  { day: 4, start: 11 * 60, dur: 45, mech: 'Jo', key: 'scheduled', job: 'WH-1045', svc: 'Gear adjustment', title: 'Jamie Brooks · Giant Escape 2', detail: '11:00–11:45 appointment' },
  { day: 4, start: 13 * 60 + 45, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1073', svc: 'Safety check', title: 'Oliver Chen · Brompton C Line', detail: '13:45–14:45 · safety check' },
  { day: 4, start: 16 * 60 + 15, dur: 60, mech: 'Jo', key: 'ready', job: 'WH-1074', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '16:15–17:15 · standard service' },
  // Sat 19 Sep.
  { day: 5, start: 9 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1075', svc: 'Gear adjustment', title: 'Aisha Khan · Cannondale Quick', detail: '09:00–10:00 · gear adjustment' },
  { day: 5, start: 11 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1076', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '11:00–12:00 · safety check' },
  { day: 5, start: 13 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1077', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '13:00–14:00 · standard service' },
  { day: 5, start: 10 * 60, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1078', svc: 'Gear adjustment', title: 'Oliver Chen · Brompton C Line', detail: '10:00–11:00 · gear adjustment' },
  { day: 5, start: 12 * 60, dur: 60, mech: 'Jo', key: 'ready', job: 'WH-1079', svc: 'Standard service', title: 'Aisha Khan · Cannondale Quick', detail: '12:00–13:00 · standard service' },
  { day: 5, start: 14 * 60, dur: 60, mech: 'Jo', key: 'waiting', job: 'WH-1080', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '14:00–15:00 · safety check' },
];
// Item 29 (27 Sep round 2): diary blocks lead with the bike, then the job
// title, then the status. Most JOBS titles are already "Name · Bike" (the
// bike a job's customer already has, per the 27 Sep round 2 mapping); two
// slots have no customer in the title (WH-1038, WH-1040) so get an explicit
// override reusing only names/bikes already used elsewhere in the example
// week. Every JOBS entry also carries an explicit `svc` (job title), reusing
// the service names already in this file/stage2.mjs (Standard service,
// Safety check, Gear adjustment, Brake service, Gear service — nothing
// invented) — job title is the block's line 2, editable, per decision 29.
const KNOWN_CUSTOMERS = ['Maya Patel', 'Oliver Chen', 'Sam Reed', 'Jamie Brooks', 'Aisha Khan'];
const CUSTOMER_OVERRIDE = { 'WH-1038': ['Jamie Brooks', 'Giant Escape 2'], 'WH-1040': ['Aisha Khan', 'Cannondale Quick'] };
export function customerBikeOf(j) {
  if (CUSTOMER_OVERRIDE[j.job]) return CUSTOMER_OVERRIDE[j.job];
  const parts = String(j.title).split(' · ');
  if (KNOWN_CUSTOMERS.includes(parts[0])) return [parts[0], parts[1] || ''];
  return [j.job, ''];
}
// Shortened status labels for the narrow diary block itself (never on badges or
// the legend, which keep the full wording) — "Waiting for parts" truncates to
// an unreadable "Waiting for p…" at block width, so the block uses a label
// short enough to read in full, or wraps onto a second line where the block is
// tall enough.
const BLOCK_LABEL = { pending: 'Pending', scheduled: 'Scheduled', waiting: 'Waiting parts', hold: 'Change request', ready: 'Ready', cancelled: 'Cancelled' };
// The shop's choice of what a block shows first/second, in diary-settings
// (decision 29, refining decision 17). Defaults: bike first, job title
// second — the status is always shown too, on its own line or sharing the
// second line, whatever the block's size allows (see jobBlock).
const BLOCK_PREF = { first: 'bike', second: 'jobTitle' };

// ---------- Storage slots (item 27, 27 Sep round) — optional per shop; on for
// this shop. STORAGE maps a few example jobs to a hook so the diary block and
// the job page header show it; STORAGE_SLOTS is the shop's own list, edited in
// diary-settings-desktop, and (decision 66) the New job form's "Where the
// bike is kept" pills.
export const STORAGE = { 'WH-1042': 'Hook 3', 'WH-1040': 'Hook 1' };
const STORAGE_SLOTS = ['Hook 1', 'Hook 2', 'Hook 3', 'Hook 4', 'Hook 5', 'Hook 6', 'Workshop floor', 'Front window'];
const STARTING_STATUS = ['Booked', 'Bike is here', 'Waiting for parts'];

// Unscheduled row: bikes with no set time (stage2's "Shared queue" example).
// A confirmed job with no set time uses the ordinary scheduled colour — purple
// is reserved for pending requests only (decision 12).
const UNSCHEDULED = [{ job: 'WH-1046', title: 'Standard service', detail: 'Shared queue · 60 min' }];
// A pending booking request also sits in the diary, in the slot it asked for
// (decision 12). No mechanic is assigned yet, so it only shows in the
// Everyone view. Fri 18 Sep 10:00–10:45 (45 min, stage2's REQ effort). Item 2
// (27 Sep round 2): the pending block shows bike, then job title, then
// "Pending" — bike and jobTitle are explicit fields so pendingBlock can lead
// with the bike, same as an ordinary job block.
const PENDING_DIARY = { day: 4, start: 10 * 60, dur: 45, customer: 'Sam Reed', bike: 'Specialized Sirrus', jobTitle: 'Brake service', detail: '10:00–10:45 · requested Fri 18 Sep' };
// Oliver Chen's change request: shown at its current time (WH-1052, Mon 10:00,
// amber) plus a dashed "requested" outline at the proposed new time (14:00).
// Item 2: the outline reads "Brompton C Line · Requested 14:00" — bike, not
// the customer's name (person stays for the aria-label).
const REQUEST_OUTLINE = { day: 0, start: 14 * 60, dur: 60, label: 'Requested 14:00', person: 'Oliver Chen', bike: 'Brompton C Line' };
// Waiting for you: one of each kind (stage2's requests and REQ example customers).
const WAITING = [
  { kind: 'New booking request', tone: 'pending', customer: 'Sam Reed', bike: 'Specialized Sirrus', detail: 'Brake service · requested Fri 18 Sep' },
  { kind: 'Change request', tone: 'hold', customer: 'Oliver Chen', bike: 'Brompton C Line', detail: 'Mon 10:00 → 14:00' },
  { kind: 'Cancelled by customer', tone: 'cancelled', customer: 'Aisha Khan', bike: 'Cannondale Quick', detail: 'Safety check · cancelled' },
];
const REQ_LINK = { 'New booking request': 'request-new', 'Change request': 'request-change', 'Cancelled by customer': 'request-cancel' };

// ---------- Waiting column ----------
// Decision 14: one click highlights the card (jumps the diary to its week) and
// shows an Open button; a single click's link target is the "selected" state
// (waiting-open, same size) — the Open button is what goes to the request itself.
function waitingCard(w, size, selected = false) {
  if (size !== 'desktop') return touchWaitingCard(w, size, selected);
  const [bg, ink, label] = ST[w.tone];
  const inner = `<span style="display: inline-flex; align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 11px; font-weight: 700">${esc(label)}</span>
<span style="font-size: 13px; font-weight: 700">${esc(w.customer)}</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(w.bike)}</span>
<span style="font-size: 12px; color: ${C.ink}">${esc(w.detail)}</span>`;
  if (selected) {
    const openHref = `${REQ_LINK[w.kind]}-${size}.dc.html`;
    return `<div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 2px solid ${C.accent}; box-shadow: 0 0 0 3px rgba(${C.highlightRgb},0.45); background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 5px">${inner}</div>
<a href="${openHref}" style="align-self: flex-start; display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none">Open</a>
</div>`;
  }
  // Decision 19: a change request's single-click "selected" state is its own
  // board (change-selected), like the pending request's (waiting-open).
  const selectHref = w.kind === 'Change request' ? `change-selected-${size}.dc.html` : `waiting-open-${size}.dc.html`;
  return `<a href="${selectHref}" style="display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}">${inner}</a>`;
}
function waitingColumn(size, selectedIdx = -1, width = 224, hint = false) {
  return `<div style="display: flex; flex-direction: column; gap: 8px; width: ${width}px; flex-shrink: 0">
<h2 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 14px; font-weight: 700">Waiting for you (${WAITING.length})</h2>
${WAITING.map((w, i) => waitingCard(w, size, i === selectedIdx)).join('')}
${hint ? note(size === 'desktop' ? 'Double-click a card to open it.' : 'Tap the card again to open it.') : ''}
</div>`;
}

// ---------- The diary grid (week view: desktop 7 days, tablet 5 days) ----------
const GRID_START = 9 * 60, GRID_SLOTS = 18; // 09:00–18:00, 30-minute slots
// Group overlapping jobs within a day column into clusters (a simple sweep).
// A single job renders as its own block; a cluster of concurrent jobs (different
// mechanics booked at once) renders as one combined block, since the column is
// too narrow at week-zoom to show several full blocks side by side legibly.
function clusterOverlaps(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const clusters = [];
  for (const j of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && j.start < Math.max(...last.map((k) => k.start + k.dur))) last.push(j);
    else clusters.push([j]);
  }
  return clusters;
}
// Decision 59 (29 Sep round 2): within one overlap cluster, jobs sharing the
// exact same start time collapse into one "unit" (the stacked-card control,
// S4, covers that case — see stackedJobsBlock); jobs that overlap without
// sharing a start are laid out calendar-style, each at its own true
// start/end, sharing the column's width only for the overlapping group
// (lanes) — the classic sweep-line "assign the first free lane, free it
// again once its job ends" algorithm, scoped to one cluster at a time so an
// unrelated job later in the same column never inherits another cluster's
// lane count.
function layoutOverlap(cluster) {
  const byStart = new Map();
  for (const j of cluster) {
    if (!byStart.has(j.start)) byStart.set(j.start, []);
    byStart.get(j.start).push(j);
  }
  const units = [...byStart.entries()]
    .map(([start, jobs]) => ({ start, end: Math.max(...jobs.map((j) => j.start + j.dur)), jobs }))
    .sort((a, b) => a.start - b.start);
  const laneEnds = [];
  for (const u of units) {
    let lane = laneEnds.findIndex((e) => e <= u.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = u.end;
    u.lane = lane;
  }
  const total = laneEnds.length;
  return units.map((u) => ({ ...u, total }));
}
// The CSS rect for a lane unit sharing width with `total` other lanes in its
// overlapping group; null (the caller's own default) when total is 1 — a
// unit with the column to itself keeps the ordinary full-width block.
function laneRect(lane, total) {
  if (total <= 1) return null;
  const gap = 4;
  return { left: `calc(3px + (100% - 6px) * ${lane} / ${total})`, width: `calc((100% - 6px) / ${total} - ${gap}px)` };
}
// Decision 59: a narrow lane block (or a stacked-card control) expands to a
// readable width on hover, after ~300ms so a passing pointer doesn't
// trigger it. The delay lives on the `:hover` rule (not the base rule) —
// that's what makes it apply only when *entering* hover, not when leaving
// it. With no transition declared at all outside the reduced-motion media
// query, a reduced-motion user gets the same end state instantly.
let hoverSeq = 0;
// Decision 68 (29 Sep): tablet and phone get their own counter, so redrawing
// them never renumbers a desktop board's class names. Before this round the
// (then stale) tablet week grids shared hoverSeq, interleaved between the
// desktop boards — 7 numbers per Everyone week grid, 1 per Alex-only grid —
// so the desktop numbering this canvas has always shipped includes those
// gaps. keepDesktopSeq() below replays exactly those gaps at the same points
// (straight after each screen whose old tablet board consumed them), which is
// what keeps every desktop board byte-identical to the pre-redraw build.
let devSeq = 0;
const nextSeq = (size) => (size === 'desktop' ? hoverSeq++ : devSeq++);
const LEGACY_TABLET_SEQ = {
  diary: 7, 'diary-mechanic': 1, 'waiting-open': 7, 'change-selected': 7,
  'request-new': 7, 'request-decline': 7, 'request-change': 7, 'request-cancel': 7, 'new-job': 7,
  'job-overview': 7, 'job-book-in': 7, 'job-quote': 7, 'job-mechanic': 1, 'job-waiting-parts': 7, 'job-finished': 7, 'job-collection': 7,
};
const LEGACY_TABLET_CONNECTOR_SEQ = { 'change-selected': 1 };
function keepDesktopSeq(id) {
  hoverSeq += LEGACY_TABLET_SEQ[id] || 0;
  requestConnectorSeq += LEGACY_TABLET_CONNECTOR_SEQ[id] || 0;
}
// diary-hover-summary (decision 65) needs WH-1042's quick-look card rendered
// already open, without relying on CSS :hover, for one static board — set
// just before building that one frozen diary and cleared right after, so
// every other board's WH-1042 block keeps its ordinary hover-only card.
let FORCE_HOVER_SUMMARY_JOB = null;
function laneHoverCSS(cls) {
  // No z-index on the resting rule — only :hover gets one. A resting
  // z-index (even 1) would give this deeply-nested block an explicit
  // stacking level with nothing above it to contain it, so it would paint
  // over a later, unrelated sibling with no z-index of its own (e.g. a job
  // pop-up's dimmed backdrop, itself further down the DOM but at the
  // default "auto" stacking level) — exactly the kind of bug this comment
  // is here to stop someone reintroducing.
  return `<style>
.${cls}:hover{z-index: 9; left: 3px !important; width: calc(100% - 6px) !important; box-shadow: 0 10px 26px rgba(28,30,25,0.3);}
@media (prefers-reduced-motion: no-preference) {
  .${cls}{transition: left 160ms ease, width 160ms ease, box-shadow 160ms ease;}
  .${cls}:hover{transition-delay: 300ms;}
}
</style>`;
}
// `narrow` is true for a Week-view block (7 columns, ~95px each) and false
// for a Day-view block (2 mechanic columns, ~450px each). H1/S1 (29 Sep
// audit): Week view never has room to spell out a status word next to a bike
// name and job title, so a narrow block drops the word for the statusDot
// corner mark instead; a wide Day-view block keeps the word written out in
// full, as before, since it has the room.
function jobBlock(j, size, slotH, highlighted = false, lightMarked = false, faded = false, narrow = true, rect = null) {
  if (size !== 'desktop') return touchJobBlock(j, size, slotH, { highlighted, lightMarked, faded, narrow, rect });
  const [bg, ink] = ST[j.key];
  const blockLabel = BLOCK_LABEL[j.key];
  const [customer, bike] = customerBikeOf(j);
  const jobTitle = j.svc || '';
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  // Three block sizes (item 2, 27 Sep round 2): a 90-minute-plus block is
  // "roomy" enough for bike / job title / status as separate lines, plus the
  // storage hook as a fourth when there's one to show. A 30-minute block is
  // "tiny" — at week-column width there's only room for bike + job title.
  // Anything in between (a 60-minute block) is neither.
  const roomy = h >= slotH * 2;
  const tiny = j.dur <= 30;
  const cancelled = j.key === 'cancelled';
  const strike = cancelled ? 'text-decoration: line-through;' : '';
  const href = `${j.link || 'job-overview'}-${size}.dc.html`;
  // A "light" mark (change-selected) shows the job the change request is
  // currently at, without the strong ring reserved for the target time.
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(${C.highlightRgb},0.55);` : lightMarked ? `box-shadow: 0 0 0 2px ${C.muted};` : '';
  // Faded (new-job-pick, item 2 of the 27 Sep round): busy blocks step back
  // visually while picking a time, so the free grid reads as clickable.
  const slot = STORAGE[j.job];
  // Narrow (Week view): never put the status word into line 2/3 text — the
  // corner dot carries it instead, freeing the line for job title alone.
  // Wide (Day view): unchanged — there's room to write the status out.
  const line2 = narrow ? jobTitle : tiny ? jobTitle : roomy ? jobTitle : [jobTitle, blockLabel].filter(Boolean).join(' · ');
  const line3 = narrow ? (roomy ? slot || '' : '') : roomy ? [blockLabel, slot].filter(Boolean).join(' · ') : '';
  // Audit H1: bike names ("Trek Domane AL 3", "Brompton C Line") were
  // truncating mid-word on their own, even before status text was added to
  // the block. Where a narrow block is tall enough to spare the room (roomy,
  // ~90min+), the bike name wraps onto a second line instead of cutting off;
  // tiny/60-minute blocks stay single-line (no headroom to wrap without
  // overflowing the fixed row height and breaking the no-scroll board).
  const bikeWrap = narrow && roomy;
  const showSymbol = narrow && SHOW_STATUS_SYMBOLS;
  // Decision 59: a lane block (part of a partial overlap, `rect` set) may be
  // narrow enough to truncate the bike name/job title — acceptable, since
  // hovering it (laneHoverCSS below) expands it to a readable width.
  const posStyle = rect ? `left: ${rect.left}; width: ${rect.width};` : 'left: 3px; right: 3px;';
  const hoverCls = rect ? `wh-lane-${size}-${nextSeq(size)}` : '';
  // Decision 65: only WH-1042 carries a hover summary — it's the one example
  // job in this file with notes, line items and cost data (QUICK_NOTES/
  // LINES); the other example jobs don't have that data, so nothing is
  // invented for them. Week view only (narrow) — see jobHoverSummaryMarkup.
  const isSummaryJob = narrow && j.job === 'WH-1042';
  const summaryCls = isSummaryJob ? `wh-hovsum-${size}-${nextSeq(size)}` : '';
  const classAttr = [hoverCls, summaryCls].filter(Boolean).join(' ');
  return `${hoverCls ? laneHoverCSS(hoverCls) : ''}<a href="${href}" ${classAttr ? `class="${classAttr}" ` : ''}aria-label="${esc(bike)}, ${esc(jobTitle)}, ${esc(customer)}, ${esc(j.job)}, ${esc(ST[j.key][2])}, ${esc(j.detail)}" title="${esc(bike)} · ${esc(jobTitle)} · ${esc(customer)} · ${esc(j.job)} · ${esc(ST[j.key][2])} · ${esc(j.detail)}" style="position: absolute; ${posStyle} top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px ${showSymbol ? 16 : 6}px 3px 6px; border-radius: 5px; background: ${bg}; border: 1.75px solid ${ink}; overflow: hidden; ${cancelled ? 'opacity: 0.8;' : ''} ${faded ? 'opacity: 0.5;' : ''} ${ring}">
${showSymbol ? statusDot(j.key) : ''}
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; ${strike} ${bikeWrap ? 'white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.2' : 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis'}">${esc(bike)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${tiny ? C.ink : ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25">${esc(line2)}</span>
${line3 ? `<span style="font-size: 10px; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.75; ${strike}">${esc(line3)}</span>` : ''}
</a>${isSummaryJob ? jobHoverSummaryMarkup(j, size, summaryCls, FORCE_HOVER_SUMMARY_JOB === j.job, top) : ''}`;
}
// Decision 65: resting on WH-1042's block for ~0.6s shows a small quick-look
// card beside it — purpose-built compact content for a hover preview (not
// the full job-quick-overview panels/table, which is too tall to fit beside
// a week-grid block): notes on the left, line items + cost on the right. CSS
// only, general-sibling-selector driven: the <a> and the card are both
// absolutely positioned children of the same day-column div, so
// `.cls:hover ~ .cls-card` reveals the card without any wrapper element. The
// delay lives on the :hover rule only (so a passing pointer doesn't trigger
// it) and, matching laneHoverCSS/stackedJobsBlock above, no transition is
// declared outside the reduced-motion media query — a reduced-motion user
// gets the open state instantly. `forced` bakes the open state in without
// relying on :hover, for the diary-hover-summary static board.
//
// Positioning: the week grid (role="grid") clips its own content
// (overflow:hidden), and this card is a descendant of one narrow (~98px)
// day-column div, which is its absolute-positioning containing block — so a
// 520px card can never fit by just sitting "left: 100%" of the block the way
// the old 300px card did (that's exactly what let it run off the grid's
// right edge and bottom edge). Instead: `right` is expressed as a multiple
// of the day-column's own width (1 column = 100%) to reach past the
// remaining columns to the grid's right edge, with a small inset — this
// works off the same percentage-of-containing-block mechanism the old
// `left: 100%` relied on, just aimed at the grid's far edge instead of the
// block's near edge, so it still resolves correctly regardless of column
// rounding. `top` is the block's own local top (passed in as `blockTop`,
// already known from jobBlock above) nudged up slightly so the card reads as
// "beside" the block rather than hanging below it — WH-1042 (Thu, column 4
// of 7) has 3 columns to spare below its own top before the grid's bottom
// edge, comfortably more than this card's height.
function jobHoverSummaryMarkup(j, size, cls, forced, blockTop) {
  const [customer, bike] = customerBikeOf(j);
  const approvedTotal = LINES.filter((_, i) => DECISIONS[i][0] === 'Approved').reduce((sum, [, , a]) => sum + Number(a.replace('£', '')), 0);
  // 7-day week view (DAYS/TODAY above) — columns after this job's day column,
  // used to reach the grid's right edge from this column's own right edge.
  const colsAfter = DAYS.length - 1 - j.day;
  const rightInsetPx = 10;
  const cardTop = Math.max(4, blockTop - 24);
  const css = forced ? '' : `<style>
.${cls}-wrap{opacity: 0; pointer-events: none; overflow: hidden; max-width: 0;}
.${cls}:hover ~ .${cls}-wrap{opacity: 1; pointer-events: auto; overflow: visible; max-width: none; z-index: 12;}
@media (prefers-reduced-motion: no-preference) {
  .${cls}-wrap{transition: opacity 140ms ease;}
  .${cls}:hover ~ .${cls}-wrap{transition-delay: 600ms;}
}
</style>`;
  const wrapForcedStyle = forced ? 'opacity: 1; pointer-events: auto; overflow: visible; max-width: none; z-index: 12;' : '';
  const notesCol = `<div style="display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; min-width: 0">
<span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: ${C.muted}">Notes</span>
${QUICK_NOTES.map((n) => `<div style="display: flex; flex-direction: column; gap: 1px">
<span style="font-size: 11px; font-weight: 700; color: ${C.muted}">${n.who === 'Customer' ? 'Customer' : `${esc(n.who)}${n.when ? ` · ${esc(n.when)}` : ''}`}</span>
<span style="font-size: 13px; line-height: 1.3; color: ${C.ink}">${esc(n.text)}</span>
</div>`).join('')}
</div>`;
  const lineItemsCol = `<div style="display: flex; flex-direction: column; gap: 5px; flex: 0 0 190px">
<span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: ${C.muted}">Line items</span>
${LINE_ORDER.map((i) => { const [w, , a] = LINES[i]; const declined = DECISIONS[i][0] === 'Declined'; return `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; line-height: 1.3; ${declined ? `text-decoration: line-through; color: ${C.muted};` : ''}">
<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0">${w}</span>${mono(a, declined ? `color: ${C.muted}` : '')}
</div>`; }).join('')}
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 3px; padding-top: 6px; border-top: 1px solid ${C.border}">
<span style="font-size: 13px; font-weight: 700; color: ${C.ink}">Cost</span>${mono(`£${approvedTotal.toFixed(2)}`, 'font-size: 15px; font-weight: 700')}
</div>
</div>`;
  const card = `<div style="width: 520px; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(28,30,25,0.28); padding: 14px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 1px">
<span style="font-size: 13px; font-weight: 700; color: ${C.ink}">${esc(j.svc || '')} · ${esc(j.job)}</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(customer)} · ${esc(bike)}</span>
</div>
<div style="display: flex; gap: 16px; align-items: flex-start">${notesCol}${lineItemsCol}</div>
</div>`;
  const wrap = `<div class="${cls}-wrap" aria-hidden="${!forced}" style="position: absolute; right: calc(${-100 * colsAfter}% + ${rightInsetPx}px); top: ${cardTop}px; ${wrapForcedStyle}">${card}</div>`;
  return `${css}${wrap}`;
}
// The pending request block (decision 12): purple, labelled "Pending", linking
// to the request pop-up rather than a job overview (there is no job yet).
// Only ever drawn in the (narrow) Week view, so it always carries the corner
// dot too (H1/S1) rather than the "Pending" word taking a whole line.
function pendingBlock(size, slotH, highlighted = false) {
  if (size !== 'desktop') return touchPendingBlock(size, slotH, highlighted);
  const j = PENDING_DIARY;
  const [bg, ink] = ST.pending;
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(${C.highlightRgb},0.55);` : '';
  // Item 2 (27 Sep round 2): bike, then job title — the same bike/job-title-
  // first order as an ordinary job block; "Pending" itself now lives in the
  // corner dot + aria-label/title rather than a third text line.
  return `<a href="request-new-${size}.dc.html" aria-label="${esc(j.bike)}, ${esc(j.jobTitle)}, ${esc(j.customer)}, Pending, ${esc(j.detail)}" title="${esc(j.bike)} · ${esc(j.jobTitle)} · ${esc(j.customer)} · Pending · ${esc(j.detail)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px ${SHOW_STATUS_SYMBOLS ? 16 : 6}px 3px 6px; border-radius: 5px; background: ${bg}; border: 1.75px solid ${ink}; overflow: hidden; ${ring}">
${SHOW_STATUS_SYMBOLS ? statusDot('pending') : ''}
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.bike)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.jobTitle)}</span>
</a>`;
}
// A dashed outline showing where a change request asked to move to (Oliver
// Chen's Brompton, Mon 10:00 → 14:00); the job itself stays drawn at 10:00.
function requestedOutlineBlock(size, slotH, highlighted = false) {
  if (size !== 'desktop') return touchOutlineBlock(size, slotH, highlighted);
  const j = REQUEST_OUTLINE;
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(${C.highlightRgb},0.55);` : '';
  // Item 2 (27 Sep round 2): "Brompton C Line · Requested 14:00" — the bike,
  // not the customer's name (kept in the aria-label for context).
  return `<a href="change-selected-${size}.dc.html" aria-label="${esc(j.person)} asked to move to ${esc(j.label)}" title="${esc(j.person)} · ${esc(j.label)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box; border-radius: 5px; border: 1.5px dashed ${ST.hold[1]}; background: ${ST.hold[0]}; color: ${ST.hold[1]}; font-size: 10px; font-weight: 700; overflow: hidden; text-align: center; ${ring}">${esc(j.bike)} · ${esc(j.label)}</a>`;
}
// Item 44 (decision 44): a connector line from Oliver Chen's original block
// (WH-1052, Mon 10:00) down to the dashed "requested 14:00" outline, so the
// move reads at a glance rather than as two unrelated blocks. Two ordinary
// jobs (WH-1050, WH-1053) sit in the same column between 11:00 and 13:00, so
// the line hugs the slim 3px gutter to the left of every block (every block
// insets left: 3px) the whole way down — it never crosses a block's fill or
// text. aria-hidden: the surrounding card/pop-up text already says
// "Mon 10:00 → 14:00".
let requestConnectorSeq = 0;
// Decision 56 (29 Sep): the connector is a smooth curved arrow, not a
// straight line — it bows out to the side (into the gutter/next column)
// rather than running straight down through the two ordinary jobs sitting
// between Mon 10:00 and 14:00, and it animates in ("draws itself") the first
// time the Change requested card is clicked, per the reference swoosh Jack
// attached. The curve is built in a fixed local coordinate space (0..W)
// centred on the block's own horizontal middle, wider than a single Week
// column, with the surrounding <svg> given overflow: visible — the actual
// bow happens outside the column's own box, into the gutter, not by scaling
// path coordinates as percentages (which SVG path data doesn't support).
function requestConnector(size, slotH, highlighted = false) {
  // Jack, 28 Sep: the arrow shows only when the Change requested card is
  // clicked, and runs from the middle of the original job to the middle of
  // the requested time, drawn over any jobs in between (with a light halo so
  // it stays readable on top of them).
  if (!highlighted) return '';
  const from = JOBS.find((j) => j.job === 'WH-1052');
  const fromTop = ((from.start - GRID_START) / 30) * slotH + 2;
  const fromH = Math.max((from.dur / 30) * slotH - 4, slotH - 6);
  const fromMid = fromTop + fromH; // middle of the original job's bottom edge (Jack: don't cover the box's contents)
  const toTop = ((REQUEST_OUTLINE.start - GRID_START) / 30) * slotH + 2;
  const toH = Math.max((REQUEST_OUTLINE.dur / 30) * slotH - 4, slotH - 6);
  const toMid = toTop; // middle of the requested slot's top edge
  const h = toMid - fromMid;
  if (h <= 8) return '';
  const stroke = ST.hold[1];
  const seq = size === "desktop" ? requestConnectorSeq++ : devSeq++;
  const lineCls = `req-arrow-line-${size}-${seq}`;
  const headCls = `req-arrow-head-${size}-${seq}`;
  const drawKf = `reqArrowDraw${size}${seq}`;
  const headKf = `reqArrowHead${size}${seq}`;
  const W = 132; // local coordinate width — wider than a Week column so the bow reads clearly beyond the column's own edge
  const cx = W / 2; // the block's own horizontal middle (start/end x)
  const bow = 46; // how far the curve bows out towards the gutter/next column
  const bendX = cx + bow;
  const endY = h - 2;
  const c1y = h * 0.32, c2y = h * 0.68;
  const path = `M${cx},0 C${bendX.toFixed(1)},${c1y.toFixed(1)} ${bendX.toFixed(1)},${c2y.toFixed(1)} ${cx},${endY.toFixed(1)}`;
  // Arrowhead: a small triangle, tip at the curve's end point, rotated to
  // match the curve's tangent there (the last control point → end vector) so
  // it points the way the line is actually travelling as it lands on the
  // requested slot, not straight down.
  const dx = -bow, dy = endY - c2y;
  const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 ${W} ${h}" style="position: absolute; left: 50%; top: ${fromMid}px; width: ${W}px; height: ${h}px; margin-left: ${-cx}px; overflow: visible; pointer-events: none; z-index: 5">
<style>
.${lineCls}{stroke-dasharray: 1000; stroke-dashoffset: 0;}
.${headCls}{opacity: 1;}
@media (prefers-reduced-motion: no-preference) {
  .${lineCls}{animation: ${drawKf} 0.8s ease-out;}
  .${headCls}{opacity: 0; animation: ${headKf} 0.25s ease-out 0.65s forwards;}
  @keyframes ${drawKf} { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
  @keyframes ${headKf} { from { opacity: 0; } to { opacity: 1; } }
}
</style>
<circle cx="${cx}" cy="0" r="4" fill="${stroke}"/>
<path d="${path}" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.85"/>
<path class="${lineCls}" pathLength="1000" d="${path}" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
<path class="${headCls}" d="M0,-6.5 L6,4.5 L-6,4.5 Z" fill="${stroke}" transform="translate(${cx},${endY}) rotate(${angleDeg.toFixed(1)})"/>
</svg>`;
}
function combinedBlock(cluster, size, slotH, faded = false) {
  const start = Math.min(...cluster.map((j) => j.start));
  const end = Math.max(...cluster.map((j) => j.start + j.dur));
  const top = ((start - GRID_START) / 30) * slotH + 2;
  const h = Math.max(((end - start) / 30) * slotH - 4, slotH - 6);
  // Item 2 (27 Sep round 2): a combined block lists bike · job title per job.
  const names = cluster.map((j) => `${customerBikeOf(j)[1]} · ${j.svc || ''} (${j.job})`).join(', ');
  const t0 = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
  const t1 = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  return `<a href="job-overview-${size}.dc.html" aria-label="${cluster.length} jobs booked ${t0} to ${t1}: ${esc(names)}" title="${esc(names)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 6px; border-radius: 5px; background: ${C.mutedBg}; border: 1.75px solid ${C.ink}; overflow: hidden; ${faded ? 'opacity: 0.5;' : ''}">
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${cluster.length} jobs · ${t0}</span>
${cluster.map((j) => `<span style="font-size: 10px; font-weight: 600; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(customerBikeOf(j)[1])} · ${esc(j.svc || '')}</span>`).join('')}
</a>`;
}
// S4 (decision 58/59, 29 Sep audit): a stacked-card look for jobs sharing
// one start time — two thin card edges peeking out behind the front job's
// block (offset up/right, lower z-index, no text of their own) plus a small
// count badge with a chevron, so the shape itself reads "there's more
// underneath, click to choose" instead of the plain "2 jobs · 09:00" caption
// idea-s4-before still records. This is now the live diary's default
// (weekGrid's overlapStyle option below); idea-s4-before still builds the
// old combinedBlock caption directly, not through here.
// rect: a lane rect (laneRect()) when this stack shares its cluster's width
// with a partial overlap (decision 59) — null for the ordinary full-width
// case. forceExpand: bakes in the hover-expanded fan-out state without
// relying on CSS :hover — used by the diary-stack-hover static board (task
// item 3) so Jack can see the expanded state without hovering.
function stackedJobsBlock(cluster, size, slotH, faded = false, rect = null, forceExpand = false) {
  if (size !== 'desktop') return touchStackBlock(cluster, size, slotH, { faded, rect, forceExpand });
  const start = Math.min(...cluster.map((j) => j.start));
  const end = Math.max(...cluster.map((j) => j.start + j.dur));
  const top = ((start - GRID_START) / 30) * slotH + 2;
  const h = Math.max(((end - start) / 30) * slotH - 4, slotH - 6);
  const names = cluster.map((j) => `${customerBikeOf(j)[1]} · ${j.svc || ''} (${j.job})`).join(', ');
  const t0 = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
  const t1 = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  const front = cluster[0];
  const [, frontBike] = customerBikeOf(front);
  // Local coordinates (0,0 = this wrapper's own top-left corner — the
  // wrapper is already placed at the cluster's real top/height in the
  // column), not the column-relative `top` used to place the wrapper
  // itself: reusing that here previously double-applied it, pushing the
  // card edges and link hundreds of px below the wrapper's own box and
  // inflating the whole grid's scrollHeight (caught by the strict fit check).
  const edge = (offset, op) => `<div aria-hidden="true" style="position: absolute; left: ${offset}px; right: ${-offset}px; top: ${-offset}px; bottom: 0; border-radius: 5px; background: ${C.panel}; border: 1.75px solid ${C.ink}; opacity: ${op}"></div>`;
  const posStyle = rect ? `left: ${rect.left}; width: ${rect.width};` : 'left: 3px; right: 3px;';
  // Decision 61: hovering the stack ~300ms lifts it and fans its jobs out as
  // full-size diary blocks, centred on the stack's own day — two jobs sit one
  // left, one right of centre; three or more sit at most two per row side by
  // side, with each further pair on a row underneath (a small grid growing
  // downwards) rather than fanning out to the right. The day column itself
  // has no overflow:hidden — only the outer grid does — so the fan can still
  // spill sideways into a neighbouring day's column without being clipped.
  const seq = nextSeq(size);
  const wrapCls = `wh-stack-${size}-${seq}`;
  const fanCls = `wh-fan-${size}-${seq}`;
  const fanTile = (j) => {
    const [tbg, tink] = ST[j.key];
    const [, tbike] = customerBikeOf(j);
    const th = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
    return `<a href="job-overview-${size}.dc.html" aria-label="${esc(tbike)}, ${esc(j.svc || '')}, ${esc(j.job)}" style="position: relative; width: 128px; height: ${th}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 6px; border-radius: 5px; background: ${tbg}; border: 1.75px solid ${tink}; overflow: hidden">
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(tbike)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${tink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.svc || '')}</span>
<span style="font-size: 9px; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.job)}</span>
</a>`;
  };
  // Decision 61: a 2-column grid (128px tiles, 6px gap), centred under the
  // stack's own middle via left:50%/negative margin-left rather than flush
  // left — that's what puts the first pair one-left/one-right of centre
  // instead of fanning off to the right, and rows of a longer stack grow
  // downward from there.
  const fanCols = Math.min(cluster.length, 2);
  const fanW = fanCols === 2 ? 128 * 2 + 6 : 128;
  // overflow:hidden + max-width:0 on the collapsed (non-hover, non-
  // forceExpand) state, not just opacity:0 — the fan's tiles are real
  // fixed-width content, and an invisible-but-still-laid-out row would still
  // report as overflowing its column to the project's fit check even though
  // nothing is visible. Collapsed, this element clips both axes, so the
  // check's own "intentional clipping" rule skips it outright, exactly as
  // it does for any other genuinely-clipped element.
  const fanStyle = forceExpand
    ? 'opacity: 1; pointer-events: auto; overflow: visible; max-width: none; filter: drop-shadow(0 10px 26px rgba(28,30,25,0.32));'
    : 'opacity: 0; pointer-events: none; overflow: hidden; max-width: 0;';
  const fan = `<div class="${fanCls}" aria-hidden="${!forceExpand}" style="position: absolute; left: 50%; margin-left: ${-(fanW / 2)}px; top: 0; display: grid; grid-template-columns: repeat(${fanCols}, 128px); grid-auto-rows: max-content; gap: 6px; ${fanStyle}">${cluster.map(fanTile).join('')}</div>`;
  // No resting z-index here either, for the same reason as laneHoverCSS —
  // only :hover raises it.
  const hoverCSS = forceExpand ? '' : `<style>
.${wrapCls} .${fanCls}{opacity: 0; pointer-events: none; overflow: hidden; max-width: 0;}
.${wrapCls}:hover{z-index: 9;}
.${wrapCls}:hover .${fanCls}{opacity: 1; pointer-events: auto; overflow: visible; max-width: none; filter: drop-shadow(0 10px 26px rgba(28,30,25,0.32));}
@media (prefers-reduced-motion: no-preference) {
  .${wrapCls} .${fanCls}{transition: opacity 160ms ease;}
  .${wrapCls}:hover .${fanCls}{transition-delay: 300ms;}
}
</style>`;
  // forceExpand has no :hover rule to raise z-index for it (hoverCSS is
  // skipped), so it's set directly inline here — otherwise a later day
  // column in DOM order (e.g. Friday, painted after Thursday) would paint
  // over the fanned-out tiles instead of the fan sitting above it.
  const wrapZ = forceExpand ? 'z-index: 9;' : '';
  return `${hoverCSS}<div class="${wrapCls}" style="position: absolute; ${posStyle} top: ${top}px; height: ${h}px; ${wrapZ} ${faded ? 'opacity: 0.5;' : ''}">
${edge(6, 0.45)}
${edge(3, 0.7)}
<a href="job-overview-${size}.dc.html" aria-label="${cluster.length} jobs booked ${t0} to ${t1}, click to choose which one to open: ${esc(names)}" title="${esc(names)}" style="position: absolute; inset: 0; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 22px 3px 6px; border-radius: 5px; background: ${C.panel}; border: 1.75px solid ${C.ink}; overflow: hidden">
<span style="position: absolute; top: 3px; right: 3px; display: inline-flex; align-items: center; gap: 1px; padding: 1px 5px; border-radius: 999px; background: ${C.ink}; color: ${C.panel}; font-size: 9px; font-weight: 700">${cluster.length}<span style="display: inline-flex; transform: rotate(90deg)">${icon('chevron', 9, C.panel)}</span></span>
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(frontBike)}</span>
<span style="font-size: 10px; font-weight: 600; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(front.svc || '')} · ${t0}</span>
</a>
${fan}
</div>`;
}
// The New job pick target (item 2 of the 27 Sep round, replaces the old
// dashed "+ New job" slot hint everywhere — decision 22). Shown only on
// new-job-pick, over the free slot the pointer would click; solid (not
// dashed) so it reads as a hover target rather than an always-on hint.
function pickHintSlot(size, slotH, top, label, href) {
  if (size !== 'desktop') return `<a href="${href}" aria-label="Choose ${esc(label)} for the new job" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${slotH - 4}px; text-decoration: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0 4px; border-radius: 6px; border: 1.5px solid ${C.accent}; background: ${C.accent}; color: #ffffff; font-size: ${size === 'phone' ? 14 : 12}px; font-weight: 700; box-shadow: 0 0 0 4px rgba(${C.highlightRgb},0.4)"><span style="min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(label)}</span></a>`;
  return `<a href="${href}" aria-label="Choose ${esc(label)} for the new job" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${slotH - 4}px; text-decoration: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 5px; border: 1.5px solid ${C.accent}; background: ${C.accent}; color: #ffffff; font-size: 11px; font-weight: 700; box-shadow: 0 0 0 4px rgba(${C.highlightRgb},0.4)">${esc(label)}</a>`;
}
// The day-view grid (brief item 18 / decision 18): one column per mechanic,
// same time rows as the week view. No "Not assigned" column — every job in the
// example week already has a mechanic, and the "No time" row above already
// covers bikes with no set time, so a permanently-empty column would show
// nothing real; add it when there is an actual unassigned job to show.
// Renders one overlap cluster (decision 59): each same-start unit as a
// stacked-card control (full lane width when it has the column to itself,
// a shared lane width when it doesn't); units that overlap without sharing
// a start get their own lane, side by side, at their own true start/end
// (calendar style). `forceExpandStart`: the start time (minutes) of the one
// unit to render pre-expanded (diary-stack-hover, task item 3) — null for
// the ordinary hover-driven behaviour everywhere else.
function renderCluster(cluster, size, slotH, { highlightJob = null, faded = false, forceExpandStart = null, narrow = true } = {}) {
  const units = layoutOverlap(cluster);
  return units.map((u) => {
    const rect = laneRect(u.lane, u.total);
    if (u.jobs.length === 1) {
      const j = u.jobs[0];
      return jobBlock(j, size, slotH, highlightJob?.type === 'job' && j.job === highlightJob.job, highlightJob?.dim === j.job, faded, narrow, rect);
    }
    return stackedJobsBlock(u.jobs, size, slotH, faded, rect, forceExpandStart !== null && u.start === forceExpandStart);
  }).join('');
}
const DAY_MECHS = [['Alex', 'Alex Morgan'], ['Jo', 'Jo Taylor']];
function dayMechGrid({ dayIdx, size, slotH = 29, highlightJob = null }) {
  const T = size !== 'desktop';
  const gridH = GRID_SLOTS * slotH;
  const hourLabels = Array.from({ length: 9 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
  const cols = `44px repeat(${DAY_MECHS.length}, minmax(0, 1fr))`;
  const header = (m, name, i) => `<div style="grid-column: ${i + 2}; grid-row: 1; box-sizing: border-box; padding: 6px 8px; border-bottom: 1px solid ${C.border}; ${i ? `border-left: 1px solid ${C.border};` : ''} background: ${C.panel}; display: flex; align-items: center; justify-content: center">
<span style="font-size: 14px; font-weight: 700; color: ${C.ink}">${esc(name)}</span></div>`;
  const col = (m, i) => {
    const items = JOBS.filter((j) => j.day === dayIdx && j.mech === m);
    const clusters = clusterOverlaps(items);
    // Decision 59: the day grid gets the same stacked-card/lane treatment as
    // the week grid (one mechanic's own column never actually overlaps in
    // this example data, but a same-start pair from a shared "Everyone"
    // filter elsewhere in the diary can still land here in future data).
    const blocks = clusters.map((c) => renderCluster(c, size, slotH, { highlightJob, narrow: false })).join('');
    return `<div style="grid-column: ${i + 2}; grid-row: 2; position: relative; height: ${gridH}px; ${i ? `border-left: 1px solid ${C.border};` : ''} background: repeating-linear-gradient(to bottom, transparent 0, transparent ${slotH * 2 - 1}px, ${C.border} ${slotH * 2 - 1}px, ${C.border} ${slotH * 2}px)">${blocks}</div>`;
  };
  return `<div role="grid" aria-label="Workshop diary, Thursday 17 September 2026, by mechanic" style="flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: ${cols}; grid-template-rows: auto ${gridH}px; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; background: ${C.panel}">
<div style="grid-column: 1; grid-row: 1; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}"></div>
${DAY_MECHS.map(([m, name], i) => header(m, name, i)).join('')}
<div style="grid-column: 1; grid-row: 2; position: relative; height: ${gridH}px; background: ${C.mutedBg}">${hourLabels.map((t, i) => `<span style="position: absolute; top: ${i * 2 * slotH - (T ? 7 : 6)}px; right: 4px; font-family: ${MONO}; font-size: ${T ? 12 : 10}px; color: ${C.muted}">${t}</span>`).join('')}</div>
${DAY_MECHS.map(([m], i) => col(m, i)).join('')}
</div>`;
}
// Freezes the day view behind a pop-up opened from it (new-job-day) — the
// day-view equivalent of diaryFrozenContent.
function diaryDayFrozenContent(size, { highlightJob = null } = {}) {
  if (size !== 'desktop') return tabletDiaryContent({ activeView: 'Day', highlightJob, newJob: 'new-job-day-tablet.dc.html' });
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { activeView: 'Day', newJob: `new-job-day-${size}.dc.html` })}
${row(`${waitingColumn(size, -1)}${dayMechGrid({ dayIdx: TODAY, size, slotH, highlightJob })}`, 16, 'align-items: flex-start')}`, 12);
}
// overlapStyle: 'stacked' (decision 58/59, the live diary's default —
// stacked-card control for same-start overlaps, lanes for partial overlaps)
// or 'text' (idea-s4-before's old record — combinedBlock's plain "N jobs ·
// time" caption). Exported so audit-ideas.mjs can build faithful before/
// after boards with the real grid, not a re-drawn approximation of it.
// forceExpandStack: { day, start } — pre-expands one stacked-card control
// without relying on CSS :hover (diary-stack-hover, task item 3).
export function weekGrid({ days, size, slotH = 29, mechFilter = 'Everyone', selectSlot = null, highlightJob = null, pickMode = false, overlapStyle = 'stacked', forceExpandStack = null, overlayFor = null }) {
  // Decision 68: T = a touch board (tablet). Labels step up to the 12px floor;
  // desktop output is unchanged (every T ternary resolves to the old literal).
  const T = size !== 'desktop';
  const gridH = GRID_SLOTS * slotH;
  const hourLabels = Array.from({ length: 9 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
  const cols = `44px repeat(${days.length}, minmax(0, 1fr))`;
  const dayHeader = (d, i) => {
    const [name, date] = DAYS[d]; const isToday = d === TODAY;
    return `<div style="grid-column: ${i + 2}; grid-row: 1; box-sizing: border-box; padding: 6px 8px; border-bottom: 1px solid ${C.border}; ${i ? `border-left: 1px solid ${C.border};` : ''} background: ${isToday ? C.mutedBg : C.panel}; display: flex; flex-direction: column; align-items: center">
<span style="font-size: ${T ? 12 : 11}px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.4px">${name}</span>
<span style="font-size: 14px; font-weight: 700; color: ${isToday ? C.accentDark : C.ink}">${date}${isToday ? ' · Today' : ''}</span>
</div>`;
  };
  const unschedRow = `<div style="grid-column: 2 / span ${days.length}; grid-row: 2; box-sizing: border-box; padding: 4px 8px; border-bottom: 1px solid ${C.border}; display: flex; flex-wrap: wrap; gap: 5px; min-height: 26px; align-items: center; overflow: hidden">${UNSCHEDULED.map((u) => `<a href="job-overview-${size}.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: ${ST.scheduled[0]}; color: ${ST.scheduled[1]}; font-size: ${T ? 12 : 11}px; font-weight: 700; white-space: nowrap${T ? '; min-height: 24px; box-sizing: border-box; border: 1px solid ' + ST.scheduled[1] : ''}">${esc(u.job)} · ${esc(u.title)}</a>`).join('')}</div>`;
  const dayColumn = (d, i) => {
    const items = JOBS.filter((j) => j.day === d && (mechFilter === 'Everyone' || j.mech === mechFilter));
    // Pick mode (new-job-pick, item 2): the pointer's slot shows as a solid
    // hover target; every busy block in the grid fades back so the free grid
    // reads as clickable (decision 22 drops the old always-on "+ New job" hint).
    const isPickSlot = pickMode && selectSlot && d === selectSlot.day && (mechFilter === 'Everyone' || mechFilter === selectSlot.mech);
    const pickHint = isPickSlot ? pickHintSlot(size, slotH, ((selectSlot.start - GRID_START) / 30) * slotH + 2, selectSlot.label || '10:00', `new-job-${size}.dc.html`) : '';
    const clusters = clusterOverlaps(items);
    const forceExpandStart = forceExpandStack && d === forceExpandStack.day ? forceExpandStack.start : null;
    const blocks = overlapStyle === 'stacked'
      ? clusters.map((c) => renderCluster(c, size, slotH, { highlightJob, faded: pickMode, forceExpandStart })).join('')
      : clusters.map((c) => (c.length === 1 ? jobBlock(c[0], size, slotH, highlightJob?.type === 'job' && c[0].job === highlightJob.job, highlightJob?.dim === c[0].job, pickMode) : combinedBlock(c, size, slotH, pickMode))).join('');
    // Decision 12: the pending request sits in its slot, Everyone view only (no mechanic yet).
    const pending = mechFilter === 'Everyone' && d === PENDING_DIARY.day ? pendingBlock(size, slotH, highlightJob?.type === 'pending') : '';
    const outline = mechFilter === 'Everyone' && d === REQUEST_OUTLINE.day ? requestedOutlineBlock(size, slotH, highlightJob?.type === 'outline') : '';
    const connector = mechFilter === 'Everyone' && d === REQUEST_OUTLINE.day ? requestConnector(size, slotH, highlightJob?.type === 'outline') : '';
    const tint = pickMode ? `linear-gradient(rgba(${C.highlightRgb},0.08), rgba(${C.highlightRgb},0.08)), ` : '';
    return `<div style="grid-column: ${i + 2}; grid-row: 3; position: relative; height: ${gridH}px; ${i ? `border-left: 1px solid ${C.border};` : ''} ${pickMode ? 'cursor: pointer;' : ''} background: ${tint}repeating-linear-gradient(to bottom, transparent 0, transparent ${slotH * 2 - 1}px, ${C.border} ${slotH * 2 - 1}px, ${C.border} ${slotH * 2}px)">${blocks}${pickHint}${pending}${outline}${connector}${overlayFor && overlayFor.day === d ? overlayFor.html : ''}</div>`;
  };
  return `<div role="grid" aria-label="Workshop diary, week of Monday 14 September 2026" style="flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: ${cols}; grid-template-rows: auto auto ${gridH}px; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; background: ${C.panel}">
<div style="grid-column: 1; grid-row: 1; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}"></div>
${days.map((d, i) => dayHeader(d, i)).join('')}
<div style="grid-column: 1; grid-row: 2; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}; font-size: ${T ? 12 : 9}px; font-weight: 700; color: ${C.muted}; text-align: center; padding-top: 3px; line-height: 1.1">No<br>time</div>
${unschedRow}
<div style="grid-column: 1; grid-row: 3; position: relative; height: ${gridH}px; background: ${C.mutedBg}">${hourLabels.map((t, i) => `<span style="position: absolute; top: ${i * 2 * slotH - (T ? 7 : 6)}px; right: 4px; font-family: ${MONO}; font-size: ${T ? 12 : 10}px; color: ${C.muted}">${t}</span>`).join('')}</div>
${days.map((d, i) => dayColumn(d, i)).join('')}
</div>`;
}
// Week/Day are real links between the week grid (diary-<size>) and the day
// view (diary-day-<size>) — brief item 18. Decision 60: drawn as one joined
// segmented switch (a tablist) rather than two separate buttons, so it reads
// as a single control with two positions, distinct in shape from the date
// arrows and the mechanic chips either side of it in the toolbar.
function viewSwitch(active, size) {
  const items = [['Week', `diary-${size}.dc.html`], ['Day', `diary-day-${size}.dc.html`]];
  return `<div role="tablist" aria-label="Diary view" style="display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; box-sizing: border-box; min-height: 44px; padding: 3px; border-radius: 10px; background: ${C.mutedBg}">${items.map(([t, href]) => {
    const on = t === active;
    return `<a href="${href}" role="tab" aria-selected="${on}" style="min-height: ${size === 'desktop' ? 38 : 44}px; padding: 0 16px; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; text-decoration: none; background: ${on ? C.panel : 'transparent'}; color: ${C.ink}; ${on ? 'box-shadow: 0 1px 2px rgba(0,0,0,0.14);' : ''}">${t}</a>`;
  }).join('')}</div>`;
}
// Decision 60: Previous/Next as small icon-only arrow buttons either side of
// the date range text, with Today as a small text button beside them —
// replaces the old three-way "‹ Prev / Today / Next ›" segmented control,
// which read as the same shape/size as the view switch and mechanic filter.
// The chevron icon points down; rotating it ±90deg gives left/right arrows
// without adding new icon paths to ui.mjs.
const dateArrow = (dir, label) => `<button type="button" aria-label="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.input}; background: transparent; color: ${C.ink}"><span style="display: inline-flex; transform: rotate(${dir === 'prev' ? 90 : -90}deg)">${icon('chevron', 18)}</span></button>`;
// activeView picks both the date-range text and the aria-labels' unit (week
// view shows the 7-day range; day view — always TODAY, Thursday 17, per the
// day grid below — shows the one day). Both labels are drawn once here so
// every toolbar (diary, diary-day, the diary frozen behind a pop-up, the
// mechanic diary, pick mode) shows the same text.
function dateNav(activeView, size = 'desktop') {
  const isDay = activeView === 'Day';
  const label = isDay ? 'Thursday 17 September' : '14–20 September 2026';
  const unit = isDay ? 'day' : 'week';
  return `<div style="display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0">${dateArrow('prev', `Previous ${unit}`)}
<span style="min-width: ${isDay ? 146 : 164}px; text-align: center; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap">${esc(label)}</span>
${dateArrow('next', `Next ${unit}`)}
<button type="button" style="min-height: ${size === 'desktop' ? 36 : 44}px; padding: 0 10px; margin-left: 2px; border-radius: 6px; font-family: inherit; font-size: ${size === 'desktop' ? 13 : 14}px; font-weight: 600; border: 1px solid transparent; background: transparent; color: ${C.ink}">Today</button></div>`;
}
// Decision 60: the mechanic filter drawn as "people chips" — a small round
// initial badge (or a group icon for "Everyone") plus the name, lightly
// tinted (never solid black) when selected and outlined when not — so it
// reads as a filter, not another button matching the view switch or date
// arrows. Reused for the mechanic diary's Me/Everyone switch (decision 13).
const CHIP_TEXT = { Everyone: 'Everyone', Alex: 'Alex', Jo: 'Jo', Me: 'Me' };
const CHIP_INITIAL = { Everyone: 'group', Alex: 'A', Jo: 'J', Me: 'M' };
function personChip(key, active, size = 'desktop') {
  const initial = CHIP_INITIAL[key] || key[0];
  const badgeInk = active ? C.accentSoftInk : C.muted;
  const badgeBg = active ? '#ffffff' : C.mutedBg;
  const badge = initial === 'group'
    ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: ${badgeBg}; color: ${badgeInk}; flex-shrink: 0">${icon('customers', 13)}</span>`
    : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: ${badgeBg}; color: ${badgeInk}; font-size: ${size === 'desktop' ? 11 : 12}px; font-weight: 700; flex-shrink: 0">${esc(initial)}</span>`;
  return `<button type="button" aria-pressed="${active}" style="display: inline-flex; align-items: center; gap: 7px; min-height: 44px; box-sizing: border-box; padding: 5px 14px 5px 5px; border-radius: 999px; font-family: inherit; font-size: 13px; font-weight: 600; border: 1px solid ${active ? 'transparent' : C.input}; background: ${active ? C.accentSoft : C.panel}; color: ${active ? C.accentSoftInk : C.ink}">${badge}${esc(CHIP_TEXT[key] || key)}</button>`;
}
function mechChips(selectedKey, keys, label, size = 'desktop') {
  return `<div role="group" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; flex-shrink: 0">${keys.map((k) => personChip(k, k === selectedKey, size)).join('')}</div>`;
}
// Decision 66: a plain radio pill for a short/grouped choice on a form (work,
// starting status, storage hook) — same shape as the toolbar's person chips
// (tinted, never solid, when selected) but with real role="radio" semantics,
// since these sit in a radiogroup on a form rather than a toggling filter.
// minH: 44px (a full touch target) by default; the New job form's work/
// status/storage pills (decision 66 doesn't mandate 44px the way decision
// 62 does for the mechanic pills) use a slightly shorter 36px so the whole
// branching form still fits its pop-up without scrolling.
function radioPill(labelText, active, extra = '', minH = 44) {
  return `<span role="radio" aria-checked="${active}" tabindex="${active ? '0' : '-1'}" style="display: inline-flex; align-items: center; justify-content: center; min-height: ${minH}px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; border: 1px solid ${active ? 'transparent' : C.input}; background: ${active ? C.accentSoft : C.panel}; color: ${active ? C.accentSoftInk : C.ink}; ${extra}">${esc(labelText)}</span>`;
}
const formPill = (labelText, active) => radioPill(labelText, active, '', 36);
// label/options: options is an array of plain strings; pillFn overrides how
// each option renders (used by the mechanic pills below, which add an
// avatar-style badge) — radioPill above is the default.
function pillRadioGroup(labelText, options, selectedIdx, groupId, pillFn = (o, active) => radioPill(o, active)) {
  return `<div style="display: flex; flex-direction: column; gap: 5px">
<span id="${groupId}-label" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(labelText)}</span>
<div role="radiogroup" aria-labelledby="${groupId}-label" style="display: flex; flex-wrap: wrap; gap: 5px">${options.map((o, i) => pillFn(o, i === selectedIdx)).join('')}</div>
</div>`;
}
// Decision 62: choosing the mechanic on a booking request is pills, not a
// select — the shop's mechanics plus the shared queue, styled like the
// toolbar's person chips (initial badge + name, tinted when selected).
const MECH_PILL_OPTIONS = [['Alex', 'A'], ['Jo', 'J'], ['Shared queue', 'group']];
function mechanicPill(key, initial, active, size = 'desktop') {
  const badgeInk = active ? C.accentSoftInk : C.muted;
  const badgeBg = active ? '#ffffff' : C.mutedBg;
  const badge = initial === 'group'
    ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: ${badgeBg}; color: ${badgeInk}; flex-shrink: 0">${icon('customers', 13)}</span>`
    : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: ${badgeBg}; color: ${badgeInk}; font-size: ${size === 'desktop' ? 11 : 12}px; font-weight: 700; flex-shrink: 0">${esc(initial)}</span>`;
  return `<span role="radio" aria-checked="${active}" tabindex="${active ? '0' : '-1'}" style="display: inline-flex; align-items: center; gap: 7px; min-height: 44px; box-sizing: border-box; padding: 5px 14px 5px 5px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid ${active ? 'transparent' : C.input}; background: ${active ? C.accentSoft : C.panel}; color: ${active ? C.accentSoftInk : C.ink}">${badge}${esc(key)}</span>`;
}
function mechanicPillGroup(size, selectedKey = 'Shared queue') {
  const groupId = 'req-new-mech-' + size;
  return `<div style="display: flex; flex-direction: column; gap: 6px">
<span id="${groupId}-label" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Mechanic</span>
<div role="radiogroup" aria-labelledby="${groupId}-label" style="display: flex; flex-wrap: wrap; gap: 6px">${MECH_PILL_OPTIONS.map(([key, initial]) => mechanicPill(key, initial, key === selectedKey, size)).join('')}</div>
</div>`;
}
// "New job" is a button in the diary toolbar, not a slot hint (decision 22).
// newJob is either an href (a plain link button) or the string 'active' (the
// pressed "Choose a time" state shown on new-job-pick while a slot is being chosen).
function newJobButton(href) {
  return button('New job', { variant: 'primary', iconName: 'plus', href });
}
function newJobButtonActive() {
  return `<button type="button" aria-pressed="true" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 11px 16px; border-radius: 6px; font-weight: 600; font-family: inherit; font-size: 15px; border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff">${icon('check', 16)}Choose a time</button>`;
}
// Default New job target for a frozen diary background (behind a request or
// job pop-up): the pick step (new-job-pick) at every size — decision 68
// gives tablet and phone the same "choose a time" step as desktop.
const defaultNewJobHref = (size) => `new-job-pick-${size}.dc.html`;
// Decision 60: each control gets its own shape, grouped left to right —
// view (segmented switch) · dates (arrows + label + Today) · people (chips)
// and New job, alone with a clear gap before it. Two flex-grow spacers put
// the date group in the middle of the space between the view switch and the
// people/New job cluster at the right; nowrap (not the old wrap) — the
// desktop board's width comfortably holds all four groups on one line.
function diaryToolbar(mechFilter, size, { mechOptions = ['Everyone', 'Alex', 'Jo'], activeView = 'Week', newJob = null } = {}) {
  const nj = newJob === 'active' ? newJobButtonActive() : newJob ? newJobButton(newJob) : '';
  return row(`${viewSwitch(activeView, size)}<div style="flex-grow: 1"></div>${dateNav(activeView, size)}<div style="flex-grow: 1"></div>${mechChips(mechFilter, mechOptions, 'Mechanic', size)}${nj ? `<div style="width: 20px; flex-shrink: 0"></div>${nj}` : ''}`, 0, 'flex-wrap: nowrap');
}


// ---------- Diary badges / note ----------
// H2 (29 Sep audit): this used to render as six near-invisible outlined
// squares — the swatch <span> had a `width`/`height`/`background` but no
// `display`, so as an inline element the browser ignored its box size
// entirely and only the border painted. Fixed with `display: inline-block`.
// Decision 57 (29 Sep): status is colour-only by default, so the swatch is
// just the tinted-fill/outline colour and the full word — no shape — unless
// SHOW_STATUS_SYMBOLS is on (the same flag jobBlock/pendingBlock use), in
// which case the swatch carries the same shape as the grid's blocks so the
// legend stays a literal key to what's drawn.
const diaryLegend = () => row(Object.entries({ scheduled: ST.scheduled, pending: ST.pending, hold: ST.hold, waiting: ST.waiting, ready: ST.ready, cancelled: ST.cancelled }).map(([k, [bg, ink, label]]) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${C.ink}"><span style="position: relative; display: inline-block; width: 14px; height: 14px; border-radius: 3px; background: ${bg}; border: 1.75px solid ${ink}; box-sizing: border-box; flex-shrink: 0">${SHOW_STATUS_SYMBOLS ? statusDot(k, 11).replace('top: 4px; right: 4px;', 'top: 1.5px; right: 1.5px;') : ''}</span>${label}</span>`).join(''), 16, 'flex-wrap: wrap');
// Decision 13: the mechanic's diary is the standard diary filtered to that
// mechanic, with one Me / Everyone switch in the normal toolbar position.
// Mechanics can't accept bookings, but they can create a walk-in job (chosen
// for this round — brief item 1 leaves it open) — so the mechanic diary gets
// the same New job button, going straight to the New job form (no pick flow
// for a mechanic's own single-column view this round).
function mechToolbar(meSelected, size, { newJob = null } = {}) {
  const nj = newJob ? newJobButton(newJob) : '';
  return row(`${viewSwitch('Week', size)}<div style="flex-grow: 1"></div>${dateNav('Week', size)}<div style="flex-grow: 1"></div>${mechChips(meSelected ? 'Me' : 'Everyone', ['Me', 'Everyone'], 'Whose diary', size)}${nj ? `<div style="width: 20px; flex-shrink: 0"></div>${nj}` : ''}`, 0, 'flex-wrap: nowrap');
}

// ============================================================================
// Tablet and phone (decision 68, 29 Sep): every desktop decision carried over
// to touch screens. Tablet = landscape 1180x820 with the charcoal icon rail;
// phone = 390x844 with a top bar. Hover becomes long-press; labels step up to
// the 12px floor; controls are at least 44px. Nothing here is used by a
// desktop board, so desktop output is untouched.
// ============================================================================
const touchFs = (size) => (size === 'phone' ? { b: 14, s: 13, x: 12 } : { b: 12, s: 12, x: 12 });
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const touchRing = (highlighted, lightMarked) => (highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(${C.highlightRgb},0.55);` : lightMarked ? `box-shadow: 0 0 0 2px ${C.muted};` : '');
// A diary block on a touch screen: bike, then job title (decision 29), status
// by colour alone (decision 57) — the status word is added only where a block
// is wide enough to spell it out (the tablet Day view), as on desktop. How
// many lines show is worked out from the block's real height so nothing is
// cut off mid-line.
function touchJobBlock(j, size, slotH, { highlighted = false, lightMarked = false, faded = false, narrow = true, rect = null } = {}) {
  const [bg, ink, statusWord] = ST[j.key];
  const [customer, bike] = customerBikeOf(j);
  const jobTitle = j.svc || '';
  const fs = touchFs(size);
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const lineH = Math.ceil(fs.b * 1.25);
  const fitLines = Math.max(1, Math.floor((h - 8) / lineH));
  const cancelled = j.key === 'cancelled';
  const strike = cancelled ? 'text-decoration: line-through;' : '';
  const slot = STORAGE[j.job];
  const extra = narrow ? slot || '' : [BLOCK_LABEL[j.key], slot].filter(Boolean).join(' · ');
  const one = (t, style) => `<span style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: ${lineH}px; ${style}">${esc(t)}</span>`;
  const bikeStyle = `font-size: ${fs.b}px; font-weight: 700; color: ${C.ink}; ${strike}`;
  const titleStyle = `font-size: ${fs.s}px; font-weight: 700; color: ${ink};`;
  let lines;
  if (fitLines <= 1) lines = one(`${bike} · ${jobTitle}`, bikeStyle);
  else if (fitLines === 2) lines = one(bike, bikeStyle) + one(narrow ? jobTitle : [jobTitle, BLOCK_LABEL[j.key]].join(' · '), titleStyle);
  else lines = one(bike, bikeStyle) + one(jobTitle, titleStyle) + (extra ? one(extra, `font-size: ${fs.x}px; color: ${C.ink}; opacity: 0.8; ${strike}`) : '');
  const posStyle = rect ? `left: ${rect.left}; width: ${rect.width};` : 'left: 3px; right: 3px;';
  const href = `${j.link || 'job-overview'}-${size}.dc.html`;
  return `<a href="${href}" aria-label="${esc(bike)}, ${esc(jobTitle)}, ${esc(customer)}, ${esc(j.job)}, ${esc(statusWord)}, ${esc(j.detail)}. Press and hold for more." style="position: absolute; ${posStyle} top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; box-sizing: border-box; padding: 3px 7px; border-radius: 6px; background: ${bg}; border: 1px solid ${ink}; overflow: hidden; ${cancelled ? 'opacity: 0.8;' : ''} ${faded ? 'opacity: 0.5;' : ''} ${touchRing(highlighted, lightMarked)}">${lines}</a>`;
}
function touchPendingBlock(size, slotH, highlighted = false) {
  const j = PENDING_DIARY;
  const [bg, ink] = ST.pending;
  const fs = touchFs(size);
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const lineH = Math.ceil(fs.b * 1.25);
  const two = h - 8 >= lineH * 2;
  const one = (t, style) => `<span style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: ${lineH}px; ${style}">${esc(t)}</span>`;
  return `<a href="request-new-${size}.dc.html" aria-label="${esc(j.bike)}, ${esc(j.jobTitle)}, ${esc(j.customer)}, Pending, ${esc(j.detail)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; box-sizing: border-box; padding: 3px 7px; border-radius: 6px; background: ${bg}; border: 1px solid ${ink}; overflow: hidden; ${touchRing(highlighted, false)}">${two ? one(j.bike, `font-size: ${fs.b}px; font-weight: 700; color: ${C.ink}`) + one(j.jobTitle, `font-size: ${fs.s}px; font-weight: 700; color: ${ink}`) : one(`${j.bike} · ${j.jobTitle}`, `font-size: ${fs.b}px; font-weight: 700; color: ${C.ink}`)}</a>`;
}
function touchOutlineBlock(size, slotH, highlighted = false) {
  const j = REQUEST_OUTLINE;
  const fs = touchFs(size);
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  return `<a href="change-selected-${size}.dc.html" aria-label="${esc(j.person)} asked to move to ${esc(j.label)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 2px 4px; border-radius: 6px; border: 1.5px dashed ${ST.hold[1]}; background: ${ST.hold[0]}; color: ${ST.hold[1]}; font-size: ${fs.x}px; line-height: 1.2; font-weight: 700; overflow: hidden; text-align: center; ${touchRing(highlighted, false)}"><span>${esc(j.bike)}</span><span>${esc(j.label)}</span></a>`;
}
// One stacked job drawn as a real diary block (decisions 59/61) — used by the
// long-press fan-out and the tap-to-choose sheet/popover.
function touchStackTile(j, size, slotH, width) {
  const [bg, ink] = ST[j.key];
  const [, bike] = customerBikeOf(j);
  const fs = touchFs(size);
  const th = Math.max((j.dur / 30) * slotH - 4, 56);
  return `<a href="job-overview-${size}.dc.html" aria-label="${esc(bike)}, ${esc(j.svc || '')}, ${esc(j.job)}, ${esc(ST[j.key][2])}" style="position: relative; ${width ? `width: ${width}px;` : ''} height: ${th}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 1px; box-sizing: border-box; padding: 5px 8px; border-radius: 6px; background: ${bg}; border: 1px solid ${ink}; overflow: hidden">
<span style="font-size: ${fs.b}px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(bike)}</span>
<span style="font-size: ${fs.s}px; font-weight: 700; color: ${ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.svc || '')}</span>
<span style="font-size: 12px; color: ${C.ink}; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.job)} · ${esc(hhmm(j.start))}–${esc(hhmm(j.start + j.dur))}</span>
</a>`;
}
// The stacked-card control on touch (decision 58/S4): tap opens the chooser
// (diary-stack-open); press and hold fans the jobs out in place, centred on
// the stack, two per row (decisions 59/61 — hover becomes long-press).
function touchStackBlock(cluster, size, slotH, { faded = false, rect = null, forceExpand = false } = {}) {
  const fs = touchFs(size);
  const start = Math.min(...cluster.map((j) => j.start));
  const end = Math.max(...cluster.map((j) => j.start + j.dur));
  const top = ((start - GRID_START) / 30) * slotH + 2;
  const h = Math.max(((end - start) / 30) * slotH - 4, slotH - 6);
  const names = cluster.map((j) => `${customerBikeOf(j)[1]} · ${j.svc || ''} (${j.job})`).join(', ');
  const front = cluster[0];
  const [, frontBike] = customerBikeOf(front);
  const edge = (offset, op) => `<div aria-hidden="true" style="position: absolute; left: ${offset}px; right: ${-offset}px; top: ${-offset}px; bottom: 0; border-radius: 6px; background: ${C.panel}; border: 1px solid ${C.ink}; opacity: ${op}"></div>`;
  const posStyle = rect ? `left: ${rect.left}; width: ${rect.width};` : 'left: 3px; right: 3px;';
  const tileW = size === 'phone' ? 146 : 150;
  const fanCols = Math.min(cluster.length, 2);
  const fanW = fanCols === 2 ? tileW * 2 + 8 : tileW;
  // The fanned jobs sit on a lifted tray (decision 61: centred on the stack, two
  // per row) so they read as picked up off the diary, not as more blocks in it.
  const fan = forceExpand ? `<div role="group" aria-label="${cluster.length} jobs at ${hhmm(start)}, fanned out" style="position: absolute; left: 50%; margin-left: ${-(fanW / 2) - 8}px; top: -8px; box-sizing: border-box; padding: 8px; border-radius: 10px; background: ${C.panel}; border: 1px solid ${C.border}; box-shadow: 0 14px 32px rgba(28,30,25,0.32); display: grid; grid-template-columns: repeat(${fanCols}, ${tileW}px); grid-auto-rows: max-content; gap: 8px; z-index: 2">${cluster.map((j) => touchStackTile(j, size, slotH, tileW)).join('')}</div>` : '';
  return `<div style="position: absolute; ${posStyle} top: ${top}px; height: ${h}px; ${forceExpand ? 'z-index: 9;' : ''} ${faded ? 'opacity: 0.5;' : ''}">
${edge(6, 0.45)}${edge(3, 0.7)}
<a href="diary-stack-open-${size}.dc.html" aria-label="${cluster.length} jobs booked ${hhmm(start)} to ${hhmm(end)}. Tap to choose which one to open; press and hold to fan them out: ${esc(names)}" style="position: absolute; inset: 0; text-decoration: none; color: inherit; display: flex; flex-direction: column; box-sizing: border-box; padding: 4px 34px 4px 7px; border-radius: 6px; background: ${C.panel}; border: 1px solid ${C.ink}; overflow: hidden">
<span style="position: absolute; top: 4px; right: 4px; display: inline-flex; align-items: center; gap: 2px; padding: 1px 5px 1px 7px; border-radius: 999px; background: ${C.ink}; color: ${C.panel}; font-size: 12px; font-weight: 700; line-height: 16px">${cluster.length}<span style="display: inline-flex; transform: rotate(90deg)">${icon('chevron', 11, C.panel)}</span></span>
<span style="font-size: ${fs.b}px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3">${esc(frontBike)}</span>
<span style="font-size: ${fs.s}px; font-weight: 600; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3">${esc(front.svc || '')} · ${hhmm(start)}</span>
</a>${fan}
</div>`;
}

// ---------- touch pieces shared by tablet and phone ----------
// The job's quick-look summary (decision 65's hover card; decision 37's
// content: notes, line items, cost — no customer details beyond the header).
// On touch it's what pressing and holding a job shows.
function touchSummaryContent(size, { twoCol = true } = {}) {
  const approvedTotal = LINES.filter((_, i) => DECISIONS[i][0] === 'Approved').reduce((sum, [, , a]) => sum + Number(a.replace('£', '')), 0);
  const notesCol = `<div style="display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; min-width: 0">
<span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: ${C.muted}">Notes</span>
${QUICK_NOTES.map((n) => `<div style="display: flex; flex-direction: column; gap: 1px">
<span style="font-size: 12px; font-weight: 700; color: ${C.muted}">${n.who === 'Customer' ? 'Customer' : `${esc(n.who)}${n.when ? ` · ${esc(n.when)}` : ''}`}</span>
<span style="font-size: 14px; line-height: 1.35; color: ${C.ink}">${esc(n.text)}</span>
</div>`).join('')}
</div>`;
  const itemsCol = `<div style="display: flex; flex-direction: column; gap: 6px; ${twoCol ? 'flex: 0 0 200px' : ''}">
<span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: ${C.muted}">Line items</span>
${LINE_ORDER.map((i) => { const [w, , a] = LINES[i]; const declined = DECISIONS[i][0] === 'Declined'; return `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; line-height: 1.3; ${declined ? `text-decoration: line-through; color: ${C.muted};` : ''}"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0">${w}</span>${mono(a, declined ? `color: ${C.muted}` : '')}</div>`; }).join('')}
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 3px; padding-top: 6px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; font-weight: 700; color: ${C.ink}">Cost</span>${mono(`£${approvedTotal.toFixed(2)}`, 'font-size: 16px; font-weight: 700')}</div>
</div>`;
  return twoCol ? `<div style="display: flex; gap: 18px; align-items: flex-start">${notesCol}${itemsCol}</div>` : `${notesCol}<div style="padding-top: 12px; border-top: 1px solid ${C.border}">${itemsCol}</div>`;
}
const SUMMARY_JOB = () => JOBS.find((j) => j.job === 'WH-1042');
function touchSummaryHeader(size) {
  const j = SUMMARY_JOB();
  const [customer, bike] = customerBikeOf(j);
  return `<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700; color: ${C.ink}">${esc(j.svc)} · ${esc(j.job)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(customer)} · ${esc(bike)}</span></div>`;
}
// The long-press menu (decision 37's right-click menu, decision 65: long-press
// on touch). Keep holding = the summary straight away (decision 37's "hold
// the right mouse button" on a touch screen).
function touchMenuItems(size, onKey = null) {
  const items = [['open', 'Open job', `job-overview-${size}.dc.html`], ['overview', 'View overview', `job-quick-overview-${size}.dc.html`]];
  return items.map(([k, label, href]) => `<a role="menuitem" href="${href}" style="display: flex; align-items: center; min-height: 48px; padding: 0 14px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; color: ${C.ink}; ${k === onKey ? `background: ${C.hover}; outline: 2px solid ${C.accent}; outline-offset: -2px;` : ''}">${esc(label)}</a>`).join('');
}
const TOUCH_MENU_TIP = 'Tip: keep holding to see the job’s summary straight away.';

// Phone bottom sheet over a dimmed page (the Waiting list, the long-press
// menu and summary, the stack chooser). Height is to content, capped.
function phoneSheet({ id, title, sub = '', body, footer = '', closeHref, maxH = 640, role = 'dialog' }) {
  return `<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45)"></div>
<div role="${role}" aria-modal="true" aria-labelledby="${id}" style="position: absolute; left: 0; right: 0; bottom: 0; max-height: ${maxH}px; box-sizing: border-box; display: flex; flex-direction: column; background: ${C.panel}; border-radius: 16px 16px 0 0; box-shadow: 0 -12px 40px rgba(28,30,25,0.3); overflow: hidden">
<div aria-hidden="true" style="display: flex; justify-content: center; padding: 8px 0 0"><span style="width: 40px; height: 4px; border-radius: 999px; background: ${C.border}"></span></div>
<header style="flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 6px 8px 10px 16px; border-bottom: 1px solid ${C.border}">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-top: 8px"><h2 id="${id}" style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 17px; font-weight: 700">${esc(title)}</h2>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${esc(sub)}</span>` : ''}</div>
<a href="${closeHref}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>
<div style="flex: 1 1 auto; min-height: 0; overflow: hidden; box-sizing: border-box; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">${body}</div>
${footer ? `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 16px 16px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 8px">${footer}</div>` : ''}
</div>`;
}

// ---------- Tablet diary (week/day grid with the Waiting column) ----------
// A Waiting for you card on touch (decision 14: the first tap highlights the
// job in the diary and shows Open; a second tap opens it). Same content as
// desktop at touch sizes; used in the tablet column and the phone sheet.
function touchWaitingCard(w, size, selected = false) {
  const [bg, ink, label] = ST[w.tone];
  const inner = `<span style="display: inline-flex; align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700">${esc(label)}</span>
<span style="font-size: 15px; font-weight: 700">${esc(w.customer)}</span>
<span style="font-size: 13px; color: ${C.muted}">${esc(w.bike)}</span>
<span style="font-size: 13px; color: ${C.ink}">${esc(w.detail)}</span>`;
  if (selected) {
    return `<div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 2px solid ${C.accent}; box-shadow: 0 0 0 3px rgba(${C.highlightRgb},0.45); background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 4px">${inner}</div>
<a href="${REQ_LINK[w.kind]}-${size}.dc.html" style="align-self: ${size === 'phone' ? 'stretch' : 'flex-start'}; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none">Open</a>
</div>`;
  }
  const selectHref = w.kind === 'Change request' ? `change-selected-${size}.dc.html` : `waiting-open-${size}.dc.html`;
  return `<a href="${selectHref}" style="display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}">${inner}</a>`;
}
// Tablet long-press results, drawn inside the job's own day column of the
// week grid (weekGrid's overlayFor), so they sit beside the pressed block.
const blockTopOf = (j, slotH) => ((j.start - GRID_START) / 30) * slotH + 2;
function tabletMenuPopover() {
  const j = SUMMARY_JOB();
  return `<div role="menu" aria-label="Job actions" style="position: absolute; left: calc(100% + 4px); top: ${blockTopOf(j, 30)}px; width: 236px; box-sizing: border-box; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28); padding: 6px; display: flex; flex-direction: column; gap: 2px; z-index: 12">
${touchMenuItems('tablet')}
<div style="padding: 8px 12px 4px; border-top: 1px solid ${C.border}; margin-top: 4px; font-size: 12px; line-height: 1.4; color: ${C.muted}">${TOUCH_MENU_TIP}</div>
</div>`;
}
function tabletSummaryPopover() {
  const j = SUMMARY_JOB();
  const colsAfter = DAYS.length - 1 - j.day;
  return `<div role="dialog" aria-label="Job summary" style="position: absolute; right: calc(${-100 * colsAfter}% + 8px); top: ${Math.max(4, blockTopOf(j, 30) - 24)}px; width: 480px; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(28,30,25,0.28); padding: 14px; display: flex; flex-direction: column; gap: 10px; z-index: 12">
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px">${touchSummaryHeader('tablet')}${button('Open job', { variant: 'default', href: 'job-overview-tablet.dc.html' })}</div>
${touchSummaryContent('tablet')}
</div>`;
}
function tabletStackPopover() {
  const cluster = JOBS.filter((j) => j.day === STACK_EXAMPLE.day && j.start === STACK_EXAMPLE.start);
  const tileW = 150;
  const popW = tileW * 2 + 8 + 20;
  const start = Math.min(...cluster.map((j) => j.start)), end = Math.max(...cluster.map((j) => j.start + j.dur));
  const top = ((start - GRID_START) / 30) * 30 + 2 + ((end - start) / 30) * 30 - 4 + 8;
  return `<div role="dialog" aria-label="Choose which job to open" style="position: absolute; left: 50%; margin-left: ${-popW / 2}px; top: ${top}px; width: ${popW}px; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(28,30,25,0.25); padding: 10px; display: flex; flex-direction: column; gap: 8px; z-index: 20">
<div style="padding: 2px 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${C.muted}">${cluster.length} jobs at ${hhmm(start)}</div>
<div style="display: grid; grid-template-columns: repeat(2, ${tileW}px); grid-auto-rows: max-content; gap: 8px">${cluster.map((j) => touchStackTile(j, 'tablet', 30, tileW)).join('')}</div>
</div>`;
}
const T_WAIT_W = 184;
function tabletDiaryContent({ mechFilter = 'Everyone', activeView = 'Week', selectedIdx = -1, hint = false, highlightJob = null, pickMode = false, selectSlot = null, forceExpandStack = null, overlayFor = null, newJob = 'new-job-pick-tablet.dc.html', mechanic = false, legend = true } = {}) {
  const size = 'tablet';
  const toolbar = mechanic ? mechToolbar(true, size, { newJob }) : diaryToolbar(mechFilter, size, { activeView, newJob: pickMode ? 'active' : newJob });
  const grid = activeView === 'Day'
    ? dayMechGrid({ dayIdx: TODAY, size, slotH: 30, highlightJob })
    : weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size, slotH: 30, mechFilter: mechanic ? 'Alex' : mechFilter, highlightJob, pickMode, selectSlot, forceExpandStack, overlayFor });
  const body = mechanic ? row(grid, 14, 'align-items: flex-start') : row(`${waitingColumn(size, selectedIdx, T_WAIT_W, hint)}${grid}`, 14, 'align-items: flex-start');
  return stack(`${toolbar}${pickMode ? pickInstructionBar(size) : ''}
${body}
${legend && !pickMode ? diaryLegend() : ''}`, pickMode ? 8 : 12);
}
const tabletDiary = (opts = {}, shellOpts = {}) => shellTablet('diary', 'Workshop diary', tabletDiaryContent(opts), shellOpts);
const MECH_SHELL = { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' };

// ---------- Phone diary (one day down a time line) ----------
const P_SLOT = 44; // 30 minutes = 44px, so an hour-long job is an 84px block
const P_GUTTER = 48;
function phoneWeekNav() {
  return `<div style="display: flex; align-items: center; gap: 2px; flex-shrink: 0">${dateArrow('prev', 'Previous week')}<span style="min-width: 74px; text-align: center; font-size: 14px; font-weight: 700; color: ${C.ink}; white-space: nowrap">14–20 Sep</span>${dateArrow('next', 'Next week')}</div>`;
}
// Replaces the Week/Day switch on a phone (decision 68): the week's seven days,
// the chosen one raised like the desktop view switch's selected half.
function phoneDayStrip(selectedIdx, hrefFor = () => '#') {
  return `<div role="tablist" aria-label="Choose a day" style="display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: ${C.mutedBg}">${DAYS.map(([name, date], i) => {
    const on = i === selectedIdx, isToday = i === TODAY;
    return `<a href="${hrefFor(i)}" role="tab" aria-selected="${on}" aria-label="${name} ${date} September${isToday ? ', today' : ''}" style="flex: 1 1 0; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; min-height: 48px; border-radius: 8px; text-decoration: none; background: ${on ? C.panel : 'transparent'}; color: ${C.ink}; ${on ? 'box-shadow: 0 1px 2px rgba(0,0,0,0.14);' : ''}">
<span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${on ? C.ink : C.muted}">${name}</span><span style="font-size: 16px; font-weight: 700; line-height: 1.2">${date}</span>
${isToday ? `<span aria-hidden="true" style="position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 999px; background: ${C.highlight}"></span>` : ''}
</a>`;
  }).join('')}</div>`;
}
// People filter on a phone: one chip that opens the choice (Everyone / Alex /
// Jo), since three chips and the Waiting button don't fit one row.
function phonePeopleChip(label, initial = 'group') {
  const badge = initial === 'group'
    ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: #ffffff; color: ${C.accentSoftInk}; flex-shrink: 0">${icon('customers', 14)}</span>`
    : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: #ffffff; color: ${C.accentSoftInk}; font-size: 12px; font-weight: 700; flex-shrink: 0">${esc(initial)}</span>`;
  return `<button type="button" aria-haspopup="listbox" aria-label="Showing ${esc(label)}. Change whose jobs are shown" style="display: inline-flex; align-items: center; gap: 7px; min-height: 44px; box-sizing: border-box; padding: 5px 10px 5px 6px; border-radius: 999px; font-family: inherit; font-size: 14px; font-weight: 600; border: 1px solid transparent; background: ${C.accentSoft}; color: ${C.accentSoftInk}; white-space: nowrap">${badge}${esc(label)}${icon('chevron', 16)}</button>`;
}
// "Waiting (3)" (decision 68): the Waiting column becomes a button in the
// phone's top bar that opens the list as a sheet (waiting-open-phone).
const phoneWaitingButton = (href = 'waiting-open-phone.dc.html') => `<a href="${href}" aria-label="Waiting for you, ${WAITING.length}" style="display: inline-flex; align-items: center; gap: 7px; min-height: 44px; box-sizing: border-box; padding: 0 10px 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.35); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; white-space: nowrap; flex-shrink: 0">${icon('inbox', 18)}Waiting<span style="display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: ${C.panel}; color: ${C.ink}; font-size: 13px; font-weight: 700">${WAITING.length}</span></a>`;
// pressed: the pick step is running (decision 22) — the + shows as held down,
// amber-ringed, until a time is tapped or Cancel is pressed.
const phoneNewJobAction = (href, pressed = false) => `<a href="${href}" aria-label="New job"${pressed ? ' aria-pressed="true"' : ''} style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: ${pressed ? C.accentSoft : C.panel}; color: ${pressed ? C.accentSoftInk : C.ink}; ${pressed ? `box-shadow: 0 0 0 3px ${C.highlight};` : ''}">${icon('plus', 22)}</a>`;
// The day's time line: an hour ruler, then one column (Everyone, jobs that
// share a start as the stacked-card control, partial overlaps side by side —
// decision 59) or one column per mechanic (the Day view's "Jo's side").
function phoneTimeline({ day, columns, highlightJob = null, pickMode = false, selectSlot = null, forceExpandStack = null, overlayFor = null, merged = true }) {
  const slotH = P_SLOT;
  const gridH = GRID_SLOTS * slotH;
  const hourLabels = Array.from({ length: 9 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
  const lines = `repeating-linear-gradient(to bottom, transparent 0, transparent ${slotH - 1}px, ${C.mutedBg} ${slotH - 1}px, ${C.mutedBg} ${slotH}px, transparent ${slotH}px, transparent ${slotH * 2 - 1}px, ${C.border} ${slotH * 2 - 1}px, ${C.border} ${slotH * 2}px)`;
  const col = (c, i) => {
    const items = JOBS.filter((j) => j.day === day && (!c.mech || j.mech === c.mech));
    const clusters = clusterOverlaps(items);
    const forceExpandStart = forceExpandStack && day === forceExpandStack.day ? forceExpandStack.start : null;
    const blocks = clusters.map((cl) => renderCluster(cl, 'phone', slotH, { highlightJob, faded: pickMode, forceExpandStart, narrow: true })).join('');
    const pending = merged && day === PENDING_DIARY.day ? pendingBlock('phone', slotH, highlightJob?.type === 'pending') : '';
    const outline = merged && day === REQUEST_OUTLINE.day ? requestedOutlineBlock('phone', slotH, highlightJob?.type === 'outline') : '';
    const isPick = pickMode && selectSlot && day === selectSlot.day && (!c.mech || c.mech === selectSlot.mech);
    const pick = isPick ? pickHintSlot('phone', slotH, ((selectSlot.start - GRID_START) / 30) * slotH + 2, selectSlot.label, 'new-job-phone.dc.html') : '';
    const tint = pickMode ? `linear-gradient(rgba(${C.highlightRgb},0.08), rgba(${C.highlightRgb},0.08)), ` : '';
    const over = overlayFor && overlayFor.col === i ? overlayFor.html : '';
    return `<div style="position: relative; flex: 1 1 0; min-width: 0; height: ${gridH}px; ${i ? `border-left: 1px solid ${C.border};` : ''} background: ${tint}${lines}">${blocks}${pending}${outline}${pick}${over}</div>`;
  };
  const header = columns.length > 1 ? `<div style="display: flex; padding-left: ${P_GUTTER}px; position: sticky; top: 0; z-index: 4; background: ${C.bg}">${columns.map((c, i) => `<div style="flex: 1 1 0; min-width: 0; padding: 6px 4px; text-align: center; font-size: 14px; font-weight: 700; color: ${C.ink}; ${i ? `border-left: 1px solid ${C.border};` : ''} border-bottom: 1px solid ${C.border}">${esc(c.label)}</div>`).join('')}</div>` : '';
  return `${header}<div role="grid" aria-label="Workshop diary, ${esc(DAYS[day][0])} ${DAYS[day][1]} September 2026" style="display: flex; padding-top: 8px">
<div aria-hidden="true" style="position: relative; width: ${P_GUTTER}px; flex-shrink: 0; height: ${gridH}px">${hourLabels.map((t, i) => `<span style="position: absolute; top: ${i * 2 * slotH - 8}px; left: 0; font-family: ${MONO}; font-size: 12px; color: ${C.muted}">${t}</span>`).join('')}</div>
${columns.map(col).join('')}
</div>`;
}
const NO_TIME_ROW = (size) => `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"><span style="font-size: 12px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.4px">No time</span>${UNSCHEDULED.map((u) => `<a href="job-overview-${size}.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 999px; background: ${ST.scheduled[0]}; border: 1px solid ${ST.scheduled[1]}; color: ${ST.scheduled[1]}; font-size: 13px; font-weight: 700; white-space: nowrap">${esc(u.job)} · ${esc(u.title)}</a>`).join('')}</div>`;
// A phone diary page. mode: 'everyone' (one merged column), 'byMech' (the Day
// view — one column per mechanic), 'mechanic' (Alex's own diary, Me/Everyone).
function phoneDiaryContent({ day = TODAY, mode = 'everyone', highlightJob = null, pickMode = false, selectSlot = null, forceExpandStack = null, overlayFor = null, bar = '' } = {}) {
  const columns = mode === 'byMech' ? DAY_MECHS.map(([m, name]) => ({ mech: m, label: name })) : mode === 'mechanic' ? [{ mech: 'Alex', label: 'Alex Morgan' }] : [{ mech: null, label: 'Everyone' }];
  const people = mode === 'mechanic' ? mechChips('Me', ['Me', 'Everyone'], 'Whose diary', 'phone') : phonePeopleChip(mode === 'byMech' ? 'By mechanic' : 'Everyone');
  const controls = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 14px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid ${C.border}; background: ${C.bg}">
${pickMode ? pickInstructionBar('phone') : `<div style="display: flex; align-items: center; justify-content: space-between; gap: 6px">${people}${phoneWeekNav()}</div>`}
${phoneDayStrip(day)}
${mode === 'byMech' ? '' : NO_TIME_ROW('phone')}
</div>`;
  // The time line is the one part of the phone diary that scrolls
  // (data-scroll marks it for the strict fit check).
  const tl = phoneTimeline({ day, columns, highlightJob, pickMode, selectSlot, forceExpandStack, overlayFor, merged: mode === 'everyone' });
  // position/z-index: its own stacking context, so the sticky mechanic header
  // and a fanned stack stay inside it, under any sheet drawn over the page.
  return `${controls}<div data-scroll="page" style="position: relative; z-index: 0; flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; box-sizing: border-box; padding: 0 14px 14px">${tl}</div>${bar}`;
}
const phoneDiary = (opts = {}, shellOpts = {}) => shellPhone('Diary', phoneDiaryContent(opts), {
  active: 'diary', pad: 0,
  actions: `${opts.mode === 'mechanic' ? '' : phoneWaitingButton()}${phoneNewJobAction(opts.mode === 'mechanic' ? 'new-job-phone.dc.html' : opts.mode === 'byMech' ? 'new-job-day-phone.dc.html' : 'new-job-pick-phone.dc.html', !!opts.pickMode)}`,
  ...shellOpts,
});
// The selected-card bar pinned under a phone diary (decisions 14/19): the
// first tap highlights the job in the day list and shows this; tapping again
// (or Open) opens the request.
function phoneSelectedBar({ tone, title, detail, openHref }) {
  const [bg, ink, label] = ST[tone];
  return `<div role="status" style="flex-shrink: 0; box-sizing: border-box; padding: 10px 14px 12px; border-top: 1px solid ${C.border}; background: ${C.panel}; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 -6px 18px rgba(28,30,25,0.08)">
<div style="display: flex; align-items: center; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0"><span style="align-self: flex-start; display: inline-flex; padding: 2px 8px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700">${esc(label)}</span><span style="font-size: 15px; font-weight: 700; color: ${C.ink}">${esc(title)}</span><span style="font-size: 14px; color: ${C.ink}">${detail}</span></div>
<a href="${openHref}" style="display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 72px; padding: 0 16px; box-sizing: border-box; border-radius: 8px; background: ${C.accent}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none">Open</a>
</div>
<span style="font-size: 12px; color: ${C.muted}">Tap the card again to open it.</span>
</div>`;
}

// ---------- Screens ----------
export const screens = {};

// 1. diary (Staff, Jo Taylor)
// Parameterised on overlapStyle (default 'stacked', decision 58/59) so
// audit-ideas.mjs's idea-s4-before can still reuse this real builder
// (weekGrid + toolbar + waiting column + legend) with the old 'text' style,
// instead of a redrawn approximation.
export function buildDiaryDesktopBoard(overlapStyle = 'stacked') {
  return shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', -1)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone', overlapStyle })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12));
}
screens.diary = {
  desktop: buildDiaryDesktopBoard(),
  tablet: tabletDiary(),
  phone: phoneDiary({ day: TODAY, mode: 'everyone' }),
};
keepDesktopSeq('diary');

// 2. diary-mechanic (Mechanic, Alex Morgan) — opens on Me; no Waiting column
screens['diary-mechanic'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${mechToolbar(true, 'desktop', { newJob: 'new-job-desktop.dc.html' })}
${row(weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Alex' }), 16, 'align-items: flex-start')}
${diaryLegend()}`, 12), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' }),
  tablet: tabletDiary({ mechanic: true, newJob: 'new-job-tablet.dc.html' }, MECH_SHELL),
  phone: phoneDiary({ day: TODAY, mode: 'mechanic' }, { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' }),
};
keepDesktopSeq('diary-mechanic');

// 3. waiting-open — decision 14, "request selected": one click has highlighted
// Sam Reed's card (ring + Open button) and jumped the diary to its week, with
// the matching Fri 10:00 pending block highlighted in the grid. Desktop and
// tablet show the list beside the diary so the highlighted block stays
// visible; phone shows the result of the tap — the sheet has closed, the day
// view has jumped to Friday, and a bar is pinned at the bottom.
screens['waiting-open'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', 0, 224, true)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone', highlightJob: { type: 'pending' } })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: tabletDiary({ selectedIdx: 0, hint: true, highlightJob: { type: 'pending' } }),
  // Phone: the Waiting sheet is open and Sam Reed's card has been tapped once
  // — it's highlighted with Open, and the diary behind has jumped to Friday
  // with the pending block ringed (decision 14).
  phone: phoneDiary({ day: 4, highlightJob: { type: 'pending' } }, {
    overlay: phoneSheet({ id: 'waiting-sheet-title', title: `Waiting for you (${WAITING.length})`, closeHref: 'diary-phone.dc.html', maxH: 490,
      body: `${WAITING.map((w, i) => touchWaitingCard(w, 'phone', i === 0)).join('')}` }),
  }),
};
keepDesktopSeq('waiting-open');

// 3b. diary-day — brief item 18: one column per mechanic, Thu 17 Sep, same
// time rows and Waiting column as the week view. The Day button is selected;
// the empty-slot hint in Jo's 16:00 sits ready for new-job-day. Phone shows a
// mechanic switch above the day list instead of columns (there's no room for
// two columns on a phone).
screens['diary-day'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { activeView: 'Day', newJob: 'new-job-day-desktop.dc.html' })}
${row(`${waitingColumn('desktop', -1)}${dayMechGrid({ dayIdx: TODAY, size: 'desktop' })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: tabletDiary({ activeView: 'Day', newJob: 'new-job-day-tablet.dc.html' }),
  // Phone: the Day view is one column per mechanic (decision 18's "Jo's
  // side"), chosen from the people chip ("By mechanic").
  phone: phoneDiary({ day: TODAY, mode: 'byMech' }),
};

// 3c. diary-settings — Office › Settings, shown for a Manager (brief item 1):
// choose what shows first/second on a diary block, with a live preview.
// Item 29/4 (27 Sep round 2): the block preview leads with whichever field is
// chosen for line 1/2 (defaults bike/job title), and always shows the status
// as its own third line — e.g. "Trek Domane AL 3 / Standard service /
// Scheduled".
function blockPreviewCard(first, second, size = 'desktop') {
  const T = size !== 'desktop';
  const sample = { customer: 'Maya Patel', job: 'WH-1042', bike: 'Trek Domane AL 3', jobTitle: 'Standard service' };
  const line1 = sample[first] || sample.bike;
  const line2 = sample[second] || sample.jobTitle;
  return `<div aria-label="Block preview" style="width: 190px; box-sizing: border-box; padding: 6px 8px; border-radius: 5px; background: ${ST.scheduled[0]}; border: 1.75px solid ${ST.scheduled[1]}">
<div style="font-size: 12px; font-weight: 700; color: ${C.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(line1)}</div>
<div style="font-size: ${T ? 12 : 11}px; font-weight: 700; color: ${C.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(line2)}</div>
<div style="font-size: ${T ? 12 : 11}px; font-weight: 700; color: ${ST.scheduled[1]}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">Scheduled</div>
</div>`;
}
// Item 27 (27 Sep round): storage slots are optional per shop, turned on or
// off here; when on, the shop keeps its own list of hooks and spaces.
export function toggleSwitch(label, on, id, size = 'desktop') {
  // Tablet/phone (decision 68): the same switch in a full 44px button (the
  // Accessibility tab's a11ySwitch) instead of the 26px desktop track.
  const sw = size !== 'desktop' ? a11ySwitch(id, on, label) : `<span id="${id}" role="switch" aria-checked="${on}" style="position: relative; display: inline-flex; align-items: center; width: 44px; height: 26px; border-radius: 999px; background: ${on ? C.accent : C.input}; flex-shrink: 0">
<span style="position: absolute; top: 3px; left: ${on ? '21px' : '3px'}; width: 20px; height: 20px; border-radius: 999px; background: #ffffff; box-shadow: 0 1px 2px rgba(28,30,25,0.35)"></span>
</span>`;
  return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px${size === 'desktop' ? '' : '; min-height: 44px'}">
<label for="${id}" style="font-size: 15px; font-weight: 700; color: ${C.ink}">${esc(label)}</label>
${sw}
</div>`;
}
// A compact wrapping chip, not a full-width row per slot — a vertical list of
// rowCards for up to 8 slots didn't fit this page's height budget alongside
// the block-preference panel (shellDesktop's <main> doesn't scroll).
function storageSlotChip(name, size = 'desktop') {
  if (size !== 'desktop') return `<span style="display: inline-flex; align-items: center; gap: 2px; min-height: 44px; box-sizing: border-box; padding: 0 0 0 12px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(name)}<button type="button" aria-label="Remove ${esc(name)}" style="width: 44px; height: 44px; margin: -1px 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 0; background: transparent; color: ${C.muted}"><span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: ${C.mutedBg}">${icon('close', 13)}</span></button></span>`;
  return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 13px; font-weight: 600; color: ${C.ink}">${esc(name)}<button type="button" aria-label="Remove ${esc(name)}" style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 0; background: ${C.mutedBg}; color: ${C.muted}">${icon('close', 12)}</button></span>`;
}
// The section's content on its own, so Owner setup (journey 8, decision 12)
// can show it as a folding section in Settings › Workshop.
export function storageSlotsContent(size) {
  return `${toggleSwitch('Storage slots', true, 'storage-toggle-' + size, size)}
${note('On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.', 12)}
<div style="display: flex; flex-wrap: wrap; gap: ${size === 'desktop' ? 8 : size === 'phone' ? 4 : 6}px; padding-top: ${size === 'phone' ? 8 : 10}px; border-top: 1px solid ${C.border}">${STORAGE_SLOTS.map((n) => storageSlotChip(n, size)).join('')}</div>
<div>${button('+ Add a slot', { variant: 'default', size: size === 'desktop' ? 'sm' : 'default' })}</div>`;
}
function storageSlotsSection(size) {
  return panel(storageSlotsContent(size), '', size === 'phone' ? 12 : 16, size === 'phone' ? 8 : 12);
}
// Item 29/4 (27 Sep round 2): "Job title" joins customer, bike and job number
// as a block-line choice; the default is bike first, job title second.
export function blockPrefContent(size) {
  return `${grid('1fr 1fr', `${select('First line', ['Bike', 'Job title', 'Customer', 'Job number'], 'set-first-' + size)}${select('Second line', ['Job title', 'Bike', 'Customer', 'Job number'], 'set-second-' + size)}`, 14)}
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}">${eyebrow('Preview')}${blockPreviewCard('bike', 'jobTitle', size)}${note('The status always shows too, whatever the two lines above are set to.', 12)}</div>`;
}
function blockPrefPanel(size) {
  return panel(`${h2('What shows on a block', 15)}
${blockPrefContent(size)}`, '', 16, 12);
}
screens['diary-settings'] = {
  // Journey 8 decisions 12 and 21 (30 Sep): the same settings, as two folding
  // sections in Owner setup's Settings › Workshop, at every size. Getters,
  // because settings-frame.mjs imports this file: building on first read
  // (after every module has loaded) avoids the import cycle's start-up order.
  get desktop() { return withSize('desktop', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ diary: blockPrefContent('desktop'), storage: storageSlotsContent('desktop') }))); },
  get tablet() { return withSize('tablet', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ diary: blockPrefContent('tablet'), storage: storageSlotsContent('tablet') }))); },
  get phone() { return withSize('phone', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ diary: blockPrefContent('phone'), storage: storageSlotsContent('phone') }))); },
};

// 3c.ii settings-accessibility — decision 57 (29 Sep): a second Settings tab,
// per person (not per shop, unlike diary-settings above) — Jack wants
// Wheelhouse as accessible as possible, and these three choices depend on
// who's using the screen. Desktop only, same shell as diary-settings.
function a11ySwitch(id, on, label) {
  return `<button type="button" id="${id}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" style="position: relative; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border: 0; border-radius: 8px; background: transparent; display: inline-flex; align-items: center; justify-content: center; font-family: inherit; cursor: pointer">
<span aria-hidden="true" style="position: relative; display: inline-block; width: 40px; height: 24px; border-radius: 999px; background: ${on ? C.accent : C.input}; flex-shrink: 0">
<span style="position: absolute; top: 2px; left: ${on ? '18px' : '2px'}; width: 20px; height: 20px; border-radius: 999px; background: #ffffff; box-shadow: 0 1px 2px rgba(28,30,25,0.35)"></span>
</span>
</button>`;
}
export function a11ySettingRow(id, label, desc, on, preview = '') {
  return panel(`${row(`<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700; color: ${C.ink}">${esc(label)}</span><span style="font-size: 13px; line-height: 1.45; color: ${C.muted}">${esc(desc)}</span></div>${a11ySwitch(id, on, label)}`, 16, 'justify-content: space-between; align-items: flex-start')}${preview ? `<div style="padding-top: 10px; border-top: 1px solid ${C.border}">${preview}</div>` : ''}`, '', 16, 12);
}
// Two narrow diary blocks (jobBlock's own narrow-block markup, sized down)
// with the shape mark drawn on, so "Show status symbols" previews what it
// turns on regardless of SHOW_STATUS_SYMBOLS's own (off) default above.
export function symbolsPreview(size = 'desktop') {
  const T = size !== 'desktop';
  const sample = [['scheduled', 'Trek Domane AL 3', 'Standard service'], ['waiting', 'Cannondale Quick', 'Gear adjustment']];
  return `${eyebrow('Preview')}<div style="display: flex; gap: 8px; padding-top: 6px">${sample.map(([key, bike, title]) => {
    const [bg, ink] = ST[key];
    return `<div style="position: relative; width: ${T ? 140 : 122}px; box-sizing: border-box; padding: 3px 16px 3px 6px; border-radius: 5px; background: ${bg}; border: 1.75px solid ${ink}">
<svg width="13" height="13" viewBox="0 0 10 10" aria-hidden="true" style="position: absolute; top: 4px; right: 4px">${STATUS_SHAPE[key](ink)}</svg>
<div style="font-size: ${T ? 12 : 11}px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(bike)}</div>
<div style="font-size: ${T ? 12 : 10}px; font-weight: 700; color: ${ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(title)}</div>
</div>`;
  }).join('')}</div>`;
}
export function largerTextPreview(dev = 'desktop') {
  const col = (size, label) => `<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: ${dev === 'desktop' ? 11 : 12}px; color: ${C.muted}">${esc(label)}</span><span style="font-size: ${size}px; font-weight: 600; color: ${C.ink}">Standard service</span></span>`;
  return `${eyebrow('Preview')}<div style="display: flex; align-items: flex-end; gap: 20px; padding-top: 6px">${col(14, 'Normal')}${col(17, 'Larger')}</div>`;
}
// The Settings · Accessibility board was removed on 30 Sep (Owner setup
// decision 15): Accessibility lives in Your settings (app map decision 8),
// which uses the helpers above.

// 3d. change-selected — decision 19: built like waiting-open, but for Oliver
// Chen's change request. The requested 14:00 time is the highlighted target;
// the current 10:00 booking (WH-1052) is only lightly marked.
screens['change-selected'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', 1, 224, true)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone', highlightJob: { type: 'outline', dim: 'WH-1052' } })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: tabletDiary({ selectedIdx: 1, hint: true, highlightJob: { type: 'outline', dim: 'WH-1052' } }),
  // Phone (decision 68): no curved arrow in a one-column day list — the move
  // is spelled out in the selected-card bar and the requested 14:00 is the
  // ringed slot in Monday's time line, the current 10:00 job lightly marked.
  phone: phoneDiary({ day: 0, highlightJob: { type: 'outline', dim: 'WH-1052' }, bar: phoneSelectedBar({ tone: 'hold', title: 'Oliver Chen · Brompton C Line', detail: `Mon ${mono('10:00')} → ${mono('14:00')}`, openHref: 'request-change-phone.dc.html' }) }),
};
keepDesktopSeq('change-selected');

// 3e. diary-context-menu / job-quick-overview — decision 37 (28 Sep round):
// right-clicking a diary block offers "Open job" and "View overview", the
// latter opening a small box with just the job's notes, line items and cost
// — no customer details or mechanic — so staff on the phone to a customer
// can catch up on the job quickly without opening it. Desktop only (decision
// 25). Anchored beside Maya Patel's WH-1042 block (Thu 17 Sep, 11:30),
// measured from the plain diary board's own rendered layout so the menu
// sits just clear of the highlighted block rather than guessing a position.
const CONTEXT_MENU_ANCHOR = { left: 960, top: 354 }; // right edge of WH-1042's block (~952) + 8px gap; same top
function contextMenu(items) {
  return `<div role="menu" aria-label="Job actions" style="position: absolute; left: ${CONTEXT_MENU_ANCHOR.left}px; top: ${CONTEXT_MENU_ANCHOR.top}px; width: 208px; box-sizing: border-box; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28); padding: 6px; display: flex; flex-direction: column; gap: 2px; z-index: 5">
${items.map((it) => `<a role="menuitem" href="${it.href}" style="display: flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; color: ${C.ink}; ${it.on ? `background: ${C.hover}; outline: 2px solid ${C.accent}; outline-offset: -2px;` : ''}">${esc(it.label)}</a>`).join('')}
<div style="padding: 8px 12px 4px; border-top: 1px solid ${C.border}; margin-top: 4px; font-size: 12px; line-height: 1.4; color: ${C.muted}">Tip: hold the right mouse button to open the overview straight away.</div>
</div>`;
}
screens['diary-context-menu'] = {
  desktop: (() => {
    const base = shellDesktop('diary', 'Workshop diary', diaryFrozenContent('desktop', { highlightJob: { type: 'job', job: 'WH-1042' } }));
    const menu = contextMenu([
      { label: 'Open job', href: 'job-overview-desktop.dc.html', on: false },
      { label: 'View overview', href: 'job-quick-overview-desktop.dc.html', on: true },
    ]);
    return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${base}${menu}</div>`;
  })(),
  // Tablet/phone: right-click becomes press-and-hold (decision 65).
  tablet: tabletDiary({ highlightJob: { type: 'job', job: 'WH-1042' }, overlayFor: { day: TODAY, html: tabletMenuPopover() } }),
  phone: phoneDiary({ day: TODAY, highlightJob: { type: 'job', job: 'WH-1042' } }, {
    overlay: phoneSheet({ id: 'job-menu-title', title: 'Standard service · WH-1042', sub: 'Maya Patel · Trek Domane AL 3', closeHref: 'diary-phone.dc.html',
      body: `<div role="menu" aria-label="Job actions" style="display: flex; flex-direction: column; gap: 4px">${touchMenuItems('phone')}</div><p style="margin: 0; font-size: 13px; line-height: 1.4; color: ${C.muted}">${TOUCH_MENU_TIP}</p>` }),
  }),
};

// job-quick-overview's own body is built further down this file, once
// CHECKLIST exists (see "Job overview quick-look box (decision 37)" below).

// ---------- Row 2: Requests, as a pop-up (decision 15) ----------
const reqCloseHref = (size) => `diary-${size}.dc.html`;

// 4. request-new — Sam Reed / Specialized Sirrus / Brake service (stage2 REQ
// example; no price source yet, so this reads "Price to be confirmed" —
// H4 (29 Sep audit): was a literal unrendered "[price]" template tag.
function requestNewBody(size) {
  return `${eyebrow(`Received today at ${mono('08:15')}`)}
${row(`${h2('Sam Reed', 18)}${statusBadge('pending')}`, 10, 'justify-content: space-between')}
${txt('Specialized Sirrus · grey', 14, `color: ${C.muted}`)}
<div style="display: flex; flex-direction: column; gap: 6px">${h2('What the customer told us', 14)}${quote('No message from the customer.')}</div>
<div style="display: flex; flex-direction: column; gap: 4px">${txt(`<strong>Brake service · Price to be confirmed</strong>`)}${note('45 minutes planned. Requested Friday 18 September.')}</div>
${mechanicPillGroup(size, 'Shared queue')}`;
}
const reqNewOpts = {
  id: 'req-new-title', title: 'Sam Reed · Specialized Sirrus', sub: 'Pending request', body: requestNewBody,
  footer: (size) => `${button('Accept', { block: true })}${btnRow(`${button('Offer another time', { variant: 'default' })}${button('Decline', { variant: 'ghost', href: `request-decline-${size}.dc.html` })}`)}`,
  highlightJob: { type: 'pending' },
};
screens['request-new'] = {
  desktop: requestDialog('desktop', DW, DH, reqNewOpts),
  tablet: requestDialog('tablet', TW, TH, reqNewOpts),
  phone: dialogPhone('Sam Reed · Specialized Sirrus', reqCloseHref('phone'), stack(requestNewBody('phone'), 12),
    `${button('Accept', { block: true })}${grid('1fr 1fr', `${button('Another time', { variant: 'default', block: true })}${button('Decline', { variant: 'ghost', block: true, href: 'request-decline-phone.dc.html' })}`, 8)}`, 'Pending request'),
};
keepDesktopSeq('request-new');

// 5. request-decline — message copied from stage2 `reject`
const DECLINE_MSG = 'Sorry, we can’t fit this service in on Thursday. Please try Friday, or call us and we’ll help find another day.';
function requestDeclineBody(size) {
  return `${txt('<strong>Explain what the customer can do next</strong>')}
${area('Message to Sam', DECLINE_MSG, 'decline-msg-' + size, 4)}
${note('Declining releases the request’s reservation. The customer is told not to travel for this request.')}`;
}
const reqDeclineOpts = {
  id: 'req-decline-title', title: 'Decline booking request', sub: 'Sam Reed · Specialized Sirrus', body: requestDeclineBody,
  footer: () => `${button('Decline & notify customer', { variant: 'danger', block: true })}${button('Keep request', { variant: 'default', block: true })}`,
  highlightJob: { type: 'pending' },
};
screens['request-decline'] = {
  desktop: requestDialog('desktop', DW, DH, reqDeclineOpts),
  tablet: requestDialog('tablet', TW, TH, reqDeclineOpts),
  phone: dialogPhone('Decline request', reqCloseHref('phone'), stack(requestDeclineBody('phone'), 12), `${button('Decline & notify customer', { variant: 'danger', block: true })}${button('Keep request', { variant: 'default', block: true })}`, 'Sam Reed · Specialized Sirrus'),
};
keepDesktopSeq('request-decline');

// 6. request-change — Oliver Chen, from/to times; no "Seen"
function requestChangeBody() {
  return `${row(`${h2('Oliver Chen', 18)}${statusBadge('hold')}`, 10, 'justify-content: space-between')}
${txt('Brompton C Line · black', 14, `color: ${C.muted}`)}
${panel(`${row(`${eyebrow('From')}${icon('chevron', 16, C.muted)}${eyebrow('To')}`, 10)}${row(`${txt('<strong>Mon 14 Sep · 10:00</strong>')}${icon('chevron', 16, C.muted)}${txt('<strong>Mon 14 Sep · 14:00</strong>')}`, 10)}`, '', 14, 8)}
${note('The customer asked to move this booking. Accepting keeps the same work and mechanic.')}`;
}
const reqChangeOpts = {
  id: 'req-change-title', title: 'Change request', sub: 'Oliver Chen · Brompton C Line', body: requestChangeBody,
  footer: (size) => `${button('Accept', { block: true })}${btnRow(`${button('Decline', { variant: 'default' })}${button('Open full job', { variant: 'ghost', href: `job-overview-${size}.dc.html` })}`)}`,
  highlightJob: { type: 'job', job: 'WH-1052' },
};
screens['request-change'] = {
  desktop: requestDialog('desktop', DW, DH, reqChangeOpts),
  tablet: requestDialog('tablet', TW, TH, reqChangeOpts),
  phone: dialogPhone('Change request', reqCloseHref('phone'), requestChangeBody(),
    `${button('Accept', { block: true })}${button('Decline', { variant: 'default', block: true })}${button('Open full job', { variant: 'ghost', block: true, href: 'job-overview-phone.dc.html' })}`, 'Oliver Chen · Brompton C Line'),
};
keepDesktopSeq('request-change');

// 7. request-cancel — Aisha Khan; one action, "Seen"
function requestCancelBody() {
  return `${row(`${h2('Aisha Khan', 18)}${statusBadge('cancelled')}`, 10, 'justify-content: space-between')}
${txt('Cannondale Quick · silver', 14, `color: ${C.muted}`)}
<div style="display: flex; flex-direction: column; gap: 4px">${txt('<strong>Safety check</strong>')}${note(`Cancelled by the customer today at ${mono('07:58')}.`)}</div>
${note('No further action is needed. The reservation has already been released.')}`;
}
const reqCancelOpts = {
  id: 'req-cancel-title', title: 'Cancelled booking', sub: 'Aisha Khan · Cannondale Quick', body: requestCancelBody,
  footer: () => button('Seen', { block: true }),
  highlightJob: { type: 'job', job: 'WH-1058' },
};
screens['request-cancel'] = {
  desktop: requestDialog('desktop', DW, DH, reqCancelOpts),
  tablet: requestDialog('tablet', TW, TH, reqCancelOpts),
  phone: dialogPhone('Cancelled booking', reqCloseHref('phone'), requestCancelBody(), button('Seen', { block: true }), 'Aisha Khan · Cannondale Quick'),
};
keepDesktopSeq('request-cancel');

// ---------- Row 3: New job from an empty slot (decision 16 — same near-fullscreen treatment as a job pop-up) ----------
const custResult = `<div style="padding: 6px 12px; border-radius: 8px; border: 2px solid ${C.accent}; background: ${C.mutedBg}; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">07700 900 142 · maya@example.test</span><span style="font-size: 13px">Trek Domane AL 3 · green</span></div>`;
// Decision 18: in the Everyone week view Wheelhouse assigns the mechanic with
// the most free time that day; from a mechanic's own column (the day view),
// that mechanic is pre-filled instead. Either way it's a real select the
// member of staff can change before saving.
// New bike build / PDI pill (item 26; decision 50 — a clickable toggle pill,
// not a tick box): near the top, off, always with its "customer becomes
// optional" hint next to it — the hint states the effect rather than only
// appearing once on, since a member of staff reads it before deciding
// whether to turn it on. "New bike build" only ever appears here, on the New
// job form — once the job exists it isn't shown on the job page (decision 50).
function newBuildCheck(size) {
  return `<div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">${togglePill('New bike build or pre-delivery check', false, 'nj-newbuild-' + size)}${note('Customer becomes optional.', 12)}</div>`;
}
// Staff notes (item 26): internal only, each with who and when — an "Add
// note" button rather than a live list (this is a still drawing), so
// new-job-day's one example row is data, not something the button appends to.
function staffNoteRow(n) {
  return `<div style="display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid ${C.border}"><span style="font-size: 12px; color: ${C.muted}">${esc(n.who)} · ${esc(n.when)}</span><span style="font-size: 13px; color: ${C.ink}">${esc(n.text)}</span></div>`;
}
function staffNotesBlock(size, notes) {
  return `<div style="display: flex; flex-direction: column; gap: 8px">
<span style="font-size: 14px; font-weight: 600; color: ${C.ink}">Staff notes</span>
${notes.length ? `<div>${notes.map(staffNoteRow).join('')}</div>` : ''}
<div style="display: flex; gap: 8px">
<input id="nj-staffnote-${size}" type="text" placeholder="Add a note for other staff" aria-label="Add a note for other staff" style="flex-grow: 1; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 11px 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">
${button('Add note', { variant: 'default', size: 'sm' })}
</div>
${note('Internal only — not shown to the customer.', 12)}
</div>`;
}
// Decision 51 (28 Sep 2026): no separate "Ready by" field or quick buttons on
// New job — the diary day/time chosen for the job (the `when` banner above
// it) is its ready-by day; readyByBlock is gone.
// Decision 18: in the Everyone week view Wheelhouse assigns the mechanic with
// the most free time that day; from a mechanic's own column (the day view),
// that mechanic is pre-filled instead. Either way it's a real select the
// member of staff can change before saving.
// Decision 66: Work as branching pills — first-level group pills (Full
// service / Individual service), then the chosen group's services as pills
// below it, each showing its time, plus a small "Search services" link
// beside the group pills for the shop's full list (services stay searchable
// too, per the decision — the pills are the short/grouped path, not the only
// path). service is the currently-chosen service name; its group is derived
// so both boards stay consistent with whichever one is selected.
function workPillsBlock(size, service) {
  const groupNames = Object.keys(SERVICE_GROUPS);
  const activeGroup = serviceGroupOf(service);
  const groupId = 'nj-work-group-' + size;
  const serviceId = 'nj-work-service-' + size;
  return `<div style="display: flex; flex-direction: column; gap: 5px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
<span id="${groupId}-label" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Work</span>
${link('Search services')}
</div>
<div role="radiogroup" aria-labelledby="${groupId}-label" style="display: flex; flex-wrap: wrap; gap: 5px">${groupNames.map((g) => formPill(g, g === activeGroup)).join('')}</div>
<div style="display: flex; flex-direction: column; gap: 5px">
<span id="${serviceId}-label" style="font-size: 12px; font-weight: 600; color: ${C.muted}">${esc(activeGroup)}</span>
<div role="radiogroup" aria-labelledby="${serviceId}-label" style="display: flex; flex-wrap: wrap; gap: 5px">${SERVICE_GROUPS[activeGroup].map((n) => formPill(`${n} · ${serviceDurationOf(n)} min`, n === service)).join('')}</div>
</div>
</div>`;
}
function newJobBody(size, opts = {}) {
  const {
    when = 'Tue 15 Sep · 10:00',
    mechanic = 'Alex Morgan',
    mechHint = 'Mechanic chosen automatically: most free time on Tuesday. To change it, drag the job to another mechanic in the Day view.',
    showCustomer = true,
    freeMinutes = null,
    service = 'Standard service',
    startingStatusIdx = 0,
    bikeHereChecked = false,
    storageDefault = 'Hook 3',
    receiptNote = 'Rear brake squeals and feels weak.',
    staffNotes = [],
  } = opts;
  const mechOptions = ['Alex Morgan', 'Jo Taylor', 'Shared workshop queue'];
  const ordered = [mechanic, ...mechOptions.filter((m) => m !== mechanic)];
  // Item 23, desktop only: picking the service pill sets the job's estimated
  // time; if the free time at the chosen slot (freeMinutes) is shorter, a
  // warning shows before saving. Save stays available regardless (the diary
  // shows the overlap if staff save anyway).
  const svcDur = serviceDurationOf(service);
  const timeLabel = when.split('· ')[1] || when;
  const warn = freeMinutes != null && svcDur > freeMinutes;
  if (size !== 'desktop') return newJobBodyTouch(size, opts);
  // Desktop (item 26 of the 27 Sep round): follows Citrus Lime's "Create a
  // Workshop Job" structure, in Fjell — two columns (customer/bike/work left,
  // dates/status/storage/notes right) in the existing near-fullscreen pop-up,
  // so the form reads well without the Save button falling below the fold
  // (the dialog body scrolls if a smaller viewport needs it to).
  const customerBlock = showCustomer
    ? `${field('Find customer by name, phone or email', { value: 'Maya Patel', id: 'nj-find-' + size })}
${custResult}
<div>${link('+ New customer')}</div>`
    : `${field('Find customer by name, phone or email', { placeholder: 'Search by name, phone or email', id: 'nj-find-' + size })}
<div>${link('+ New customer')}</div>`;
  const bikeBlock = showCustomer
    ? `${select('Bike', ['Trek Domane AL 3 · green'], 'nj-bike-' + size)}<div>${link('+ Add a bike')}</div>`
    : `${select('Bike', ['Select a customer first'], 'nj-bike-' + size)}<div>${link('+ Add a bike')}</div>`;
  // Part A.3 (29 Sep audit follow-up): the strict fit check found the
  // desktop new-job form's scrolling body ~43px taller than the pop-up —
  // real content past the fold on a static canvas that can't be scrolled to
  // prove it's there. The 43px only shows up on this board (new-job), not
  // new-job-day, because this is the one with the "won't fit" warning banner
  // (item 23) — that's the extra block the other board doesn't carry.
  // Tightened rather than cut: column gap 12px→9px→6px (the last step, Part
  // A.4, 29 Sep round 3, is decision 66's pills wrapping onto more lines
  // than the selects they replaced), "Note for the customer" 3 rows→2 (still
  // fits the example text), dialog body padding 20px→14px→8px (below, in
  // newJobDialog) — together enough to bring it back within the fixed 800px
  // board with no scrolling needed.
  const leftCol = `<div style="display: flex; flex-direction: column; gap: 6px">
${customerBlock}
${bikeBlock}
${workPillsBlock(size, service)}
${field('Job title', { value: service, id: 'nj-title-' + size, hint: 'Filled in from the work chosen. Shown on the diary block.' })}
${area('Note for the customer', receiptNote, 'nj-receipt-' + size, 2)}
${note('Printed on their receipt.', 12)}
</div>`;
  const rightCol = `<div style="display: flex; flex-direction: column; gap: 6px">
${banner(`${when} · ${mechanic}`, 'info')}
${note(mechHint)}
${warn ? banner(`Only ${freeMinutes} minutes free at ${esc(timeLabel)} — this job needs ${svcDur}. Choose another time, or save anyway and the diary will show the overlap. ${link('Find the next free ' + svcDur + ' minutes')}`, 'warn') : ''}
${pillRadioGroup('Starting status', STARTING_STATUS, startingStatusIdx, 'nj-status-' + size, (o, active) => formPill(o, active))}
<div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">${togglePill('The bike is here now', bikeHereChecked, 'nj-herenow-' + size)}${note('Books it in straight away, ready to print the bike tag.', 12)}</div>
${pillRadioGroup('Where the bike is kept', STORAGE_SLOTS, STORAGE_SLOTS.indexOf(storageDefault), 'nj-storage-' + size, (o, active) => formPill(o, active))}
${note('Storage slots are on for this shop. Turn them off in Settings.', 12)}
${staffNotesBlock(size, staffNotes)}
</div>`;
  return `${newBuildCheck(size)}
${grid('1fr 1fr', `${leftCol}${rightCol}`, 28)}`;
}
// New job on tablet and phone (decision 68): the desktop form's fields and
// branching pills exactly (decisions 26, 50, 51, 54, 66), at touch size —
// every pill, toggle and link a full 44px. Tablet lays them out in three
// columns so the pop-up still doesn't scroll; phone is one scrolling column
// with Save pinned below it.
const touchLink = (t, href = '#') => `<a href="${href}" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.accentDark}">${esc(t)}</a>`;
function newJobBodyTouch(size, opts = {}) {
  const {
    when = 'Tue 15 Sep · 10:00', mechanic = 'Alex Morgan',
    mechHint = 'Mechanic chosen automatically: most free time on Tuesday. To change it, drag the job to another mechanic in the Day view.',
    showCustomer = true, freeMinutes = null, service = 'Standard service', startingStatusIdx = 0, bikeHereChecked = false,
    storageDefault = 'Hook 3', receiptNote = 'Rear brake squeals and feels weak.', staffNotes = [],
  } = opts;
  const svcDur = serviceDurationOf(service);
  const timeLabel = when.split('· ')[1] || when;
  const warn = freeMinutes != null && svcDur > freeMinutes;
  const pill = (t, a) => radioPill(t, a);
  const groupNames = Object.keys(SERVICE_GROUPS);
  const activeGroup = serviceGroupOf(service);
  const g = (inner, gap = 4) => `<div style="display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
  const hint = (t) => note(t, 13);
  const whenBlock = g(`${banner(`${esc(when)} · ${esc(mechanic)}`, 'info')}${hint(mechHint)}${warn ? banner(`Only ${freeMinutes} minutes free at ${esc(timeLabel)} — this job needs ${svcDur}. Choose another time, or save anyway and the diary will show the overlap. ${link('Find the next free ' + svcDur + ' minutes')}`, 'warn') : ''}`, 6);
  const newBuild = g(`${togglePill('New bike build or pre-delivery check', false, 'nj-newbuild-' + size, 'align-self: flex-start')}${hint('Customer becomes optional.')}`);
  const customer = showCustomer
    ? g(`${field('Find customer by name, phone or email', { value: 'Maya Patel', id: 'nj-find-' + size })}${custResult}<div>${touchLink('+ New customer')}</div>`)
    : g(`${field('Find customer by name, phone or email', { placeholder: 'Search by name, phone or email', id: 'nj-find-' + size })}<div>${touchLink('+ New customer')}</div>`);
  const bike = g(`${select('Bike', [showCustomer ? 'Trek Domane AL 3 · green' : 'Select a customer first'], 'nj-bike-' + size)}<div>${touchLink('+ Add a bike')}</div>`);
  const work = `<div style="display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span id="nj-work-group-${size}-label" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Work</span>${touchLink('Search services')}</div>
<div role="radiogroup" aria-labelledby="nj-work-group-${size}-label" style="display: flex; flex-wrap: wrap; gap: 6px">${groupNames.map((n) => pill(n, n === activeGroup)).join('')}</div>
<span id="nj-work-service-${size}-label" style="font-size: 12px; font-weight: 600; color: ${C.muted}">${esc(activeGroup)}</span>
<div role="radiogroup" aria-labelledby="nj-work-service-${size}-label" style="display: flex; flex-wrap: wrap; gap: 6px">${SERVICE_GROUPS[activeGroup].map((n) => pill(`${n} · ${serviceDurationOf(n)} min`, n === service)).join('')}</div>
</div>`;
  const title = field('Job title', { value: service, id: 'nj-title-' + size, hint: 'Filled in from the work chosen. Shown on the diary block.' });
  const receipt = g(`${area('Note for the customer', receiptNote, 'nj-receipt-' + size, 2)}${hint('Printed on their receipt.')}`);
  const status = pillRadioGroup('Starting status', STARTING_STATUS, startingStatusIdx, 'nj-status-' + size, pill);
  const hereNow = g(`${togglePill('The bike is here now', bikeHereChecked, 'nj-herenow-' + size, 'align-self: flex-start')}${hint('Books it in straight away, ready to print the bike tag.')}`);
  const storage = g(`${pillRadioGroup('Where the bike is kept', STORAGE_SLOTS, STORAGE_SLOTS.indexOf(storageDefault), 'nj-storage-' + size, pill)}${hint('Storage slots are on for this shop. Turn them off in Settings.')}`);
  const staff = `<div style="display: flex; flex-direction: column; gap: 6px">
<span style="font-size: 14px; font-weight: 600; color: ${C.ink}">Staff notes</span>
${staffNotes.length ? `<div>${staffNotes.map((n) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid ${C.border}"><span style="font-size: 12px; color: ${C.muted}">${esc(n.who)} · ${esc(n.when)}</span><span style="font-size: 14px; color: ${C.ink}">${esc(n.text)}</span></div>`).join('')}</div>` : ''}
<div style="display: flex; gap: 8px"><input id="nj-staffnote-${size}" type="text" placeholder="Add a note for other staff" aria-label="Add a note for other staff" style="flex-grow: 1; min-width: 0; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 11px 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">${button('Add note', { variant: 'default' })}</div>
${hint('Internal only — not shown to the customer.')}
</div>`;
  if (size === 'phone') {
    // Decision 54: the chosen time and mechanic lead the form.
    return [whenBlock, newBuild, customer, bike, work, title, receipt, status, hereNow, storage, staff].join('\n');
  }
  const col = (label, inner) => `<section aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${inner}</section>`;
  return `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; align-items: start">
${col('When', `${whenBlock}${storage}${staff}`)}
${col('Customer and bike', `${newBuild}${customer}${bike}${receipt}`)}
${col('The work', `${work}${title}${status}${hereNow}`)}
</div>`;
}
// The form itself stays a readable single column at tablet/phone (brief
// leaves this open — decision: the outer pop-up still takes most of the
// screen, per decision 16); desktop uses two columns (item 26).
function newJobDialog(size, w, h, pad, { baseFn, closeId = 'diary', bodyOpts = {} } = {}) {
  const base = size === 'desktop'
    ? shellDesktop('diary', 'Workshop diary', baseFn('desktop'))
    : shellTablet('diary', 'Workshop diary', baseFn('tablet'));
  const id = 'new-job-title';
  const maxW = size === 'desktop' ? 1000 : 1100;
  const centered = `<div style="max-width: ${maxW}px; margin: 0 auto; width: 100%">${newJobBody(size, bodyOpts)}</div>`;
  // A single scrolling column (unlike the job pages' two independently
  // scrolling columns), so the service select's warning banner (item 23)
  // never sits clipped below the fold — dialogBody's overflow:hidden is
  // right for those, not for this longer form; the footer (Cancel/Save job)
  // stays pinned outside the scrolling body either way.
  // Part A.4 (29 Sep round 3, decision 66 follow-up): the branching pills
  // (work group + service, starting status, storage) wrap onto more lines
  // than the selects they replaced, so the strict fit check (inside
  // overflow:hidden/auto — a static canvas can't prove there's more past a
  // scrollbar) found both new-job and new-job-day taller than this pop-up
  // again. Tightened the same way as Part A.3: body padding 14px→10px here.
  const body = size === 'desktop'
    ? `<div style="flex-grow: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; padding: 6px 20px; display: flex; flex-direction: column; gap: 14px">${centered}</div>`
    : `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: 14px 24px; display: flex; flex-direction: column">${centered}</div>`; // tablet: fits without scrolling (decision 68)
  const footer = size !== 'phone'
    ? row(`${button('Cancel', { variant: 'ghost', href: `${closeId}-${size}.dc.html` })}<div style="flex-grow: 1"></div>${button('Save job', { variant: 'primary' })}`, 10)
    : button('Save', { block: true });
  return dialogOverlay(base, w, h, `${dialogHeader('New job', `${closeId}-${size}.dc.html`, '', id, size)}${body}${dialogFooter(footer)}`, { pad, full: true, labelledby: id });
}
// Tue 15 Sep · 10:00 · Alex Morgan has 30 minutes free before Alex's next job
// (10:30, WH-1081) — item 23's warning example. Ready by (decision 51) is the
// diary day chosen above — Tue 15 Sep — not a separate field.
// Decision 66: drawn with "Full service" → "Standard service · 60 min" selected.
const NEW_JOB_OPTS = { freeMinutes: 30, service: 'Standard service', storageDefault: 'Hook 3', receiptNote: 'Rear brake squeals and feels weak.' };
screens['new-job'] = {
  desktop: newJobDialog('desktop', DW, DH, 6, { baseFn: (s) => diaryFrozenContent(s), bodyOpts: NEW_JOB_OPTS }),
  tablet: newJobDialog('tablet', TW, TH, 20, { baseFn: (s) => diaryPickContent(s), bodyOpts: NEW_JOB_OPTS }),
  phone: dialogPhone('New job', 'new-job-pick-phone.dc.html', newJobBody('phone', NEW_JOB_OPTS), button('Save job', { variant: 'primary', block: true }), '', { scroll: true, backLabel: 'Cancel, back to the diary', bodyGap: 14 }),
};
keepDesktopSeq('new-job');
// new-job-day (brief item 2): opened from Jo's column in the day view, Thu 17
// Sep 16:00 — the mechanic is pre-filled from the column clicked, not chosen
// automatically, and there's no matching customer search result yet. Jo's
// last job ends exactly at 16:00, so there are 120 minutes free until the
// 18:00 grid end — no warning (item 23: "keep, ... no warning"). Item 26: the
// bike is already here, so "The bike is here now" is ticked and the starting
// status is "Bike is here"; a staff note is already on the job. Decision 66:
// drawn with "Individual service" open, "Gear adjustment · 60 min" selected
// — 60 well under the 120 free minutes, so the won't-fit warning stays off.
const NEW_JOB_DAY_OPTS = {
  when: 'Thu 17 Sep · 16:00', mechanic: 'Jo Taylor', mechHint: 'Mechanic from the column you clicked.', showCustomer: false, freeMinutes: 120,
  service: 'Gear adjustment', startingStatusIdx: 1, bikeHereChecked: true, storageDefault: 'Hook 5',
  receiptNote: 'Please check the bottom bracket — the customer says there is play.',
  staffNotes: [{ who: 'Jo Taylor', when: '16:02', text: 'Customer will collect after work.' }],
};
screens['new-job-day'] = {
  desktop: newJobDialog('desktop', DW, DH, 6, { baseFn: (s) => diaryDayFrozenContent(s), closeId: 'diary-day', bodyOpts: NEW_JOB_DAY_OPTS }),
  tablet: newJobDialog('tablet', TW, TH, 20, { baseFn: (s) => diaryDayFrozenContent(s), closeId: 'diary-day', bodyOpts: NEW_JOB_DAY_OPTS }),
  phone: dialogPhone('New job', 'diary-day-phone.dc.html', newJobBody('phone', NEW_JOB_DAY_OPTS), button('Save job', { variant: 'primary', block: true }), '', { scroll: true, backLabel: 'Cancel, back to the diary', bodyGap: 14 }),
};
// new-job-pick (desktop only, item 1 of the 27 Sep round): the state after
// pressing "New job" in the diary toolbar — the button reads "Choose a time",
// a slim instruction bar sits above the grid, free time is gently tinted and
// busy blocks fade back, and the picked slot (Tue 15 Sep · 10:00 · Alex, which
// stays free in the example data) shows as a solid hover target linking to
// new-job-desktop. Tablet and phone (decision 68) draw the same step: "Tap a
// free time", with a Cancel button in place of Esc.
function pickInstructionBar(size) {
  if (size !== 'desktop') return `<div role="status" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 1px 1px 1px 14px; border-radius: 8px; background: ${C.hover}; border: 1px solid ${C.accent}; font-size: 14px; font-weight: 600; color: ${C.accentDark}">
<span>Tap a free time ${size === 'phone' ? '' : 'in the diary '}for the new job.</span>
<a href="diary-${size}.dc.html" style="display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; font-size: 14px; font-weight: 600; text-decoration: none; flex-shrink: 0">Cancel</a>
</div>`;
  return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 14px; border-radius: 8px; background: ${C.hover}; border: 1px solid ${C.accent}; font-size: 13px; font-weight: 600; color: ${C.accentDark}">
<span>Click a free time in the diary for the new job. Esc to cancel.</span>
<a href="diary-${size}.dc.html" style="display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; font-size: 13px; font-weight: 600; text-decoration: none">Cancel</a>
</div>`;
}
// Part A.3 (29 Sep audit follow-up): a further 13px of the day grid was cut
// off by main's overflow:hidden — not called out in the brief's two named
// findings, but caught by the same strict check, so fixed the same way
// (tightened stack/bar spacing, not a bigger board).
function diaryPickContent(size) {
  if (size !== 'desktop') return tabletDiaryContent({ pickMode: true, selectSlot: HINT_SLOT });
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { newJob: 'active' })}
${pickInstructionBar(size)}
${row(`${waitingColumn(size, -1)}${weekGrid({ days, size, slotH, mechFilter: 'Everyone', pickMode: true, selectSlot: HINT_SLOT })}`, 16, 'align-items: flex-start')}`, 8);
}
screens['new-job-pick'] = {
  desktop: shellDesktop('diary', 'Workshop diary', diaryPickContent('desktop')),
  tablet: shellTablet('diary', 'Workshop diary', diaryPickContent('tablet')),
  phone: phoneDiary({ day: HINT_SLOT.day, pickMode: true, selectSlot: HINT_SLOT }),
};

// ---------- Row 4: The job — ONE page, no tabs (decision 20 supersedes the
// five tabs; decision 21's checklist notes). Every stage (job-overview,
// job-book-in, job-quote, job-mechanic, job-waiting-parts, job-finished,
// job-collection) is the same page, differing only in status/stage, which
// section is emphasised, and the footer's action(s) — brief item 5. ----------
const jobCloseHref = (size, mechanic = false) => `${mechanic ? 'diary-mechanic' : 'diary'}-${size}.dc.html`;

function quickNoteRow(n, size = 'desktop') {
  const tag = n.who === 'Customer'
    ? `<span style="display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; background: ${C.mutedBg}; color: ${C.muted}; font-size: ${size === 'desktop' ? 11 : 12}px; font-weight: 700">Customer</span>`
    : `<span style="font-size: 12px; font-weight: 700; color: ${C.muted}">${esc(n.who)}</span><span style="font-size: 12px; color: ${C.muted}">${mono(n.when)}</span>`;
  return `<div style="display: flex; flex-direction: column; gap: 3px">
<div style="display: flex; align-items: center; gap: 6px">${tag}</div>
<p style="margin: 0; font-size: 14px; line-height: 1.4; color: ${C.ink}">${esc(n.text)}</p>
</div>`;
}
function jobQuickOverviewBody(size) {
  const approvedTotal = LINES.filter((_, i) => DECISIONS[i][0] === 'Approved').reduce((sum, [, , a]) => sum + Number(a.replace('£', '')), 0);
  return `${panel(`${h2('Notes', 14)}${stack(QUICK_NOTES.map((n) => quickNoteRow(n, size)).join(''), 10)}`, '', 14, 8)}
${panel(`${h2('Line items', 14)}${table([['Work'], ['Amount', 'right']], LINE_ORDER.map((i) => { const [w, s, a] = LINES[i]; return [two(w, s), DECISIONS[i][0] === 'Declined' ? mono(a, `text-decoration: line-through; color: ${C.muted}`) : mono(a)]; }), { size: 13, pad: '7px 8px' })}<div style="display: flex; align-items: center; gap: 6px; padding-top: 4px"><span style="font-size: ${size === 'desktop' ? 11 : 12}px; color: ${C.muted}">Declined lines are struck through.</span></div>`, '', 14, 8)}
${row(`<span style="font-size: 15px; font-weight: 700">Cost</span><span style="flex-grow: 1"></span>${mono(`£${approvedTotal.toFixed(2)}`, 'font-size: 18px; font-weight: 700')}`, 10)}
${size === 'phone' ? '' : size === 'tablet' ? `<div>${touchLink('Open job', `job-overview-${size}.dc.html`)}</div>` : `<div>${link('Open job', `job-overview-${size}.dc.html`)}</div>`}`;
}
screens['job-quick-overview'] = {
  desktop: (() => {
    const base = shellDesktop('diary', 'Workshop diary', diaryFrozenContent('desktop', { highlightJob: { type: 'job', job: 'WH-1042' } }));
    return dialogOverlay(base, DW, DH, `${dialogHeader('Standard service · WH-1042', 'diary-desktop.dc.html', 'Maya Patel · Trek Domane AL 3', 'quick-overview-title')}${dialogBody(jobQuickOverviewBody('desktop'), 18, 14)}`, { pad: 40, maxWidth: 560, labelledby: 'quick-overview-title' });
  })(),
  tablet: dialogOverlay(tabletDiary({ highlightJob: { type: 'job', job: 'WH-1042' } }), TW, TH, `${dialogHeader('Standard service · WH-1042', 'diary-tablet.dc.html', 'Maya Patel · Trek Domane AL 3', 'quick-overview-title', 'tablet')}${dialogBody(jobQuickOverviewBody('tablet'), 18, 14)}`, { pad: 40, maxWidth: 560, labelledby: 'quick-overview-title' }),
  // Phone: the overview fills the screen (decision 15/16's phone rule), Open
  // job pinned at the bottom.
  phone: dialogPhone('Standard service · WH-1042', 'diary-phone.dc.html', jobQuickOverviewBody('phone'), button('Open job', { block: true, href: 'job-overview-phone.dc.html' }), 'Maya Patel · Trek Domane AL 3'),
};
// ---------- The settled job page (decision 40) — job-page.mjs's job-final-2
// rendering, driven by each stage's data, at all three sizes (see
// buildJobPage below).
export const DECLINED_NOTE_TEXT = 'Gear cable declined. Anything beyond these lines needs a new approval.';
const WORK_LINE_SERVICE = { work: 'Standard service', sub: 'Labour · 60 min', code: '', qty: '1', price: 65.0 };
const WORK_LINE_PADS = { work: 'Shimano brake pads', sub: 'Part · B05S-RX', code: 'B05S-RX', qty: '1', price: 28.0, note: 'Rear pads worn — replacing' };
const WORK_LINE_BRAKES = { work: 'Fit & adjust brakes', sub: 'Labour · 30 min', code: '', qty: '1', price: 18.0 };
const WORK_LINE_CABLE = { work: 'Replace gear cable', sub: 'Optional · cable still serviceable', code: '', qty: '1', price: 12.0 };
export const WORK_TOTAL_APPROVED = 111.0; // service + pads + brakes (cable declined)
const WORK_TOTAL_QUOTE = 123.0; // all four lines, pending
const LINES_EXPECTED = [{ ...WORK_LINE_SERVICE, approval: 'Booked' }];
const LINES_QUOTE = [WORK_LINE_SERVICE, WORK_LINE_PADS, WORK_LINE_BRAKES, WORK_LINE_CABLE].map((l) => ({ ...l, approval: 'Awaiting approval' }));
export const LINES_APPROVED = [
  { ...WORK_LINE_SERVICE, approval: 'Approved' },
  { ...WORK_LINE_PADS, approval: 'Approved' },
  { ...WORK_LINE_BRAKES, approval: 'Approved' },
  { ...WORK_LINE_CABLE, approval: 'Declined' },
];
const LINES_WAITING = LINES_APPROVED.map((l) => (l.work === 'Shimano brake pads' ? { ...l, approval: 'On order' } : l));
// Checklist counts (decision 40's rollout): 0 of 10 before work starts, 8 of
// 10 once in the workshop — CHECKLIST_10's own fixed data (8 checked, 1
// noted), kept the same at every later stage per the brief ("if the data
// doesn't say, keep 8 of 10 and don't invent").
export const CHECKLIST_CHECKED = CHECKLIST_10.filter((c) => c.checked).length; // 8
export const CHECKLIST_NOTED = CHECKLIST_10.filter((c) => c.note).length; // 1
export const NOTES_CUSTOMER = [CUSTOMER_NOTE];
const NOTES_STAFF_NONE = [];
const NOTES_STAFF_BOOKED = [STAFF_NOTE_BOOKED_IN];
export const NOTES_STAFF_FULL = [STAFF_NOTE_BOOKED_IN, STAFF_NOTE_BRAKES];

// Compact stage-only top sections (task item 1's "any stage-only section from
// the stages table") — same texts as the tablet/phone top()s below
// (bookInTop/waitingTop/finishedTop/collectionTop), repacked to fit the
// notes-box layout's tighter vertical budget.
function tagStripCompact(size = 'desktop') {
  const f = size === 'desktop' ? 11 : 12;
  return jpPanel(`${jpRow(`${barcode128('WH-1042', 140, 26)}<div style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><div style="display: flex; align-items: center; gap: 8px">${jpH2('Bike tag sent', 13)}${badge('Acknowledged', 'green')}</div><span style="font-size: ${f}px; color: ${C.muted}">Front desk Zebra · 1 copy · ${jpMono('09:12')} · printed by Jack Lewis</span><span style="font-size: ${f}px; color: ${C.muted}">Attach the tag where it can be scanned without removing it from the bike.</span></div>`, 12, 'align-items: center')}`, '', 6, 0);
}
function waitingStripCompact(size = 'desktop') {
  return jpPanel(`${jpRow(`${badge('Waiting for parts', 'amber')}<span style="font-size: 13px; font-weight: 600">Replacement rear brake pads delayed</span><span style="flex-grow: 1"></span><span style="font-size: 12px; color: ${C.muted}">Moved to ${jpMono('Sat 19 Sep · 16:00')} in the diary</span>`, 10)}<span style="font-size: ${size === 'desktop' ? 11 : 12}px; color: ${C.muted}; line-height: 1.3">The brake pads are arriving later than expected. We’ve moved your job to Saturday at 16:00 in the diary and will confirm as soon as your bike is ready.</span>`, `border-color: ${ST.waiting[1]}`, 6, 3);
}
function finishedStripCompact() {
  return jpPanel(`${jpRow(`<span style="font-size: 13px">Alex finished the work and final checks at ${jpMono('15:30')}. The bike is still in the shop.</span><span style="flex-grow: 1"></span><span style="font-size: 13px; font-weight: 700">Agreed work ${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span>`, 10)}`, '', 6, 0);
}
// H5 (29 Sep audit): the old banner read past-tense ("Bike handed to the
// customer... Taken at the Wheelhouse till today at 16:52") right next to a
// "Record collection" button and a "Ready for collection" status — unclear
// whether the bike had already left. Split in two: this strip states only
// the one thing that's already a settled fact (payment), as a fact, with no
// clock-time that could read as "the whole handover already happened".
function collectionStripCompact() {
  return jpPanel(`${jpRow(`${badge('Paid', 'green')}<span style="font-size: 13px; font-weight: 700">${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span><span style="flex-grow: 1"></span><span style="font-size: 12px; color: ${C.muted}">Payment already taken.</span>`, 8)}`, '', 6, 3);
}
// Collect the bike and pay decision 3 (30 Sep): no separate "Record
// collection" step. Paid already (online, or in full earlier) — "Hand over"
// records collection in one tap. The two hand-back ticks are optional
// reminders a shop can switch on (Settings › Workshop › Collection), off by
// default, so they are not drawn here.
const handOverFooter = (size) => `${button('Hand over', { variant: 'primary', block: true })}${note('Records that the bike has gone.', size === 'phone' ? 13 : 12)}`;
// Not paid yet — "Take payment" opens the till with the job loaded and
// "Bike collected when paid" on (Selling at the till 10); paying records
// collection.
function unpaidStripCompact() {
  return jpPanel(`${jpRow(`${badge('To pay', 'amber')}<span style="font-size: 13px; font-weight: 700">${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span><span style="flex-grow: 1"></span><span style="font-size: 12px; color: ${C.muted}">Customer told the bike is ready.</span>`, 8)}`, '', 6, 3);
}
const takePaymentFooter = (size) => `${button('Take payment', { variant: 'primary', block: true })}${note('Opens the till with this job. Paying also records collection.', size === 'phone' ? 13 : 12)}`;

// Decision 51 (28 Sep 2026): ready-by is the diary day, not a separate field
// — WH-1042 sits Thu 17 Sep 11:30–13:00 in the diary, so "Ready by Thu 17
// Sep" everywhere by default. The one exception is waiting-for-parts, which
// passes its own readyBy (the day the job is moved to in the diary, per the
// "Revised ready" date below) so the header badge and the compact left
// column agree with the stage-specific delay text.
export const JOB_READY_BY = 'Thu 17 Sep';
export function buildJobPageDesktop({
  mechanic = false, jobNum = 'WH-1042', status, tone, closeHref,
  stageTop = '', customerTexts, staffTexts, checkedCount, notedCount,
  checklistHref = null, leftStatus, bikeHere,
  lines, totalLabel, totalValue, footerNote = '', quoteAction = false,
  totalBadge = '', footer, limit, readyBy = JOB_READY_BY,
  twoRowHeader = true, // S2 (decision 58, 29 Sep audit) — see job-page.mjs's jobPopupContent; pass false for idea-s2-before's old-record only
}) {
  const opts = mechanic ? { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' } : {};
  const base = shellDesktop('diary', 'Workshop diary', mechanic ? diaryFrozenContentMechanic('desktop') : diaryFrozenContent('desktop'), opts);
  const customer = { ...JOB_CUSTOMER, storageSlot: STORAGE[jobNum] };
  const content = jobPopupContent({
    titleId: 'job-page-title', jobTitle: 'Standard service', status, tone, closeHref,
    customer, mechanicName: 'Alex Morgan', custHref: 'customer-desktop.dc.html',
    jobNum, created: 'Created Thu 17 Sep · by Jo Taylor', limit,
    readyByBadge: badge(`Ready by ${readyBy}`, 'grey'), totalBadge,
    left: jpJobLeftCol({ status: leftStatus, diaryTime: 'Thu 17 Sep · 11:30–13:00', readyBy, bikeHere, idPrefix: 'jp' }),
    customerTexts, staffTexts, checkedCount, totalCount: CHECKLIST_10.length, notedCount, checklistHref,
    lines, totalLabel, totalValue, footerNote, quoteAction,
    footer, stageTop, twoRowHeader,
  });
  return dialogOverlay(base, DW, DH, content, { pad: 32, full: true, labelledby: 'job-page-title' });
}

// Phone versions of the stage-only strips (same texts as the desktop compact
// strips above, stacked for a narrow screen).
const phoneStagePanel = (inner, extra = '') => `<div style="flex-shrink: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; ${extra}">${inner}</div>`;
const PHONE_STAGE_TOP = {
  bookIn: () => phoneStagePanel(`<div style="display: flex; align-items: center; gap: 8px">${jpH2('Bike tag sent', 15)}${badge('Acknowledged', 'green')}</div>${barcode128('WH-1042', 200, 34)}<span style="font-size: 13px; color: ${C.muted}">Front desk Zebra · 1 copy · ${jpMono('09:12')} · printed by Jack Lewis</span><span style="font-size: 13px; color: ${C.muted}">Attach the tag where it can be scanned without removing it from the bike.</span>`),
  waiting: () => phoneStagePanel(`<div>${badge('Waiting for parts', 'amber')}</div><span style="font-size: 15px; font-weight: 600">Replacement rear brake pads delayed</span><span style="font-size: 14px">Moved to ${jpMono('Sat 19 Sep · 16:00')} in the diary</span><span style="font-size: 13px; color: ${C.muted}; line-height: 1.35">The brake pads are arriving later than expected. We’ve moved your job to Saturday at 16:00 in the diary and will confirm as soon as your bike is ready.</span>`, `border-color: ${ST.waiting[1]}`),
  finished: () => phoneStagePanel(`<span style="font-size: 14px">Alex finished the work and final checks at ${jpMono('15:30')}. The bike is still in the shop.</span><span style="font-size: 15px; font-weight: 700">Agreed work ${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span>`),
  unpaid: () => phoneStagePanel(`<div style="display: flex; align-items: center; gap: 8px">${badge('To pay', 'amber')}<span style="font-size: 15px; font-weight: 700">${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span></div><span style="font-size: 13px; color: ${C.muted}">Customer told the bike is ready.</span>`),
  collection: () => phoneStagePanel(`<div style="display: flex; align-items: center; gap: 8px">${badge('Paid', 'green')}<span style="font-size: 15px; font-weight: 700">${jpMono(`£${WORK_TOTAL_APPROVED.toFixed(2)}`)}</span></div><span style="font-size: 13px; color: ${C.muted}">Payment already taken.</span>`),
};
// Builds the desktop/tablet/phone triple for one job stage (decision 40: the
// settled job page at every stage). Desktop: buildJobPageDesktop, unchanged.
// Tablet (decision 68): the same pop-up layout — two-row customer strip,
// details + notes box, full work-and-parts table — over the tablet diary, not
// scrolling, with a full 44px Done tick. Phone: one scrolling page
// (jobPhoneSections) with the stage's main action pinned below.
// touch.footer(size) / touch.stageTop(size) / touch.phoneTop give each size's
// own links and text sizes; the desktop config itself is untouched.
function buildJobPage({ jobNum = 'WH-1042', status, tone, mechanic = false, desktop = {}, touch = {} }) {
  const closeHref = (size) => jobCloseHref(size, mechanic);
  const opts = mechanic ? MECH_SHELL : {};
  const common = (size) => ({
    customer: { ...JOB_CUSTOMER, storageSlot: STORAGE[jobNum] }, mechanicName: 'Alex Morgan', custHref: `customer-${size}.dc.html`,
    jobNum, created: 'Created Thu 17 Sep · by Jo Taylor', limit: desktop.limit,
    readyByBadge: badge(`Ready by ${desktop.readyBy || JOB_READY_BY}`, 'grey'), totalBadge: desktop.totalBadge || '',
    left: jpJobLeftCol({ status: desktop.leftStatus, diaryTime: 'Thu 17 Sep · 11:30–13:00', readyBy: desktop.readyBy || JOB_READY_BY, bikeHere: desktop.bikeHere, idPrefix: 'jp-' + size, stackTimes: size === 'phone' }),
    customerTexts: desktop.customerTexts, staffTexts: desktop.staffTexts, checkedCount: desktop.checkedCount, totalCount: CHECKLIST_10.length, notedCount: desktop.notedCount,
    checklistHref: desktop.checklistHref ? `job-checklist-${size}.dc.html` : null,
    lines: desktop.lines, totalLabel: desktop.totalLabel, totalValue: desktop.totalValue, footerNote: desktop.footerNote, quoteAction: !!desktop.quoteAction,
  });
  const tablet = () => {
    const base = shellTablet('diary', 'Workshop diary', mechanic ? diaryFrozenContentMechanic('tablet') : diaryFrozenContent('tablet'), opts);
    const content = jobPopupContent({ ...common('tablet'), titleId: 'job-page-title', jobTitle: 'Standard service', status, tone, closeHref: closeHref('tablet'), footer: touch.footer('tablet'), stageTop: touch.stageTop ? touch.stageTop('tablet') : '', doneH: 44, touchLinks: true });
    return dialogOverlay(base, TW, TH, content, { pad: 20, full: true, labelledby: 'job-page-title' });
  };
  const phone = () => dialogPhone('Standard service', closeHref('phone'), jobPhoneSections({ ...common('phone'), stageTop: touch.phoneTop ? touch.phoneTop() : '' }), touch.footer('phone'), '', { scroll: true, titleExtra: badge(status, tone), bodyGap: 10 });
  return {
    desktop: buildJobPageDesktop({ ...desktop, jobNum, status, tone, mechanic, closeHref: closeHref('desktop') }),
    tablet: tablet(),
    phone: phone(),
  };
}

// 9. job-overview — "Job · expected". Notes: only the customer's booking
// section (decision 40's rollout — nothing's happened yet). Checklist: 0 of
// 10. Work: the booked service line only, not yet started.
screens['job-overview'] = buildJobPage({
  status: 'Expected', tone: 'blue',
  touch: { footer: (size) => button('Book in', { variant: 'primary', block: true, href: `job-book-in-${size}.dc.html` }) },
  desktop: {
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_NONE,
    checkedCount: 0, notedCount: 0,
    leftStatus: 'Expected', bikeHere: false,
    lines: LINES_EXPECTED, totalLabel: 'Booked', totalValue: WORK_LINE_SERVICE.price, footerNote: '',
    footer: button('Book in', { variant: 'primary', block: true, href: 'job-book-in-desktop.dc.html' }),
  },
});
keepDesktopSeq('job-overview');

screens['job-book-in'] = buildJobPage({
  status: 'In workshop', tone: 'blue',
  touch: {
    footer: (size) => `${button('Send quote', { variant: 'default', block: true, href: `job-quote-${size}.dc.html` })}${button('Start work', { variant: 'primary', block: true, href: `job-mechanic-${size}.dc.html` })}`,
    stageTop: (size) => tagStripCompact(size), phoneTop: PHONE_STAGE_TOP.bookIn,
  },
  desktop: {
    stageTop: tagStripCompact(),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_BOOKED,
    checkedCount: 0, notedCount: 0,
    leftStatus: 'In workshop', bikeHere: true,
    lines: LINES_EXPECTED, totalLabel: 'Booked', totalValue: WORK_LINE_SERVICE.price, footerNote: '',
    footer: `${button('Send quote', { variant: 'default', block: true, href: 'job-quote-desktop.dc.html' })}${button('Start work', { variant: 'primary', block: true, href: 'job-mechanic-desktop.dc.html' })}`,
  },
});
keepDesktopSeq('job-book-in');

// 11. job-quote — "Job · quote"; the quote (left column) is in edit mode on
// tablet/phone. Desktop: the four lines pending approval, "Send quote" both
// in the table toolbar and the footer.
screens['job-quote'] = buildJobPage({
  status: 'Awaiting approval', tone: 'purple',
  touch: { footer: () => button('Send quote', { variant: 'primary', block: true }) },
  desktop: {
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_BOOKED,
    checkedCount: 0, notedCount: 0,
    leftStatus: 'Awaiting approval', bikeHere: true,
    lines: LINES_QUOTE, totalLabel: 'Proposed total', totalValue: WORK_TOTAL_QUOTE, footerNote: '', quoteAction: true,
    // Item 43 (decision 43): a customer who set no spending limit always
    // gets a quote — this board is the consistent example of when a quote
    // IS sent, so its tag reads "No spending limit set" rather than Maya's
    // real "OK up to £200" (under which her £123 quote would be skipped).
    limit: 'No spending limit set',
    totalBadge: badge(`Proposed £${WORK_TOTAL_QUOTE.toFixed(2)}`, 'purple'),
    footer: button('Send quote', { variant: 'primary', block: true }),
  },
});
keepDesktopSeq('job-quote');

// 12. job-mechanic — "Job · in the workshop (mechanic)"; the worked example
// (decision 40's base board, job-final-2 itself) — close → diary-mechanic;
// the "Full service checklist" bar links to job-checklist (task item 2).
screens['job-mechanic'] = buildJobPage({
  status: 'In workshop', tone: 'blue', mechanic: true,
  touch: { footer: (size) => button('Mark ready for collection', { variant: 'primary', block: true, href: `job-finished-${size}.dc.html` }) },
  desktop: {
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    checklistHref: 'job-checklist-desktop.dc.html',
    leftStatus: 'In workshop', bikeHere: true,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: button('Mark ready for collection', { variant: 'primary', block: true, href: 'job-finished-desktop.dc.html' }),
  },
});
keepDesktopSeq('job-mechanic');

// 13. job-waiting-parts — "Job · waiting for parts"; a delay/parts section on
// top (tablet/phone: waitingTop; desktop: waitingStripCompact, same texts).
// Decision 51: a revised date here is the day the job is moved to in the
// diary, said plainly — WAITING_READY_BY (Sat 19 Sep) is that moved-to day,
// so the field's label says "in the diary" and the job page's own ready-by
// badge/field (readyBy below) match it rather than the ordinary Thu 17 Sep.
const WAITING_READY_BY = 'Sat 19 Sep';
screens['job-waiting-parts'] = buildJobPage({
  status: 'Waiting for parts', tone: 'amber',
  touch: {
    footer: (size) => `${button('Mark ready for collection', { variant: 'default', block: true })}${note('Target dates are estimates. This update does not mark the bike ready.', size === 'phone' ? 13 : 12)}`,
    stageTop: (size) => waitingStripCompact(size), phoneTop: PHONE_STAGE_TOP.waiting,
  },
  desktop: {
    stageTop: waitingStripCompact(),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    leftStatus: 'Waiting for parts', bikeHere: true, readyBy: WAITING_READY_BY,
    lines: LINES_WAITING, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: `${button('Mark ready for collection', { variant: 'default', block: true })}${note('Target dates are estimates. This update does not mark the bike ready.', 12)}`,
  },
});
keepDesktopSeq('job-waiting-parts');

screens['job-finished'] = buildJobPage({
  status: 'Work finished', tone: 'grey',
  touch: {
    footer: (size) => `${button('Mark ready & notify customer', { block: true })}${button('Take payment', { variant: 'primary', block: true, href: 'job-collection-' + size + '.dc.html' })}${note('Goes to this shop’s till — the Wheelhouse till or Lightspeed — as set in Settings.', size === 'phone' ? 13 : 12)}`,
    stageTop: () => finishedStripCompact(), phoneTop: PHONE_STAGE_TOP.finished,
  },
  desktop: {
    stageTop: finishedStripCompact(),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    leftStatus: 'Work finished', bikeHere: true,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: `${button('Mark ready & notify customer', { block: true })}${button('Take payment', { variant: 'primary', block: true, href: 'job-collection-desktop.dc.html' })}${note('Goes to this shop’s till — the Wheelhouse till or Lightspeed — as set in Settings.', 12)}`,
  },
});
keepDesktopSeq('job-finished');

screens['job-collection'] = buildJobPage({
  status: 'Ready for collection', tone: 'green',
  touch: {
    footer: (size) => handOverFooter(size),
    stageTop: () => collectionStripCompact(), phoneTop: PHONE_STAGE_TOP.collection,
  },
  desktop: {
    stageTop: collectionStripCompact(),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    leftStatus: 'Ready for collection', bikeHere: true,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: handOverFooter('desktop'),
  },
});
keepDesktopSeq('job-collection');



// 16. job-checklist — "Job · full service checklist" (task item 2): the Full
// service checklist full-screen pop-up (as job-final-2-detailed), stacked
// over the (dimmed) job-mechanic pop-up — the in-the-workshop stage, where a
// mechanic actually fills it in. Its Done/close both return to job-mechanic.
screens['job-checklist'] = {
  desktop: (() => {
    const base = shellDesktop('diary', 'Workshop diary', diaryFrozenContentMechanic('desktop'), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' });
    const jobLayer = jobPopupContent({
      titleId: 'job-page-title', jobTitle: 'Standard service', status: 'In workshop', tone: 'blue', closeHref: 'diary-mechanic-desktop.dc.html',
      customer: { ...JOB_CUSTOMER, storageSlot: STORAGE['WH-1042'] }, mechanicName: 'Alex Morgan', custHref: 'customer-desktop.dc.html',
      jobNum: 'WH-1042', created: 'Created Thu 17 Sep · by Jo Taylor',
      readyByBadge: badge(`Ready by ${JOB_READY_BY}`, 'grey'), totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
      left: jpJobLeftCol({ status: 'In workshop', diaryTime: 'Thu 17 Sep · 11:30–13:00', readyBy: JOB_READY_BY, bikeHere: true, idPrefix: 'jpc' }),
      customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL, checkedCount: CHECKLIST_CHECKED, totalCount: CHECKLIST_10.length, notedCount: CHECKLIST_NOTED, checklistHref: null,
      lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT, quoteAction: false,
      footer: button('Mark ready for collection', { variant: 'primary', block: true, href: 'job-finished-desktop.dc.html' }),
    });
    return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${base}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 32px">
<div role="dialog" aria-modal="true" aria-hidden="true" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${jobLayer}
</div>
</div>
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.55); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 20px">
${fullChecklistDialog({ titleId: 'job-checklist-title', subtitle: 'Standard service · WH-1042 · Trek Domane AL 3', checklist: CHECKLIST_10, doneHref: 'job-mechanic-desktop.dc.html', closeHref: 'job-mechanic-desktop.dc.html', idPrefix: 'jc' })}
</div>
</div>`;
  })(),
  // Tablet: the same full-screen pop-up stacked over the (dimmed) job, over
  // the mechanic's tablet diary.
  tablet: (() => {
    const base = shellTablet('diary', 'Workshop diary', diaryFrozenContentMechanic('tablet'), MECH_SHELL);
    const jobLayer = jobPopupContent({
      titleId: 'job-page-title', jobTitle: 'Standard service', status: 'In workshop', tone: 'blue', closeHref: 'diary-mechanic-tablet.dc.html',
      customer: { ...JOB_CUSTOMER, storageSlot: STORAGE['WH-1042'] }, mechanicName: 'Alex Morgan', custHref: 'customer-tablet.dc.html',
      jobNum: 'WH-1042', created: 'Created Thu 17 Sep · by Jo Taylor',
      readyByBadge: badge(`Ready by ${JOB_READY_BY}`, 'grey'), totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
      left: jpJobLeftCol({ status: 'In workshop', diaryTime: 'Thu 17 Sep · 11:30–13:00', readyBy: JOB_READY_BY, bikeHere: true, idPrefix: 'jpc-tablet' }),
      customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL, checkedCount: CHECKLIST_CHECKED, totalCount: CHECKLIST_10.length, notedCount: CHECKLIST_NOTED, checklistHref: null,
      lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT, quoteAction: false, doneH: 44, touchLinks: true,
      footer: button('Mark ready for collection', { variant: 'primary', block: true, href: 'job-finished-tablet.dc.html' }),
    });
    return `<div style="position: relative; width: ${TW}px; height: ${TH}px; overflow: hidden">
${base}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 20px">
<div role="dialog" aria-modal="true" aria-hidden="true" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${jobLayer}
</div>
</div>
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.55); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 14px">
${fullChecklistDialog({ titleId: 'job-checklist-title', subtitle: 'Standard service · WH-1042 · Trek Domane AL 3', checklist: CHECKLIST_10, doneHref: 'job-mechanic-tablet.dc.html', closeHref: 'job-mechanic-tablet.dc.html', idPrefix: 'jc-tablet' })}
</div>
</div>`;
  })(),
  // Phone: a full-screen page of collapsed tick-and-label rows (decision 58,
  // S3) — a note shows only where one exists — with Done pinned below.
  phone: dialogPhone('Full service checklist', 'job-mechanic-phone.dc.html',
    `<span style="font-size: 14px; color: ${C.muted}">${CHECKLIST_CHECKED} of ${CHECKLIST_10.length} done · ${CHECKLIST_NOTED} note${CHECKLIST_NOTED === 1 ? '' : 's'}</span><div>${CHECKLIST_10.map((it, i) => fullChecklistItemCollapsed(it, `jc-phone-${i}`)).join('')}</div>`,
    button('Done', { variant: 'primary', block: true, href: 'job-mechanic-phone.dc.html' }), 'Standard service · WH-1042 · Trek Domane AL 3', { backLabel: 'Close, back to the job', bodyGap: 4, bodyPad: 16 }),
};


// ---------- Row 5: Overview page (stage2 `desk`, under Workshop › Overview) ----------
const STATS_DESK = [['Expected today', '8 bikes', '3 still to arrive'], ['In the workshop', '12', '4 ready to collect'], ['Planned effort', '6h / 8h', 'Shared and assigned, counted once']];
const ARRIVALS = [
  ['WH-1042', 'Maya Patel', 'Trek Domane AL 3', 'Standard service', (size = 'desktop') => button('Book in', { size: size === 'desktop' ? 'sm' : 'default', href: `job-overview-${size}.dc.html` })],
  ['WH-1045', 'Jamie Brooks', 'Giant Escape 2', 'Gear adjustment', (size = 'desktop') => `<span style="font-size: ${size === 'desktop' ? 13 : 14}px">${mono('10:30')} appointment</span>`],
  ['WH-1047', 'Aisha Khan', 'Cannondale Quick', 'Safety check', (size = 'desktop') => `<span style="font-size: ${size === 'desktop' ? 13 : 14}px">Drop-off</span>`],
];
// M7 (29 Sep audit): "6h / 8h" takes a moment of mental maths to read as a
// proportion, sitting beside two cards that are plain counts — a thin fill
// bar tells the same story with no reading required. Only "Planned effort"
// has a ratio shape ("Nh / Nh") to parse; the other two stat cards are plain
// counts and stay as they are.
const statFill = (pct) => `<div role="img" aria-label="${pct}% of planned effort used today" style="width: 100%; height: 4px; border-radius: 999px; background: ${C.mutedBg}; overflow: hidden"><div style="width: ${pct}%; height: 100%; background: ${C.accent}"></div></div>`;
function overviewContent(size) {
  return stack(`${txt('Thursday 17 September · one shop, one view of the work', 15, `color: ${C.muted}`)}
${grid('repeat(3, minmax(0, 1fr))', STATS_DESK.map(([k, v, s]) => {
    const m = /^(\d+(?:\.\d+)?)h\s*\/\s*(\d+(?:\.\d+)?)h$/.exec(v);
    const fill = m ? statFill(Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100))) : '';
    return panel(`${eyebrow(k)}<div style="font-size: 24px; font-weight: 700">${esc(v)}</div>${fill}${note(s)}`, '', 16, 4);
  }).join(''))}
${size === 'desktop' ? segmented(['Arrivals · 3', 'Shared queue · 4', 'Needs attention · 2', 'Ready · 4'], 0, 'Show jobs') : segmented(['Arrivals · 3', 'Shared queue · 4', 'Needs attention · 2', 'Ready · 4'], 0, 'Show jobs', 44, 14)}
${card(table([['Job / customer'], ['Bike'], ['Work'], ['Custody'], ['', 'right']], ARRIVALS.map(([j, n, b, w, a]) => [`${mono(j)} · ${esc(n)}`, esc(b), esc(w), badge('Expected', 'blue'), a(size)]), size === 'desktop' ? {} : { size: 15, pad: '8px 12px' }), 'overflow: hidden')}`, 14);
}
// Phone overview (decision 68): the same three figures, the same four
// filters (wrapping, 44px), and the arrivals as rows with their action.
function overviewPhoneContent(size) {
  return stack(`${txt('Thursday 17 September · one shop, one view of the work', 14, `color: ${C.muted}`)}
${STATS_DESK.map(([k, v, s]) => {
    const m = /^(\d+(?:\.\d+)?)h\s*\/\s*(\d+(?:\.\d+)?)h$/.exec(v);
    const fill = m ? statFill(Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100))) : '';
    return card(`<div style="padding: 10px 14px; display: flex; flex-direction: column; gap: 4px"><div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px">${eyebrow(k)}<span style="font-size: 20px; font-weight: 700">${esc(v)}</span></div>${fill}<span style="font-size: 13px; color: ${C.muted}">${esc(s)}</span></div>`);
  }).join('')}
${segmented(['Arrivals · 3', 'Shared queue · 4', 'Needs attention · 2', 'Ready · 4'], 0, 'Show jobs', 44, 14)}
${card(ARRIVALS.map(([j, n, b, w, a], i) => `<div style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; ${i ? `border-top: 1px solid ${C.border};` : ''}"><div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${mono(j)} · ${esc(n)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(b)} · ${esc(w)}</span><span>${badge('Expected', 'blue')}</span></div><div style="flex-shrink: 0">${a(size)}</div></div>`).join(''))}`, 10);
}
screens.overview = {
  desktop: shellDesktop('overview', 'Workshop overview', overviewContent('desktop')),
  tablet: shellTablet('overview', 'Workshop overview', overviewContent('tablet')),
  phone: shellPhone('Overview', overviewPhoneContent('phone'), { active: 'overview' }),
};

// ---------- Row 6: Customer account ----------
// Journey 15 decision 11 (30 Sep): the customer page is journey 15's — a
// summary on the left, one history on the right — at every size. Getters,
// because customer.mjs imports this file (see diary-settings above).
export const CUSTOMER_BOARD_H = DH;
screens.customer = {
  get desktop() { return customerPageAt('desktop'); },
  get tablet() { return customerPageAt('tablet'); },
  get phone() { return customerPageAt('phone'); },
};

// 27/28. diary-stack-hover / diary-stack-open (decision 59, 29 Sep round 2,
// task items 3/4): static records of the stacked-card control's hover-
// expanded state and its click-to-choose popover — both built from the real
// weekGrid/stackedJobsBlock, not a redrawn approximation, so what's shown is
// faithful to the live 'stacked' diary. Thursday (TODAY) 09:00 is the same
// stack idea-s4-after/idea-s4-open already used (WH-1038, WH-1040).
const STACK_EXAMPLE = { day: TODAY, start: 9 * 60 };
// diary-stack-hover: the fan baked in (forceExpandStack), no need to hover
// in a still render.
screens['diary-stack-hover'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', -1)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone', forceExpandStack: STACK_EXAMPLE })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  // Tablet/phone: hover becomes press-and-hold (decision 68) — the stack's
  // jobs fan out in place, centred on it, two per row (decision 61).
  tablet: tabletDiary({ forceExpandStack: STACK_EXAMPLE }),
  phone: phoneDiary({ day: TODAY, forceExpandStack: STACK_EXAMPLE }),
};
// diary-stack-open: clicking a stack opens a small popover of the stacked
// jobs as real diary blocks (decision 59) — same tinted-fill/outline
// styling as the grid's own jobBlock, full popover width, each clickable —
// replacing idea-s4-open's plain text list (kept, unchanged, as the old
// record). Anchor coordinates measured against the real rendered 'stacked'
// board (Thursday/today column, 09:00 — WH-1038/WH-1040, same slot
// idea-s4-open measured): x 860.7, y 208, w 91.6, h 83 — fixed since this
// layout is static, not user-resizable.
// Decision 61: the popover follows the same 2-per-row arrangement as the
// hover fan — a grid of two columns, further jobs wrapping to rows beneath,
// rather than one job per row.
function stackOpenPopover(cluster, anchor) {
  const tileW = 122;
  const cols = Math.min(cluster.length, 2);
  const popW = cols === 2 ? tileW * 2 + 8 + 16 : tileW + 16; // tiles + inter-tile gap + panel padding
  const left = anchor.x + anchor.w / 2 - popW / 2;
  const top = anchor.y + anchor.h + 8;
  const blockRow = (j) => {
    const [bg, ink] = ST[j.key];
    const [, bike] = customerBikeOf(j);
    const t0 = `${String(Math.floor(j.start / 60)).padStart(2, '0')}:${String(j.start % 60).padStart(2, '0')}`;
    return `<a href="job-overview-desktop.dc.html" aria-label="${esc(bike)}, ${esc(j.svc || '')}, ${esc(j.job)}" style="display: flex; flex-direction: column; gap: 1px; text-decoration: none; color: inherit; box-sizing: border-box; padding: 7px 8px; border-radius: 6px; background: ${bg}; border: 1.75px solid ${ink}; overflow: hidden">
<span style="font-size: 12px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(bike)}</span>
<span style="font-size: 11px; font-weight: 700; color: ${ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.svc || '')} · ${esc(t0)}</span>
</a>`;
  };
  return `<div role="dialog" aria-label="Choose which job to open" style="position: absolute; left: ${left}px; top: ${top}px; width: ${popW}px; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(28,30,25,0.25); padding: 8px; display: flex; flex-direction: column; gap: 6px; z-index: 20">
<div style="padding: 4px 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${C.muted}">${cluster.length} jobs at 09:00</div>
<div style="display: grid; grid-template-columns: repeat(${cols}, ${tileW}px); grid-auto-rows: max-content; gap: 8px">${cluster.map(blockRow).join('')}</div>
</div>`;
}
screens['diary-stack-open'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${buildDiaryDesktopBoard('stacked')}
${stackOpenPopover(JOBS.filter((j) => j.day === STACK_EXAMPLE.day && j.start === STACK_EXAMPLE.start), { x: 860.7, y: 208, w: 91.6, h: 83 })}
</div>`,
  tablet: tabletDiary({ overlayFor: { day: TODAY, html: tabletStackPopover() } }),
  // Phone: tapping the stack opens a sheet of the stacked jobs as real diary
  // blocks, two per row (decisions 59/61).
  phone: phoneDiary({ day: TODAY }, {
    overlay: phoneSheet({ id: 'stack-sheet-title', title: '2 jobs at 09:00', sub: 'Thursday 17 September · choose one to open', closeHref: 'diary-phone.dc.html',
      body: `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">${JOBS.filter((j) => j.day === STACK_EXAMPLE.day && j.start === STACK_EXAMPLE.start).map((j) => touchStackTile(j, 'phone', 30, null)).join('')}</div>` }),
  }),
};

// diary-hover-summary (decision 65, 29 Sep round 2, task item 3): a static
// record of WH-1042's quick-look card baked open beside it (FORCE_HOVER_
// SUMMARY_JOB, set only for this one build then cleared), the same way
// diary-stack-hover bakes its fan open — everything else on the board (the
// stacked-card control included) keeps its ordinary hover-only behaviour.
screens['diary-hover-summary'] = {
  desktop: (() => {
    FORCE_HOVER_SUMMARY_JOB = 'WH-1042';
    const board = buildDiaryDesktopBoard();
    FORCE_HOVER_SUMMARY_JOB = null;
    return board;
  })(),
  // Tablet/phone (decision 68): hover becomes press-and-hold — keep holding a
  // job and its summary (notes, line items, cost) opens beside it (tablet) or
  // as a sheet (phone).
  tablet: tabletDiary({ highlightJob: { type: 'job', job: 'WH-1042' }, overlayFor: { day: TODAY, html: tabletSummaryPopover() } }),
  phone: phoneDiary({ day: TODAY, highlightJob: { type: 'job', job: 'WH-1042' } }, {
    overlay: phoneSheet({ id: 'job-summary-title', title: 'Standard service · WH-1042', sub: 'Maya Patel · Trek Domane AL 3', closeHref: 'diary-phone.dc.html', maxH: 700,
      body: touchSummaryContent('phone', { twoCol: false }), footer: button('Open job', { variant: 'default', block: true, href: 'job-overview-phone.dc.html' }) }),
  }),
};

// Keep the agreed screen order (brief's Row 1–5 order), with this round's new
// boards (diary-day, diary-settings, change-selected, new-job-day,
// new-job-pick, customer) slotted in beside the screens they extend.
// settings-accessibility (decision 57) is Settings' other tab, so it's
// ordered right after diary-settings here — this only affects the `screens`
// object's own key order (Main page listing etc.), not canvas position; see
// ROWS below for the canvas placement, which is deliberately different so no
// existing board moves.
const ORDER = ['diary', 'diary-mechanic', 'waiting-open', 'diary-day', 'diary-settings', 'change-selected', 'diary-context-menu', 'job-quick-overview', 'diary-stack-hover', 'diary-stack-open', 'diary-hover-summary', 'request-new', 'request-decline', 'request-change', 'request-cancel', 'new-job-pick', 'new-job', 'new-job-day', 'job-overview', 'job-book-in', 'job-quote', 'job-mechanic', 'job-waiting-parts', 'job-finished', 'job-collection', 'job-checklist', 'customer', 'overview'];
const ordered = Object.fromEntries(ORDER.map((k) => [k, screens[k]]));
for (const k of Object.keys(screens)) delete screens[k];
Object.assign(screens, ordered);

export const ROWS = [
  // settings-accessibility is appended at the end (after job-quick-overview,
  // not after diary-settings) so every existing board on the row keeps its
  // x position — build-diary.mjs lays a row out left to right in this array's
  // order, so inserting it mid-row would shift change-selected onward.
  // diary-stack-hover/diary-stack-open (task items 3/4, 29 Sep round 2) are
  // appended after settings-accessibility for the same reason: appending,
  // not inserting, is what puts them at exactly x 12240/13600, y 263 without
  // moving any existing board on this row. diary-hover-summary (29 Sep round
  // 3, task item 3) is appended after diary-stack-open for the same reason
  // again — x 14960, y 263, no existing board moves.
  { label: 'The diary', screens: ['diary', 'diary-mechanic', 'waiting-open', 'diary-day', 'diary-settings', 'change-selected', 'diary-context-menu', 'job-quick-overview', 'diary-stack-hover', 'diary-stack-open', 'diary-hover-summary'] },
  { label: 'Requests, as a pop-up', screens: ['request-new', 'request-decline', 'request-change', 'request-cancel'] },
  { label: 'New job from an empty slot', screens: ['new-job-pick', 'new-job', 'new-job-day'] },
  { label: 'The job — one page, no tabs', screens: ['job-overview', 'job-book-in', 'job-quote', 'job-mechanic', 'job-waiting-parts', 'job-finished', 'job-collection', 'job-checklist'] },
  { label: 'Customer account', screens: ['customer'] },
  { label: 'Overview page', screens: ['overview'] },
];

// Journey 5 (Collect the bike and pay): ready, not paid yet. Drawn for
// journey 5's canvas; not a row of journey 12's.
screens['job-ready-unpaid'] = buildJobPage({
  status: 'Ready for collection', tone: 'green',
  touch: {
    footer: (size) => takePaymentFooter(size),
    stageTop: () => unpaidStripCompact(), phoneTop: PHONE_STAGE_TOP.unpaid,
  },
  desktop: {
    stageTop: unpaidStripCompact(),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    leftStatus: 'Ready for collection', bikeHere: true,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: takePaymentFooter('desktop'),
  },
});
