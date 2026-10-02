// Journey 1 — Find the shop and browse the website, in Soft sand on its own
// canvas. Decisions: docs/decisions/2026-10-02-find-the-shop-review.md
//
// Decision 1: the home page is sections the shop arranges (the arranging is
// journey 18). 2: category pages with filters made from each category's own
// details. 3: a product page with photos, size and colour, specifications
// and the description. 4: one search box for products, categories, repairs
// and pages, with suggestions as you type. 5: an Our shops page and a page
// for each shop ("Find us" with one shop). 6: only necessary cookies unless
// the shop adds a tracking tool, then a choice with equal Reject and Accept;
// "page not found" and "switched off" look the same to the public.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Shimano brake pads B05S-RX (£28.00), the stockroom's categories (Bearings
// with inner diameter, outer diameter and height; Drivetrain › Derailleurs
// with number of gears), the diary's services (Standard service £65.00,
// Fit & adjust brakes £18.00, Brake service), sizes S, M, L, XL. Everything
// else is a bracketed placeholder.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { note, popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const sr = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
let SIZE = 'desktop';
const PADS = { name: 'Shimano brake pads', code: 'B05S-RX', price: '£28.00' };

// ---------- The website frame (App map 15) ----------
// active: the header link lit. oneShop: decision 5's "Find us". The footer
// gains "Cookies" (decision 6).
const site = (content, { active = 'Shop', oneShop = false, overlayHtml = '', scroll = 0, cookieLink = false } = {}) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: ${scroll ? 'hidden' : 'auto'}; display: flex; flex-direction: column; gap: 22px"><div style="display: flex; flex-direction: column; gap: 22px${scroll ? `; position: relative; top: -${scroll}px` : ''}">${content}</div></div>`;
  let html = SIZE === 'desktop' ? siteDesktop('sand', active, body) : SIZE === 'tablet' ? siteTablet('sand', body, active) : sitePhone('sand', { content: body });
  if (oneShop) html = html.replace(/>Our shops</g, '>Find us<');
  html = html.replace('<a href="#" style="color: inherit">Privacy</a>', `<a href="#" style="color: inherit">Privacy</a><a href="#" style="color: inherit">${cookieLink ? 'Cookie choices' : 'Cookies'}</a>`);
  if (overlayHtml) html = html.replace(/<main style="/, '<main style="position: relative; ').replace('</main>', `${overlayHtml}</main>`);
  return html;
};
const h1 = (t, size = 30) => `<h1 style="margin: 0; font-size: ${isPhone() ? 24 : size}px; font-weight: 700">${t}</h1>`;
const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 22}px; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const section = (title, inner, id, more = '') => `<section aria-labelledby="${id}" style="flex-shrink: 0; display: flex; flex-direction: column; gap: 14px"><div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">${h2(title, id)}${more}</div>${inner}</section>`;
const photo = (label, h = 160, extra = '') => `<div role="img" aria-label="${esc(label)}" style="width: 100%; height: ${h}px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 10px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 14px; text-align: center; ${extra}">[${label}]</div>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const grid = (items, cols) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? Math.min(cols, 2) : cols}, minmax(0, 1fr)); gap: ${isPhone() ? 12 : 18}px">${items.join('')}</div>`;
const stockLine = (t, tone = 'ok') => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${tone === 'ok' ? C.successInk : C.muted}">${icon(tone === 'ok' ? 'check' : 'store', 14)}${t}</span>`;
// A product card: the whole card is one link (fewest clicks).
const productCard = (name, price, stock = stockLine('In stock at Bolton'), sub = '') => `<a href="#" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: ${C.ink}">${photo(`Photo of ${name}`, isPhone() ? 120 : 170)}<span style="font-size: 15px; font-weight: 600; line-height: 1.35">${name}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}${mono(price, 'font-size: 15px; font-weight: 700')}${stock}</a>`;
const catCard = (name, sub) => `<a href="#" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: ${C.ink}">${photo(`Photo for ${name}`, isPhone() ? 100 : 140)}<span style="font-size: 16px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</a>`;
const crumbs = (...parts) => `<nav aria-label="You are here" style="font-size: 14px; color: ${C.muted}">${parts.map((p, i) => (i < parts.length - 1 ? `<a href="#" style="color: inherit">${p}</a> › ` : `<span aria-current="page">${p}</span>`)).join('')}</nav>`;
const SERVICES = [['Standard service', '£65.00'], ['Fit &amp; adjust brakes', '£18.00'], ['Brake service', '[£ price]']];

