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
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { AREAS, fold, pill, offer, choice, note, shell, page, settingsPage, settingsList, popup, overlay, setSize, size, isPhone, workshopFolds, WORKSHOP_INTRO } from './settings-frame.mjs';
import { screens as diaryScreens } from './diary.mjs';

export const screens = {};
// The shop's owner — no owner name exists in the example data (decision 16).
const OWNER = { role: 'O', person: 'Shop owner', roleName: 'Owner' };
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;


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
const TILL_INTRO = 'What staff see and use at the till.';
const tillFolds = (open = {}) =>
  fold('Quick buttons', 'Workshop, Parts, Accessories', open.quick || '')
  + fold('Reasons', 'Discount, void, refund, paid-out', open.reasons || '')
  + fold('Receipts', 'Print, email or text', open.receipts || '')
  + fold('Printer and cash drawer', '[Receipt printer]', open.printer || '')
  + fold('Tills', 'Till B1', open.tills || '');

// Quick buttons: groups as pills, the group's buttons in till order. Hover a
// button to reveal Edit and Remove (right-click / long-press kept, Workshop
// day 65); drag the handle to reorder.
const qbRow = (name, sub, price, hv = false, hover = hv && !isPhone()) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 8px 0 12px; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}"><button type="button" aria-label="Move ${esc(name)} — drag, or use the arrow keys" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; font-size: 16px">⋮⋮</button><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${esc(name)}</span><span style="font-size: 12px; color: ${C.muted}">${esc(sub)}</span></span>${mono(price, 'font-size: 15px')}${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Edit</button>${button('Remove', { variant: 'danger' })}` : ''}</div>`;
const quickOpen = (hover = true, added = false) => `<div role="group" aria-label="Quick button groups" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Workshop', true)}${pill('Parts')}${pill('Accessories')}${pill('+ Add a group')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${qbRow('Standard service', 'Labour · 60 min', '£65.00')}${qbRow('Fit & adjust brakes', 'Labour · 30 min', '£18.00', hover)}${qbRow('Replace gear cable', 'Labour', '£12.00')}${added ? qbRow('Shimano brake pads B05S-RX', 'Part', '£28.00') : ''}</div>
<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px">${button('+ Add a button', { variant: 'default' })}${note('Buttons show on the till in this order.')}</div>`;

// Add a quick button: find the product or service, pick its group. The
// button's name and price come from the product; the name can be shortened.
const addButtonDialog = () => popup('qb-title', 'Add a quick button', 'To the Workshop group', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input aria-label="Find a product or service" value="brake pads" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 12px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.mutedBg}"><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Shimano brake pads B05S-RX</span><span style="font-size: 12px; color: ${C.muted}">Part</span></span>${mono('£28.00', 'font-size: 15px')}${icon('check', 18)}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="qb-name" style="font-size: 14px; font-weight: 600">Name on the button</label><input id="qb-name" value="Shimano brake pads B05S-RX" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">The price always comes from the product.</span></div>
<div role="group" aria-label="Group" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Group</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Workshop', true)}${pill('Parts')}${pill('Accessories')}</div></div>`, `${button('Cancel', { variant: 'ghost' })}${button('Add the button')}`);

// Reasons: one list per kind, picked by pill. "Other…" is always offered at
// the till (journey 11's pop-ups), so staff can type their own.
const reasonRow = (t) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 6px 0 10px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><button type="button" aria-label="Move — drag, or use the arrow keys" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; font-size: 16px">⋮⋮</button><span style="font-size: 15px; flex-grow: 1">${t}</span><button type="button" aria-label="Remove this reason" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; display: inline-flex; align-items: center; justify-content: center">${icon('close', 16)}</button></div>`;
const reasonsOpen = () => `<div role="group" aria-label="Which reasons" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Discount', true)}${pill('Void')}${pill('Refund')}${pill('Paid-out')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${reasonRow('[Shop’s reason]')}${reasonRow('[Shop’s reason]')}${reasonRow('[Shop’s reason]')}</div>
<div style="display: flex; gap: 8px"><input aria-label="New discount reason" placeholder="Add a discount reason" style="flex-grow: 1; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${button('Add', { variant: 'default' })}</div>
${note('The till always offers “Other…” as well, so staff can type a reason that isn’t on the list. Every reason shows in the reports.')}`;

// Receipts: which choices the Paid pop-up offers (journey 11 decision 7),
// the words at the bottom, and a preview. The barcode is always printed
// (journey 11 decision 13), so it isn't a setting.
const receiptPreview = () => `<div aria-label="Receipt preview" style="width: 230px; flex-shrink: 0; box-sizing: border-box; padding: 16px 14px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 4px; font-family: ${MONO}; font-size: 11px; line-height: 1.5; color: ${C.ink}; display: flex; flex-direction: column; gap: 6px">
<div style="text-align: center; font-weight: 700; font-size: 12px">North Street Cycles</div><div style="text-align: center">Bolton · Till B1</div>
<div style="border-top: 1px dashed ${C.border}; padding-top: 6px; display: flex; justify-content: space-between"><span>Standard service</span><span>£65.00</span></div>
<div style="display: flex; justify-content: space-between; font-weight: 700"><span>Total</span><span>£65.00</span></div><div style="display: flex; justify-content: space-between"><span>incl. VAT</span><span>£10.83</span></div>
<div style="border-top: 1px dashed ${C.border}; padding-top: 6px; text-align: center; color: ${C.muted}">[Your words at the bottom]</div>
<div aria-hidden="true" style="height: 30px; margin-top: 4px; background: repeating-linear-gradient(90deg, ${C.ink} 0 2px, #ffffff 2px 4px, ${C.ink} 4px 5px, #ffffff 5px 8px)"></div><div style="text-align: center">B1-[0000]</div></div>`;
const receiptsOpen = () => `<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 24px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}"><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px">
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
const tillsOpen = (owner = false) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">Till B1</span><span style="font-size: 13px; color: ${C.muted}">Bolton · registered [date] by [name]</span></span><button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Rename</button>${owner ? button('Remove', { variant: 'danger' }) : ''}</div>
${owner ? `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding-top: 4px">${note('Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.')}${button('Make this computer a till', { variant: 'default' })}</div>` : note('Only the owner can add or remove tills.')}`;
// Decision 17 (H1): removing a till asks first.
const removeTillDialog = () => popup('rm-title', 'Remove Till B1?', 'Bolton', `${note('This computer stops working as a till. Sales already taken stay in the reports.')}`, `${button('Keep the till', { variant: 'ghost' })}${button('Remove the till', { variant: 'danger' })}`);
// Decision 17 (H3): a new shop's empty list. Other lists follow the same
// rule — say what goes there and offer the one button that adds it.
const quickEmpty = () => `<div role="group" aria-label="Quick button groups" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('+ Add a group')}</div>
<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 16px; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center"><span style="font-size: 16px; font-weight: 700">No quick buttons yet</span>${note('Add the things you sell most — they’ll show on the till, one tap each.')}${button('+ Add a button')}</div>`;

