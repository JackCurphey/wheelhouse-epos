// Journey 14 — Stock take and stock control, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-stock-control-review.md
// UI audit: docs/design/user-journeys/stock-ui-audit.md (Jack took every
// recommendation, decision 11).
//
// Real example data: Shimano brake pads B05S-RX £28.00; the Trek Domane AL 3;
// job WH-1042 (Maya Patel); Jack Lewis (Owner — UX walk-through 2 (decision 6)), Jo Taylor (Staff), Alex
// Morgan (Mechanic); Bolton; Till B1; Jack's examples — bearings (inner
// diameter, outer diameter, height), derailleurs (number of gears), "bearing
// 30 mm". Every other product, price, cost, margin and count is a bracketed
// placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, MANAGER, settingsPage, stockFolds, STOCK_INTRO } from './settings-frame.mjs';
import { today } from './opening.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';

// ---------- Shared pieces (as journey 13) ----------
const JO = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const pillStyle = (on) => `min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600; white-space: nowrap`;
// A filter you can turn on and off is a toggle; a "pick one" group is a set
// of radio buttons (audit L5).
const pillBtn = (t, on) => `<button type="button" aria-pressed="${on}" style="${pillStyle(on)}">${t}</button>`;
const radios = (label, items, on = -1, show = true) => `<div role="radiogroup" aria-label="${esc(label)}" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${show ? `<span style="font-size: 15px; font-weight: 600; margin-right: 4px">${label}</span>` : ''}${items.map((t, i) => `<button type="button" role="radio" aria-checked="${i === on}" style="${pillStyle(i === on)}">${t}</button>`).join('')}</div>`;
const visuallyHidden = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap';
const linkStyle = `display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${linkStyle}">${t}</a>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="${linkStyle}; border: 0; background: transparent; font-family: inherit; text-decoration: underline">${t}</button>`;
const PH = `<style>.st-ph::placeholder { color: ${C.muted}; opacity: 1 }</style>`;
const input = (label, value = '', { id = '', w = '', monoFont = false, ph = '' } = {}) => `<input class="st-ph"${id ? ` id="${id}"` : ` aria-label="${esc(label)}"`} value="${value}"${ph ? ` placeholder="${esc(ph)}"` : ''} style="${w ? `width: ${w};` : 'width: 100%;'} min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${monoFont ? MONO : 'inherit'}; font-size: 15px; color: ${C.ink}">`;
const box = (title, body, action = '') => card(`<div style="padding: ${isPhone() ? '14px' : '16px 18px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap"><h2 style="margin: 0; font-size: 16px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`, 'flex-shrink: 0');
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 32px; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="display: inline-flex; align-items: center; gap: 8px">${v}</span></div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const qty = (n, label) => `<span role="group" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; flex-shrink: 0"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><input inputmode="numeric" aria-label="How many" value="${n}" style="width: 52px; height: 44px; box-sizing: border-box; border: 0; border-left: 1px solid ${C.border}; border-right: 1px solid ${C.border}; background: #ffffff; text-align: center; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">+</button></span>`;
const toast = (text) => `<div role="status" style="display: flex; align-items: center; gap: 12px; align-self: flex-start; padding: 4px 4px 4px 14px; border-radius: 8px; background: ${C.ink}; color: ${C.panel}; font-size: 14px; font-weight: 600">${text}<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 700; color: ${C.panel}; text-decoration: underline">Undo</button></div>`;
const backTo = (t, href) => `<a href="${href}" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const PADS = 'Shimano brake pads';
const TREK = 'Trek Domane AL 3';
const pageIn = (room, title, content, who = MANAGER, back = '') => page(room, title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${back}${content}</div>`, who);

// ---------- Decision 2: the stock list ----------
// One search box for stock (audit M10: the header's search finds products
// the same way, measurements included). Tick boxes always there (H3).
const searchBox = (value = '', label = 'Search stock', ph = 'Name, barcode, supplier code — or a measurement, like “bearing 30 mm”') => `${PH}<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input class="st-ph" type="search" aria-label="${label}" placeholder="${ph}" value="${esc(value)}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}">${icon('scan', 20)}</label>`;
// Audit M11: All, Running low and Below zero stay put; a category is picked
// by searching, and shows as a dark pill with ✕.
const catPill = (picked) => picked
  ? `<span style="display: inline-flex; align-items: center; gap: 2px; min-height: 44px; box-sizing: border-box; padding: 0 0 0 16px; border-radius: 999px; background: ${C.ink}; color: ${C.panel}; font-size: 14px; font-weight: 600">${picked}<button type="button" aria-label="Remove the ${esc(picked)} filter" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.panel}">${icon('close', 16)}</button></span>`
  : `<label style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.muted}">${icon('search', 15)}<input class="st-ph" aria-label="Category" placeholder="Category" style="width: 96px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}"></label>`;
