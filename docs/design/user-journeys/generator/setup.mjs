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
import { popup, overlay } from './cashup.mjs';

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

// ---------- The Till area (decision 3's layout; decision 4: saves as you go) ----------
function settingsPage(active, title, intro, sections, { toast = '' } = {}) {
  const list = `<nav aria-label="Settings areas" style="width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px">${AREAS.map(([k, t]) => {
    const on = k === active;
    return `<a href="#" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: ${on ? 700 : 500}; color: ${C.ink}; background: ${on ? C.mutedBg : 'transparent'}">${on ? `<span style="width: 6px; height: 6px; border-radius: 999px; background: ${C.accent}"></span>` : `<span style="width: 6px"></span>`}${esc(t)}</a>`;
  }).join('')}</nav>`;
  const body = `<div data-scroll style="flex-grow: 1; min-width: 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 22px; font-weight: 700">${esc(title)}</h2>${note(intro)}</div>
${card(sections, 'overflow: hidden; flex-shrink: 0')}
</div>`;
  const t = toast ? `<div role="status" style="position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 6px 6px 6px 18px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)"><span style="display: inline-flex; align-items: center; gap: 8px">${icon('check', 16)}${toast}</span><button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">Undo</button></div>` : '';
  return shell(`<div style="position: relative; display: flex; gap: 28px; height: 100%">${list}${body}${t}</div>`);
}
const TILL_INTRO = 'What staff see and use at the till. Changes save as you make them.';
const tillFolds = (open = {}) =>
  fold('Quick buttons', 'Workshop, Parts, Accessories', open.quick || '')
  + fold('Reasons', 'Discount, void, refund, paid-out', open.reasons || '')
  + fold('Receipts', 'Print, email or text', open.receipts || '')
  + fold('Printer and cash drawer', '[Receipt printer]', open.printer || '')
  + fold('Tills', 'Till B1', open.tills || '');

// Quick buttons: groups as pills, the group's buttons in till order. Hover a
// button to reveal Edit and Remove (right-click / long-press kept, Workshop
// day 65); drag the handle to reorder.
const qbRow = (name, sub, price, hover = false) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 8px 0 12px; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}"><button type="button" aria-label="Move ${esc(name)}" style="width: 28px; height: 44px; border: 0; background: transparent; color: ${C.muted}; font-size: 16px">⋮⋮</button><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${esc(name)}</span><span style="font-size: 12px; color: ${C.muted}">${esc(sub)}</span></span>${mono(price, 'font-size: 15px')}${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Edit</button><button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.danger}">Remove</button>` : ''}</div>`;
const quickOpen = (hover = true, added = false) => `<div role="group" aria-label="Quick button groups" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Workshop', true)}${pill('Parts')}${pill('Accessories')}${pill('+ Add a group')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${qbRow('Standard service', 'Labour · 60 min', '£65.00')}${qbRow('Fit & adjust brakes', 'Labour · 30 min', '£18.00', hover)}${qbRow('Replace gear cable', 'Labour', '£12.00')}${added ? qbRow('Shimano brake pads B05S-RX', 'Part', '£28.00') : ''}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">${button('+ Add a button', { variant: 'default' })}${note('Buttons show on the till in this order.')}</div>`;

// Add a quick button: find the product or service, pick its group. The
// button's name and price come from the product; the name can be shortened.
const addButtonDialog = () => popup('qb-title', 'Add a quick button', 'To the Workshop group', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input aria-label="Find a product or service" value="brake pads" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 12px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.mutedBg}"><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Shimano brake pads B05S-RX</span><span style="font-size: 12px; color: ${C.muted}">Part</span></span>${mono('£28.00', 'font-size: 15px')}${icon('check', 18)}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="qb-name" style="font-size: 14px; font-weight: 600">Name on the button</label><input id="qb-name" value="Shimano brake pads B05S-RX" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">The price always comes from the product.</span></div>
<div role="group" aria-label="Group" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Group</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Workshop', true)}${pill('Parts')}${pill('Accessories')}</div></div>`, `${button('Cancel', { variant: 'ghost' })}${button('Add the button')}`);

