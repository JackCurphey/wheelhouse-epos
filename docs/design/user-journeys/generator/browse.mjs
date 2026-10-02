// Journey 1 — Find the shop and browse the website, in Soft sand on its own
// canvas. Decisions: docs/decisions/2026-10-02-find-the-shop-review.md
// UI audit: docs/design/user-journeys/browse-ui-audit.md (decision 7: every
// recommendation taken)
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
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { note, popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const sr = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
let SIZE = 'desktop';
const PADS = { name: 'Shimano brake pads', code: 'B05S-RX', price: '£28.00' };
const tall = 'display: inline-flex; align-items: center; min-height: 44px';

// ---------- The website frame (App map 15) ----------
// The example business has two shops, so the header carries journey 2's
// "Collecting from Bolton · Change" (Buy online 8; audit H1); oneShop gives
// "Find us" and no chip. A skip link comes first (audit M15); the footer's
// links are 44px tall (M12), it says "Collection and returns" (L3) and names
// both shops (L4); "Cookie choices" joins "Cookies" when the shop has added
// a tracking tool (audit H3).
const site = (content, { active = 'Shop', oneShop = false, chosen = true, overlayHtml = '', first = '', scroll = 0, tracking = false, query = '', staffBar = '' } = {}) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: ${scroll ? 'hidden' : 'auto'}; display: flex; flex-direction: column; gap: 22px"><div style="display: flex; flex-direction: column; gap: 22px${scroll ? `; position: relative; top: -${scroll}px` : ''}">${staffBar}${!oneShop && SIZE !== 'desktop' ? chipLine(chosen) : ''}${content}</div></div>`;
  let html = SIZE === 'desktop' ? siteDesktop('sand', active, body) : SIZE === 'tablet' ? siteTablet('sand', body, active) : sitePhone('sand', { content: body });
  if (oneShop) html = html.replace(/>Our shops</g, '>Find us<');
  else if (SIZE === 'desktop') {
    const chip = `<a href="#" aria-label="${chosen ? 'Collecting from North Street Cycles, Bolton — change the shop' : 'Choose a shop to collect from'}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; max-width: 230px; padding: 0 10px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 14px; color: ${C.ink}; text-decoration: none; white-space: nowrap; overflow: hidden">${icon('store', 16)}<span style="overflow: hidden; text-overflow: ellipsis">${chosen ? 'Collecting from <strong>Bolton</strong> · Change' : '<strong>Choose a shop</strong>'}</span></a>`;
    html = html.replace(/(<label style="display: flex; align-items: center; gap: 8px; width: 240px;)/, `${chip}$1`).replace('width: 240px;', 'width: 170px;').replace('placeholder="Search the shop"', 'placeholder="Search"').replace('display: flex; align-items: center; gap: 28px;', 'display: flex; align-items: center; gap: 20px; white-space: nowrap;');
  }
  // The header search is a search area (audit H4); results keep the words (M9).
  html = html.replace(/<label style="display: flex; align-items: center; gap: 8px; width: (\d+)px;/, '<label role="search" style="display: flex; align-items: center; gap: 8px; width: $1px;');
  if (query) html = html.replace(/placeholder="Search(?: the shop)?"/, (m) => `${m} value="${esc(query)}"`);
  // The footer's Cookies link and skip link come from the shared frame
  // (app-map.mjs, decision 8); "Cookie choices" joins it with a tracking tool.
  if (tracking) html = html.replace(/(>Cookies<\/a>)(<\/span><\/footer>)/, '$1<button type="button" style="min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: inherit; color: inherit; text-decoration: underline">Cookie choices</button>$2');
  if (!oneShop) html = html.replace(/<span>North Street Cycles · Bolton<\/span>/, '<span>North Street Cycles · Bolton and [Second site]</span>');
  if (first) html = html.replace(/<main id="main-content" style="([^"]*)">/, `<main id="main-content" style="position: relative; $1">${first}`);
  if (overlayHtml) html = html.replace(/<main id="main-content" style="(?!position: relative)/, '<main id="main-content" style="position: relative; ').replace('</main>', `${overlayHtml}</main>`);
  return html;
};
const chipLine = (chosen) => `<a href="#" style="flex-shrink: 0; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 15px; color: ${C.ink}; text-decoration: none">${icon('store', 16)}<span style="flex-grow: 1">${chosen ? 'Collecting from <strong>Bolton</strong>' : '<strong>Choose a shop to collect from</strong>'}</span>${chosen ? '<span style="font-weight: 600; text-decoration: underline">Change</span>' : ''}</a>`;
const h1 = (t, size = 30) => `<h1 style="margin: 0; font-size: ${isPhone() ? 24 : size}px; font-weight: 700">${t}</h1>`;
const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 22}px; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const section = (title, inner, id, more = '') => `<section aria-labelledby="${id}" style="flex-shrink: 0; display: flex; flex-direction: column; gap: 14px"><div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">${h2(title, id)}${more}</div>${inner}</section>`;
// A photo the shop adds; with none, a plain tile carrying the name (audit M8).
const photo = (label, h = 160, extra = '') => `<div role="img" aria-label="${esc(label)}" style="width: 100%; height: ${h}px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 10px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 14px; text-align: center; ${extra}">[${label}]</div>`;
const noPhoto = (name, h) => `<div aria-hidden="true" style="width: 100%; height: ${h}px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 12px; border-radius: 10px; background: ${C.mutedBg}; color: ${C.ink}; font-size: 15px; font-weight: 600; text-align: center">${name}</div>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; font-size: 15px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const grid = (items, cols, phoneCols = Math.min(cols, 2)) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? phoneCols : cols}, minmax(0, 1fr)); gap: ${isPhone() ? 12 : 18}px">${items.join('')}</div>`;
// Audit L3: the same words as journey 2's product page.
const ready = (t = 'Ready today at Bolton', tone = 'ok') => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${tone === 'ok' ? C.successInk : C.muted}">${icon(tone === 'ok' ? 'check' : 'store', 14)}${t}</span>`;
const inDays = () => ready('Ready at Bolton in [n] days', 'grey');
const productCard = (name, price, stock = ready(), sub = '', pic = true) => `<a href="#" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: ${C.ink}">${pic ? photo(`Photo of ${name}`, isPhone() ? 120 : 170) : noPhoto(name, isPhone() ? 120 : 170)}<span style="font-size: 15px; font-weight: 600; line-height: 1.35">${name}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}${mono(price, 'font-size: 15px; font-weight: 700')}${stock}</a>`;
const catCard = (name, sub) => `<a href="#" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: ${C.ink}">${photo(`Photo for ${name}`, isPhone() ? 100 : 140)}<span style="font-size: 16px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</a>`;
// Audit L5: a one-step trail repeats the heading, so pages at the top have none.
const crumbs = (...parts) => `<nav aria-label="You are here" style="font-size: 14px; color: ${C.muted}">${parts.map((p, i) => (i < parts.length - 1 ? `<a href="#" style="color: inherit; ${tall}">${p}</a> › ` : `<span aria-current="page">${p}</span>`)).join('')}</nav>`;
const SERVICES = [['Standard service', '£65.00'], ['Fit &amp; adjust brakes', '£18.00'], ['Brake service', '[£ price]']];

// ---------- "Ask the shop" (audit H5): the shop's phone and email in place ----------
const askOpen = (both = false) => `<div role="region" aria-label="Ask the shop" style="display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 15px; line-height: 1.5"><strong>Ask the shop</strong>${(both ? ['Bolton', '[Second site]'] : ['Bolton']).map((s) => `<span>${both ? `${s}: ` : ''}Call <a href="tel:[shop phone]" style="color: ${C.ink}">[shop phone]</a> or email <a href="mailto:[shop email]" style="color: ${C.ink}">[shop email]</a></span>`).join('')}</div>`;

// ---------- Choosing the shop (Buy online 8; audit H1) ----------
const shopButton = (name) => `<button type="button" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%; min-height: 64px; padding: 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}">[Shop address] · open [opening hours]</span></button>`;
const chooseShop = () => popup('cs-title', 'Which shop will you collect from?', 'We’ll remember it, and show when things are ready there', `<div role="group" aria-labelledby="cs-title" style="display: flex; flex-direction: column; gap: 10px">${shopButton('Bolton')}${shopButton('[Second site]')}</div>`, button('Cancel', { variant: 'ghost' }), 520);

// ---------- The home page: sections (decision 1; audit M1, M3) ----------
// The hero's headline is the page's one main heading.
const hero = () => `<section aria-labelledby="hero-h" style="flex-shrink: 0; position: relative; border-radius: 14px; overflow: hidden">${photo('Big photo of the shop', isPhone() ? 260 : 330, 'border-radius: 14px; align-items: flex-start; justify-content: flex-end; padding: 14px 18px')}<div style="position: absolute; left: ${isPhone() ? 16 : 40}px; bottom: ${isPhone() ? 16 : 36}px; right: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; max-width: 560px; padding: 18px 20px; border-radius: 12px; background: ${C.panel}"><h1 id="hero-h" style="margin: 0; font-size: ${isPhone() ? 22 : 30}px; font-weight: 700; line-height: 1.2">[Headline]</h1><span style="font-size: 16px; line-height: 1.5">[A line about the shop]</span><span style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair')}${button('Shop', { variant: 'default' })}</span></div></section>`;
const featuredCats = () => section('Shop by category', grid([catCard('Bearings', '[n] products'), catCard('Drivetrain', 'Derailleurs and [n] more'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products')], 4), 'h-cats', link('All categories'));
const featuredProducts = (chosen = true) => section('[Featured products]', grid([productCard(`${PADS.name} ${PADS.code}`, PADS.price, chosen ? ready() : ''), productCard('[Product]', '£[price]', chosen ? ready() : ''), productCard('[Product]', '£[price]', chosen ? ready() : '', '', false), productCard('[Product]', '£[price]', chosen ? inDays() : '')], 4), 'h-prods');
const repairs = () => box(`<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)'}; gap: 20px; align-items: center"><div style="display: flex; flex-direction: column; gap: 10px">${h2('Book a repair', 'h-rep')}<p style="margin: 0; font-size: 15px; line-height: 1.5">[The shop’s words about its workshop]</p>${button('Book a repair')}</div><ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column">${SERVICES.map(([n, p]) => `<li style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span>${n}</span>${mono(p)}</li>`).join('')}</ul></div>`);
// Shop names are headings on cards (audit M15); "Book a repair here" outlined
// beside the page's main buttons (M1); open or closed is an example (L2).
function shopCard(name, open, { book = true } = {}) {
  return box(`${photo(`Photo of the ${name} shop`, isPhone() ? 120 : 150)}<div style="display: flex; flex-direction: column; gap: 4px"><h3 style="margin: 0; font-size: 18px; font-weight: 700"><a href="#" style="${tall}; color: ${C.ink}">${name}</a></h3><span style="font-size: 15px">[Shop address]</span><span style="font-size: 15px">${open ? '<strong>[Open today]</strong> [opening hours]' : '<strong>[Closed today]</strong> · opens [day] [time]'}</span><a href="tel:[shop phone]" style="${tall}; font-size: 15px; color: ${C.ink}">[shop phone]</a></div><div style="display: flex; flex-wrap: wrap; gap: 10px">${book ? button('Book a repair here', { variant: 'default' }) : ''}${button('Directions', { variant: 'default' }).replace('<button', `<button aria-label="Directions to ${esc(name)} (opens your maps app)"`)}</div>`);
}
const shopsSection = (one = false) => (one ? section('Find us', `<div style="max-width: 560px">${shopCard('North Street Cycles', true, { book: false })}</div>`, 'h-shops') : section('Our shops', grid([shopCard('Bolton', true), shopCard('[Second site]', false)], 2, 1), 'h-shops', link('All shops')));
const words = () => box(`<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 360px'}; gap: 20px; align-items: center"><div style="display: flex; flex-direction: column; gap: 10px">${h2('[A heading]', 'h-words')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s own words — about the shop, the team, a club ride]</p></div>${photo('A photo the shop adds', 200)}</div>`);
const home = (opts = {}) => site(`${hero()}${featuredCats()}${featuredProducts(opts.chosen !== false)}${repairs()}${shopsSection(opts.oneShop)}${words()}`, { active: '', ...opts });

// ---------- Categories (decision 2; audit H2, M4, M5, M10, M12) ----------
const allCats = () => site(`${h1('Shop')}${grid([catCard('Bearings', '[n] products'), catCard('Drivetrain', 'Derailleurs and [n] more'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products'), catCard('[Category]', '[n] products')], 4)}`);
const check = (t, on = false, n = '[n]') => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="flex-grow: 1">${t}</span><span style="font-size: 13px; color: ${C.muted}">${n}</span></label>`;
const more = () => `<button type="button" aria-expanded="false" style="min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; text-decoration: underline; color: ${C.ink}">Show [n] more</button>`;
const filterGroup = (title, items) => `<fieldset style="margin: 0; padding: 12px 0 0; border: 0; border-top: 1px solid ${C.border}"><legend style="padding: 0; font-size: 15px; font-weight: 700">${title}</legend>${items.join('')}</fieldset>`;
const filters = (groups) => `<aside aria-label="Filters" style="display: flex; flex-direction: column; gap: 12px">${groups.join('')}</aside>`;
const priceGroup = () => filterGroup('Price', [`<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">${field('From', { placeholder: '£', linked: true })}${field('To', { placeholder: '£', linked: true })}</div>`, `<span style="font-size: 13px; color: ${C.muted}">Applies when you leave the box or press Enter</span>`]);
// Nothing ticked for the customer (audit H2); `on` lists what they ticked.
const BEARING_FILTERS = (on = []) => [
  filterGroup('Availability', [check('Ready today at Bolton', on.includes('stock'))]),
  filterGroup('Inner diameter', [check(on.includes('30') ? '30 mm' : '[n] mm', on.includes('inner') || on.includes('30')), check('[n] mm'), check('[n] mm'), more()]),
  filterGroup('Outer diameter', [check('[n] mm'), check('[n] mm')]),
  filterGroup('Height', [check('[n] mm', on.includes('height')), check('[n] mm')]),
  filterGroup('Brand', [check('[Brand]'), check('[Brand]')]),
  priceGroup(),
];
const SORTS = ['A to Z', 'Price, low to high', 'Price, high to low', 'Newest'];
const sortBox = (search = false) => `<label style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px">Sort by<select style="min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${(search ? ['Best match', ...SORTS] : SORTS).map((s) => `<option>${s}</option>`).join('')}</select></label>`;
const chips = (list) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${list.map((t) => `<button type="button" aria-label="Remove filter ${esc(t)}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid ${C.ink}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${t}${icon('close', 14)}</button>`).join('')}<button type="button" style="min-height: 44px; padding: 0 6px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; text-decoration: underline; color: ${C.ink}">Clear all</button></div>`;
const moreBar = (shown) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 6px"><span aria-live="polite" style="font-size: 14px; color: ${C.muted}">Showing ${shown} of [n] products</span>${button('Show more', { variant: 'default' })}</div>`;
const listing = ({ title, crumb, count, groups, cards, chipList = [], below = '', empty = '', search = false, opts = {} }) => {
  const top = `${crumb ? crumbs(...crumb) : ''}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px"><div style="display: flex; flex-direction: column; gap: 4px">${h1(title)}<span aria-live="polite" style="font-size: 14px; color: ${C.muted}">${count}</span></div><div style="display: flex; gap: 10px; align-items: center">${isPhone() ? button('Filter', { variant: 'default' }) : ''}${sortBox(search)}</div></div>${below}${chipList.length ? chips(chipList) : ''}`;
  const results = empty || `<div style="display: flex; flex-direction: column; gap: 18px">${grid(cards, 3)}${cards.length >= 6 ? moreBar(cards.length) : ''}</div>`;
  const sheet = opts.sheet && isPhone() ? `<div role="dialog" aria-modal="true" aria-labelledby="flt-title" style="position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column; background: ${C.bg}"><div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 16px; border-bottom: 1px solid ${C.border}; background: ${C.panel}"><h2 id="flt-title" style="margin: 0; font-size: 18px; font-weight: 700">Filter</h2><button type="button" aria-label="Close filters" style="width: 44px; height: 44px; border: 0; background: transparent; color: ${C.ink}">${icon('close', 20)}</button></div><div style="flex-grow: 1; min-height: 0; overflow-y: auto; padding: 4px 16px">${filters(groups)}</div><div style="display: flex; gap: 10px; padding: 12px 16px 16px; border-top: 1px solid ${C.border}; background: ${C.panel}">${button('Clear all', { variant: 'ghost' })}<span style="flex-grow: 1">${button('Show [n] products', { block: true })}</span></div></div>` : '';
  return site(`${top}${isPhone() ? results : `<div style="display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; align-items: start">${filters(groups)}${results}</div>`}`, { ...opts, overlayHtml: sheet || opts.overlayHtml || '' });
};
const B = (stock = ready(), pic = true) => productCard('[Bearing]', '£[price]', stock, '[n] × [n] × [n] mm', pic);
const bearingCards = () => [B(), B(inDays()), B(), B(ready(), false), B(), B(inDays())];
const bearings = (opts = {}) => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: '[n] products', groups: BEARING_FILTERS(), cards: opts.chosen === false ? bearingCards().map(() => B('')) : bearingCards(), opts });
const bearingsFiltered = () => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: '[n] products match', groups: BEARING_FILTERS(['stock', 'inner']), cards: [B(), B(), B()], chipList: ['Ready today at Bolton', 'Inner diameter: [n] mm'], opts: { sheet: true } });
// The empty list names what's doing it (audit H2); "we may be able to order
// it in" only when the shop orders in (H5).
const bearingsEmpty = () => listing({ title: 'Bearings', crumb: ['Shop', 'Bearings'], count: 'Nothing matches', groups: BEARING_FILTERS(['stock', 'inner', 'height']), cards: [], chipList: ['Ready today at Bolton', 'Inner diameter: [n] mm', 'Height: [n] mm'], empty: box(`<p role="status" style="margin: 0; font-size: 16px; line-height: 1.5"><strong>Nothing is ready today at Bolton</strong> with an inner diameter of [n] mm and a height of [n] mm.</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Show ones ready in [n] days')}${button('Clear all filters', { variant: 'default' })}</div>${link('Ask the shop about it')}`) });
// A parent category: its own types first, and only filters all its products
// share (audit M4); the types sit under the heading so Sort stays put (L6).
const typesNav = () => `<nav aria-label="Types of drivetrain"><ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px">${['Derailleurs', '[Category]', '[Category]'].map((c) => `<li><a href="#" style="${tall}; padding: 0 14px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${c}</a></li>`).join('')}</ul></nav>`;
const drivetrain = () => listing({ title: 'Drivetrain', crumb: ['Shop', 'Drivetrain'], count: '[n] products', below: typesNav(), groups: [filterGroup('Availability', [check('Ready today at Bolton')]), filterGroup('Brand', [check('[Brand]'), check('[Brand]')]), priceGroup()], cards: [productCard('[Derailleur]', '£[price]', ready(), '[n] gears'), productCard('[Derailleur]', '£[price]', inDays(), '[n] gears'), productCard('[Product]', '£[price]')] });
const derailleurs = () => listing({ title: 'Derailleurs', crumb: ['Shop', 'Drivetrain', 'Derailleurs'], count: '[n] products', groups: [filterGroup('Availability', [check('Ready today at Bolton')]), filterGroup('Number of gears', [check('[n]'), check('[n]'), check('[n]')]), filterGroup('Brand', [check('[Brand]'), check('[Brand]')]), priceGroup()], cards: [productCard('[Derailleur]', '£[price]', ready(), '[n] gears'), productCard('[Derailleur]', '£[price]', inDays(), '[n] gears'), productCard('[Derailleur]', '£[price]', ready(), '[n] gears')] });

// ---------- A product (decision 3; audit M6, M7, M11, L3) ----------
const thumbs = () => `<div role="group" aria-label="Photos" style="display: flex; gap: 8px">${[1, 2, 3, 4].map((n) => `<button type="button" aria-label="Show photo ${n} of 4"${n === 1 ? ' aria-current="true"' : ''} style="width: 64px; height: 64px; padding: 0; border-radius: 8px; border: ${n === 1 ? `2px solid ${C.ink}` : `1px dashed ${C.input}`}; background: ${C.mutedBg}"></button>`).join('')}</div>`;
const gallery = (name) => `<div style="display: flex; flex-direction: column; gap: 10px"><button type="button" aria-label="Open larger photo 1 of 4" style="display: block; width: 100%; padding: 0; border: 0; background: transparent; cursor: zoom-in">${photo(`Photo 1 of 4 — ${name}`, isPhone() ? 260 : 380)}</button>${thumbs()}</div>`;
const specs = (rows) => `<table style="width: 100%; border-collapse: collapse; font-size: 15px"><caption style="text-align: left; padding-bottom: 8px; font-size: 17px; font-weight: 700">Specifications</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row" style="text-align: left; padding: 9px 0; border-top: 1px solid ${C.border}; font-weight: 400; color: ${C.muted}; width: 45%">${k}</th><td style="padding: 9px 0; border-top: 1px solid ${C.border}">${v}</td></tr>`).join('')}</tbody></table>`;
const qty = (name) => `<div role="group" aria-label="Quantity of ${esc(name)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden"><button type="button" aria-label="One fewer ${esc(name)}" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span aria-live="polite" style="min-width: 40px; text-align: center; font-size: 16px; font-weight: 700">1</span><button type="button" aria-label="One more ${esc(name)}" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; color: ${C.ink}">${icon('plus', 16)}</button></div>`;
const readyBox = (t, tone = 'ok') => `<p style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px">${icon(tone === 'ok' ? 'check' : tone === 'warn' ? 'alert' : 'store', 18)}<span>${t}</span></p>`;
const swatch = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}"><span aria-hidden="true" style="width: 18px; height: 18px; border-radius: 999px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></span>${t}</button>`;
const sizeBtn = (t, on, out) => `<button type="button" role="radio" aria-checked="${on}"${out ? ' aria-describedby="sz-out"' : ''} style="min-width: 56px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : out ? C.border : C.input}; background: ${out ? C.mutedBg : C.panel}; font-family: inherit; font-size: 15px; font-weight: 600; color: ${out ? C.muted : C.ink}; ${out && !on ? 'text-decoration: line-through; ' : ''}">${t}${out ? sr(' — not in stock at Bolton') : ''}</button>`;
// sizes: 'none' (nothing chosen yet) or 'other' (M chosen: not here, at the other shop).
const productPage = ({ sizes = '' } = {}) => {
  const name = sizes ? '[Product with sizes]' : `${PADS.name} ${mono(PADS.code)}`;
  const plain = sizes ? '[Product with sizes]' : `${PADS.name} ${PADS.code}`;
  const picked = sizes === 'other';
  const choose = sizes ? `<div role="radiogroup" aria-label="Colour" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Colour: ${picked ? '[Colour 1]' : 'choose one'}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${swatch('[Colour 1]', picked)}${swatch('[Colour 2]', false)}</div></div>
