// The Settings frame for Owner setup (journey 8): the areas listed down the
// left (decision 3), each area's settings as folding sections, saved as you
// go with a "Saved · Undo" note (decision 4). Shared by setup.mjs and by
// diary.mjs, whose Diary & storage settings now sit in Settings › Workshop
// (journey 8 decision 12). Drawn for Jack Lewis (Manager) unless a board
// passes `who`.
//
// Size-aware (decision 21): setSize() picks desktop, tablet or phone before a
// board is drawn. Tablet keeps the desktop layout with a narrower area list;
// on a phone, Settings opens on the list of areas (settingsList) and each
// area is its own page with a "‹ Settings" link back; pop-ups fill the
// screen, as in journeys 11 and 16.
import { C, esc, icon, card } from './ui.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { shellDesktop, shellTablet, shellPhone, TW, TH } from './diary.mjs';

let SIZE = 'desktop';
export const setSize = (s) => { SIZE = s; };
export const size = () => SIZE;
export const isPhone = () => SIZE === 'phone';
// Draw one thing at a given size, then put the size back (journey 12's board
// is drawn on demand, in the middle of other builds).
export function withSize(s, fn) { const was = SIZE; SIZE = s; try { return fn(); } finally { SIZE = was; } }
const dims = () => ({ desktop: [DW, DH], tablet: [TW, TH], phone: [PW, PH] })[SIZE];

export const MANAGER = { role: 'M', person: 'Jack Lewis', roleName: 'Manager' };
export const note = (t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">${t}</p>`;

// The staff frame at the current size, with `active` lit in the sidebar.
export function page(active, title, content, who = MANAGER) {
  if (SIZE === 'phone') return shellPhone(title, content, { ...who, active });
  if (SIZE === 'tablet') return shellTablet(active, title, content, who);
  return shellDesktop(active, title, content, who);
}
export const shell = (content, who = MANAGER) => page('settings', 'Settings', content, who);

// The areas of Settings, each with what it holds — every item is one an
// approved journey hands to Owner setup (see the decision file's background).
export const AREAS = [
  ['shop', 'Shop and sites', 'Name, address, VAT, opening hours, sites'],
  ['staff', 'Staff and roles', 'People, roles, clearing a forgotten PIN'],
  ['till', 'Till', 'Quick buttons, reasons, receipts, printers, tills'],
  ['payments', 'Payments', 'Card machine, ways to pay, accounts, customer groups'],
  ['eod', 'End of day', 'Float, when Close the day appears, counting the cash'],
  ['workshop', 'Workshop', 'Services, mechanics, diary, storage slots'],
  ['messages', 'Messages', 'Texts and emails to customers'],
  ['data', 'Your data', 'Download everything, settings changes'],
];

// Journey 13 decision 7 (Jack, 30 Sep): Settings has four pages, one per
// room of the app. A room holding several of the areas above shows them as
// headings, each with its folding sections, and a "Jump to" row of pills.
// AREAS stays as it was for Owner setup's decision 3 option boards.
export const SETTINGS_ROOMS = [
  ['frontdesk', 'Front desk', 'The till, payments, messages to customers and closing the day.', 'Till, payments, messages, end of day', ['till', 'payments', 'messages', 'eod']],
  ['workshop', 'Workshop', '', 'Services, mechanics, diary, storage, collection', ['workshop']],
  ['stockroom', 'Stockroom', '', 'Supplier invoices', ['stock']],
  ['office', 'Office', 'The shop and its sites, the people who work here, and your data.', 'Shop and sites, staff and roles, your data', ['shop', 'staff', 'data']],
];
const roomOf = (area) => SETTINGS_ROOMS.find((r) => r[4].includes(area));
const areaTitle = (k) => (AREAS.find((a) => a[0] === k) || [k, k])[1];

// A folding section: title, a one-line summary, a chevron. On a phone the
// summary sits under the title rather than beside it.
export function fold(title, summary, content = '') {
  const open = !!content;
  const P = SIZE === 'phone';
  const head = P
    ? `<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${esc(title)}</span><span style="font-size: 13px; color: ${C.muted}">${summary}</span></span>`
    : `<span style="font-size: 16px; font-weight: 700; flex-grow: 1">${esc(title)}</span><span style="font-size: 13px; color: ${C.muted}; text-align: right">${summary}</span>`;
  // Journey 13 audit M13: the fold's button sits inside a heading, so a
  // screen reader's list of headings reaches every section. h3 by default;
  // settingsPage makes it h4 under an area's h3.
  return `<div style="border-top: 1px solid ${C.border}">
<h3 data-fold style="margin: 0; font-size: inherit; font-weight: inherit"><button type="button" aria-expanded="${open}" style="display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px; box-sizing: border-box; padding: 8px ${P ? 14 : 18}px; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}">
${head}
<span style="display: inline-flex; transform: rotate(${open ? 180 : 0}deg); color: ${C.muted}">${icon('chevron', 16)}</span>
</button></h3>
${open ? `<div style="padding: 0 ${P ? 14 : 18}px ${P ? 14 : 18}px; display: flex; flex-direction: column; gap: 12px">${content}</div>` : ''}
</div>`;
}

export const pill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;

export const offer = (t, on) => `<button type="button" aria-pressed="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600; flex-shrink: 0">${on ? icon('check', 15, C.panel) : ''}${t}</button>`;

export const choice = (label, items) => `<div role="group" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 600">${label}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${items.map(([t, on]) => pill(t, on)).join('')}</div></div>`;

// Decision 17 (H4): the same note after every change; a failed save says so
// and offers Try again instead of Undo.
function toastHtml(toast) {
  if (!toast) return '';
  const fail = toast.fail;
  const text = toast.text ? toast.text : toast;
  const P = SIZE === 'phone';
  const place = P ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%)';
  return `<div role="status" style="position: absolute; ${place}; display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)"><span style="display: inline-flex; align-items: center; gap: 8px; flex-grow: 1">${icon(fail ? 'alert' : 'check', 16)}${text}</span><button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap">${fail ? 'Try again' : 'Undo'}</button></div>`;
}

