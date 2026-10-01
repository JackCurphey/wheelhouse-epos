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
  { name: '[Product with sizes]', sub: '[Category] · [n] sizes · [n] colours', stock: '[n]', price: '£[price]', margin: '[n]%' },
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

// ---------- Decision 3: a product's page ----------
// Left, the summary; right, one history (the customer page's shape).
const box = (title, body, action = '') => card(`<div style="padding: ${isPhone() ? '14px' : '16px 18px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 10px"><h2 style="margin: 0; font-size: 16px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`, 'flex-shrink: 0');
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; min-height: 32px; align-items: center; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span>${v}</span></div>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const back = `<a href="st-list-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Stock</a>`;
const summary = ({ name, codes, price, kind = 'part' }) => `<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">
${card(`<div style="padding: 16px 18px; display: flex; gap: 14px; align-items: flex-start"><div role="img" aria-label="Photo of ${esc(name)}" style="width: 88px; height: 88px; flex-shrink: 0; border-radius: 8px; border: 1px dashed ${C.border}; background: ${C.mutedBg}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${C.muted}">[Photo]</div><div style="display: flex; flex-direction: column; gap: 4px; min-width: 0"><h2 style="margin: 0; font-size: 20px; font-weight: 700">${name}</h2><span style="font-size: 13px; color: ${C.muted}">${codes}</span><div style="display: flex; gap: 8px; padding-top: 6px">${button('Edit', { variant: 'default' })}${button('Adjust stock', { variant: 'default' })}</div></div></div>`, 'flex-shrink: 0')}
${box('Price', `${kv('Price', mono(price))}${kv('Cost', mono('£[cost]'))}${kv('Margin', '[n]%')}${kv('VAT', '[VAT rate]')}`)}
${box('In stock', `${kv('Bolton', `${mono('[n]')}`)}${kv('Low-stock level', mono('[n]'))}`)}
${kind === 'part' ? box('Measurements and specifications', `${kv('[Measurement]', '[value] [unit]')}${kv('[Measurement]', '[value] [unit]')}`, linkBtn('Edit', 'Edit measurements')) : ''}
</div>`;
const histRow = (what, detail, change, who) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr auto' : 'minmax(0, 1fr) 64px'}; gap: 12px; align-items: center; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${what}</span><span style="font-size: 13px; color: ${C.muted}">${detail} · ${who} · [date and time]</span></span><span style="text-align: right">${mono(change, 'font-size: 15px; font-weight: 700')}</span></div>`;
const HIST = ['Everything', 'Sold', 'Received', 'Counted and adjusted'];
const history = (rows) => box('Stock history', `<div role="group" aria-label="Show" style="display: flex; flex-wrap: wrap; gap: 8px">${HIST.map((t, i) => pillBtn(t, i === 0)).join('')}</div><div role="list">${rows.join('')}</div>`);
const PADS_HIST = [
  histRow('Used on job WH-1042', 'Maya Patel · Trek Domane AL 3', '−1', 'Alex Morgan'),
  histRow('Sold', 'Till B1 · sale B1-[0000]', '−1', 'Jo Taylor'),
  histRow('Received', 'Delivery from [Supplier]', '+[n]', 'Jack Lewis'),
  histRow('Adjusted', 'Reason: [reason]', '−1', 'Jack Lewis'),
  histRow('Counted', 'Stock take · counted [n], expected [n]', '±[n]', 'Jo Taylor'),
];
const frameRow = (frame, state, sub) => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">Frame ${mono(frame)}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${state}</div>`;
const productPage = (two) => stockPage('Product', `${back}<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 380px) minmax(0, 1fr)'}; gap: 14px; align-items: start">${two}</div>`);
const productBoard = () => productPage(`${summary({ name: PADS, codes: 'B05S-RX · [Category] · [Supplier] · barcode [barcode]', price: '£28.00' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${history(PADS_HIST)}</div>`);
const bikeBoard = () => productPage(`${summary({ name: TREK, codes: '[Category] · [Supplier] · barcode [barcode]', price: '£[price]', kind: 'bike' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">
${box('Bikes by frame number', `<div role="list">${frameRow('[frame number]', tag('In stock', 'grey'), 'Booked in [date] from [Supplier]')}${frameRow('[frame number]', tag('In stock', 'grey'), 'Booked in [date] from [Supplier]')}${frameRow('[frame number]', tag('Sold'), `Sold to <a href="#" style="color: ${C.ink}">[Customer]</a> · [date] · warranty to [date]`)}</div>`)}
${history([histRow('Sold', 'Till B1 · frame [frame number] · to [Customer]', '−1', 'Jo Taylor'), histRow('Received', 'Delivery from [Supplier] · 3 frame numbers', '+3', 'Jack Lewis')])}</div>`);

