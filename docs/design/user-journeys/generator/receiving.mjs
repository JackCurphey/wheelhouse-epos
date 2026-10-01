// Journey 13 — Receiving stock and purchase orders, in Soft sand on its own
// canvas. Decisions: docs/decisions/2026-09-30-receiving-stock-review.md
// UI audit: docs/design/user-journeys/receiving-ui-audit.md (Jack took every
// recommendation, decision 10).
//
// Decision 2: purchase orders are built by hand; shops that order on the
// supplier's website skip orders and just receive; a part a job is waiting
// for is flagged when it's booked in; a restock list (running low, selling
// fast) downloads as a CSV for a supplier's website basket. Decision 3:
// deliveries are scanned in; an unknown barcode opens "Add this product",
// with the product's measurements and specifications (Owner setup, Noted
// for later). Real example data: Shimano brake pads B05S-RX £28.00, waited
// for by job WH-1042 (Maya Patel, Trek Domane AL 3). Every other product,
// supplier, cost, count and date is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, MANAGER, settingsPage, rowSwitch, stockFolds, STOCK_INTRO } from './settings-frame.mjs';
import { screens as diaryScreens, withPartArrived, buildDiaryDesktopBoard, tabletDiary, phoneDiary, TODAY, overviewAt } from './diary.mjs';
import { today } from './opening.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';