// ---------- The home page: sections (decision 1) ----------
// The starting page a new shop gets; each section is one the shop can add,
// remove and reorder in Website management (journey 18).
const hero = () => `<section aria-label="Welcome" style="flex-shrink: 0; position: relative; border-radius: 14px; overflow: hidden">${photo('Big photo of the shop', isPhone() ? 260 : 330, 'border-radius: 14px; align-items: flex-start; justify-content: flex-end; padding: 14px 18px')}<div style="position: absolute; left: ${isPhone() ? 16 : 40}px; bottom: ${isPhone() ? 16 : 36}px; right: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; max-width: 560px; padding: 18px 20px; border-radius: 12px; background: ${C.panel}"><span style="font-size: ${isPhone() ? 22 : 30}px; font-weight: 700; line-height: 1.2">[Headline]</span><span style="font-size: 16px; line-height: 1.5">[A line about the shop]</span><span style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair')}${button('Shop', { variant: 'default' })}</span></div></section>`;
const featuredCats = () => section('Shop by category', grid([catCard('Bearings', '[n] products'), catCard('Drivetrain', 'Derailleurs and [n] more'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products')], 4), 'h-cats', link('All categories'));
const featuredProducts = () => section('[Featured products]', grid([productCard(`${PADS.name} ${PADS.code}`, PADS.price), productCard('[Product]', '£[price]'), productCard('[Product]', '£[price]'), productCard('[Product]', '£[price]', stockLine('Ready at Bolton in [n] days', 'grey'))], 4), 'h-prods');
const repairs = () => box(`<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)'}; gap: 20px; align-items: center"><div style="display: flex; flex-direction: column; gap: 10px">${h2('Book a repair', 'h-rep')}<p style="margin: 0; font-size: 15px; line-height: 1.5">[The shop’s words about its workshop]</p>${button('Book a repair')}</div><ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column">${SERVICES.map(([n, p]) => `<li style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span>${n}</span>${mono(p)}</li>`).join('')}</ul></div>`);
const shopsSection = () => section('Our shops', grid([shopCard('Bolton', true), shopCard('[Second site]', false)], 2), 'h-shops');
const words = () => box(`<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 360px'}; gap: 20px; align-items: center"><div style="display: flex; flex-direction: column; gap: 10px">${h2('[A heading]', 'h-words')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s own words — about the shop, the team, a club ride]</p></div>${photo('A photo the shop adds', 200)}</div>`);
const home = (opts = {}) => site(`${hero()}${featuredCats()}${featuredProducts()}${repairs()}${shopsSection()}${words()}`, { active: '', ...opts });

// ---------- Categories (decision 2) ----------
const allCats = () => site(`${crumbs('Shop')}${h1('Shop')}${grid([catCard('Bearings', '[n] products'), catCard('Drivetrain', 'Derailleurs and [n] more'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products')], 4)}`);
// Filters come from the category's own details (Stock control 10).
const check = (t, on = false, n = '[n]') => `<label style="display: flex; align-items: center; gap: 10px; min-height: 40px; font-size: 15px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="flex-grow: 1">${t}</span><span style="font-size: 13px; color: ${C.muted}">${n}</span></label>`;
const filterGroup = (title, items) => `<fieldset style="margin: 0; padding: 12px 0 0; border: 0; border-top: 1px solid ${C.border}"><legend style="padding: 0; font-size: 15px; font-weight: 700">${title}</legend>${items.join('')}</fieldset>`;
const filters = (groups) => `<aside aria-label="Filters" style="display: flex; flex-direction: column; gap: 12px">${groups.join('')}</aside>`;
const BEARING_FILTERS = (on = false) => [
  filterGroup('Availability', [check('In stock at Bolton', true)]),
  filterGroup('Inner diameter', [check('[n] mm', on), check('[n] mm'), check('[n] mm'), `<button type="button" style="min-height: 40px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; text-decoration: underline; color: ${C.ink}">Show [n] more</button>`]),
  filterGroup('Outer diameter', [check('[n] mm'), check('[n] mm')]),
  filterGroup('Height', [check('[n] mm'), check('[n] mm')]),
  filterGroup('Brand', [check('[Brand]'), check('[Brand]')]),
  filterGroup('Price', [`<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">${field('From', { placeholder: '£' })}${field('To', { placeholder: '£' })}</div>`]),
];
const sortBox = () => `<label style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px">Sort by<select style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>Most popular</option></select></label>`;
const chips = (list) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${list.map((t) => `<button type="button" aria-label="Remove filter ${esc(t)}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid ${C.ink}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${t}${icon('close', 14)}</button>`).join('')}<button type="button" style="min-height: 36px; padding: 0 6px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; text-decoration: underline; color: ${C.ink}">Clear all</button></div>`;
const listing = ({ title, crumb, count, groups, cards, chipList = [], sub = '', empty = false }) => {
  const top = `${crumbs(...crumb)}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px"><div style="display: flex; flex-direction: column; gap: 4px">${h1(title)}${sub}<span aria-live="polite" style="font-size: 14px; color: ${C.muted}">${count}</span></div><div style="display: flex; gap: 10px; align-items: center">${isPhone() ? button('Filter', { variant: 'default' }) : ''}${sortBox()}</div></div>${chipList.length ? chips(chipList) : ''}`;
  const results = empty ? box(`<p style="margin: 0; font-size: 16px; font-weight: 700">No [category] match all of these.</p><p style="margin: 0; font-size: 15px">Try removing a filter, or ask us — we may be able to order it in.</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Clear all filters')}${button('Ask the shop', { variant: 'default' })}</div>`) : grid(cards, 3);
  return site(`${top}${isPhone() ? results : `<div style="display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; align-items: start">${filters(groups)}${results}</div>`}`);
};
const bearingCards = () => [productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm'), productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm'), productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm'), productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm'), productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm'), productCard('[Bearing]', '£[price]', stockLine('In stock at Bolton'), '[n] × [n] × [n] mm')];
const bearings = () => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: '[n] products', groups: BEARING_FILTERS(), cards: bearingCards() });
const bearingsFiltered = () => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: '[n] products match', groups: BEARING_FILTERS(true), cards: bearingCards().slice(0, 3), chipList: ['Inner diameter: [n] mm', 'In stock at Bolton'] });
const bearingsEmpty = () => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: 'Nothing matches', groups: BEARING_FILTERS(true), cards: [], chipList: ['Inner diameter: [n] mm', 'Height: [n] mm', 'In stock at Bolton'], empty: true });
// A parent category: its own subcategories first, then products.
const drivetrain = () => listing({ title: 'Drivetrain', crumb: ['Shop', 'Drivetrain'], count: '[n] products', sub: `<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 6px">${['Derailleurs', '[Category]', '[Category]'].map((c) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${c}</a>`).join('')}</div>`, groups: [filterGroup('Availability', [check('In stock at Bolton', true)]), filterGroup('Number of gears', [check('[n]'), check('[n]'), check('[n]')]), filterGroup('Brand', [check('[Brand]'), check('[Brand]')])], cards: [productCard('[Derailleur]', '£[price]', stockLine('In stock at Bolton'), '[n] gears'), productCard('[Derailleur]', '£[price]', stockLine('Ready at Bolton in [n] days', 'grey'), '[n] gears'), productCard('[Product]', '£[price]')] });

// ---------- A product (decision 3; journey 2's buying part) ----------
const thumbs = () => `<div style="display: flex; gap: 8px">${[1, 2, 3, 4].map((n) => `<button type="button" aria-label="Photo ${n} of 4"${n === 1 ? ' aria-current="true"' : ''} style="width: 64px; height: 64px; padding: 0; border-radius: 8px; border: ${n === 1 ? `2px solid ${C.ink}` : `1px dashed ${C.input}`}; background: ${C.mutedBg}"></button>`).join('')}</div>`;
const gallery = (name) => `<div style="display: flex; flex-direction: column; gap: 10px">${photo(`Photo 1 of 4 — ${name}`, isPhone() ? 260 : 380)}${thumbs()}</div>`;
const specs = (rows) => `<table style="width: 100%; border-collapse: collapse; font-size: 15px"><caption style="text-align: left; padding-bottom: 8px; font-size: 17px; font-weight: 700">Specifications</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row" style="text-align: left; padding: 9px 0; border-top: 1px solid ${C.border}; font-weight: 400; color: ${C.muted}; width: 45%">${k}</th><td style="padding: 9px 0; border-top: 1px solid ${C.border}">${v}</td></tr>`).join('')}</tbody></table>`;
const qty = (name) => `<div role="group" aria-label="Quantity of ${esc(name)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span style="min-width: 40px; text-align: center; font-size: 16px; font-weight: 700">1</span><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; color: ${C.ink}">${icon('plus', 16)}</button></div>`;
const ready = (t) => `<p style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px">${icon('check', 18)}<span>${t}</span></p>`;
const swatch = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}"><span aria-hidden="true" style="width: 18px; height: 18px; border-radius: 999px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></span>${t}</button>`;
const sizeBtn = (t, on, out) => `<button type="button" role="radio" aria-checked="${on}"${out ? ` aria-disabled="true" aria-describedby="sz-out"` : ''} style="min-width: 56px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : out ? C.border : C.input}; background: ${out ? C.mutedBg : C.panel}; font-family: inherit; font-size: 15px; font-weight: 600; color: ${out ? C.muted : C.ink}; ${out ? 'text-decoration: line-through; ' : ''}">${t}${out ? sr(' — out of stock at Bolton') : ''}</button>`;
const productPage = ({ sizes = false } = {}) => {
  const name = sizes ? '[Product with sizes]' : `${PADS.name} ${mono(PADS.code)}`;
  const plain = sizes ? '[Product with sizes]' : `${PADS.name} ${PADS.code}`;
  const choose = sizes ? `<div role="radiogroup" aria-label="Colour" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Colour: [Colour 1]</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${swatch('[Colour 1]', true)}${swatch('[Colour 2]', false)}</div></div>