<div role="radiogroup" aria-label="Size" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Size: ${picked ? 'M' : 'choose one'}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${sizeBtn('S', false, false)}${sizeBtn('M', picked, true)}${sizeBtn('L', false, false)}${sizeBtn('XL', false, false)}</div>${picked ? `<span id="sz-out" style="font-size: 13px; color: ${C.ink}">M isn’t in stock at Bolton in [Colour 1].</span>` : ''}</div>` : '';
  const line = !sizes ? readyBox('<strong>Ready today at Bolton</strong> · [n] in stock')
    : picked ? `${readyBox('<strong>M isn’t in stock at Bolton</strong> in [Colour 1] — it’s in stock at our [Second site] shop', 'warn')}${button('Collect from [Second site] instead', { variant: 'default' })}`
      : readyBox('Choose a colour and size to see when it’s ready', 'grey');
  const buy = picked ? link('Ask the shop about this') : `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">${qty(plain)}${button('Add to basket')}</div>${link('Ask the shop about this')}`;
  const info = `<div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">${crumbs('Shop', '[Category]', plain)}<div style="display: flex; flex-direction: column; gap: 6px">${h1(name)}<span style="font-size: 24px; font-weight: 700">${mono(sizes ? '£[price]' : PADS.price)}</span><span style="font-size: 13px; color: ${C.muted}">Includes VAT · [Brand]</span></div>${choose}${line}${buy}</div>`;
  const lower = `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)'}; gap: 28px; align-items: start"><section aria-labelledby="p-about" style="display: flex; flex-direction: column; gap: 10px">${h2('About it', 'p-about')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s description]</p></section>${specs(sizes ? [['Sizes', 'S, M, L, XL'], ['Colours', '[Colour 1], [Colour 2]'], ['[Detail]', '[value]'], ['Brand', '[Brand]']] : [['Part code', mono(PADS.code)], ['[Detail]', '[value] [unit]'], ['[Detail]', '[value] [unit]'], ['Brand', '[Brand]']])}</div>`;
  return site(`${isPhone() ? `${gallery(plain)}${info}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start">${gallery(plain)}${info}</div>`}${lower}`);
};
const photoOpen = () => overlay(productPage(), `<div role="dialog" aria-modal="true" aria-labelledby="ph-title" style="width: ${isPhone() ? '100%' : '900px'}; height: ${isPhone() ? '100%' : '640px'}; box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; gap: 12px; border-radius: ${isPhone() ? 0 : 12}px; background: ${C.panel}"><div style="display: flex; justify-content: space-between; align-items: center"><h2 id="ph-title" style="margin: 0; font-size: 16px; font-weight: 700">Photo 2 of 4</h2><button type="button" aria-label="Close photos" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: ${C.ink}">${icon('close', 20)}</button></div><div style="flex-grow: 1; display: flex; align-items: center; gap: 12px"><button type="button" aria-label="Previous photo" style="width: 44px; height: 44px; border-radius: 999px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}">${icon('back', 18)}</button><div style="flex-grow: 1; height: 100%">${photo(`Photo 2 of 4 — ${PADS.name} ${PADS.code}`, isPhone() ? 520 : 520)}</div><button type="button" aria-label="Next photo" style="width: 44px; height: 44px; border-radius: 999px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; transform: rotate(180deg)">${icon('back', 18)}</button></div><p style="margin: 0; font-size: 13px; color: ${C.muted}">Left and right arrows change photo · Esc closes</p></div>`);

