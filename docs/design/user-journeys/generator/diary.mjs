// Workshop diary redesign — a separate canvas for Jack's review.
// Decisions: docs/decisions/2026-09-27-workshop-day-review.md
// Brief: docs/design/user-journeys/workshop-diary-brief.md
//
// Reuses ui.mjs tokens/helpers and copies the small private helpers/example
// data from stage2.mjs that this needs (per the brief: copy, don't refactor
// stage2). Every screen returns { desktop, tablet, phone } inner markup at
// 1280x800, 1180x820 and 390x844.
import { C, MONO, esc, icon, button, field, card, badge, logoSlot } from './ui.mjs';
import { DW, DH, PW, PH, h1, p, link, stack } from './stage1.mjs';

export const TW = 1180, TH = 820;
const SHOP = 'North Street Cycles';

// ---------- Small helpers copied from stage2.mjs (private there; not exported) ----------
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const h2 = (t, size = 16) => `<h2 style="margin: 0; font-size: ${size}px; line-height: 1.3; font-weight: 700">${esc(t)}</h2>`;
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
const quote = (t) => `<blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid ${C.border}; font-size: 14px; line-height: 1.5; color: ${C.ink}">${esc(t)}</blockquote>`;
const table = (cols, rows, { size = 14, pad = '9px 12px' } = {}) => `<table style="width: 100%; border-collapse: collapse; font-size: ${size}px">
<thead><tr>${cols.map(([c, a]) => `<th scope="col" style="text-align: ${a || 'left'}; padding: 8px 12px; font-size: 12px; font-weight: 600; color: ${C.muted}; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">${c ? esc(c) : '<span style="position: absolute; width: 1px; height: 1px; overflow: hidden">Action</span>'}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align: ${cols[i][1] || 'left'}; vertical-align: middle; padding: ${pad}; border-bottom: 1px solid ${C.border}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const two = (a, b) => `<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">${a}</span><span style="font-size: 13px; color: ${C.muted}">${b}</span></div>`;
const rowCard = (left, right = '', extra = '', pad = '10px 12px') => card(`<div style="padding: ${pad}; display: flex; align-items: center; justify-content: space-between; gap: 10px">${left}${right ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0">${right}</div>` : ''}</div>`, `box-shadow: none; ${extra}`);
const phoneBody = (top, bottom = '', gap = 12) => `<div style="height: 100%; display: flex; flex-direction: column; gap: ${gap}px"><div data-fit style="flex-grow: 1; min-height: 0; display: flex; flex-direction: column; gap: ${gap}px; overflow: hidden">${top}</div>${bottom ? `<div style="display: flex; flex-direction: column; gap: 8px">${bottom}</div>` : ''}</div>`;
const segmented = (items, activeIdx, label) => `<div role="group" aria-label="${esc(label)}" style="display: inline-flex; gap: 6px; flex-wrap: wrap">${items.map((t, i) => `<button type="button" aria-pressed="${i === activeIdx}" style="min-height: 36px; padding: 0 12px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 600; border: 1px solid ${i === activeIdx ? C.accent : C.input}; background: ${i === activeIdx ? C.accent : C.panel}; color: ${i === activeIdx ? '#ffffff' : C.ink}">${esc(t)}</button>`).join('')}</div>`;

// ---------- Wheelhouse status colours (brief exception to "ui.mjs tokens only") ----------
const ST = {
  pending: ['#f1e8fb', '#6a3ea1', 'Pending'],
  scheduled: ['#eaf1fb', '#2c5289', 'Scheduled'],
  waiting: ['#fff0e3', '#a8420f', 'Waiting for parts'],
  hold: ['#fff7e0', '#8a6100', 'Change requested'],
  ready: ['#e8f5ec', '#164f42', 'Ready'],
  cancelled: [C.mutedBg, C.muted, 'Cancelled'],
};
const statusBadge = (key, textOverride) => { const [bg, ink, label] = ST[key]; return `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${esc(textOverride || label)}</span>`; };

// ---------- Rooms — Workshop is now Diary (main page) + Overview (brief) ----------
const ROOMS_DIARY = [
  ['Front desk', [['till', 'Till', 'till', 'OMS'], ['orders', 'Online orders', 'orders', 'OMS'], ['customers', 'Customers', 'customers', 'OMS'], ['messages', 'Messages', 'mail', 'OMS']]],
  ['Workshop', [['diary', 'Diary', 'today', 'OMSK'], ['overview', 'Overview', 'workshop', 'OMSK']]],
  ['Stockroom', [['stock', 'Stock', 'stock', 'OMS'], ['deliveries', 'Deliveries and orders', 'purchasing', 'OM'], ['stocktake', 'Stock take', 'check', 'OMS']]],
  ['Office', [['today', 'Today', 'reports', 'OMS'], ['reports', 'Reports', 'reports', 'OM'], ['website', 'Website', 'website', 'OM'], ['settings', 'Settings', 'settings', 'OM']]],
];
const roomsFor = (role) => ROOMS_DIARY.map(([room, items]) => [room, items.filter((i) => i[3].includes(role))]).filter(([, items]) => items.length);

function sideItem([key, label, ic], active) {
  const on = key === active;
  return `<a href="${key}-desktop.dc.html" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 12px; min-height: 30px; padding: 0 12px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: ${on ? 700 : 500}; color: #f3f2ee; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.lime}` : 'none'}">${icon(ic, 18)}<span>${esc(label)}</span></a>`;
}
const navList = (role, active) => roomsFor(role).map(([room, items]) => `<div style="display: flex; flex-direction: column; gap: 2px"><div style="padding: 2px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(243,242,238,0.7)">${room}</div>${items.map((n) => sideItem(n, active)).join('')}</div>`).join('');

function railItem([key, label, ic], active) {
  const on = key === active;
  return `<a href="${key}-tablet.dc.html" aria-current="${on ? 'page' : 'false'}" aria-label="${esc(label)}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 44px; flex-shrink: 0; padding: 4px 2px; border-radius: 8px; text-decoration: none; color: #f3f2ee; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.lime}` : 'none'}">${icon(ic, 19)}<span style="font-size: 10px; font-weight: 600; line-height: 1.1; text-align: center">${esc(label)}</span></a>`;
}
// A role that sees every room (e.g. a Manager) has more items than a short
// tablet rail can show at 50px each — 44px is the accessibility floor, so
// items shrink to that and the list scrolls (shellTablet) rather than
// overflow the sidebar.
const railList = (role, active) => roomsFor(role).map(([, items], i) => `<div style="display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; ${i ? 'padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.18)' : ''}">${items.map((n) => railItem(n, active)).join('')}</div>`).join('');

function siteSwitcher() {
  return `<button type="button" aria-label="Switch site" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 40px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #ffffff; font-family: inherit; text-align: left">
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; opacity: 0.8">${SHOP}</span><span style="font-size: 14px; font-weight: 600">Bolton</span></span>${icon('chevron', 16)}</button>`;
}

// ---------- Shells (copied/adapted from stage1.mjs staffDesktop/staffPhone: same look, new rooms) ----------
export function shellDesktop(active, title, content, { role = 'S', person = 'Jo Taylor', roleName = 'Staff', actions = '' } = {}) {
  return `<div style="width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">
<nav aria-label="Main" style="width: 248px; flex-shrink: 0; box-sizing: border-box; padding: 14px 12px; display: flex; flex-direction: column; gap: 12px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700">Wheelhouse</span></div>
${siteSwitcher()}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-top: 1px solid rgba(255,255,255,0.2)">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700">${esc(person.split(' ').map((x) => x[0]).join(''))}</span>
<span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 14px; font-weight: 600">${esc(person)}</span><span style="font-size: 12px; opacity: 0.8">${esc(roleName)}</span></span>
<a href="#" style="font-size: 13px; color: #ffffff">Sign out</a>
</div>
</nav>
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<h1 style="margin: 0; font-size: 20px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${actions}
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 18px 28px; overflow: hidden; min-height: 0">${content}</main>
</div>
</div>`;
}

export function shellTablet(active, title, content, { role = 'S', person = 'Jo Taylor', roleName = 'Staff', actions = '' } = {}) {
  return `<div style="width: ${TW}px; height: ${TH}px; display: flex; background: ${C.bg}">
<nav aria-label="Main" style="width: 72px; flex-shrink: 0; min-height: 0; box-sizing: border-box; padding: 8px 6px; display: flex; flex-direction: column; gap: 6px; background: ${C.accentDark}; color: #ffffff; align-items: stretch">
<div style="display: flex; justify-content: center; padding: 0 0 2px; flex-shrink: 0">${logoSlot('Wheelhouse logo', true)}</div>
<div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px">${railList(role, active)}</div>
<a href="#" aria-label="Sign out, ${esc(person)}" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 44px; justify-content: center; color: #ffffff"><span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 11px; font-weight: 700">${esc(person.split(' ').map((x) => x[0]).join(''))}</span></a>
</nav>
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 60px; flex-shrink: 0; box-sizing: border-box; padding: 0 22px; display: flex; align-items: center; gap: 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<h1 style="margin: 0; font-size: 19px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${actions}
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 16px 22px; overflow: hidden; min-height: 0">${content}</main>
</div>
</div>`;
}

