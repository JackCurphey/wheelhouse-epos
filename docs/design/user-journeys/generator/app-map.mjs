// Journey A — App map and navigation, redrawn in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-app-map-review.md
//
// Reuses the approved Workshop day shells (diary.mjs) so the frame stays one
// design. Example data is only what the generator already has: North Street
// Cycles, Bolton, Till B1, Jo Taylor, and Maya Patel's job WH-1042 with its
// approved lines (£111.00).
import { C, MONO, esc, icon, button, card, badge, logoSlot } from './ui.mjs';
import { DW, DH, PW as _PW } from './stage1.mjs';
import { shellDesktop, headerSearch, ROOMS_DIARY, LINES_APPROVED, WORK_TOTAL_APPROVED, screens as diaryScreens, a11ySettingRow, symbolsPreview, largerTextPreview, avatarWithCog, searchIconBtn, shellTablet, shellPhone, TW, TH } from './diary.mjs';

const SHOP = 'North Street Cycles';
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const money = (n) => `£${n.toFixed(2)}`;


// ---------- Till pieces ----------
const onlinePill = (dark = true) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: ${dark ? 'rgba(255,255,255,0.12)' : C.okBg}; color: ${dark ? '#ffffff' : C.successInk}">${icon('wifi', 14)}Online</span>`;
const barBtn = (inner, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; min-width: 44px; justify-content: center; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 600">${inner}</button>`;

// The till's own charcoal bar. Decision 13: Serving switches who's serving
// (PIN check-in); no till menu — the rail's name badge opens Your settings.
export function tillBar({ back = false, serving = 'Jo Taylor', offline = null } = {}) {
  return `<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 14px; background: ${C.accentDark}; color: #ffffff">
${back ? `<a href="#" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px 0 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600">${icon('back', 18)}Back to the shop</a>` : ''}
<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">${mono('Till B1')}</span><span style="font-size: 12px; opacity: 0.8">Bolton · ${SHOP}</span></span>
<span style="flex-grow: 1"></span>
${offline === null ? onlinePill() : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: ${C.warnBg}; color: ${C.warnInk}">${icon('wifi', 14)}Offline · ${offline} waiting to send</span>`}
${serving ? barBtn(`${icon('user', 16)}Serving: ${serving}`, `Serving: ${serving} — switch who’s serving`) : `<span style="font-size: 14px; opacity: 0.85">Nobody serving — enter your PIN</span>`}
</header>`;
}

// Left: the till's one search box (decision 12: products, customers and jobs)
// and the shop's product buttons (not designed yet — journey 11).
// `query` draws the box mid-search with grouped results over the buttons.
const resultGroup = (title, inner) => `<div style="display: flex; flex-direction: column; gap: 4px"><div style="padding: 0 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${title}</div>${inner}</div>`;
const resultRow = (main, sub, action, first = false) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 6px 12px; border-radius: 8px; text-decoration: none; color: ${C.ink}; background: ${first ? C.hover : 'transparent'}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${main}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span><span style="font-size: 13px; font-weight: 600; color: ${C.ink}">${action}</span></a>`;
function searchResults() {
  return `<div role="listbox" aria-label="Search results" style="position: absolute; top: 58px; left: 0; right: 0; z-index: 3; box-sizing: border-box; padding: 10px 8px; display: flex; flex-direction: column; gap: 12px; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(38,36,32,0.18)">
${resultGroup('Jobs', resultRow(`${mono('WH-1042')} · Maya Patel`, `Trek Domane AL 3 · Standard service · approved ${mono(money(WORK_TOTAL_APPROVED))}`, 'Add to basket ↵', true))}
${resultGroup('Customers', resultRow('Maya Patel', 'Customer · Trek Domane AL 3', 'Add to sale'))}
${resultGroup('Products', `<div style="padding: 6px 12px; font-size: 14px; color: ${C.muted}">No products match “maya”.</div>`)}
</div>`;
}
function productArea({ query = '', compact = false } = {}) {
  return `<div style="position: relative; flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px">
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${query ? C.ink : C.input}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input type="search" aria-label="Search or scan: products, customers, jobs" placeholder="${compact ? 'Search or scan' : 'Search or scan: products, customers, jobs'}" value="${esc(query)}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
${query ? searchResults() : ''}
<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; color: ${C.muted}; font-size: 14px; line-height: 1.5">Product buttons and search results${compact ? '' : '<br>(designed with Selling at the till, journey 11)'}</div>
</div>`;
}

// Right: the basket, loaded with Maya Patel's approved job (or empty).
function basketEmpty(width) {
  return card(`<div style="height: 100%; box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 12px">
<h2 style="margin: 0; font-size: 17px; font-weight: 700">Basket</h2>
<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 14px; color: ${C.muted}">Nothing in the basket yet.<br>Search, scan or tap a product.</div>
<button type="button" disabled style="display: flex; width: 100%; align-items: center; justify-content: center; min-height: 44px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 15px; font-weight: 600">Take payment</button>
</div>`, `width: ${width}px; flex-shrink: 0; height: 100%`);
}
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

const tillBody = (basketW, pad = 20, { query = '' } = {}) => `<div style="height: 100%; box-sizing: border-box; padding: ${pad}px; display: flex; gap: 20px">${productArea({ query })}${query ? basketEmpty(basketW) : basket(basketW)}</div>`;

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

export function foldedRail(active, { forced = false } = {}) {
  const groups = staffRooms().map(([, items]) => items);
  return `${forced ? '' : RAIL_CSS}<div class="wh-rail" style="position: relative; width: 84px; flex-shrink: 0; display: flex">
<nav aria-label="Main, folded" style="width: 84px; box-sizing: border-box; padding: 8px 6px; display: flex; flex-direction: column; gap: 6px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; justify-content: center; padding-bottom: 2px">${logoSlot('Wheelhouse logo', true)}</div>
<button type="button" aria-label="Unfold the menu" aria-expanded="${forced}" style="display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 44px; justify-content: center; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 12px; font-weight: 600"><span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 16)}</span>Unfold</button>
${groups.map((g, i) => `<div style="display: flex; flex-direction: column; gap: 1px; ${i ? 'padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.18)' : ''}">${g.map(([key, label, ic]) => `<a href="#" aria-current="${key === active ? 'page' : 'false'}" style="${railItemStyle(key === active)}">${icon(ic, 19)}<span style="font-size: 12px; font-weight: ${key === active ? 700 : 500}; line-height: 1.12; text-align: center">${esc(label)}</span></a>`).join('')}</div>`).join('')}
<div style="flex-grow: 1"></div>
<a href="your-settings-desktop.dc.html" aria-label="Your settings — ${STAFF.person}, ${STAFF.roleName}" title="Your settings" style="display: flex; justify-content: center; align-items: center; min-height: 44px; color: #ffffff; text-decoration: none">${avatarWithCog(initials(STAFF.person))}</a>
</nav>
${unfoldedPanel(active, forced)}
</div>`;
}

const tillRail = (forced, query = '') => `<div style="position: relative; width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">${foldedRail('till', { forced })}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar()}<main style="flex-grow: 1; min-height: 0">${tillBody(400, 20, { query })}</main></div></div>`;

// ---------- Screens ----------
export const screens = {};

// Decision 4: on the Till page the sidebar folds to the rail. Rest the
// pointer on the rail (300 ms) to unfold it — this board really does it.
screens['till-rail'] = { desktop: tillRail(false) };
// The same moment frozen: the rail unfolded over the till.
screens['till-rail-open'] = { desktop: tillRail(true) };
// Decision 12: one box finds products, customers and jobs — typing "maya"
// before anything is in the basket.
screens['till-search'] = { desktop: tillRail(false, 'maya') };

// Decision 8: "Your settings" pop-up, opened from your name, for every role.
// Holds the Accessibility settings (Workshop day decision 57 plus decision 7's
// folded sidebar). Decision 6: each switch applies at once — no Save button.
function yourSettingsDialog(size = 'desktop') {
  const P = size === 'phone';
  const rows = [
    a11ySettingRow('ys-symbols', 'Show status symbols', 'Adds a small symbol to each diary job so its status doesn’t rely on colour alone. Helpful for colour blindness.', false, symbolsPreview(size)),
    a11ySettingRow('ys-motion', 'Reduce motion', 'Turns off animations, such as the arrow that shows where a customer wants to move a job. Also switches on automatically when your computer is set to reduce motion.', false),
    a11ySettingRow('ys-text', 'Larger text', 'Makes text across Wheelhouse a step larger.', false, largerTextPreview(size)),
    a11ySettingRow('ys-rail', 'Folded sidebar', P ? 'Not used on a phone, where the menu button opens the rooms.' : size === 'tablet' ? 'On a tablet the sidebar is always the icon rail; tap Unfold to open it.' : 'Folds the sidebar down to icons on every page, for more room. Rest the pointer on it to unfold it. The Till always has it folded.', false),
  ];
  if (P) rows.pop(); // the folded sidebar doesn't apply on a phone
  // Journey B decision 6: each person sets their own till PIN here.
  const label = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;
  const pinBlock = `${label('Till')}${card(`<div style="padding: 16px; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px"><span style="font-size: 15px; font-weight: 700">Till PIN</span><span aria-label="PIN is set" style="font-family: ${MONO}; font-size: 18px; letter-spacing: 3px">••••</span></div><span style="font-size: 13px; line-height: 1.45; color: ${C.muted}">Checks you in at the till and puts your name on sales. Only you know it.</span>${button('Change PIN', { variant: 'default', block: true, href: `pin-change-${size}.dc.html` })}</div>`)}`;
  const accBlock = `${label('Accessibility')}${rows.join('')}<p style="margin: 0; font-size: 13px; color: ${C.muted}">Changes apply straight away.</p>`;
  return `<div role="dialog" aria-modal="true" aria-labelledby="ys-title-${size}" style="${P ? 'width: 100%; height: 100%;' : 'width: 900px; max-height: 100%; border: 1px solid ' + C.border + '; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28);'} box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">