const filters = (on = 0, picked = '') => `<div style="display: flex; gap: 8px; align-items: center; ${isPhone() ? 'overflow-x: auto; padding-bottom: 2px' : 'flex-wrap: wrap'}">${['All', 'Running low', 'Below zero'].map((t, i) => pillBtn(t, i === on && !picked)).join('')}${catPill(picked)}</div>`;
let STAFF = false;
let DETAILS = null; // a category's details as columns (audit M12)
const COLS = () => {
  if (isPhone()) return '44px 1fr auto';
  const d = DETAILS ? DETAILS.map(() => 'minmax(0, 0.7fr)').join(' ') + ' ' : '';
  return `44px minmax(0, 2.2fr) ${d}minmax(0, 0.9fr) minmax(0, 0.8fr)${STAFF || DETAILS ? '' : ' minmax(0, 0.7fr)'}`;
};
const tickBox = (label, on = false) => `<label style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px"><input type="checkbox" ${on ? 'checked ' : ''}aria-label="${esc(label)}" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"></label>`;
// Sortable headings (audit L7).
const sortHead = (t, sorted = false, right = false) => `<span role="columnheader" aria-sort="${sorted ? 'ascending' : 'none'}" style="${right ? 'text-align: right' : ''}"><button type="button" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 13px; font-weight: 700; color: ${C.muted}">${t}${sorted ? `<span aria-hidden="true" style="display: inline-flex; transform: rotate(180deg)">${icon('chevron', 12)}</span>` : ''}</button></span>`;
const head = (n) => (isPhone() ? '' : `<div role="row" style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; align-items: center; padding: 4px 16px 2px 0">${tickBox(`Tick all ${n} shown`)}${sortHead('Product', true)}${(DETAILS || []).map(([d]) => sortHead(d)).join('')}${sortHead('In stock')}${sortHead('Price', false, true)}${STAFF || DETAILS ? '' : sortHead('Margin', false, true)}</div>`);
// A row: the product's name and line under it are one 44px link (audit M9).
const row = ({ name, sub, stock, state = '', price, margin, ticked = false, details = [] }) => `<li style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; align-items: center; min-height: 60px; box-sizing: border-box; padding: 4px 16px 4px 0; border-top: 1px solid ${C.border}">${tickBox(`Tick ${name}`, ticked)}
<a href="#" style="display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; min-height: 44px; text-decoration: none; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600; text-decoration: underline; text-decoration-color: ${C.border}">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}${isPhone() ? ` · ${price}` : ''}</span></a>
${isPhone() ? '' : details.map((v, i) => `<span style="font-family: ${MONO}; font-size: 15px"><span style="${visuallyHidden}">${DETAILS[i][0]}: </span>${v}</span>`).join('')}
<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; ${isPhone() ? 'justify-content: flex-end' : ''}"><span style="${visuallyHidden}">In stock: </span>${mono(stock, 'font-size: 15px')}${state === 'low' ? tag('Running low', 'grey') : state === 'below' ? tag('Below zero', 'warn') : ''}</span>
${isPhone() ? '' : `<span style="text-align: right; font-size: 15px"><span style="${visuallyHidden}">Price: </span>${mono(price)}</span>${STAFF || DETAILS ? '' : `<span style="text-align: right; font-size: 15px; color: ${C.muted}"><span style="${visuallyHidden}">Margin: </span>${margin}</span>`}`}</li>`;
const ROWS_ALL = [
  { name: PADS, sub: 'B05S-RX · [Category] · [Supplier]', stock: '[n]', price: '£28.00', margin: '[n]%' },
  { name: TREK, sub: '[Category] · [n] bikes, each by frame number', stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '−[n]', state: 'below', price: '£[price]', margin: '[n]%' },
  { name: '[Product with sizes]', sub: '[Category] · [n] sizes · [n] colours · 1 size below zero', stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', price: '£[price]', margin: '[n]%' },
];
// A measurement search across every category: the details on one short line,
// named as the category names them (audit L2, M12).
const ROWS_MEASURE = [
  { name: '[Bearing]', sub: `Inner diameter [n] · <strong style="color: ${C.ink}">Outer diameter 30</strong> · Height [n] mm`, stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Bearing]', sub: `Inner diameter [n] · <strong style="color: ${C.ink}">Outer diameter 30</strong> · Height [n] mm`, stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%' },
];
const tickedBar = (n) => `<div role="region" aria-label="Ticked products" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border-radius: 10px; background: ${C.ink}; color: ${C.panel}"><span style="font-size: 15px; font-weight: 700; flex-grow: 1">${n} ticked</span><button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.panel}; text-decoration: underline">Untick all</button>${button('Print labels', { variant: 'default' })}${button('Send to another shop', { variant: 'default' })}${STAFF ? '' : button('Change prices', { variant: 'default' })}</div>`;
const listBoard = ({ query = '', rows = ROWS_ALL, summary = `${mono('[n]')} products`, bar = '', filt = filters(0), after = '', who = MANAGER, n = '[n]' } = {}) => pageIn('stock', 'Stock', `<div style="display: flex; flex-direction: column; gap: 12px; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px"><div style="flex-grow: 1; min-width: 0">${searchBox(query)}</div>${isPhone() || STAFF ? '' : button('+ Add a product', { variant: 'default' })}</div>
${filt}
<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">${summary}</p>${bar}${after}</div>
${rows.length ? card(`<div role="table" aria-label="Products">${head(n)}<ul role="list" style="margin: 0; padding: 0; list-style: none">${rows.map(row).join('')}</ul></div>`, 'overflow: hidden; flex-shrink: 0') : ''}`, who);
const asStaff = (fn) => { STAFF = true; try { return fn(); } finally { STAFF = false; } };
const withDetails = (d, fn) => { DETAILS = d; try { return fn(); } finally { DETAILS = null; } };

// Audit L1: the states the list was missing.
const emptyCard = (title, body) => card(`<div style="padding: 24px 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px"><h2 style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2>${body}</div>`, 'flex-shrink: 0');
const noneBoard = () => listBoard({ query: '[what was typed]', rows: [], summary: 'No products', after: emptyCard('Nothing matches “[what was typed]”', `${note('Check the spelling, or try a supplier code or a measurement.')}${button('+ Add “[what was typed]” as a product', { variant: 'default' })}`) });
const unknownBoard = () => listBoard({ query: '[barcode]', rows: [], summary: 'No products', after: emptyCard(`Barcode ${mono('[barcode]')} isn’t in Wheelhouse yet`, `${note('Add it now, with its category and details — or look it up in a supplier’s catalogue.')}${button('Add this product', { variant: 'default' })}`) });
const newShopBoard = () => listBoard({ rows: [], summary: 'No products yet', after: emptyCard('No products yet', `${note('Add your first product, or bring everything over from Citrus Lime (Office › Moving from Citrus Lime).')}<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('+ Add a product')}${button('Bring them from Citrus Lime', { variant: 'default' })}</div>`) });
// Decision 4: searching a size opens that size and colour.
const sizeSearchBoard = () => listBoard({ query: '[Product with sizes] M', rows: [{ name: '[Product with sizes]', sub: 'Size M · [Colour 1] · its own barcode', stock: '−1', state: 'below', price: '£[price]', margin: '[n]%' }], summary: `${mono('1')} size and colour` });

