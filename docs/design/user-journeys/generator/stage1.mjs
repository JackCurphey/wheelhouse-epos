// Stage 1 drawings: app map, navigation shells, and the sign-in journeys.
// Each screen returns { desktop, phone } inner markup at 1280x800 and 390x844.
import { C, esc, icon, button, field, card, badge, logoSlot, MONO } from './ui.mjs';

export const DW = 1280, DH = 800, PW = 390, PH = 844;
const SHOP = 'North Street Cycles';

// ---------- Staff app ----------
// Navigation grouped by rooms of the shop (Jack, 27 Sep 2026).
// Roles: O = Owner, M = Manager, S = Staff, K = Mechanic.
export const ROOMS = [
  ['Front desk', [['till', 'Till', 'till', 'OMS'], ['orders', 'Online orders', 'orders', 'OMS'], ['customers', 'Customers', 'customers', 'OMS'], ['messages', 'Messages', 'mail', 'OMS']]],
  ['Workshop', [['jobs', 'Jobs', 'workshop', 'OMSK'], ['diary', 'Diary', 'today', 'OMSK'], ['requests', 'Booking requests', 'inbox', 'OMS']]],
  ['Stockroom', [['stock', 'Stock', 'stock', 'OMS'], ['deliveries', 'Deliveries and orders', 'purchasing', 'OM'], ['stocktake', 'Stock take', 'check', 'OMS']]],
  ['Office', [['today', 'Today', 'reports', 'OMS'], ['reports', 'Reports', 'reports', 'OM'], ['website', 'Website', 'website', 'OM'], ['settings', 'Settings', 'settings', 'OM']]],
];
export const NAV = ROOMS.flatMap(([room, items]) => items.map((i) => [...i, room]));
const roomsFor = (role) => ROOMS.map(([room, items]) => [room, items.filter((i) => i[3].includes(role))]).filter(([, items]) => items.length);
const navList = (role, active) => roomsFor(role).map(([room, items]) => `<div style="display: flex; flex-direction: column; gap: 2px"><div style="padding: 2px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(243,242,238,0.7)">${room}</div>${items.map((n) => sideItem(n, active)).join('')}</div>`).join('');

function sideItem([key, label, ic], active) {
  const on = key === active;
  return `<a href="#" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 12px; min-height: 30px; padding: 0 12px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: ${on ? 700 : 500}; color: ${C.sidebarInk}; background: ${on ? C.sidebarActive : 'transparent'}; box-shadow: ${on ? `inset 3px 0 0 ${C.highlight}` : 'none'}">${icon(ic, 18)}<span>${esc(label)}</span></a>`;
}

function siteSwitcher(dark = true) {
  return `<button type="button" aria-label="Switch site" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 40px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${dark ? 'rgba(255,255,255,0.25)' : C.border}; background: ${dark ? 'rgba(255,255,255,0.08)' : '#ffffff'}; color: ${dark ? '#ffffff' : C.ink}; font-family: inherit; text-align: left">
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; opacity: 0.8">${SHOP}</span><span style="font-size: 14px; font-weight: 600">Bolton</span></span>${icon('chevron', 16)}</button>`;
}

export function staffDesktop(active, title, content, { role = 'M', person = 'Jack Lewis', roleName = 'Manager', actions = '' } = {}) {
  return `<div style="width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">
<nav aria-label="Main" style="width: 248px; flex-shrink: 0; box-sizing: border-box; padding: 14px 12px; display: flex; flex-direction: column; gap: 12px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700">Wheelhouse</span></div>
${siteSwitcher(true)}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-top: 1px solid rgba(255,255,255,0.2)">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 700">${esc(person.split(' ').map((p) => p[0]).join(''))}</span>
<span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 14px; font-weight: 600">${esc(person)}</span><span style="font-size: 12px; opacity: 0.8">${esc(roleName)}</span></span>
<a href="#" style="font-size: 13px; color: #ffffff">Sign out</a>
</div>
</nav>
<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0">
<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
<h1 style="margin: 0; font-size: 20px; font-weight: 700; flex-grow: 1">${esc(title)}</h1>
<div style="display: flex; align-items: center; gap: 8px; width: 320px; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; color: ${C.muted}; font-size: 14px">${icon('search', 16)}<span>Search jobs, customers, products</span></div>
${actions}
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 28px; overflow: hidden">${content}</main>
</div>
</div>`;
}

