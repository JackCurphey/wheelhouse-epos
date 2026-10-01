// Journey 19 — Multiple sites, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-multiple-sites-review.md
//
// Decision 1: the whole app works for the chosen shop; owners and managers
// also get "All shops". 2: one business, with a price or a service able to
// differ by shop. 3: that difference is set on the product or service itself.
// 4: each person has "Works at", and a mechanic's days are set per shop.
// 5: booking starts with "Which shop?". 6: Today with "All shops": a row per
// shop, then one "Needs attention". 7: "+ Add a shop", then a checklist on
// Today. 8: every till at every shop, grouped, in Settings › Till › Tills.
//
// Real example data only: North Street Cycles, Bolton (24 North Street, code
// B, tills B1–B3 — offline foundations §2, §5), Jack Lewis, Jo Taylor, Alex
// Morgan, the Standard service at £65.00, Shimano brake pads B05S-RX at
// £28.00, Today's Bolton figures (8 bikes expected, 4 ready) and WH-1050
// waiting since Mon 14 Sep. The second shop has no real name, address or
// code anywhere, so it is "[Second site]"; its figures are placeholders.
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { page, pill, offer, note, popup, overlay, withSize, isPhone, settingsPage, shopFolds, SHOP_INTRO, tillFolds, TILL_INTRO, workshopFolds, WORKSHOP_INTRO, MANAGER } from './settings-frame.mjs';
import { withSite, screens as diaryScreens } from './diary.mjs';
import { today, section, list, line, tag, stat, warnLead } from './opening.mjs';
import { servicesOpen, screens as setupScreens } from './setup.mjs';
import { screens as stockScreens } from './stock.mjs';
import { shopStepAt, serviceAfterShopAt } from './book.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const SECOND = '[Second site]';
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };

// ---------- Choosing a shop (decision 1) ----------
// The switcher open: your shops, then "All shops" for owners and managers.
const shopOption = (name, sub, on) => `<button type="button" role="menuitemradio" aria-checked="${on}" style="display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 12px; border: 0; border-radius: 8px; background: ${on ? C.mutedBg : 'transparent'}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 12px; color: ${C.muted}">${sub}</span></span>${on ? icon('check', 16) : ''}</button>`;
const switchMenu = () => `<div role="menu" aria-label="Choose a shop" style="position: absolute; left: 12px; top: 122px; z-index: 5; width: 300px; box-sizing: border-box; padding: 6px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28); display: flex; flex-direction: column; gap: 2px">
${shopOption('Bolton', '24 North Street · tills B1–B3', true)}${shopOption(SECOND, '[Address] · [n] tills', false)}
<div style="height: 1px; margin: 4px 6px; background: ${C.border}"></div>
${shopOption('All shops', 'Today, reports and stock for every shop', false)}
<p style="margin: 0; padding: 6px 12px 8px; font-size: 12px; line-height: 1.4; color: ${C.muted}">“All shops” is for owners and managers.</p></div>`;
const withMenu = (base) => `<div style="position: relative; width: ${DIMS[SIZE][0]}px; height: ${DIMS[SIZE][1]}px; overflow: hidden">${base}${switchMenu()}</div>`;