// Reasons: one list per kind, picked by pill. "Other…" is always offered at
// the till (journey 11's pop-ups), so staff can type their own.
const reasonRow = (t) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 6px 0 10px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><button type="button" aria-label="Move" style="width: 28px; height: 44px; border: 0; background: transparent; color: ${C.muted}; font-size: 16px">⋮⋮</button><span style="font-size: 15px; flex-grow: 1">${t}</span><button type="button" aria-label="Remove this reason" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; display: inline-flex; align-items: center; justify-content: center">${icon('close', 16)}</button></div>`;
const reasonsOpen = () => `<div role="group" aria-label="Which reasons" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Discount', true)}${pill('Void')}${pill('Refund')}${pill('Paid-out')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${reasonRow('[Shop’s reason]')}${reasonRow('[Shop’s reason]')}${reasonRow('[Shop’s reason]')}</div>
<div style="display: flex; gap: 8px"><input aria-label="New discount reason" placeholder="Add a discount reason" style="flex-grow: 1; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${button('Add', { variant: 'default' })}</div>
${note('The till always offers “Other…” as well, so staff can type a reason that isn’t on the list. Every reason shows in the reports.')}`;

// Receipts: which choices the Paid pop-up offers (journey 11 decision 7),
// the words at the bottom, and a preview. The barcode is always printed
// (journey 11 decision 13), so it isn't a setting.
const offer = (t, on) => `<button type="button" aria-pressed="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600">${on ? icon('check', 15, C.panel) : ''}${t}</button>`;
const receiptPreview = () => `<div aria-label="Receipt preview" style="width: 230px; flex-shrink: 0; box-sizing: border-box; padding: 16px 14px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 4px; font-family: ${MONO}; font-size: 11px; line-height: 1.5; color: ${C.ink}; display: flex; flex-direction: column; gap: 6px">
<div style="text-align: center; font-weight: 700; font-size: 12px">North Street Cycles</div><div style="text-align: center">Bolton · Till B1</div>
<div style="border-top: 1px dashed ${C.border}; padding-top: 6px; display: flex; justify-content: space-between"><span>Standard service</span><span>£65.00</span></div>
<div style="display: flex; justify-content: space-between; font-weight: 700"><span>Total</span><span>£65.00</span></div><div style="display: flex; justify-content: space-between"><span>incl. VAT</span><span>£10.83</span></div>
<div style="border-top: 1px dashed ${C.border}; padding-top: 6px; text-align: center; color: ${C.muted}">[Your words at the bottom]</div>
<div aria-hidden="true" style="height: 30px; margin-top: 4px; background: repeating-linear-gradient(90deg, ${C.ink} 0 2px, #ffffff 2px 4px, ${C.ink} 4px 5px, #ffffff 5px 8px)"></div><div style="text-align: center">B1-[0000]</div></div>`;
const receiptsOpen = () => `<div style="display: flex; gap: 24px; align-items: flex-start"><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px">
<div role="group" aria-label="What the Paid pop-up offers" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">After a sale, offer</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${offer('Print', true)}${offer('Email', true)}${offer('Text', true)}</div><span style="font-size: 13px; color: ${C.muted}">“No receipt” is always there too.</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="rc-foot" style="font-size: 14px; font-weight: 600">Words at the bottom</label><textarea id="rc-foot" rows="3" placeholder="e.g. your returns policy, a thank-you" style="box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; resize: none"></textarea></div>
${note('The shop’s name and address come from Shop and sites. Every receipt carries a barcode so a refund can find the sale.')}
</div>${receiptPreview()}</div>`;

// Printer and cash drawer: the till's receipt printer; the drawer opens
// through it.
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid ${C.border}"><span style="font-size: 15px">${k}</span><span style="font-size: 15px; font-weight: 600">${v}</span></div>`;
const printerOpen = () => `${kv('Till B1’s receipt printer', '[Receipt printer]')}${kv('Status', `<span style="display: inline-flex; align-items: center; gap: 6px; color: ${C.successInk}">${icon('check', 16)}Connected</span>`)}${kv('Cash drawer', 'Opens through the printer')}
<div style="display: flex; gap: 8px; padding-top: 4px">${button('Print a test receipt', { variant: 'default' })}${button('Open the drawer', { variant: 'default' })}</div>`;

