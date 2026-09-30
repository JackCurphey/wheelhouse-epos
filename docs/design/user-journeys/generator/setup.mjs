// Journey 8 — Owner setup, designed in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-owner-setup-review.md
//
// Decision 2: the Settings page comes first. This round draws three options
// for the overall shape of Settings (Office › Settings, Owners and Managers —
// app map decision 8), desktop only, each with the Till area open as the
// example. Real example data only: North Street Cycles, Bolton, Till B1, Jack
// Lewis (Manager), the till's quick-button groups (Workshop, Parts,
// Accessories) and buttons (Standard service £65, Fit & adjust brakes £18,
// Replace gear cable £12). Everything else is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { shellDesktop } from './diary.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const note = (t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
const shell = (content) => shellDesktop('settings', 'Settings', content, { role: 'M', person: 'Jack Lewis', roleName: 'Manager' });

// The areas of Settings, each with what it holds — every item is one an
// approved journey hands to Owner setup (see the decision file's background).
const AREAS = [
  ['shop', 'Shop and sites', 'Name, address, VAT, opening hours, sites'],
  ['staff', 'Staff and roles', 'People, roles, clearing a forgotten PIN'],
  ['till', 'Till', 'Quick buttons, reasons, receipts, printers, tills'],
  ['payments', 'Payments', 'Card machine, other ways to pay, gift cards, accounts'],
  ['eod', 'End of day', 'Float, when Close the day appears, blind count'],
  ['workshop', 'Workshop', 'Services, mechanics, diary, storage slots'],
  ['messages', 'Messages', 'Texts and emails to customers'],
  ['data', 'Your data', 'Export everything'],
];

// A folding section: title, a one-line summary on the right, a chevron.
function fold(title, summary, content = '') {
  const open = !!content;
  return `<div style="border-top: 1px solid ${C.border}">
<button type="button" aria-expanded="${open}" style="display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px; box-sizing: border-box; padding: 8px 18px; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}">
<span style="font-size: 16px; font-weight: 700; flex-grow: 1">${esc(title)}</span>
<span style="font-size: 13px; color: ${C.muted}; text-align: right">${summary}</span>
<span style="display: inline-flex; transform: rotate(${open ? 180 : 0}deg); color: ${C.muted}">${icon('chevron', 16)}</span>
</button>
${open ? `<div style="padding: 0 18px 18px; display: flex; flex-direction: column; gap: 12px">${content}</div>` : ''}
</div>`;
}
const pill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
const qb = (name, price) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><span style="color: ${C.muted}; font-size: 16px" aria-hidden="true">⋮⋮</span><span style="font-size: 15px; font-weight: 600; flex-grow: 1">${esc(name)}</span>${mono(price, 'font-size: 15px')}</div>`;

// The Till area's sections; `compact` trims the open section for the
// one-long-page option, where everything shares one scroll.
function tillSections({ compact = false } = {}) {
  const quick = `<div role="group" aria-label="Quick button groups" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Workshop', true)}${pill('Parts')}${pill('Accessories')}${pill('+ Add a group')}</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">${qb('Standard service', '£65.00')}${qb('Fit & adjust brakes', '£18.00')}${compact ? '' : qb('Replace gear cable', '£12.00')}</div>
<div>${button('+ Add a button', { variant: 'default' })}</div>`;
  return fold('Quick buttons', 'Workshop, Parts, Accessories', quick)
    + fold('Reasons', 'Discount, void, refund, paid-out')
    + fold('Receipts', 'Print, email or text · barcode on')
    + (compact ? '' : fold('Printers and cash drawer', '[Receipt printer]'))
    + fold('Tills', 'Till B1');
}

// ---------- Option 1: a list of areas down the left, the chosen area on the right ----------
function optionList() {
  const list = `<nav aria-label="Settings areas" style="width: 250px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px">${AREAS.map(([k, t]) => {
    const on = k === 'till';
    return `<a href="#" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: ${on ? 700 : 500}; color: ${C.ink}; background: ${on ? C.mutedBg : 'transparent'}; border-left: 0">${on ? `<span style="width: 6px; height: 6px; border-radius: 999px; background: ${C.accent}"></span>` : `<span style="width: 6px"></span>`}${esc(t)}</a>`;
  }).join('')}</nav>`;
  const body = `<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 22px; font-weight: 700">Till</h2>${note('What staff see and use at the till. Changes save as you go.')}</div>
${card(tillSections(), 'overflow: hidden; padding-top: 0')}
</div>`;
  return shell(`<div style="display: flex; gap: 28px; height: 100%">${list}${body}</div>`);
}

// ---------- Option 2: one long page, every area a folding section ----------
function optionOnePage() {
  const jump = `<div role="group" aria-label="Jump to" style="display: flex; flex-wrap: wrap; gap: 8px">${AREAS.map(([k, t]) => pill(t, k === 'till')).join('')}</div>`;
  const area = (k, t, sub) => k === 'till'
    ? `<div style="display: flex; flex-direction: column; gap: 8px"><h2 style="margin: 0; font-size: 18px; font-weight: 700">${esc(t)}</h2>${card(tillSections({ compact: true }), 'overflow: hidden')}</div>`
    : card(`<button type="button" aria-expanded="false" style="display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px; box-sizing: border-box; padding: 8px 18px; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 17px; font-weight: 700; flex-grow: 1">${esc(t)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(sub)}</span><span style="display: inline-flex; color: ${C.muted}">${icon('chevron', 16)}</span></button>`);
  const shown = AREAS.filter(([k]) => ['staff', 'till', 'payments', 'eod'].includes(k));
  return shell(`<div style="height: 100%; overflow: hidden; display: flex; flex-direction: column; gap: 12px; max-width: 900px">${jump}${shown.map(([k, t, sub]) => area(k, t, sub)).join('')}<div style="text-align: center; font-size: 13px; color: ${C.muted}">… Workshop, Messages, Your data below — the page scrolls</div></div>`);
}

// ---------- Option 3: a hub of area cards; each opens its own page ----------
function optionHub() {
  const tile = ([k, t, sub]) => `<a href="#" style="display: flex; flex-direction: column; gap: 6px; min-height: 120px; box-sizing: border-box; padding: 18px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="font-size: 17px; font-weight: 700">${esc(t)}</span><span style="font-size: 14px; line-height: 1.45; color: ${C.muted}">${esc(sub)}</span></a>`;
  return shell(`<div style="display: flex; flex-direction: column; gap: 14px">${note('North Street Cycles — choose an area.')}<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px">${AREAS.map(tile).join('')}</div></div>`);
}
function optionHubArea() {
  return shell(`<div style="display: flex; flex-direction: column; gap: 12px; max-width: 900px">
<a href="#" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Settings</a>
<h2 style="margin: 0; font-size: 22px; font-weight: 700">Till</h2>
${card(tillSections(), 'overflow: hidden')}
</div>`);
}

def('so-list', optionList);
def('so-onepage', optionOnePage);
def('so-hub', optionHub);
def('so-hub-area', optionHubArea);

for (const [id, fn] of recipes) screens[id] = { desktop: fn() };

export const TITLES = {
  'so-list': 'Option 1 — areas listed down the left, the chosen area beside them',
  'so-onepage': 'Option 2 — one long page, every area a folding section',
  'so-hub': 'Option 3 — a page of area cards…',
  'so-hub-area': 'Option 3 — …each opening its own page',
};
export const ROWS = [
  { label: 'Options — the shape of Settings', screens: ['so-list', 'so-onepage', 'so-hub', 'so-hub-area'] },
];