// ---------- Shared pieces ----------
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '') => `<section aria-labelledby="t-${slug(title)}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? '14px' : '16px 20px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`)}</section>`;
const subhead = (t) => `<h3 style="margin: 6px 0 0; font-size: 15px; font-weight: 700">${t}</h3>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
// Status tags: words first, an icon for good and warning (audit M5: amber
// only for a real warning; routine waits are grey).
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
// Links go somewhere; buttons drawn like links do something (audit M7). Both
// are at least 44 x 44 (audit L3), and repeated ones say which row.
const linkStyle = `display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${linkStyle}">${t}</a>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="${linkStyle}; border: 0; background: transparent; font-family: inherit; text-decoration: underline">${t}</button>`;
const visuallyHidden = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap';
// Decision 4: everyone can receive; orders and the restock list need "Can
// order stock" (Owner setup 9). Jo Taylor (Staff) is drawn without it.
const JO = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
// Sub-pages carry a way back (audit L2).
const back = `<a href="rs-hub-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Deliveries and orders</a>`;
const stockPage = (title, content, who = MANAGER, sub = true) => page('deliveries', title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 960px">${sub ? back : ''}${content}</div>`, who);
// A count: type it, or step it with − and + (audit H2; decision 3 says a
// quantity can be typed).
const qty = (n, label) => `<span role="group" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; flex-shrink: 0"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><input inputmode="numeric" aria-label="How many" value="${n}" style="width: 52px; height: 44px; box-sizing: border-box; border: 0; border-left: 1px solid ${C.border}; border-right: 1px solid ${C.border}; background: #ffffff; text-align: center; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">+</button></span>`;
const pillBtn = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
// Suppliers as pills, the one used last picked; "Other…" searches the rest
// (audit M8; Workshop day 62 and 66).
const supplierPills = (label, hint = '') => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span id="sp-${slug(label)}" style="font-size: 14px; font-weight: 600; margin-right: 2px">${label}</span><div role="group" aria-labelledby="sp-${slug(label)}" style="display: flex; flex-wrap: wrap; gap: 8px">${pillBtn('[Supplier]', true)}${pillBtn('[Supplier 2]', false)}${pillBtn('[Supplier 3]', false)}${pillBtn('Other…', false)}</div>${hint ? `<span style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</div>`;
// The placeholder takes the grey text colour, not the browser's (audit L1).
const scanBox = (ph = 'Scan a barcode, or type to search') => `<style>.rs-scan::placeholder { color: ${C.muted}; opacity: 1 }</style><label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input class="rs-scan" type="search" aria-label="${ph}" placeholder="${ph}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>`;
const PADS = 'Shimano brake pads';
const fieldRow = (id, label, value = '', w = '100%') => `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><input id="${id}" value="${value}" style="width: ${w}; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>`;
const amberBox = (head, body) => `<div role="status" style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}"><span style="display: flex; align-items: flex-start; gap: 8px; font-size: 16px; font-weight: 700">${icon('alert', 18)}<span>${head}</span></span>${body ? `<span style="font-size: 15px; color: ${C.ink}">${body}</span>` : ''}</div>`;
const actions = (left, right) => `<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px">${left}<span style="display: flex; flex-wrap: wrap; gap: 8px">${right}</span></div>`;

// ---------- Stockroom › Deliveries and orders ----------
// Decision 2: receiving comes first. Audit M1: the lists that need someone to
// act come next — To return (only when something's on it) — then the restock
// list, orders and recent deliveries. Audit M2: each order opens.
const hubBoard = ({ staff = false, empty = false } = {}) => stockPage('Deliveries and orders', `${section('A delivery arrived?', `${note('Scan each item as it comes out of the box. Works with or without an order.')}<div>${button('Receive a delivery')}</div>`)}
${staff || empty ? '' : section('To return to [Supplier]', list([
  line('[Product]', 'Damaged · [n] · from the delivery on [date]', button('Returned', { variant: 'default' }).replace('<button', '<button aria-label="Returned: [Product], damaged"')),
  line('[Product]', 'Wrong item · [n] · from the delivery on [date]', button('Returned', { variant: 'default' }).replace('<button', '<button aria-label="Returned: [Product], wrong item"')),
]))}
${staff ? '' : `${section('Restock list', list([
  line('Running low', `${mono('[n]')} products at or under their low-stock level`, link('See the list', 'See the list of products running low')),
  line('Selling fast', `${mono('[n]')} products sold more than usual in the last [n] days`, link('See the list', 'See the list of products selling fast')),
]))}
${section('Orders', empty
    ? note('No orders. Shops that order on the supplier’s website can ignore this — deliveries are received the same way.')
    : list([
      line('[Supplier] · [n] lines', 'Ordered [date] · [n] still to come', `${tag('Partly delivered', 'grey')}${link('Open', 'Open the order from [Supplier], ordered [date]')}`),
      line('[Supplier 2] · [n] lines', 'Draft · not ordered yet', `${tag('Draft', 'grey')}${link('Open', 'Open the draft order for [Supplier 2]')}`),
    ]), button('+ New order', { variant: 'default' }))}`}
${section('Recent deliveries', list(empty
    ? [line('[Supplier] · [n] items', 'Booked in [date] by Jack Lewis', `${staff ? '' : tag('Waiting for invoice', 'grey')}${link('Open', 'Open the delivery from [Supplier], [date]')}`)]
    : [
      line('[Supplier] · [n] items', 'Booked in [date] by Jack Lewis', `${staff ? '' : tag('Waiting for invoice', 'grey')}${link('Open', 'Open the delivery from [Supplier], [date]')}`),
      line('[Supplier 2] · [n] items', 'Booked in [date] by Jo Taylor', `${staff ? '' : tag('Invoice checked')}${link('Open', 'Open the delivery from [Supplier 2], [date]')}`),
    ]))}
${staff ? note('Orders, returns and the restock list are for people who can order stock.') : ''}`, staff ? JO : MANAGER, false);

// ---------- Decision 3: scan a delivery in ----------
const waitingLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('workshop', 18)}</span>`;
const alertLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('alert', 18)}</span>`;
// Decision 9: each scanned line can be marked damaged, wrong or missing.
const withProblem = (name, right) => `<span style="display: inline-flex; align-items: center; gap: 8px">${right}${linkBtn('Problem?', `Problem with ${name}`)}</span>`;
// Audit M3: the list shows what was set aside, and a bike with its frame
// numbers. A line stepped down past 1 is removed, with Undo.
const scannedRows = (state) => list([
  line(PADS, `B05S-RX · <strong style="color: ${C.warnInk}">Job WH-1042 is waiting for 1</strong>`, withProblem(PADS, qty('[n]', PADS)), waitingLead),
  state === 'marked'
    ? line('[Product]', `[Supplier code] · on your order: [n] · <strong style="color: ${C.warnInk}">Damaged · 1, set aside</strong>`, withProblem('[Product]', qty('[n]', '[Product]')), alertLead)
    : line('[Product]', '[Supplier code] · on your order: [n]', withProblem('[Product]', qty('[n]', '[Product]'))),
  line('[Product]', '[Supplier code] · not on an order', withProblem('[Product]', qty('[n]', '[Product]'))),
  ...(state === 'marked' ? [line('[Bike name]', `[Supplier code] · Frame ${mono('[frame number]')} · Frame ${mono('[frame number]')}`, withProblem('[Bike name]', qty('[n]', '[Bike name]')))] : []),
  ...(state === 'scan' || state === 'blocked' ? [line(mono('[barcode]'), 'Not in Wheelhouse yet', button('Add this product', { variant: 'default' }), alertLead)] : []),
]);
// Each scan is announced, and shown briefly (audit L1).
const scanned = `<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">Added ${PADS} · 1</p>`;
const receiveBoard = (state = 'scan') => stockPage('Receive a delivery', `${section('Scan the box', `${supplierPills('From', 'Shows what’s still to come on its orders')}${scanBox()}${scanned}
${scannedRows(state)}
${subhead('Still to come on the order')}
${list([line('[Product]', '[Supplier code] · ordered [n], arrived [n]', tag('[n] to come', 'grey'))])}
${state === 'blocked' ? `<div role="alert" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; font-weight: 700">${icon('alert', 18)}Add ${mono('[barcode]')} first, or remove it — then book in</div>` : ''}
${actions(`<span style="font-size: 14px; color: ${C.muted}">${mono('[n]')} items to book in${state === 'marked' ? ' · 1 set aside' : ''}${state === 'scan' || state === 'blocked' ? ' · 1 to add first' : ''}</span>`, button(`Book in ${'[n]'} items`))}`)}`);

// "Add this product": the barcode is filled in. Journey 14 decision 10:
// picking the category brings up that category's own details to fill in
// (Jack's example: bearings — inner diameter, outer diameter, height), so
// they are named the same way every time and Stock can filter by them.
const detailField = (id, label, value, unit = '') => `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><span style="display: flex; align-items: center; gap: 6px"><input id="${id}" inputmode="decimal" value="${value}" style="width: 100%; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${unit ? `<span style="font-size: 14px; color: ${C.muted}">${unit}</span>` : ''}</span></div>`;
const addProduct = () => popup('add-title', 'Add this product', `Barcode ${'[barcode]'} · not in Wheelhouse yet`, `
<div style="display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px">${icon('search', 16)}<span style="flex-grow: 1">Look it up in a supplier’s catalogue to fill this in</span>${linkBtn('Find it', 'Find it in a supplier’s catalogue')}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)'}; gap: 12px">${fieldRow('ap-name', 'Name', '[Bearing]')}${fieldRow('ap-code', 'Supplier code', '[code]')}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))'}; gap: 12px">${fieldRow('ap-cost', 'Cost', '£[cost]')}${fieldRow('ap-price', 'Price', '£[price]')}${fieldRow('ap-low', 'Low-stock level', '[n]')}</div>
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 6px"><label for="ap-cat" style="font-size: 14px; font-weight: 600">Category</label><select id="ap-cat" style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"><option>Bearings</option></select></div>
<span style="font-size: 15px; font-weight: 700">Bearings details</span><span style="font-size: 13px; color: ${C.muted}">Set for every bearing in Settings › Stockroom › Categories. Staff can find it by these — for example, a 30 mm outer diameter.</span>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'repeat(3, minmax(0, 1fr))'}; gap: 12px">${detailField('ap-inner', 'Inner diameter', '[n]', 'mm')}${detailField('ap-outer', 'Outer diameter', '30', 'mm')}${detailField('ap-height', 'Height', '[n]', 'mm')}</div></div>`, `${button('Cancel', { variant: 'default' })}${button('Add and count 1')}`, 680);

// Decision 5: a bike asks for its frame number before it counts. Audit M4:
// scanning the sticker counts it straight away; a number already in stock is
// caught. The warranty sentence stands on Customer service decision 4.
const framePopup = (dup = false) => popup('frame-title', 'Frame number', '[Bike name] · bike [n] in this delivery', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${dup ? C.warnInk : C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 18)}<input class="rs-scan" aria-label="Frame number" placeholder="Scan the sticker on the frame, or type it" value="${dup ? '[frame number]' : ''}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></label>
${dup ? `<div role="alert" style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px">${icon('alert', 18)}<span><strong>This frame number is already in stock</strong> — booked in [date]. Check the sticker, or scan the next bike.</span></div>` : note('Scanning the sticker counts the bike straight away. A typed number needs “Count this bike”.')}
${note('Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike.')}`, `${button('Cancel', { variant: 'default' })}${button('Count this bike')}`, 560);

// After Book in (audit M10): what happened, then the next steps — labels
// first when any are due, and the invoice for people who can order stock.
const bookedBoard = () => stockPage('Delivery booked in', `${section('Booked in', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}${mono('[n]')} items booked in · stock updated</p>
${list([
  line('Job WH-1042 · Maya Patel', `Trek Domane AL 3 · was waiting for ${PADS} — flagged on the job, the diary and the Overview`, link('Open the job', 'Open job WH-1042'), waitingLead),
  line('1 set aside as damaged', 'On To return to [Supplier]', link('See the list', 'See what’s to return to [Supplier]')),
  line(`${mono('[n]')} still to come on the order`, '[Supplier] · ordered [date]', link('Open the order', 'Open the order from [Supplier]')),
])}
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 6px">${button('Print labels')}${button('Add the invoice', { variant: 'default' })}${button('Receive another delivery', { variant: 'default' })}</div>`)}`);

// ---------- Decision 6: a quick invoice check (a settings switch) ----------
// The invoice total before VAT is compared with the cost of what was booked
// in — totals only. The invoice and costs are for people who can order stock
// (audit M12). Audit H4: items set aside as problems are listed, and a
// difference says how much of it they explain.
const deliveryLines = (staff) => list([
  line(PADS, `B05S-RX · ${mono('[n]')}${staff ? '' : ` × £[cost]`}`, staff ? '' : mono('£[cost]')),
  line('[Product]', `[Supplier code] · ${mono('[n]')}${staff ? '' : ` × £[cost]`}`, staff ? '' : mono('£[cost]')),
]);
const setAside = (staff) => `${subhead('Set aside as problems')}${list([line('[Product]', `Damaged · 1${staff ? '' : ' · £[cost]'}`, tag('On To return', 'grey'))])}`;
const INVOICE = {
  waiting: [tag('Waiting for invoice', 'grey'), () => `${note('Add the invoice when it comes, to check you’ve been charged for what arrived.')}<div>${button('Add the invoice')}</div>`],
  checked: [tag('Invoice checked'), () => `<p style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}Matches what was booked in</p>
<span style="font-size: 14px; color: ${C.muted}">Invoice [number] · ${mono('£[x]')} before VAT · added [date] by Jack Lewis · [invoice].pdf</span>`],
  diff: [tag('Doesn’t match', 'warn'), () => `${amberBox(`The invoice is ${mono('£[z]')} more than you booked in`, `Invoice ${mono('£[x]')} · booked in ${mono('£[y]')} · ${mono('£[w]')} of this is the items set aside as problems`)}
<span style="font-size: 14px; color: ${C.muted}">Invoice [number] · added [date] by Jack Lewis · [invoice].pdf</span>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Mark as queried with [Supplier]', { variant: 'default' })}${button('Accept the difference', { variant: 'default' })}</div>`],
  queried: [tag('Queried', 'grey'), () => `<p style="margin: 0; font-size: 15px">The invoice is ${mono('£[z]')} more than you booked in</p>
<span style="font-size: 14px; color: ${C.muted}">Queried with [Supplier] · [date] · Jack Lewis · Invoice [number]</span>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Add a corrected invoice', { variant: 'default' })}${button('Accept the difference', { variant: 'default' })}</div>`],
  accepted: [tag('Difference accepted', 'grey'), () => `<p style="margin: 0; font-size: 15px">Difference of ${mono('£[z]')} accepted</p>
<span style="font-size: 14px; color: ${C.muted}">Jack Lewis · [date] · Invoice [number]</span>
<div role="status" style="display: flex; align-items: center; gap: 12px; align-self: flex-start; padding: 4px 4px 4px 14px; border-radius: 8px; background: ${C.ink}; color: ${C.panel}; font-size: 14px; font-weight: 600">Accepted${`<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 700; color: ${C.panel}; text-decoration: underline">Undo</button>`}</div>`],
};
const deliveryBoard = (state = 'waiting', { staff = false, problems = false } = {}) => stockPage('Delivery', `${section('[Supplier] · [n] items', `<span style="font-size: 14px; color: ${C.muted}">Booked in [date] by Jack Lewis</span>${deliveryLines(staff)}
${staff ? '' : `<div style="display: flex; justify-content: space-between; gap: 10px; padding-top: 6px; font-size: 15px"><span>Booked-in cost, before VAT</span>${mono('£[y]', 'font-size: 16px; font-weight: 700')}</div>`}
${problems ? setAside(staff) : ''}`)}
${staff ? note('Costs and the invoice are for people who can order stock.') : section('Invoice', INVOICE[state][1](), INVOICE[state][0])}`, staff ? JO : MANAGER);
const invoicePopup = () => popup('inv-title', 'Add the invoice', '[Supplier] · delivery booked in [date]', `
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)'}; gap: 12px">${fieldRow('inv-no', 'Invoice number', '[number]')}${fieldRow('inv-total', 'Total before VAT', '£[x]')}</div>
<div style="display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px">${icon('plus', 16)}<span style="flex-grow: 1">Attach the PDF (optional)</span>${linkBtn('Choose a file', 'Choose the invoice PDF')}</div>
${note(`Booked in: ${mono('£[y]')} before VAT. Wheelhouse compares the two totals.`)}`, `${button('Cancel', { variant: 'default' })}${button('Check it')}`, 560);

// The switch (decision 6), in Settings › Stockroom (decision 7). Audit L5:
// what turning it off does.
const invoiceSetting = () => settingsPage('stock', 'Stockroom', STOCK_INTRO, stockFolds({ invoices: `${rowSwitch('Check supplier invoices', true)}
${note('On a booked-in delivery, “Add the invoice” compares the invoice total with what was booked in. Turn it off if you check invoices in your accounts software instead — the Invoice card and the “Waiting for invoice” tags go, including on deliveries already waiting.')}` }));

// Decision 8: labels for what needs one — no maker's barcode, or new in this
// delivery — one per item received; barcoded items start at 0. Audit M8: the
// printer starts on the one used last.
const labelsPopup = () => popup('lb-title', 'Print labels', '[Supplier] · booked in just now', `
${note('Set for what needs a label: products without their own barcode, and new ones added in this delivery. Change any count.')}
${list([
  line('[Product]', 'No barcode of its own · [n] received', qty('[n]', 'Labels for [Product]')),
  line('[Product name]', 'New in this delivery · [n] received', qty('[n]', 'Labels for [Product name]')),
  line('[Product]', 'Has its own barcode · [n] received', qty('0', 'Labels for [Product]')),
])}
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14px"><span>Printing on <strong>[Label printer]</strong>, the one used last</span>${linkBtn('Change', 'Change the label printer')}</div>`, `${button('Cancel', { variant: 'default' })}${button('Print [n] labels')}`, 600);

// Decision 9: "Problem?" on a scanned line. Damaged and wrong items aren't
// added to stock and go on the supplier's "To return" list; missing ones
// stay "to come" on the order (offered only when there's an order).
const PROBLEM_NOTE = {
  Damaged: 'Damaged items aren’t added to stock. They go on “To return to [Supplier]” in Deliveries and orders until they’re sent back.',
  'Wrong item': 'Wrong items aren’t added to stock. They go on “To return to [Supplier]” in Deliveries and orders until they’re sent back.',
  Missing: 'Missing items stay “to come” on the order.',
};
const problemPopup = (kind = 'Damaged') => popup('pb-title', 'Something wrong?', `[Product] · [Supplier code] · [n] scanned`, `
<div role="group" aria-label="What’s wrong" style="display: flex; flex-wrap: wrap; gap: 8px">${Object.keys(PROBLEM_NOTE).map((t) => pillBtn(t, t === kind)).join('')}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="font-size: 15px; font-weight: 600">How many</span>${qty('[n]', `How many ${kind.toLowerCase()}`)}</div>
${fieldRow('pb-note', 'Note (optional)', '')}
${note(PROBLEM_NOTE[kind])}`, `${button('Cancel', { variant: 'default' })}${button(`Mark as ${kind.toLowerCase()}`)}`, 560);

// ---------- Decision 2: a purchase order, built by hand ----------
const poLine = (name, code, n, cost) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr auto' : 'minmax(0, 2fr) auto minmax(0, 0.8fr) 44px'}; gap: 12px; align-items: center; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${code}</span></span>${qty(n, name)}${isPhone() ? '' : `<span style="font-family: ${MONO}; font-size: 15px; text-align: right">${cost}</span><button type="button" aria-label="Remove ${esc(name)}" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}">${icon('close', 18)}</button>`}</div>`;
const orderBoard = () => stockPage('New order', `${section('What to order', `${supplierPills('Supplier')}
${scanBox('Add a product: scan, or type to search')}
<div role="list">${poLine(PADS, 'B05S-RX · for job WH-1042', '[n]', '£[cost]')}${poLine('[Product]', '[Supplier code]', '[n]', '£[cost]')}</div>
${actions(`<span style="font-size: 15px">Total cost ${mono('£[total]', 'font-size: 16px; font-weight: 700')}</span>`, `${button('Save as draft', { variant: 'default' })}${button('Mark as ordered')}`)}
${note('Order it however you usually do — on the supplier’s website or by phone — then mark it as ordered so deliveries can be checked against it.')}`)}`);
// Audit M2: an ordered order, part delivered — receive against it, or close
// it when the rest isn't coming.
const orderedBoard = () => stockPage('Order', `${section('[Supplier] · ordered [date]', `<div>${tag('Partly delivered', 'grey')}</div>
${list([
  line(PADS, 'B05S-RX · for job WH-1042 · ordered [n] · arrived [n]', tag('All arrived')),
  line('[Product]', '[Supplier code] · ordered [n] · arrived [n]', tag('[n] to come', 'grey')),
])}
${actions(`<span style="font-size: 15px">Total cost ${mono('£[total]', 'font-size: 16px; font-weight: 700')}</span>`, `${button('Close the order', { variant: 'default' })}${button('Receive against this order')}`)}
${note('Closing the order drops anything still to come.')}`)}`);

// ---------- Decision 2: the restock list and its CSV ----------
// Audit M6: grouped by supplier, as a basket file is per supplier; the whole
// 44px cell is the tick box; each value is named for a screen reader.
const tick = (label) => `<label style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px"><input type="checkbox" checked aria-label="${esc(label)}" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"></label>`;
const cols = () => (isPhone() ? '44px 1fr' : '44px minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto');
const restockRow = (name, code, stock, sold, suggest) => `<div role="listitem" style="display: grid; grid-template-columns: ${cols()}; gap: 12px; align-items: center; min-height: 56px; border-top: 1px solid ${C.border}">${tick(`Include ${name}`)}<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${code}${isPhone() ? ` · in stock ${stock} · sold ${sold}` : ''}</span>${isPhone() ? `<span style="padding-top: 6px">${qty(suggest, `Reorder ${name}`)}</span>` : ''}</span>${isPhone() ? '' : `<span style="font-size: 14px"><span style="${visuallyHidden}">In stock: </span>${stock}</span><span style="font-size: 14px"><span style="${visuallyHidden}">Sold, last [n] days: </span>${sold}</span>${qty(suggest, `Reorder ${name}`)}`}</div>`;
const supplierGroup = (sup, rows, n) => `<section aria-labelledby="g-${slug(sup)}" style="display: flex; flex-direction: column; gap: 4px; padding-top: 6px">
<div style="display: flex; align-items: center; gap: 12px">${tick(`Include everything from ${sup}`)}<h3 id="g-${slug(sup)}" style="margin: 0; font-size: 16px; font-weight: 700">${sup}</h3></div>
<div role="list">${rows}</div>
${actions(`<span style="font-size: 14px; color: ${C.muted}">${n} ticked</span>`, `${button('Add to an order', { variant: 'default' })}${button(`Download for ${sup}’s basket`, { variant: 'default' })}`)}</section>`;
const restockBoard = () => stockPage('Restock list', `${section('Tick what to reorder', `${note('Running low, or selling faster than usual. Tick what to reorder, then download it for that supplier’s website basket — or add it to an order.')}
<div role="group" aria-label="Show" style="display: flex; flex-wrap: wrap; gap: 8px">${['Both', 'Running low', 'Selling fast'].map((t, i) => pillBtn(t, i === 0)).join('')}</div>
${isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${cols()}; gap: 12px; font-size: 13px; font-weight: 700; color: ${C.muted}"><span></span><span>Product</span><span>In stock</span><span>Sold, last [n] days</span><span style="width: 140px">Reorder</span></div>`}
${supplierGroup('[Supplier]', `${restockRow(PADS, 'B05S-RX', '[n] · low', '[n]', '[n]')}${restockRow('[Product]', '[Supplier code]', '[n]', '[n] · fast', '[n]')}`, 2)}
${supplierGroup('[Supplier 2]', restockRow('[Product]', '[Supplier code]', '[n] · low', '[n]', '[n]'), 1)}
${note('Downloads a CSV file in [the supplier’s basket-upload format] — to be checked for each supplier.')}`)}`);

def('rs-hub', () => hubBoard());
def('rs-hub-empty', () => hubBoard({ empty: true }));
def('rs-hub-staff', () => hubBoard({ staff: true }));
def('rs-receive', () => receiveBoard('scan'));
def('rs-add-product', () => overlay(receiveBoard('scan'), addProduct()));
def('rs-problem', () => overlay(receiveBoard('clean'), problemPopup()));
def('rs-frame', () => overlay(receiveBoard('marked'), framePopup()));
def('rs-frame-dup', () => overlay(receiveBoard('marked'), framePopup(true)));
def('rs-receive-marked', () => receiveBoard('marked'));
def('rs-book-blocked', () => receiveBoard('blocked'));
def('rs-booked', () => bookedBoard());
def('rs-labels', () => overlay(bookedBoard(), labelsPopup()));
def('rs-job-arrived', () => diaryScreens['job-part-arrived'][SIZE]);
// Audit H1: the badge on the diary block and the Overview row too.
def('rs-diary-arrived', () => withPartArrived('WH-1042', () => (SIZE === 'desktop' ? buildDiaryDesktopBoard() : SIZE === 'tablet' ? tabletDiary() : phoneDiary({ day: TODAY, mode: 'everyone' }))));
def('rs-overview-arrived', () => withPartArrived('WH-1042', () => overviewAt(SIZE)));
def('rs-delivery', () => deliveryBoard('waiting', { problems: true }));
def('rs-invoice', () => overlay(deliveryBoard('waiting', { problems: true }), invoicePopup()));
def('rs-invoice-checked', () => deliveryBoard('checked'));
def('rs-invoice-diff', () => deliveryBoard('diff', { problems: true }));
def('rs-invoice-queried', () => deliveryBoard('queried', { problems: true }));
def('rs-invoice-accepted', () => deliveryBoard('accepted', { problems: true }));
def('rs-delivery-staff', () => deliveryBoard('waiting', { staff: true, problems: true }));
def('rs-invoice-setting', () => invoiceSetting());
def('rs-order', () => orderBoard());
def('rs-order-ordered', () => orderedBoard());
def('rs-restock', () => restockBoard());
def('rs-today-restock', () => today({ restock: true }));

// All three sizes (desktop approved after the UI audit, decision 10).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'rs-hub': 'Stockroom › Deliveries and orders',
  'rs-hub-empty': 'Deliveries and orders, for a shop that orders on supplier websites',
  'rs-hub-staff': 'Deliveries and orders, as Staff see it',
  'rs-receive': 'Receive a delivery: scan each item',
  'rs-add-product': 'A barcode Wheelhouse doesn’t know: Add this product, with its measurements',
  'rs-problem': 'Something wrong with an item: damaged, wrong or missing',
  'rs-frame': 'A bike in the delivery: its frame number first',
  'rs-frame-dup': 'A frame number already in stock',
  'rs-receive-marked': 'Ready to book in: one item set aside, a bike with its frame numbers',
  'rs-book-blocked': 'Book in with an unknown barcode still on the list',
  'rs-booked': 'Delivery booked in: the waiting job flagged, what’s next',
  'rs-labels': 'Print labels: only what needs one',
  'rs-job-arrived': 'The job: its part has arrived',
  'rs-diary-arrived': 'The diary: “Part arrived” on the job’s block',
  'rs-overview-arrived': 'Workshop Overview: “Part arrived” on the job’s row',
  'rs-delivery': 'A booked-in delivery, waiting for its invoice',
  'rs-invoice': 'Add the invoice: its total against what was booked in',
  'rs-invoice-checked': 'The invoice matches: checked',
  'rs-invoice-diff': 'The invoice doesn’t match: the difference, to query',
  'rs-invoice-queried': 'Queried with the supplier',
  'rs-invoice-accepted': 'The difference accepted, with Undo',
  'rs-delivery-staff': 'A delivery, as Staff see it: no costs, no invoice',
  'rs-invoice-setting': 'Settings › Stockroom: the invoice check, on or off',
  'rs-order': 'A purchase order, built by hand',
  'rs-order-ordered': 'An order, partly delivered: receive against it, or close it',
  'rs-restock': 'Restock list: by supplier, a download for each basket',
  'rs-today-restock': 'Today: new on the restock list',
};
export const ROWS = [
  { label: 'Receiving a delivery', screens: ['rs-hub', 'rs-hub-empty', 'rs-hub-staff', 'rs-receive', 'rs-add-product', 'rs-problem', 'rs-frame', 'rs-frame-dup', 'rs-receive-marked', 'rs-book-blocked', 'rs-booked', 'rs-labels'] },
  { label: 'The waiting job', screens: ['rs-job-arrived', 'rs-diary-arrived', 'rs-overview-arrived'] },
  { label: 'Checking the invoice', screens: ['rs-delivery', 'rs-invoice', 'rs-invoice-checked', 'rs-invoice-diff', 'rs-invoice-queried', 'rs-invoice-accepted', 'rs-delivery-staff', 'rs-invoice-setting'] },
  { label: 'Ordering', screens: ['rs-order', 'rs-order-ordered', 'rs-restock', 'rs-today-restock'] },
];