def('set-till-quick', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen() })));
def('set-till-quick-add', () => overlay(settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen(false) })), addButtonDialog()));
def('set-till-quick-saved', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickOpen(false, true) }), { toast: 'Saved · Shimano brake pads added to Workshop' }));
def('set-till-reasons', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ reasons: reasonsOpen() })));
def('set-till-receipts', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ receipts: receiptsOpen() })));
def('set-till-printer', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ printer: printerOpen() })));
def('set-till-tills', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsOpen() })));
def('set-till-tills-owner', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsOpen(true) }), { who: OWNER }));
def('set-till-remove', () => overlay(settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsOpen(true) }), { who: OWNER }), removeTillDialog()));
def('set-till-empty', () => settingsPage('till', 'Till', TILL_INTRO, tillFolds({ quick: quickEmpty() }).replace('Workshop, Parts, Accessories', 'None yet'), { who: OWNER }));

// ---------- End of day (cash-up decisions 2, 4, 5; decision 6: blind on) ----------
const EOD_INTRO = 'How the till closes each day.';
const moneyInput = (id, label, value) => `<div style="display: flex; align-items: center; gap: 10px"><label for="${id}" style="font-size: 15px; font-weight: 600; flex-grow: 1">${label}</label><input id="${id}" value="${value}" style="width: 140px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></div>`;
const eodFolds = (open = {}) =>
  fold('Float', '[£ float]', open.float || '')
  + fold('Close the day', '1 hour before closing', open.close || '')
  + fold('Counting the cash', 'Count first', open.count || '');
const floatOpen = () => `${moneyInput('eod-float', 'Leave this much in the drawer each night', '[£ float]')}${note('Close the day works out the rest to bank, so every day starts with the same float.')}`;
// Decision 17: Close the day follows the site's closing time — no time of its own.
// Decision 18: it can appear before closing time, so cashing up can start
// while the last customers are served.
const closeOpen = () => `${choice('Show “Close the day” in the till bar', [['At closing time', false], ['30 minutes before', false], ['1 hour before', true]])}${note('Owners and managers see it on every till from then on. Closing time comes from the opening hours.')}<div>${button('Change opening hours', { variant: 'default' })}</div>`;
def('set-eod', () => settingsPage('eod', 'End of day', EOD_INTRO, eodFolds({ float: floatOpen() })));
def('set-eod-close', () => settingsPage('eod', 'End of day', EOD_INTRO, eodFolds({ close: closeOpen() })));
// Decision 17 (H4): a change that can't be saved says so, and keeps it.
def('set-save-failed', () => settingsPage('eod', 'End of day', EOD_INTRO, eodFolds({ float: floatOpen() }), { toast: { fail: true, text: 'Not saved — no internet connection. Your change is kept here.' } }));