<div role="radiogroup" aria-label="Size" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Size</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${sizeBtn('S', false, false)}${sizeBtn('M', false, true)}${sizeBtn('L', true, false)}${sizeBtn('XL', false, false)}</div><span id="sz-out" style="font-size: 13px; color: ${C.ink}">M is out of stock at Bolton in [Colour 1].</span></div>` : '';
  const info = `<div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">${crumbs('Shop', sizes ? '[Category]' : '[Category]', plain)}<div style="display: flex; flex-direction: column; gap: 6px">${h1(name)}<span style="font-size: 24px; font-weight: 700">${mono(sizes ? '£[price]' : PADS.price)}</span><span style="font-size: 13px; color: ${C.muted}">Includes VAT · [Brand]</span></div>${choose}${ready(sizes ? '<strong>Ready today at Bolton</strong> · size L in [Colour 1]' : '<strong>Ready today at Bolton</strong> · [n] in stock')}<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">${qty(plain)}${button('Add to basket')}</div>${link('Ask the shop about this')}</div>`;
  const lower = `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)'}; gap: 28px; align-items: start"><section aria-labelledby="p-about" style="display: flex; flex-direction: column; gap: 10px">${h2('About it', 'p-about')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s description]</p></section>${specs(sizes ? [['Sizes', 'S, M, L, XL'], ['Colours', '[Colour 1], [Colour 2]'], ['[Detail]', '[value]'], ['Brand', '[Brand]']] : [['Supplier code', mono(PADS.code)], ['[Detail]', '[value] [unit]'], ['[Detail]', '[value] [unit]'], ['Brand', '[Brand]']])}</div>`;
  return site(`${isPhone() ? `${gallery(plain)}${info}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start">${gallery(plain)}${info}</div>`}${lower}`);
};
const photoOpen = () => overlay(productPage(), `<div role="dialog" aria-modal="true" aria-label="Photos of ${PADS.name}" style="width: ${isPhone() ? '100%' : '900px'}; height: ${isPhone() ? '100%' : '640px'}; box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; gap: 12px; border-radius: ${isPhone() ? 0 : 12}px; background: ${C.panel}"><div style="display: flex; justify-content: space-between; align-items: center"><span style="font-size: 15px; font-weight: 700">Photo 2 of 4</span><a href="#" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: ${C.ink}">${icon('close', 20)}</a></div><div style="flex-grow: 1; display: flex; align-items: center; gap: 12px"><button type="button" aria-label="Previous photo" style="width: 44px; height: 44px; border-radius: 999px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}">${icon('back', 18)}</button><div style="flex-grow: 1; height: 100%">${photo(`Photo 2 of 4 — ${PADS.name} ${PADS.code}`, isPhone() ? 520 : 520)}</div><button type="button" aria-label="Next photo" style="width: 44px; height: 44px; border-radius: 999px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; transform: rotate(180deg)">${icon('back', 18)}</button></div></div>`);