// A room's settings page. `active` is the area being shown; a board is drawn
// as if "Jump to" had taken the page to that area, so the areas above it in
// the room have scrolled out of view and the ones below follow on.
export function settingsPage(active, title, intro, sections, { toast = '', banner = '', who = MANAGER } = {}) {
  const P = SIZE === 'phone';
  const [room, roomName, roomIntro, , areas] = roomOf(active);
  const many = areas.length > 1;
  const heading = `<div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: ${P ? 20 : 22}px; font-weight: 700">${esc(roomName)}</h2>${note(many ? roomIntro : intro)}</div>`;
  // Journey 13 audit M13: Jump to is navigation — links, with aria-current.
  const jumpLink = (k) => { const on = k === active; return `<a href="#set-${k}" aria-current="${on ? 'location' : 'false'}" style="display: inline-flex; align-items: center; box-sizing: border-box; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-size: 14px; font-weight: 600; text-decoration: none">${esc(areaTitle(k))}</a>`; };
  const jump = many ? `<nav aria-label="Jump to" style="display: flex; flex-wrap: wrap; gap: 8px">${areas.map(jumpLink).join('')}</nav>` : '';
  const lift = (html) => (many ? html.replace(/<h3 data-fold/g, '<h4 data-fold').replace(/<\/button><\/h3>/g, '</button></h4>') : html);
  const block = (k) => {
    const body = card(lift(k === active ? sections : AREA_FOLDS[k]()), 'overflow: hidden; flex-shrink: 0');
    if (!many) return body;
    return `<section aria-labelledby="set-${k}" style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0"><div style="display: flex; flex-direction: column; gap: 2px"><h3 id="set-${k}" style="margin: 0; font-size: 18px; font-weight: 700">${esc(k === active ? title : areaTitle(k))}</h3>${note(k === active ? intro : AREA_INTROS[k])}</div>${body}</section>`;
  };
  const shown = areas.slice(areas.indexOf(active)).map(block).join('');
  const top = `${banner}${heading}${jump}`;
  if (P) {
    const back = `<a href="set-list-phone.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Settings</a>`;
    const body = `<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 10px">${back}${top}</div><div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${shown}</div>`;
    return shellPhone('Settings', `<div style="position: relative; display: flex; flex-direction: column; gap: 12px; height: 100%">${body}${toastHtml(toast)}</div>`, { ...who, active: 'settings' });
  }
  const list = `<nav aria-label="Settings" style="width: ${SIZE === 'tablet' ? 190 : 220}px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px">${SETTINGS_ROOMS.map(([k, t]) => {
    const on = k === room;
    return `<a href="#" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: ${on ? 700 : 500}; color: ${C.ink}; background: ${on ? C.mutedBg : 'transparent'}">${on ? `<span style="width: 6px; height: 6px; border-radius: 999px; background: ${C.accent}"></span>` : `<span style="width: 6px"></span>`}${esc(t)}</a>`;
  }).join('')}</nav>`;
  const body = `<div style="flex-grow: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px"><div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px">${top}</div>
