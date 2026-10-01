// Journey 19 — Multiple sites, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-multiple-sites-review.md
// UI audit: docs/design/user-journeys/sites-ui-audit.md (decision 9: every
// recommendation taken)
//
// Decision 1: the whole app works for the chosen shop; owners and managers
// also get "All shops". 2: one business, with a price or a service able to
// differ by shop. 3: that difference is set on the product or service itself.
// 4: each person has "Works at", and a mechanic's days are set per shop.
// 5: booking starts with "Which shop?". 6: Today with "All shops": a row per
// shop, then one "Needs attention". 7: "+ Add a shop", then a checklist on
// Today. 8: every till at every shop, grouped, in Settings › Till › Tills.
// 9 (audit): who sees "All shops", a till sells for its own shop, a day can
// only be at one shop, booking goes straight on, "shop" for staff.
//
// Real example data only: North Street Cycles, Bolton (24 North Street, code
// B, tills B1–B3 — offline foundations §2, §5), Jack Lewis (Owner), Jo
// Taylor (in the workshop Tue, Wed, Sat — Owner setup), the Standard service
// at £65.00, Shimano brake pads B05S-RX at £28.00, Bolton's Today (8 bikes
// expected, 4 ready, all sales sent). The second shop has no real name,
// address or code anywhere, so it is "[Second site]"; its figures are
// placeholders.
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { page, offer, note, popup, overlay, withSize, isPhone, settingsPage, shopFolds, SHOP_INTRO, tillFolds, TILL_INTRO, workshopFolds, WORKSHOP_INTRO, MANAGER } from './settings-frame.mjs';
import { withSite } from './diary.mjs';
import { today, section, list, line, tag, warnLead } from './opening.mjs';
import { servicesOpen, personDialog, staffPage, peopleOpen } from './setup.mjs';
import { screens as stockScreens } from './stock.mjs';
import { screens as mapScreens } from './app-map.mjs';
import { shopStepAt, serviceAfterShopAt } from './book.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const SECOND = '[Second site]';
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
const statusLine = (t) => `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px; font-weight: 600">${icon('check', 18)}<span>${t}</span></p>`;
const warnLine = (t) => `<p role="status" style="margin: 0; display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>${t}</span></p>`;
// Boards reused from journey 14 call the second shop "[Site 2]" (audit L5).
const second = (html) => html.replaceAll('[Site 2]', SECOND).replaceAll('[Site 3]', '[Third site]');

// ---------- Choosing a shop (decision 1; audit H1, H4, M3, M4) ----------
// The switcher open: focus on the ticked row; "All shops" only for those
// who may see it (H1). Arrows move, Escape closes and returns focus.
const shopOption = (name, sub, on) => `<button type="button" role="menuitemradio" aria-checked="${on}"${on ? ' data-focus' : ''} style="display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 12px; border: 0; border-radius: 8px; background: ${on ? C.mutedBg : 'transparent'}; ${on ? `outline: 2px solid ${C.ink}; outline-offset: -2px; ` : ''}font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 12px; color: ${C.muted}">${sub}</span></span>${on ? icon('check', 16) : ''}</button>`;
const switchMenu = () => `<div role="menu" aria-label="Choose a shop" style="position: absolute; left: 12px; top: 122px; z-index: 5; width: 300px; box-sizing: border-box; padding: 6px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28); display: flex; flex-direction: column; gap: 2px">
${shopOption('Bolton', '24 North Street · tills B1–B3', true)}${shopOption(SECOND, '[Address] · [n] tills', false)}
<div role="separator" style="height: 1px; margin: 4px 6px; background: ${C.border}"></div>
${shopOption('All shops', 'Today, reports and stock for every shop', false)}</div>`;
// On tablet and phone the switcher is in the unfolded sidebar and the menu
// sheet; choosing opens the same list as a pop-up.
const withMenu = (base) => SIZE === 'desktop' ? `<div style="position: relative; width: ${DIMS[SIZE][0]}px; height: ${DIMS[SIZE][1]}px; overflow: hidden">${base}${switchMenu()}</div>`
  : overlay(base, popup('shop-title', 'Choose a shop', 'You’re working in Bolton', `<div role="menu" aria-labelledby="shop-title" style="display: flex; flex-direction: column; gap: 2px">${shopOption('Bolton', '24 North Street · tills B1–B3', true)}${shopOption(SECOND, '[Address] · [n] tills', false)}<div role="separator" style="height: 1px; margin: 4px 6px; background: ${C.border}"></div>${shopOption('All shops', 'Today, reports and stock for every shop', false)}</div>`, '', 420));

