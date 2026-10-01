// Journey 14 — Stock take and stock control, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-stock-control-review.md
//
// Decision 2: Stockroom › Stock opens on a searchable list with filters —
// one search box finds products by name, barcode, supplier code or
// measurement (Owner setup, Noted for later: "bearings with a 30 mm outside
// diameter"); filter pills; each row shows stock, price and margin and opens
// the product's page. Real example data: Shimano brake pads B05S-RX £28.00;
// the Trek Domane AL 3. Every other product, price, cost, margin and count
// is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { page, note, withSize, isPhone, MANAGER } from './settings-frame.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';

// ---------- Shared pieces (as journey 13) ----------
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const pillBtn = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600; white-space: nowrap">${t}</button>`;
const visuallyHidden = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap';
const stockPage = (title, content, who = MANAGER) => page('stock', title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${content}</div>`, who);
const PADS = 'Shimano brake pads';
const TREK = 'Trek Domane AL 3';

// ---------- Decision 2: the stock list ----------
// One search box: name, barcode, supplier code or a measurement.
const searchBox = (value = '') => `<style>.st-search::placeholder { color: ${C.muted}; opacity: 1 }</style><label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 2px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input class="st-search" type="search" aria-label="Search stock: name, barcode, supplier code or a measurement" placeholder="Name, barcode, supplier code — or a measurement, like “bearing 30 mm”" value="${esc(value)}" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}">${icon('scan', 20)}</label>`;
const FILTERS = ['All', 'Running low', 'Below zero', '[Category]', '[Category]', '[Category]'];
const filters = (on = 0) => `<div role="group" aria-label="Show" style="display: flex; gap: 8px; ${isPhone() ? 'overflow-x: auto; padding-bottom: 2px' : 'flex-wrap: wrap'}">${FILTERS.map((t, i) => pillBtn(t, i === on)).join('')}</div>`;
const COLS = () => (isPhone() ? '1fr auto' : 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.8fr) 24px');
const head = () => (isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; padding: 0 16px 6px; font-size: 13px; font-weight: 700; color: ${C.muted}"><span>Product</span><span>In stock</span><span style="text-align: right">Price</span><span style="text-align: right">Margin</span><span></span></div>`);
// A row is one link to the product's page; status in words, not colour alone.
const row = ({ name, sub, stock, state = '', price, margin }) => `<a href="#" role="listitem" style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; align-items: center; min-height: 60px; box-sizing: border-box; padding: 8px 16px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}${isPhone() ? ` · ${price}` : ''}</span></span>
<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; ${isPhone() ? 'justify-content: flex-end' : ''}"><span style="${visuallyHidden}">In stock: </span>${mono(stock, 'font-size: 15px')}${state === 'low' ? tag('Running low', 'grey') : state === 'below' ? tag('Below zero', 'warn') : ''}</span>
${isPhone() ? '' : `<span style="text-align: right; font-size: 15px"><span style="${visuallyHidden}">Price: </span>${mono(price)}</span><span style="text-align: right; font-size: 15px; color: ${C.muted}"><span style="${visuallyHidden}">Margin: </span>${margin}</span><span aria-hidden="true" style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span>`}</a>`;
const ROWS_ALL = [
  { name: PADS, sub: 'B05S-RX · [Category] · [Supplier]', stock: '[n]', price: '£28.00', margin: '[n]%' },
  { name: TREK, sub: '[Category] · [n] bikes, each by frame number', stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '−[n]', state: 'below', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', price: '£[price]', margin: '[n]%' },
];
// A measurement search: the matching measurement is shown on each row, so
// it's clear why the product came up.
const ROWS_MEASURE = [
  { name: '[Bearing]', sub: `[Supplier code] · <strong style="color: ${C.ink}">Outside diameter 30 mm</strong> · inside [n] mm`, stock: '[n]', price: '£[price]', margin: '[n]%' },
  { name: '[Bearing]', sub: `[Supplier code] · <strong style="color: ${C.ink}">Outside diameter 30 mm</strong> · inside [n] mm`, stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%' },
];
const listBoard = ({ query = '', rows = ROWS_ALL, summary = `${mono('[n]')} products` } = {}) => stockPage('Stock', `<div style="display: flex; flex-direction: column; gap: 12px; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px"><div style="flex-grow: 1; min-width: 0">${searchBox(query)}</div>${isPhone() ? '' : button('+ Add a product', { variant: 'default' })}</div>
${filters(0)}
<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">${summary}</p></div>
${card(`${isPhone() ? '' : `<div style="padding-top: 12px">${head()}</div>`}<div role="list">${rows.map(row).join('')}</div>`, 'overflow: hidden; flex-shrink: 0')}`);

def('st-list', () => listBoard());
def('st-search-measure', () => listBoard({ query: 'bearing 30 mm', rows: ROWS_MEASURE, summary: `${mono('2')} products with an outside diameter of 30 mm` }));

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'st-list': 'Stockroom › Stock: search, filters, every product',
  'st-search-measure': 'Searching by a measurement: “bearing 30 mm”',
};
export const ROWS = [
  { label: 'Finding stock', screens: ['st-list', 'st-search-measure'] },
];