// ---------- Decision 10: each category's own details ----------
// The filter for a detail follows its kind: a number box, or choices (M12).
const detailFilter = (label, value, unit) => `<label style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; box-sizing: border-box; padding: 0 6px 0 12px; border: 1px solid ${value ? C.ink : C.border}; border-radius: 8px; background: ${C.panel}; font-size: 14px; font-weight: 600">${label}<input class="st-ph" value="${value}" placeholder="Any" aria-label="${esc(label)}" style="width: 56px; min-height: 36px; box-sizing: border-box; text-align: right; border: 0; background: transparent; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${unit}</label>`;
const BEARING_COLS = [['Inner diameter'], ['Outer diameter'], ['Height']];
const bearingsBoard = () => withDetails(BEARING_COLS, () => listBoard({
  rows: [
    { name: '[Bearing]', sub: '[Supplier code] · [Supplier]', details: ['[n] mm', '30 mm', '[n] mm'], stock: '[n]', price: '£[price]' },
    { name: '[Bearing]', sub: '[Supplier code] · [Supplier]', details: ['[n] mm', '30 mm', '[n] mm'], stock: '[n]', state: 'low', price: '£[price]' },
  ],
  n: '2', summary: `${mono('2')} bearings with an outer diameter of 30 mm`,
  filt: `${filters(0, 'Bearings')}<div role="group" aria-label="Bearings details" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">Bearings details:</span>${detailFilter('Inner diameter', '', 'mm')}${detailFilter('Outer diameter', '30', 'mm')}${detailFilter('Height', '', 'mm')}</div>`,
}));
const derailleursBoard = () => withDetails([['Number of gears']], () => listBoard({
  rows: [
    { name: '[Derailleur]', sub: '[Supplier code] · [Supplier]', details: ['[n]'], stock: '[n]', price: '£[price]' },
    { name: '[Derailleur]', sub: '[Supplier code] · [Supplier]', details: ['[n]'], stock: '[n]', price: '£[price]' },
  ],
  n: '2', summary: `${mono('2')} derailleurs with [n] gears`,
  filt: `${filters(0, 'Drivetrain › Derailleurs')}<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">Derailleurs details:</span>${radios('Number of gears', ['Any', '[n]', '[n]', '[n]'], 1)}</div>`,
}));
// Settings › Stockroom › Categories.
const catRow = (name, details, parent = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0 8px ${parent ? 24 : 0}px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${parent ? `<span aria-hidden="true" style="color: ${C.muted}">↳ </span><span style="${visuallyHidden}">Inside ${parent}: </span>` : ''}${name}</span><span style="font-size: 13px; color: ${C.muted}">${details}</span></span>${linkBtn('Edit', `Edit ${name}`)}</div>`;
const categoriesOpen = () => `<div role="list">${catRow('Bearings', 'Inner diameter (mm) · Outer diameter (mm) · Height (mm)')}${catRow('Drivetrain', '[Detail] · passed down to its sub-categories')}${catRow('Derailleurs', 'Number of gears (a choice) · and Drivetrain’s details', 'Drivetrain')}${catRow('[Category]', '[Detail] · [Detail]')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${button('+ Add a category', { variant: 'default' })}${note('A product shows its category’s details to fill in, and Stock can filter by them.')}</div>`;
const categoriesBoard = () => settingsPage('stock', 'Stockroom', STOCK_INTRO, stockFolds({ categories: categoriesOpen() }));
// Audit H4: the box asks for what each kind needs — a unit, or the choices.
// Audit M15: a removed detail can be undone until Save, which says what goes.
const choicePill = (t) => `<span style="display: inline-flex; align-items: center; gap: 2px; min-height: 44px; box-sizing: border-box; padding: 0 0 0 12px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px">${t}<button type="button" aria-label="Remove the choice ${esc(t)}" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.muted}">${icon('close', 14)}</button></span>`;
const comboBox = (id, label, value) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><span style="display: flex; align-items: center; gap: 8px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff">${icon('search', 15)}<input id="${id}" role="combobox" aria-expanded="false" value="${value}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></span></div>`;
const categoryEdit = () => popup('cat-title', 'Derailleurs', 'A sub-category of Drivetrain', `
${comboBox('cat-parent', 'Sits inside', 'Drivetrain')}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">From Drivetrain</span><span style="font-size: 14px; color: ${C.muted}">[Detail]</span></span>${linkBtn('Change it on Drivetrain')}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 15px; font-weight: 700">Derailleurs’ own details</span>
<div role="list"><div role="listitem" style="display: flex; flex-direction: column; gap: 8px; padding: 8px 0; border-top: 1px solid ${C.border}"><div style="display: flex; align-items: center; gap: 10px">${input('Detail name', 'Number of gears')}<span style="font-size: 14px; color: ${C.muted}; white-space: nowrap">A choice from a list</span><button type="button" aria-label="Remove Number of gears" style="width: 44px; height: 44px; flex-shrink: 0; border: 0; background: transparent; color: ${C.muted}">${icon('close', 18)}</button></div><div role="group" aria-label="Choices for Number of gears" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px">${['[n]', '[n]', '[n]'].map(choicePill).join('')}${input('Add a choice', '', { w: '140px', ph: 'Add a choice' })}</div></div>
<div role="listitem" style="display: flex; align-items: center; gap: 10px; min-height: 52px; border-top: 1px solid ${C.border}; color: ${C.muted}; font-size: 14px"><span style="flex-grow: 1"><s>[Detail]</s> · removed</span>${linkBtn('Undo', 'Undo removing [Detail]')}</div></div></div>
<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 8px; background: ${C.mutedBg}"><span style="font-size: 14px; font-weight: 700">Add a detail</span>${input('New detail name', '', { ph: 'Name, like “Cage length”' })}${radios('Kind of answer', ['A number with a unit', 'A choice from a list', 'Text'], 0, false)}<div style="display: flex; align-items: center; gap: 8px"><label for="cat-unit" style="font-size: 14px; font-weight: 600">Unit</label>${input('Unit', '', { id: 'cat-unit', w: '120px', ph: 'mm' })}</div><div>${button('Add this detail', { variant: 'default' })}</div></div>
${note('Every derailleur — already in stock or added later — gets these details. Saving removes [Detail] from [n] products.')}`, `${button('Cancel', { variant: 'default' })}${button('Save')}`, 660);

// ---------- Decision 3: a product's page (audit M6, M7, L3) ----------
// The page is titled with the product. Left: stock first, then details, then
// price and cost (no cost for Staff, M5). Right: history, each line a link.
let SITES = false;
// UX walk-through 3 H1 (option 1): booking in holds what a job is waiting
// for, shown beside In stock until the pad is used on the job or the job is
// cancelled.
const heldLine = `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 44px; font-size: 15px"><span style="display: inline-flex; align-items: center; gap: 6px; color: ${C.warnInk}; font-weight: 600">${icon('workshop', 16)}1 held for job WH-1042</span><a href="#" aria-label="Open job WH-1042" style="${linkStyle}">Open the job</a></div>`;
// UX walk-through 3 L3: one line saying what the shop's stock value includes.
const valueLine = note('Stock value includes stock held for customers. Stock on its way between shops counts at the shop it’s going to.');
const summary = ({ codes, kind = 'part' }) => `<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">
${card(`<div style="padding: 16px 18px; display: flex; gap: 14px; align-items: center"><div role="img" aria-label="Photo" style="width: 72px; height: 72px; flex-shrink: 0; border-radius: 8px; border: 1px dashed ${C.border}; background: ${C.mutedBg}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${C.muted}">[Photo]</div><div style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><span style="font-size: 13px; color: ${C.muted}">${codes}</span>${STAFF ? '' : `<div>${button('Edit', { variant: 'default' })}</div>`}</div></div>`, 'flex-shrink: 0')}
${box('In stock', `${SITES ? `${kv('Bolton', mono('[n]'))}${kv('[Second site]', mono('[n]'))}${kv('On its way to [Second site]', mono('[n]'))}` : kv('Bolton', mono('[n]'))}${kind === 'part' ? heldLine : ''}${kv('Low-stock level', mono(SITES ? '[n] each' : '[n]'))}${SITES ? valueLine : ''}
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px">${button('Adjust stock', { variant: 'default' })}${button('Send to another shop', { variant: 'default' })}</div>`)}
${box('Details · [Category]', `${kv('[Detail]', '[value] [unit]')}${kv('[Detail]', '[value] [unit]')}`, STAFF ? '' : linkBtn('Edit', 'Edit details'))}
${box(STAFF ? 'Price' : 'Price and cost', STAFF ? `${kv('Price', mono(kind === 'part' ? '£28.00' : '£[price]'))}${kv('VAT', '[VAT rate]')}` : `${kv('Price', mono(kind === 'part' ? '£28.00' : '£[price]'))}${kv('Cost', mono('£[cost]'))}${kv('Margin', '[n]%')}${kv('VAT', '[VAT rate]')}${kv('Show on website', 'On · as [Category]')}`)}
</div>`;
const histRow = (what, detail, change, who) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr auto' : 'minmax(0, 1fr) 72px'}; gap: 12px; align-items: center; min-height: 56px; box-sizing: border-box; padding: 6px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 0; min-width: 0">${what}<span style="font-size: 13px; color: ${C.muted}">${detail} · ${who} · [date and time]</span></span><span style="text-align: right">${mono(change, 'font-size: 15px; font-weight: 700')}</span></div>`;
const hLink = (t, label) => `<a href="#" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; min-height: 32px; font-size: 15px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const hText = (t) => `<span style="display: inline-flex; align-items: center; min-height: 32px; font-size: 15px; font-weight: 600">${t}</span>`;
const HIST = ['Everything', 'Sold', 'Received', 'Counted and adjusted', 'Price changes'];
const history = (rows) => box('Stock history', `${radios('Show', HIST, 0, false)}<div role="list">${rows.join('')}</div>`);
const PADS_HIST = [
  histRow(hLink('Used on job WH-1042', 'Open job WH-1042'), 'Maya Patel · Trek Domane AL 3', '−1', 'Alex Morgan'),
  histRow(hLink('Sold · sale B1-[0000]', 'Open sale B1-[0000]'), 'Till B1', '−[n]', 'Jo Taylor'),
  histRow(hText('Price changed · £28.00 → £[price]'), 'With 2 other products from [Supplier]', '', 'Jack Lewis'),
  histRow(hLink('Received · delivery from [Supplier]', 'Open the delivery from [Supplier]'), 'Booked in at Bolton', '+[n]', 'Jack Lewis'),
  histRow(hText('Adjusted · Damaged'), 'Note: [note]', '−[n]', 'Jo Taylor'),
  histRow(hLink('Counted · stock take of [Category]', 'Open the stock take of [Category]'), 'Counted [n], expected [n] · counted by Jo Taylor', '±[n]', 'applied by Jack Lewis'),
];
const frameRow = (frame, state, sub) => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">Frame ${mono(frame)}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${state}</div>`;
const productPage = (name, two, who = MANAGER) => pageIn('stock', name, `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 380px) minmax(0, 1fr)'}; gap: 14px; align-items: start">${two}</div>`, who, backTo('Stock', 'st-list-desktop.dc.html'));
const productBoard = () => productPage(PADS, `${summary({ codes: 'B05S-RX · [Category] · [Supplier] · barcode [barcode]' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${history(PADS_HIST)}</div>`);
const productStaff = () => asStaff(() => productPage(PADS, `${summary({ codes: 'B05S-RX · [Category] · [Supplier] · barcode [barcode]' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${history(PADS_HIST.filter((_, i) => i !== 2))}</div>`, JO));
const bikeBoard = () => productPage(TREK, `${summary({ codes: '[Category] · [Supplier] · barcode [barcode]', kind: 'bike' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">
${box('Bikes by frame number', `<div role="list">${frameRow('[frame number]', tag('In stock', 'grey'), 'Booked in [date] from [Supplier]')}${frameRow('[frame number]', tag('Held', 'warn'), `Held for <a href="#" style="color: ${C.ink}">[Customer]</a> until [date] · Cycle to Work — not for sale`)}${frameRow('[frame number]', tag('Sold'), `Sold to <a href="#" style="color: ${C.ink}">[Customer]</a> · [date] · warranty to [date]`)}</div>`)}
${history([histRow(hLink('Sold · sale B1-[0000]', 'Open sale B1-[0000]'), 'Till B1 · frame [frame number] · to [Customer]', '−1', 'Jo Taylor'), histRow(hLink('Received · delivery from [Supplier]', 'Open the delivery from [Supplier]'), '3 frame numbers', '+3', 'Jack Lewis')])}</div>`);
// Decision 4: one product, a grid. Audit M14: the size below zero is
// size M in Colour 1 everywhere.
const SIZES_ = ['S', 'M', 'L', 'XL'];
const GRID = [['[n]', '−1', '[n]', '[n]'], ['[n]', '[n]', '0', '[n]']];
const cell = (v, size, colour) => { const zero = v === '0'; const below = v.startsWith('−'); return `<td style="padding: 0; border-top: 1px solid ${C.border}"><a href="#" aria-label="${esc(colour)}, size ${size}: ${zero ? 'none in stock' : below ? `${v}, below zero` : `${v} in stock`}" style="display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 52px; text-decoration: none; color: ${below ? C.warnInk : zero ? C.muted : C.ink}; background: ${below ? C.warnBg : 'transparent'}; font-family: ${MONO}; font-size: 15px; font-weight: 700">${below ? icon('alert', 13) : ''}${v}</a></td>`; };
const sizeGrid = () => box('Sizes and colours', `<table style="width: 100%; border-collapse: collapse; table-layout: fixed"><caption style="${visuallyHidden}">Stock by size and colour</caption><thead><tr><th scope="col" style="text-align: left; padding: 6px 0; font-size: 13px; color: ${C.muted}">Colour</th>${SIZES_.map((z) => `<th scope="col" style="padding: 6px 0; font-size: 13px; color: ${C.muted}">${z}</th>`).join('')}</tr></thead><tbody>${GRID.map((r, i) => `<tr><th scope="row" style="text-align: left; padding: 0; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 600">[Colour ${i + 1}]</th>${r.map((v, j) => cell(v, SIZES_[j], `[Colour ${i + 1}]`)).join('')}</tr>`).join('')}</tbody></table>
${note('Each size and colour has its own barcode. Open one to see its history or adjust it. 0 means none in stock; a size below zero needs counting.')}`, linkBtn('+ Add a size or colour'));
const sizesBoard = () => productPage('[Product with sizes]', `${summary({ codes: '[Category] · [Supplier] · [n] sizes · [n] colours', kind: 'sizes' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${sizeGrid()}${history([histRow(hLink('Sold · sale B1-[0000]', 'Open sale B1-[0000]'), 'Size M · [Colour 1] · Till B1', '−1', 'Jo Taylor'), histRow(hLink('Received · delivery from [Supplier]', 'Open the delivery from [Supplier]'), '4 sizes', '+[n]', 'Jack Lewis')])}</div>`);

// ---------- Decision 7: change prices in bulk (audit M1, L2) ----------
const SUP_ROWS = [
  { name: PADS, sub: 'B05S-RX · [Category] · [Supplier]', stock: '[n]', price: '£28.00', margin: '[n]%', ticked: true },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', price: '£[price]', margin: '[n]%', ticked: true },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%', ticked: true },
];
const tickedBoard = () => listBoard({ query: '[Supplier]', rows: SUP_ROWS, n: '3', summary: `${mono('3')} products from [Supplier]`, bar: tickedBar(3) });
const pRow = (name, sub, was, now, m1, m2, below = false) => `<tr><th scope="row" style="text-align: left; padding: 10px 0; border-top: 1px solid ${C.border}; font-weight: 600; font-size: 15px">${name}<span style="display: block; font-size: 13px; font-weight: 400; color: ${C.muted}">${sub}</span></th><td style="padding: 10px 0; border-top: 1px solid ${C.border}; font-family: ${MONO}; text-align: right; color: ${C.muted}">${was}</td><td style="padding: 10px 0; border-top: 1px solid ${C.border}; text-align: right"><span style="display: inline-flex; align-items: center; gap: 8px">${below ? tag('Below cost', 'warn') : ''}${mono(now, 'font-weight: 700')}</span></td><td style="padding: 10px 0; border-top: 1px solid ${C.border}; text-align: right; font-size: 14px; color: ${C.muted}">${m1} → <strong style="color: ${C.ink}">${m2}</strong></td></tr>`;
// Phone: each product stacks, so Now, New and Margin each get a line.
const pItem = (name, sub, was, now, m1, m2, below = false) => `<li style="display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="font-weight: 600; font-size: 15px">${name}<span style="display: block; font-size: 13px; font-weight: 400; color: ${C.muted}">${sub}</span></span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px"><span style="color: ${C.muted}">Now ${mono(was)}</span><span aria-hidden="true" style="color: ${C.muted}">→</span><span>New ${mono(now, 'font-weight: 700')}</span>${below ? tag('Below cost', 'warn') : ''}</span><span style="font-size: 14px; color: ${C.muted}">Margin ${m1} → <strong style="color: ${C.ink}">${m2}</strong></span></li>`;
const pList = () => `<ul aria-label="Prices before and after" style="list-style: none; margin: 0; padding: 0">${pItem(PADS, 'B05S-RX', '£28.00', '£[price]', '[n]%', '[n]%')}${pItem('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '[n]%')}${pItem('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '−[n]%', true)}</ul>`;
const pricesPopup = () => popup('pr-title', 'Change prices', '3 products from [Supplier]', `
${radios('How', ['A new price for each', 'Up or down by a percentage', 'A target margin'], 1, false)}
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><label style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600">Change by ${input('Percentage change', '+[n]', { w: '90px', monoFont: true })} %</label>${radios('Prices end in', ['Leave as they are', '.99', '.00'], 1)}</div>
${isPhone() ? pList() : `<table style="width: 100%; border-collapse: collapse"><caption style="${visuallyHidden}">Prices before and after</caption><thead><tr><th scope="col" style="text-align: left; font-size: 13px; color: ${C.muted}; padding-bottom: 6px">Product</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">Now</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">New</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">Margin</th></tr></thead><tbody>${pRow(PADS, 'B05S-RX', '£28.00', '£[price]', '[n]%', '[n]%')}${pRow('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '[n]%')}${pRow('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '−[n]%', true)}</tbody></table>`}
${note('Nothing changes until you press Change. You can undo it straight after; each change goes into the product’s history.')}`, `${button('Cancel', { variant: 'default' })}${button('Change 3 prices')}`, 760);
const pricesDone = () => listBoard({ query: '[Supplier]', rows: SUP_ROWS.map((r) => ({ ...r, ticked: false, price: '£[price]' })), n: '3', summary: `${mono('3')} products from [Supplier]`, after: toast('Prices changed · 3 products') });

// ---------- Decision 6: anyone adjusts, with a reason (audit H2, M4) ----------
// The change and the count after it are joined: type either. No reason is
// picked until someone picks one; the reasons follow the sign.
// UX walk-through 3 L2: "Returned to supplier" becomes "Faulty — to return
// to supplier", which puts the item on the delivery's To return list.
const ADJ_REASONS = ['Damaged', 'Lost or stolen', 'Used in the workshop', 'Faulty — to return to supplier', 'Other'];
const FAULTY = 3;
// UX walk-through 3 L4: the greyed Adjust says why, linked to the button.
const adjustBtn = (on) => on ? button('Adjust') : `<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px">${button('Adjust').replace('<button', '<button aria-disabled="true" aria-describedby="adj-why"').replace('style="', 'style="opacity: 0.45; ')}<span id="adj-why" style="font-size: 13px; color: ${C.muted}">Pick a reason to adjust</span></span>`;
const adjustPopup = (reason = -1) => popup('adj-title', 'Adjust stock', `${PADS} · B05S-RX · at Bolton · ${mono('[n]')} in stock now`, `
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'auto auto'}; gap: 16px; align-items: end; justify-content: start"><div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Change</span>${qty('−1', 'Change in stock')}</div><div style="display: flex; flex-direction: column; gap: 6px"><label for="adj-after" style="font-size: 14px; font-weight: 600">In stock after</label>${input('In stock after', '[n]', { id: 'adj-after', w: '100px', monoFont: true })}</div></div>
${radios('Reason', ADJ_REASONS, reason)}
<div style="display: flex; flex-direction: column; gap: 6px"><label for="adj-note" style="font-size: 14px; font-weight: 600">Note (needed for Other)</label>${input('Note', '', { id: 'adj-note' })}</div>
${reason === FAULTY ? `<p style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px; line-height: 1.5">${icon('inbox', 16)}<span>Takes it out of stock and puts it on <strong>To return to [Supplier]</strong> in Deliveries and orders. Pressing “Returned” there records it as sent back.</span></p>` : note('“Faulty — to return to supplier” puts it on that supplier’s To return list in Deliveries and orders.')}
${note('Going up instead? The reasons become Found and Other. It goes into the stock history with your name; big changes show on the manager’s Today.')}`, `<span style="align-self: flex-start">${button('Cancel', { variant: 'default' })}</span>${adjustBtn(reason >= 0)}`, 620);
const adjustSetting = () => settingsPage('stock', 'Stockroom', STOCK_INTRO, stockFolds({ adjust: `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><label for="adj-over" style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Show on Today when an adjustment is worth more than</span><span style="font-size: 13px; color: ${C.muted}">At cost · for owners and managers</span></label>${input('Amount', '£[amount]', { id: 'adj-over', w: '120px', monoFont: true })}</div>
${note('Every adjustment is in its product’s stock history, whatever its value.')}` }));

// ---------- Decision 8: send, then receive (audit M13) ----------
const sitesBoard = () => { SITES = true; try { return productPage(PADS, `${summary({ codes: 'B05S-RX · [Category] · [Supplier] · barcode [barcode]' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${history([histRow(hLink('Sent to [Second site] · transfer T-[0000]', 'Open transfer T-[0000]'), 'On its way', '−[n]', 'Jack Lewis'), ...PADS_HIST.slice(0, 2)])}</div>`); } finally { SITES = false; } };
// UX walk-through 7 M5: with two shops the To choice is a line, not a
// choice; a scan box, as on a delivery, adds products quickly (a new shop's
// first stock is many lines). The same pop-up opens from Deliveries and
// orders, and from the new shop's checklist, with [Second site] chosen.
const sendPopup = () => popup('tr-title', 'Send to [Second site]', 'From Bolton', `
<p style="margin: 0; font-size: 15px"><span style="font-weight: 600">To</span> [Second site]</p>
${PH}<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input class="st-ph" type="search" aria-label="Scan or search to add" placeholder="Scan or search to add" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
<div role="list">${line(PADS, 'B05S-RX · Bolton has [n]', qty('[n]', `How many ${PADS} to send`))}</div>
${note('The stock leaves Bolton now and shows as on its way. You can cancel while it’s on its way; [Second site] scans it in when it arrives, and anything missing is flagged to both shops.')}`, `${button('Cancel', { variant: 'default' })}${button('Send')}`, 600);
const deliveriesPage = (content) => pageIn('deliveries', 'Deliveries and orders', content);
const incomingBoard = () => deliveriesPage(`${box('A delivery arrived?', `${note('Scan each item as it comes out of the box. Works with or without an order.')}<div>${button('Receive a delivery', { variant: 'default' })}</div>`)}
${box('On its way from another shop', `<div role="list">${line('From [Second site] · [n] items', 'Transfer T-[0000] · sent [date] by [name]', `${tag('On its way', 'grey')}${button('Receive it').replace('<button', '<button aria-label="Receive transfer T-[0000] from [Second site]"')}`)}</div>`)}
${box('On its way to other shops', `<div role="list">${line('To [Second site] · [n] items', 'Transfer T-[0000] · sent [date] by Jack Lewis', `${tag('On its way', 'grey')}${linkBtn('Cancel this send', 'Cancel transfer T-[0000] to [Second site]')}`)}</div>${note('Cancelling brings the stock back to Bolton; both histories say so.')}`, button('Send to [Second site]', { variant: 'default' }) /* UX walk-through 7 M5: the send opens from here too */)}`);
// UX walk-through 3 M9: receiving a transfer uses the delivery's list — a
// typed count between − and +, "Problem?" (Damaged, Missing), the scan
// announced, and the job flag, which sets "Part arrived" when booked in.
// Drawn as Staff, since everyone can receive. L1: "1 missing", as a delivery.
const waitingLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('workshop', 18)}</span>`;
const alertLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('alert', 18)}</span>`;
const withProblem = (name, right) => `<span style="display: inline-flex; align-items: center; gap: 8px">${right}${linkBtn('Problem?', `Problem with ${name}`)}</span>`;
const receiveTransfer = () => pageIn('deliveries', 'Receive transfer T-[0000]', box('From [Second site] · sent [date]', `${PH}<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input class="st-ph" type="search" aria-label="Scan each item" placeholder="Scan each item" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">Added ${PADS} · 1 — job WH-1042 is waiting for 1</p>
<div role="list">${line(PADS, `B05S-RX · sent [n] · <strong style="color: ${C.warnInk}">Job WH-1042 is waiting for 1</strong>`, withProblem(PADS, qty('[n]', PADS)), waitingLead)}${line('[Product]', `[Supplier code] · sent [n] · <strong style="color: ${C.warnInk}">Missing · 1</strong>`, withProblem('[Product]', qty('[n]', '[Product]')), alertLead)}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">${mono('[n]')} items to book in · 1 missing — [Second site] will be told</span>${button('Book in [n] items')}</div>
${note('Booking in tells job WH-1042 its part has arrived.')}`), JO, backTo('Deliveries and orders', 'tr-incoming-desktop.dc.html'));
// UX walk-through 3 M9: "Problem?" on a transfer line — Damaged or Missing.
const TR_PROBLEM = {
  Damaged: 'Damaged items aren’t added to stock.',
  Missing: 'Missing items are flagged to both shops.',
};
const transferProblem = (kind = 'Damaged') => popup('tp-title', 'Something wrong?', `[Product] · [Supplier code] · sent [n]`, `
<div role="group" aria-label="What’s wrong" style="display: flex; flex-wrap: wrap; gap: 8px">${Object.keys(TR_PROBLEM).map((t) => pillBtn(t, t === kind)).join('')}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="font-size: 15px; font-weight: 600">How many</span>${qty('1', `How many ${kind.toLowerCase()}`)}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="tp-note" style="font-size: 14px; font-weight: 600">Note (optional)</label>${input('Note', '', { id: 'tp-note' })}</div>
${note(TR_PROBLEM[kind])}`, `${button('Cancel', { variant: 'default' })}${button(`Mark as ${kind.toLowerCase()}`)}`, 560);

// ---------- Decision 5: a stock take, counted blind (audit H1, M2, M3, M16) ----------
const takePage = (title, content, who = MANAGER, back = '') => page('stocktake', title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 960px">${back}${content}</div>`, who);
const takeHub = (staff = false) => takePage('Stock take', `${staff ? '' : box('Count stock', `${note('Count the whole shop, a category or an area. Staff join on their phones; the shop stays open.')}<div>${button('Start a count')}</div>`)}
${box('Counts in progress', `<div role="list">${line('[Area]', `Started [time] by Jack Lewis · ${mono('[n]')} items counted · Jo Taylor and Alex Morgan counting`, `${tag('Counting', 'grey')}${staff ? button('Join', { variant: 'default' }).replace('<button', '<button aria-label="Join the count of [Area]"') : link('Open', 'Open the count of [Area]')}`)}${staff ? '' : line('[Category]', 'Started [time] by Jack Lewis · everyone has finished', `${tag('Ready to check', 'grey')}${link('Check it', 'Check the count of [Category]')}`)}</div>`)}
${staff ? note('Starting a count, and checking and applying it, are for managers.') : box('Finished counts', `<div role="list">${line('Whole shop', `Applied [date] by Jack Lewis · ${mono('[n]')} products changed · £[value] under, at cost`, link('Open', 'Open the whole-shop count from [date]'))}</div>`)}`, staff ? JO : MANAGER);
// UX walk-through 3 H2 (option 1): every movement during the count is allowed
// for, not just sales, and held stock is left out of "Expected".
// UX walk-through 5 M2: a bike held for a Cycle to Work order stays on the
// shop floor, so it's expected on the shelf and counted.
const startPopup = (kind = 'area') => popup('tk-title', 'Start a count', 'Staff can join it from Stock take on any device', `
${radios('What to count', ['Whole shop', 'A category', 'An area', 'Below zero'], kind === 'category' ? 1 : 2, false)}
${kind === 'category' ? `${comboBox('tk-cat', 'Which category', 'Drivetrain › Derailleurs')}${note('Everything in this category — and nothing else — is compared.')}` : `<div style="display: flex; flex-direction: column; gap: 6px"><label for="tk-area" style="font-size: 14px; font-weight: 600">Which area</label>${input('Which area', '[Area]', { id: 'tk-area' })}<div role="listbox" aria-label="Areas used before" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px"><span style="font-size: 13px; color: ${C.muted}">Used before:</span>${['[Area]', '[Area]'].map((t) => `<span role="option" aria-selected="false" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600">${t}</span>`).join('')}</div></div>${note('Only what’s scanned in this area is compared — products nobody scans are left as they are.')}`}
${note('Counters don’t see what Wheelhouse expects, so they count what’s really there. Anything sold, booked in, used on a job, sent or adjusted during the count is allowed for, and stock held for online orders or jobs isn’t expected on the shelf. Bikes held for Cycle to Work orders are expected on the shelf and counted.')}`, `${button('Cancel', { variant: 'default' })}${button('Start the count')}`, 600);
const countBoard = (below = false) => takePage(below ? 'Counting: below zero' : 'Counting [Area]', box(below ? 'Find and scan these' : 'Scan what’s here', `${PH}<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input class="st-ph" type="search" aria-label="Scan each item, or type to find it" placeholder="Scan each item, or type to find it" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
${below ? `<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Still to find · ${mono('[n]')}</h3><div role="list">${line('[Product with sizes]', 'Size M · [Colour 1]', tag('Not found yet', 'grey'))}${line('[Product]', '[Supplier code]', tag('Not found yet', 'grey'))}</div><h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Counted</h3>` : `<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">Added ${PADS} · 1</p>`}
<div role="list">${below ? line('[Product]', '[Supplier code]', qty('[n]', 'Count of [Product]')) : `${line('[Product]', `[Supplier code] · <strong style="color: ${C.ink}">Recount asked by Jack Lewis</strong>`, qty('', 'Count of [Product]'))}${line(PADS, 'B05S-RX', qty('[n]', `Count of ${PADS}`))}${line('[Product with sizes]', 'Size M · [Colour 1]', qty('[n]', 'Count of [Product with sizes], size M'))}`}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">${mono('[n]')} items counted by you${below ? '' : ' · Alex Morgan is counting too'}</span>${button('I’ve finished my part')}</div>
${note(below ? 'Started from Today by Jack Lewis. Staff can join from Stock take. Numbers aren’t shown — count what you find.' : 'Count what’s on the shelf. Anything sold, booked in, used or sent while you count is allowed for.')}`), below ? MANAGER : JO, backTo('Stock take', 'tk-hub-desktop.dc.html'));
const DIFF_COLS = () => (isPhone() ? '1fr auto' : 'minmax(0, 2fr) 90px minmax(0, 1.2fr) minmax(0, 1.1fr) auto');
const diffRow = (name, sub, expected, counted, diff, value, tone, by = '', recount = false) => `<div role="row" style="display: grid; grid-template-columns: ${DIFF_COLS()}; gap: 12px; align-items: center; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span role="cell" style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${isPhone() ? '' : `<span role="cell" style="font-family: ${MONO}; font-size: 15px">${expected}</span><span role="cell" style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: ${MONO}; font-size: 15px">${counted}</span>${by ? `<span style="font-size: 12px; color: ${C.muted}">${by}</span>` : ''}</span>`}<span role="cell">${recount ? tag('Recount asked', 'grey') : tag(`${diff} · ${value}`, tone)}</span>${isPhone() ? '' : `<span role="cell">${recount ? '' : linkBtn('Recount', `Ask for ${name} to be recounted`)}</span>`}</div>`;
// UX walk-through 3 H2: held stock is named under the product and left out
// of Expected; each kind of movement during the count gets its own line.
// UX walk-through 3 M7 (walk-through decision 6): stock written off is reported at cost.
const diffBoard = () => takePage('Check the count of [Category]', `${box('[Category] · counted [date]', `<p style="margin: 0; font-size: 15px">${mono('[n]')} products counted · ${mono('[n]')} match · ${mono('[n]')} differ · <strong>£[value] under, at cost</strong>, in all</p>
<div role="table" aria-label="Differences, largest value first">${isPhone() ? '' : `<div role="row" style="display: grid; grid-template-columns: ${DIFF_COLS()}; gap: 12px; font-size: 13px; font-weight: 700; color: ${C.muted}"><span role="columnheader">Product</span><span role="columnheader">Expected</span><span role="columnheader">Counted</span><span role="columnheader" aria-sort="descending">Difference</span><span style="width: 76px"></span></div>`}
${diffRow('[Product with sizes]', 'Size M · [Colour 1] · was below zero', '−1', '[n]', '[n] over', '£[value]', 'grey')}${diffRow(PADS, `B05S-RX<br>[n] held: order [order number] at [Shelf name] · job WH-1042 — not expected on the shelf<br>[n] sold during the count, allowed for<br>[n] booked in during the count, allowed for`, '[n]', '[n]', '[n] under', '£[value]', 'warn', 'Jo Taylor [n] + Alex Morgan [n]')}${diffRow('[Product]', '[Supplier code]', '[n]', '', '', '', 'grey', '', true)}</div>
<details style="border-top: 1px solid ${C.border}; padding-top: 8px"><summary style="display: flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: 600; cursor: pointer">Not counted · ${mono('[n]')} products · expected ${mono('[n]')} in all</summary></details>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${note('Products nobody scanned are left as they are.')}${button('Count them as none', { variant: 'default' })}</div>
${note('Expected leaves out stock held for online orders and jobs. Bikes held for Cycle to Work orders are expected on the shelf and counted. Anything sold, booked in, used on a job, sent or adjusted during the count is allowed for.')}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; color: ${C.muted}">Products that match aren’t listed. Recount sends a line back to the counters.</span>${button('Apply to [n] products')}</div>`)}`, MANAGER, backTo('Stock take', 'tk-hub-desktop.dc.html'));
const appliedBoard = () => takePage('Stock take', `${toast('Count applied · [Category] · [n] products corrected')}
${box('Count applied', `<p style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}[Category] · stock corrected for ${mono('[n]')} products</p>
${note('Each change is in its product’s stock history as “Counted”, with who counted and who applied it. Products that were below zero are now corrected; products nobody scanned were left as they are.')}
<div style="display: flex; gap: 8px">${button('Download the count', { variant: 'default' })}</div>`)}`);

def('st-list', () => listBoard());
def('st-list-staff', () => asStaff(() => listBoard({ who: JO })));
def('st-search-measure', () => listBoard({ query: 'bearing 30 mm', rows: ROWS_MEASURE, n: '2', summary: `${mono('2')} bearings with 30 mm` }));
def('st-filter-bearings', () => bearingsBoard());
def('st-filter-derailleurs', () => derailleursBoard());
def('st-search-size', () => sizeSearchBoard());
def('st-list-none', () => noneBoard());
def('st-list-unknown', () => unknownBoard());
def('st-list-new', () => newShopBoard());
def('st-categories', () => categoriesBoard());
def('st-category-edit', () => overlay(categoriesBoard(), categoryEdit()));
def('st-product', () => productBoard());
def('st-product-staff', () => productStaff());
def('st-product-bike', () => bikeBoard());
def('st-product-sizes', () => sizesBoard());
def('st-list-ticked', () => tickedBoard());
def('st-prices', () => overlay(tickedBoard(), pricesPopup()));
def('st-prices-done', () => pricesDone());
def('st-adjust', () => overlay(productBoard(), adjustPopup()));
def('st-adjust-faulty', () => overlay(productBoard(), adjustPopup(FAULTY))); // UX walk-through 3 L2
def('st-today-adjust', () => today({ adjusted: true }));
def('st-setting-adjust', () => adjustSetting());
def('st-today-below', () => today({ below: true }));
def('tk-count-below', () => countBoard(true));
def('tr-sites', () => sitesBoard());
def('tr-send', () => overlay(sitesBoard(), sendPopup()));
def('tr-incoming', () => incomingBoard());
def('tr-receive', () => receiveTransfer());
def('tr-problem', () => overlay(receiveTransfer(), transferProblem('Missing'))); // UX walk-through 3 M9
def('tr-today-short', () => today({ transferShort: true }));
def('tk-hub', () => takeHub());
def('tk-hub-staff', () => takeHub(true));
def('tk-start', () => overlay(takeHub(), startPopup()));
def('tk-start-category', () => overlay(takeHub(), startPopup('category')));
def('tk-count', () => countBoard());
def('tk-diff', () => diffBoard());
def('tk-applied', () => appliedBoard());

// All three sizes (desktop approved after the UI audit, decision 12).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'st-list': 'Stockroom › Stock: search, filters, tick boxes, every product',
  'st-list-staff': 'Stock as Staff see it: no cost or margin',
  'st-search-measure': 'Searching by a measurement: “bearing 30 mm”',
  'st-filter-bearings': 'A category picked: bearings, its details as columns',
  'st-filter-derailleurs': 'A category picked: derailleurs, number of gears',
  'st-search-size': 'Searching a size: that size and colour',
  'st-list-none': 'Nothing matches the search',
  'st-list-unknown': 'A barcode Wheelhouse doesn’t know',
  'st-list-new': 'A new shop: no products yet',
  'st-categories': 'Settings › Stockroom › Categories: each with its own details',
  'st-category-edit': 'Editing a category: Derailleurs, its choices and units',
  'st-product': 'A product’s page: stock first, history with links',
  'st-product-staff': 'A product’s page as Staff see it',
  'st-product-bike': 'A bike’s page: each frame number, in stock or sold',
  'st-product-sizes': 'Sizes and colours: one product, a grid of stock',
  'st-list-ticked': 'Ticked products: labels, send, change prices',
  'st-prices': 'Change prices: by a percentage, rounded, with a preview',
  'st-prices-done': 'Prices changed, with Undo',
  'st-adjust': 'Adjust stock: the change or the count after it, and a reason',
  'st-adjust-faulty': 'Adjust stock: faulty, onto the supplier’s To return list', // UX walk-through 3 L2
  'st-today-adjust': 'Today: a big adjustment, for the manager',
  'st-setting-adjust': 'Settings › Stockroom: when an adjustment shows on Today',
  'st-today-below': 'Today: products below zero, with Count them',
  'tk-count-below': 'Counting the products below zero: still to find',
  'tr-sites': 'A product’s stock at each shop, and on its way',
  'tr-send': 'Send to [Second site]: scan or search to add', // UX walk-through 7 M5
  'tr-incoming': 'Deliveries and orders: on its way, in and out',
  'tr-receive': 'Receiving a transfer, as Staff: typed counts, Problem?, the job flag', // UX walk-through 3 M9
  'tr-problem': 'A transfer line marked missing', // UX walk-through 3 M9
  'tr-today-short': 'Today: a transfer arrived with 1 missing',
  'tk-hub': 'Stockroom › Stock take: counts in progress and finished',
  'tk-hub-staff': 'Stock take as Staff see it: join a count',
  'tk-start': 'Start a count: an area, with areas used before',
  'tk-start-category': 'Start a count: a category',
  'tk-count': 'Counting, without the expected number; a recount asked',
  'tk-diff': 'Check the count: held stock left out, every movement allowed for', // UX walk-through 3 H2
  'tk-applied': 'Count applied, with Undo',
};
// UX walk-through 3: new boards slotted beside the ones they follow.
export const ROWS = [
  { label: 'Finding stock', screens: ['st-list', 'st-list-staff', 'st-search-measure', 'st-filter-bearings', 'st-filter-derailleurs', 'st-search-size', 'st-list-none', 'st-list-unknown', 'st-list-new'] },
  { label: 'Categories and their details', screens: ['st-categories', 'st-category-edit'] },
  { label: 'A product', screens: ['st-product', 'st-product-staff', 'st-product-bike', 'st-product-sizes'] },
  { label: 'Changing prices', screens: ['st-list-ticked', 'st-prices', 'st-prices-done'] },
  { label: 'Correcting stock', screens: ['st-adjust', 'st-adjust-faulty', 'st-today-adjust', 'st-setting-adjust', 'st-today-below', 'tk-count-below'] },
  { label: 'Between shops', screens: ['tr-sites', 'tr-send', 'tr-incoming', 'tr-receive', 'tr-problem', 'tr-today-short'] },
  { label: 'Stock take', screens: ['tk-hub', 'tk-hub-staff', 'tk-start', 'tk-start-category', 'tk-count', 'tk-diff', 'tk-applied'] },
];