// Tills: every computer registered as a till. Registering is owner-only for
// now (offline spec l.211), done on the computer that will be the till.
const tillsOpen = () => `<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">Till B1</span><span style="font-size: 13px; color: ${C.muted}">Bolton · registered [date] by [name]</span></span><button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Rename</button>${button('Remove', { variant: 'danger' })}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px">${button('Make this computer a till', { variant: 'default' })}${note('Only the owner can add a till. Do it on the computer that will be the till.')}</div>`;

def('set-till-quick', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen() })));
def('set-till-quick-add', () => overlay(settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen(false) })), addButtonDialog()));
def('set-till-quick-saved', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen(false, true) }), { toast: 'Saved · Shimano brake pads added to Workshop' }));
def('set-till-reasons', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ reasons: reasonsOpen() })));
def('set-till-receipts', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ receipts: receiptsOpen() })));
def('set-till-printer', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ printer: printerOpen() })));
def('set-till-tills', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsOpen() })));

// ---------- End of day (cash-up decisions 2, 4, 5; decision 6: blind on) ----------
const EOD_INTRO = 'How the till closes each day. Changes save as you make them.';
const moneyInput = (id, label, value) => `<div style="display: flex; align-items: center; gap: 10px"><label for="${id}" style="font-size: 15px; font-weight: 600; flex-grow: 1">${label}</label><input id="${id}" value="${value}" style="width: 140px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></div>`;
const choice = (label, items) => `<div role="group" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 600">${label}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${items.map(([t, on]) => pill(t, on)).join('')}</div></div>`;
const eodFolds = () =>
  fold('Float', '[£ float]', `${moneyInput('eod-float', 'Leave this much in the drawer each night', '[£ float]')}${note('Close the day works out the rest to bank, so every day starts with the same float.')}`)
  + fold('Close the day', 'After [closing time]', `${moneyInput('eod-time', 'Show “Close the day” in the till bar after', '[time]')}${note('Owners and managers see it on every till after this time. Nobody else does.')}`)
  + fold('Counting the cash', 'Blind', `${choice('While counting', [['Count first, then see the difference', true], ['Show the expected amount', false]])}${note('Counting first means staff can’t just match the number they see, so the difference is a real one.')}`);
def('set-eod', () => settingsPage('eod', 'End of day', EOD_INTRO, eodFolds()));

// ---------- Payments (journey 11 decisions 6, 8, 15) ----------
const PAY_INTRO = 'How customers can pay. Changes save as you make them.';
// A way to pay, switched on or off with a toggle pill (Workshop day 50); an
// "on" way can show its one setting underneath.
const way = (name, sub, on, extra = '') => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${on === null ? '' : offer(on ? 'On' : 'Off', on)}</div>${extra}</div>`;
const limitInput = `<div style="display: flex; align-items: center; gap: 10px"><label for="pay-limit" style="font-size: 14px; flex-grow: 1">Most a customer can owe</label><input id="pay-limit" value="[£ limit]" style="width: 120px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></div><span style="font-size: 13px; color: ${C.muted}">For everyone. Change it for one customer on their page.</span>`;
const payWays = () => `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start">${way('Cash', 'Always on', null)}${way('Card', 'Through the card machine', true)}
${way('Gift cards', 'Sell, top up and spend', true)}${way('Store credit', 'Given on refunds without a receipt', true)}
${way('Customer accounts', 'Pay later, settled from the customer’s page', true, limitInput)}${way('Loyalty points', 'Earn and spend', false)}
${way('Deposits', 'Part now, the rest later, on workshop jobs', true)}</div>`;
const otherRow = (t, sub) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 6px 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${t}</span><span style="font-size: 12px; color: ${C.muted}">${sub}</span></span><button type="button" aria-label="Remove ${esc(t)}" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; display: inline-flex; align-items: center; justify-content: center">${icon('close', 16)}</button></div>`;
const payOther = () => `<div style="display: flex; flex-direction: column; gap: 8px">${otherRow('Finance', 'Recorded at the till; the finance company pays the shop')}${otherRow('Cycle to Work', 'Recorded at the till; the scheme pays the shop')}${otherRow('Payment link', 'Needs setting up with [payment provider] first')}</div>
<div style="display: flex; gap: 8px"><input aria-label="New way to pay" placeholder="Add another way to pay" style="flex-grow: 1; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${button('Add', { variant: 'default' })}</div>
${note('These sit under “Other” at the bottom of Take payment, one tap away.')}`;
// Card machine: the provider is still an open question (journey 11
// decision 6), so it is a bracketed placeholder.
const payCard = () => `${kv('Till B1', `<span style="display: inline-flex; align-items: center; gap: 6px; color: ${C.successInk}">${icon('check', 16)}[Card machine] connected</span>`)}
<div style="display: flex; gap: 8px; padding-top: 4px">${button('Connect a card machine', { variant: 'default' })}</div>
${note('The till sends the amount to the machine, so nobody keys it in twice. Each till has its own machine.')}`;
const payFolds = (open = {}) =>
  fold('Card machine', '[Card machine] · Till B1', open.card || '')
  + fold('Ways to pay', 'Cash, card and 4 more', open.ways || '')
  + fold('Other ways to pay', 'Finance, Cycle to Work, payment link', open.other || '');