// ---------- Search (decision 4; audit H4, M9) ----------
// A combobox: the highlighted row is the active one, groups are named, and
// "See all results" is the last row.
const opt = (id, main, sub, right = '', on = false) => `<a href="#" id="${id}" role="option" aria-selected="${on}" style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 12px; border-radius: 8px; text-decoration: none; color: ${C.ink}; ${on ? `background: ${C.mutedBg}; outline: 2px solid ${C.ink}; outline-offset: -2px` : ''}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${main}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</a>`;
const grp = (label, rows) => `<div role="group" aria-label="${label}"><div aria-hidden="true" style="padding: 8px 12px 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: ${C.muted}">${label}</div>${rows.join('')}</div>`;
const listStyle = `box-sizing: border-box; padding: 6px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 16px 40px rgba(28,30,25,0.22)`;
// On tablet and phone the header has only a search button, so pressing it
// opens a search box across the top with the list under it.
const sugBox = (inner, q = '', active = '') => (SIZE === 'desktop'
  ? `<div id="search-suggest" role="listbox" aria-label="Suggestions" style="position: absolute; right: 252px; top: -8px; width: 440px; z-index: 5; ${listStyle}">${inner}</div>`
  : `<div role="search" style="position: absolute; left: 0; right: 0; top: 0; z-index: 5; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: ${C.bg}; box-shadow: 0 8px 20px rgba(28,30,25,0.12)"><div style="display: flex; gap: 8px; align-items: center"><label style="flex-grow: 1; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 12px; border-radius: 8px; border: 2px solid ${C.ink}; background: ${C.panel}">${icon('search', 18)}<input type="search" aria-label="Search the shop" value="${esc(q)}" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="search-suggest"${active ? ` aria-activedescendant="${active}"` : ''} style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label><button type="button" style="min-height: 48px; padding: 0 8px; border: 0; background: transparent; font-family: inherit; font-size: 15px; font-weight: 600; color: ${C.ink}">Cancel</button></div><div id="search-suggest" role="listbox" aria-label="Suggestions" style="${listStyle}">${inner}</div></div>`);