// Decision 6: Today with "All shops" — a row per shop, then one list.
const shopRow = (name, sales, expected, ready, tills) => `<a href="#" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(160px, 1.2fr) repeat(3, minmax(0, 1fr)) auto'}; align-items: center; gap: 12px; min-height: 64px; padding: 10px 0; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 12px; color: ${C.muted}">Open [opens]–[closes]</span></span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: ${C.muted}">Sales so far</span>${mono(sales, 'font-size: 15px; font-weight: 600')}</span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: ${C.muted}">Bikes expected</span><span style="font-size: 15px; font-weight: 600">${expected}</span></span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: ${C.muted}">Ready to collect</span><span style="font-size: 15px; font-weight: 600">${ready}</span></span>
<span style="display: flex; align-items: center; gap: 8px">${tills}<span aria-hidden="true" style="color: ${C.muted}">›</span></span></a>`;
const shopTag = (name) => `<span style="font-size: 12px; font-weight: 700; color: ${C.muted}; text-transform: none">${name} · </span>`;
const todayAll = () => withSite('All shops', () => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · All shops')}
${section('Shops', `<div role="list">${shopRow('Bolton', '£[sales]', '8 bikes', '4', `<span role="link" style="display: inline-flex">${tag('All sales sent')}</span>`)}${shopRow(SECOND, '£[sales]', '[n] bikes', '[n]', `<span role="link" style="display: inline-flex">${tag('[n] sales waiting', 'warn')}</span>`)}</div>${note('Tap a shop to work in it. Tap a till status to see every till.')}`)}
${section('Needs attention', list([
  line(`${shopTag('Bolton')}WH-1050 · Aisha Khan — ready since Mon 14 Sep`, `Cannondale Quick · reminder sent [date] · ${mono('[phone]')}`, button('Contacted', { variant: 'default' }), warnLead),
  line(`${shopTag(SECOND)}Till [code]1 has [n] sales waiting to send`, 'Waiting more than [n] minutes · they send by themselves when the internet is back', button('See tills', { variant: 'default' }), warnLead),
  line(`${shopTag(SECOND)}Till [code]1’s float was £[n] short this morning`, 'Counted by [name] at [time] · “[their reason]”', button('Seen', { variant: 'default' }), warnLead),
]), '', 3)}</div>`, MANAGER));

// "All shops" on a page that needs one shop: say so, one tap each.
const pickShop = () => withSite('All shops', () => page('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px">${card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px; max-width: 460px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">Which shop’s diary?</h2><p style="margin: 0; font-size: 15px; line-height: 1.5">The diary is one shop’s bikes and mechanics. You’re looking at all shops, so choose one.</p>
<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Bolton', { variant: 'default' })}${button(SECOND, { variant: 'default' })}</div>${note('This switches the whole app to that shop, as the sidebar does.')}</div>`)}</div>`, MANAGER));

// ---------- Prices and services by shop (decisions 2, 3) ----------
const priceLine = (label, value, extra = '') => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="flex-grow: 1; font-size: 15px; font-weight: 600">${label}</span><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 15px">£<input value="${value}" aria-label="Price at ${esc(label)}" inputmode="decimal" style="width: 96px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></span>${extra}</div>`;
const removeBtn = (shop) => `<button type="button" aria-label="Use the all-shops price at ${esc(shop)}" style="min-height: 44px; padding: 0 10px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">Same as all shops</button>`;
const shopPrices = (allPrice, differs) => `<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 700; padding-bottom: 6px">Price</span>${priceLine('All shops', allPrice)}${differs ? priceLine(SECOND, '[price]', removeBtn(SECOND)) : ''}
<button type="button" style="align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${differs ? '+ Different at another shop' : 'Different at a shop?'}</button></div>`;
const offeredRow = () => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Offered at</span><span style="font-size: 13px; color: ${C.muted}">Not offered: it doesn’t show at that shop’s till or in its online booking</span></span>${offer('Bolton', true)}${offer(SECOND, true)}</div>`;
const serviceDialog = (differs = true) => popup('svc-title', 'Standard service', 'Full service · 60 min in the diary', `${shopPrices('65.00', differs)}${offeredRow()}
${note('Each shop’s till, booking page and quotes use its own price. Lists mark a service that differs as “Differs by shop”.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 560);
const servicesBoard = (differs) => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ services: differs ? servicesOpen({ reminders: true }).replace('reminder after [n] months', 'reminder after [n] months · <strong style="color: #2A2822">Differs by shop</strong>') : servicesOpen({ reminders: true }) }));
const productDialog = () => popup('pr-title', 'Shimano brake pads', `${mono('B05S-RX')} · price`, `${shopPrices('28.00', true)}
${note('Staff see the price for the shop they’re working in. The product list can show only products that differ by shop.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);

// ---------- People (decision 4) ----------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayPills = (shop, on) => `<div role="group" aria-label="Days at ${esc(shop)}" style="display: flex; flex-wrap: wrap; gap: 6px">${DAYS.map((d, i) => `<button type="button" aria-pressed="${on.includes(i)}" style="min-width: 48px; min-height: 44px; padding: 0 10px; border-radius: 999px; border: 1px solid ${on.includes(i) ? C.ink : C.border}; background: ${on.includes(i) ? C.ink : 'transparent'}; color: ${on.includes(i) ? '#ffffff' : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${d}</button>`).join('')}</div>`;
// Alex's Bolton days are the days Alex is in the diary's example week
// (Mon–Sat); the second shop's days are not chosen yet.
const worksAtDialog = () => popup('wa-title', 'Alex Morgan', 'Mechanic · one role at every shop', `
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Works at</span><div role="group" aria-label="Works at" style="display: flex; flex-wrap: wrap; gap: 8px">${offer('Bolton', true)}${offer(SECOND, true)}</div>${note('Alex can switch between these shops. Someone with one shop never sees the switcher.')}</div>
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Days in the workshop · Bolton</span>${dayPills('Bolton', [0, 1, 2, 3, 4, 5])}</div>
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Days in the workshop · ${SECOND}</span>${dayPills(SECOND, [])}${note(`Choose the days Alex works at ${SECOND}. A day can only be at one shop.`)}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 600);