<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 18px">${shown}</div>
</div>`;
  return shell(`<div style="position: relative; display: flex; gap: ${SIZE === 'tablet' ? 20 : 28}px; height: 100%">${list}${body}${toastHtml(toast)}</div>`, who);
}

// Phone only: Settings opens on its list of rooms (decision 21; journey 13
// decision 7).
export function settingsList(who = MANAGER) {
  const row = ([, t, , sub]) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 14px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${esc(t)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(sub)}</span></span><span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;
  return shellPhone('Settings', `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto">${card(SETTINGS_ROOMS.map(row).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden')}</div>`, { ...who, active: 'settings' });
}

// Pop-ups: in the middle on desktop and tablet (Workshop day 15, 16), the
// whole screen on a phone. Safe choice left, confirming action right.
// close: false drops the ✕ where every way out is a real answer (journey 10's
// float check).
export function popup(id, title, sub, body, footer, width = 520, { close = true } = {}) {
  const [W] = dims();
  const closeBtn = !close ? '' : `<a href="#" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>`;
  if (SIZE === 'phone') return `<div role="dialog" aria-modal="true" aria-labelledby="${id}" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: ${C.bg}"><div style="display: flex; align-items: center; gap: 10px; padding: 10px 8px 10px 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="${id}" style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2><span style="font-size: 13px; color: ${C.muted}">${sub}</span></div>${closeBtn}</div><div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px">${body}</div><div style="display: flex; justify-content: space-between; gap: 10px; padding: 12px 16px 16px; border-top: 1px solid ${C.border}; background: ${C.panel}">${footer}</div></div>`;
  const w = Math.min(width, W - 140);
  return `<div role="dialog" aria-modal="true" aria-labelledby="${id}" style="width: ${w}px; max-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28); overflow: hidden"><div style="display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="${id}" style="margin: 0; font-size: 20px; font-weight: 700">${title}</h2><span style="font-size: 13px; color: ${C.muted}">${sub}</span></div>${closeBtn}</div><div style="padding: 20px 22px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; min-height: 0">${body}</div><div style="display: flex; justify-content: space-between; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.panel}">${footer}</div></div>`;
}
export function overlay(base, d) {
  const [W, H] = dims();
  if (SIZE === 'phone') return `<div style="width: ${W}px; height: ${H}px; display: flex">${d}</div>`;
  return `<div style="position: relative; width: ${W}px; height: ${H}px; overflow: hidden">${base}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${d}</div></div>`;
}

// The Workshop area's sections (journey 8 decision 11 gives the mechanics
// list; decision 12 brings journey 12's diary block and storage settings).
export const workshopFolds = (open = {}) =>
  fold('Services', 'Full service, Individual service', open.services || '')
  + fold('Mechanics', 'Alex Morgan, Jo Taylor, Shared queue', open.mechanics || '')
  + fold('Diary blocks', 'Bike, then job title', open.diary || '')
  + fold('Storage slots', 'On · 8 slots', open.storage || '')
  // Collect the bike and pay decisions 3 and 4: a reminder and a flag for
  // uncollected bikes; hand-back reminders, off by default.
  + fold('Collection', 'Reminder after [n] days · hand-back reminders off', open.collection || '');
export const WORKSHOP_INTRO = 'Services, who works in the workshop, and how the diary looks.';
// The Payments area's sections (journey 8; customer groups from journey 15
// decision 8).
export const PAY_INTRO = 'How customers can pay.';
export const payFolds = (open = {}) =>
  fold('Card machine', '[Card machine] · Till B1', open.card || '')
  + fold('Ways to pay', 'Cash, card and 4 more', open.ways || '')
  + fold('Other ways to pay', 'Finance, Cycle to Work, payment link', open.other || '')
  + fold('Customer groups', '[Club name] members', open.groups || '');