const suggestions = (q) => sugBox(`${grp('Products', [opt('s1', `${PADS.name} ${mono(PADS.code)}`, 'Ready today at Bolton', mono(PADS.price), true), opt('s2', '[Product]', 'Ready today at Bolton', mono('£[price]'))])}
${grp('Repairs', [opt('s3', 'Fit &amp; adjust brakes', 'Book a repair', mono('£18.00')), opt('s4', 'Brake service', 'Book a repair', mono('[£ price]'))])}
${grp('Categories', [opt('s5', '[Category]', '[n] products')])}
${grp('Pages', [opt('s6', 'Collection and returns', 'Page')])}
<a href="#" id="s7" role="option" aria-selected="false" style="display: flex; align-items: center; min-height: 48px; padding: 0 12px; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 700; color: ${C.ink}">See all results for “${esc(q)}”</a>
${sr('<span aria-live="polite">7 suggestions</span>')}`, q, 's1');
const noSuggestions = () => sugBox(`<p style="margin: 0; padding: 14px 12px; font-size: 15px">No suggestions for “[what they typed]” — press Enter to search.</p>${sr('<span aria-live="polite">No suggestions</span>')}`, '[what they typed]');
const combo = (html, q, active) => html.replace(/placeholder="Search(?: the shop)?"/, (m) => `${m} value="${esc(q)}" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="search-suggest"${active ? ` aria-activedescendant="${active}"` : ''}`);
const searching = (q) => combo(home({ overlayHtml: suggestions(q) }), q, 's1');
const searchingNone = () => combo(home({ overlayHtml: noSuggestions() }), '[what they typed]', '');
const repairStrip = () => box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px"><span style="font-size: 16px; font-weight: 700; flex-grow: 1">Repairs for “brake”</span>${SERVICES.slice(1).map(([n, p]) => `<a href="#" style="${tall}; gap: 10px; padding: 0 14px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 15px; font-weight: 600; color: ${C.ink}; text-decoration: none">${n} ${mono(p)}</a>`).join('')}<a href="#" style="${tall}; font-size: 15px; font-weight: 600; color: ${C.ink}">Page: Collection and returns</a></div>`);
const results = () => listing({ title: 'Results for “brake”', count: '[n] products', below: repairStrip(), search: true, groups: [filterGroup('Availability', [check('Ready today at Bolton')]), filterGroup('Category', [check('[Category]'), check('[Category]')]), priceGroup()], cards: [productCard(`${PADS.name} ${PADS.code}`, PADS.price), productCard('[Product]', '£[price]'), productCard('[Product]', '£[price]', inDays())], opts: { query: 'brake' } });
const measure = () => listing({ title: 'Results for “bearing 30mm”', count: 'Bearings with an inner diameter of 30 mm · [n] products', search: true, groups: BEARING_FILTERS(['30']), cards: [B(), B(inDays()), B()], chipList: ['Category: Bearings', 'Inner diameter: 30 mm'], opts: { query: 'bearing 30mm' } });
const noResults = () => site(`${h1('No results for “[what they typed]”')}${box(`<p style="margin: 0; font-size: 15px; line-height: 1.6">Check the spelling, try a shorter word, or look through the categories.</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair', { variant: 'default' })}</div>${askOpen(true)}`)}${featuredCats()}`, { query: '[what they typed]' });

// ---------- Our shops (decision 5; audit M2, L2) ----------
const shops = () => site(`${h1('Our shops')}${grid([shopCard('Bolton', true), shopCard('[Second site]', false)], 2, 1)}`, { active: 'Our shops' });
const HOURS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shopPage = (one = false, collected = false) => site(`${one ? '' : crumbs('Our shops', 'Bolton')}${h1(one ? 'Find us' : 'North Street Cycles, Bolton')}${collected ? `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px">${icon('check', 18)}Collecting from Bolton — what you see now shows when it’s ready here.</p>` : ''}<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 380px'}; gap: 24px; align-items: start">${photo('Photo of the Bolton shop', isPhone() ? 220 : 340)}${box(`<div style="display: flex; flex-direction: column; gap: 4px; font-size: 15px; line-height: 1.5"><strong>${one ? 'North Street Cycles' : '[Shop address]'}</strong>${one ? '<span>[Shop address]</span>' : ''}<a href="tel:[shop phone]" style="${tall}; color: ${C.ink}">[shop phone]</a><a href="mailto:[shop email]" style="${tall}; color: ${C.ink}">[shop email]</a></div><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Book a repair here')}${button('Directions', { variant: 'default' })}${one ? '' : collected ? '' : button('Collect from here', { variant: 'default' })}</div>`)}</div>
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'repeat(2, minmax(0, 1fr))'}; gap: 24px; align-items: start">${box(`${h2('Opening hours', 's-hours')}<table aria-labelledby="s-hours" style="border-collapse: collapse; font-size: 15px"><tbody>${HOURS.map((d, i) => `<tr${i === 3 ? ' style="font-weight: 700"' : ''}><th scope="row" style="text-align: left; padding: 7px 24px 7px 0; font-weight: inherit">${d}${i === 3 ? ' [(today)]' : ''}</th><td style="padding: 7px 0">[opening hours]</td></tr>`).join('')}</tbody></table><p style="margin: 0; font-size: 14px">Closed [holiday dates].</p>`)}${box(`${h2('[A heading]', 's-words')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[The shop’s words about this shop — parking, the workshop, who works here]</p>`)}</div>`, { active: 'Our shops', oneShop: one });

// ---------- When things go wrong (decision 6; audit M13, M14) ----------
const notFound = () => site(`<div style="max-width: 640px; display: flex; flex-direction: column; gap: 16px; padding-top: 40px">${h1('We can’t find that page')}<p style="margin: 0; font-size: 16px; line-height: 1.6">It may have moved, or the link may be wrong.</p>${field('Search for a page or product', { type: 'search', placeholder: 'What are you looking for?', linked: true })}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Go to the home page')}${button('Our shops', { variant: 'default' })}</div></div>`, { active: '' });
// The public sees the same plain page for an unknown address and a website
// that's switched off — it may not show or search anything of the shop
// (Shop websites spec; decision 7, M13).
const offPage = () => {
  const [W, H] = SIZE === 'phone' ? [390, 844] : SIZE === 'tablet' ? [1180, 820] : [1280, 800];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 24px; display: flex; align-items: center; justify-content: center; background: #ffffff; color: #1f2120"><main style="max-width: 480px; display: flex; flex-direction: column; gap: 12px; text-align: center"><h1 style="margin: 0; font-size: 24px; font-weight: 700">This website isn’t available</h1><p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4a4d47">Check the address, or contact the shop another way.</p></main></div>`;
};
// The shop's own staff still see their switched-off website, with the
// banner on every page (audit M14).
const staffBanner = (on = false) => `<div${on ? ' role="status"' : ''} style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: ${on ? C.okBg : C.warnBg}; color: ${on ? C.successInk : C.warnInk}; font-size: 15px">${icon(on ? 'check' : 'lock', 18)}<span style="flex-grow: 1">${on ? '<strong>Your website is on.</strong> Customers can see it now.' : '<strong>Only your staff can see this.</strong> Your website is switched off — customers see “This website isn’t available”.'}</span>${button(on ? 'Turn off' : 'Turn it on', { variant: 'default' })}<a href="#" style="${tall}; font-weight: 600; color: inherit">Back to Wheelhouse</a></div>`;
const preview = () => home({ staffBar: staffBanner() });
const productPreview = () => { const p = productPage(); return p.replace(/(<div data-scroll id="main-content"[^>]*><div[^>]*>)/, `$1${staffBanner()}`); };
const nowOn = () => home({ staffBar: staffBanner(true) });

// ---------- Cookies (decision 6; audit H3, L1) ----------
// First in keyboard order (M15), drawn at the bottom; buttons don't wrap.
const banner = () => `<section role="region" aria-label="Cookie choices" style="position: absolute; left: ${isPhone() ? 0 : 40}px; right: ${isPhone() ? 0 : 40}px; bottom: ${isPhone() ? 0 : 20}px; z-index: 4; box-sizing: border-box; padding: 18px 20px; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'stretch' : 'center'}; gap: 16px; border-radius: ${isPhone() ? 0 : 12}px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 -8px 30px rgba(28,30,25,0.18)"><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">Cookies on this website</h2><p style="margin: 0; font-size: 15px; line-height: 1.5">We use the cookies the site needs to work. With your OK, we’d also like to use [tracking tool] to see how people use the site. <a href="#" style="color: ${C.ink}; ${tall}">About cookies</a></p></div><div style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 3}, auto); gap: 10px; white-space: nowrap">${button('Reject all', { variant: 'default' })}${button('Accept all', { variant: 'default' })}${button('Choose', { variant: 'ghost' })}</div></section>`;
const cookieRow = (t, sub, state) => `<div style="display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 14px; line-height: 1.5; color: ${C.muted}">${sub}</span></span>${state === 'always' ? '<span style="font-size: 14px; font-weight: 600; white-space: nowrap">Always on</span>' : `<button type="button" role="switch" aria-checked="false" aria-label="${esc(t)}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.muted}">Off<span aria-hidden="true" style="position: relative; display: inline-block; width: 44px; height: 26px; border-radius: 999px; background: ${C.input}"><span style="position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 999px; background: #ffffff"></span></span></button>`}</div>`;
const chooseCookies = () => popup('ck-title', 'Choose cookies', 'Change these any time from “Cookie choices” at the bottom of every page', `${cookieRow('Needed for the site to work', 'Your basket, signing in, the shop you’ve chosen, and these choices.', 'always')}${cookieRow('Measuring visits', '[Tracking tool], added by North Street Cycles, to count visits and see which pages are used.', 'off')}${cookieRow('Advertising', '[Advertising tool], added by North Street Cycles, to show you its adverts elsewhere.', 'off')}`, `${button('Reject all', { variant: 'ghost' })}${button('Save my choices')}`, 560);
const savedToast = () => `<div role="status" style="position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 15px; white-space: nowrap">${icon('check', 16)}Your cookie choices are saved</div>`;
const COOKIES = [['[name]', 'Keeps your basket', '[n] days'], ['[name]', 'Keeps you signed in', '[n] days'], ['[name]', 'Remembers the shop you collect from', '[n] days']];
const cookieTable = (rows) => `<table style="border-collapse: collapse; font-size: 15px; width: 100%"><caption style="text-align: left; padding-bottom: 8px; font-size: 15px; color: ${C.muted}">Cookies this website sets</caption><thead><tr>${['Cookie', 'What it’s for', 'How long'].map((c) => `<th scope="col" style="text-align: left; padding: 8px 8px 8px 0; font-size: 13px; color: ${C.muted}; border-bottom: 1px solid ${C.border}">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td style="padding: 9px 8px 9px 0; border-bottom: 1px solid ${C.border}${i === 0 ? `; font-family: ${MONO}` : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const cookiesPage = (tracking = true) => site(`${h1('Cookies')}<div style="max-width: 760px; display: flex; flex-direction: column; gap: 18px">${box(`${h2('What this website uses', 'c-used')}${cookieTable(tracking ? [...COOKIES, ['[name]', 'Remembers your cookie choices', '[n] months']] : COOKIES)}<p style="margin: 0; font-size: 15px">These are needed for the site to work, so they don’t need your OK.</p>`)}${tracking ? box(`${h2('Tools the shop has added', 'c-tools')}<p style="margin: 0; font-size: 15px; line-height: 1.6">[Tracking tool] — measuring visits.</p><p style="margin: 0; font-size: 15px; font-weight: 700">You said no to measuring visits.</p>${button('Change cookie choices', { variant: 'default' })}`) : box(`<p style="margin: 0; font-size: 15px; line-height: 1.6">This website doesn’t use any other cookies, so there’s nothing for you to choose.</p>`)}</div>`, { active: '', tracking });

// ---------- The boards ----------
def('wb-home', () => home());
def('wb-home-lower', () => home({ scroll: 880 }));
def('wb-home-one-shop', () => home({ oneShop: true, scroll: 880 }));
def('wb-first-visit', () => home({ chosen: false, scroll: 360 }));
def('wb-choose-shop', () => overlay(home({ chosen: false }), chooseShop()));
def('wb-shop', () => allCats());
def('wb-category', () => bearings());
def('wb-category-filtered', () => bearingsFiltered());
def('wb-category-empty', () => bearingsEmpty());
def('wb-category-parent', () => drivetrain());
def('wb-category-child', () => derailleurs());
def('wb-category-no-shop', () => bearings({ chosen: false }));
def('wb-product', () => productPage());
def('wb-product-sizes', () => productPage({ sizes: 'none' }));
def('wb-product-size-other', () => productPage({ sizes: 'other' }));
def('wb-product-photos', () => photoOpen());
def('wb-search-typing', () => searching('brake'));
def('wb-search-no-suggestions', () => searchingNone());
def('wb-search-results', () => results());
def('wb-search-measure', () => measure());
def('wb-search-none', () => noResults());
def('wb-shops', () => shops());
def('wb-shop-page', () => shopPage());
def('wb-shop-collect', () => shopPage(false, true));
def('wb-find-us', () => shopPage(true));
def('wb-not-found', () => notFound());
def('wb-off', () => offPage());
def('wb-off-preview', () => preview());
def('wb-off-preview-product', () => productPreview());
def('wb-turned-on', () => nowOn());
def('wb-cookies-banner', () => home({ first: banner(), tracking: true }));
def('wb-cookies-choose', () => overlay(home({ tracking: true }), chooseCookies()));
def('wb-cookies-saved', () => home({ overlayHtml: savedToast(), tracking: true }));
def('wb-cookies-page', () => cookiesPage(true));
def('wb-cookies-page-plain', () => cookiesPage(false));

// Desktop, tablet and phone (tablet and phone drawn after the UI audit).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'wb-home': 'Home page: the sections a new shop starts with',
  'wb-home-lower': 'Home page, further down: repairs, our shops, the shop’s own words',
  'wb-home-one-shop': 'Home page for a shop with one site: “Find us”',
  'wb-first-visit': 'First visit, two shops: nothing chosen yet',
  'wb-choose-shop': 'Choosing the shop: one tap',
  'wb-shop': 'Shop: every category',
  'wb-category': 'A category: Bearings, with filters from its details',
  'wb-category-filtered': 'Filtered: ready today, and an inner diameter (on a phone, the Filter panel open)',
  'wb-category-empty': 'Nothing matches: which filter is the cause',
  'wb-category-parent': 'A parent category: Drivetrain, with its types',
  'wb-category-child': 'Derailleurs: number of gears',
  'wb-category-no-shop': 'A category before a shop is chosen',
  'wb-product': 'A product: photos, specifications, description, buying',
  'wb-product-sizes': 'Sizes and colours: nothing chosen yet',
  'wb-product-size-other': 'A size not here, but at the other shop',
  'wb-product-photos': 'Photos, larger',
  'wb-search-typing': 'Search as you type: products, repairs, categories, pages',
  'wb-search-no-suggestions': 'No suggestions: press Enter to search',
  'wb-search-results': 'Search results: products, with repairs and pages above',
  'wb-search-measure': 'Searching by a measurement: “bearing 30mm”',
  'wb-search-none': 'No results: ask the shop',
  'wb-shops': 'Our shops: a card for each shop',
  'wb-shop-page': 'A shop’s own page: hours, closures, collect from here',
  'wb-shop-collect': 'Collect from here: the shop chosen',
  'wb-find-us': 'One shop: “Find us”',
  'wb-not-found': 'Page not found',
  'wb-off': 'Switched off, or no such shop: what the public sees',
  'wb-off-preview': 'Switched off: what the shop’s own staff see',
  'wb-off-preview-product': 'Switched off: the staff banner on every page',
  'wb-turned-on': 'Turned on: “Your website is on · Turn off”',
  'wb-cookies-banner': 'A shop that added a tracking tool: the cookie choice',
  'wb-cookies-choose': 'Choose cookies',
  'wb-cookies-saved': 'Choices saved; “Cookie choices” in the footer',
  'wb-cookies-page': 'The Cookies page, with the visitor’s choice',
  'wb-cookies-page-plain': 'The Cookies page for a shop with no tracking tool',
};
export const ROWS = [
  { label: 'The home page, and choosing a shop', screens: ['wb-home', 'wb-home-lower', 'wb-home-one-shop', 'wb-first-visit', 'wb-choose-shop'] },
  { label: 'Categories', screens: ['wb-shop', 'wb-category', 'wb-category-filtered', 'wb-category-empty', 'wb-category-parent', 'wb-category-child', 'wb-category-no-shop'] },
  { label: 'A product', screens: ['wb-product', 'wb-product-sizes', 'wb-product-size-other', 'wb-product-photos'] },
  { label: 'Search', screens: ['wb-search-typing', 'wb-search-no-suggestions', 'wb-search-results', 'wb-search-measure', 'wb-search-none'] },
  { label: 'Our shops', screens: ['wb-shops', 'wb-shop-page', 'wb-shop-collect', 'wb-find-us'] },
  { label: 'When things go wrong', screens: ['wb-not-found', 'wb-off', 'wb-off-preview', 'wb-off-preview-product', 'wb-turned-on'] },
  { label: 'Cookies', screens: ['wb-cookies-banner', 'wb-cookies-choose', 'wb-cookies-saved', 'wb-cookies-page', 'wb-cookies-page-plain'] },
];
