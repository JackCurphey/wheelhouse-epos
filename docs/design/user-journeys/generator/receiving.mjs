// Journey 13 — Receiving stock and purchase orders, in Soft sand on its own
// canvas. Decisions: docs/decisions/2026-09-30-receiving-stock-review.md
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
import { page, note, popup, overlay, withSize, isPhone, MANAGER } from './settings-frame.mjs';
import { screens as diaryScreens } from './diary.mjs';
import { today } from './opening.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';

// ---------- Shared pieces ----------
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '') => `<section aria-labelledby="t-${slug(title)}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? '14px' : '16px 20px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`)}</section>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const link = (t) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
// Decision 4: everyone can receive; orders and the restock list need "Can
// order stock" (Owner setup 9). Jo Taylor (Staff) is drawn without it.
const JO = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const stockPage = (title, content, who = MANAGER) => page('deliveries', title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 960px">${content}</div>`, who);
const qty = (n, label) => `<span role="group" aria-label="How many ${esc(label)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; flex-shrink: 0"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span style="min-width: 40px; text-align: center; font-family: ${MONO}; font-size: 15px">${n}</span><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">+</button></span>`;
const PADS = 'Shimano brake pads';

// ---------- Stockroom › Deliveries and orders ----------
// Decision 2: receiving comes first (most shops order on supplier websites);
// the restock list and any orders sit below.
const hubBoard = (staff = false) => stockPage('Deliveries and orders', `${section('A delivery arrived?', `${note('Scan each item as it comes out of the box. Works with or without an order.')}<div>${button('Receive a delivery')}</div>`)}
${staff ? '' : `${section('Restock list', list([
  line('Running low', `${mono('[n]')} products at or under their low-stock level`, link('See the list')),
  line('Selling fast', `${mono('[n]')} products sold more than usual in the last [n] days`, link('See the list')),
]))}
${section('Orders', list([
  line('[Supplier] · [n] lines', 'Ordered [date] · [n] still to come', tag('Part received', 'grey')),
  line('[Supplier] · [n] lines', 'Draft · not ordered yet', tag('Draft', 'grey')),
]), button('+ New order', { variant: 'default' }))}`}
${section('Recent deliveries', list([line('[Supplier] · [n] items', 'Booked in [date] by Jack Lewis', link('Open'))]))}
${staff ? note('Orders and the restock list are for people who can order stock.') : ''}`, staff ? JO : MANAGER);

// ---------- Decision 3: scan a delivery in ----------
const scanBox = `<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input type="search" aria-label="Scan a barcode, or type to search" placeholder="Scan a barcode, or type to search" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>`;
const supplierPick = `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><label for="rs-supplier" style="font-size: 14px; font-weight: 600">From</label><select id="rs-supplier" style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"><option>[Supplier] (optional)</option></select><span style="font-size: 13px; color: ${C.muted}">Picking one shows what’s still to come on its orders</span></div>`;
const waitingLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('workshop', 18)}</span>`;
const scannedRows = (unknown) => list([
  line(PADS, `B05S-RX · <strong style="color: ${C.warnInk}">Job WH-1042 is waiting for 1</strong>`, qty('[n]', PADS), waitingLead),
  line('[Product]', '[Supplier code] · on your order: [n]', qty('[n]', 'Product')),
  line('[Product]', '[Supplier code] · not on an order', qty('[n]', 'Product')),
  ...(unknown ? [line(mono('[barcode]'), 'Not in Wheelhouse yet', button('Add this product', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('alert', 18)}</span>`)] : []),
]);
const receiveBoard = (unknown = true) => stockPage('Receive a delivery', `${section('Receive a delivery', `${supplierPick}${scanBox}
${scannedRows(unknown)}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">${mono('[n]')} items scanned${unknown ? ' · 1 to add first' : ''}</span>${button(`Book in ${'[n]'} items`)}</div>`)}
${section('Still to come on the order', list([line('[Product]', '[Supplier code] · ordered [n], arrived [n]', tag('[n] to come', 'grey'))]))}`);

// "Add this product": the barcode is filled in; its measurements and
// specifications make it findable by them later (Owner setup, Noted for
// later — Jack's example: bearings with a 30 mm outside diameter).
const fieldRow = (id, label, value = '', w = '100%') => `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><input id="${id}" value="${value}" style="width: ${w}; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>`;
const specRow = (name, value, unit) => `<div role="listitem" style="display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 64px; gap: 8px; align-items: center"><input aria-label="Measurement name" value="${name}" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><input aria-label="${name} value" value="${value}" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 14px; color: ${C.ink}"><span style="font-size: 14px; color: ${C.muted}">${unit}</span></div>`;
const addProduct = () => popup('add-title', 'Add this product', `Barcode ${'[barcode]'} · not in Wheelhouse yet`, `
<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px">${icon('search', 16)}<span style="flex-grow: 1">Look it up in a supplier’s catalogue to fill this in</span>${link('Find it')}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)'}; gap: 12px">${fieldRow('ap-name', 'Name', '[Product name]')}${fieldRow('ap-code', 'Supplier code', '[code]')}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))'}; gap: 12px">${fieldRow('ap-cost', 'Cost', '£[cost]')}${fieldRow('ap-price', 'Price', '£[price]')}${fieldRow('ap-low', 'Low-stock level', '[n]')}</div>
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Measurements and specifications</span><span style="font-size: 13px; color: ${C.muted}">Staff can search by these — for example, bearings with a 30 mm outside diameter.</span>
<div role="list" style="display: flex; flex-direction: column; gap: 8px">${specRow('[Measurement]', '[value]', '[unit]')}${specRow('[Measurement]', '[value]', '[unit]')}</div><div>${button('+ Add a measurement', { variant: 'default' })}</div></div>`, `${button('Cancel', { variant: 'default' })}${button('Add and count 1')}`, 680);

// Decision 5: a bike asks for its frame number before it counts.
const framePopup = () => popup('frame-title', 'Frame number', '[Bike name] · bike [n] of [n] in this delivery', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 18)}<input aria-label="Frame number" placeholder="Scan the sticker on the frame, or type it" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></label>
${note('Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike.')}`, `${button('Cancel', { variant: 'default' })}${button('Count this bike')}`, 560);

// After Book in: stock is updated; the waiting job is flagged; labels offered.
const bookedBoard = () => stockPage('Receive a delivery', `${section('Booked in', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}${mono('[n]')} items booked in · stock updated</p>
${list([line('Job WH-1042 · Maya Patel', `Trek Domane AL 3 · was waiting for ${PADS} — flagged on the job for Alex Morgan`, link('Open the job'), waitingLead)])}
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 6px">${button('Print labels', { variant: 'default' })}${button('Receive another delivery', { variant: 'default' })}</div>`)}`);

// ---------- Decision 2: a purchase order, built by hand ----------
const poLine = (name, code, n, cost) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr auto' : 'minmax(0, 2fr) auto minmax(0, 0.8fr) 44px'}; gap: 12px; align-items: center; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${code}</span></span>${qty(n, name)}${isPhone() ? '' : `<span style="font-family: ${MONO}; font-size: 15px; text-align: right">${cost}</span><button type="button" aria-label="Remove ${esc(name)}" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}">${icon('close', 18)}</button>`}</div>`;
const orderBoard = () => stockPage('New order', `${section('New order', `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><label for="po-supplier" style="font-size: 14px; font-weight: 600">Supplier</label><select id="po-supplier" style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"><option>[Supplier]</option></select></div>
${scanBox.replace('Scan a barcode, or type to search', 'Add a product: scan, or type to search').replace('Scan a barcode, or type to search', 'Add a product: scan, or type to search')}
<div role="list">${poLine(PADS, 'B05S-RX · for job WH-1042', '[n]', '£[cost]')}${poLine('[Product]', '[Supplier code]', '[n]', '£[cost]')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 15px">Total cost ${mono('£[total]', 'font-size: 16px; font-weight: 700')}</span><span style="display: flex; flex-wrap: wrap; gap: 8px">${button('Save as draft', { variant: 'default' })}${button('Mark as ordered')}</span></div>
${note('Order it however you usually do — on the supplier’s website or by phone — then mark it as ordered so deliveries can be checked against it.')}`)}`);

// ---------- Decision 2: the restock list and its CSV ----------
const restockRow = (name, code, stock, sold, suggest) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '44px 1fr' : '44px minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto'}; gap: 12px; align-items: center; min-height: 56px; border-top: 1px solid ${C.border}"><input type="checkbox" checked aria-label="Include ${esc(name)}" style="width: 20px; height: 20px; margin: 0 12px; accent-color: ${C.accent}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${code}</span></span>${isPhone() ? '' : `<span style="font-size: 14px">${stock}</span><span style="font-size: 14px">${sold}</span>${qty(suggest, name)}`}</div>`;
const restockBoard = () => stockPage('Restock list', `${section('Restock list', `${note('Running low, or selling faster than usual. Tick what to reorder, then download it for the supplier’s website basket — or add it to an order.')}
<div role="group" aria-label="Show" style="display: flex; flex-wrap: wrap; gap: 8px">${['Everything', 'Running low', 'Selling fast'].map((t, i) => `<button type="button" aria-pressed="${i === 0}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${i === 0 ? C.ink : C.border}; background: ${i === 0 ? C.ink : C.panel}; color: ${i === 0 ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`).join('')}</div>
${isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; font-size: 13px; font-weight: 700; color: ${C.muted}"><span></span><span>Product</span><span>In stock</span><span>Sold, last [n] days</span><span style="width: 132px">Reorder</span></div>`}
<div role="list">${restockRow(PADS, 'B05S-RX · [Supplier]', '[n] · low', '[n]', '[n]')}${restockRow('[Product]', '[Supplier code] · [Supplier]', '[n]', '[n] · fast', '[n]')}${restockRow('[Product]', '[Supplier code] · [Supplier]', '[n] · low', '[n]', '[n]')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">3 ticked · [Supplier]</span><span style="display: flex; flex-wrap: wrap; gap: 8px">${button('Add to an order', { variant: 'default' })}${button('Download for [Supplier]’s basket')}</span></div>
${note('Downloads a CSV file in [the supplier’s basket-upload format] — to be checked for each supplier.')}`)}`);

def('rs-hub', () => hubBoard());
def('rs-hub-staff', () => hubBoard(true));
def('rs-receive', () => receiveBoard(true));
def('rs-add-product', () => overlay(receiveBoard(true), addProduct()));
def('rs-frame', () => overlay(receiveBoard(false), framePopup()));
def('rs-booked', () => bookedBoard());
def('rs-job-arrived', () => diaryScreens['job-part-arrived'][SIZE]);
def('rs-order', () => orderBoard());
def('rs-restock', () => restockBoard());
def('rs-today-restock', () => today({ restock: true }));

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'rs-hub': 'Stockroom › Deliveries and orders',
  'rs-hub-staff': 'Deliveries and orders, as Staff see it',
  'rs-receive': 'Receive a delivery: scan each item',
  'rs-add-product': 'A barcode Wheelhouse doesn’t know: Add this product, with its measurements',
  'rs-frame': 'A bike in the delivery: its frame number first',
  'rs-booked': 'Booked in: stock updated, the waiting job flagged',
  'rs-job-arrived': 'The job: its part has arrived',
  'rs-order': 'A purchase order, built by hand',
  'rs-restock': 'Restock list: download for the supplier’s basket',
  'rs-today-restock': 'Today: the restock list, for managers',
};
export const ROWS = [
  { label: 'Receiving a delivery', screens: ['rs-hub', 'rs-hub-staff', 'rs-receive', 'rs-add-product', 'rs-frame', 'rs-booked', 'rs-job-arrived'] },
  { label: 'Ordering', screens: ['rs-order', 'rs-restock', 'rs-today-restock'] },
];