// ---------- Booking (decision 5) ----------
const shopChoice = (name, sub, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${on ? C.hover : C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></button>`;
const shopStepBody = () => `<div role="radiogroup" aria-label="Which shop?" style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 10px">${shopChoice('Bolton', '24 North Street · open [opening hours]', true)}${shopChoice(SECOND, '[Address] · open [opening hours]', false)}</div>
${note('Services, prices and free times are for the shop you choose.')}<div style="display: flex; justify-content: flex-end">${button('Next: what does your bike need?')}</div>`;

// ---------- Adding a shop (decision 7) ----------
const siteCard = (name, code, addr, tills, hours) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: inline-flex; width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-family: ${MONO}; font-size: 16px; font-weight: 700">${code}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${addr} · ${tills} · ${hours}</span></span><button type="button" aria-label="Edit ${esc(name)}" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">Edit</button></div>`;
const sitesOpen = (two = true) => `${siteCard('Bolton', 'B', '24 North Street · [shop phone]', 'tills B1–B3', '[opening hours]')}${two ? siteCard(SECOND, '[code]', '[Address] · [phone]', '[n] tills', '[opening hours]') : ''}
<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px; padding-top: 6px">${button('+ Add a shop', { variant: 'default' })}${note('Customers, products, staff and messages are shared by every shop.')}</div>`;
const sitesBoard = (two = true) => settingsPage('shop', 'Shop and sites', SHOP_INTRO, shopFolds({ sites: sitesOpen(two) }), { who: OWNER });
const addShopDialog = () => popup('add-title', 'Add a shop', 'It joins North Street Cycles', `
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 140px'}; gap: 12px">${field('Shop name', { placeholder: 'e.g. the town it’s in' })}${field('Code', { placeholder: 'One letter', hint: 'On its tills and receipts, like B1-1042' })}</div>
${field('Address', { placeholder: 'Street, town, postcode' })}${field('Phone', { type: 'tel' })}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Opening hours</span><span style="font-size: 13px; color: ${C.muted}">Change any day afterwards</span></span>${button('Copy Bolton’s hours', { variant: 'default' })}</div>
${note('Stock starts at zero. Today shows what to do next: tills, who works there, and its stock.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add the shop')}`, 600);
// Today at the new shop: its checklist.
const step = (done, t, sub, action) => line(t, sub, done ? tag('Done') : button(action, { variant: 'default' }), `<span aria-hidden="true" style="display: inline-flex; width: 22px; height: 22px; border-radius: 999px; align-items: center; justify-content: center; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 2px solid ${C.input}`}">${done ? icon('check', 13) : ''}</span>`);
const todayNew = () => withSite(SECOND, () => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note(`Thursday 17 September · North Street Cycles, ${SECOND}`)}
${section(`Getting ${SECOND} ready`, list([
  step(true, 'Add the shop', 'Name, code, address, phone and opening hours'),
  step(false, 'Register its tills', 'On each computer that will be a till there', 'How'),
  step(false, 'Say who works there', 'On each person in Staff and roles — and a mechanic’s days', 'Staff and roles'),
  step(false, 'Get its stock in', 'Send some from Bolton, or count what’s there with a stock take', 'Send from Bolton'),
]), '', 0)}${note('This goes from Today when all four are done.')}</div>`, OWNER));

// ---------- Every till at every shop (decision 8) ----------
const tillRow = (code, last, waiting) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">Till ${mono(code)}</span><span style="font-size: 13px; color: ${C.muted}">Last sent its sales ${last}</span></span>${waiting ? tag(waiting, 'warn') : tag('All sales sent')}</div>`;
const shopHead = (name) => `<h4 style="margin: 10px 0 2px; font-size: 14px; font-weight: 700">${name}</h4>`;
const tillsGrouped = () => `${shopHead('Bolton')}${tillRow('B1', 'at [time]', '')}${tillRow('B2', 'at [time]', '')}${tillRow('B3', 'at [time]', '')}
${shopHead(SECOND)}${tillRow('[code]1', '[n] minutes ago', '[n] sales waiting')}${tillRow('[code]2', 'at [time]', '')}
${note('Sales waiting send by themselves when the till is back online. Only the owner can add or remove tills.')}`;
// Scrolled down to the Tills section, below the till's other settings.
const scrolled = (html, px) => `<style>.ms-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;/, '<div data-scroll class="ms-scrolled" style="$1overflow-y: hidden;')}`;
const tillsBoard = () => scrolled(settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsGrouped() })).replace('>Till B1<', '>B1–B3 · [Second site]<'), { desktop: 250, tablet: 250, phone: 600 }[SIZE]);