export function staffPhone(title, content, { menuOpen = false, role = 'M', active = 'today' } = {}) {
  const bar = `<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 8px; display: flex; align-items: center; gap: 8px; background: ${C.accentDark}; color: #ffffff">
<button type="button" aria-label="Open menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('menu', 22)}</button>
<h1 style="margin: 0; font-size: 17px; font-weight: 700; flex-grow: 1">${esc(title)}</h1>
<button type="button" aria-label="Search" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('search', 20)}</button>
</header>`;
  const sheet = menuOpen ? `<div style="position: absolute; inset: 0; background: rgba(20,24,22,0.45)"></div>
<nav aria-label="Main" style="position: absolute; top: 0; left: 0; bottom: 0; width: 300px; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 14px; background: ${C.accentDark}; color: #ffffff">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot('Wheelhouse logo', true)}<span style="font-size: 17px; font-weight: 700; flex-grow: 1">Wheelhouse</span><button type="button" aria-label="Close menu" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #ffffff">${icon('close', 20)}</button></div>
${siteSwitcher(true)}
<div style="display: flex; flex-direction: column; gap: 8px">${navList(role, active)}</div>
<div style="flex-grow: 1"></div>
<div style="padding: 10px 8px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-size: 14px"><span>Jack Lewis · Manager</span><a href="#" style="color: #ffffff">Sign out</a></div>
</nav>` : '';
  return `<div style="position: relative; width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">${bar}<main style="flex-grow: 1; box-sizing: border-box; padding: 16px; overflow: hidden">${content}</main>${sheet}</div>`;
}