// ---------- Payments (journey 11 decisions 6, 8, 15) ----------
const PAY_INTRO = 'How customers can pay.';
// A way to pay, switched on or off with a toggle pill (Workshop day 50); an
// "on" way can show its one setting underneath.
const way = (name, sub, on, extra = '') => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${on === null ? '' : offer(on ? 'On' : 'Off', on)}</div>${extra}</div>`;
const limitInput = `<div style="display: flex; align-items: center; gap: 10px"><label for="pay-limit" style="font-size: 14px; flex-grow: 1">Most a customer can owe</label><input id="pay-limit" value="[£ limit]" style="width: 120px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></div><span style="font-size: 13px; color: ${C.muted}">For everyone. Change it for one customer on their page.</span>`;
const payWays = () => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 8px; align-items: start">${way('Cash', 'Always on', null)}${way('Card', 'Through the card machine', true)}
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
const STAFF_INTRO = 'Who works here, and what each person can do.';
const SWITCHES = ['Can use the till', 'Can see reports', 'Can close the day', 'Can order stock', 'Can edit the website', 'Can change settings'];
const personRow = (name, role, extras, { you = false, hover: hv = false } = {}, hover = hv && !isPhone()) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 8px 0 12px; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 999px; background: ${C.mutedBg}; font-size: 13px; font-weight: 700; flex-shrink: 0">${name.split(' ').map((x) => x[0]).join('')}</span>
<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${esc(name)}${you ? `<span style="font-weight: 400; color: ${C.muted}"> · you</span>` : ''}</span><span style="font-size: 13px; color: ${C.muted}">${esc(role)}${extras ? ` · ${esc(extras)}` : ''}</span></span>
${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Open</button>` : `<span style="display: inline-flex; color: ${C.muted}; padding: 0 12px; transform: rotate(-90deg)">${icon('chevron', 16)}</span>`}</div>`;
const peopleOpen = (hover = true, owner = false) => `<div style="display: flex; flex-direction: column; gap: 8px">${personRow('Jack Lewis', 'Manager', '', { you: !owner })}${personRow('Jo Taylor', 'Staff', 'works in the workshop', { hover })}${personRow('Alex Morgan', 'Mechanic', 'can use the till')}</div>
${owner ? `<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px">${button('+ Invite someone', { variant: 'default' })}${note('Everyone sets their own till PIN in Your settings.')}</div>` : note('Only the owner can add or remove people. Everyone sets their own till PIN in Your settings.')}`;
const roleLine = (r, d) => `<div style="display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid ${C.border}"><span style="width: 110px; flex-shrink: 0; font-size: 15px; font-weight: 700">${r}</span><span style="font-size: 15px; line-height: 1.5">${d}</span></div>`;
const rolesOpen = () => `${roleLine('Owner', 'Everything, including adding and removing people and tills.')}${roleLine('Manager', 'Everything except adding and removing people and tills.')}${roleLine('Staff', 'The till, customers, messages, stock and the workshop diary.')}${roleLine('Mechanic', 'The workshop diary and jobs.')}
${note('Switches on a person add to their role — up to everything a Manager can do.')}`;
const staffFolds = (open = {}) => fold('People', 'Jack Lewis, Jo Taylor, Alex Morgan', open.people || '') + fold('What each role can do', 'Owner, Manager, Staff, Mechanic', open.roles || '');

// Decision 11: "Works in the workshop" gives a diary column; turning it on
// shows whether customers can book this person online.
const toggleLine = (t, sub, on, indent = false) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; ${indent ? `margin-left: ${isPhone() ? 0 : 18}px; padding-left: ${isPhone() ? 0 : 14}px; border-left: ${isPhone() ? 0 : 1}px solid ${C.border}` : ''}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${t}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${offer(on ? 'On' : 'Off', on)}</div>`;
// Decision 13: each workshop person's working days, as toggle pills.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayPill = (d, on) => `<button type="button" aria-pressed="${on}" aria-label="${d}" style="min-width: 44px; min-height: 44px; padding: 0 6px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600">${d}</button>`;
const workingDays = () => `<div role="group" aria-label="Works in the workshop on" style="display: flex; flex-direction: column; gap: 8px; margin-left: ${isPhone() ? 0 : 18}px; padding-left: ${isPhone() ? 0 : 14}px; border-left: ${isPhone() ? 0 : 1}px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">In the workshop on</span><div style="display: flex; flex-wrap: nowrap; gap: 4px">${DAYS.map((d) => dayPill(d, ['Tue', 'Wed', 'Sat'].includes(d))).join('')}</div></div>`;
const workshopBlock = (on) => `<div style="display: flex; flex-direction: column; gap: 6px">${toggleLine('Works in the workshop', 'Gets a column in the diary', on)}${on ? `${toggleLine('Customers can book Jo online', 'Off: staff can still book jobs in for Jo', false, true)}${workingDays()}` : ''}</div>`;
// One person, in a pop-up in the middle (Workshop day 15, 16). The role by
// pill; the switches as toggle pills; the PIN line (signing in 6).
function personDialog({ all = false, workshop = true } = {}) {
  // Staff already have the till by their role, so that one says Included.
  const inc = (s) => s === 'Can use the till';
  const sw = (s) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 6px 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><span style="font-size: 14px; font-weight: 600; flex-grow: 1">${s}</span>${inc(s) ? `<span style="font-size: 13px; color: ${C.muted}; padding-right: 8px">Included</span>` : offer(all ? 'On' : 'Off', all)}</div>`;
  // Jack (30 Sep): the role runs across the top; both columns start together
// underneath it.
  return popup('p-title', 'Jo Taylor', 'Staff · [email]', `${choice('Role', [['Manager', false], ['Staff', true], ['Mechanic', false]])}
<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: ${isPhone() ? 20 : 28}px; align-items: start; padding-top: 16px; border-top: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 8px"><div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 600">Also allowed to</span>${all ? `<span style="font-size: 13px; color: ${C.muted}">Everything a Manager can do — Jo’s role still says Staff</span>` : button('Give everything a Manager can do', { variant: 'default', block: true })}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${SWITCHES.map(sw).join('')}</div>
</div>
</div><div style="display: flex; flex-direction: column; gap: 16px">${workshopBlock(workshop)}
<div style="display: flex; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Till PIN</span><span style="font-size: 13px; color: ${C.muted}">Set · only Jo knows it</span></span>${button('Clear a forgotten PIN', { variant: 'default' })}</div></div></div>`, `<span></span>${button('Done')}`, 860);
}
const clearPinDialog = () => popup('pin-title', 'Clear Jo Taylor’s till PIN?', 'For when Jo has forgotten it', `${note('Jo won’t be able to check in at the till until they get a new PIN in Your settings. Nobody else sees the new one.')}`, `${button('Keep the PIN', { variant: 'ghost' })}${button('Clear the PIN', { variant: 'danger' })}`);