// Today at [Second site]: its own lines, the ones the "All shops" list
// carries (audit M13). After a switch it says so (M3).
const SECOND_LINES = () => [
  line(`Till [code]1 has [n] sales waiting to send`, 'Waiting more than [n] minutes · they send by themselves when the internet is back', button('See tills', { variant: 'default' }), warnLead),
  line(`Till [code]1’s float was £[n] short this morning`, 'Counted by [name] at [time] · “[their reason]”', button('Seen', { variant: 'default' }), warnLead),
  line(`[Job number] · [Customer] — ready since [date]`, `[Bike] · reminder sent [date] · ${mono('[phone]')}`, button('Contacted', { variant: 'default' }), warnLead),
];
const todaySecond = (switched = false) => withSite(SECOND, () => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${switched ? statusLine(`Now working in ${SECOND}`) : ''}${note(`Thursday 17 September · North Street Cycles, ${SECOND} · open [opens]–[closes]`)}
${section('Needs attention', list(SECOND_LINES()), '', 3)}
${section('Workshop today', `<p style="margin: 0; font-size: 15px; color: ${C.muted}">[n] bikes expected · [n] ready to collect</p>`)}</div>`, OWNER));

// Decision 6, audit H3, L1, L3, M13: one grid with the labels once; the shop
// name and the till status are separate links; the list is the second
// shop's (Bolton has nothing needing attention, as on its own Today).
const gridCols = () => (isPhone() ? '1fr' : 'minmax(180px, 1.2fr) repeat(3, minmax(0, 1fr)) 190px');
const head = (t) => `<span role="columnheader" style="font-size: 12px; font-weight: 700; color: ${C.muted}">${t}</span>`;
const cell = (v) => `<span role="cell" style="font-size: 15px; font-weight: 600">${v}</span>`;
const shopGridRow = (name, sales, expected, ready, tillTag) => isPhone() ? `<div role="row" style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid ${C.border}"><span role="rowheader" style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><a href="#" aria-label="Work in ${esc(name)}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; font-size: 16px; font-weight: 700; color: ${C.ink}">${name}<span aria-hidden="true" style="color: ${C.muted}">›</span></a><a href="#" aria-label="${esc(name)} tills: see every till" style="display: inline-flex; align-items: center; min-height: 44px; text-decoration: none">${tillTag}</a></span><span style="font-size: 14px; color: ${C.muted}">Sales so far <strong style="color: ${C.ink}">${mono(sales)}</strong> · ${expected} expected · ${ready} ready</span></div>` : `<div role="row" style="display: grid; grid-template-columns: ${gridCols()}; align-items: center; gap: 12px; min-height: 64px; padding: 8px 0; border-top: 1px solid ${C.border}"><span role="rowheader" style="display: flex; flex-direction: column; gap: 2px"><a href="#" aria-label="Work in ${esc(name)}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; font-size: 16px; font-weight: 700; color: ${C.ink}">${name}<span aria-hidden="true" style="color: ${C.muted}">›</span></a><span style="font-size: 12px; color: ${C.muted}">Open [opens]–[closes]</span></span>${cell(mono(sales))}${cell(expected)}${cell(ready)}<span role="cell"><a href="#" aria-label="${esc(name)} tills: see every till" style="display: inline-flex; align-items: center; min-height: 44px; text-decoration: none">${tillTag}</a></span></div>`;
const shopTag = (name) => `<span style="font-weight: 700; color: ${C.ink}">${name} · </span>`;
const todayAll = () => withSite('All shops', () => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · All shops')}
${section('Shops', `<div role="table" aria-label="Shops today">${isPhone() ? '' : `<div role="row" style="display: grid; grid-template-columns: ${gridCols()}; gap: 12px; padding-bottom: 6px">${head('Shop')}${head('Sales so far')}${head('Bikes expected')}${head('Ready to collect')}${head('Tills')}</div>`}${shopGridRow('Bolton', '£[sales]', '8 bikes', '4', tag('All sales sent'))}${shopGridRow(SECOND, '£[sales]', '[n] bikes', '[n]', tag('[n] sales waiting', 'warn'))}</div>`)}
${section('Needs attention', list(SECOND_LINES().map((l) => l.replace('<span style="font-size: 15px; font-weight: 600">', `<span style="font-size: 15px; font-weight: 600">${shopTag(SECOND)}`))), '', 3)}</div>`, OWNER));

// "All shops" on a page that needs one shop: say so, one tap each.
const pickShop = () => withSite('All shops', () => page('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px">${card(`<div style="padding: 24px; display: flex; flex-direction: column; gap: 14px; max-width: 460px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">Which shop’s diary?</h2><p style="margin: 0; font-size: 15px; line-height: 1.5">The diary is one shop’s bikes and mechanics. You’re looking at all shops, so choose one.</p>
<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Bolton', { variant: 'default' })}${button(SECOND, { variant: 'default' })}</div>${note('This switches the whole app to that shop, as the sidebar does.')}</div>`)}</div>`, OWNER));

// Audit H2: a till always sells for its own shop.
const tillOther = () => {
  const base = mapScreens['till-rail'][SIZE];
  const banner = `<div role="status" style="flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px">${icon('alert', 18)}<span><strong>This till is Bolton’s.</strong> Sales here are Bolton’s, whichever shop you chose in the menu (${SECOND}).</span></div>`;
  const i = base.indexOf('</header>') + '</header>'.length;
  return base.slice(0, i) + banner + base.slice(i);
};

// Audit M4: someone with one shop sees its name and no switcher.
const oneShop = () => withSite('Bolton', () => today({ staff: true }), 'one');

// ---------- Prices and services by shop (decisions 2, 3; audit M5, M6, L2, L7) ----------
const priceLine = (label, value, extra = '', dim = false) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}; ${dim ? 'opacity: 0.55; ' : ''}"><label for="p-${esc(label)}" style="flex-grow: 1; font-size: 15px; font-weight: 600">${label}</label><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 15px">£<input id="p-${esc(label)}" value="${value}" inputmode="decimal"${dim ? ' disabled' : ''} style="width: 96px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></span>${extra}</div>`;
const sameBtn = (shop) => `<button type="button" aria-label="Same as all shops at ${esc(shop)}" style="min-height: 44px; padding: 0 10px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">Same as all shops</button>`;
// With two shops and the second already different, there is nothing more to
// add, so the link goes (L2).
const shopPrices = (allPrice, differs, notOffered = false) => `<div role="group" aria-labelledby="price-h" style="display: flex; flex-direction: column"><span id="price-h" style="font-size: 15px; font-weight: 700; padding-bottom: 6px">Price</span>${priceLine('All shops', allPrice)}${differs ? priceLine(SECOND, notOffered ? '' : '[price]', notOffered ? `<span style="font-size: 14px; color: ${C.muted}">Not offered here</span>` : sameBtn(SECOND), notOffered) : ''}
${differs ? '' : `<button type="button" style="align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">Different at a shop?</button>`}</div>`;
const offeredRow = (second = true) => `<div role="group" aria-labelledby="off-h" style="display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid ${C.border}"><span id="off-h" style="font-size: 15px; font-weight: 700">Offered at</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${offer('Bolton', true)}${offer(SECOND, second)}</div><span style="font-size: 13px; color: ${C.muted}; line-height: 1.45">Untick a shop to stop offering this service there. It then won’t show at that shop’s till or in its online booking.</span></div>`;
const serviceDialog = (notOffered = false) => popup('svc-title', 'Standard service', 'Full service · 60 min in the diary', `${shopPrices('65.00', true, notOffered)}${offeredRow(!notOffered)}
${notOffered ? warnLine(`[n] bookings at ${SECOND} are for this service. They stay booked — call those customers if they need to change.`) : ''}
${note('Each shop’s till, booking page and quotes use its own price.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 560);
// M5, L7: working at [Second site], the list shows that shop's price
// beside the all-shops one, and says what differs.
const servicesBoard = (differs) => withSite(differs ? SECOND : 'Bolton', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ services: differs
  ? servicesOpen({ reminders: true }).replace('£65.00', '£[price] here · £65.00 all shops').replace('reminder after [n] months', 'reminder after [n] months · <strong style="color: #2A2822">Price differs</strong>')
  : servicesOpen({ reminders: true }) }), { who: OWNER }));
const productDialog = () => popup('pr-title', 'Shimano brake pads', mono('B05S-RX'), `${shopPrices('28.00', true)}
${note('Staff see the price for the shop they’re working in. The product list can show only products whose price differs by shop.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);

// ---------- People (decision 4; audit H1, H5, M7) ----------
// Inside the real person pop-up. Jo's Bolton days are Owner setup's (Tue,
// Wed, Sat); at [Second site] those days are taken and say so.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TAKEN = ['Tue', 'Wed', 'Sat'];
const secondDays = () => `<div role="group" aria-label="Works in the workshop on at ${SECOND}" style="display: flex; flex-direction: column; gap: 8px; margin-left: ${isPhone() ? 0 : 18}px; padding-left: ${isPhone() ? 0 : 14}px; border-left: ${isPhone() ? 0 : 1}px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">In the workshop on · ${SECOND}</span><div style="display: flex; flex-wrap: wrap; gap: 4px">${DAYS.map((d) => TAKEN.includes(d)
  ? `<button type="button" disabled aria-label="${d}: Jo is at Bolton" style="min-width: 44px; min-height: 44px; padding: 0 6px; border-radius: 8px; border: 1px dashed ${C.border}; background: transparent; color: ${C.muted}; font-family: inherit; font-size: 12px; font-weight: 600; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2">${d}<span style="font-size: 10px; font-weight: 500">Bolton</span></button>`
  : `<button type="button" aria-pressed="false" style="min-width: 44px; min-height: 44px; padding: 0 6px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 13px; font-weight: 600">${d}</button>`).join('')}</div><span style="font-size: 13px; color: ${C.muted}; line-height: 1.45">A day can only be at one shop. To move one here, untick it at Bolton first.</span></div>`;
const worksAt = () => `<div role="group" aria-labelledby="wa-h" style="display: flex; flex-direction: column; gap: 8px; padding-top: 14px"><span id="wa-h" style="font-size: 15px; font-weight: 600">Works at</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${offer('Bolton', true)}${offer(SECOND, true)}</div><span style="font-size: 13px; color: ${C.muted}; line-height: 1.45">Jo can switch between these shops. Someone with one shop never sees the switcher. Owners see every shop; a manager at two or more shops also gets “All shops”, for just those. Unticking a shop with jobs booked for Jo there says so first.</span></div>`;
const personBoard = () => overlay(staffPage({ people: peopleOpen(false) }), personDialog({ worksAt: worksAt(), siteDays: secondDays() }));

// ---------- Booking (decision 5; audit M8, M9) ----------
// Nothing chosen unless the customer came from a shop's page; tapping a shop
// goes straight on to "What does your bike need?".
const shopChoice = (name, sub, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${on ? C.hover : C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%"><span style="font-size: 16px; font-weight: 700">${name}</span>${on ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600">${icon('check', 14)}Chosen</span>` : ''}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></button>`;
const shopStepBody = (chosen = false, changing = false) => `${changing ? warnLine(`Changing shop clears your time. Your service stays if ${SECOND} offers it, at ${SECOND}’s price.`) : ''}<div role="radiogroup" aria-label="Which shop?" style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 10px">${shopChoice('Bolton', '24 North Street · open [opening hours]', chosen)}${shopChoice(SECOND, '[Address] · open [opening hours]', false)}</div>
${note('Choose a shop to carry on. Services, prices and free times are for the shop you choose.')}`;
// The page footer names the business until a shop is chosen.
const footerPlain = (html) => html.replace('North Street Cycles · Bolton</span>', 'North Street Cycles</span>');

// ---------- Adding a shop (decision 7; audit M1, M2, M4, L6) ----------
const siteCard = (name, code, addr, tills, hours, edit) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: inline-flex; min-width: 40px; height: 40px; padding: 0 6px; box-sizing: border-box; flex-shrink: 0; border-radius: 8px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-family: ${MONO}; font-size: 15px; font-weight: 700">${code}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${addr} · ${tills} · ${hours}</span></span>${edit ? `<button type="button" aria-label="Edit ${esc(name)}" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">Edit</button>` : ''}</div>`;
const sitesOpen = (owner = true) => `${siteCard('Bolton', 'B', '24 North Street · [shop phone]', 'tills B1–B3', '[opening hours]', owner)}${siteCard(SECOND, '[code]', '[Address] · [phone]', '[n] tills', '[opening hours]', owner)}
<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; align-items: ${isPhone() ? 'flex-start' : 'center'}; justify-content: space-between; gap: 12px; padding-top: 6px">${owner ? button('+ Add a shop', { variant: 'default' }) : note('Only the owner can add or change shops.')}${note('Customers, products, staff and messages are shared by every shop.')}</div>`;
const sitesBoard = (owner = true) => settingsPage('shop', 'Shop and sites', SHOP_INTRO, shopFolds({ sites: sitesOpen(owner) }, `Bolton, ${SECOND}`), { who: owner ? OWNER : MANAGER });
const req = (t) => `${t} (required)`;
const addShopDialog = (error = false) => popup('add-title', 'Add a shop', 'It joins North Street Cycles', `
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1fr) 160px'}; gap: 12px">${field(req('Shop name'), { value: '[Shop name]' })}${field(req('Code'), error ? { value: 'B', error: 'B is Bolton’s code. Choose another letter.' } : { value: '[letter]', hint: 'Suggested from the name. On its tills and receipts, like B1-1042' })}</div>
${field(req('Address'), { placeholder: 'Street, town, postcode' })}${field('Phone (optional)', { type: 'tel' })}
<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid ${C.border}"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 15px; font-weight: 700">Opening hours</span>${button('Copy hours from Bolton', { variant: 'default' })}</div><p role="status" style="margin: 0; font-size: 14px; line-height: 1.45">Same hours as Bolton: [opening hours]. Change any day afterwards.</p></div>
<p style="margin: 0; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px; line-height: 1.45">[What an extra shop costs, once Wheelhouse has set it]</p>
${note('Stock starts at zero. Today shows what to do next: tills, who works there, and its stock.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add the shop')}`, 600);
// Today at the new shop: its checklist, and the move announced (M3, M11).
const step = (done, t, sub, actions, label) => line(`${done ? '' : `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Not done: </span>`}${t}`, sub, done ? tag('Done') : `<span style="display: inline-flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end">${actions.map((a) => button(a, { variant: 'default' }).replace('<button', `<button aria-label="${esc(a)} at ${esc(SECOND)}"`)).join('')}</span>`, `<span aria-hidden="true" style="display: inline-flex; flex-shrink: 0; width: 22px; height: 22px; border-radius: 999px; align-items: center; justify-content: center; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 2px solid ${C.input}`}">${done ? icon('check', 13) : ''}</span>`);
const todayNew = () => withSite(SECOND, () => page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${statusLine(`${SECOND} added. You’re now looking at it.`)}${note(`Thursday 17 September · North Street Cycles, ${SECOND}`)}
${section(`Getting ${SECOND} ready`, `<div role="list" style="position: relative">${[
  step(true, 'Add the shop', 'Name, code, address, phone and opening hours', []),
  step(false, 'Register its tills', 'On each computer that will be a till there', ['Register a till']),
  step(false, 'Choose who works there', 'On each person in Staff and roles — and a mechanic’s days', ['Open Staff and roles']),
  step(false, 'Get its stock in', 'Send some from Bolton, or count what’s already there', ['Send from Bolton', 'Count it']),
].join('')}</div>`, '', 0)}${note('This list goes away when all four are done.')}</div>`, OWNER));

// ---------- Every till at every shop (decision 8; audit M10, L4) ----------
const tillRow = (code, last, waiting) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Till ${mono(code)}</span><span style="font-size: 13px; color: ${C.muted}">Last sent its sales ${last}</span></span>${waiting ? tag(waiting, 'warn') : tag('All sales sent')}</div>`;
const shopHead = (name, n) => `<h4 style="margin: 14px 0 4px; display: flex; justify-content: space-between; align-items: baseline; font-size: 16px; font-weight: 700">${name}<span style="font-size: 13px; font-weight: 600; color: ${C.muted}">${n}</span></h4>`;
const addTill = (shop) => `<button type="button" aria-label="Add a till at ${esc(shop)}" style="align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">+ Add a till</button>`;
const tillsGrouped = () => `<div style="display: flex; flex-direction: column">${shopHead('Bolton', '3 tills')}${tillRow('B1', 'at [time]', '')}${tillRow('B2', 'at [time]', '')}${tillRow('B3', 'at [time]', '')}${addTill('Bolton')}
${shopHead(SECOND, '[n] tills')}${tillRow('[code]1', '[n] minutes ago', '[n] sales waiting')}${tillRow('[code]2', 'at [time]', '')}${addTill(SECOND)}</div>
${note('Sales waiting send by themselves when the till is back online. “+ Add a till” is done on the computer that will be the till.')}`;
const scrolled = (html, px) => `<style>.ms-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;/, '<div data-scroll class="ms-scrolled" style="$1overflow-y: hidden;')}`;
const tillsBoard = () => scrolled(settingsPage('till', 'Till', TILL_INTRO, tillFolds({ tills: tillsGrouped() }), { who: OWNER }).replace('>Till B1<', `>Bolton B1–B3 · ${SECOND} [n] tills<`), { desktop: 250, tablet: 250, phone: 330 }[SIZE]);

// ---------- The boards ----------
def('ms-switch-open', () => withMenu(withSite('Bolton', () => today({ as: OWNER }), 'open')));
def('ms-switched', () => todaySecond(true));
def('ms-today-all', () => todayAll());
def('ms-pick-shop', () => pickShop());
def('ms-till-other', () => tillOther());
def('ms-one-shop', () => oneShop());
def('ms-service-price', () => overlay(servicesBoard(false), serviceDialog()));
def('ms-service-not-offered', () => overlay(servicesBoard(false), serviceDialog(true)));
def('ms-services-differs', () => servicesBoard(true));
def('ms-product-price', () => overlay(second(stockScreens['tr-sites'][SIZE]), productDialog()));
def('ms-person', () => personBoard());
def('ms-book-shop', () => footerPlain(shopStepAt(SIZE, shopStepBody())));
def('ms-book-shop-chosen', () => serviceAfterShopAt(SIZE, 'North Street Cycles, Bolton', 'from Bolton’s page'));
def('ms-book-shop-change', () => shopStepAt(SIZE, shopStepBody(true, true), 'Bolton'));
def('ms-sites', () => sitesBoard());
def('ms-sites-manager', () => sitesBoard(false));
def('ms-add-shop', () => overlay(sitesBoard(), addShopDialog()));
def('ms-add-shop-error', () => overlay(sitesBoard(), addShopDialog(true)));
def('ms-today-new', () => todayNew());
def('ms-tills', () => tillsBoard());

// Every board at desktop, tablet and phone.
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ms-switch-open': 'The shop switcher open: your shops, and “All shops” (owner)',
  'ms-switched': 'After switching: “Now working in [Second site]”',
  'ms-today-all': 'Today, all shops: a row per shop, one list of what needs you',
  'ms-pick-shop': '“All shops” on the diary: choose one',
  'ms-till-other': 'A till sells for its own shop, whatever the menu says',
  'ms-one-shop': 'Someone with one shop: its name, no switcher (staff with two shops get their shops, no “All shops”)',
  'ms-service-price': 'A service: price for all shops, different at one, where it’s offered',
  'ms-service-not-offered': 'Not offered at one shop',
  'ms-services-differs': 'Services list at [Second site]: its price beside the all-shops one',
  'ms-product-price': 'A product’s price, different at one shop',
  'ms-person': 'A person: where they work, and workshop days at each shop',
  'ms-book-shop': 'Book a repair: “Which shop?” first, nothing chosen',
  'ms-book-shop-chosen': 'Came from Bolton’s page: the shop chosen, straight to the service',
  'ms-book-shop-change': 'Changing the shop: what it resets',
  'ms-sites': 'Settings › Shop and sites: each shop (owner)',
  'ms-sites-manager': 'The same, as a manager sees it',
  'ms-add-shop': 'Add a shop: code suggested, hours copied',
  'ms-add-shop-error': 'A code another shop already uses',
  'ms-today-new': 'Today at a new shop: what to do next',
  'ms-tills': 'Settings › Till › Tills: every till, by shop',
};
export const ROWS = [
  { label: 'Choosing a shop', screens: ['ms-switch-open', 'ms-switched', 'ms-today-all', 'ms-pick-shop', 'ms-till-other', 'ms-one-shop'] },
  { label: 'Prices and services by shop', screens: ['ms-service-price', 'ms-service-not-offered', 'ms-services-differs', 'ms-product-price'] },
  { label: 'People and booking', screens: ['ms-person', 'ms-book-shop', 'ms-book-shop-chosen', 'ms-book-shop-change'] },
  { label: 'Adding a shop, and its tills', screens: ['ms-sites', 'ms-sites-manager', 'ms-add-shop', 'ms-add-shop-error', 'ms-today-new', 'ms-tills'] },
];