// ---------- Till mode ----------
export function tillDesktop(content, { serving = 'Alex Morgan', online = true, w = DW, h = DH } = {}) {
  const phone = w < 500;
  return `<div style="width: ${w}px; height: ${h}px; display: flex; flex-direction: column; background: ${C.bg}">
<header style="height: ${phone ? 56 : 60}px; flex-shrink: 0; box-sizing: border-box; padding: 0 ${phone ? 10 : 20}px; display: flex; align-items: center; gap: ${phone ? 8 : 14}px; background: ${C.ink}; color: #ffffff">
<span style="font-size: ${phone ? 15 : 16}px; font-weight: 700; font-family: ${MONO}">Till B1</span>
${phone ? '' : `<span style="font-size: 14px; opacity: 0.8">Bolton · ${SHOP}</span>`}
<span style="flex-grow: 1"></span>
${online ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.12)">${icon('wifi', 14)}Online</span>` : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px; border-radius: 999px; background: ${C.warnBg}; color: ${C.warnInk}">Offline · 3 waiting</span>`}
<button type="button" style="display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px">${icon('user', 16)}${phone ? esc(serving.split(' ')[0]) : 'Serving: ' + esc(serving)}</button>
<button type="button" aria-label="Till menu" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #ffffff">${icon('menu', 18)}</button>
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: ${phone ? 12 : 20}px; overflow: hidden">${content}</main>
</div>`;
}

// ---------- Customer website ----------
export function siteDesktop(content, { active = '' } = {}) {
  const link = (t) => `<a href="#" style="font-size: 15px; font-weight: ${t === active ? 700 : 500}; color: ${C.ink}; text-decoration: ${t === active ? 'underline' : 'none'}; text-underline-offset: 6px">${t}</a>`;
  return `<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; background: ${C.panel}">
<header style="height: 72px; flex-shrink: 0; box-sizing: border-box; padding: 0 40px; display: flex; align-items: center; gap: 28px; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot('Shop logo')}<span style="font-size: 18px; font-weight: 700">${SHOP}</span></div>
<nav aria-label="Website" style="display: flex; gap: 24px; flex-grow: 1">${['Shop', 'Book a repair', 'Our shops'].map(link).join('')}</nav>
<button type="button" aria-label="Search" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: ${C.ink}">${icon('search', 20)}</button>
<a href="#" style="display: inline-flex; align-items: center; gap: 6px; font-size: 15px; color: ${C.ink}; text-decoration: none">${icon('user', 20)}Account</a>
<a href="#" aria-label="Basket, 0 items" style="display: inline-flex; align-items: center; gap: 6px; font-size: 15px; color: ${C.ink}; text-decoration: none">${icon('basket', 20)}Basket</a>
</header>
<main style="flex-grow: 1; box-sizing: border-box; overflow: hidden; background: ${C.bg}">${content}</main>
</div>`;
}

export function sitePhone(content, { menuOpen = false } = {}) {
  const sheet = menuOpen ? `<div style="position: absolute; inset: 56px 0 0 0; background: ${C.panel}; box-sizing: border-box; padding: 8px 16px; display: flex; flex-direction: column">
${['Shop', 'Book a repair', 'Our shops', 'Account', 'Basket'].map((t) => `<a href="#" style="display: flex; align-items: center; min-height: 52px; border-bottom: 1px solid ${C.border}; font-size: 17px; font-weight: 600; color: ${C.ink}; text-decoration: none">${t}</a>`).join('')}
</div>` : '';
  return `<div style="position: relative; width: ${PW}px; height: ${PH}px; display: flex; flex-direction: column; background: ${C.panel}; overflow: hidden">
<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 6px 0 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid ${C.border}">
${logoSlot('Shop logo')}<span style="font-size: 16px; font-weight: 700; flex-grow: 1">${SHOP}</span>
<a href="#" aria-label="Basket, 0 items" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: ${C.ink}">${icon('basket', 20)}</a>
<button type="button" aria-label="${menuOpen ? 'Close menu' : 'Open menu'}" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: ${C.ink}">${icon(menuOpen ? 'close' : 'menu', 22)}</button>
</header>
<main style="flex-grow: 1; box-sizing: border-box; overflow: hidden; background: ${C.bg}">${content}</main>
${sheet}
</div>`;
}

// ---------- Content helpers ----------
export const slot = (label, h = 160) => `<div style="height: ${h}px; box-sizing: border-box; border: 2px dashed ${C.input}; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 14px; text-align: center; padding: 12px">${esc(label)}</div>`;
export const h1 = (t, size = 26) => `<h1 style="margin: 0; font-size: ${size}px; line-height: 1.2; font-weight: 700; letter-spacing: -0.3px">${esc(t)}</h1>`;
export const p = (t, size = 15) => `<p style="margin: 0; font-size: ${size}px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
export const link = (t, href = '#') => `<a href="${href}" style="font-size: 14px; font-weight: 600; color: ${C.accentDark}">${esc(t)}</a>`;
export const stack = (inner, gap = 18) => `<div style="display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;

// Auth layout: centred card on desktop, full width on phone.
function authDesktop(inner, { brand = 'Wheelhouse', maxW = 420 } = {}) {
  return `<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; background: ${C.bg}">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot(brand + ' logo')}<span style="font-size: 20px; font-weight: 700">${esc(brand)}</span></div>
${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 20px">${inner}</div>`, `width: ${maxW}px`)}
</div>`;
}
function authPhone(inner, { brand = 'Wheelhouse' } = {}) {
  return `<div style="width: ${PW}px; height: ${PH}px; box-sizing: border-box; padding: 28px 20px; display: flex; flex-direction: column; gap: 28px; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot(brand + ' logo')}<span style="font-size: 18px; font-weight: 700">${esc(brand)}</span></div>
<div style="display: flex; flex-direction: column; gap: 20px">${inner}</div>
</div>`;
}
const both = (inner, opts) => ({ desktop: authDesktop(inner, opts), phone: authPhone(inner, opts) });

// ---------- Screens ----------
export const screens = {};

// App map (one large board)
function roleChips(r) {
  const names = { O: 'Owner', M: 'Manager', S: 'Staff', K: 'Mechanic' };
  return Object.keys(names).map((k) => r.includes(k) ? badge(names[k], 'green') : `<span style="display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 12px; color: ${C.muted}; border: 1px dashed ${C.border}">${names[k]}</span>`).join(' ');
}
const box = (title, sub, inner, tone = C.accentDark) => card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px"><div style="display: flex; flex-direction: column; gap: 4px"><div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${tone}">${esc(sub)}</div><h2 style="margin: 0; font-size: 22px; font-weight: 700">${esc(title)}</h2></div>${inner}</div>`, 'flex: 1; min-width: 0');
const rowLine = (a, b) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 14px"><span style="font-weight: 600">${a}</span><span>${b}</span></div>`;
export const MAP_W = 1760, MAP_H = 1180;
screens.map = {
  single: `<div style="width: ${MAP_W}px; height: ${MAP_H}px; box-sizing: border-box; padding: 48px; display: flex; flex-direction: column; gap: 28px; background: ${C.bg}">
<div style="display: flex; flex-direction: column; gap: 8px">${h1('How Wheelhouse fits together', 38)}${p('Three places people use Wheelhouse, and how they move between them. Proposal for Jack to approve; which role sees what is a first suggestion.', 17)}</div>
<div style="display: flex; gap: 20px; align-items: stretch">
${box('Customer side', 'THE SHOP’S WEBSITE', stack(`${p('Customers never sign in to the staff app. Everything they do lives on the shop’s website.')}
${rowLine('Website', 'Home · Shop · Product · Our shops')}
${rowLine('Buy', 'Basket → Checkout → Order confirmed')}
${rowLine('Book a repair', 'Service → Bike → Date → Details → Request sent')}
${rowLine('Booking link', 'Opened from a text or email; no sign-in needed')}
${rowLine('Account (optional)', 'Sign in with an emailed code → bookings, bikes, history')}`, 10))}
${box('Staff app', 'ONE APP, ORGANISED BY ROOMS OF THE SHOP', stack(`${p('Signed in with email and password. The sidebar groups pages by room and only shows what each role may use. On a phone it becomes a menu.')}
${ROOMS.map(([room, items]) => `<div style="padding-top: 8px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${C.muted}">${room}</div>` + items.map(([, label, , r]) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border-top: 1px solid ${C.border}"><span style="font-size: 14px; font-weight: 600">${label}</span><span style="display: flex; gap: 4px">${roleChips(r)}</span></div>`).join('')).join('')}`, 4))}
${box('Till mode', 'FULL SCREEN ON A REGISTERED TILL', stack(`${p('A till computer is set up once by a manager. It stays signed in, works offline, and staff check in with a PIN.')}
${rowLine('Start-up', 'Till B1 · Bolton · online or offline')}
${rowLine('Check in', 'Pick your name → enter PIN')}
${rowLine('Sell', 'Sale → Take payment → Receipt')}
${rowLine('Rest of the shop', 'Till menu → opens the staff app (needs a sign-in)')}`, 10))}
</div>
${card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">After signing in, each role lands here</h2>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">
${[['Owner', 'Office › Today', 'Takings, workshop, anything needing attention'], ['Manager', 'Office › Today', 'Same as owner, without billing'], ['Staff', 'Front desk › Till', 'Or Workshop, whichever they used last'], ['Mechanic', 'Workshop › Jobs', 'Their jobs and the shared queue']].map(([r, where, why]) => `<div style="padding: 16px; border-radius: 10px; background: ${C.bg}; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">${r.toUpperCase()}</span><span style="font-size: 18px; font-weight: 700">${where}</span><span style="font-size: 14px; color: ${C.muted}">${why}</span></div>`).join('')}
</div></div>`)}
</div>`,
};

// Shells
screens['shell-staff'] = {
  desktop: staffDesktop('today', 'Today', stack(`<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px">${slot('Takings today')}${slot('Workshop today')}${slot('Needs attention')}</div>${slot('Page content', 300)}`, 16), { actions: button('Open till', { variant: 'accent', iconName: 'till' }) }),
  phone: staffPhone('Today', stack(`${slot('Takings today', 120)}${slot('Workshop today', 120)}${slot('Needs attention', 120)}`, 12)),
};
screens['shell-staff-menu'] = {
  phone: staffPhone('Today', stack(`${slot('Takings today', 120)}${slot('Workshop today', 120)}`, 12), { menuOpen: true }),
  desktop: staffDesktop('jobs', 'Jobs', stack(`${slot('A mechanic only sees the Workshop room in the sidebar', 420)}`), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' }),
};
screens['shell-till'] = {
  desktop: tillDesktop(`<div style="display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 20px; height: 100%">${slot('Search, scan and product buttons', 680)}${slot('Basket and Take payment', 680)}</div>`),
  phone: tillDesktop(stack(`${slot('Search and scan', 180)}${slot('Basket and Take payment', 480)}`, 12), { w: PW, h: PH }),
};
screens['shell-site'] = {
  desktop: siteDesktop(`<div style="padding: 40px; display: flex; flex-direction: column; gap: 20px">${slot('Page content, laid out with the shop’s chosen theme', 560)}</div>`),
  phone: sitePhone(`<div style="padding: 16px">${slot('Page content', 600)}</div>`, { menuOpen: false }),
};
screens['shell-site-menu'] = {
  phone: sitePhone(`<div style="padding: 16px">${slot('Page content', 600)}</div>`, { menuOpen: true }),
  desktop: siteDesktop(`<div style="padding: 40px">${slot('On a desktop the website menu is always visible in the header', 560)}</div>`, { active: 'Book a repair' }),
};

// Staff sign-in
screens['auth-signin'] = both(stack(`${h1('Sign in')}${p('Staff sign-in for your shop.')}
${field('Work email', { value: 'jack@northstreetcycles.example', type: 'email' })}
${field('Password', { type: 'password' })}
<div style="display: flex; justify-content: flex-end">${link('Forgot your password?')}</div>
${button('Sign in', { block: true })}
<div style="padding-top: 16px; border-top: 1px solid ${C.border}">${p('Booked a repair? Use the link in your text or email; you don’t need to sign in.', 14)}</div>`));
screens['auth-forgot'] = both(stack(`${h1('Reset your password')}${p('Enter your work email and we’ll send you a link to choose a new password.')}
${field('Work email', { type: 'email', value: 'alex@northstreetcycles.example' })}
${button('Send reset link', { block: true })}
<div>${link('Back to sign in')}</div>`));
screens['auth-sent'] = both(stack(`<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.accentDark}">${icon('mail', 24)}</span>
${h1('Check your email')}${p('If <strong>alex@northstreetcycles.example</strong> has a Wheelhouse account, a reset link is on its way. It works for 1 hour.')}
${button('Back to sign in', { variant: 'default', block: true })}
<div>${link('Didn’t get it? Send it again')}</div>`));
screens['auth-newpass'] = both(stack(`${h1('Choose a new password')}
${field('New password', { type: 'password', hint: 'At least 10 characters.' })}
${field('Type it again', { type: 'password' })}
${button('Save and sign in', { block: true })}`));
screens['auth-invite'] = both(stack(`${badge('Invitation', 'green')}${h1('Join North Street Cycles')}${p('Jack Lewis has added you to Wheelhouse as <strong>Staff</strong>. Set a password to get started.')}
${field('Your name', { value: 'Jo Taylor' })}
${field('Work email', { value: 'jo@northstreetcycles.example', type: 'email' })}
${field('Choose a password', { type: 'password', hint: 'At least 10 characters.' })}
${button('Join and sign in', { block: true })}`));
const siteCard = (name, code, sub, sel) => `<button type="button" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 64px; padding: 14px 16px; border-radius: 10px; border: ${sel ? `2px solid ${C.accentDark}` : `1px solid ${C.border}`}; background: ${sel ? C.mutedBg : C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${badge(code, 'grey')}</button>`;
screens['auth-site'] = both(stack(`${h1('Where are you working today?')}${p('You work at more than one shop. You can switch any time from the menu.')}
${siteCard('Bolton', 'B', '2 tills · workshop', true)}
${siteCard('[Second site]', 'S', '3 tills', false)}
${button('Continue', { block: true })}`));
screens['auth-signedout'] = both(stack(`${h1('You’ve signed out')}${p('Close this window or sign in again.')}${button('Sign in again', { block: true })}`));
screens['auth-expired'] = both(stack(`<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.warnBg}; color: ${C.warnInk}">${icon('lock', 24)}</span>
${h1('Please sign in again')}${p('You were signed out after a while without activity. We’ll take you back to where you were.')}
${field('Work email', { value: 'jack@northstreetcycles.example', type: 'email' })}
${field('Password', { type: 'password' })}
${button('Sign in', { block: true })}`));
screens['auth-noaccess'] = {
  desktop: staffDesktop('today', 'Reports', `<div style="max-width: 520px">${card(`<div style="padding: 28px; display: flex; flex-direction: column; gap: 14px"><span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.bg}; color: ${C.muted}">${icon('lock', 22)}</span>${h1('Reports aren’t part of your role', 22)}${p('Your role is Staff. Reports live in the Office, which staff don’t see. Ask the owner or a manager if you need access.')}<div>${button('Go to Today', { variant: 'default' })}</div></div>`)}</div>`, { role: 'S', person: 'Jo Taylor', roleName: 'Staff' }),
  phone: staffPhone('Reports', card(`<div style="padding: 22px; display: flex; flex-direction: column; gap: 12px">${h1('Reports aren’t part of your role', 20)}${p('Your role is Staff. Ask the owner or a manager if you need access.')}${button('Go to Today', { variant: 'default', block: true })}</div>`), { role: 'S' }),
};

// Till sign-in
screens['till-setup'] = {
  desktop: authDesktop(stack(`${h1('Set up this till')}${p('Signed in as Jack Lewis (Manager). This computer will become a till and stay signed in.')}
${field('Site', { value: 'Bolton' })}
${field('Till number', { value: '1', hint: 'This till will be called B1. Receipts are numbered B1-0001, B1-0002 and so on.' })}
${field('Name', { value: 'Front counter' })}
${button('Set up this till', { block: true })}`)),
  phone: authPhone(stack(`${h1('Set up this till')}${p('Signed in as Jack Lewis (Manager). This device will become a till and stay signed in.')}
${field('Site', { value: 'Bolton' })}
${field('Till number', { value: '1', hint: 'This till will be called B1.' })}
${field('Name', { value: 'Front counter' })}
${button('Set up this till', { block: true })}`)),
};
const personTile = (name, inToday) => `<button type="button" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 120px; padding: 12px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; color: ${C.ink}"><span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${inToday ? C.okBg : C.bg}; color: ${inToday ? C.accentDark : C.muted}; font-weight: 700">${name.split(' ').map((x) => x[0]).join('')}</span><span style="font-size: 15px; font-weight: 600">${name}</span>${inToday ? badge('Checked in', 'green') : `<span style="font-size: 13px; color: ${C.muted}">Tap to check in</span>`}</button>`;
const people = [['Alex Morgan', true], ['Jo Taylor', false], ['Jack Lewis', false], ['Sam Reid', false]];
screens['till-checkin'] = {
  desktop: tillDesktop(`<div style="max-width: 760px; margin: 40px auto 0; display: flex; flex-direction: column; gap: 20px">${h1('Who’s working today?', 28)}${p('Check in once at the start of the day. Only people who are checked in can be picked for a sale.')}<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px">${people.map(([n, i]) => personTile(n, i)).join('')}</div></div>`, { serving: '—' }),
  phone: tillDesktop(stack(`${h1('Who’s working today?', 22)}${p('Check in once at the start of the day.', 14)}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">${people.map(([n, i]) => personTile(n, i)).join('')}</div>`, 14), { w: PW, h: PH, serving: '—' }),
};
const key = (k) => `<button type="button" style="min-height: 64px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; font-size: 24px; font-weight: 600; color: ${C.ink}">${k}</button>`;
const pinPad = `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].map(key).join('')}</div>`;
const dots = `<div style="display: flex; gap: 14px; justify-content: center">${[1, 1, 0, 0].map((f) => `<span style="width: 16px; height: 16px; border-radius: 999px; border: 2px solid ${C.accentDark}; background: ${f ? C.accentDark : 'transparent'}"></span>`).join('')}</div>`;
screens['till-pin'] = {
  desktop: tillDesktop(`<div style="max-width: 380px; margin: 30px auto 0; display: flex; flex-direction: column; gap: 18px; text-align: center">${h1('Jo Taylor', 26)}${p('Enter your PIN to check in. This works even when the internet is down.')}${dots}${pinPad}<div>${link('Not you? Go back')}</div></div>`, { serving: '—' }),
  phone: tillDesktop(`<div style="display: flex; flex-direction: column; gap: 16px; text-align: center">${h1('Jo Taylor', 22)}${p('Enter your PIN to check in.', 14)}${dots}${pinPad}<div>${link('Not you? Go back')}</div></div>`, { w: PW, h: PH, serving: '—' }),
};

// Customer account sign-in (optional account; decision open)
const custSignin = stack(`${h1('Sign in to your account')}${p('See your bookings, bikes and past work. We’ll email you a code; no password needed.')}
${field('Email', { type: 'email', value: 'maya@example.com' })}
${button('Email me a code', { block: true })}
<div style="padding-top: 14px; border-top: 1px solid ${C.border}">${p('Just want to check a booking? Open the link in your text or email.', 14)}</div>`);
screens['cust-signin'] = {
  desktop: siteDesktop(`<div style="display: flex; justify-content: center; padding-top: 72px">${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${custSignin}</div>`, 'width: 440px')}</div>`, { active: '' }),
  phone: sitePhone(`<div style="padding: 24px 16px; background: ${C.panel}; height: 100%; box-sizing: border-box">${custSignin}</div>`),
};
const codeBoxes = `<div style="display: flex; gap: 8px">${[4, 8, 1, '', '', ''].map((d) => `<span style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 54px; border-radius: 8px; border: 1px solid #bac6bd; background: #ffffff; font-size: 22px; font-weight: 700">${d}</span>`).join('')}</div>`;
const custCode = stack(`${h1('Enter your code')}${p('We sent a 6-digit code to <strong>maya@example.com</strong>. It works for 10 minutes.')}
${codeBoxes}
${button('Sign in', { block: true })}
<div>${link('Send a new code')}</div>`);
screens['cust-code'] = {
  desktop: siteDesktop(`<div style="display: flex; justify-content: center; padding-top: 72px">${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${custCode}</div>`, 'width: 440px')}</div>`),
  phone: sitePhone(`<div style="padding: 24px 16px; background: ${C.panel}; height: 100%; box-sizing: border-box">${custCode}</div>`),
};
