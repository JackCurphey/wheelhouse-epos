// Journey 2 — Buy online / click and collect, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-buy-online-review.md
// UI audit: docs/design/user-journeys/online-ui-audit.md (decision 9: every
// recommendation taken)
//
// Decision 1: pay online, collect from a shop — with room for delivery
// (checkout's "How you'll get it" is a choice with one option; every order
// records how it reaches the customer; the staff list has a "How" column).
// 2: each shop chooses what its website sells (on the shelf; any of our
// shops; also ordered in). 3: the website starts with everything or nothing,
// then switches on categories and products. 4: no account needed; saving
// details offered after. 5: card, Apple Pay, Google Pay, gift cards, store
// credit. 6: staff see one list in three groups. 7: not collected — a
// reminder, then Today; the customer can cancel until it's ready; staff can
// mark an item "Can't supply this". 8: the shop is chosen once and
// remembered across the website.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Maya Patel (07700 900 142, maya@example.test), Shimano brake pads B05S-RX
// (£28.00), Jo Taylor, Jack Lewis, the stockroom's example categories
// (Bearings, Drivetrain › Derailleurs). Other products, order numbers,
// totals and times are bracketed placeholders.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, onlineFolds, ONLINE_INTRO, withOnlineArea, rowSwitch, msgFolds, MSG_INTRO } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { today } from './opening.mjs';
import { withSite } from './diary.mjs';
import { msgListOpen } from './setup.mjs';
import { screens as tillScreens } from './till.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const sr = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const PADS = { name: 'Shimano brake pads', code: 'B05S-RX', price: '£28.00' };
const ORDER = 'Order [order number]';
// Audit H3: Maya's example order was paid partly with store credit, so every
// refund line is built from how it was paid.
const PAID_BY = [['Store credit', '£[£]'], ['Card', '£[£]']];
const paidLines = () => PAID_BY.map(([k, v]) => `<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px"><span>${k}</span>${mono(v)}</div>`).join('');
const refundWords = (what = '£[total]') => `${what} goes back the way you paid: £[£] to your store credit and £[£] to your card`;