const staffPage = (open) => settingsPage('staff', 'Staff and roles', STAFF_INTRO, staffFolds(open));
def('set-staff', () => staffPage({ people: peopleOpen() }));
def('set-staff-person', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog()));
def('set-staff-person-all', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog({ all: true })));
def('set-staff-clear-pin', () => overlay(staffPage({ people: peopleOpen(false) }), clearPinDialog()));
def('set-staff-roles', () => staffPage({ roles: rolesOpen() }));
// Decision 17 (H2): the owner invites people by email (a WorkOS invitation,
// auth spec l.537); they choose their own till PIN once they're in.
const inviteDialog = () => popup('inv-title', 'Invite someone', 'They get an email to sign in', `
${field('Email', { placeholder: 'name@example.com', type: 'email' })}
${choice('Role', [['Manager', false], ['Staff', true], ['Mechanic', false]])}
${toggleLine('Works in the workshop', 'Gets a column in the diary', false)}
${note('You can add switches once they’ve joined. They choose their own till PIN.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Send the invite')}`);
def('set-staff-invite', () => overlay(settingsPage('staff', 'Staff and roles', STAFF_INTRO, staffFolds({ people: peopleOpen(false, true) }), { who: OWNER }), inviteDialog()));

// ---------- Shop and sites (decision 13) ----------
const SHOP_INTRO = 'The shop’s details, its sites and their opening hours.';
const inputRow = (id, label, value) => `<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'stretch' : 'center'}; gap: ${isPhone() ? 6 : 12}px; min-height: 52px; padding: ${isPhone() ? '8px 0' : '0'}; border-top: 1px solid ${C.border}"><label for="${id}" style="width: ${isPhone() ? 'auto' : '160px'}; flex-shrink: 0; font-size: 15px; font-weight: 600">${label}</label><input id="${id}" value="${esc(value)}" style="flex-grow: 1; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>`;
const detailsOpen = () => `${inputRow('shop-name', 'Shop name', 'North Street Cycles')}${inputRow('shop-address', 'Address', '[address]')}${inputRow('shop-phone', 'Phone', '[phone number]')}${inputRow('shop-email', 'Email', '[email address]')}${inputRow('shop-vat', 'VAT number', '[VAT number]')}
${note('These show on receipts, emails and the website.')}`;
const timeBox = (label, v) => `<input aria-label="${label}" value="${v}" style="width: 96px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">`;
const hoursRow = (d, open) => isPhone()
  ? `<div style="display: flex; flex-direction: column; gap: 8px; padding: 8px 0; border-top: 1px solid ${C.border}"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="font-size: 15px; font-weight: 600">${d}</span>${offer(open ? 'Open' : 'Closed', open)}</div>${open ? `<div style="display: flex; align-items: center; gap: 8px">${timeBox(`${d} opens`, '[opens]')}<span style="color: ${C.muted}">to</span>${timeBox(`${d} closes`, '[closes]')}</div>` : ''}</div>`
  : `<div style="display: flex; align-items: center; gap: 12px; min-height: 50px; border-top: 1px solid ${C.border}"><span style="width: 60px; font-size: 15px; font-weight: 600">${d}</span>${open ? `${timeBox(`${d} opens`, '[opens]')}<span style="color: ${C.muted}">to</span>${timeBox(`${d} closes`, '[closes]')}` : ''}<span style="flex-grow: 1"></span>${offer(open ? 'Open' : 'Closed', open)}</div>`;