// ---------- Search (decision 4) ----------
const sugRow = (main, sub, right = '') => `<a href="#" role="option" style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 12px; border-radius: 8px; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${main}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</a>`;
const sugHead = (t) => `<div role="presentation" style="padding: 8px 12px 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;
const suggestions = (q) => `<div id="search-suggest" role="listbox" aria-label="Suggestions for ${esc(q)}" style="position: absolute; ${isPhone() ? 'left: 0; right: 0; top: 0' : 'right: 190px; top: -8px; width: 440px'}; z-index: 5; box-sizing: border-box; padding: 6px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 16px 40px rgba(28,30,25,0.22)">
${sugHead('Products')}${sugRow(`${PADS.name} ${mono(PADS.code)}`, 'In stock at Bolton', mono(PADS.price))}${sugRow('[Product]', 'In stock at Bolton', mono('£[price]'))}
${sugHead('Repairs')}${sugRow('Fit &amp; adjust brakes', 'Book a repair', mono('£18.00'))}${sugRow('Brake service', 'Book a repair', mono('[£ price]'))}
${sugHead('Categories')}${sugRow('[Category]', '[n] products')}
<a href="#" style="display: flex; align-items: center; min-height: 48px; padding: 0 12px; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 700; color: ${C.ink}">See all results for “${esc(q)}”</a></div>`;
const searching = (q) => home({ overlayHtml: suggestions(q) }).replace('placeholder="Search the shop"', `placeholder="Search the shop" value="${esc(q)}" role="combobox" aria-expanded="true" aria-controls="search-suggest"`);
const results = () => {
  const repairStrip = box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px"><span style="font-size: 16px; font-weight: 700; flex-grow: 1">Repairs for “brake”</span>${SERVICES.slice(1).map(([n, p]) => `<a href="#" style="display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 15px; font-weight: 600; color: ${C.ink}; text-decoration: none">${n} ${mono(p)}</a>`).join('')}</div>`);
  return listing({ title: 'Results for “brake”', crumb: ['Shop', 'Search'], count: '[n] products', groups: [filterGroup('Availability', [check('In stock at Bolton', true)]), filterGroup('Category', [check('[Category]'), check('[Category]')]), filterGroup('Price', [`<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">${field('From', { placeholder: '£' })}${field('To', { placeholder: '£' })}</div>`])], cards: [productCard(`${PADS.name} ${PADS.code}`, PADS.price), productCard('[Product]', '£[price]'), productCard('[Product]', '£[price]', stockLine('Ready at Bolton in [n] days', 'grey'))], sub: repairStrip });
};
const measure = () => listing({ title: 'Results for “bearing 30mm”', crumb: ['Shop', 'Search'], count: 'Bearings with an inner diameter of 30 mm · [n] products', groups: BEARING_FILTERS(), cards: bearingCards().slice(0, 3), chipList: ['Category: Bearings', 'Inner diameter: 30 mm'] });
const noResults = () => site(`${crumbs('Shop', 'Search')}${h1('No results for “[what they typed]”')}${box(`<p style="margin: 0; font-size: 15px; line-height: 1.6">Check the spelling, try a shorter word, or look through the categories. Can’t find it? We may be able to order it in.</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Ask the shop')}${button('Book a repair', { variant: 'default' })}</div>`)}${featuredCats()}`);

// ---------- Our shops (decision 5) ----------
function shopCard(name, today) {
  return box(`${photo(`Photo of the ${name} shop`, isPhone() ? 120 : 150)}<div style="display: flex; flex-direction: column; gap: 4px"><a href="#" style="font-size: 18px; font-weight: 700; color: ${C.ink}">${name}</a><span style="font-size: 15px">[Shop address]</span><span style="font-size: 15px">${today ? '<strong>Open today</strong> [opening hours]' : '<strong>Closed today</strong> · opens [day] [time]'}</span><a href="tel:[shop phone]" style="font-size: 15px; color: ${C.ink}">[shop phone]</a></div><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair here')}${button('Directions', { variant: 'default' }).replace('<button', `<button aria-label="Directions to ${esc(name)} (opens your maps app)"`)}</div>`);
}
const shops = () => site(`${crumbs('Our shops')}${h1('Our shops')}${grid([shopCard('Bolton', true), shopCard('[Second site]', false)], 2)}`, { active: 'Our shops' });
const HOURS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shopPage = (one = false) => site(`${crumbs(one ? 'Find us' : 'Our shops', ...(one ? [] : ['Bolton']))}${h1(one ? 'North Street Cycles' : 'North Street Cycles, Bolton')}<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 380px'}; gap: 24px; align-items: start">${photo('Photo of the Bolton shop', isPhone() ? 220 : 340)}${box(`<div style="display: flex; flex-direction: column; gap: 4px; font-size: 15px; line-height: 1.5"><strong>[Shop address]</strong><a href="tel:[shop phone]" style="color: ${C.ink}">[shop phone]</a><a href="mailto:[shop email]" style="color: ${C.ink}">[shop email]</a></div><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair here')}${button('Directions', { variant: 'default' })}</div>${link('Shop for collection from here')}`)}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'repeat(2, minmax(0, 1fr))'}; gap: 24px; align-items: start">${box(`${h2('Opening hours', 's-hours')}<table aria-labelledby="s-hours" style="border-collapse: collapse; font-size: 15px"><tbody>${HOURS.map((d, i) => `<tr${i === 3 ? ' style="font-weight: 700"' : ''}><th scope="row" style="text-align: left; padding: 7px 24px 7px 0; font-weight: inherit">${d}${i === 3 ? ' (today)' : ''}</th><td style="padding: 7px 0">${i === 6 ? 'Closed' : '[opening hours]'}</td></tr>`).join('')}</tbody></table><p style="margin: 0; font-size: 14px">Closed [holiday dates].</p>`)}${box(`${h2('[A heading]', 's-words')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s words about this shop — parking, the workshop, who works here]</p>`)}</div>`, { active: one ? 'Our shops' : 'Our shops', oneShop: one });

// ---------- When things go wrong (decision 6 note) ----------
const notFound = () => site(`<div style="max-width: 640px; display: flex; flex-direction: column; gap: 16px; padding-top: 40px">${h1('We can’t find that page')}<p style="margin: 0; font-size: 16px; line-height: 1.6">It may have moved, or the link may be wrong.</p>${field('Search the shop', { type: 'search', placeholder: 'What are you looking for?' })}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Go to the home page')}${button('Our shops', { variant: 'default' })}</div></div>`, { active: '' });
// The public sees the same plain page for an unknown address and a website
// that's switched off — it never says whether a shop exists (Shop websites spec).
const offPage = () => {
  const [W, H] = SIZE === 'phone' ? [390, 844] : SIZE === 'tablet' ? [1180, 820] : [1280, 800];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 24px; display: flex; align-items: center; justify-content: center; background: #ffffff; color: #1f2120"><main style="max-width: 480px; display: flex; flex-direction: column; gap: 12px; text-align: center"><h1 style="margin: 0; font-size: 24px; font-weight: 700">This website isn’t available</h1><p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4a4d47">Check the address, or contact the shop another way.</p></main></div>`;
};
// The shop's own staff, signed in, still see their switched-off website.
const preview = () => site(`<div role="status" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px">${icon('lock', 18)}<span style="flex-grow: 1"><strong>Only your staff can see this.</strong> Your website is switched off — customers see “This website isn’t available”.</span>${button('Turn it on', { variant: 'default' })}</div>${hero()}${featuredCats()}`, { active: '' });

// ---------- Cookies (decision 6) ----------
const banner = () => `<section role="region" aria-label="Cookie choices" style="position: absolute; left: ${isPhone() ? 0 : 40}px; right: ${isPhone() ? 0 : 40}px; bottom: ${isPhone() ? 0 : 20}px; box-sizing: border-box; padding: 18px 20px; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'stretch' : 'center'}; gap: 16px; border-radius: ${isPhone() ? 0 : 12}px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 -8px 30px rgba(28,30,25,0.18)"><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">Cookies on this website</h2><p style="margin: 0; font-size: 15px; line-height: 1.5">We use the cookies the site needs to work. With your OK, we’d also like to use [tracking tool] to see how people use the site. <a href="#" style="color: ${C.ink}">About cookies</a></p></div><div style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 3}, auto); gap: 10px">${button('Reject all', { variant: 'default' })}${button('Accept all', { variant: 'default' })}${button('Choose', { variant: 'ghost' })}</div></section>`;
const cookieRow = (t, sub, state) => `<div style="display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 14px; line-height: 1.5; color: ${C.muted}">${sub}</span></span>${state === 'always' ? `<span style="font-size: 14px; font-weight: 600; white-space: nowrap">Always on</span>` : `<button type="button" role="switch" aria-checked="false" aria-label="${esc(t)}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.muted}">Off<span aria-hidden="true" style="position: relative; display: inline-block; width: 44px; height: 26px; border-radius: 999px; background: ${C.input}"><span style="position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 999px; background: #ffffff"></span></span></button>`}</div>`;
const chooseCookies = () => popup('ck-title', 'Choose cookies', 'Change these any time from “Cookie choices” at the bottom of every page', `${cookieRow('Needed for the site to work', 'Your basket, signing in, and the shop you’ve chosen.', 'always')}${cookieRow('Measuring visits', '[Tracking tool], added by North Street Cycles, to count visits and see which pages are used.', 'off')}${cookieRow('Advertising', '[Advertising tool], added by North Street Cycles, to show you its adverts elsewhere.', 'off')}`, `${button('Reject all', { variant: 'ghost' })}${button('Save my choices')}`, 560);
const cookiesPage = () => site(`${crumbs('Cookies')}${h1('Cookies')}<div style="max-width: 760px; display: flex; flex-direction: column; gap: 18px">${box(`${h2('What this website uses', 'c-used')}<table style="border-collapse: collapse; font-size: 15px; width: 100%"><thead><tr>${['Cookie', 'What it’s for', 'How long'].map((c) => `<th scope="col" style="text-align: left; padding: 8px 8px 8px 0; font-size: 13px; color: ${C.muted}; border-bottom: 1px solid ${C.border}">${c}</th>`).join('')}</tr></thead><tbody>${[['[name]', 'Keeps your basket', '[n] days'], ['[name]', 'Keeps you signed in', '[n] days'], ['[name]', 'Remembers the shop you collect from', '[n] days']].map((r) => `<tr>${r.map((v, i) => `<td style="padding: 9px 8px 9px 0; border-bottom: 1px solid ${C.border}${i === 0 ? `; font-family: ${MONO}` : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table><p style="margin: 0; font-size: 15px">These are needed for the site to work, so they don’t need your OK.</p>`)}${box(`${h2('Tools the shop has added', 'c-tools')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[Tracking tool] — measuring visits. Only used if you say yes.</p>${button('Change cookie choices', { variant: 'default' })}`)}</div>`, { active: '', cookieLink: true });

// ---------- The boards ----------
def('wb-home', () => home());
def('wb-home-lower', () => home({ scroll: 880 }));
def('wb-shop', () => allCats());
def('wb-category', () => bearings());
def('wb-category-filtered', () => bearingsFiltered());
def('wb-category-empty', () => bearingsEmpty());
def('wb-category-parent', () => drivetrain());
def('wb-product', () => productPage());
def('wb-product-sizes', () => productPage({ sizes: true }));
def('wb-product-photos', () => photoOpen());
def('wb-search-typing', () => searching('brake'));
def('wb-search-results', () => results());
def('wb-search-measure', () => measure());
def('wb-search-none', () => noResults());
def('wb-shops', () => shops());
def('wb-shop-page', () => shopPage());
def('wb-find-us', () => shopPage(true));
def('wb-not-found', () => notFound());
def('wb-off', () => offPage());
def('wb-off-preview', () => preview());
def('wb-cookies-banner', () => home({ overlayHtml: banner() }));
def('wb-cookies-choose', () => overlay(home({ overlayHtml: banner() }), chooseCookies()));
def('wb-cookies-page', () => cookiesPage());

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'wb-home': 'Home page: the sections a new shop starts with',
  'wb-home-lower': 'Home page, further down: repairs, our shops, the shop’s own words',
  'wb-shop': 'Shop: every category',
  'wb-category': 'A category: Bearings, with filters from its details',
  'wb-category-filtered': 'Filtered: inner diameter and in stock at Bolton',
  'wb-category-empty': 'Nothing matches the filters',
  'wb-category-parent': 'A parent category: Drivetrain, with Derailleurs',
  'wb-product': 'A product: photos, specifications, description, buying',
  'wb-product-sizes': 'A product with sizes and colours: one out of stock at Bolton',
  'wb-product-photos': 'Photos, larger',
  'wb-search-typing': 'Search as you type: products, repairs, categories',
  'wb-search-results': 'Search results: products, with repairs above',
  'wb-search-measure': 'Searching by a measurement: “bearing 30mm”',
  'wb-search-none': 'No results',
  'wb-shops': 'Our shops: a card for each shop',
  'wb-shop-page': 'A shop’s own page: hours, closures, book a repair here',
  'wb-find-us': 'One shop: “Find us” goes straight to its page',
  'wb-not-found': 'Page not found',
  'wb-off': 'Switched off, or no such shop: what the public sees',
  'wb-off-preview': 'Switched off: what the shop’s own staff see',
  'wb-cookies-banner': 'A shop that added a tracking tool: the cookie choice',
  'wb-cookies-choose': 'Choose cookies',
  'wb-cookies-page': 'The Cookies page',
};
export const ROWS = [
  { label: 'The home page', screens: ['wb-home', 'wb-home-lower'] },
  { label: 'Categories', screens: ['wb-shop', 'wb-category', 'wb-category-filtered', 'wb-category-empty', 'wb-category-parent'] },
  { label: 'A product', screens: ['wb-product', 'wb-product-sizes', 'wb-product-photos'] },
  { label: 'Search', screens: ['wb-search-typing', 'wb-search-results', 'wb-search-measure', 'wb-search-none'] },
  { label: 'Our shops', screens: ['wb-shops', 'wb-shop-page', 'wb-find-us'] },
  { label: 'When things go wrong, and cookies', screens: ['wb-not-found', 'wb-off', 'wb-off-preview', 'wb-cookies-banner', 'wb-cookies-choose', 'wb-cookies-page'] },
];