<div style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="ys-title-${size}" style="margin: 0; font-size: 20px; font-weight: 700">Your settings</h2><span style="font-size: 13px; color: ${C.muted}">${STAFF.person} · ${STAFF.roleName} · ${P ? 'just for you' : 'just for you, they don’t change what others see'}</span></div>
<a href="diary-${size}.dc.html" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</div>
${P ? `<div data-scroll style="padding: 14px; display: flex; flex-direction: column; gap: 10px; flex-grow: 1; min-height: 0; overflow-y: auto">${pinBlock}${accBlock}</div>`
  : `<div style="padding: 18px 22px 22px; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 22px; align-items: start"><div style="display: flex; flex-direction: column; gap: 12px">${pinBlock}</div><div style="display: flex; flex-direction: column; gap: 12px">${accBlock}</div></div>`}
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
  sand: { highlight: null, name: 'Soft sand', headerBg: C.panel, headerInk: C.ink, headerBorder: C.border, accent: C.accent, ground: C.bg, mutedInk: C.muted },
  ocean: { highlight: 'Book a repair', name: 'Ocean Blue', headerBg: '#1a3f66', headerInk: '#ffffff', headerBorder: '#1a3f66', accent: '#2f5f96', ground: '#ffffff', mutedInk: '#4a5560' },
};
export function siteDesktop(themeKey, active = 'Shop', content = null) {
  const t = SITE_THEMES[themeKey];
  const dark = t.headerInk === '#ffffff';
  const navLink = (label) => `<a href="#"${label === active ? ' aria-current="page"' : ''} style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: ${label === active ? 700 : 500}; color: ${t.headerInk}; text-decoration: ${label === active ? 'underline' : 'none'}; text-decoration-thickness: 2px; text-underline-offset: 8px">${label}</a>`;
  const headerBtn = (ic, label, text) => `<a href="#" aria-label="${label}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 6px; font-size: 15px; font-weight: 500; color: ${t.headerInk}; text-decoration: none">${icon(ic, 20)}${text}</a>`;
  return `${dark ? '<style>.site-search-dark::placeholder{color: rgba(255,255,255,0.85); opacity: 1}</style>' : ''}<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; background: ${t.ground}">
<header style="height: 72px; flex-shrink: 0; box-sizing: border-box; padding: 0 40px; display: flex; align-items: center; gap: 28px; background: ${t.headerBg}; color: ${t.headerInk}; border-bottom: 1px solid ${t.headerBorder}">
<a href="#" style="display: flex; align-items: center; gap: 10px; color: ${t.headerInk}; text-decoration: none">${logoSlot('Shop logo', dark)}<span style="font-size: 18px; font-weight: 700">${SHOP}</span></a>
<nav aria-label="Website" style="display: flex; gap: 24px; flex-grow: 1">${['Shop', 'Book a repair', 'Our shops'].filter((l) => l !== t.highlight).map(navLink).join('')}</nav>
<label style="display: flex; align-items: center; gap: 8px; width: 240px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${dark ? 'rgba(255,255,255,0.4)' : C.input}; background: ${dark ? 'rgba(255,255,255,0.1)' : '#ffffff'}; color: ${dark ? 'rgba(255,255,255,0.85)' : C.muted}">${icon('search', 16)}<input class="${dark ? 'site-search-dark' : ''}" type="search" aria-label="Search the shop" placeholder="Search the shop" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; color: inherit"></label>
${headerBtn('user', 'Your account', 'Account')}
${headerBtn('basket', 'Basket, 0 items', 'Basket')}
${t.highlight ? `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 8px; background: #ffffff; color: ${t.headerBg}; font-size: 15px; font-weight: 700; text-decoration: none">${t.highlight}</a>` : ''}
</header>
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 40px; display: flex; flex-direction: column; gap: 20px">
${content ?? `<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${dark ? '#b8c4d0' : C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; color: ${t.mutedInk}; font-size: 15px; line-height: 1.5">Page content — the shop’s pages, laid out in its theme<br>(designed with Find the shop and browse the website, journey 1)</div>`}
</main>
<footer style="flex-shrink: 0; box-sizing: border-box; padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${dark ? '#d5dde6' : C.border}; font-size: 13px; color: ${t.mutedInk}"><span>${SHOP} · Bolton</span><span style="display: flex; gap: 20px"><a href="#" style="color: inherit">Contact us</a><a href="#" style="color: inherit">Delivery and returns</a><a href="#" style="color: inherit">Privacy</a></span></footer>
</div>`;
}
screens['site'] = { desktop: siteDesktop('sand') };
screens['site-ocean'] = { desktop: siteDesktop('ocean') };

// ---------- Staff app (decisions 2, 8) ----------
// The approved Workshop day pages, now with the header search and the
// Your settings name button. A mechanic's sidebar shows only the Workshop room.
screens['staff-app'] = { desktop: diaryScreens.diary.desktop };
screens['staff-app-mechanic'] = { desktop: diaryScreens['diary-mechanic'].desktop };

// ================= Tablet and phone (decision 14) =================
// Hover becomes a tap on touch screens; search is a magnifying-glass button
// in the staff header (decision 2). The staff shells (diary.mjs) already carry
// the search button and the name badge that opens Your settings.

// ---- Staff app ----
screens['staff-app'].tablet = diaryScreens.diary.tablet;
screens['staff-app'].phone = diaryScreens.diary.phone;
screens['staff-app-mechanic'].tablet = diaryScreens['diary-mechanic'].tablet;
screens['staff-app-mechanic'].phone = diaryScreens['diary-mechanic'].phone;
// Phone menu open: the rooms, the site switcher and your name (Your settings).
screens['staff-app-menu'] = {
  phone: shellPhone('Workshop diary', `<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 12px"></div>`, { menuOpen: true, active: 'diary' }),
};