const hoursOpen = () => `${DAYS.map((d) => hoursRow(d, d !== 'Sun')).join('')}
${note('Close the day appears in time for closing, as set in End of day. Online booking only offers mechanics on the days they’re in, set on each person.')}`;
const shopFolds = (open = {}) =>
  fold('Shop details', 'North Street Cycles', open.details || '')
  + fold('Opening hours · Bolton', 'Closed Sundays', open.hours || '')
  + fold('Sites', 'Bolton', open.sites || '');
const shopPage = (open) => settingsPage('shop', 'Shop and sites', SHOP_INTRO, shopFolds(open));
def('set-shop-details', () => shopPage({ details: detailsOpen() }));
def('set-shop-hours', () => shopPage({ hours: hoursOpen() }));

// ---------- Workshop (decisions 11, 12; Workshop day 62, 66) ----------
// Services by group (Workshop day 66: shops group their own services) —
// names and times from the diary's services; only Standard service has a
// real price, the rest are placeholders.
const serviceRow = (name, mins, price, hv = false, hover = hv && !isPhone()) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 8px 0 12px; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}"><button type="button" aria-label="Move ${esc(name)} — drag, or use the arrow keys" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}; font-size: 16px">⋮⋮</button><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${esc(name)}</span><span style="font-size: 12px; color: ${C.muted}">${mins} min in the diary</span></span>${mono(price, 'font-size: 15px')}${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Edit</button>${button('Remove', { variant: 'danger' })}` : ''}</div>`;
const servicesOpen = () => `<div role="group" aria-label="Service groups" style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Full service')}${pill('Individual service', true)}${pill('+ Add a group')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${serviceRow('Safety check', 60, '[£ price]')}${serviceRow('Gear adjustment', 60, '[£ price]', true)}${serviceRow('Brake service', 45, '[£ price]')}</div>
<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px">${button('+ Add a service', { variant: 'default' })}${note('Groups and services show as pills, in this order, when a job is booked.')}</div>`;
// Mechanics: everyone with "Works in the workshop" on (decision 11), set in
// Staff and roles — listed here so it can be found from either place.
const mechRow = (name, role, online) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${role}</span></span><span style="font-size: 14px; color: ${online ? C.ink : C.muted}">${online ? 'Customers can book online' : 'Booked in by staff only'}</span></div>`;
// Decision 19: the Shared queue (Workshop day 32, 62) — jobs for whoever's
// free — sits beside the people, with a name the shop can change.
const queueRow = () => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1"><label for="queue-name" style="font-size: 13px; color: ${C.muted}">Jobs for whoever’s free — called</label><input id="queue-name" value="Shared queue" style="width: 260px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; font-weight: 700; color: ${C.ink}"></span></div>
${toggleLine('Customers can book it online', 'Off: only staff put jobs in it', true)}
${toggleLine('Show it as a column in the diary', 'Off: its jobs show in the diary’s row for bikes with no set time', false)}</div>`;
const mechanicsOpen = () => `${mechRow('Alex Morgan', 'Mechanic', true)}${mechRow('Jo Taylor', 'Staff', false)}${queueRow()}
<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding-top: 4px">${note('Everyone with “Works in the workshop” switched on gets a column in the diary.')}${button('Change in Staff and roles', { variant: 'default' })}</div>`;
const workshopPage = (open) => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds(open));
def('set-workshop-services', () => workshopPage({ services: servicesOpen() }));
def('set-workshop-mechanics', () => workshopPage({ mechanics: mechanicsOpen() }));
def('set-workshop-diary', () => diaryScreens['diary-settings'][size()]);

// ---------- Messages (decision 14) ----------
// The automatic messages are the ones journeys 2–4 already send (booking
// confirmed, quote to approve, bike ready, order ready to collect). The
// wording shown is a starting draft for Jack to approve, not settled copy.
const MSG_INTRO = 'The texts and emails customers get from the shop.';
const chan = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.mutedBg : 'transparent'}; color: ${on ? C.ink : C.muted}; font-family: inherit; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px">${on ? icon('check', 14) : ''}${t}</button>`;
const msgRow = (name, when, text, email, hv = false, hover = hv && !isPhone()) => `<div style="display: flex; flex-wrap: ${isPhone() ? 'wrap' : 'nowrap'}; align-items: center; gap: 10px; min-height: 60px; padding: ${isPhone() ? '10px 10px 10px 14px' : '0 8px 0 14px'}; border: 1px solid ${hover ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0; flex-basis: ${isPhone() ? '100%' : 'auto'}"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${when}</span></span>${hover ? `<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Edit wording</button>` : ''}${chan('Text', text)}${chan('Email', email)}${offer('On', true)}</div>`;
const msgListOpen = () => `<div style="display: flex; flex-direction: column; gap: 8px">
${msgRow('Booking confirmed', 'When a repair is booked', false, true)}
${msgRow('Quote to approve', 'When a job needs the customer’s OK', true, true)}
${msgRow('Bike ready', 'When a job is finished', true, false, true)}
${msgRow('Order ready to collect', 'When an online order is ready', false, true)}</div>
<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px">${button('+ Add your own message', { variant: 'default' })}${note('Tap Text or Email to choose how each is sent — or both.')}</div>`;
const msgFolds = (open = {}) =>
  fold('Automatic messages', '4 on', open.list || '')
  + fold('How messages are sent', 'Texts from [sender name] · emails from [email address]', open.sending || '');