def('set-pay-ways', () => settingsPage('payments', 'Payments', PAY_INTRO, payFolds({ ways: payWays() })));
def('set-pay-other', () => settingsPage('payments', 'Payments', PAY_INTRO, payFolds({ other: payOther() })));
def('set-pay-card', () => settingsPage('payments', 'Payments', PAY_INTRO, payFolds({ card: payCard() })));

// ---------- Staff and roles (decisions 8–10; signing in 6–7) ----------
// Seen by Jack Lewis (Manager). Only the Owner adds or removes people.
const STAFF_INTRO = 'Who works here, and what each person can do. Changes save as you make them.';
const SWITCHES = ['Can use the till', 'Can see reports', 'Can close the day', 'Can order stock', 'Can edit the website', 'Can change settings'];
const personRow = (name, role, extras, { you = false, hover = false } = {}) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 8px 0 12px; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 999px; background: ${C.mutedBg}; font-size: 13px; font-weight: 700; flex-shrink: 0">${name.split(' ').map((x) => x[0]).join('')}</span>
<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${esc(name)}${you ? `<span style="font-weight: 400; color: ${C.muted}"> · you</span>` : ''}</span><span style="font-size: 13px; color: ${C.muted}">${esc(role)}${extras ? ` · ${esc(extras)}` : ''}</span></span>
${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Open</button>` : `<span style="display: inline-flex; color: ${C.muted}; padding: 0 12px; transform: rotate(-90deg)">${icon('chevron', 16)}</span>`}</div>`;
const peopleOpen = (hover = true) => `<div style="display: flex; flex-direction: column; gap: 8px">${personRow('Jack Lewis', 'Manager', '', { you: true })}${personRow('Jo Taylor', 'Staff', '', { hover })}${personRow('Alex Morgan', 'Mechanic', 'can use the till')}</div>
${note('Only the owner can add or remove people. Everyone sets their own till PIN in Your settings.')}`;
const roleLine = (r, d) => `<div style="display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid ${C.border}"><span style="width: 110px; flex-shrink: 0; font-size: 15px; font-weight: 700">${r}</span><span style="font-size: 15px; line-height: 1.5">${d}</span></div>`;
const rolesOpen = () => `${roleLine('Owner', 'Everything, including adding and removing people and tills.')}${roleLine('Manager', 'Everything except adding and removing people and tills.')}${roleLine('Staff', 'The till, customers, messages, stock and the workshop diary.')}${roleLine('Mechanic', 'The workshop diary and jobs.')}
${note('Switches on a person add to their role — up to everything a Manager can do.')}`;
const staffFolds = (open = {}) => fold('People', 'Jack Lewis, Jo Taylor, Alex Morgan', open.people || '') + fold('What each role can do', 'Owner, Manager, Staff, Mechanic', open.roles || '');

// One person, in a pop-up in the middle (Workshop day 15, 16). The role by
// pill; the switches as toggle pills; the PIN line (signing in 6).
function personDialog({ all = false } = {}) {
  // Staff already have the till by their role, so that one says Included.
  const inc = (s) => s === 'Can use the till';
  const sw = (s) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 6px 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><span style="font-size: 14px; font-weight: 600; flex-grow: 1">${s}</span>${inc(s) ? `<span style="font-size: 13px; color: ${C.muted}; padding-right: 8px">Included</span>` : offer(all ? 'On' : 'Off', all)}</div>`;
  return popup('p-title', 'Jo Taylor', 'Staff · [email]', `
${choice('Role', [['Manager', false], ['Staff', true], ['Mechanic', false]])}
<div style="display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="font-size: 15px; font-weight: 600">Also allowed to</span>${all ? `<span style="font-size: 13px; color: ${C.muted}">Everything a Manager can do</span>` : button('Give everything a Manager can do', { variant: 'default' })}</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">${SWITCHES.map(sw).join('')}</div>
${all ? note('Jo can now do everything a Manager can. Jo’s role still says Staff.') : ''}</div>
<div style="display: flex; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Till PIN</span><span style="font-size: 13px; color: ${C.muted}">Set · only Jo knows it</span></span>${button('Clear a forgotten PIN', { variant: 'default' })}</div>`, `<span></span>${button('Done')}`);
}
const clearPinDialog = () => popup('pin-title', 'Clear Jo Taylor’s till PIN?', 'For when Jo has forgotten it', `${note('Jo won’t be able to check in at the till until they get a new PIN in Your settings. Nobody else sees the new one.')}`, `${button('Keep the PIN', { variant: 'ghost' })}${button('Clear the PIN')}`);

const staffPage = (open) => settingsPage('staff', 'Staff and roles', STAFF_INTRO, staffFolds(open));
def('set-staff', () => staffPage({ people: peopleOpen() }));
def('set-staff-person', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog()));
def('set-staff-person-all', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog({ all: true })));
def('set-staff-clear-pin', () => overlay(staffPage({ people: peopleOpen(false) }), clearPinDialog()));
def('set-staff-roles', () => staffPage({ roles: rolesOpen() }));

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
Object.assign(TITLES, {
  'set-till-quick': 'Till › Quick buttons — hover a button to edit or remove it',
  'set-till-quick-add': 'Add a quick button',
  'set-till-quick-saved': 'Saved as you go, with Undo',
  'set-till-reasons': 'Till › Reasons — a list for each kind',
  'set-till-receipts': 'Till › Receipts',
  'set-till-printer': 'Till › Printer and cash drawer',
  'set-till-tills': 'Till › Tills',
  'set-eod': 'End of day — float, when Close the day appears, blind counting',
  'set-pay-ways': 'Payments › Ways to pay — each on or off',
  'set-pay-other': 'Payments › Other ways to pay',
  'set-pay-card': 'Payments › Card machine',
  'set-staff': 'Staff and roles › People',
  'set-staff-person': 'One person — role, switches, till PIN',
  'set-staff-person-all': 'Give everything a Manager can do',
  'set-staff-clear-pin': 'Clear a forgotten PIN',
  'set-staff-roles': 'Staff and roles › What each role can do',
});
export const ROWS = [
  { label: 'Till settings', screens: ['set-till-quick', 'set-till-quick-add', 'set-till-quick-saved', 'set-till-reasons', 'set-till-receipts', 'set-till-printer', 'set-till-tills'] },
  { label: 'End of day and payment settings', screens: ['set-eod', 'set-pay-ways', 'set-pay-other', 'set-pay-card'] },
  { label: 'Staff and roles', screens: ['set-staff', 'set-staff-person', 'set-staff-person-all', 'set-staff-clear-pin', 'set-staff-roles'] },
  { label: 'Options — the shape of Settings (decision 3: option 1)', screens: ['so-list', 'so-onepage', 'so-hub', 'so-hub-area'] },
];