// ---- Till ----
const tillTablet = (forced, query = '') => `<div style="position: relative; width: ${TW}px; height: ${TH}px; display: flex; background: ${C.bg}">${foldedRail('till', { forced })}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar()}<main style="flex-grow: 1; min-height: 0">${tillBody(360, 18, { query })}</main></div></div>`;
screens['till-rail'].tablet = tillTablet(false);
screens['till-rail-open'].tablet = tillTablet(true);
screens['till-search'].tablet = tillTablet(false, 'maya');

// Phone till: menu button (no rail on a phone), the one search box, the
// product buttons, and the basket as a bar along the bottom.
export const tillPhoneBar = (serving = 'Jo Taylor') => `<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 6px; display: flex; align-items: center; gap: 6px; background: ${C.accentDark}; color: #ffffff">
<button type="button" aria-label="Open menu" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: #ffffff">${icon('menu', 22)}</button>
<span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${mono('Till B1')}</span><span style="font-size: 12px; opacity: 0.85">Bolton · ${icon('wifi', 12)} Online</span></span>
${serving ? `<button type="button" aria-label="Serving: ${serving} — switch who’s serving" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 600">${icon('user', 16)}${serving.split(' ')[0]}</button>` : `<span style="font-size: 13px; opacity: 0.85; padding-right: 8px">Nobody serving</span>`}
</header>`;
function tillPhone(query = '') {
  const lines = LINES_APPROVED.filter((l) => l.approval === 'Approved');
  const bar = tillPhoneBar();
  const basketBar = query
    ? `<div style="flex-shrink: 0; box-sizing: border-box; padding: 12px 14px 16px; border-top: 1px solid ${C.border}; background: ${C.panel}; display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">Nothing in the basket yet.</span><button type="button" disabled style="display: flex; width: 100%; align-items: center; justify-content: center; min-height: 48px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 15px; font-weight: 600">Take payment</button></div>`
    : `<div style="flex-shrink: 0; box-sizing: border-box; padding: 12px 14px 16px; border-top: 1px solid ${C.border}; background: ${C.panel}; display: flex; flex-direction: column; gap: 8px">