// The other areas' sections (journey 8), here so every room's settings
// page can show all of its areas (journey 13 decision 7).
export const TILL_INTRO = 'What staff see and use at the till.';
export const tillFolds = (open = {}) =>
  fold('Quick buttons', 'Workshop, Parts, Accessories', open.quick || '')
  + fold('Reasons', 'Discount, void, refund, paid-out', open.reasons || '')
  + fold('Receipts', 'Print, email or text', open.receipts || '')
  + fold('Printer and cash drawer', '[Receipt printer]', open.printer || '')
  + fold('Tills', 'Till B1', open.tills || '');
export const EOD_INTRO = 'How the till closes each day.';
export const eodFolds = (open = {}) =>
  fold('Float', '[£ float]', open.float || '')
  + fold('Close the day', '1 hour before closing', open.close || '')
  + fold('Counting the cash', 'Count first', open.count || '');
export const STAFF_INTRO = 'Who works here, and what each person can do.';
export const staffFolds = (open = {}) => fold('People', 'Jack Lewis, Jo Taylor, Alex Morgan', open.people || '') + fold('What each role can do', 'Owner, Manager, Staff, Mechanic', open.roles || '');
export const SHOP_INTRO = 'The shop’s details, its sites and their opening hours.';
export const shopFolds = (open = {}) =>
  fold('Shop details', 'North Street Cycles', open.details || '')
  + fold('Opening hours · Bolton', 'Closed Sundays', open.hours || '')
  + fold('Sites', 'Bolton', open.sites || '');
export const MSG_INTRO = 'The texts and emails customers get from the shop.';
export const msgFolds = (open = {}) =>
  fold('Automatic messages', '5 on', open.list || '')
  + fold('How messages are sent', 'Texts from [sender name] · emails from [email address]', open.sending || '');
export const DATA_INTRO = 'Take a copy of everything, and see who changed what in Settings.';
export const dataFolds = (open = {}) => fold('Download everything', 'Customers, sales, stock, jobs', open.export || '') + fold('Settings changes', 'Who changed what, and when', open.history || '');

// An on/off switch on its own row (journey 5's hand-back reminders).
export const rowSwitch = (label, on) => `<button type="button" role="switch" aria-checked="${on}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 0; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 15px; font-weight: 700">${label}</span><span style="display: inline-flex; align-items: center; gap: 10px"><span style="font-size: 14px; font-weight: 600; color: ${on ? C.ink : C.muted}">${on ? 'On' : 'Off'}</span><span aria-hidden="true" style="position: relative; display: inline-block; width: 44px; height: 26px; border-radius: 999px; background: ${on ? C.accent : C.input}"><span style="position: absolute; top: 3px; left: ${on ? 21 : 3}px; width: 20px; height: 20px; border-radius: 999px; background: #ffffff; box-shadow: 0 1px 2px rgba(28,30,25,0.35)"></span></span></span></button>`;

// Stockroom (journey 13 decision 6): the supplier invoice check, on or off.
export const STOCK_INTRO = 'Deliveries and what suppliers charge for them.';
export const stockFolds = (open = {}) =>
  fold('Supplier invoices', 'Checked against deliveries · on', open.invoices || '')
  // Journey 14 decision 6: big stock adjustments show on Today.
  + fold('Stock adjustments', 'Show on Today over £[amount]', open.adjust || '')
  // Journey 14 decision 10: each category's own details.
  + fold('Categories', 'Bearings, Drivetrain › Derailleurs and [n] more', open.categories || '');

const AREA_FOLDS = { till: tillFolds, payments: payFolds, messages: msgFolds, eod: eodFolds, workshop: workshopFolds, stock: stockFolds, shop: shopFolds, staff: staffFolds, data: dataFolds };
const AREA_INTROS = { till: TILL_INTRO, payments: PAY_INTRO, messages: MSG_INTRO, eod: EOD_INTRO, workshop: WORKSHOP_INTRO, stock: STOCK_INTRO, shop: SHOP_INTRO, staff: STAFF_INTRO, data: DATA_INTRO };