export function shellPhone(title, content, { menuOpen = false, role = 'S', active = 'diary', actions = '' } = {}) {
  const bar = `<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 8px; display: flex; align-items: center; gap: 8px; background: ${C.accentDark}; color: #ffffff">
<button type="button" aria-label="Open menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('menu', 22)}</button>
<h1 style="margin: 0; font-size: 17px; font-weight: 700; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>
${actions}
</header>`;
  const sheet = menuOpen ? `<div style="position: absolute; inset: 0; background: rgba(20,24,22,0.45)"></div>
<nav aria-label="Main" style="position: absolute; top: 0; left: 0; bottom: 0; width: 300px; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 14px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700; flex-grow: 1">Wheelhouse</span><button type="button" aria-label="Close menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('close', 20)}</button></div>
${siteSwitcher()}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="padding: 10px 8px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-size: 14px"><span>Jo Taylor · Staff</span><a href="#" style="color: #ffffff">Sign out</a></div>
</nav>` : '';
  return `<div style="position: relative; width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">${bar}<main style="flex-grow: 1; box-sizing: border-box; padding: 14px; overflow: hidden; min-height: 0">${content}</main>${sheet}</div>`;
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
function dialogHeader(title, closeHref, sub = '', id) {
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><h2 id="${id}" style="margin: 0; font-size: 18px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h2>${sub ? `<span style="font-size: 12px; color: ${C.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${sub}</span>` : ''}</div>
<a href="${closeHref}" aria-label="Close" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
const dialogBody = (inner, pad = 20, gap = 14) => `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
const dialogFooter = (inner) => `<div style="flex-shrink: 0; box-sizing: border-box; padding: 14px 20px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 8px; background: ${C.panel}">${inner}</div>`;
// Phone: the pop-up fills the screen, with a title bar and a back/close control (decision 15, 16; brief item 3).
function dialogPhone(title, backHref, bodyInner, footerInner = '', sub = '') {
  return `<div style="width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.panel}; overflow: hidden">
<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 6px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid ${C.border}">
<a href="${backHref}" aria-label="Close, back to the diary" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: ${C.ink}">${icon('back', 22)}</a>
<div style="display: flex; flex-direction: column; gap: 0; min-width: 0; flex-grow: 1"><h1 style="margin: 0; font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(title)}</h1>${sub ? `<span style="font-size: 11px; color: ${C.muted}">${sub}</span>` : ''}</div>
</header>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: 14px; display: flex; flex-direction: column; gap: 12px">${bodyInner}</main>
${footerInner ? `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid ${C.border}">${footerInner}</div>` : ''}
</div>`;
}

// The diary content shown, dimmed, behind a pop-up opened over it on desktop/tablet
// (decision 15: "with the Waiting column, on the right week, the relevant block
// highlighted as in waiting-open"). highlightJob marks the one block a request
// pop-up belongs to: { type: 'pending' } for the purple pending block, or
// { type: 'job', job: 'WH-xxxx' } for an ordinary job block.
function diaryFrozenContent(size, { highlightJob = null } = {}) {
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { newJob: defaultNewJobHref(size) })}
${row(`${waitingColumn(size, -1)}${weekGrid({ days, size, slotH, mechFilter: 'Everyone', highlightJob })}`, 16, 'align-items: flex-start')}`, 12);
}
// Same, but for the mechanic's diary (decision 13: filtered to Alex, no Waiting column).
function diaryFrozenContentMechanic(size) {
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${mechToolbar(true, size, { newJob: `new-job-${size}.dc.html` })}${row(weekGrid({ days, size, slotH, mechFilter: 'Alex' }), 16, 'align-items: flex-start')}`, 12);
}
// A request pop-up: moderate size, centred over the dimmed diary at desktop/tablet.
function requestDialog(size, w, h, { id, title, sub, body, footer, highlightJob }) {
  const base = size === 'desktop'
    ? shellDesktop('diary', 'Workshop diary', diaryFrozenContent('desktop', { highlightJob }))
    : shellTablet('diary', 'Workshop diary', diaryFrozenContent('tablet', { highlightJob }));
  return dialogOverlay(base, w, h, `${dialogHeader(title, `diary-${size}.dc.html`, sub, id)}${dialogBody(body(size))}${footer ? dialogFooter(footer(size)) : ''}`, { pad: 40, maxWidth: DIALOG_W, labelledby: id });
}

// ---------- Bike tag barcode (real-looking Code 128 style bars) ----------
function barcode128(value, w = 220, h = 46) {
  const bits = [];
  for (const ch of String(value)) { const code = ch.codePointAt(0); for (let i = 0; i < 8; i++) bits.push((code >> i) & 1); }
  while (bits.length < 88) bits.push((bits.length * 7) % 2);
  const n = bits.length, bw = w / n;
  let x = 0, bars = '';
  for (const b of bits) { if (b) bars += `<rect x="${x.toFixed(2)}" y="0" width="${(bw * 0.62).toFixed(2)}" height="${h}" fill="#1c1e19"/>`; x += bw; }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Code 128 barcode for ${esc(value)}" style="display: block">${bars}</svg>`;
}

// ---------- Example data (only names/bikes/jobs/prices already in stage2.mjs) ----------
// The one customer/job every job board and the new customer-desktop board
// share (27 Sep round, item 24): Maya Patel's email is the one already used
// in newJobBody's custResult ("maya@example.test"); nothing here is invented.
const JOB_CUSTOMER = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards' };
const JOB_CUSTOMER_LABEL = 'Maya Patel · Trek Domane AL 3';
// Service options for new-job-desktop's service select (item 23): durations
// match what's already used across the example week's JOBS below, so the
// "60 min" the warning quotes is the real duration of the first (default) option.
const SERVICE_OPTIONS = [['Standard service', 60], ['Safety check', 60], ['Gear adjustment', 60], ['Brake service', 45]];
const CONCERN = '“My rear brake squeals and feels weak. The gears could use a tune-up too.”';
const LINES = [
  ['Standard service', 'Labour · 60 min', '£65.00'],
  ['Shimano brake pads', `Part · ${mono('B05S-RX')}`, '£28.00'],
  ['Fit &amp; adjust brakes', 'Labour · 30 min', '£18.00'],
  ['Replace gear cable', 'Optional · cable still serviceable', '£12.00'],
];
const DECISIONS = [['Approved', 'green'], ['Approved', 'green'], ['Approved', 'green'], ['Declined', 'red']];
const linesTableRows = () => LINES.map(([w, s, a], i) => [two(w, s), '1', mono(a), badge(...DECISIONS[i])]);

// Mon 14 – Sun 20 Sep 2026; today is Thu 17 Sep.
const DAYS = [['Mon', 14], ['Tue', 15], ['Wed', 16], ['Thu', 17], ['Fri', 18], ['Sat', 19], ['Sun', 20]];
const TODAY = 3;
const HINT_SLOT = { day: 1, start: 10 * 60, mech: 'Alex', label: '10:00 · Alex Morgan' }; // Tue 15 Sep · 10:00 · Alex Morgan

// Jobs already booked in / scheduled (from stage2.mjs COLS and ARRIVALS), plus a
// fuller example week (Mon–Sat) reusing only stage2/diary customers, bikes and
// services so both the standard and mechanic diaries read like a normal working
// week. New WH-10xx numbers continue on from the ones already used (1038–1048).
const JOBS = [
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
  // Wed 16 Sep.
  { day: 2, start: 9 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1061', svc: 'Gear adjustment', title: 'Aisha Khan · Cannondale Quick', detail: '09:00–10:00 · gear adjustment' },
  { day: 2, start: 11 * 60, dur: 60, mech: 'Alex', key: 'scheduled', job: 'WH-1062', svc: 'Standard service', title: 'Maya Patel · Trek Domane AL 3', detail: '11:00–12:00 · standard service' },
  { day: 2, start: 14 * 60, dur: 60, mech: 'Alex', key: 'ready', job: 'WH-1063', svc: 'Safety check', title: 'Jamie Brooks · Giant Escape 2', detail: '14:00–15:00 · safety check' },
  { day: 2, start: 10 * 60, dur: 60, mech: 'Jo', key: 'scheduled', job: 'WH-1064', svc: 'Gear adjustment', title: 'Oliver Chen · Brompton C Line', detail: '10:00–11:00 · gear adjustment' },
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
function customerBikeOf(j) {
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
// diary-settings-desktop. storageOptions(def) reorders the list so a form's
// select shows the wanted default as its first (selected) option.
const STORAGE = { 'WH-1042': 'Hook 3', 'WH-1040': 'Hook 1' };
const STORAGE_SLOTS = ['Hook 1', 'Hook 2', 'Hook 3', 'Hook 4', 'Hook 5', 'Hook 6', 'Workshop floor', 'Front window'];
const storageOptions = (def) => [def, ...STORAGE_SLOTS.filter((s) => s !== def)];
const READY_BY_QUICK = ['Today', 'Tomorrow', '+3 days', '+1 week', '+2 weeks', 'Before the weekend'];
const STARTING_STATUS = ['Booked', 'Bike is here', 'Waiting for parts'];
const rotate = (arr, idx) => arr.slice(idx).concat(arr.slice(0, idx));

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
// the customer's name (person stays for the aria-label and the phone list,
// which isn't redrawn this round — decision 25).
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
  const [bg, ink, label] = ST[w.tone];
  const inner = `<span style="display: inline-flex; align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 11px; font-weight: 700">${esc(label)}</span>
<span style="font-size: 13px; font-weight: 700">${esc(w.customer)}</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(w.bike)}</span>
<span style="font-size: 12px; color: ${C.ink}">${esc(w.detail)}</span>`;
  if (selected) {
    const openHref = `${REQ_LINK[w.kind]}-${size}.dc.html`;
    return `<div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 2px solid ${C.accent}; box-shadow: 0 0 0 3px rgba(197,207,62,0.45); background: ${C.panel}">
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
<h2 style="margin: 0; font-size: 14px; font-weight: 700">Waiting for you (${WAITING.length})</h2>
${WAITING.map((w, i) => waitingCard(w, size, i === selectedIdx)).join('')}
${hint ? note('Double-click a card to open it.') : ''}
</div>`;
}
const waitingButton = (size) => button(`Waiting (${WAITING.length})`, { variant: 'default', href: `waiting-open-${size}.dc.html`, iconName: 'inbox' });

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
function jobBlock(j, size, slotH, highlighted = false, lightMarked = false, faded = false) {
  const [bg, ink] = ST[j.key];
  const blockLabel = BLOCK_LABEL[j.key];
  const [customer, bike] = customerBikeOf(j);
  const jobTitle = j.svc || '';
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  // Three block sizes (item 2, 27 Sep round 2): a 90-minute-plus block is
  // "roomy" enough for bike / job title / status as three separate lines,
  // plus the storage hook as a fourth when there's one to show. A 30-minute
  // block is "tiny" — at week-column width there's only room for bike + job
  // title (the block's colour, plus the legend below the grid, carries the
  // status instead of a status word that would truncate mid-word). Anything
  // in between (a 60-minute block) shares the status onto job title's line.
  const roomy = h >= slotH * 2;
  const tiny = j.dur <= 30;
  const cancelled = j.key === 'cancelled';
  const strike = cancelled ? 'text-decoration: line-through;' : '';
  const href = `${j.link || 'job-overview'}-${size}.dc.html`;
  // A "light" mark (change-selected) shows the job the change request is
  // currently at, without the strong ring reserved for the target time.
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(197,207,62,0.55);` : lightMarked ? `box-shadow: 0 0 0 2px ${C.muted};` : '';
  // Faded (new-job-pick, item 2 of the 27 Sep round): busy blocks step back
  // visually while picking a time, so the free grid reads as clickable.
  const slot = STORAGE[j.job];
  const line2 = tiny ? jobTitle : roomy ? jobTitle : [jobTitle, blockLabel].filter(Boolean).join(' · ');
  const line3 = roomy ? [blockLabel, slot].filter(Boolean).join(' · ') : '';
  return `<a href="${href}" aria-label="${esc(bike)}, ${esc(jobTitle)}, ${esc(customer)}, ${esc(j.job)}, ${esc(ST[j.key][2])}, ${esc(j.detail)}" title="${esc(bike)} · ${esc(jobTitle)} · ${esc(customer)} · ${esc(j.job)} · ${esc(ST[j.key][2])} · ${esc(j.detail)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 6px; border-radius: 5px; background: ${bg}; border-left: 3px solid ${ink}; overflow: hidden; ${cancelled ? 'opacity: 0.8;' : ''} ${faded ? 'opacity: 0.5;' : ''} ${ring}">
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${strike}">${esc(bike)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${tiny ? C.ink : ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25">${esc(line2)}</span>
${line3 ? `<span style="font-size: 10px; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.75; ${strike}">${esc(line3)}</span>` : ''}
</a>`;
}
// The pending request block (decision 12): purple, labelled "Pending", linking
// to the request pop-up rather than a job overview (there is no job yet).
function pendingBlock(size, slotH, highlighted = false) {
  const j = PENDING_DIARY;
  const [bg, ink] = ST.pending;
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(197,207,62,0.55);` : '';
  // Item 2 (27 Sep round 2): bike, then job title, then "Pending" — the same
  // bike/job-title-first order as an ordinary job block.
  return `<a href="request-new-${size}.dc.html" aria-label="${esc(j.bike)}, ${esc(j.jobTitle)}, ${esc(j.customer)}, Pending, ${esc(j.detail)}" title="${esc(j.bike)} · ${esc(j.jobTitle)} · ${esc(j.customer)} · Pending · ${esc(j.detail)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 6px; border-radius: 5px; background: ${bg}; border-left: 3px solid ${ink}; overflow: hidden; ${ring}">
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.bike)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(j.jobTitle)}</span>
<span style="font-size: 10px; font-weight: 700; color: ${ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85">Pending</span>
</a>`;
}
// A dashed outline showing where a change request asked to move to (Oliver
// Chen's Brompton, Mon 10:00 → 14:00); the job itself stays drawn at 10:00.
function requestedOutlineBlock(size, slotH, highlighted = false) {
  const j = REQUEST_OUTLINE;
  const top = ((j.start - GRID_START) / 30) * slotH + 2;
  const h = Math.max((j.dur / 30) * slotH - 4, slotH - 6);
  const ring = highlighted ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(197,207,62,0.55);` : '';
  // Item 2 (27 Sep round 2): "Brompton C Line · Requested 14:00" — the bike,
  // not the customer's name (kept in the aria-label for context).
  return `<a href="change-selected-${size}.dc.html" aria-label="${esc(j.person)} asked to move to ${esc(j.label)}" title="${esc(j.person)} · ${esc(j.label)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box; border-radius: 5px; border: 1.5px dashed ${ST.hold[1]}; background: ${ST.hold[0]}; color: ${ST.hold[1]}; font-size: 10px; font-weight: 700; overflow: hidden; text-align: center; ${ring}">${esc(j.bike)} · ${esc(j.label)}</a>`;
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
  return `<a href="job-overview-${size}.dc.html" aria-label="${cluster.length} jobs booked ${t0} to ${t1}: ${esc(names)}" title="${esc(names)}" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${h}px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding: 3px 6px; border-radius: 5px; background: ${C.mutedBg}; border-left: 3px solid ${C.ink}; overflow: hidden; ${faded ? 'opacity: 0.5;' : ''}">
<span style="font-size: 11px; font-weight: 700; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${cluster.length} jobs · ${t0}</span>
${cluster.map((j) => `<span style="font-size: 10px; font-weight: 600; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(customerBikeOf(j)[1])} · ${esc(j.svc || '')}</span>`).join('')}
</a>`;
}
// The New job pick target (item 2 of the 27 Sep round, replaces the old
// dashed "+ New job" slot hint everywhere — decision 22). Shown only on
// new-job-pick, over the free slot the pointer would click; solid (not
// dashed) so it reads as a hover target rather than an always-on hint.
function pickHintSlot(size, slotH, top, label, href) {
  return `<a href="${href}" aria-label="Choose ${esc(label)} for the new job" style="position: absolute; left: 3px; right: 3px; top: ${top}px; height: ${slotH - 4}px; text-decoration: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 5px; border: 1.5px solid ${C.accent}; background: ${C.accent}; color: #ffffff; font-size: 11px; font-weight: 700; box-shadow: 0 0 0 4px rgba(197,207,62,0.4)">${esc(label)}</a>`;
}
// The day-view grid (brief item 18 / decision 18): one column per mechanic,
// same time rows as the week view. No "Not assigned" column — every job in the
// example week already has a mechanic, and the "No time" row above already
// covers bikes with no set time, so a permanently-empty column would show
// nothing real; add it when there is an actual unassigned job to show.
const DAY_MECHS = [['Alex', 'Alex Morgan'], ['Jo', 'Jo Taylor']];
function dayMechGrid({ dayIdx, size, slotH = 29, highlightJob = null }) {
  const gridH = GRID_SLOTS * slotH;
  const hourLabels = Array.from({ length: 9 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
  const cols = `44px repeat(${DAY_MECHS.length}, minmax(0, 1fr))`;
  const header = (m, name, i) => `<div style="grid-column: ${i + 2}; grid-row: 1; box-sizing: border-box; padding: 6px 8px; border-bottom: 1px solid ${C.border}; ${i ? `border-left: 1px solid ${C.border};` : ''} background: ${C.panel}; display: flex; align-items: center; justify-content: center">
<span style="font-size: 14px; font-weight: 700; color: ${C.ink}">${esc(name)}</span></div>`;
  const col = (m, i) => {
    const items = JOBS.filter((j) => j.day === dayIdx && j.mech === m);
    const clusters = clusterOverlaps(items);
    const blocks = clusters.map((c) => (c.length === 1 ? jobBlock(c[0], size, slotH, highlightJob?.type === 'job' && c[0].job === highlightJob.job) : combinedBlock(c, size, slotH))).join('');
    return `<div style="grid-column: ${i + 2}; grid-row: 2; position: relative; height: ${gridH}px; ${i ? `border-left: 1px solid ${C.border};` : ''} background: repeating-linear-gradient(to bottom, transparent 0, transparent ${slotH * 2 - 1}px, ${C.border} ${slotH * 2 - 1}px, ${C.border} ${slotH * 2}px)">${blocks}</div>`;
  };
  return `<div role="grid" aria-label="Workshop diary, Thursday 17 September 2026, by mechanic" style="flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: ${cols}; grid-template-rows: auto ${gridH}px; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; background: ${C.panel}">
<div style="grid-column: 1; grid-row: 1; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}"></div>
${DAY_MECHS.map(([m, name], i) => header(m, name, i)).join('')}
<div style="grid-column: 1; grid-row: 2; position: relative; height: ${gridH}px; background: ${C.mutedBg}">${hourLabels.map((t, i) => `<span style="position: absolute; top: ${i * 2 * slotH - 6}px; right: 4px; font-family: ${MONO}; font-size: 10px; color: ${C.muted}">${t}</span>`).join('')}</div>
${DAY_MECHS.map(([m], i) => col(m, i)).join('')}
</div>`;
}
// Freezes the day view behind a pop-up opened from it (new-job-day) — the
// day-view equivalent of diaryFrozenContent.
function diaryDayFrozenContent(size, { highlightJob = null } = {}) {
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { activeView: 'Day', newJob: `new-job-day-${size}.dc.html` })}
${row(`${waitingColumn(size, -1)}${dayMechGrid({ dayIdx: TODAY, size, slotH, highlightJob })}`, 16, 'align-items: flex-start')}`, 12);
}
function weekGrid({ days, size, slotH = 29, mechFilter = 'Everyone', selectSlot = null, highlightJob = null, pickMode = false }) {
  const gridH = GRID_SLOTS * slotH;
  const hourLabels = Array.from({ length: 9 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
  const cols = `44px repeat(${days.length}, minmax(0, 1fr))`;
  const dayHeader = (d, i) => {
    const [name, date] = DAYS[d]; const isToday = d === TODAY;
    return `<div style="grid-column: ${i + 2}; grid-row: 1; box-sizing: border-box; padding: 6px 8px; border-bottom: 1px solid ${C.border}; ${i ? `border-left: 1px solid ${C.border};` : ''} background: ${isToday ? C.mutedBg : C.panel}; display: flex; flex-direction: column; align-items: center">
<span style="font-size: 11px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.4px">${name}</span>
<span style="font-size: 14px; font-weight: 700; color: ${isToday ? C.accentDark : C.ink}">${date}${isToday ? ' · Today' : ''}</span>
</div>`;
  };
  const unschedRow = `<div style="grid-column: 2 / span ${days.length}; grid-row: 2; box-sizing: border-box; padding: 4px 8px; border-bottom: 1px solid ${C.border}; display: flex; flex-wrap: wrap; gap: 5px; min-height: 26px; align-items: center; overflow: hidden">${UNSCHEDULED.map((u) => `<a href="job-overview-${size}.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: ${ST.scheduled[0]}; color: ${ST.scheduled[1]}; font-size: 11px; font-weight: 700; white-space: nowrap">${esc(u.job)} · ${esc(u.title)}</a>`).join('')}</div>`;
  const dayColumn = (d, i) => {
    const items = JOBS.filter((j) => j.day === d && (mechFilter === 'Everyone' || j.mech === mechFilter));
    // Pick mode (new-job-pick, item 2): the pointer's slot shows as a solid
    // hover target; every busy block in the grid fades back so the free grid
    // reads as clickable (decision 22 drops the old always-on "+ New job" hint).
    const isPickSlot = pickMode && selectSlot && d === selectSlot.day && (mechFilter === 'Everyone' || mechFilter === selectSlot.mech);
    const pickHint = isPickSlot ? pickHintSlot(size, slotH, ((selectSlot.start - GRID_START) / 30) * slotH + 2, selectSlot.label || '10:00', `new-job-${size}.dc.html`) : '';
    const clusters = clusterOverlaps(items);
    const blocks = clusters.map((c) => (c.length === 1 ? jobBlock(c[0], size, slotH, highlightJob?.type === 'job' && c[0].job === highlightJob.job, highlightJob?.dim === c[0].job, pickMode) : combinedBlock(c, size, slotH, pickMode))).join('');
    // Decision 12: the pending request sits in its slot, Everyone view only (no mechanic yet).
    const pending = mechFilter === 'Everyone' && d === PENDING_DIARY.day ? pendingBlock(size, slotH, highlightJob?.type === 'pending') : '';
    const outline = mechFilter === 'Everyone' && d === REQUEST_OUTLINE.day ? requestedOutlineBlock(size, slotH, highlightJob?.type === 'outline') : '';
    const tint = pickMode ? `linear-gradient(rgba(197,207,62,0.08), rgba(197,207,62,0.08)), ` : '';
    return `<div style="grid-column: ${i + 2}; grid-row: 3; position: relative; height: ${gridH}px; ${i ? `border-left: 1px solid ${C.border};` : ''} ${pickMode ? 'cursor: pointer;' : ''} background: ${tint}repeating-linear-gradient(to bottom, transparent 0, transparent ${slotH * 2 - 1}px, ${C.border} ${slotH * 2 - 1}px, ${C.border} ${slotH * 2}px)">${blocks}${pickHint}${pending}${outline}</div>`;
  };
  return `<div role="grid" aria-label="Workshop diary, week of Monday 14 September 2026" style="flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: ${cols}; grid-template-rows: auto auto ${gridH}px; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; background: ${C.panel}">
<div style="grid-column: 1; grid-row: 1; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}"></div>
${days.map((d, i) => dayHeader(d, i)).join('')}
<div style="grid-column: 1; grid-row: 2; border-bottom: 1px solid ${C.border}; background: ${C.mutedBg}; font-size: 9px; font-weight: 700; color: ${C.muted}; text-align: center; padding-top: 3px; line-height: 1.1">No<br>time</div>
${unschedRow}
<div style="grid-column: 1; grid-row: 3; position: relative; height: ${gridH}px; background: ${C.mutedBg}">${hourLabels.map((t, i) => `<span style="position: absolute; top: ${i * 2 * slotH - 6}px; right: 4px; font-family: ${MONO}; font-size: 10px; color: ${C.muted}">${t}</span>`).join('')}</div>
${days.map((d, i) => dayColumn(d, i)).join('')}
</div>`;
}
// Week/Day are real links between the week grid (diary-<size>) and the day
// view (diary-day-<size>) — brief item 18.
function viewSwitch(active, size) {
  const items = [['Week', `diary-${size}.dc.html`], ['Day', `diary-day-${size}.dc.html`]];
  return `<div role="group" aria-label="Diary view" style="display: inline-flex; gap: 6px; flex-wrap: wrap">${items.map(([t, href]) => {
    const on = t === active;
    return `<a href="${href}" aria-current="${on}" style="min-height: 36px; padding: 0 12px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; text-decoration: none; border: 1px solid ${on ? C.accent : C.input}; background: ${on ? C.accent : C.panel}; color: ${on ? '#ffffff' : C.ink}">${t}</a>`;
  }).join('')}</div>`;
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
// job pop-up): the pick flow exists on desktop only (new-job-pick); tablet
// and phone go straight to the New job form this round (brief item 25).
const defaultNewJobHref = (size) => (size === 'desktop' ? 'new-job-pick-desktop.dc.html' : `new-job-${size}.dc.html`);
function diaryToolbar(mechFilter, size, { mechOptions = ['Everyone', 'Alex', 'Jo'], activeView = 'Week', newJob = null } = {}) {
  const nj = newJob === 'active' ? newJobButtonActive() : newJob ? newJobButton(newJob) : '';
  return row(`${viewSwitch(activeView, size)}${segmented(['‹ Prev', 'Today', 'Next ›'], 1, 'Change week')}${segmented(mechOptions, mechOptions.indexOf(mechFilter), 'Mechanic')}${nj ? `<div style="flex-grow: 1"></div>${nj}` : ''}`, 10, 'flex-wrap: wrap');
}

// Phone: one day at a time, jobs listed down a time line.
function dayStrip(selectedIdx) {
  return `<div role="tablist" aria-label="Choose a day" style="display: flex; gap: 3px">${DAYS.map(([name, date], i) => {
    const on = i === selectedIdx, isToday = i === TODAY;
    return `<a href="#" role="tab" aria-selected="${on}" style="flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; min-height: 44px; justify-content: center; border-radius: 8px; text-decoration: none; background: ${on ? C.accent : 'transparent'}; color: ${on ? '#ffffff' : C.ink}">
<span style="font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: ${on ? 0.9 : 0.7}">${name}</span><span style="font-size: 13px; font-weight: 700">${date}</span>
${isToday ? `<span style="position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 999px; background: ${on ? '#ffffff' : C.accent}"></span>` : ''}
</a>`;
  }).join('')}</div>`;
}
function dayTimelineRow(j, size) {
  const [bg, ink] = ST[j.key];
  const label = j.key === 'pending' ? 'Pending' : BLOCK_LABEL[j.key];
  // The pending item (PENDING_DIARY, spread with key: 'pending' — see
  // dayTimeline below) carries its own customer/bike fields rather than a
  // parseable title; there's no job number yet, so the job-title stands in
  // for it below (phone isn't redrawn this round — decision 25 — this is
  // just keeping the existing customer-led list working with the 27 Sep
  // round 2 data shape).
  const [customer, bike] = j.key === 'pending' ? [j.customer, j.bike] : customerBikeOf(j);
  const jobRef = j.key === 'pending' ? j.jobTitle : j.job;
  const href = `${j.link || 'job-overview'}-${size}.dc.html`;
  const strike = j.key === 'cancelled' ? 'text-decoration: line-through;' : '';
  const ring = j._mark === 'accent' ? `box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(197,207,62,0.55);` : j._mark === 'light' ? `box-shadow: 0 0 0 2px ${C.muted};` : '';
  // Derived from j.start rather than parsed out of j.detail — some jobs'
  // detail text doesn't lead with a time range (e.g. the change request's
  // "Change requested · 10:00 → 14:00"), which broke the time column.
  const startTime = `${String(Math.floor(j.start / 60)).padStart(2, '0')}:${String(j.start % 60).padStart(2, '0')}`;
  return `<a href="${href}" aria-label="${esc(customer)}, ${esc(jobRef)}, ${esc(label)}, ${esc(j.detail)}" style="display: flex; gap: 10px; text-decoration: none; color: inherit">
<div style="width: 52px; flex-shrink: 0; font-family: ${MONO}; font-size: 12px; color: ${C.muted}; padding-top: 10px">${esc(startTime)}</div>
<div style="flex-grow: 1; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; background: ${bg}; border-left: 3px solid ${ink}; ${ring}">
<div style="font-size: 13px; font-weight: 700; color: ${C.ink}; ${strike}">${esc(customer)}${bike ? ` · ${esc(bike)}` : ''}</div>
<div style="font-size: 11px; font-weight: 700; color: ${ink}">${esc(jobRef)} · ${esc(label)} · ${esc(j.detail)}</div>
</div></a>`;
}
function dayTimeline(dayIdx, size, { mechFilter = 'Everyone', highlightPending = false } = {}) {
  const items = JOBS.filter((j) => j.day === dayIdx && (mechFilter === 'Everyone' || j.mech === mechFilter));
  // Decision 12: the pending request also shows in the day list, Everyone view only.
  if (mechFilter === 'Everyone' && dayIdx === PENDING_DIARY.day) items.push({ ...PENDING_DIARY, key: 'pending', link: 'request-new', _mark: highlightPending ? 'accent' : null });
  items.sort((a, b) => a.start - b.start);
  const rows = items.map((j) => dayTimelineRow(j, size));
  if (dayIdx === 0 && UNSCHEDULED.length) rows.unshift(`<a href="job-overview-${size}.dc.html" style="display: flex; align-items: center; gap: 8px; text-decoration: none; padding: 8px 10px; border-radius: 8px; background: ${ST.scheduled[0]}; color: ${ST.scheduled[1]}; font-size: 12px; font-weight: 700">${esc(UNSCHEDULED[0].job)} · ${esc(UNSCHEDULED[0].title)} · Unscheduled</a>`);
  return rows.length ? stack(rows.join(''), 8) : note('Nothing booked in for this day yet.');
}
// Phone/tablet's diary toolbar has no room for a "New job" button (decision
// 22 still needs one reachable without the removed slot hint) — a small icon
// button in the phone header's action slot, next to the menu/title.
const newJobPhoneAction = (href) => `<a href="${href}" aria-label="New job" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; background: ${C.accent}; color: #ffffff">${icon('plus', 20)}</a>`;
// Phone equivalent of the dashed "requested 14:00" outline block, for the
// change-selected day list (decision 19).
function requestedOutlineRow(size) {
  const j = REQUEST_OUTLINE;
  return `<a href="change-selected-${size}.dc.html" aria-label="${esc(j.person)} asked to move to ${esc(j.label)}" style="display: flex; gap: 10px; text-decoration: none; color: inherit">
<div style="width: 52px; flex-shrink: 0; font-family: ${MONO}; font-size: 12px; color: ${C.muted}; padding-top: 10px">14:00</div>
<div style="flex-grow: 1; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1.5px dashed ${ST.hold[1]}; background: ${ST.hold[0]}; color: ${ST.hold[1]}; font-size: 12px; font-weight: 700; box-shadow: 0 0 0 2px ${C.accent}, 0 0 0 6px rgba(197,207,62,0.55)">${esc(j.person)} · ${esc(j.label)}</div></a>`;
}
// Monday's day list with the current 10:00 job lightly marked and the
// requested 14:00 slot highlighted (decision 19, brief item 4).
function changeSelectedDayList(size) {
  const items = JOBS.filter((j) => j.day === 0).map((j) => (j.job === 'WH-1052' ? { ...j, _mark: 'light' } : j));
  items.sort((a, b) => a.start - b.start);
  const rows = [];
  let placed = false;
  for (const j of items) {
    if (!placed && j.start > REQUEST_OUTLINE.start) { rows.push(requestedOutlineRow(size)); placed = true; }
    rows.push(dayTimelineRow(j, size));
  }
  if (!placed) rows.push(requestedOutlineRow(size));
  return stack(rows.join(''), 8);
}

// ---------- Diary badges / note ----------
const diaryLegend = () => row(Object.entries({ scheduled: ST.scheduled, pending: ST.pending, hold: ST.hold, waiting: ST.waiting, ready: ST.ready, cancelled: ST.cancelled }).map(([k, [bg, ink, label]]) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${C.ink}"><span style="width: 12px; height: 12px; border-radius: 3px; background: ${bg}; border-left: 3px solid ${ink}; flex-shrink: 0"></span>${label}</span>`).join(''), 16, 'flex-wrap: wrap');
// Decision 13: the mechanic's diary is the standard diary filtered to that
// mechanic, with one Me / Everyone switch in the normal toolbar position.
// Mechanics can't accept bookings, but they can create a walk-in job (chosen
// for this round — brief item 1 leaves it open) — so the mechanic diary gets
// the same New job button, going straight to the New job form (no pick flow
// for a mechanic's own single-column view this round).
function mechToolbar(meSelected, size, { newJob = null } = {}) {
  const nj = newJob ? newJobButton(newJob) : '';
  return row(`${viewSwitch('Week', size)}${segmented(['‹ Prev', 'Today', 'Next ›'], 1, 'Change week')}${segmented(['Me', 'Everyone'], meSelected ? 0 : 1, 'Whose diary')}${nj ? `<div style="flex-grow: 1"></div>${nj}` : ''}`, 10, 'flex-wrap: wrap');
}

// ---------- Screens ----------
export const screens = {};

// 1. diary (Staff, Jo Taylor)
screens.diary = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', -1)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone' })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: shellTablet('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'tablet', { newJob: 'new-job-tablet.dc.html' })}
${row(`${waitingColumn('tablet', -1, 190)}${weekGrid({ days: [0, 1, 2, 3, 4], size: 'tablet', mechFilter: 'Everyone', slotH: 30 })}`, 14, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  phone: shellPhone('Diary', phoneBody(`${waitingButton('phone')}
${dayStrip(TODAY)}
${eyebrow('Thursday 17 September')}
${dayTimeline(TODAY, 'phone', { mechFilter: 'Everyone' })}`, '', 10), { active: 'diary', actions: newJobPhoneAction('new-job-phone.dc.html') }),
};

// 2. diary-mechanic (Mechanic, Alex Morgan) — opens on Me; no Waiting column
screens['diary-mechanic'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${mechToolbar(true, 'desktop', { newJob: 'new-job-desktop.dc.html' })}
${row(weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Alex' }), 16, 'align-items: flex-start')}
${diaryLegend()}`, 12), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' }),
  tablet: shellTablet('diary', 'Workshop diary', stack(`${mechToolbar(true, 'tablet', { newJob: 'new-job-tablet.dc.html' })}
${row(weekGrid({ days: [0, 1, 2, 3, 4], size: 'tablet', mechFilter: 'Alex', slotH: 30 }), 14, 'align-items: flex-start')}
${diaryLegend()}`, 12), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' }),
  phone: shellPhone('Diary', phoneBody(`${segmented(['Me', 'Everyone'], 0, 'Whose diary')}
${dayStrip(TODAY)}
${eyebrow('Thursday 17 September')}
${dayTimeline(TODAY, 'phone', { mechFilter: 'Alex' })}`, '', 10), { role: 'K', active: 'diary', actions: newJobPhoneAction('new-job-phone.dc.html') }),
};

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
  tablet: shellTablet('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'tablet', { newJob: 'new-job-tablet.dc.html' })}
${row(`${waitingColumn('tablet', 0, 190, true)}${weekGrid({ days: [0, 1, 2, 3, 4], size: 'tablet', mechFilter: 'Everyone', slotH: 30, highlightJob: { type: 'pending' } })}`, 14, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  phone: shellPhone('Diary', phoneBody(`${waitingButton('phone')}
${dayStrip(4)}
${eyebrow('Friday 18 September')}
${dayTimeline(4, 'phone', { mechFilter: 'Everyone', highlightPending: true })}`, `${row(`<div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 14px; font-weight: 700">Sam Reed · Pending request</span></div>${button('Open', { size: 'sm', href: 'request-new-phone.dc.html' })}`, 10)}
${note('Tap again to open.')}`, 10), { active: 'diary', actions: newJobPhoneAction('new-job-phone.dc.html') }),
};

// 3b. diary-day — brief item 18: one column per mechanic, Thu 17 Sep, same
// time rows and Waiting column as the week view. The Day button is selected;
// the empty-slot hint in Jo's 16:00 sits ready for new-job-day. Phone shows a
// mechanic switch above the day list instead of columns (there's no room for
// two columns on a phone).
screens['diary-day'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { activeView: 'Day', newJob: 'new-job-day-desktop.dc.html' })}
${row(`${waitingColumn('desktop', -1)}${dayMechGrid({ dayIdx: TODAY, size: 'desktop' })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: shellTablet('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'tablet', { activeView: 'Day', newJob: 'new-job-day-tablet.dc.html' })}
${row(`${waitingColumn('tablet', -1, 190)}${dayMechGrid({ dayIdx: TODAY, size: 'tablet', slotH: 30 })}`, 14, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  phone: shellPhone('Diary', phoneBody(`${waitingButton('phone')}
${segmented(['Alex', 'Jo'], 1, 'Mechanic')}
${eyebrow('Thursday 17 September')}
${dayTimeline(TODAY, 'phone', { mechFilter: 'Jo' })}`, '', 10), { active: 'diary', actions: newJobPhoneAction('new-job-day-phone.dc.html') }),
};

// 3c. diary-settings — Office › Settings, shown for a Manager (brief item 1):
// choose what shows first/second on a diary block, with a live preview.
// Item 29/4 (27 Sep round 2): the block preview leads with whichever field is
// chosen for line 1/2 (defaults bike/job title), and always shows the status
// as its own third line — e.g. "Trek Domane AL 3 / Standard service /
// Scheduled".
function blockPreviewCard(first, second) {
  const sample = { customer: 'Maya Patel', job: 'WH-1042', bike: 'Trek Domane AL 3', jobTitle: 'Standard service' };
  const line1 = sample[first] || sample.bike;
  const line2 = sample[second] || sample.jobTitle;
  return `<div aria-label="Block preview" style="width: 190px; box-sizing: border-box; padding: 6px 8px; border-radius: 5px; background: ${ST.scheduled[0]}; border-left: 3px solid ${ST.scheduled[1]}">
<div style="font-size: 12px; font-weight: 700; color: ${C.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(line1)}</div>
<div style="font-size: 11px; font-weight: 700; color: ${C.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(line2)}</div>
<div style="font-size: 11px; font-weight: 700; color: ${ST.scheduled[1]}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">Scheduled</div>
</div>`;
}
// Item 27 (27 Sep round): storage slots are optional per shop, turned on or
// off here; when on, the shop keeps its own list of hooks and spaces.
function toggleSwitch(label, on, id) {
  return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
<label for="${id}" style="font-size: 15px; font-weight: 700; color: ${C.ink}">${esc(label)}</label>
<span id="${id}" role="switch" aria-checked="${on}" style="position: relative; display: inline-flex; align-items: center; width: 44px; height: 26px; border-radius: 999px; background: ${on ? C.accent : C.input}; flex-shrink: 0">
<span style="position: absolute; top: 3px; left: ${on ? '21px' : '3px'}; width: 20px; height: 20px; border-radius: 999px; background: #ffffff; box-shadow: 0 1px 2px rgba(28,30,25,0.35)"></span>
</span>
</div>`;
}
// A compact wrapping chip, not a full-width row per slot — a vertical list of
// rowCards for up to 8 slots didn't fit this page's height budget alongside
// the block-preference panel (shellDesktop's <main> doesn't scroll).
function storageSlotChip(name) {
  return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 13px; font-weight: 600; color: ${C.ink}">${esc(name)}<button type="button" aria-label="Remove ${esc(name)}" style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 0; background: ${C.mutedBg}; color: ${C.muted}">${icon('close', 12)}</button></span>`;
}
function storageSlotsSection(size) {
  return panel(`${toggleSwitch('Storage slots', true, 'storage-toggle-' + size)}
${note('On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.', 12)}
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}">${STORAGE_SLOTS.map(storageSlotChip).join('')}</div>
<div>${button('+ Add a slot', { variant: 'default', size: 'sm' })}</div>`, '', 16, 12);
}
// Item 29/4 (27 Sep round 2): "Job title" joins customer, bike and job number
// as a block-line choice; the default is bike first, job title second.
function blockPrefPanel(size) {
  return panel(`${h2('What shows on a block', 15)}
${grid('1fr 1fr', `${select('First line', ['Bike', 'Job title', 'Customer', 'Job number'], 'set-first-' + size)}${select('Second line', ['Job title', 'Bike', 'Customer', 'Job number'], 'set-second-' + size)}`, 14)}
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}">${eyebrow('Preview')}${blockPreviewCard('bike', 'jobTitle')}${note('The status always shows too, whatever the two lines above are set to.', 12)}</div>`, '', 16, 12);
}
function diarySettingsBody(size) {
  // Desktop: side by side (the page doesn't scroll) — item 27 adds a whole
  // second settings group to what was previously a single-column page.
  if (size === 'desktop') {
    return stack(`${eyebrow('Office › Settings')}
${h2('Diary & storage', 20)}
${note('Choose what each diary block shows, and whether this shop tracks storage slots. The status is always shown — never colour alone — and never truncates to something unreadable.')}
${grid('1fr 1fr', `<div style="display: flex; flex-direction: column; gap: 12px">${h2('Diary blocks', 16)}${blockPrefPanel(size)}</div><div style="display: flex; flex-direction: column; gap: 12px">${h2('Storage slots', 16)}${storageSlotsSection(size)}</div>`, 24)}
${button('Save', { size: 'sm' })}`, 16);
  }
  return stack(`${eyebrow('Office › Settings')}
${h2('Diary blocks', 20)}
${note('Choose what each diary block shows. The status is always shown — never colour alone — and never truncates to something unreadable.')}
${blockPrefPanel(size)}
${h2('Storage slots', 20)}
${note('Where bikes are kept while they’re in for work. Turn this off if this shop doesn’t use hooks or bays.')}
${storageSlotsSection(size)}
${button('Save', { size: 'sm' })}`, 16);
}
screens['diary-settings'] = {
  desktop: shellDesktop('settings', 'Settings', `<div style="max-width: 920px">${diarySettingsBody('desktop')}</div>`, { role: 'M', person: 'Jack Lewis', roleName: 'Manager' }),
  tablet: shellTablet('settings', 'Settings', `<div style="max-width: 480px">${diarySettingsBody('tablet')}</div>`, { role: 'M', person: 'Jack Lewis', roleName: 'Manager' }),
  phone: shellPhone('Settings', phoneBody(diarySettingsBody('phone'), '', 12), { role: 'M', active: 'settings' }),
};

// 3d. change-selected — decision 19: built like waiting-open, but for Oliver
// Chen's change request. The requested 14:00 time is the highlighted target;
// the current 10:00 booking (WH-1052) is only lightly marked.
screens['change-selected'] = {
  desktop: shellDesktop('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'desktop', { newJob: 'new-job-pick-desktop.dc.html' })}
${row(`${waitingColumn('desktop', 1, 224, true)}${weekGrid({ days: [0, 1, 2, 3, 4, 5, 6], size: 'desktop', mechFilter: 'Everyone', highlightJob: { type: 'outline', dim: 'WH-1052' } })}`, 16, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  tablet: shellTablet('diary', 'Workshop diary', stack(`${diaryToolbar('Everyone', 'tablet', { newJob: 'new-job-tablet.dc.html' })}
${row(`${waitingColumn('tablet', 1, 190, true)}${weekGrid({ days: [0, 1, 2, 3, 4], size: 'tablet', mechFilter: 'Everyone', slotH: 30, highlightJob: { type: 'outline', dim: 'WH-1052' } })}`, 14, 'align-items: flex-start')}
${diaryLegend()}`, 12)),
  phone: shellPhone('Diary', phoneBody(`${waitingButton('phone')}
${dayStrip(0)}
${eyebrow('Monday 14 September')}
${changeSelectedDayList('phone')}`, `${row(`<div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 14px; font-weight: 700">Oliver Chen · Change request · Mon 10:00 → 14:00</span></div>${button('Open', { size: 'sm', href: 'request-change-phone.dc.html' })}`, 10)}
${note('Tap again to open.')}`, 10), { active: 'diary', actions: newJobPhoneAction('new-job-phone.dc.html') }),
};

// ---------- Row 2: Requests, as a pop-up (decision 15) ----------
const reqCloseHref = (size) => `diary-${size}.dc.html`;

// 4. request-new — Sam Reed / Specialized Sirrus / Brake service (stage2 REQ example; no price source → placeholder)
function requestNewBody(size) {
  return `${eyebrow(`Received today at ${mono('08:15')}`)}
${row(`${h2('Sam Reed', 18)}${statusBadge('pending')}`, 10, 'justify-content: space-between')}
${txt('Specialized Sirrus · grey', 14, `color: ${C.muted}`)}
<div style="display: flex; flex-direction: column; gap: 6px">${h2('What the customer told us', 14)}${quote('No message from the customer.')}</div>
<div style="display: flex; flex-direction: column; gap: 4px">${txt(`<strong>Brake service · ${mono('[price]')}</strong>`)}${note('45 minutes planned. Requested Friday 18 September.')}</div>
${select('Mechanic', ['Shared workshop queue', 'Alex Morgan', 'Jo Taylor'], 'req-new-mech-' + size)}`;
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

// ---------- Row 3: New job from an empty slot (decision 16 — same near-fullscreen treatment as a job pop-up) ----------
const custResult = `<div style="padding: 6px 12px; border-radius: 8px; border: 2px solid ${C.accent}; background: ${C.mutedBg}; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">07700 900 142 · maya@example.test</span><span style="font-size: 13px">Trek Domane AL 3 · green</span></div>`;
// Decision 18: in the Everyone week view Wheelhouse assigns the mechanic with
// the most free time that day; from a mechanic's own column (the day view),
// that mechanic is pre-filled instead. Either way it's a real select the
// member of staff can change before saving.
// New bike build / PDI tick (item 26): near the top, unticked, always with
// its "customer becomes optional" hint underneath — the hint states the
// effect rather than only appearing once ticked, since a member of staff
// reads it before deciding whether to tick it.
function newBuildCheck(size) {
  return `<div style="display: flex; flex-direction: column; gap: 4px">${check('New bike build or pre-delivery check', false, 'nj-newbuild-' + size)}<div style="padding-left: 28px">${note('Customer becomes optional.', 12)}</div></div>`;
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
// Ready by (item 26): a date field plus Citrus Lime's quick buttons.
function readyByBlock(size, dateValue, quickIdx) {
  return `<div style="display: flex; flex-direction: column; gap: 8px">
${field('Ready by', { type: 'date', value: dateValue, id: 'nj-readyby-' + size })}
${segmented(READY_BY_QUICK, quickIdx, 'Ready by, quick pick')}
</div>`;
}
// Decision 18: in the Everyone week view Wheelhouse assigns the mechanic with
// the most free time that day; from a mechanic's own column (the day view),
// that mechanic is pre-filled instead. Either way it's a real select the
// member of staff can change before saving.
function newJobBody(size, opts = {}) {
  const {
    when = 'Tue 15 Sep · 10:00',
    mechanic = 'Alex Morgan',
    mechHint = 'Chosen automatically: most free time on Tuesday. You can change it.',
    showCustomer = true,
    freeMinutes = null,
    readyByDate = '2026-09-16',
    readyByIdx = 1,
    startingStatusIdx = 0,
    bikeHereChecked = false,
    storageDefault = 'Hook 3',
    receiptNote = 'Rear brake squeals and feels weak.',
    staffNotes = [],
  } = opts;
  const mechOptions = ['Alex Morgan', 'Jo Taylor', 'Shared workshop queue'];
  const ordered = [mechanic, ...mechOptions.filter((m) => m !== mechanic)];
  // Item 23, desktop only: picking the service select sets the job's
  // estimated time; if the free time at the chosen slot (freeMinutes) is
  // shorter, a warning shows before saving. Save stays available regardless
  // (the diary shows the overlap if staff save anyway).
  const [, svcDur] = SERVICE_OPTIONS[0];
  const timeLabel = when.split('· ')[1] || when;
  const warn = freeMinutes != null && svcDur > freeMinutes;
  if (size !== 'desktop') {
    // Tablet and phone aren't redrawn this round (decision 25) — unchanged
    // single-column form.
    const customerBlock = showCustomer
      ? `${field('Find customer by name, phone or email', { value: 'Maya Patel', id: 'nj-find-' + size })}
${custResult}
<div>${link('+ New customer')}</div>
${field('Bike', { value: 'Trek Domane AL 3 · green', id: 'nj-bike-' + size })}`
      : `${field('Find customer by name, phone or email', { placeholder: 'Search by name, phone or email', id: 'nj-find-' + size })}
<div>${link('+ New customer')}</div>
${field('Bike', { placeholder: 'Bike make and model', id: 'nj-bike-' + size })}`;
    const workBlock = `${field('Work / service', { value: 'Standard service; inspect rear brake', id: 'nj-work-' + size })}
${area('What the customer told us', receiptNote, 'nj-told-' + size, 2)}
${field('Estimated time', { value: '60 minutes', id: 'nj-time-' + size })}`;
    return `${banner(when, 'info')}
${select('Mechanic', ordered, 'nj-mech-' + size)}
${note(mechHint)}
${customerBlock}
${workBlock}
${note('Bikes with no set time go in the diary’s “No time” row at the top instead.')}`;
  }
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
  const leftCol = `<div style="display: flex; flex-direction: column; gap: 12px">
${customerBlock}
${bikeBlock}
${select('Work / service', SERVICE_OPTIONS.map(([n, d]) => `${n} · ${d} min`), 'nj-work-' + size)}
${field('Job title', { value: SERVICE_OPTIONS[0][0], id: 'nj-title-' + size, hint: 'Filled in from the work chosen. Shown on the diary block.' })}
${area('Note for the customer', receiptNote, 'nj-receipt-' + size, 3)}
${note('Printed on their receipt.', 12)}
</div>`;
  const rightCol = `<div style="display: flex; flex-direction: column; gap: 12px">
${banner(when, 'info')}
${select('Mechanic', ordered, 'nj-mech-' + size)}
${note(mechHint)}
${warn ? banner(`Only ${freeMinutes} minutes free at ${esc(timeLabel)} — this job needs ${svcDur}. Choose another time, or save anyway and the diary will show the overlap. ${link('Find the next free ' + svcDur + ' minutes')}`, 'warn') : ''}
${readyByBlock(size, readyByDate, readyByIdx)}
${select('Starting status', rotate(STARTING_STATUS, startingStatusIdx), 'nj-status-' + size)}
${check('The bike is here now', bikeHereChecked, 'nj-herenow-' + size)}
${note('Books it in straight away, ready to print the bike tag.', 12)}
${select('Where the bike is kept', storageOptions(storageDefault), 'nj-storage-' + size)}
${note('Storage slots are on for this shop. Turn them off in Settings.', 12)}
${staffNotesBlock(size, staffNotes)}
</div>`;
  return `${newBuildCheck(size)}
${grid('1fr 1fr', `${leftCol}${rightCol}`, 28)}`;
}
// The form itself stays a readable single column at tablet/phone (brief
// leaves this open — decision: the outer pop-up still takes most of the
// screen, per decision 16); desktop uses two columns (item 26).
function newJobDialog(size, w, h, pad, { baseFn, closeId = 'diary', bodyOpts = {} } = {}) {
  const base = size === 'desktop'
    ? shellDesktop('diary', 'Workshop diary', baseFn('desktop'))
    : shellTablet('diary', 'Workshop diary', baseFn('tablet'));
  const id = 'new-job-title';
  const maxW = size === 'desktop' ? 1000 : 640;
  const centered = `<div style="max-width: ${maxW}px; margin: 0 auto; width: 100%">${newJobBody(size, bodyOpts)}</div>`;
  // A single scrolling column (unlike the job pages' two independently
  // scrolling columns), so the service select's warning banner (item 23)
  // never sits clipped below the fold — dialogBody's overflow:hidden is
  // right for those, not for this longer form; the footer (Cancel/Save job)
  // stays pinned outside the scrolling body either way.
  const body = `<div style="flex-grow: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; padding: 20px; display: flex; flex-direction: column; gap: 14px">${centered}</div>`;
  const footer = size === 'desktop'
    ? row(`${button('Cancel', { variant: 'ghost', href: `${closeId}-${size}.dc.html` })}<div style="flex-grow: 1"></div>${button('Save job', { variant: 'primary' })}`, 10)
    : button('Save', { block: true });
  return dialogOverlay(base, w, h, `${dialogHeader('New job', `${closeId}-${size}.dc.html`, '', id)}${body}${dialogFooter(footer)}`, { pad, full: true, labelledby: id });
}
// Tue 15 Sep · 10:00 · Alex Morgan has 30 minutes free before Alex's next job
// (10:30, WH-1081) — item 23's warning example. Ready by: Tomorrow, matching
// the diary time's own "tomorrow" (Wed 16 Sep), not the global today.
const NEW_JOB_OPTS = { freeMinutes: 30, readyByDate: '2026-09-16', readyByIdx: 1, storageDefault: 'Hook 3', receiptNote: 'Rear brake squeals and feels weak.' };
screens['new-job'] = {
  desktop: newJobDialog('desktop', DW, DH, 6, { baseFn: (s) => diaryFrozenContent(s), bodyOpts: NEW_JOB_OPTS }),
  tablet: newJobDialog('tablet', TW, TH, 28, { baseFn: (s) => diaryFrozenContent(s) }),
  phone: dialogPhone('New job', 'diary-phone.dc.html', stack(newJobBody('phone'), 10), button('Save', { block: true })),
};
// new-job-day (brief item 2): opened from Jo's column in the day view, Thu 17
// Sep 16:00 — the mechanic is pre-filled from the column clicked, not chosen
// automatically, and there's no matching customer search result yet. Jo's
// last job ends exactly at 16:00, so there are 120 minutes free until the
// 18:00 grid end — no warning (item 23: "keep, ... no warning"). Item 26: the
// bike is already here, so "The bike is here now" is ticked and the starting
// status is "Bike is here"; a staff note is already on the job.
const NEW_JOB_DAY_OPTS = {
  when: 'Thu 17 Sep · 16:00', mechanic: 'Jo Taylor', mechHint: 'From the column you clicked.', showCustomer: false, freeMinutes: 120,
  readyByDate: '2026-09-17', readyByIdx: 0, startingStatusIdx: 1, bikeHereChecked: true, storageDefault: 'Hook 5',
  receiptNote: 'Please check the bottom bracket — the customer says there is play.',
  staffNotes: [{ who: 'Jo Taylor', when: '16:02', text: 'Customer will collect after work.' }],
};
screens['new-job-day'] = {
  desktop: newJobDialog('desktop', DW, DH, 6, { baseFn: (s) => diaryDayFrozenContent(s), closeId: 'diary-day', bodyOpts: NEW_JOB_DAY_OPTS }),
  tablet: newJobDialog('tablet', TW, TH, 28, { baseFn: (s) => diaryDayFrozenContent(s), closeId: 'diary-day', bodyOpts: NEW_JOB_DAY_OPTS }),
  phone: dialogPhone('New job', 'diary-day-phone.dc.html', stack(newJobBody('phone', NEW_JOB_DAY_OPTS), 10), button('Save', { block: true })),
};
// new-job-pick (desktop only, item 1 of the 27 Sep round): the state after
// pressing "New job" in the diary toolbar — the button reads "Choose a time",
// a slim instruction bar sits above the grid, free time is gently tinted and
// busy blocks fade back, and the picked slot (Tue 15 Sep · 10:00 · Alex, which
// stays free in the example data) shows as a solid hover target linking to
// new-job-desktop. Tablet/phone aren't drawn this round (brief item 25) — New
// job there goes straight to the New job form instead of through a pick step.
function pickInstructionBar(size) {
  return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; border-radius: 8px; background: ${C.hover}; border: 1px solid ${C.accent}; font-size: 13px; font-weight: 600; color: ${C.accentDark}">
<span>Click a free time in the diary for the new job. Esc to cancel.</span>
<a href="diary-${size}.dc.html" style="display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; font-size: 13px; font-weight: 600; text-decoration: none">Cancel</a>
</div>`;
}
function diaryPickContent(size) {
  const days = size === 'desktop' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const slotH = size === 'desktop' ? 29 : 30;
  return stack(`${diaryToolbar('Everyone', size, { newJob: 'active' })}
${pickInstructionBar(size)}
${row(`${waitingColumn(size, -1)}${weekGrid({ days, size, slotH, mechFilter: 'Everyone', pickMode: true, selectSlot: HINT_SLOT })}`, 16, 'align-items: flex-start')}`, 12);
}
function desktopOnlyPlaceholder(size, backHref, backLabel = '‹ Back to the diary') {
  const body = stack(`${note('This screen is being iterated on desktop first (27 Sep 2026 round). Tablet and phone will be redrawn once the desktop design is agreed.')}
<div>${link(backLabel, backHref)}</div>`, 12);
  return size === 'phone' ? shellPhone('Not drawn yet', phoneBody(body), { active: 'diary' }) : shellTablet('diary', 'Not drawn yet', `<div style="max-width: 480px">${body}</div>`);
}
screens['new-job-pick'] = {
  desktop: shellDesktop('diary', 'Workshop diary', diaryPickContent('desktop')),
  tablet: desktopOnlyPlaceholder('tablet', 'diary-tablet.dc.html'),
  phone: desktopOnlyPlaceholder('phone', 'diary-phone.dc.html'),
};

// ---------- Row 4: The job — ONE page, no tabs (decision 20 supersedes the
// five tabs; decision 21's checklist notes). Every stage (job-overview,
// job-book-in, job-quote, job-mechanic, job-waiting-parts, job-finished,
// job-collection) is the same page, differing only in status/stage, which
// section is emphasised, and the footer's action(s) — brief item 5. ----------
const jobCloseHref = (size, mechanic = false) => `${mechanic ? 'diary-mechanic' : 'diary'}-${size}.dc.html`;

// Header: job number, status badge, stage (the title), with the customer's
// details — name (linking to their account), phone, email and bike — moved
// in underneath (item 24 of the 27 Sep round; the separate "Customer & bike"
// card is dropped from the left column below to make room for it there).
// Fix (27 Sep round): the header used to show the stage twice — the status
// badge ("Expected") followed by a plain-text stage label that, on
// job-overview, was also "Expected". The stage label now only shows when it
// says something the badge doesn't already say.
const showsStage = (stageLabel, status) => stageLabel && stageLabel !== status;
function jobPageHeader(jobNum, status, tone, stageLabel, closeHref, id, customer = JOB_CUSTOMER, storageSlot = null) {
  const custLink = `<a href="customer-desktop.dc.html" aria-label="View ${esc(customer.name)}'s account" style="display: inline-flex; align-items: center; gap: 4px; font-size: 16px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(customer.name)}<span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 13, C.accentDark)}</span></a>`;
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 7px; min-width: 0">
<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
<h2 id="${id}" style="margin: 0; font-family: ${MONO}; font-size: 16px; font-weight: 700">${esc(jobNum)}</h2>${badge(status, tone)}${showsStage(stageLabel, status) ? `<span style="font-size: 12px; color: ${C.muted}">${esc(stageLabel)}</span>` : ''}
</div>
<div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">${custLink}<span style="font-size: 13px; color: ${C.muted}">${esc(customer.phone)} · ${esc(customer.email)}</span></div>
<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap"><span style="font-size: 13px; color: ${C.ink}">${esc(customer.bike)}</span>${storageSlot ? `<span style="font-size: 12px; color: ${C.muted}">Kept on ${esc(storageSlot)}</span>` : ''}</div>
</div>
<a href="${closeHref}" aria-label="Close, back to the diary" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
// A subtle cue that the column scrolls further, instead of tabs to click through.
const scrollCue = () => `<div aria-hidden="true" style="position: sticky; bottom: 0; left: 0; display: flex; justify-content: center; padding: 3px 0 0; pointer-events: none; background: linear-gradient(to bottom, rgba(251,251,249,0) 0%, ${C.panel} 75%)">${icon('chevron', 14, C.muted)}</div>`;
// Left column: customer & bike, what the customer told us, the agreed work /
// quote lines with totals and approval state (brief item 5).
function jobLeftColumn(size, { editQuote = false } = {}) {
  const total = LINES.reduce((sum, [, , a]) => sum + Number(a.replace('£', '')), 0);
  const approvedTotal = LINES.filter((_, i) => DECISIONS[i][0] === 'Approved').reduce((sum, [, , a]) => sum + Number(a.replace('£', '')), 0);
  // Item 24: the "Customer & bike" card moved into the pop-up header, freeing
  // this column to lead with what the customer told us and the agreed work.
  return stack(`${panel(`${h2('What the customer told us', 15)}${quote(CONCERN)}`, '', 14, 6)}
${panel(`${h2(editQuote ? 'Quote (edit mode) · revision 2' : 'Agreed work', 15)}${table([['Work'], ['Qty', 'center'], ['Amount', 'right'], ['Approval']], linesTableRows(), { size: 13, pad: '7px 8px' })}<div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid ${C.border}; font-size: 14px; font-weight: 700"><span>${editQuote ? 'All proposed work' : 'Approved total'}</span>${mono(editQuote ? `£${total.toFixed(2)}` : `£${approvedTotal.toFixed(2)}`)}</div>${editQuote ? area('Message to Maya', 'We found worn rear pads. The gear cable is optional; it can wait.', 'quote-msg-' + size, 3) : note('Gear cable declined. Anything beyond these lines needs a new approval.', 12)}`, '', 14, 8)}
${scrollCue()}`, 12);
}
// Checklist (decision 21): each item is a checkbox with an optional note — a
// mix of ticked-with-no-note (customer sees "All working well"), one written
// note (the brakes item, stage2 copy), and an "Add note" link on the rest.
const CHECKLIST = [
  { t: 'Frame & fork', checked: true, note: '' },
  { t: 'Wheels & tyres', checked: true, note: '' },
  { t: 'Gears indexed', checked: true, note: '' },
  { t: 'Brakes bled & adjusted', checked: true, note: 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' },
  { t: 'Cables & housing', checked: false, note: '' },
];
function checklistRow(item, idx, size) {
  const id = `cl-${idx}-${size}`;
  let sub;
  if (item.note) sub = area('Note for the customer', item.note, id + '-note', 2);
  else if (item.checked) sub = note(`<span style="color: ${C.muted}">Customer sees: “All working well”</span>`, 12);
  else sub = `<div>${link('+ Add note')}</div>`;
  return `<div style="display: flex; flex-direction: column; gap: 5px; padding: 8px 0; ${idx ? `border-top: 1px solid ${C.border};` : ''}">${check(item.t, item.checked, id)}<div style="padding-left: 28px">${sub}</div></div>`;
}
function checklistPanel(size, { emphasize = false } = {}) {
  return panel(`${h2('Standard service checklist', emphasize ? 16 : 15)}${CHECKLIST.map((it, i) => checklistRow(it, i, size)).join('')}`, emphasize ? `border-color: ${C.accent}` : '', 14, 4);
}
// Messages: latest few + a reply box (brief item 5's right-hand section).
function messagesPanel(size) {
  return panel(`${h2('Messages', 15)}${stack(`${note(`<strong>You</strong> · today ${mono('09:14')} — “Your bike is booked in and we’ve started the safety check.”`)}${note(`<strong>Maya Patel</strong> · today ${mono('09:20')} — “Thanks, how long roughly?”`)}`, 8)}${area('Reply to Maya', '', 'msg-reply-' + size, 2)}${button('Send', { size: 'sm' })}`, '', 14, 8);
}
// History: a compact timeline (brief item 5's right-hand section).
const HISTORY_ALL = [
  ['08:02', 'Booking confirmed by Maya Patel'],
  ['09:05', 'Bike booked in · tag printed'],
  ['09:40', 'Quote sent — awaiting approval'],
  ['10:10', 'Quote approved (pads); gear cable declined'],
  ['11:30', 'Work started by Alex Morgan'],
  ['15:30', 'Work finished — final checks complete'],
  ['16:52', 'Payment taken at the Wheelhouse till'],
  ['17:05', 'Collected by Maya Patel'],
];
function historyPanel(size, upTo) {
  return panel(`${h2('History', 15)}${HISTORY_ALL.slice(0, upTo).map(([t, d]) => `<div style="display: flex; gap: 8px; font-size: 12px; color: ${C.muted}"><span style="font-family: ${MONO}; flex-shrink: 0">${esc(t)}</span><span>${esc(d)}</span></div>`).join('')}`, '', 14, 6);
}
// Right column: an optional stage-specific top section (e.g. the bike tag, the
// delay note), then the checklist (wide — where the mechanic works), then
// messages and history lower down (brief item 5).
function jobRightColumn(size, { top = '', emphasizeChecklist = false, historyUpTo = 4 } = {}) {
  return stack(`${top}${checklistPanel(size, { emphasize: emphasizeChecklist })}${grid('1.4fr 1fr', `${messagesPanel(size)}${historyPanel(size, historyUpTo)}`, 14)}${scrollCue()}`, 12);
}
function jobColumns(left, right, leftMax = 320) {
  return `<div style="flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(260px, ${leftMax}px) minmax(0, 1fr); gap: 20px">
<div style="min-width: 0; min-height: 0; overflow: hidden auto; display: flex; flex-direction: column">${left}</div>
<div style="min-width: 0; min-height: 0; overflow: hidden auto; display: flex; flex-direction: column">${right}</div>
</div>`;
}
// One scrolling column for the phone, in the same order as the columns above —
// no tabs and no tap-to-open accordions (the page is short enough to scroll
// straight through); the main action stays pinned in the footer.
function jobPhoneBody(size, { jobNum, status, tone, stageLabel, top = '', historyUpTo = 4, editQuote = false, customer = JOB_CUSTOMER }) {
  return stack(`<div style="display: flex; flex-direction: column; gap: 5px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><h2 style="margin: 0; font-family: ${MONO}; font-size: 14px; font-weight: 700">${esc(jobNum)}</h2>${badge(status, tone)}</div>
${showsStage(stageLabel, status) ? `<span style="font-size: 11px; color: ${C.muted}">${esc(stageLabel)}</span>` : ''}
<a href="customer-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(customer.name)}<span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 12, C.accentDark)}</span></a>
<span style="font-size: 12px; color: ${C.muted}">${esc(customer.phone)} · ${esc(customer.email)}</span>
<span style="font-size: 12px; color: ${C.ink}">${esc(customer.bike)}</span>
</div>
${panel(`${h2('What the customer told us', 14)}${quote(CONCERN)}`, '', 12, 5)}
${panel(`${h2(editQuote ? 'Quote (edit mode)' : 'Agreed work', 14)}${table([['Work'], ['Amount', 'right']], LINES.map(([w, , a], i) => [two(w, ''), mono(a)]), { size: 12, pad: '5px 6px' })}`, '', 12, 5)}
${top}
${panel(`${h2('Standard service checklist', 14)}${CHECKLIST.map((it, i) => checklistRow(it, i, size)).join('')}`, '', 12, 4)}
${panel(`${h2('Messages', 14)}${note(`<strong>Maya Patel</strong> · ${mono('09:20')} — “Thanks, how long roughly?”`, 12)}`, '', 12, 5)}
${panel(`${h2('History', 14)}${HISTORY_ALL.slice(0, historyUpTo).map(([t, d]) => `<div style="display: flex; gap: 8px; font-size: 11px; color: ${C.muted}"><span style="font-family: ${MONO}; flex-shrink: 0">${esc(t)}</span><span>${esc(d)}</span></div>`).join('')}`, '', 12, 5)}`, 12);
}
// Builds the desktop/tablet/phone triple for one job stage. All seven stages
// share this one builder — only the config below differs (brief item 5).
function buildJobPage({ jobNum = 'WH-1042', status, tone, stageLabel, top = () => '', emphasizeChecklist = false, historyUpTo = 4, editQuote = false, footer, mechanic = false }) {
  const id = 'job-page-title';
  const closeHref = (size) => jobCloseHref(size, mechanic);
  const opts = mechanic ? { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' } : {};
  function build(size, w, h, pad) {
    const base = size === 'desktop'
      ? shellDesktop('diary', 'Workshop diary', mechanic ? diaryFrozenContentMechanic('desktop') : diaryFrozenContent('desktop'), opts)
      : shellTablet('diary', 'Workshop diary', mechanic ? diaryFrozenContentMechanic('tablet') : diaryFrozenContent('tablet'), opts);
    const chrome = jobPageHeader(jobNum, status, tone, stageLabel, closeHref(size), id, JOB_CUSTOMER, size === 'desktop' ? STORAGE[jobNum] : null);
    const body = dialogBody(jobColumns(jobLeftColumn(size, { editQuote }), jobRightColumn(size, { top: top(size), emphasizeChecklist, historyUpTo }), size === "tablet" ? 400 : 440), 24, 0);
    return dialogOverlay(base, w, h, `${chrome}${body}${footer ? dialogFooter(footer(size)) : ''}`, { pad, full: true, labelledby: id });
  }
  return {
    desktop: build('desktop', DW, DH, 32),
    tablet: build('tablet', TW, TH, 28),
    phone: dialogPhone(JOB_CUSTOMER_LABEL, closeHref('phone'), jobPhoneBody('phone', { jobNum, status, tone, stageLabel, top: top('phone'), historyUpTo, editQuote }), footer ? footer('phone') : '', stageLabel),
  };
}

// 9. job-overview — "Job · expected"
screens['job-overview'] = buildJobPage({
  status: 'Expected', tone: 'blue', stageLabel: 'Expected', historyUpTo: 1,
  footer: (size) => button('Book in', { block: true, href: `job-book-in-${size}.dc.html` }),
});

// 10. job-book-in — "Job · booked in, tag printed"; tag preview with a Code
// 128 barcode + print status, near the top of the right column.
function tagPreview() {
  return `<figure aria-label="Bike tag preview" style="margin: 0; box-sizing: border-box; padding: 14px; border-radius: 8px; border: 1px solid ${C.ink}; background: #ffffff; display: flex; flex-direction: column; gap: 5px">
<div style="font-size: 10px; font-weight: 700; letter-spacing: 1px">NORTH STREET CYCLES</div>
<div style="font-family: ${MONO}; font-size: 26px; line-height: 1.1">WH-1042</div>
<div style="font-size: 12px; font-weight: 700">TREK DOMANE AL 3</div>
<div style="font-size: 12px">Green · black mudguards</div>
${barcode128('WH-1042', 220, 42)}
<div style="text-align: center; font-family: ${MONO}; font-size: 12px">WH-1042</div>
<div style="font-size: 11px; color: ${C.muted}">Scan the barcode to open the staff job</div>
<div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; padding-top: 5px; border-top: 1px solid ${C.border}"><span>IN: <span style="font-family: ${MONO}">17 SEP 2026</span></span><span>KEEP WITH BIKE</span></div>
</figure>`;
}
const bookInTop = () => `${row(`${tagPreview()}${panel(`${row(`${h2('Bike tag sent', 14)}${badge('Acknowledged', 'green')}`, 10, 'justify-content: space-between')}${txt('Front desk Zebra · 1 copy', 13)}${note(`${mono('09:12')} · printed by Jack Lewis`, 12)}${note('Attach the tag where it can be scanned without removing it from the bike.', 12)}`, '', 12, 6)}`, 12, 'align-items: flex-start; flex-wrap: wrap')}`;
screens['job-book-in'] = buildJobPage({
  status: 'In workshop', tone: 'blue', stageLabel: 'Booked in, tag printed', top: bookInTop, historyUpTo: 2,
  footer: (size) => button('Full job', { variant: 'default', block: true, href: `job-overview-${size}.dc.html` }),
});

// 11. job-quote — "Job · quote"; the quote (left column) is in edit mode.
screens['job-quote'] = buildJobPage({
  status: 'Awaiting approval', tone: 'purple', stageLabel: 'Quote — awaiting approval', editQuote: true, historyUpTo: 3,
  footer: () => button('Send quote', { block: true }),
});

// 12. job-mechanic — "Job · in the workshop (mechanic)"; the checklist is
// emphasised (it's where the mechanic works); close → diary-mechanic.
screens['job-mechanic'] = buildJobPage({
  status: 'In workshop', tone: 'blue', stageLabel: 'In the workshop', emphasizeChecklist: true, historyUpTo: 5, mechanic: true,
  footer: (size) => button('Mark ready for collection', { block: true, href: `job-finished-${size}.dc.html` }),
});

// 13. job-waiting-parts — "Job · waiting for parts"; a delay/parts section on top.
const waitingTop = (size) => panel(`${h2('Waiting for parts', 15)}${field('Part / reason', { value: 'Replacement rear brake pads delayed', id: 'wp-reason-' + size })}${field('Revised target ready', { type: 'datetime-local', value: '2026-09-19T16:00', id: 'wp-revised-' + size })}${area('Customer update', 'The brake pads are arriving later than expected. We’re aiming for Saturday at 16:00 and will confirm as soon as your bike is ready.', 'wp-update-' + size, 3)}${note('Target dates are estimates. This update does not mark the bike ready.', 12)}`, `border-color: ${ST.waiting[1]}`, 14, 8);
screens['job-waiting-parts'] = buildJobPage({
  status: 'Waiting for parts', tone: 'amber', stageLabel: 'Waiting for parts', top: waitingTop, historyUpTo: 5,
  footer: () => button('Save delay & send update', { block: true }),
});

// 14. job-finished — "Job · finished"; one "Take payment" step (Wheelhouse till).
const finishedTop = (size) => `${banner(`Alex finished the work and final checks at ${mono('15:30')}. The bike is still in the shop.`)}
${panel(`${h2('Payment', 15)}<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 14px">Agreed work</span>${mono('£111.00', 'font-size: 18px')}</div>`, '', 14, 6)}`;
screens['job-finished'] = buildJobPage({
  status: 'Work finished', tone: 'grey', stageLabel: 'Work finished', top: finishedTop, historyUpTo: 6,
  footer: (size) => `${button('Mark ready & notify customer', { block: true })}${button('Take payment', { variant: 'primary', block: true, iconName: 'till', href: 'job-collection-' + size + '.dc.html' })}${note('Goes to this shop’s till — the Wheelhouse till or Lightspeed — as set in Settings.', 12)}`,
});

// 15. job-collection — "Job · collection"; hand-back checklist, paid state.
const collectionTop = (size) => `${panel(`${h2('Hand the bike back', 15)}${check('Bike handed to the customer or authorised collector', true, 'coll1-' + size)}${check('Lock key and rear light returned', true, 'coll2-' + size)}${field('Collected by', { value: 'Maya Patel', id: 'coll-by-' + size })}`, '', 14, 8)}
${panel(`${row(`${h2('Payment', 15)}${badge('Paid', 'green')}`, 10, 'justify-content: space-between')}<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 14px">Agreed work</span>${mono('£111.00', 'font-size: 18px')}</div>${note('Taken at the Wheelhouse till today at ' + mono('16:52') + '.', 12)}`, '', 14, 8)}`;
screens['job-collection'] = buildJobPage({
  status: 'Ready for collection', tone: 'green', stageLabel: 'Ready for collection', top: collectionTop, historyUpTo: 8,
  footer: () => button('Record collection', { block: true }),
});

// ---------- Row 5: Overview page (stage2 `desk`, under Workshop › Overview) ----------
const STATS_DESK = [['Expected today', '8 bikes', '3 still to arrive'], ['In the workshop', '12', '4 ready to collect'], ['Planned effort', '6h / 8h', 'Shared and assigned, counted once']];
const ARRIVALS = [
  ['WH-1042', 'Maya Patel', 'Trek Domane AL 3', 'Standard service', () => button('Book in', { size: 'sm', href: 'job-overview-desktop.dc.html' })],
  ['WH-1045', 'Jamie Brooks', 'Giant Escape 2', 'Gear adjustment', () => `<span style="font-size: 13px">${mono('10:30')} appointment</span>`],
  ['WH-1047', 'Aisha Khan', 'Cannondale Quick', 'Safety check', () => '<span style="font-size: 13px">Drop-off</span>'],
];
function overviewContent(size) {
  return stack(`${txt('Thursday 17 September · one shop, one view of the work', 15, `color: ${C.muted}`)}
${grid('repeat(3, minmax(0, 1fr))', STATS_DESK.map(([k, v, s]) => panel(`${eyebrow(k)}<div style="font-size: 24px; font-weight: 700">${esc(v)}</div>${note(s)}`, '', 16, 4)).join(''))}
${segmented(['Arrivals · 3', 'Shared queue · 4', 'Needs attention · 2', 'Ready · 4'], 0, 'Show jobs')}
${card(table([['Job / customer'], ['Bike'], ['Work'], ['Custody'], ['', 'right']], ARRIVALS.map(([j, n, b, w, a]) => [`${mono(j)} · ${esc(n)}`, esc(b), esc(w), badge('Expected', 'blue'), a()])), 'overflow: hidden')}`, 14);
}
function overviewPhoneContent(size) {
  return stack(`${txt('Thursday 17 September', 14, `color: ${C.muted}`)}
${STATS_DESK.map(([k, v, s]) => rowCard(`<div style="display: flex; flex-direction: column; gap: 2px">${eyebrow(k)}<span style="font-size: 12px; color: ${C.muted}">${esc(s)}</span></div>`, `<span style="font-size: 18px; font-weight: 700">${esc(v)}</span>`)).join('')}
${segmented(['Arrivals · 3', 'Shared · 4'], 0, 'Show jobs')}
${ARRIVALS.map(([j, n, b, w, a]) => rowCard(two(`${mono(j)} · ${esc(n)}`, `${esc(b)} · ${esc(w)}`), a())).join('')}`, 10);
}
screens.overview = {
  desktop: shellDesktop('overview', 'Workshop overview', overviewContent('desktop')),
  tablet: shellTablet('overview', 'Workshop overview', overviewContent('tablet')),
  phone: shellPhone('Overview', phoneBody(overviewPhoneContent('phone'), '', 10), { active: 'overview' }),
};

// ---------- Row 6: Customer account (desktop only, item 3 of the 27 Sep round) ----------
// Front desk › Customers › Maya Patel — reached from the customer link on
// every job board. Jobs are pulled straight from JOBS/customerBikeOf (WH-1042
// and every other Maya Patel job already in the example week — nothing
// hand-picked), so this stays consistent if the example week changes.
function customerBody(size) {
  const mayaJobs = JOBS.filter((j) => customerBikeOf(j)[0] === 'Maya Patel').sort((a, b) => a.day - b.day || a.start - b.start);
  const jobRows = mayaJobs.map((j) => {
    const [dayName, date] = DAYS[j.day];
    const t = `${String(Math.floor(j.start / 60)).padStart(2, '0')}:${String(j.start % 60).padStart(2, '0')}`;
    const work = j.detail.includes('·') ? j.detail.split('·').slice(1).join('·').trim() : j.detail;
    return [mono(j.job), `${dayName} ${date} Sep · ${t}`, esc(work), statusBadge(j.key)];
  });
  return stack(`<div>${link('‹ Back to job', 'job-overview-desktop.dc.html')}</div>
${eyebrow('Front desk › Customers')}
${h2(JOB_CUSTOMER.name, 22)}
${panel(`${h2('Contact details', 15)}${txt(JOB_CUSTOMER.phone)}${txt(JOB_CUSTOMER.email)}`, '', 14, 6)}
${panel(`${h2('Bikes on file', 15)}${txt(JOB_CUSTOMER.bike)}`, '', 14, 6)}
${panel(`${h2('Workshop jobs', 15)}${table([['Job'], ['When'], ['Work'], ['Status']], jobRows, { size: 13 })}`, '', 14, 10)}
${panel(`${h2('Purchases', 15)}${note('[past purchases from the till]')}`, '', 14, 6)}`, 16);
}
screens.customer = {
  desktop: shellDesktop('customers', 'Customer', `<div style="max-width: 760px">${customerBody('desktop')}</div>`),
  tablet: desktopOnlyPlaceholder('tablet', 'job-overview-tablet.dc.html', '‹ Back to job'),
  phone: desktopOnlyPlaceholder('phone', 'job-overview-phone.dc.html', '‹ Back to job'),
};

// Keep the agreed screen order (brief's Row 1–5 order), with this round's new
// boards (diary-day, diary-settings, change-selected, new-job-day,
// new-job-pick, customer) slotted in beside the screens they extend.
const ORDER = ['diary', 'diary-mechanic', 'waiting-open', 'diary-day', 'diary-settings', 'change-selected', 'request-new', 'request-decline', 'request-change', 'request-cancel', 'new-job-pick', 'new-job', 'new-job-day', 'job-overview', 'job-book-in', 'job-quote', 'job-mechanic', 'job-waiting-parts', 'job-finished', 'job-collection', 'customer', 'overview'];
const ordered = Object.fromEntries(ORDER.map((k) => [k, screens[k]]));
for (const k of Object.keys(screens)) delete screens[k];
Object.assign(screens, ordered);

export const ROWS = [
  { label: 'The diary', screens: ['diary', 'diary-mechanic', 'waiting-open', 'diary-day', 'diary-settings', 'change-selected'] },
  { label: 'Requests, as a pop-up', screens: ['request-new', 'request-decline', 'request-change', 'request-cancel'] },
  { label: 'New job from an empty slot', screens: ['new-job-pick', 'new-job', 'new-job-day'] },
  { label: 'The job — one page, no tabs', screens: ['job-overview', 'job-book-in', 'job-quote', 'job-mechanic', 'job-waiting-parts', 'job-finished', 'job-collection'] },
  { label: 'Customer account', screens: ['customer'] },
  { label: 'Overview page', screens: ['overview'] },
];