// ---------- Decision 4: sizes and colours, one grid ----------
// Sizes across, colours down; each cell is its own stock and barcode.
const SIZES_ = ['S', 'M', 'L', 'XL'];
const GRID = [['[n]', '[n]', '0', '[n]'], ['[n]', '−1', '[n]', '[n]']];
const cell = (v, size, colour) => { const zero = v === '0'; const below = v.startsWith('−'); return `<td style="padding: 0; border-top: 1px solid ${C.border}"><a href="#" aria-label="${esc(colour)}, size ${size}: ${zero ? 'none in stock' : below ? `${v}, below zero` : `${v} in stock`}" style="display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 52px; text-decoration: none; color: ${below ? C.warnInk : zero ? C.muted : C.ink}; background: ${below ? C.warnBg : 'transparent'}; font-family: ${MONO}; font-size: 15px; font-weight: 700">${below ? icon('alert', 13) : ''}${v}</a></td>`; };
const sizeGrid = () => box('Sizes and colours', `<table style="width: 100%; border-collapse: collapse; table-layout: fixed"><caption style="${visuallyHidden}">Stock by size and colour</caption><thead><tr><th scope="col" style="text-align: left; padding: 6px 0; font-size: 13px; color: ${C.muted}">Colour</th>${SIZES_.map((z) => `<th scope="col" style="padding: 6px 0; font-size: 13px; color: ${C.muted}">${z}</th>`).join('')}</tr></thead><tbody>${GRID.map((r, i) => `<tr><th scope="row" style="text-align: left; padding: 0; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 600">[Colour ${i + 1}]</th>${r.map((v, j) => cell(v, SIZES_[j], `[Colour ${i + 1}]`)).join('')}</tr>`).join('')}</tbody></table>
${note('Each size and colour has its own barcode. Open one to see its history or adjust it. 0 means none in stock; a size below zero needs checking.')}`, linkBtn('+ Add a size or colour'));
const sizesBoard = () => productPage(`${summary({ name: '[Product with sizes]', codes: '[Category] · [Supplier] · [n] sizes · [n] colours', price: '£[price]', kind: 'sizes' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${sizeGrid()}${history([histRow('Sold', 'Size M · [Colour 1] · Till B1', '−1', 'Jo Taylor'), histRow('Received', 'Delivery from [Supplier] · 4 sizes', '+[n]', 'Jack Lewis')])}</div>`);

def('st-list', () => listBoard());
def('st-product', () => productBoard());
def('st-product-bike', () => bikeBoard());
def('st-product-sizes', () => sizesBoard());
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
  'st-product': 'A product’s page: summary left, stock history right',
  'st-product-bike': 'A bike’s page: each frame number, in stock or sold',
  'st-product-sizes': 'Sizes and colours: one product, a grid of stock',
};
export const ROWS = [
  { label: 'Finding stock', screens: ['st-list', 'st-search-measure'] },
  { label: 'A product', screens: ['st-product', 'st-product-bike', 'st-product-sizes'] },
];