<a href="#" aria-label="Open the basket" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; color: ${C.ink}; text-decoration: none"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Basket · ${lines.length} items</span><span style="font-size: 13px; color: ${C.muted}">Maya Patel · ${mono('WH-1042')}</span></span><span style="display: inline-flex; align-items: center; gap: 6px">${mono(money(WORK_TOTAL_APPROVED), 'font-size: 20px')}<span style="display: inline-flex; transform: rotate(180deg)">${icon('chevron', 16)}</span></span></a>
${button(`Take payment · ${money(WORK_TOTAL_APPROVED)}`, { block: true })}
</div>`;
  return `<div style="position: relative; width: ${_PW}px; height: 844px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">${bar}
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 12px 14px; display: flex; flex-direction: column">${productArea({ query, compact: true })}</main>
${basketBar}</div>`;
}
screens['till-rail'].phone = tillPhone();
screens['till-search'].phone = tillPhone('maya');

// ---- Your settings ----
screens['your-settings'].tablet = `<div style="position: relative; width: ${TW}px; height: ${TH}px; overflow: hidden">${diaryScreens.diary.tablet}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${yourSettingsDialog('tablet')}</div></div>`;
screens['your-settings'].phone = `<div style="position: relative; width: ${_PW}px; height: 844px; overflow: hidden; display: flex">${yourSettingsDialog('phone')}</div>`;

// ---- Customer website ----
export function siteTablet(themeKey, content = null) {
  const t = SITE_THEMES[themeKey];
  const dark = t.headerInk === '#ffffff';
  const iconBtn = (ic, label) => `<a href="#" aria-label="${label}" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${t.headerInk}">${icon(ic, 20)}</a>`;
  const navLink = (label) => `<a href="#"${label === 'Shop' ? ' aria-current="page"' : ''} style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: ${label === 'Shop' ? 700 : 500}; color: ${t.headerInk}; text-decoration: ${label === 'Shop' ? 'underline' : 'none'}; text-decoration-thickness: 2px; text-underline-offset: 8px">${label}</a>`;
  return `<div style="width: ${TW}px; height: ${TH}px; display: flex; flex-direction: column; background: ${t.ground}">
<header style="height: 68px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 22px; background: ${t.headerBg}; color: ${t.headerInk}; border-bottom: 1px solid ${t.headerBorder}">
<a href="#" style="display: flex; align-items: center; gap: 10px; color: ${t.headerInk}; text-decoration: none">${logoSlot('Shop logo', dark)}<span style="font-size: 18px; font-weight: 700">${SHOP}</span></a>
<nav aria-label="Website" style="display: flex; gap: 22px; flex-grow: 1">${['Shop', 'Book a repair', 'Our shops'].filter((l) => l !== t.highlight).map(navLink).join('')}</nav>
${iconBtn('search', 'Search the shop')}${iconBtn('user', 'Your account')}${iconBtn('basket', 'Basket, 0 items')}
${t.highlight ? `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 8px; background: #ffffff; color: ${t.headerBg}; font-size: 15px; font-weight: 700; text-decoration: none">${t.highlight}</a>` : ''}
</header>
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 28px; display: flex">${content ?? `<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${dark ? '#b8c4d0' : C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; color: ${t.mutedInk}; font-size: 15px; line-height: 1.5">Page content — the shop’s pages, laid out in its theme<br>(designed with Find the shop and browse the website, journey 1)</div>`}</main>
<footer style="flex-shrink: 0; box-sizing: border-box; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${dark ? '#d5dde6' : C.border}; font-size: 13px; color: ${t.mutedInk}"><span>${SHOP} · Bolton</span><span style="display: flex; gap: 20px"><a href="#" style="color: inherit">Contact us</a><a href="#" style="color: inherit">Delivery and returns</a><a href="#" style="color: inherit">Privacy</a></span></footer>
</div>`;
}
export function sitePhone(themeKey, { menuOpen = false, content = null } = {}) {
  const t = SITE_THEMES[themeKey];
  const dark = t.headerInk === '#ffffff';
  const iconBtn = (ic, label, extra = '') => `<a href="#" aria-label="${label}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${t.headerInk}; ${extra}">${icon(ic, 20)}</a>`;
  const menu = menuOpen ? `<nav aria-label="Website" style="position: absolute; top: 60px; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; background: ${t.ground === '#ffffff' ? '#ffffff' : C.panel}">
${t.highlight ? `<a href="#" style="display: flex; align-items: center; justify-content: center; min-height: 52px; margin-bottom: 8px; border-radius: 8px; background: ${t.headerBg}; color: #ffffff; font-size: 17px; font-weight: 700; text-decoration: none">${t.highlight}</a>` : ''}
${['Shop', 'Book a repair', 'Our shops', 'Account'].filter((l) => l !== t.highlight).map((l) => `<a href="#" style="display: flex; align-items: center; min-height: 52px; border-bottom: 1px solid ${C.border}; font-size: 17px; font-weight: 600; color: ${C.ink}; text-decoration: none">${l}</a>`).join('')}
</nav>` : '';
  return `<div style="position: relative; width: ${_PW}px; height: 844px; display: flex; flex-direction: column; background: ${t.ground}; overflow: hidden">
<header style="height: 60px; flex-shrink: 0; box-sizing: border-box; padding: 0 4px 0 14px; display: flex; align-items: center; gap: 2px; background: ${t.headerBg}; color: ${t.headerInk}; border-bottom: 1px solid ${t.headerBorder}">
<a href="#" style="display: flex; align-items: center; gap: 8px; flex-grow: 1; min-width: 0; color: ${t.headerInk}; text-decoration: none">${logoSlot('Shop logo', dark)}<span style="font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${SHOP}</span></a>
${iconBtn('search', 'Search the shop')}${iconBtn('basket', 'Basket, 0 items')}
<button type="button" aria-label="${menuOpen ? 'Close menu' : 'Open menu'}" aria-expanded="${menuOpen}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: ${t.headerInk}">${icon(menuOpen ? 'close' : 'menu', 22)}</button>
</header>
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 16px; display: flex">${content ?? `<div style="flex-grow: 1; box-sizing: border-box; border: 2px dashed ${dark ? '#b8c4d0' : C.border}; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 16px; color: ${t.mutedInk}; font-size: 14px; line-height: 1.5">Page content<br>(journey 1)</div>`}</main>
${menu}
</div>`;
}
screens['site'].tablet = siteTablet('sand');
screens['site'].phone = sitePhone('sand');
screens['site-ocean'].tablet = siteTablet('ocean');
screens['site-ocean'].phone = sitePhone('ocean');
screens['site-menu'] = { phone: sitePhone('sand', { menuOpen: true }) };
screens['site-ocean-menu'] = { phone: sitePhone('ocean', { menuOpen: true }) };