// ---------- The website frame (App map 15) ----------
// basket: how many items the header's basket shows. twoShops: decision 8's
// "Collecting from Bolton" in the header (audit L1: search shortened, the
// shop's name truncates with the full name in its label). toast: a message
// over the page (audit L2).
const site = (content, { basket = 0, twoShops = false, shopChosen = true, toast = '' } = {}) => {
  if (twoShops && SIZE !== 'desktop') content = `<a href="#" style="flex-shrink: 0; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 15px; color: ${C.ink}; text-decoration: none">${icon('store', 16)}<span style="flex-grow: 1">${shopChosen ? 'Collecting from <strong>Bolton</strong>' : '<strong>Choose a shop to collect from</strong>'}</span>${shopChosen ? '<span style="font-weight: 600; text-decoration: underline">Change</span>' : ''}</a>${content}`;
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 18px">${content}</div>`;
  let html = SIZE === 'desktop' ? siteDesktop('sand', 'Shop', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Shop') : sitePhone('sand', { content: body });
  if (basket) html = html.replace(/aria-label="Basket, 0 items"/g, `aria-label="Basket, ${basket} item${basket > 1 ? 's' : ''}"`).replace(/(aria-label="Basket, \d items?"[^>]*>[\s\S]*?<\/svg>)Basket<\/a>/, `$1Basket · ${basket}</a>`);
  if (twoShops) {
    const where = `<a href="#" aria-label="${shopChosen ? 'Collecting from North Street Cycles, Bolton — change the shop' : 'Choose a shop to collect from'}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; max-width: 230px; padding: 0 10px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 14px; color: ${C.ink}; text-decoration: none; white-space: nowrap; overflow: hidden">${icon('store', 16)}<span style="overflow: hidden; text-overflow: ellipsis">${shopChosen ? 'Collecting from <strong>Bolton</strong> · Change' : '<strong>Choose a shop</strong>'}</span></a>`;
    html = html.replace(/(<label style="display: flex; align-items: center; gap: 8px; width: 240px;)/, `${where}$1`).replace('width: 240px;', 'width: 150px;').replace('placeholder="Search the shop"', 'placeholder="Search"').replace('display: flex; align-items: center; gap: 28px;', 'display: flex; align-items: center; gap: 20px; white-space: nowrap;');
  }
  if (toast) html = html.replace(/<main id="main-content" style="/, '<main id="main-content" style="position: relative; ').replace('</main>', `${toast}</main>`);
  return html;
};
const h1 = (t) => `<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 30}px; font-weight: 700">${t}</h1>`;
const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 18px; font-weight: 700">${t}</h2>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const section = (title, inner, id) => `<section aria-labelledby="${id}" style="flex-shrink: 0">${box(`${h2(title, id)}${inner}`)}</section>`;
const two = (left, right, rightW = 380) => (isPhone() ? `${left}${right}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) ${rightW}px; gap: 20px; align-items: start">${left}${right}</div>`);
const stack = (...parts) => `<div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">${parts.join('')}</div>`;
const sumRow = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: ${strong ? 17 : 15}px; font-weight: ${strong ? 700 : 400}${strong ? `; border-top: 1px solid ${C.border}; padding-top: 10px` : ''}"><span>${k}</span>${mono(v)}</div>`;
const shopLines = (name = 'Bolton') => `<div style="display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, ${name}</strong><span>Open [opening hours]</span><span>[Shop address] · <a href="tel:[shop phone]" style="color: ${C.ink}">[shop phone]</a></span></div>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const off = (html, why = '') => html.replace('<button', '<button aria-disabled="true"').replace('style="', 'style="opacity: 0.45; ') + (why ? `<p style="margin: 0; font-size: 13px; color: ${C.ink}">${why}</p>` : '');
// Audit L4: a live region only where the text appears after an action.
const msg = (t, tone = 'ok', live = false) => `<p${live ? ` role="${tone === 'bad' ? 'alert' : 'status'}"` : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' || tone === 'bad' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' || tone === 'bad' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' || tone === 'bad' ? 'alert' : tone === 'ok' ? 'check' : 'store', 18)}<span>${t}</span></p>`;
const siteToast = (t, action = '') => `<div role="status" style="position: absolute; right: 40px; top: 16px; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 15px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}${t}${action}</div>`;
// A board scrolled part-way down its page.
const scrolled = (html, px) => `<style>.on-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;?/, '<div data-scroll class="on-scrolled" style="$1overflow-y: hidden;')}`;

// ---------- A product (decisions 2, 8; audit M3, M9, M13, L2) ----------
const AVAIL = {
  shelf: [msg('<strong>Ready today at Bolton</strong> · [n] in stock'), true],
  other: [msg('<strong>Ready at Bolton in [n] days</strong> — it’s at our [Second site] shop, and we’ll bring it over', 'grey'), true],
  orderin: [msg('<strong>Ready at Bolton in about [n] days</strong> — we order it in for you', 'grey'), true],
  out: [msg('<strong>Not in stock at Bolton</strong>', 'warn'), false],
  outOther: [`<div style="display: flex; flex-direction: column; gap: 8px">${msg('<strong>Not in stock at Bolton</strong> — in stock at our [Second site] shop', 'warn')}${button('Collect from [Second site] instead', { variant: 'default' })}</div>`, false],
  noshop: [msg('Choose a shop to see when it’s ready', 'grey'), true],
  offline: [msg('Ask in the shop, or call us, to buy this', 'grey'), false],
};
const qty = (name, n = 1, max = false) => `<div role="group" aria-label="Quantity of ${esc(name)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden"><button type="button" aria-label="One fewer ${esc(name)}" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span aria-live="polite" style="min-width: 40px; text-align: center; font-size: 16px; font-weight: 700">${n}</span><button type="button" aria-label="One more ${esc(name)}"${max ? ' aria-disabled="true"' : ''} style="width: 44px; height: 44px; border: 0; background: ${C.panel}; color: ${max ? C.muted : C.ink}; ${max ? 'opacity: 0.45; ' : ''}">${icon('plus', 16)}</button></div>`;
const askShop = `<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 15px; line-height: 1.5"><strong>Ask the shop about it</strong><span>Call <a href="tel:[shop phone]" style="color: ${C.ink}">[shop phone]</a> or email <a href="mailto:[shop email]" style="color: ${C.ink}">[shop email]</a></span></div>`;
const product = (avail = 'shelf', opts = {}) => {
  const [line, canBuy] = AVAIL[avail];
  const photo = `<div role="img" aria-label="Photo of the product" style="aspect-ratio: 4 / 3; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 15px">[Photo of the product]</div>`;
  const buy = canBuy ? `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">${qty(PADS.name)}${button('Add to basket')}</div>${avail === 'noshop' ? note('Add to basket asks which shop first, then adds it.') : ''}` : askShop;
  const info = stack(
    `<nav aria-label="You are here" style="font-size: 14px; color: ${C.muted}"><a href="#" style="color: inherit">Shop</a> › <a href="#" style="color: inherit">[Category]</a></nav>`,
    `<div style="display: flex; flex-direction: column; gap: 6px">${h1(`${PADS.name} ${mono(PADS.code)}`)}<span style="font-size: 24px; font-weight: 700">${mono(PADS.price)}</span><span style="font-size: 13px; color: ${C.muted}">Includes VAT</span></div>`,
    line, buy,
    `<p style="margin: 0; font-size: 15px; line-height: 1.55">[Product description]</p>`,
  );
  return site(isPhone() ? `${photo}${info}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start">${photo}${info}</div>`, opts);
};
// Decision 8 (audit M3): nothing chosen; one tap on a shop saves it, as
// booking's "Which shop?" (Multiple sites 6).
const shopOption = (name, on, sub, type = 'radio') => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="${type}" name="pick"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></label>`;
const shopButton = (name) => `<button type="button" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%; min-height: 64px; padding: 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}">[Shop address] · open [opening hours]</span></button>`;
const chooseShop = () => popup('cs-title', 'Which shop will you collect from?', 'We’ll add it to your basket, remember the shop, and show when things are ready there', `<div role="group" aria-labelledby="cs-title" style="display: flex; flex-direction: column; gap: 10px">${shopButton('Bolton')}${shopButton('[Second site]')}</div>`, button('Cancel', { variant: 'ghost' }), 520);

// ---------- The basket (audit H1, L2) ----------
const lineTotal = (each, n) => (n > 1 ? `<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px">${mono('[£ line total]', 'font-size: 16px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">${mono(each)} each</span></span>` : mono(each, 'font-size: 16px; font-weight: 700'));
const basketLine = (name, sub, price, where, { n = 1, max = false, changed = '' } = {}) => `<div role="listitem" style="display: flex; gap: 14px; align-items: flex-start; padding: 14px 0; border-top: 1px solid ${C.border}"><div role="img" aria-label="Photo of ${esc(name)}" style="flex-shrink: 0; width: 72px; height: 54px; border-radius: 8px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></div><div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span>${changed || `<span style="font-size: 14px">${where}</span>`}<div style="display: flex; align-items: center; gap: 14px">${qty(name, n, max)}${linkBtn('Remove', `Remove ${name}`)}</div></div>${lineTotal(price, n)}</div>`;
const summary = (rows, cta) => box(`${h2('Your order', 'sum-h')}${rows.join('')}${cta}`);
const basket = (changed = false) => site(`${h1('Your basket')}${two(
  box(`${changed ? msg('<strong>Something in your basket changed.</strong> Sort the lines marked below before checking out.', 'warn', true) : ''}<div role="list">${basketLine(PADS.name, mono(PADS.code), PADS.price, 'Ready today at Bolton', changed ? { n: 1, max: true, changed: msg('Only 1 left at Bolton — we’ve changed it to 1', 'warn') } : { n: 2 })}${basketLine('[Product]', '[Size or colour]', '[£ price]', 'Ready at Bolton in [n] days', changed ? { changed: msg('No longer in stock at Bolton or [Second site] — remove it to carry on', 'warn') } : {})}</div>`),
  summary([sumRow(changed ? '2 items' : '3 items', '£[total]'), sumRow('Collect from Bolton', 'Free'), sumRow('Total (includes VAT)', '£[total]', true)], changed ? off(button('Go to checkout', { block: true }), 'Remove the item that’s no longer in stock first.') : `${note('Ready to collect when the last item is — about [n] days.')}${button('Go to checkout', { block: true })}`),
)}`, { basket: changed ? 2 : 3 });
const basketEmpty = () => site(`${h1('Your basket')}${box(`${msg(`Removed ${PADS.name}. <button type="button" style="min-height: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; font-size: 15px; font-weight: 700; color: inherit; text-decoration: underline">Undo</button>`, 'grey', true)}<p style="margin: 0; font-size: 16px">Your basket is empty.</p><a href="#" style="display: inline-flex; align-self: flex-start; align-items: center; min-height: 44px; font-size: 15px; font-weight: 600; color: ${C.ink}">Carry on shopping</a>`)}`);

// ---------- Checkout: one page (decisions 1, 4, 5; audit H1, H2, H6, M7, M10) ----------
// "How you'll get it" is a choice with one option today (decision 1).
const how = () => section('How you’ll get it', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">How you’ll get it</legend>${shopOption('Collect from North Street Cycles, Bolton', true, 'Free · ready in about [n] days · open [opening hours] · [Shop address]')}</fieldset>`, 'co-how');
const details = (signedIn, errors = false) => section('Your details', signedIn
  ? `<p style="margin: 0; font-size: 15px; line-height: 1.6"><strong>Maya Patel</strong><br>maya@example.test · ${mono('07700 900 142')}</p><p style="margin: 0; font-size: 14px; color: ${C.muted}">Signed in · <a href="#" style="color: ${C.ink}">Not you?</a> · <a href="#" style="color: ${C.ink}">Change</a></p>`
  : `${errors ? msg('Check the 2 boxes marked below.', 'bad', true) : ''}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Name', errors ? { value: '', error: 'Enter your name', autocomplete: 'name', linked: true } : { value: 'Maya Patel', autocomplete: 'name', linked: true })}${field('Phone', { value: '07700 900 142', type: 'tel', autocomplete: 'tel', linked: true })}</div>${field('Email', errors ? { value: 'maya@example', type: 'email', error: 'Check your email address — it needs an @ and a dot, like name@example.com', autocomplete: 'email', linked: true } : { value: 'maya@example.test', type: 'email', hint: 'For your receipt and to tell you when it’s ready.', autocomplete: 'email', linked: true })}<p style="margin: 0; font-size: 14px; color: ${C.muted}">Bought here before? <a href="#" style="color: ${C.ink}">Sign in</a> to fill this in.</p>`, 'co-details');
const wallets = `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">${['Apple Pay', 'Google Pay'].map((w) => `<button type="button" style="min-height: 48px; border-radius: 8px; border: 1px solid ${C.ink}; background: ${C.ink}; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 700">Pay with ${w}</button>`).join('')}</div>`;
const cardForm = (error = '') => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 10px; border: 1px solid ${error ? C.danger : C.border}; background: ${C.panel}"><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.muted}">${icon('lock', 14)}Card details go straight to [payment provider]</span>${field('Card number', { placeholder: '[card number]', autocomplete: 'cc-number', linked: true })}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">${field('Expiry', { placeholder: 'MM / YY', autocomplete: 'cc-exp', linked: true })}${field('Security code', { placeholder: '3 digits', autocomplete: 'cc-csc', linked: true })}</div>${error ? `<p style="margin: 0; display: flex; gap: 8px; font-size: 14px; font-weight: 600; color: ${C.danger}">${icon('alert', 16)}${error}</p>` : ''}</div>`;
const creditBox = (on) => `<label style="display: flex; gap: 12px; align-items: flex-start; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 1px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Use my store credit · ${mono('£[credit]')}</span><span style="font-size: 13px; color: ${C.muted}">Ticked for you. The rest goes on your card.</span></span></label>`;
// Audit M7: the gift card box, its error, and what's left on the card.
const giftPart = (gift) => gift === 'applied'
  ? `<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px"><span style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px"><span style="display: inline-flex; flex-wrap: wrap; gap: 4px 8px; align-items: center">${icon('check', 16)}Gift card ${mono('[gift card code]', 'white-space: nowrap')} · ${mono('£[£]')} used</span>${linkBtn('Remove', 'Remove gift card')}</span><span style="font-size: 14px; color: ${C.ink}">${mono('£[£]')} left on your gift card for next time</span></div>`
  : gift === 'entry'
    ? `<div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px"><div style="flex: 1 1 260px">${field('Gift card code', { value: '[gift card code]', error: 'We don’t recognise that code. Check it against your card, or ask the shop.', autocomplete: 'off', linked: true })}</div>${button('Use it', { variant: 'default' })}</div>`
    : linkBtn('Have a gift card? Add it');
const pay = ({ signedIn = false, credit = false, gift = '', error = '', covered = false } = {}) => section('Pay', covered
  ? `${creditBox(true)}${msg('Your store credit covers the whole order — nothing to pay by card.', 'ok', true)}`
  : `${signedIn ? creditBox(credit) : ''}${giftPart(gift)}${wallets}<div style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: ${C.muted}"><span style="flex-grow: 1; height: 1px; background: ${C.border}"></span>or pay by card<span style="flex-grow: 1; height: 1px; background: ${C.border}"></span></div>${cardForm(error)}`, 'co-pay');
const checkout = (opts = {}) => {
  const { credit, gift, covered, state = '', scroll = 0 } = opts;
  const rows = [sumRow(PADS.name, PADS.price), sumRow('[Product]', '[£ price]'), sumRow('Collect from Bolton', 'Free'), sumRow('Total (includes VAT)', '£[total]', true)];
  if (credit || covered) rows.push(sumRow('Store credit', covered ? '−£[total]' : '−£[credit]'));
  if (gift === 'applied') rows.push(sumRow('Gift card', '−£[£]'));
  if (credit || gift === 'applied' || covered) rows.push(sumRow('Left to pay', covered ? '£0.00' : '£[£]', true));
  const label = covered ? 'Place order' : credit || gift === 'applied' ? 'Pay £[£]' : 'Pay £[total]';
  // Audit H2: the moment of paying, and every answer, beside the Pay button.
  const cta = state === 'paying'
    ? off(button('Paying — please don’t close this page', { block: true }))
    : state === 'stock'
      ? `${msg('<strong>[Product] has just sold out at Bolton.</strong> Nothing has been taken. Remove it from your order to carry on.', 'bad', true)}${off(button(label, { block: true }))}`
      : state === 'unsure'
        ? msg('<strong>We couldn’t confirm your payment.</strong> Don’t pay again — we’ll email maya@example.test within [n] minutes to say whether it went through.', 'bad', true)
        : `${opts.error ? msg('Your card was declined — nothing has been taken. Try another card, or Apple Pay or Google Pay.', 'bad', true) : ''}${button(label, { block: true })}`;
  const keep = credit || gift === 'applied' || covered ? note('Your store credit and gift card are only used once the order is paid.') : '';
  const terms = `<p style="margin: 0; font-size: 13px; color: ${C.muted}; line-height: 1.5">By paying you agree to our <a href="#" style="color: ${C.ink}">terms</a>. You can cancel for a full refund until your order is ready.</p>`;
  const sc = isPhone() ? (opts.pscroll ?? 0) : scroll;
  // On a phone the order sits at the top and Pay stays in a bar along the
  // bottom, so the button and its messages are always in view.
  const left = (isPhone() ? stack(h1('Checkout'), summary(rows, terms), how(), details(opts.signedIn, opts.errors), pay(opts), '<div style="height: 150px"></div>') : stack(h1('Checkout'), how(), details(opts.signedIn, opts.errors), pay(opts))).replace('min-width: 0">', `min-width: 0${sc ? `; position: relative; top: -${sc}px` : ''}">`);
  const bar = `<div style="position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 8px; background: ${C.panel}; border-top: 1px solid ${C.border}">${cta}${keep}</div>`;
  const html = isPhone() ? site(left, { basket: 2, toast: bar }) : site(`${two(left, `<div style="position: sticky; top: 0">${summary(rows, `${cta}${keep}${terms}`)}</div>`)}`, { basket: 2 });
  return sc ? html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;?/, '<div data-scroll style="$1overflow-y: hidden;') : html;
};
// The bank's own check opens over checkout (the provider's window; audit H2).
const bankCheck = () => popup('bk-title', 'Your bank wants to check it’s you', 'From [payment provider], for £[total] to North Street Cycles', `<div role="img" aria-label="Your bank's check" style="height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed ${C.border}; color: ${C.muted}; font-size: 15px; text-align: center; padding: 12px">[Your bank’s check — for example, approve it in your banking app]</div>${note('Nothing is taken until your bank says yes. Then you’ll come straight back here.')}`, button('Cancel and go back', { variant: 'ghost' }), 520);

// ---------- After paying (decision 4; audit H3, H6, M6, L3) ----------
const bigOrder = () => `<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; color: ${C.muted}">Your order number</span>${mono('[order number]', 'font-size: 28px; font-weight: 700')}</span>`;
const confirmed = (saving = false) => site(`${two(stack(
  `<div style="display: flex; flex-direction: column; gap: 10px">${msg('Paid · £[total]', 'ok', true)}${h1('Thanks, Maya — your order is in')}${bigOrder()}<span style="font-size: 15px">We’ve emailed a copy to maya@example.test · <a href="#" style="color: ${C.ink}">Not right? Change email</a></span></div>`,
  section('What happens next', `<ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5"><li>We get it ready — about [n] days, as one item comes from our [Second site] shop.</li><li>We tell you when it’s ready to collect.</li><li>Come in and give your name or order number. Nothing more to pay.</li></ol>${shopLines()}`, 'cf-next'),
  section('How you paid', paidLines(), 'cf-paid'),
), stack(
  saving
    ? section('Save your details for next time', `<p style="margin: 0; font-size: 15px; line-height: 1.5">We’ve sent a code to maya@example.test.</p>${field('Code from the email', { placeholder: '6 digits', autocomplete: 'one-time-code', linked: true })}${button('Save my details', { block: true })}${linkBtn('Send a new code')}`, 'cf-save')
    : section('Save your details for next time', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Then you won’t type them again, and this order shows in your account. No password — we’ll email you a code.</p>${button('Save my details', { block: true })}`, 'cf-save'),
  button('See your order', { variant: 'default', block: true }),
  note('Your confirmation email has a link back to this order.'),
))}`);

// ---------- The order's own page (decisions 1, 7; audit H3, M4, L3, L5) ----------
// The steps end in "Ready to collect" now; "Sent" can follow when delivery
// comes (decision 1).
const steps = (list, at) => `<ol aria-label="Where your order is" style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: ${isPhone() ? 8 : 18}px">${list.map((t, i) => {
  const done = i < at, now = i === at;
  return `<li${now ? ' aria-current="step"' : ''} style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: ${now ? 700 : 500}; color: ${done || now ? C.ink : C.muted}"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; ${now ? `background: ${C.ink}; color: #ffffff` : done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 1px solid ${C.input}`}">${done || now ? icon('check', 12) : ''}</span>${t}${done ? sr(' (done)') : ''}</li>`;
}).join('')}</ol>`;
const itemRow = (name, sub, price, where) => `<div role="listitem" style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span>${where ? `<span style="font-size: 14px">${where}</span>` : ''}</span>${mono(price, 'font-size: 15px')}</div>`;
const items = (where = ['On the shelf at Bolton', 'Coming from [Second site]']) => section('What you bought', `<div role="list">${itemRow(PADS.name, mono(PADS.code), PADS.price, where[0])}${itemRow('[Product]', '[Size or colour]', '[£ price]', where[1])}</div>${sumRow('Paid on [date]', '£[total]', true)}<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">How you paid</span>${paidLines()}</div>`, 'or-items');
const receipt = `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: 600; color: ${C.ink}">Receipt</a>`;
const orderPage = (state = 'getting') => {
  const LIST = ['Ordered', state === 'moving' ? 'Coming from [Second site]' : 'Getting it ready', 'Ready to collect', 'Collected'];
  const at = { getting: 1, moving: 1, ready: 2, collected: 3, clash: 2, cancelled: -1, shopCancelled: -1, cantSupply: 1 }[state];
  const title = { getting: 'We’re getting your order ready', moving: 'Your order is on its way to Bolton', ready: 'Your order is ready to collect', clash: 'Your order is ready to collect', collected: 'Collected — thank you', cancelled: 'Order cancelled', shopCancelled: 'Order cancelled', cantSupply: 'We’re getting your order ready' }[state];
  const big = state === 'ready' || state === 'clash';
  const head = `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">${big ? 'Placed [date]' : `${ORDER} · placed [date]`}</span>${h1(title)}${big ? bigOrder() : ''}${state === 'cancelled' || state === 'shopCancelled' ? '' : steps(LIST, at)}</div>`;
  const ring = `<p style="margin: 0; font-size: 14px; line-height: 1.5">Changed your mind? Call or visit — <a href="tel:[shop phone]" style="color: ${C.ink}">[shop phone]</a>.</p>`;
  const side = {
    ready: section('Collect it', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Give your name or order number at the counter. It’s paid — nothing more to pay.</p>${shopLines()}${ring}${receipt}`, 'or-collect'),
    clash: section('Collect it', `${msg('<strong>Sorry — your order has just been marked ready, so it can’t be cancelled here.</strong> To cancel, call <a href="tel:[shop phone]" style="color: inherit">[shop phone]</a>.', 'bad', true)}${shopLines()}`, 'or-collect'),
    collected: section('Collected', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Collected on [date] from Bolton.</p>${receipt}`, 'or-collect'),
    cancelled: section('Your refund', `${msg(`${refundWords()}. Done on [date].`, 'ok')}<p style="margin: 0; font-size: 15px; line-height: 1.5">A card refund can take [n] working days to show on your statement.</p>`, 'or-refund'),
    shopCancelled: section('Your refund', `<p style="margin: 0; font-size: 15px; line-height: 1.5">We cancelled this order because it wasn’t collected by [date], after we reminded you on [date].</p>${msg(`${refundWords()}.`, 'ok')}`, 'or-refund'),
  }[state] || section('Collect from', `${shopLines()}<p style="margin: 0; font-size: 15px">We’ll tell you when it’s ready — about [n] days.</p><div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 6px">${button('Cancel this order', { variant: 'default' })}${note('Full refund, the way you paid, until it’s ready.')}</div>`, 'or-collect');
  const cant = state === 'cantSupply' ? msg('<strong>Sorry — we couldn’t supply [Product].</strong> “[their reason]” [£ price] has gone back the way you paid: to your card. The rest of your order is on its way.', 'warn') : '';
  const where = state === 'moving' ? ['On the shelf at Bolton', 'Coming from [Second site] · arrives [day]'] : state === 'cantSupply' ? ['On the shelf at Bolton', 'Couldn’t supply · refunded'] : ['cancelled', 'shopCancelled', 'collected'].includes(state) ? ['', ''] : undefined;
  return site(`${head}${cant}${two(items(where), side)}`);
};
const cancelOrder = () => popup('co-cancel', 'Cancel this order?', `${ORDER} · £[total]`, `<p style="margin: 0; font-size: 15px; line-height: 1.5">${refundWords()}. A card refund can take [n] working days to show. We’ll put the items back on sale.</p>`, `${button('Keep my order', { variant: 'ghost' })}${button('Cancel the order', { variant: 'danger' })}`, 480);

// ---------- The emails (audit M5) ----------
const email = () => {
  const [W, H] = SIZE === 'phone' ? [390, 844] : SIZE === 'tablet' ? [1180, 820] : [1280, 800];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${isPhone() ? 12 : 40}px; display: flex; justify-content: center; background: ${C.mutedBg}"><article aria-label="Email" style="width: 100%; max-width: 620px; align-self: flex-start; box-sizing: border-box; padding: ${isPhone() ? 18 : 28}px; border-radius: 12px; background: ${C.panel}; border: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 14px; font-size: 15px; line-height: 1.55">
<div style="display: flex; flex-direction: column; gap: 2px; padding-bottom: 12px; border-bottom: 1px solid ${C.border}; font-size: 13px; color: ${C.muted}"><span>From: North Street Cycles &lt;[email address]&gt;</span><span>To: maya@example.test</span><span style="font-size: 16px; font-weight: 700; color: ${C.ink}">Your order is ready to collect</span></div>
<p style="margin: 0">Hi Maya,</p><p style="margin: 0">Your order ${mono('[order number]')} is ready at North Street Cycles, Bolton. It’s paid — just give your name or order number at the counter.</p>
${shopLines()}
${button('See your order')}
<p style="margin: 0; font-size: 13px; color: ${C.muted}">We’ll keep it for you until [date]. Can’t make it? Call us on [shop phone].</p></article></div>`;
};
// The five online-order messages now live in setup.mjs's Messages list.
const messagesBoard = () => scrolled(settingsPage('messages', 'Messages', MSG_INTRO, msgFolds({ list: msgListOpen() }), { who: OWNER }), 120);

// ---------- The shop's side: Front desk › Online orders (decision 6; audit H4, H5, H6, M1, M2, M10, M11) ----------
// Audit M11: the sidebar item counts orders to get ready; search finds orders.
const countIn = (html, count = '3') => html.replace(/(>Online orders<\/span>)(<\/a>)/, `$1<span style="margin-left: auto; padding: 0 7px; border-radius: 999px; background: ${C.highlight}; color: ${C.ink}; font-size: 12px; font-weight: 700">${count}${sr(' to get ready')}</span>$2`);
const staffPage = (title, content, who = STAFF, count = '3') => countIn(page('orders', title, content, who), count);
const from = (t, tone = 'grey') => badge(t, tone);
const cols = () => (isPhone() ? '1fr' : '190px minmax(0, 1fr) 130px 190px');
const orderRow = ({ who, items: its, how = 'Collect · Bolton', when, action, flag = '' }) => `<div role="listitem" style="display: grid; grid-template-columns: ${cols()}; gap: ${isPhone() ? 6 : 16}px; align-items: center; padding: 12px 0; border-top: 1px solid ${C.border}"><a href="#" style="display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; color: ${C.ink}; text-decoration: none"><span style="font-size: 15px; font-weight: 700; text-decoration: underline">${who}</span><span style="font-size: 13px; color: ${C.muted}">${ORDER} · ${when}</span>${flag ? `<span style="margin-top: 2px">${flag}</span>` : ''}</a><div style="display: flex; flex-direction: column; gap: 4px">${sr('Items: ')}${its}</div><span style="font-size: 14px">${sr('How: ')}${how}</span><span style="justify-self: ${isPhone() ? 'start' : 'end'}">${action}</span></div>`;
const it = (name, tag = '') => `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px">${name}${tag}</span>`;
const group = (title, count, rows, sub = '') => section(`${title} · ${count}`, `${sub ? note(sub) : ''}${isPhone() || !rows.length ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${cols()}; gap: 16px; font-size: 12px; font-weight: 700; color: ${C.muted}"><span>Customer</span><span>Items</span><span>How</span><span></span></div>`}<div role="list">${rows.join('')}</div>`, `g-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`);
const handOver = (who) => button('Hand over', { variant: 'default' }).replace('<button', `<button aria-label="Hand over ${esc(who)}’s order"`);
const ordersPage = ({ toast = false, arrived = false } = {}) => {
  const maya = arrived
    ? orderRow({ who: 'Maya Patel', when: 'paid [time]', items: `${it(`${PADS.name} ${mono(PADS.code)}`, from('On the shelf'))}${it('[Product]', from('Arrived from [Second site]', 'green'))}`, action: button('Mark ready') })
    : orderRow({ who: 'Maya Patel', when: 'paid [time]', items: `${it(`${PADS.name} ${mono(PADS.code)}`, from('On the shelf'))}${it('[Product]', from('On its way from [Second site]'))}`, action: badge('Waiting for 1 item', 'amber') });
  const content = `<div style="position: relative; height: 100%"><div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, Bolton')}
${group('To get ready', toast ? 2 : 3, [
  ...(toast ? [] : [maya]),
  orderRow({ who: '[Customer]', when: 'paid [time]', items: it('[Product] × 2', from('On the shelf')), action: button('Mark ready') }),
  orderRow({ who: '[Customer]', when: 'paid [time]', items: it('[Product]', from('Ordered from [supplier] · due [date]')), action: badge('Due [date]', 'grey') }),
], 'Mark ready when everything’s on the shelf for collection — the customer is told straight away.')}
${group('Ready to collect', toast ? 3 : 2, [
  ...(toast ? [orderRow({ who: '[Customer]', when: 'ready just now', items: it('[Product] × 2'), action: handOver('[Customer]') })] : []),
  orderRow({ who: '[Customer]', when: 'ready since [time]', items: it('[Product]'), action: handOver('[Customer]'), flag: from('Email didn’t arrive · [phone]', 'amber') }),
  orderRow({ who: '[Customer]', when: 'ready since [date]', items: it('[Product]'), action: handOver('[Customer]'), flag: from('Not collected · [n] days', 'amber') }),
], 'Hand over opens the till’s hand-over for that order — it’s already paid.')}
${group('Collected', '[n]', [orderRow({ who: '[Customer]', when: 'collected [time]', items: it('[Product]'), action: `<span style="font-size: 14px; color: ${C.muted}">by Jo Taylor</span>` })], 'The last 7 days. Older orders are on each customer’s page.')}
</div>${toast ? `<div role="status" style="position: absolute; ${isPhone() ? 'left: 0; right: 0; bottom: 12px; white-space: normal' : 'left: 50%; bottom: 20px; transform: translateX(-50%); white-space: nowrap'}; display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="flex-grow: 1">Ready. The email goes to [Customer] in [n] seconds</span><button type="button" style="flex-shrink: 0; min-height: 44px; padding: 0 14px; border: 0; border-radius: 6px; background: rgba(255,255,255,0.16); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 600">Undo</button></div>` : ''}</div>`;
  return staffPage('Online orders', content, STAFF, toast ? '2' : '3');
};
// [Second site]'s side of a move (audit M1).
const secondSite = () => withSite('[Second site]', () => staffPage('Online orders', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, [Second site]')}
${group('To send to another shop', 1, [orderRow({ who: 'Maya Patel', when: 'for Bolton', how: 'Send to Bolton', items: it('[Product]', from('On the shelf')), action: button('Send to Bolton') })], 'Online orders collected at another shop. Sending starts a stock transfer, as in Stock.')}
${group('To get ready', 0, [], 'Nothing to get ready here.')}</div>`, STAFF, '0'));
// One order, opened from the list. Audit M2: Close left, the main action
// right; Cancel and refund in the body, beside Can't supply.
const staffItem = (name, sub, price, tag) => `<div role="listitem" style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: ${C.muted}">${sub}${tag}</span></span>${mono(price, 'font-size: 15px')}</div>`;
const orderFacts = () => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 12px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><span><strong>How</strong><br>Collect from Bolton</span><span><strong>Paid [time]</strong><br>${PAID_BY.map(([k, v]) => `${k} ${mono(v)}`).join('<br>')}</span><span><strong>Customer</strong><br>maya@example.test<br><a href="tel:07700900142" style="color: ${C.ink}">${mono('07700 900 142')}</a></span></div>`;
const redBtn = (t) => `<button type="button" style="min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px solid ${C.danger}; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.danger}">${t}</button>`;
const orderDialog = (ready = false) => popup('od-title', `${ORDER} · Maya Patel`, ready ? 'Ready since [time] · emailed' : '1 item still on its way', `<div role="list">${staffItem(PADS.name, `${mono(PADS.code)} · [shelf]`, PADS.price, from('On the shelf'))}${staffItem('[Product]', '[Size or colour]', '[£ price]', ready ? from('Here', 'green') : from('On its way from [Second site] · arrives [day]'))}</div>
${orderFacts()}
<div style="display: flex; flex-wrap: wrap; gap: 10px; padding-top: 10px; border-top: 1px solid ${C.border}">${ready ? button('Not ready after all', { variant: 'default' }) : button('Can’t supply an item', { variant: 'default' })}${redBtn('Cancel and refund')}</div>
${ready ? '' : `<p style="margin: 0; font-size: 14px">Mark ready isn’t available yet: 1 item is still on its way from [Second site].</p>`}`, `${button('Close', { variant: 'ghost' })}${ready ? button('Hand over') : off(button('Mark ready'))}`, 640);
const cancelRefund = () => popup('cr-title', 'Cancel and refund this order?', `${ORDER} · Maya Patel`, `<p style="margin: 0; font-size: 15px; line-height: 1.5">£[total] goes back the way Maya paid: £[£] to her store credit, £[£] to her card. The items go back on sale.</p>
${field('Why are you cancelling? (needed — Maya sees this)', { placeholder: 'e.g. not collected after we reminded her', linked: true })}
${note('Maya gets the “Order cancelled” email with your reason.')}`, `${button('Keep the order', { variant: 'ghost' })}${button('Cancel and refund', { variant: 'danger' })}`, 560);
const cantSupply = () => popup('cs2-title', 'Can’t supply an item', `${ORDER} · Maya Patel`, `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 4px">Which item?</legend>${shopOption(`${PADS.name} ${mono(PADS.code)}`, false, `${PADS.price} · on the shelf`)}${shopOption('[Product]', true, '[£ price] · on its way from [Second site]')}</fieldset>
${field('Tell Maya why (needed)', { placeholder: 'e.g. it arrived damaged from [Second site]', linked: true })}
${note('[£ price] goes back to Maya’s card, the way it was paid, and she’s emailed your reason. The rest of the order carries on.')}`, `${button('Keep it', { variant: 'ghost' })}${button('Refund this item')}`, 560);
// Audit H4: after the email has gone, putting it back offers a sorry email.
const notReady = () => popup('nr-title', 'Not ready after all?', `${ORDER} · Maya Patel was told it’s ready at [time]`, `<p style="margin: 0; font-size: 15px; line-height: 1.5">It goes back to “To get ready”.</p>
<label style="display: flex; gap: 12px; align-items: flex-start; min-height: 44px; cursor: pointer"><input type="checkbox" checked style="width: 22px; height: 22px; margin: 1px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Send Maya “Sorry, not ready yet”</span><span style="font-size: 13px; color: ${C.muted}">The wording is in Settings › Messages</span></span></label>`, `${button('Keep it ready', { variant: 'ghost' })}${button('Move it back')}`, 520);
// Audit H5: Hand over opens the till's hand-over for the order (Selling at
// the till); an item that was refunded is said, not ticked.
const handOverTill = (refunded = false) => {
  const b = tillScreens['till-collect'][SIZE];
  return refunded ? b.replace('Tick each item as you hand it over.', 'Tick each item as you hand it over. One item couldn’t be supplied and was refunded — nothing to hand over for it.') : b;
};

// ---------- Settings › Front desk › Online orders (decisions 2, 3, 5, 7; audit M13) ----------
const sellsOpen = (pick = 0) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 4px">Customers can buy</legend>
${shopOption('Only what’s on the shelf', pick === 0, 'At the shop they collect from. Ready the same day.')}
${shopOption('Anything in stock at any of our shops', pick === 1, 'We move it across with a stock transfer. The website says “Ready at Bolton in [n] days”. Only shown when you have more than one shop.')}
${shopOption('Also things we can order in', pick === 2, 'From the supplier. The website says “Ready in about [n] days”. The order arrives as “To order from [supplier]”.')}</fieldset>
${pick > 0 ? `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Moving between shops takes', { value: '[n] days' })}${pick === 2 ? field('Ordering in takes about', { value: '[n] days', hint: 'Or each supplier’s own time, from their details in Stockroom.' }) : ''}</div>` : ''}
${note('Stock is held for the customer as soon as they’ve paid, and checked again just before they pay.')}`;
const showOpen = () => `<p style="margin: 0; font-size: 15px">Started with every product online on [date].</p>
${['Bearings', 'Drivetrain › Derailleurs', '[Category]'].map((c, i) => rowSwitch(c, i < 2)).join('')}
<p style="margin: 0; font-size: 14px">[n] products are set differently from their category. ${linkBtn('See them')}</p>
${note('New products follow their category. Each product’s page in Stock has its own “Show on website” switch.')}`;
const payOpen = () => `${msg('Connected to [payment provider] by Jack Lewis on [date]')}
${rowSwitch('Apple Pay and Google Pay', true)}${rowSwitch('Gift cards', true)}${rowSwitch('Store credit (for signed-in customers)', true)}`;
const collectOpen = () => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Remind the customer after', { value: '[n] days' })}${field('Show on Today after', { value: '[n] days' })}</div>${note('Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.')}`;
const master = (on) => card(`<div style="padding: 4px 18px">${rowSwitch('Buying online', on)}<p style="margin: 0 0 12px; font-size: 14px; color: ${C.muted}">${on ? 'Customers can buy from your website and collect from the shop.' : 'Off: product pages show prices and “Ask in the shop, or call us, to buy this”.'}</p></div>`, 'flex-shrink: 0');
const onlineSettings = (open, { on = true } = {}) => withOnlineArea(() => settingsPage('online', 'Online orders', ONLINE_INTRO, onlineFolds(open), { who: OWNER })).replace(/(<section aria-labelledby="set-online"[^>]*><div[^>]*>[\s\S]*?<\/div>)/, `$1${master(on)}`);
const startQuestion = () => popup('st-title', 'How should your website start?', 'You’re turning on buying online', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 4px">Start with</legend>${shopOption('Every product online', true, 'Everything with a price shows. Switch off what you don’t want to sell online.')}${shopOption('Nothing online', false, 'Add categories and products as you go.')}</fieldset>${note('Either way, every category and product has its own “Show on website” switch afterwards.')}`, `${button('Not now', { variant: 'ghost' })}${button('Turn on buying online')}`, 560);

// ---------- The boards ----------
def('on-product', () => product('shelf'));
def('on-product-added', () => product('shelf', { basket: 1, toast: siteToast(`Added ${PADS.name}`, `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 6px; background: rgba(255,255,255,0.16); color: #ffffff; font-weight: 600; text-decoration: none">View basket</a>`) }));
def('on-product-two-shops', () => product('other', { twoShops: true }));
def('on-product-order-in', () => product('orderin', { twoShops: true }));
def('on-product-out', () => product('out'));
def('on-product-out-other', () => product('outOther', { twoShops: true }));
def('on-product-no-shop', () => product('noshop', { twoShops: true, shopChosen: false }));
def('on-choose-shop', () => overlay(product('noshop', { twoShops: true, shopChosen: false }), chooseShop()));
def('on-product-off', () => product('offline'));
def('on-basket', () => basket());
def('on-basket-changed', () => basket(true));
def('on-basket-empty', () => basketEmpty());
def('on-checkout', () => checkout());
def('on-checkout-errors', () => checkout({ errors: true, scroll: 130, pscroll: 470 }));
def('on-checkout-credit', () => checkout({ signedIn: true, credit: true, scroll: 200, pscroll: 560 }));
def('on-checkout-covered', () => checkout({ signedIn: true, covered: true, scroll: 200, pscroll: 560 }));
def('on-checkout-gift-code', () => checkout({ gift: 'entry', scroll: 330, pscroll: 880 }));
def('on-checkout-gift', () => checkout({ gift: 'applied', scroll: 330, pscroll: 880 }));
def('on-checkout-paying', () => checkout({ state: 'paying', scroll: 330, pscroll: 880 }));
def('on-checkout-bank', () => overlay(checkout({ state: 'paying', scroll: 330, pscroll: 880 }), bankCheck()));
def('on-checkout-declined', () => checkout({ error: 'Your card was declined — nothing has been taken.', scroll: 470, pscroll: 960 }));
def('on-checkout-unsure', () => checkout({ state: 'unsure', scroll: 330, pscroll: 880 }));
def('on-checkout-sold-out', () => checkout({ state: 'stock', scroll: 330, pscroll: 880 }));
def('on-confirmed', () => confirmed());
def('on-save-details', () => confirmed(true));
def('on-order', () => orderPage('getting'));
def('on-order-moving', () => orderPage('moving'));
def('on-order-ready', () => orderPage('ready'));
def('on-order-collected', () => orderPage('collected'));
def('on-order-cancel', () => overlay(orderPage('getting'), cancelOrder()));
def('on-order-cancelled', () => orderPage('cancelled'));
def('on-order-clash', () => orderPage('clash'));
def('on-order-shop-cancelled', () => orderPage('shopCancelled'));
def('on-order-cant-supply', () => orderPage('cantSupply'));
def('on-email-ready', () => email());
def('on-orders', () => ordersPage());
def('on-orders-ready', () => ordersPage({ toast: true }));
def('on-orders-arrived', () => ordersPage({ arrived: true }));
def('on-orders-second', () => secondSite());
def('on-order-staff', () => overlay(ordersPage(), orderDialog()));
def('on-order-staff-ready', () => overlay(ordersPage(), orderDialog(true)));
def('on-not-ready', () => overlay(ordersPage(), notReady()));
def('on-cant-supply', () => overlay(ordersPage(), cantSupply()));
def('on-cancel-refund', () => overlay(ordersPage(), cancelRefund()));
def('on-hand-over', () => handOverTill());
def('on-hand-over-refunded', () => handOverTill(true));
def('on-today', () => countIn(today({ onlineNew: true })));
def('on-today-uncollected', () => countIn(today({ onlineUncollected: true })));
def('on-settings', () => onlineSettings({ sells: sellsOpen(0) }));
def('on-settings-order-in', () => onlineSettings({ sells: sellsOpen(2) }));
def('on-settings-start', () => overlay(onlineSettings({}, { on: false }), startQuestion()));
def('on-settings-show', () => onlineSettings({ show: showOpen() }));
def('on-settings-pay', () => onlineSettings({ pay: payOpen(), collect: collectOpen() }));
def('on-messages', () => messagesBoard());

// Desktop, tablet and phone (tablet and phone drawn after the UI audit).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'on-product': 'A product: ready today at Bolton',
  'on-product-added': 'Added to the basket',
  'on-product-two-shops': 'Two shops: “Collecting from Bolton”, the item at the other shop',
  'on-product-order-in': 'An item the shop orders in',
  'on-product-out': 'Not in stock: ask the shop',
  'on-product-out-other': 'Not here, but in stock at the other shop',
  'on-product-no-shop': 'No shop chosen yet',
  'on-choose-shop': 'Which shop will you collect from? (one tap, asked once)',
  'on-product-off': 'Buying online switched off',
  'on-basket': 'The basket',
  'on-basket-changed': 'Something in the basket changed',
  'on-basket-empty': 'An empty basket, with Undo',
  'on-checkout': 'Checkout: how you’ll get it, your details, pay — one page',
  'on-checkout-errors': 'Details to check',
  'on-checkout-credit': 'Signed in, store credit used',
  'on-checkout-covered': 'Store credit covers it all: Place order',
  'on-checkout-gift-code': 'A gift card code not recognised',
  'on-checkout-gift': 'A gift card used, and what’s left on it',
  'on-checkout-paying': 'Paying — please don’t close this page',
  'on-checkout-bank': 'Your bank wants to check it’s you',
  'on-checkout-declined': 'Card declined: nothing taken',
  'on-checkout-unsure': 'Couldn’t confirm the payment: don’t pay again',
  'on-checkout-sold-out': 'Sold out just before paying: nothing taken',
  'on-confirmed': 'Order in: order number, what happens next, how you paid',
  'on-save-details': 'Save your details: the emailed code',
  'on-order': 'The order’s page: getting it ready',
  'on-order-moving': 'On its way from the other shop',
  'on-order-ready': 'Ready to collect',
  'on-order-collected': 'Collected, with the receipt',
  'on-order-cancel': 'Cancel this order? (until it’s ready)',
  'on-order-cancelled': 'Cancelled and refunded the way it was paid',
  'on-order-clash': 'Cancel pressed just after it was marked ready',
  'on-order-shop-cancelled': 'Cancelled by the shop: not collected',
  'on-order-cant-supply': 'An item the shop couldn’t supply, refunded',
  'on-email-ready': 'The “ready to collect” email',
  'on-orders': 'Front desk › Online orders: to get ready, ready, collected',
  'on-orders-ready': 'Marked ready: the email waits a few seconds, with Undo',
  'on-orders-arrived': 'The item arrived from the other shop: Mark ready',
  'on-orders-second': 'At [Second site]: an item to send to Bolton',
  'on-order-staff': 'One order: items, how it was paid, the customer',
  'on-order-staff-ready': 'A ready order: Hand over, or not ready after all',
  'on-not-ready': 'Not ready after all: a sorry email',
  'on-cant-supply': 'Can’t supply an item: refund it, with a reason',
  'on-cancel-refund': 'Cancel and refund: the way it was paid, with a reason',
  'on-hand-over': 'Hand over: the till’s hand-over for the order',
  'on-hand-over-refunded': 'Hand over with one item refunded',
  'on-today': 'Today: new online orders',
  'on-today-uncollected': 'Today: an order not collected — Contacted or Open',
  'on-settings': 'Settings › Online orders: buying online, what the website sells',
  'on-settings-order-in': 'Also things we order in: how long it takes',
  'on-settings-start': 'Turning on buying online: start with everything, or nothing',
  'on-settings-show': 'Showing products: switches on each category',
  'on-settings-pay': 'Paying online, and orders not collected',
  'on-messages': 'Settings › Messages: the online order messages',
};
export const ROWS = [
  { label: 'Finding it', screens: ['on-product', 'on-product-added', 'on-product-two-shops', 'on-product-order-in', 'on-product-out', 'on-product-out-other', 'on-product-no-shop', 'on-choose-shop', 'on-product-off'] },
  { label: 'Basket and checkout', screens: ['on-basket', 'on-basket-changed', 'on-basket-empty', 'on-checkout', 'on-checkout-errors', 'on-checkout-credit', 'on-checkout-covered', 'on-checkout-gift-code', 'on-checkout-gift'] },
  { label: 'Paying', screens: ['on-checkout-paying', 'on-checkout-bank', 'on-checkout-declined', 'on-checkout-unsure', 'on-checkout-sold-out', 'on-confirmed', 'on-save-details'] },
  { label: 'Your order', screens: ['on-order', 'on-order-moving', 'on-order-ready', 'on-order-collected', 'on-order-cancel', 'on-order-cancelled', 'on-order-clash', 'on-order-shop-cancelled', 'on-order-cant-supply', 'on-email-ready'] },
  { label: 'The shop’s side', screens: ['on-orders', 'on-orders-ready', 'on-orders-arrived', 'on-orders-second', 'on-order-staff', 'on-order-staff-ready', 'on-not-ready', 'on-cant-supply', 'on-cancel-refund', 'on-hand-over', 'on-hand-over-refunded', 'on-today', 'on-today-uncollected'] },
  { label: 'Settings', screens: ['on-settings', 'on-settings-order-in', 'on-settings-start', 'on-settings-show', 'on-settings-pay', 'on-messages'] },
];
