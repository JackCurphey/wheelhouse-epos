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
import { page, note, popup, overlay, withSize, isPhone, MANAGER, settingsPage, stockFolds, STOCK_INTRO } from './settings-frame.mjs';
import { today } from './opening.mjs';

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
let TICKS = false;
const COLS = () => (isPhone() ? `${TICKS ? '44px ' : ''}1fr auto` : `${TICKS ? '44px ' : ''}minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.8fr) 24px`);
const tickBox = (label, on) => `<label style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px"><input type="checkbox" ${on ? 'checked ' : ''}aria-label="${esc(label)}" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"></label>`;
const head = () => (isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; padding: 0 16px 6px; font-size: 13px; font-weight: 700; color: ${C.muted}">${TICKS ? '<span></span>' : ''}<span>Product</span><span>In stock</span><span style="text-align: right">Price</span><span style="text-align: right">Margin</span><span></span></div>`);
// A row is one link to the product's page; status in words, not colour alone.
const row = ({ name, sub, stock, state = '', price, margin, ticked = false }) => `<${TICKS ? 'div' : 'a href="#"'} role="listitem" style="display: grid; grid-template-columns: ${COLS()}; gap: 12px; align-items: center; min-height: 60px; box-sizing: border-box; padding: 8px 16px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${TICKS ? tickBox(`Tick ${name}`, ticked) : ''}
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${TICKS ? `<a href="#" style="color: ${C.ink}">${name}</a>` : name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}${isPhone() ? ` · ${price}` : ''}</span></span>
<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; ${isPhone() ? 'justify-content: flex-end' : ''}"><span style="${visuallyHidden}">In stock: </span>${mono(stock, 'font-size: 15px')}${state === 'low' ? tag('Running low', 'grey') : state === 'below' ? tag('Below zero', 'warn') : ''}</span>
${isPhone() ? '' : `<span style="text-align: right; font-size: 15px"><span style="${visuallyHidden}">Price: </span>${mono(price)}</span><span style="text-align: right; font-size: 15px; color: ${C.muted}"><span style="${visuallyHidden}">Margin: </span>${margin}</span><span aria-hidden="true" style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span>`}</${TICKS ? 'div' : 'a'}>`;
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
const listBoard = ({ query = '', rows = ROWS_ALL, summary = `${mono('[n]')} products`, bar = '' } = {}) => stockPage('Stock', `<div style="display: flex; flex-direction: column; gap: 12px; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px"><div style="flex-grow: 1; min-width: 0">${searchBox(query)}</div>${isPhone() ? '' : button('+ Add a product', { variant: 'default' })}</div>
${filters(0)}
<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">${summary}</p>${bar}</div>
${card(`${isPhone() ? '' : `<div style="padding-top: 12px">${head()}</div>`}<div role="list">${rows.map(row).join('')}</div>`, 'overflow: hidden; flex-shrink: 0')}`);

// ---------- Decision 3: a product's page ----------
// Left, the summary; right, one history (the customer page's shape).
const box = (title, body, action = '') => card(`<div style="padding: ${isPhone() ? '14px' : '16px 18px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 10px"><h2 style="margin: 0; font-size: 16px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`, 'flex-shrink: 0');
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; min-height: 32px; align-items: center; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span>${v}</span></div>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const back = `<a href="st-list-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Stock</a>`;
let SITES = false;
const summary = ({ name, codes, price, kind = 'part' }) => `<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">
${card(`<div style="padding: 16px 18px; display: flex; gap: 14px; align-items: flex-start"><div role="img" aria-label="Photo of ${esc(name)}" style="width: 88px; height: 88px; flex-shrink: 0; border-radius: 8px; border: 1px dashed ${C.border}; background: ${C.mutedBg}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${C.muted}">[Photo]</div><div style="display: flex; flex-direction: column; gap: 4px; min-width: 0"><h2 style="margin: 0; font-size: 20px; font-weight: 700">${name}</h2><span style="font-size: 13px; color: ${C.muted}">${codes}</span><div style="display: flex; gap: 8px; padding-top: 6px">${button('Edit', { variant: 'default' })}${button('Adjust stock', { variant: 'default' })}</div></div></div>`, 'flex-shrink: 0')}
${box('Price', `${kv('Price', mono(price))}${kv('Cost', mono('£[cost]'))}${kv('Margin', '[n]%')}${kv('VAT', '[VAT rate]')}`)}
${box('In stock', SITES ? `${kv('Bolton', mono('[n]'))}${kv('[Site 2]', mono('[n]'))}${kv('On its way to [Site 2]', mono('[n]'))}${kv('Low-stock level', mono('[n] each'))}` : `${kv('Bolton', `${mono('[n]')}`)}${kv('Low-stock level', mono('[n]'))}`, SITES ? linkBtn('Send to another shop') : '')}
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

// ---------- Decision 5: a stock take, counted blind ----------
const JO = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const takePage = (title, content, who = MANAGER) => page('stocktake', title, `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 960px">${content}</div>`, who);
const line = (left, sub, right = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap">${t}</a>`;
const takeHub = () => takePage('Stock take', `${box('Count stock', `${note('Count the whole shop, a category or an area. Staff join on their phones; the shop stays open.')}<div>${button('Start a count')}</div>`)}
${box('Counts in progress', `<div role="list">${line('[Area]', `Started [time] by Jack Lewis · ${mono('[n]')} items counted · Jo Taylor and Alex Morgan counting`, `${tag('Counting', 'grey')}${link('Open', 'Open the count of [Area]')}`)}${line('[Category]', `Started [time] by Jack Lewis · everyone has finished`, `${tag('Ready to check')}${link('Check it', 'Check the count of [Category]')}`)}</div>`)}
${box('Finished counts', `<div role="list">${line('Whole shop', `Applied [date] by Jack Lewis · ${mono('[n]')} products changed · £[value] under`, link('Open', 'Open the whole-shop count from [date]'))}</div>`)}`);
const AREAS_ = (below) => [['Whole shop', false], ['A category', false], ['An area', !below], ['Below zero', below]];
const startPopup = (below = false) => popup('tk-title', 'Start a count', 'Staff can join it from Stock take on any device', `
<div role="group" aria-label="What to count" style="display: flex; flex-wrap: wrap; gap: 8px">${AREAS_(below).map(([t, on]) => pillBtn(t, on)).join('')}</div>
${below ? `<p style="margin: 0; font-size: 15px">${mono('[n]')} products below zero, including [Product with sizes], size M · [Colour 1]</p>` : `<div style="display: flex; flex-direction: column; gap: 6px"><label for="tk-area" style="font-size: 14px; font-weight: 600">Which area</label><input id="tk-area" value="[Area]" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>`}
${note('Counters don’t see what Wheelhouse expects, so they count what’s really there. Sales during the count are allowed for.')}`, `${button('Cancel', { variant: 'default' })}${button('Start the count')}`, 560);
const qty = (n, label) => `<span role="group" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; flex-shrink: 0"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><input inputmode="numeric" aria-label="How many" value="${n}" style="width: 52px; height: 44px; box-sizing: border-box; border: 0; border-left: 1px solid ${C.border}; border-right: 1px solid ${C.border}; background: #ffffff; text-align: center; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">+</button></span>`;
const countBoard = () => takePage('Counting [Area]', `${box('Counting [Area]', `${searchBox().replace(/Name, barcode, supplier code — or a measurement, like “bearing 30 mm”/g, 'Scan each item, or type to find it').replace('Search stock: name, barcode, supplier code or a measurement', 'Scan each item, or type to find it')}
<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">Added ${PADS} · 1</p>
<div role="list">${line(PADS, 'B05S-RX', qty('[n]', `Count of ${PADS}`))}${line('[Product]', '[Supplier code]', qty('[n]', 'Count of [Product]'))}${line('[Product with sizes]', 'Size M · [Colour 1]', qty('[n]', 'Count of [Product with sizes], size M'))}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">${mono('[n]')} items counted by you · Alex Morgan is counting too</span>${button('I’ve finished my part')}</div>
${note('Count what’s on the shelf. Anything sold while you count is allowed for.')}`)}`, JO);
const diffRow = (name, sub, expected, counted, diff, value, tone) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr auto' : 'minmax(0, 2fr) 90px 90px minmax(0, 1.1fr) auto'}; gap: 12px; align-items: center; min-height: 56px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${isPhone() ? '' : `<span style="font-family: ${MONO}; font-size: 15px"><span style="${visuallyHidden}">Expected: </span>${expected}</span><span style="font-family: ${MONO}; font-size: 15px"><span style="${visuallyHidden}">Counted: </span>${counted}</span>`}<span>${tag(`${diff} · ${value}`, tone)}</span>${isPhone() ? '' : link('Recount', `Ask for ${name} to be recounted`)}</div>`;
const diffBoard = () => takePage('Check the count', `${box('[Category] · counted [date]', `<p style="margin: 0; font-size: 15px">${mono('[n]')} products counted · ${mono('[n]')} match · ${mono('[n]')} differ · <strong>£[value] under</strong> in all</p>
${isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: minmax(0, 2fr) 90px 90px minmax(0, 1.1fr) auto; gap: 12px; font-size: 13px; font-weight: 700; color: ${C.muted}"><span>Product</span><span>Expected</span><span>Counted</span><span>Difference</span><span style="width: 66px"></span></div>`}
<div role="list">${diffRow(PADS, 'B05S-RX · 1 sold during the count, allowed for', '[n]', '[n]', '2 under', '£[value]', 'warn')}${diffRow('[Product]', '[Supplier code]', '[n]', '[n]', '1 over', '£[value]', 'grey')}${diffRow('[Product with sizes]', 'Size M · [Colour 1] · was below zero', '−1', '[n]', '[n] over', '£[value]', 'grey')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px"><span style="font-size: 14px; color: ${C.muted}">Products that match aren’t listed. Recount sends a line back to the counters.</span><span style="display: flex; gap: 8px">${button('Apply the count')}</span></div>`)}`);
const appliedBoard = () => takePage('Stock take', `${box('Count applied', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}[Category] · stock corrected for ${mono('[n]')} products</p>
${note('Each change is in its product’s stock history as “Counted”, with who counted and who applied it. Products that were below zero are now corrected.')}
<div style="display: flex; gap: 8px">${button('Download the count', { variant: 'default' })}${button('Back to Stock take', { variant: 'default' })}</div>`)}`);

// ---------- Decision 6: anyone adjusts, with a reason ----------
const REASONS = ['Damaged', 'Lost or stolen', 'Found', 'Used in the workshop', 'Returned to supplier', 'Other'];
const adjustPopup = () => popup('adj-title', 'Adjust stock', `${PADS} · B05S-RX · Bolton`, `
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Change</span><span style="font-size: 13px; color: ${C.muted}">In stock now ${mono('[n]')} · after ${mono('[n]')}</span></span>${qty('−1', 'Change in stock')}</div>
<div role="group" aria-label="Reason" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${REASONS.map((t, i) => pillBtn(t, i === 0)).join('')}</div></div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="adj-note" style="font-size: 14px; font-weight: 600">Note (optional)</label><input id="adj-note" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>
${note('Goes into the stock history with your name. Big changes show on the manager’s Today.')}`, `${button('Cancel', { variant: 'default' })}${button('Adjust')}`, 600);
const adjustSetting = () => settingsPage('stock', 'Stockroom', STOCK_INTRO, stockFolds({ adjust: `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><label for="adj-over" style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Show on Today when an adjustment is worth more than</span><span style="font-size: 13px; color: ${C.muted}">At cost · for owners and managers</span></label><input id="adj-over" value="£[amount]" style="width: 120px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></div>
${note('Every adjustment is in its product’s stock history, whatever its value.')}` }));

// ---------- Decision 7: change prices in bulk, with a preview ----------
const SUP_ROWS = [
  { name: PADS, sub: 'B05S-RX · [Category] · [Supplier]', stock: '[n]', price: '£28.00', margin: '[n]%', ticked: true },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', price: '£[price]', margin: '[n]%', ticked: true },
  { name: '[Product]', sub: '[Supplier code] · [Category] · [Supplier]', stock: '[n]', state: 'low', price: '£[price]', margin: '[n]%', ticked: true },
];
const tickedBoard = () => { TICKS = true; try { return listBoard({ query: '[Supplier]', rows: SUP_ROWS, summary: `${mono('3')} products from [Supplier]`, bar: `<div role="region" aria-label="Ticked products" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border-radius: 10px; background: ${C.ink}; color: ${C.panel}"><span style="font-size: 15px; font-weight: 700; flex-grow: 1">3 ticked</span><button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.panel}; text-decoration: underline">Untick all</button>${button('Print labels', { variant: 'default' })}${button('Change prices', { variant: 'default' })}</div>` }); } finally { TICKS = false; } };
const METHODS = [['A new price', false], ['Up or down by a percentage', true], ['A target margin', false]];
const ENDINGS = [['No rounding', false], ['.99', true], ['.00', false]];
const pRow = (name, sub, was, now, m1, m2) => `<tr><th scope="row" style="text-align: left; padding: 10px 0; border-top: 1px solid ${C.border}; font-weight: 600; font-size: 15px">${name}<span style="display: block; font-size: 13px; font-weight: 400; color: ${C.muted}">${sub}</span></th><td style="padding: 10px 0; border-top: 1px solid ${C.border}; font-family: ${MONO}; text-align: right; color: ${C.muted}">${was}</td><td style="padding: 10px 0; border-top: 1px solid ${C.border}; font-family: ${MONO}; text-align: right; font-weight: 700">${now}</td><td style="padding: 10px 0; border-top: 1px solid ${C.border}; text-align: right; font-size: 14px; color: ${C.muted}">${m1} → <strong style="color: ${C.ink}">${m2}</strong></td></tr>`;
const pricesPopup = () => popup('pr-title', 'Change prices', '3 products from [Supplier]', `
<div role="group" aria-label="How" style="display: flex; flex-wrap: wrap; gap: 8px">${METHODS.map(([t, on]) => pillBtn(t, on)).join('')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><label style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600">Change by <input value="+[n]" aria-label="Percentage change" style="width: 90px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"> %</label><div role="group" aria-label="Round to" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 600">Round to</span>${ENDINGS.map(([t, on]) => pillBtn(t, on)).join('')}</div></div>
<table style="width: 100%; border-collapse: collapse"><caption style="${visuallyHidden}">Prices before and after</caption><thead><tr><th scope="col" style="text-align: left; font-size: 13px; color: ${C.muted}; padding-bottom: 6px">Product</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">Now</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">New</th><th scope="col" style="text-align: right; font-size: 13px; color: ${C.muted}">Margin</th></tr></thead><tbody>${pRow(PADS, 'B05S-RX', '£28.00', '£[price]', '[n]%', '[n]%')}${pRow('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '[n]%')}${pRow('[Product]', '[Supplier code]', '£[price]', '£[price]', '[n]%', '[n]%')}</tbody></table>
${note('Nothing changes until you press Change. Each change goes into the product’s history; the till and website use the new price straight away.')}`, `${button('Cancel', { variant: 'default' })}${button('Change 3 prices')}`, 720);

// ---------- Decision 8: send, then receive ----------
const sitesBoard = () => { SITES = true; try { return productPage(`${summary({ name: PADS, codes: 'B05S-RX · [Category] · [Supplier] · barcode [barcode]', price: '£28.00' })}<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">${history([histRow('Sent to [Site 2]', 'On its way · transfer T-[0000]', '−[n]', 'Jack Lewis'), ...PADS_HIST.slice(0, 3)])}</div>`); } finally { SITES = false; } };
const sendPopup = () => popup('tr-title', 'Send to another shop', 'From Bolton', `
<div role="group" aria-label="To" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 600; margin-right: 4px">To</span>${pillBtn('[Site 2]', true)}${pillBtn('[Site 3]', false)}</div>
<div role="list">${line(PADS, 'B05S-RX · Bolton has [n]', qty('[n]', `How many ${PADS} to send`))}</div>${linkBtn('+ Add another product')}
${note('The stock leaves Bolton now and shows as on its way. [Site 2] scans it in when it arrives; anything missing is flagged to both shops.')}`, `${button('Cancel', { variant: 'default' })}${button('Send')}`, 600);
const incomingBoard = () => page('deliveries', 'Deliveries and orders', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 960px">
${box('A delivery arrived?', `${note('Scan each item as it comes out of the box. Works with or without an order.')}<div>${button('Receive a delivery', { variant: 'default' })}</div>`)}
${box('On its way from another shop', `<div role="list">${line('From [Site 2] · [n] items', 'Transfer T-[0000] · sent [date] by [name]', `${tag('On its way', 'grey')}${button('Receive it')}`)}</div>${note('Scan the items in as you would a delivery. Anything that doesn’t arrive is flagged here and at [Site 2].')}`)}
</div>`, MANAGER);

def('st-list', () => listBoard());
def('st-product', () => productBoard());
def('st-product-bike', () => bikeBoard());
def('st-product-sizes', () => sizesBoard());
def('tk-hub', () => takeHub());
def('tk-start', () => overlay(takeHub(), startPopup()));
def('tk-count', () => countBoard());
def('tk-diff', () => diffBoard());
def('tk-applied', () => appliedBoard());
def('st-adjust', () => withSize(SIZE, () => overlay(productBoard(), adjustPopup())));
def('st-today-adjust', () => today({ adjusted: true }));
def('st-setting-adjust', () => adjustSetting());
def('st-list-ticked', () => tickedBoard());
def('st-prices', () => overlay(tickedBoard(), pricesPopup()));
def('tr-sites', () => sitesBoard());
def('tr-send', () => overlay(sitesBoard(), sendPopup()));
def('tr-incoming', () => incomingBoard());
def('st-today-below', () => today({ below: true }));
def('tk-start-below', () => overlay(takeHub(), startPopup(true)));
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
  'st-list-ticked': 'Ticking products in the stock list',
  'st-prices': 'Change prices: by a percentage, rounded, with a preview',
  'st-adjust': 'Adjust stock: the change and a reason',
  'st-today-adjust': 'Today: a big adjustment, for the manager',
  'st-setting-adjust': 'Settings › Stockroom: when an adjustment shows on Today',
  'tr-sites': 'A product’s stock at each shop, and on its way',
  'tr-send': 'Send to another shop',
  'tr-incoming': 'Deliveries and orders: on its way from another shop',
  'st-today-below': 'Today: products below zero, with Count them',
  'tk-start-below': 'A quick count of just the products below zero',
  'tk-hub': 'Stockroom › Stock take: counts in progress and finished',
  'tk-start': 'Start a count: the whole shop, a category or an area',
  'tk-count': 'Counting, without the expected number',
  'tk-diff': 'Check the count: over and under, with value',
  'tk-applied': 'Count applied: every change recorded',
};
export const ROWS = [
  { label: 'Finding stock', screens: ['st-list', 'st-search-measure'] },
  { label: 'A product', screens: ['st-product', 'st-product-bike', 'st-product-sizes'] },
  { label: 'Changing prices', screens: ['st-list-ticked', 'st-prices'] },
  { label: 'Correcting stock', screens: ['st-adjust', 'st-today-adjust', 'st-setting-adjust', 'st-today-below', 'tk-start-below'] },
  { label: 'Between shops', screens: ['tr-sites', 'tr-send', 'tr-incoming'] },
  { label: 'Stock take', screens: ['tk-hub', 'tk-start', 'tk-count', 'tk-diff', 'tk-applied'] },
];