// ---------- The boards ----------
def('ms-switch-open', () => withMenu(today()));
def('ms-today-all', () => todayAll());
def('ms-pick-shop', () => pickShop());
def('ms-service-price', () => overlay(servicesBoard(false), serviceDialog()));
def('ms-services-differs', () => servicesBoard(true));
def('ms-product-price', () => overlay(stockScreens['tr-sites'][SIZE], productDialog()));
def('ms-person', () => overlay(setupScreens['set-staff'][SIZE], worksAtDialog()));
def('ms-book-shop', () => shopStepAt(SIZE, shopStepBody()));
def('ms-book-shop-chosen', () => serviceAfterShopAt(SIZE, 'North Street Cycles, Bolton'));
def('ms-sites', () => sitesBoard());
def('ms-add-shop', () => overlay(sitesBoard(false), addShopDialog()));
def('ms-today-new', () => todayNew());
def('ms-tills', () => tillsBoard());

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ms-switch-open': 'The shop switcher: your shops, and “All shops”',
  'ms-today-all': 'Today, all shops: a row per shop, one list of what needs you',
  'ms-pick-shop': '“All shops” on the diary: choose one',
  'ms-service-price': 'A service: price for all shops, different at one, where it’s offered',
  'ms-services-differs': 'Services list: “Differs by shop”',
  'ms-product-price': 'A product’s price, different at one shop',
  'ms-person': 'A person: where they work, and a mechanic’s days at each shop',
  'ms-book-shop': 'Book a repair: “Which shop?” first',
  'ms-book-shop-chosen': 'The shop chosen, then the service',
  'ms-sites': 'Settings › Shop and sites: each shop',
  'ms-add-shop': 'Add a shop',
  'ms-today-new': 'Today at a new shop: what to do next',
  'ms-tills': 'Settings › Till › Tills: every till, by shop',
};
export const ROWS = [
  { label: 'Choosing a shop', screens: ['ms-switch-open', 'ms-today-all', 'ms-pick-shop'] },
  { label: 'Prices and services by shop', screens: ['ms-service-price', 'ms-services-differs', 'ms-product-price'] },
  { label: 'People and booking', screens: ['ms-person', 'ms-book-shop', 'ms-book-shop-chosen'] },
  { label: 'Adding a shop, and its tills', screens: ['ms-sites', 'ms-add-shop', 'ms-today-new', 'ms-tills'] },
];