const msgPage = (open) => settingsPage('messages', 'Messages', MSG_INTRO, msgFolds(open));
const chip = (t) => `<button type="button" style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px dashed ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; font-weight: 600; color: ${C.ink}">+ ${t}</button>`;
const wordingBox = (id, value, rows = 4) => `<div style="display: flex; flex-direction: column; gap: 8px"><label for="${id}" style="font-size: 15px; font-weight: 600">Wording</label><textarea id="${id}" rows="${rows}" style="box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; line-height: 1.5; color: ${C.ink}; resize: none">${value}</textarea><div role="group" aria-label="Put in" style="display: flex; flex-wrap: wrap; gap: 6px">${chip('Customer’s first name')}${chip('Bike')}${chip('Job number')}${chip('Amount to pay')}${chip('Link to the job')}${chip('Shop name')}${chip('Opening hours')}</div></div>`;
const bubble = (t) => `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">PREVIEW · TEXT TO MAYA PATEL</span><div style="align-self: flex-start; max-width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: ${C.mutedBg}; font-size: 14px; line-height: 1.5">${t}</div></div>`;
const editMsgDialog = () => popup('msg-title', 'Bike ready', 'Sent when a job is finished', `
<div role="group" aria-label="Send by" style="display: flex; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 600; flex-grow: 1">Send by</span>${chan('Text', true)}${chan('Email', false)}</div>
${wordingBox('msg-words', 'Hi [Customer’s first name], your [Bike] is ready to collect from [Shop name]. [Amount to pay] to pay on collection. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].')}
${bubble('Hi Maya, your Trek Domane AL 3 is ready to collect from North Street Cycles. £111.00 to pay on collection. See what we did: [link]. Job WH-1042. We’re open [opening hours].')}`, `${button('Go back to Wheelhouse’s wording', { variant: 'ghost' })}${button('Done')}`, 620);
// Decision 14: the shop's own automatic messages, with a "send when…".
// Marketing only reaches customers who allow it (journey 7, acct-unsubscribe).
const newMsgDialog = () => popup('new-msg-title', 'Your own message', 'Sent automatically', `
${field('Name', { placeholder: 'e.g. Service reminder' })}
${choice('Send it', [['After a job is collected', true], ['Before a booked job', false], ['After a sale', false]])}
<div style="display: flex; align-items: center; gap: 10px"><label for="msg-after" style="font-size: 15px; font-weight: 600; flex-grow: 1">How long after</label><input id="msg-after" value="[n]" style="width: 72px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${pill('Days')}${pill('Months', true)}</div>
<div role="group" aria-label="Send by" style="display: flex; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 600; flex-grow: 1">Send by</span>${chan('Text', false)}${chan('Email', true)}</div>
${wordingBox('new-msg-words', '', 2)}
${note('Only customers who’ve agreed to hear from the shop get messages like this. Job updates always go.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add the message')}`, 620);
def('set-msg-list', () => msgPage({ list: msgListOpen() }));
def('set-msg-edit', () => overlay(msgPage({ list: msgListOpen() }), editMsgDialog()));
def('set-msg-new', () => overlay(msgPage({ list: msgListOpen() }), newMsgDialog()));