// ---------- The app map (one large board) ----------
export const MAP_W = 1760, MAP_H = 1180;
const ROLE_NAMES = { O: 'Owner', M: 'Manager', S: 'Staff', K: 'Mechanic' };
const roleChips = (r) => Object.keys(ROLE_NAMES).map((k) => r.includes(k) ? badge(ROLE_NAMES[k], 'green') : `<span style="display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 12px; color: ${C.muted}; border: 1px dashed ${C.border}">${ROLE_NAMES[k]}</span>`).join(' ');
const mapBox = (title, sub, inner) => card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px"><div style="display: flex; flex-direction: column; gap: 4px"><div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${C.muted}">${esc(sub)}</div><h2 style="margin: 0; font-size: 22px; font-weight: 700">${esc(title)}</h2></div>${inner}</div>`, 'flex: 1; min-width: 0');
const mapLine = (a, b) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 14px"><span style="font-weight: 600">${a}</span><span style="text-align: right">${b}</span></div>`;
const mapP = (t) => `<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
screens['map'] = {
  single: `<div style="width: ${MAP_W}px; height: ${MAP_H}px; box-sizing: border-box; padding: 48px; display: flex; flex-direction: column; gap: 28px; background: ${C.bg}">
<div style="display: flex; flex-direction: column; gap: 8px"><h1 style="margin: 0; font-size: 38px; line-height: 1.2; font-weight: 700; letter-spacing: -0.3px">How Wheelhouse fits together</h1>${mapP('Three places people use Wheelhouse, and how they move between them.')}</div>
<div style="display: flex; gap: 20px; align-items: stretch">
${mapBox('Customer side', 'THE SHOP’S WEBSITE', `<div style="display: flex; flex-direction: column; gap: 10px">${mapP('Customers never sign in to the staff app. Everything they do lives on the shop’s website, in the shop’s own theme.')}
${mapLine('Website', 'Home · Shop · Product · Our shops')}
${mapLine('Buy', 'Basket → Checkout → Order confirmed')}
${mapLine('Book a repair', 'Service → Bike → Date → Details → Request sent')}
${mapLine('Booking link', 'Opened from a text or email; no sign-in needed')}
${mapLine('Account (optional)', 'Sign in with an emailed code → bookings, bikes, history')}</div>`)}
${mapBox('Staff app', 'ONE APP, ORGANISED BY ROOMS OF THE SHOP', `<div style="display: flex; flex-direction: column; gap: 4px">${mapP('Signed in with email and password. The sidebar groups pages by room and shows only what each role may use. Search sits at the top of every page (on the till it finds products too); your name opens Your settings.')}
${ROOMS_DIARY.map(([room, items]) => `<div style="padding-top: 8px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${C.muted}">${room}</div>` + items.map(([, label, , r]) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border-top: 1px solid ${C.border}"><span style="font-size: 14px; font-weight: 600">${label}</span><span style="display: flex; gap: 4px">${roleChips(r)}</span></div>`).join('')).join('')}</div>`)}
${mapBox('Till mode', 'ON A REGISTERED TILL', `<div style="display: flex; flex-direction: column; gap: 10px">${mapP('A till computer is set up once by a manager. It stays signed in, works offline, and staff check in with a PIN. The sidebar is folded to the rail and unfolds when you rest on it.')}
${mapLine('Start-up', `${mono('Till B1')} · Bolton · online or offline`)}
${mapLine('Check in', 'Pick your name → enter PIN')}
${mapLine('Sell', 'Sale → Take payment → Receipt')}
${mapLine('Rest of the shop', 'Rest on the rail → pick a page')}</div>`)}
</div>
${card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">After signing in, each role lands here</h2>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">
${[['Owner', 'Office › Today', 'Takings, workshop, anything needing attention'], ['Manager', 'Office › Today', 'Same as the owner'], ['Staff', 'Front desk › Till', 'Or whichever page they used last'], ['Mechanic', 'Workshop › Diary', 'Their jobs and the shared queue']].map(([r, where, why]) => `<div style="padding: 16px; border-radius: 10px; border: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">${r.toUpperCase()}</span><span style="font-size: 18px; font-weight: 700">${where}</span><span style="font-size: 14px; color: ${C.muted}">${why}</span></div>`).join('')}
</div></div>`)}
</div>`,
};

export const TITLES = {
  'map': 'How Wheelhouse fits together',
  'staff-app': 'Staff app — Staff (search on every page, your name opens Your settings)',
  'staff-app-mechanic': 'Staff app — Mechanic sees only the Workshop room',
  'staff-app-menu': 'Staff app — phone menu open',
  'site-menu': 'Customer website — phone menu open',
  'site-ocean-menu': 'Customer website — phone menu open, shop’s own theme',
  'site': 'Customer website — default theme (Soft sand)',
  'site-ocean': 'Customer website — a shop’s own theme (example: Ocean Blue, Book a repair as its button)',
  'your-settings': 'Your settings — opened from your name',
  'till-rail': 'Till — sidebar folded to the rail (rest on it to unfold)',
  'till-rail-open': 'Till — rail unfolded',
  'till-search': 'Till — one search finds products, customers and jobs',
};

export const ROWS = [
  { label: 'App map', screens: ['map'] },
  { label: 'Staff app', screens: ['staff-app', 'staff-app-mechanic', 'staff-app-menu'] },
  { label: 'Till mode', screens: ['till-rail', 'till-rail-open', 'till-search'] },
  { label: 'Your settings', screens: ['your-settings'] },
  { label: 'Customer website', screens: ['site', 'site-menu', 'site-ocean', 'site-ocean-menu'] },
];