// ---------- Your data (Release 2 rule 5: everything can be exported;
// decision 4: every settings change is recorded) ----------
const DATA_INTRO = 'Take a copy of everything, and see who changed what in Settings.';
const exportOpen = () => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 8px">${['Customers', 'Sales and refunds', 'Stock', 'Workshop jobs'].map((t) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}">${icon('check', 16)}<span style="font-size: 15px; font-weight: 600">${t}</span></div>`).join('')}</div>
<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px">${note('Spreadsheets that open in Excel or Google Sheets — yours to keep, whatever happens.')}${button('Download everything')}</div>`;
const histRow = (what, before, after) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${what}</span><span style="font-size: 13px; color: ${C.muted}">[name] · [date and time]</span></span><span style="font-size: 14px; color: ${C.muted}">${before}</span><span aria-hidden="true" style="color: ${C.muted}">→</span><span style="font-size: 14px; font-weight: 600">${after}</span></div>`;
const historyOpen = () => `${histRow('End of day › Float', '[£ before]', '[£ after]')}${histRow('Staff and roles › Jo Taylor · Works in the workshop', 'Off', 'On')}${histRow('Till › Quick buttons · Shimano brake pads B05S-RX', '—', 'Added to Workshop')}
${note('Every change made in Settings, newest first, with what it was before.')}`;
const dataFolds = (open = {}) => fold('Download everything', 'Customers, sales, stock, jobs', open.export || '') + fold('Settings changes', 'Who changed what, and when', open.history || '');
const dataPage = (open) => settingsPage('data', 'Your data', DATA_INTRO, dataFolds(open));
def('set-data-export', () => dataPage({ export: exportOpen() }));
def('set-data-history', () => dataPage({ history: historyOpen() }));

// ---------- First-run setup (decision 16): a Getting started checklist ----------
// Shown to the shop's owner at the top of Office › Today. No owner name
// exists in the example data, so the owner is labelled by role only.
const STEPS = [
  ['Shop details and opening hours', 'Shop and sites', true, 'the address and hours are in'],
  ['Make this computer a till', 'Till › Tills', true, 'a till is set up'],
  ['Connect the card machine', 'Payments', false, 'a card machine answers'],
  ['Add your staff', 'Staff and roles', false, 'someone accepts an invite'],
  ['Workshop services and prices', 'Workshop', false, 'a service has a price'],
  ['Quick buttons for the till', 'Till', false, 'the first button is added'],
  ['Float and closing up', 'End of day', false, 'a float is set'],
  ['Check the messages customers get', 'Messages', false, 'you’ve looked at Messages'],
];
const doneCount = STEPS.filter((x) => x[2]).length;
// Decision 17 (H2, M12): each step says what ticks it; finished steps fold
// into one line so the card stays short.
const stepRow = ([t, where, done, tick], i, next) => isPhone()
  // Phone: the whole row is the link; the next step has a dark outline.
  ? `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; margin-top: 6px; padding: 8px 10px; border-radius: 10px; border: 1px solid ${next ? C.ink : C.border}; text-decoration: none; color: ${C.ink}">
<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 13px; font-weight: 700">${i + 1}</span>
<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">Ticks when ${tick}</span></span>
<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`
  : `<div style="display: flex; align-items: center; gap: 14px; min-height: 56px; border-top: 1px solid ${C.border}">
<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; color: ${C.ink}; font-size: 13px; font-weight: 700">${i + 1}</span>
<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">Settings › ${where} · ticks when ${tick}</span></span>
${button(next ? 'Start' : 'Set up', { variant: next ? 'accent' : 'default' })}</div>`;
const moveLink = `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Moving from another system?</a>`;
function gettingStarted() {
  const firstTodo = STEPS.findIndex((x) => !x[2]);
  const done = STEPS.filter((x) => x[2]).map((x) => x[0]);
  return card(`<div style="padding: ${isPhone() ? '16px 14px' : '20px 22px'}; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">Getting started</h2>${isPhone() ? '' : moveLink}</div>
<div aria-hidden="true" style="height: 6px; border-radius: 999px; background: ${C.mutedBg}; overflow: hidden"><div style="width: ${Math.round((doneCount / STEPS.length) * 100)}%; height: 100%; background: ${C.ink}"></div></div>
${note('Your till is ready, so you can sell now — do the rest in any order.')}
<button type="button" aria-expanded="false" style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0; border: 0; border-top: 1px solid ${C.border}; background: transparent; font-family: inherit; text-align: left; color: ${C.muted}"><span style="display: inline-flex; width: 28px; height: 28px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 15)}</span><span style="font-size: 14px; flex-grow: 1">${doneCount} done: ${done.join(', ')}</span>${icon('chevron', 16)}</button>
<div style="display: flex; flex-direction: column">${STEPS.map((st, i) => (st[2] ? '' : stepRow(st, i, i === firstTodo))).join('')}</div>
${isPhone() ? moveLink : ''}
</div>`);
}
const todayRest = `<div style="min-height: 120px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: ${C.muted}">[The rest of Today]</div>`;
const todayPage = (top) => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-width: 900px">${top}${todayRest}</div>`, OWNER);
// A step opened from the checklist: the usual Settings section, with a strip
// saying where you are in Getting started and the way back.
// Decision 17 (M11): no "step 3 of 8" — the strip names the step, offers the
// next one (one click instead of two) and the way back.
const stepBanner = (t, nextT) => `<div style="flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="font-size: 14px; flex-grow: 1"><strong>Getting started:</strong> ${t}</span><a href="fr-today-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 10px; font-size: 14px; font-weight: 600; color: ${C.ink}">${icon('back', 16)}Checklist</a>${button(`Next: ${nextT}`, { variant: 'default' })}</div>`;
const payCardNone = () => `${kv('Till B1', `<span style="color: ${C.muted}">No card machine yet</span>`)}
<div style="display: flex; gap: 8px; padding-top: 4px">${button('Connect a card machine')}</div>
${note('The till sends the amount to the machine, so nobody keys it in twice.')}`;
const allSet = card(`<div style="padding: 18px 12px 18px 22px; display: flex; align-items: center; gap: 14px"><span style="display: inline-flex; width: 32px; height: 32px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 18)}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 16px; font-weight: 700">You’re all set up</span><span style="font-size: 14px; color: ${C.muted}">You can change any of it in Settings.</span></span><button type="button" aria-label="Close" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.ink}; display: inline-flex; align-items: center; justify-content: center">${icon('close', 18)}</button></div>`);
def('fr-today', () => todayPage(gettingStarted()));
def('fr-step', () => settingsPage('payments', 'Payments', PAY_INTRO, payFolds({ card: payCardNone() }).replace('[Card machine] · Till B1', 'Not connected'), { banner: stepBanner('Connect the card machine', 'Add your staff'), who: OWNER }));
def('fr-done', () => todayPage(allSet));

def('so-list', optionList);
def('so-onepage', optionOnePage);
def('so-hub', optionHub);
def('so-hub-area', optionHubArea);

// Decision 21: every board at desktop, tablet and phone, except the three
// layout options (desktop only) and the phone's list of Settings areas.
const DESKTOP_ONLY = new Set(['so-list', 'so-onepage', 'so-hub', 'so-hub-area']);
for (const size of ['desktop', 'tablet', 'phone']) {
  setSize(size);
  for (const [id, fn] of recipes) if (size === 'desktop' || !DESKTOP_ONLY.has(id)) (screens[id] ??= {})[size] = fn();
}
setSize('phone');
screens['set-list'] = { phone: settingsList() };
setSize('desktop');

export const TITLES = {
  'so-list': 'Option 1 — areas listed down the left, the chosen area beside them',
  'so-onepage': 'Option 2 — one long page, every area a folding section',
  'so-hub': 'Option 3 — a page of area cards…',
  'so-hub-area': 'Option 3 — …each opening its own page',
};
Object.assign(TITLES, {
  'set-list': 'Settings on a phone — the list of areas',
  'set-till-quick': 'Till › Quick buttons — hover a button to edit or remove it',
  'set-till-quick-add': 'Add a quick button',
  'set-till-quick-saved': 'Saved as you go, with Undo',
  'set-till-reasons': 'Till › Reasons — a list for each kind',
  'set-till-receipts': 'Till › Receipts',
  'set-till-printer': 'Till › Printer and cash drawer',
  'set-till-tills': 'Till › Tills — as a Manager sees it',
  'set-till-tills-owner': 'Till › Tills — as the owner sees it',
  'set-till-remove': 'Removing a till asks first',
  'set-till-empty': 'A new shop — no quick buttons yet',
  'set-eod': 'End of day — float',
  'set-eod-close': 'End of day — Close the day at, or before, closing time',
  'set-save-failed': 'A change that couldn’t be saved',
  'set-pay-ways': 'Payments › Ways to pay — each on or off',
  'set-pay-other': 'Payments › Other ways to pay',
  'set-pay-card': 'Payments › Card machine',
  'set-staff': 'Staff and roles › People',
  'set-staff-person': 'One person — role, switches, till PIN',
  'set-staff-person-all': 'Give everything a Manager can do',
  'set-staff-clear-pin': 'Clear a forgotten PIN',
  'set-staff-roles': 'Staff and roles › What each role can do',
  'set-staff-invite': 'The owner invites someone',
  'set-shop-details': 'Shop and sites › Shop details',
  'set-shop-hours': 'Shop and sites › Opening hours',
  'set-workshop-services': 'Workshop › Services, by group',
  'set-msg-list': 'Messages › Automatic messages — text, email or both',
  'set-msg-edit': 'Change a message’s wording, with a preview',
  'set-msg-new': 'Add your own automatic message',
  'set-data-export': 'Your data › Download everything',
  'set-data-history': 'Your data › Settings changes',
  'fr-today': 'Getting started — the owner’s checklist on Today',
  'fr-step': 'A step opened from the checklist',
  'fr-done': 'All set up — the checklist goes',
  'set-workshop-mechanics': 'Workshop › Mechanics',
  'set-workshop-diary': 'Workshop › Diary blocks and storage slots (journey 12’s settings, moved here)',
});
export const ROWS = [
  { label: 'First-run setup', screens: ['fr-today', 'fr-step', 'fr-done'] },
  { label: 'Till settings', screens: ['set-list', 'set-till-quick', 'set-till-quick-add', 'set-till-quick-saved', 'set-till-reasons', 'set-till-receipts', 'set-till-printer', 'set-till-tills', 'set-till-tills-owner', 'set-till-remove', 'set-till-empty'] },
  { label: 'End of day and payment settings', screens: ['set-eod', 'set-eod-close', 'set-save-failed', 'set-pay-ways', 'set-pay-other', 'set-pay-card'] },
  { label: 'Staff and roles', screens: ['set-staff', 'set-staff-person', 'set-staff-person-all', 'set-staff-clear-pin', 'set-staff-roles', 'set-staff-invite'] },
  { label: 'Shop and sites', screens: ['set-shop-details', 'set-shop-hours'] },
  { label: 'Workshop settings', screens: ['set-workshop-services', 'set-workshop-mechanics', 'set-workshop-diary'] },
  { label: 'Messages', screens: ['set-msg-list', 'set-msg-edit', 'set-msg-new'] },
  { label: 'Your data', screens: ['set-data-export', 'set-data-history'] },
  { label: 'Options — the shape of Settings (decision 3: option 1)', screens: ['so-list', 'so-onepage', 'so-hub', 'so-hub-area'] },
];
