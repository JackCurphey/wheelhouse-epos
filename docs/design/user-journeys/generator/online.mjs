// Journey 2 — Buy online / click and collect, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-buy-online-review.md
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
import { page, note, popup, overlay, withSize, isPhone, settingsPage, fold, onlineFolds, ONLINE_INTRO, withOnlineArea, rowSwitch } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { today } from './opening.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const PADS = { name: 'Shimano brake pads', code: 'B05S-RX', price: '£28.00' };
const ORDER = 'Order [order number]';

// ---------- The website frame (App map 15) ----------
// basket: how many items the header's basket shows. twoShops: decision 8's
// "Collecting from Bolton" in the header.
const site = (content, { basket = 0, twoShops = false, shopChosen = true } = {}) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 18px">${content}</div>`;
  let html = SIZE === 'desktop' ? siteDesktop('sand', 'Shop', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Shop') : sitePhone('sand', { content: body });
  if (basket) html = html.replace(/aria-label="Basket, 0 items"/g, `aria-label="Basket, ${basket} item${basket > 1 ? 's' : ''}"`).replace(/(aria-label="Basket, \d items?"[^>]*>[\s\S]*?<\/svg>)Basket<\/a>/, `$1Basket · ${basket}</a>`);
  if (twoShops) {
    const where = `<a href="#" aria-label="${shopChosen ? 'Collecting from Bolton — change the shop' : 'Choose a shop to collect from'}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 10px; border-radius: 8px; border: 1px solid ${C.border}; font-size: 14px; color: ${C.ink}; text-decoration: none; white-space: nowrap">${icon('store', 16)}${shopChosen ? 'Collecting from <strong>Bolton</strong> · Change' : '<strong>Choose a shop</strong>'}</a>`;
    html = html.replace(/(<label style="display: flex; align-items: center; gap: 8px; width: 240px;)/, `${where}$1`).replace('width: 240px;', 'width: 170px;').replace('display: flex; align-items: center; gap: 28px;', 'display: flex; align-items: center; gap: 20px; white-space: nowrap;');
  }
  return html;
};
const h1 = (t) => `<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 30}px; font-weight: 700">${t}</h1>`;
const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 18px; font-weight: 700">${t}</h2>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const section = (title, inner, id) => `<section aria-labelledby="${id}" style="flex-shrink: 0">${box(`${h2(title, id)}${inner}`)}</section>`;
const two = (left, right, rightW = 380) => (isPhone() ? `${left}${right}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) ${rightW}px; gap: 20px; align-items: start">${left}${right}</div>`);
const stack = (...parts) => `<div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">${parts.join('')}</div>`;
const sumRow = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: ${strong ? 17 : 15}px; font-weight: ${strong ? 700 : 400}${strong ? `; border-top: 1px solid ${C.border}; padding-top: 10px` : ''}"><span>${k}</span>${mono(v)}</div>`;
const shopLines = (name = 'Bolton') => `<div style="display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, ${name}</strong><span>Open [opening hours]</span><span>[Shop address] · [shop phone]</span></div>`;
const linkBtn = (t) => `<button type="button" style="align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const status = (t, tone = 'ok') => `<p role="status" style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'store', 18)}<span>${t}</span></p>`;

// A board scrolled part-way down its page (as journey 3's Messages board).
const scrolled = (html, px) => `<style>.on-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;?/, '<div data-scroll class="on-scrolled" style="$1overflow-y: hidden;')}`;

// ---------- A product (decisions 2, 8) ----------
// What the product says depends on the shop's setting and where it's in stock.
const AVAIL = {
  shelf: [status('<strong>Ready today at Bolton</strong> · [n] in stock'), true],
  other: [status('<strong>Ready at Bolton in [n] days</strong> — it’s at our [Second site] shop, and we’ll bring it over', 'grey'), true],
  orderin: [status('<strong>Ready at Bolton in about [n] days</strong> — we order it in for you', 'grey'), true],
  out: [status('<strong>Not in stock at Bolton</strong> — ask us when it’s back', 'warn'), false],
  noshop: [`<div style="display: flex; flex-direction: column; gap: 8px">${status('Choose a shop to see when it’s ready', 'grey')}${button('Choose a shop', { variant: 'default' })}</div>`, true],
};
const qty = () => `<div role="group" aria-label="Quantity" style="display: inline-flex; align-items: center; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span aria-live="polite" style="min-width: 40px; text-align: center; font-size: 16px; font-weight: 700">1</span><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; color: ${C.ink}">${icon('plus', 16)}</button></div>`;
const product = (avail = 'shelf', opts = {}) => {
  const [line, canBuy] = AVAIL[avail];
  const photo = `<div role="img" aria-label="Photo of the product" style="aspect-ratio: 4 / 3; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 15px">[Photo of the product]</div>`;
  const buy = canBuy ? `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">${qty()}${button('Add to basket')}</div>` : `<div style="display: flex; flex-wrap: wrap; gap: 12px">${button('Add to basket', { variant: 'default' }).replace('<button', '<button aria-disabled="true"').replace('style="', 'style="opacity: 0.5; ')}${linkBtn('Ask the shop about it')}</div>`;
  const info = stack(
    `<nav aria-label="You are here" style="font-size: 14px; color: ${C.muted}"><a href="#" style="color: inherit">Shop</a> › <a href="#" style="color: inherit">[Category]</a></nav>`,
    `<div style="display: flex; flex-direction: column; gap: 6px">${h1(`${PADS.name} ${mono(PADS.code)}`)}<span style="font-size: 24px; font-weight: 700">${mono(PADS.price)}</span><span style="font-size: 13px; color: ${C.muted}">Includes VAT</span></div>`,
    line, buy,
    `<p style="margin: 0; font-size: 15px; line-height: 1.55">[Product description]</p>`,
  );
  return site(isPhone() ? `${photo}${info}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start">${photo}${info}</div>`, opts);
};
// Decision 8: choosing the shop, once.
const shopOption = (name, on, sub) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="shop"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></label>`;
const chooseShop = () => popup('cs-title', 'Which shop will you collect from?', 'We’ll remember it, and show when things are ready there', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Shop</legend>${shopOption('Bolton', true, '[Shop address] · open [opening hours]')}${shopOption('[Second site]', false, '[Shop address] · open [opening hours]')}</fieldset>`, `${button('Cancel', { variant: 'ghost' })}${button('Collect from Bolton')}`, 520);

// ---------- The basket ----------
const basketLine = (name, sub, price, where) => `<div role="listitem" style="display: flex; gap: 14px; align-items: flex-start; padding: 14px 0; border-top: 1px solid ${C.border}"><div role="img" aria-label="Photo of the product" style="flex-shrink: 0; width: 72px; height: 54px; border-radius: 8px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></div><div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span><span style="font-size: 14px">${where}</span><div style="display: flex; align-items: center; gap: 14px">${qty()}${linkBtn('Remove')}</div></div>${mono(price, 'font-size: 16px; font-weight: 700')}</div>`;
const summary = (rows, cta) => box(`${h2('Your order', 'sum-h')}${rows.join('')}${cta}`);
const basket = () => site(`${h1('Your basket')}${two(
  box(`<div role="list">${basketLine(PADS.name, mono(PADS.code), PADS.price, 'Ready today at Bolton')}${basketLine('[Product]', '[Size or colour]', '[£ price]', 'Ready at Bolton in [n] days')}</div>`),
  summary([sumRow('2 items', '£[total]'), sumRow('Collect from Bolton', 'Free'), sumRow('Total (includes VAT)', '£[total]', true)], `${note('Ready to collect when the last item is — about [n] days.')}${button('Go to checkout', { block: true })}`),
)}`, { basket: 2 });

// ---------- Checkout: one page (decisions 1, 4, 5) ----------
// "How you'll get it" is a choice with one option today (decision 1).
const how = () => section('How you’ll get it', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">How you’ll get it</legend>${shopOption('Collect from North Street Cycles, Bolton', true, 'Free · ready in about [n] days · open [opening hours] · [Shop address]')}</fieldset>`, 'co-how');
const details = (signedIn) => section('Your details', signedIn
  ? `<p style="margin: 0; font-size: 15px; line-height: 1.6"><strong>Maya Patel</strong><br>maya@example.test · ${mono('07700 900 142')}</p><p style="margin: 0; font-size: 14px; color: ${C.muted}">Signed in · <a href="#" style="color: ${C.ink}">Not you?</a> · <a href="#" style="color: ${C.ink}">Change</a></p>`
  : `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Name', { value: 'Maya Patel' })}${field('Phone', { value: '07700 900 142', type: 'tel' })}</div>${field('Email', { value: 'maya@example.test', type: 'email', hint: 'For your receipt and to tell you when it’s ready.' })}<p style="margin: 0; font-size: 14px; color: ${C.muted}">Bought here before? <a href="#" style="color: ${C.ink}">Sign in</a> to fill this in.</p>`, 'co-details');
const wallets = `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">${['Apple Pay', 'Google Pay'].map((w) => `<button type="button" style="min-height: 48px; border-radius: 8px; border: 1px solid ${C.ink}; background: ${C.ink}; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 700">Pay with ${w}</button>`).join('')}</div>`;
const cardForm = (error = '') => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 10px; border: 1px solid ${error ? C.danger : C.border}; background: ${C.panel}"><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.muted}">${icon('lock', 14)}Card details go straight to [payment provider]</span>${field('Card number', { placeholder: '[card number]' })}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">${field('Expiry', { placeholder: 'MM / YY' })}${field('Security code', { placeholder: '3 digits' })}</div>${error ? `<p role="alert" style="margin: 0; display: flex; gap: 8px; font-size: 14px; font-weight: 600; color: ${C.danger}">${icon('alert', 16)}${error}</p>` : ''}</div>`;
const creditBox = (on) => `<label style="display: flex; gap: 12px; align-items: flex-start; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 1px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Use my store credit · ${mono('£[credit]')}</span><span style="font-size: 13px; color: ${C.muted}">The rest goes on your card</span></span></label>`;
const giftOpen = (applied) => applied
  ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px"><span style="display: inline-flex; gap: 8px; align-items: center">${icon('check', 16)}Gift card ${mono('[gift card code]')} · ${mono('£[£]')} used</span>${linkBtn('Remove')}</div>`
  : linkBtn('Have a gift card? Add it');
const pay = ({ signedIn = false, credit = false, gift = false, error = '' } = {}) => section('Pay', `${signedIn ? creditBox(credit) : ''}${giftOpen(gift)}${wallets}<div style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: ${C.muted}"><span style="flex-grow: 1; height: 1px; background: ${C.border}"></span>or pay by card<span style="flex-grow: 1; height: 1px; background: ${C.border}"></span></div>${cardForm(error)}`, 'co-pay');
const checkout = (opts = {}) => {
  const { credit, gift } = opts;
  const rows = [sumRow(`${PADS.name}`, PADS.price), sumRow('[Product]', '[£ price]'), sumRow('Collect from Bolton', 'Free'), sumRow('Total (includes VAT)', '£[total]', true)];
  if (credit) rows.push(sumRow('Store credit', '−£[credit]'));
  if (gift) rows.push(sumRow('Gift card', '−£[£]'));
  if (credit || gift) rows.push(sumRow('Left to pay', '£[£]', true));
  const payLabel = credit || gift ? 'Pay £[£]' : 'Pay £[total]';
  // The order summary stays in view while the left column scrolls; a board
  // drawn part-way down (opts.scroll) moves only the left column.
  const left = stack(h1('Checkout'), how(), details(opts.signedIn), pay(opts)).replace('min-width: 0">', `min-width: 0${opts.scroll ? `; position: relative; top: -${opts.scroll}px` : ''}">`);
  const html = site(`${two(left, `<div style="position: sticky; top: 0">${summary(rows, `${button(payLabel, { block: true })}<p style="margin: 0; font-size: 13px; color: ${C.muted}; line-height: 1.5">By paying you agree to our <a href="#" style="color: ${C.ink}">terms</a>. You can cancel for a full refund until your order is ready.</p>`)}</div>`)}`, { basket: 2 });
  return opts.scroll ? html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;?/, '<div data-scroll style="$1overflow-y: hidden;') : html;
};

// ---------- After paying (decision 4) ----------
const confirmed = () => site(`${two(stack(
  `<div style="display: flex; flex-direction: column; gap: 8px">${status('Paid · £[total] on your card')}${h1('Thanks, Maya — your order is in')}<span style="font-size: 15px">${ORDER} · we’ve emailed a copy to maya@example.test</span></div>`,
  section('What happens next', `<ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5"><li>We get it ready — about [n] days, as one item comes from our [Second site] shop.</li><li>We email you when it’s ready to collect.</li><li>Come in and give your name or order number. Nothing more to pay.</li></ol>${shopLines()}`, 'cf-next'),
), stack(
  section('Save your details for next time', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Then you won’t type them again, and this order shows in your account. No password — we’ll email you a link to sign in.</p>${button('Save my details', { block: true })}`, 'cf-save'),
  `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 15px; font-weight: 600; color: ${C.ink}">See your order</a>`,
))}`);

// ---------- The order's own page (decisions 1, 7) ----------
// The steps end in "Ready to collect" now; "Sent" can follow when delivery
// comes (decision 1).
const steps = (list, at) => `<ol aria-label="Where your order is" style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: ${isPhone() ? 8 : 18}px">${list.map((t, i) => {
  const done = i < at, now = i === at;
  return `<li${now ? ' aria-current="step"' : ''} style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: ${now ? 700 : 500}; color: ${done || now ? C.ink : C.muted}"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; ${now ? `background: ${C.ink}; color: #ffffff` : done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 1px solid ${C.input}`}">${done || now ? icon('check', 12) : ''}</span>${t}${done ? '<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)"> (done)</span>' : ''}</li>`;
}).join('')}</ol>`;
const itemRow = (name, sub, price, where) => `<div role="listitem" style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span>${where ? `<span style="font-size: 14px">${where}</span>` : ''}</span>${mono(price, 'font-size: 15px')}</div>`;
const items = (where = ['On the shelf at Bolton', 'Coming from [Second site]']) => section('What you bought', `<div role="list">${itemRow(PADS.name, mono(PADS.code), PADS.price, where[0])}${itemRow('[Product]', '[Size or colour]', '[£ price]', where[1])}</div>${sumRow('Paid on [date]', '£[total]', true)}`, 'or-items');
const orderPage = (state = 'getting') => {
  const LIST = ['Ordered', state === 'moving' ? 'Coming from [Second site]' : 'Getting it ready', 'Ready to collect', 'Collected'];
  const at = { getting: 1, moving: 1, ready: 2, cancelled: -1, cantSupply: 1 }[state];
  const head = `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">${ORDER} · placed [date]</span>${h1({ getting: 'We’re getting your order ready', moving: 'Your order is on its way to Bolton', ready: 'Your order is ready to collect', cancelled: 'Order cancelled', cantSupply: 'We’re getting your order ready' }[state])}${state === 'cancelled' ? '' : steps(LIST, at)}</div>`;
  const side = state === 'ready'
    ? section('Collect it', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Give your name or order number at the counter. It’s paid — nothing more to pay.</p>${shopLines()}`, 'or-collect')
    : state === 'cancelled'
      ? section('Your refund', `${status('£[total] refunded to your card on [date]')}<p style="margin: 0; font-size: 15px; line-height: 1.5">It can take [n] working days to show on your statement.</p>`, 'or-refund')
      : section('Collect from', `${shopLines()}<p style="margin: 0; font-size: 15px">We’ll email you when it’s ready — about [n] days.</p><div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 6px">${button('Cancel this order', { variant: 'default' })}${note('Full refund to your card until it’s ready.')}</div>`, 'or-collect');
  const cant = state === 'cantSupply' ? status('<strong>Sorry — we couldn’t supply [Product].</strong> £[£ price] is back on your card. “[their reason]” The rest of your order is on its way.', 'warn') : '';
  return site(`${head}${cant}${two(items(state === 'moving' ? ['On the shelf at Bolton', 'Coming from [Second site] · arrives [day]'] : state === 'cantSupply' ? ['On the shelf at Bolton', 'Couldn’t supply · refunded'] : state === 'cancelled' ? ['', ''] : undefined), side)}`);
};
const cancelOrder = () => popup('co-cancel', 'Cancel this order?', `${ORDER} · £[total]`, `<p style="margin: 0; font-size: 15px; line-height: 1.5">£[total] goes back to your card — it can take [n] working days to show. We’ll put the items back on sale.</p>`, `${button('Keep my order', { variant: 'ghost' })}${button('Cancel the order', { variant: 'danger' })}`, 480);

// ---------- The shop's side: Front desk › Online orders (decision 6) ----------
const from = (t, tone = 'grey') => badge(t, tone);
const orderRow = ({ who, items: its, how = 'Collect · Bolton', when, action }) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '170px minmax(0, 1fr) 130px 190px'}; gap: ${isPhone() ? 6 : 16}px; align-items: center; padding: 12px 0; border-top: 1px solid ${C.border}"><a href="#" style="display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; color: ${C.ink}; text-decoration: none"><span style="font-size: 15px; font-weight: 700; text-decoration: underline">${who}</span><span style="font-size: 13px; color: ${C.muted}">${ORDER} · ${when}</span></a><div style="display: flex; flex-direction: column; gap: 4px">${its}</div><span style="font-size: 14px">${how}</span><span style="justify-self: ${isPhone() ? 'start' : 'end'}">${action}</span></div>`;
const it = (name, tag) => `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px">${name}${tag}</span>`;
const group = (title, count, rows, sub = '') => section(`${title} · ${count}`, `${sub ? note(sub) : ''}${isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: 170px minmax(0, 1fr) 130px 190px; gap: 16px; font-size: 12px; font-weight: 700; color: ${C.muted}"><span>Customer</span><span>Items</span><span>How</span><span></span></div>`}<div role="list">${rows.join('')}</div>`, `g-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`);
const ordersPage = ({ toast = false } = {}) => page('orders', 'Online orders', `<div style="position: relative; height: 100%"><div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, Bolton')}
${group('To get ready', toast ? 2 : 3, [
  ...(toast ? [] : [orderRow({ who: 'Maya Patel', when: 'paid [time]', items: `${it(`${PADS.name} ${mono(PADS.code)}`, from('On the shelf'))}${it('[Product]', from('On its way from [Second site]'))}`, action: badge('Waiting for 1 item', 'amber') })]),
  orderRow({ who: '[Customer]', when: 'paid [time]', items: it('[Product] × 2', from('On the shelf')), action: button('Mark ready') }),
  orderRow({ who: '[Customer]', when: 'paid [time]', items: it('[Product]', from('To order from [supplier]', 'amber')), action: button('Order it', { variant: 'default' }) }),
], 'Mark ready when everything’s on the shelf for collection — the customer is emailed straight away.')}
${group('Ready to collect', toast ? 3 : 2, [
  ...(toast ? [orderRow({ who: '[Customer]', when: 'ready just now', items: it('[Product] × 2', ''), action: badge('Emailed', 'green') })] : []),
  orderRow({ who: '[Customer]', when: 'ready since [time]', items: it('[Product]', ''), action: badge('Emailed', 'green') }),
  orderRow({ who: '[Customer]', when: 'ready since [date]', items: it('[Product]', ''), action: badge('Not collected · [n] days', 'amber') }),
])}
${group('Collected', '[n]', [orderRow({ who: '[Customer]', when: 'collected [time]', items: it('[Product]', ''), action: `<span style="font-size: 14px; color: ${C.muted}">by Jo Taylor</span>` })], 'The last 7 days. Older orders are on each customer’s page.')}
</div>${toast ? `<div role="status" style="position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25); white-space: nowrap">${icon('check', 16)}Ready — [Customer] has been emailed<button type="button" style="min-height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: rgba(255,255,255,0.16); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 600">Undo</button></div>` : ''}</div>`, STAFF);
// One order, opened from the list.
const staffItem = (name, sub, price, tag) => `<div role="listitem" style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: ${C.muted}">${sub}${tag}</span></span>${mono(price, 'font-size: 15px')}</div>`;
const orderDialog = () => popup('od-title', `${ORDER} · Maya Patel`, 'Paid [time] by card · £[total]', `<div role="list">${staffItem(`${PADS.name}`, `${mono(PADS.code)} · [shelf]`, PADS.price, from('On the shelf'))}${staffItem('[Product]', '[Size or colour]', '[£ price]', from('On its way from [Second site] · arrives [day]'))}</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><span><strong>How</strong><br>Collect from Bolton</span><span><strong>Customer</strong><br>maya@example.test<br>${mono('07700 900 142')}</span></div>
${linkBtn('Can’t supply an item')}`, `${button('Cancel and refund', { variant: 'ghost' })}${button('Mark ready').replace('<button', '<button aria-disabled="true" title="1 item is still on its way"').replace('style="', 'style="opacity: 0.5; ')}`, 620);
const cantSupply = () => popup('cs2-title', 'Can’t supply an item', `${ORDER} · Maya Patel`, `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 4px">Which item?</legend>${shopOption(`${PADS.name} ${mono(PADS.code)}`, false, `${PADS.price} · on the shelf`)}${shopOption('[Product]', true, '[£ price] · on its way from [Second site]')}</fieldset>
${field('Tell Maya why (needed)', { placeholder: 'e.g. it arrived damaged from [Second site]' })}
${note('[£ price] goes back to Maya’s card and she’s emailed your reason. The rest of the order carries on.')}`, `${button('Keep it', { variant: 'ghost' })}${button('Refund this item')}`, 560);

// ---------- Settings › Front desk › Online orders (decisions 2, 3, 5, 7) ----------
const radioCard = (t, on, sub) => shopOption(t, on, sub);
const sellsOpen = (pick = 0) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 4px">Customers can buy</legend>
${radioCard('Only what’s on the shelf', pick === 0, 'At the shop they collect from. Ready the same day.')}
${radioCard('Anything in stock at any of our shops', pick === 1, 'We move it across with a stock transfer. The website says “Ready at Bolton in [n] days”.')}
${radioCard('Also things we can order in', pick === 2, 'From the supplier. The website says “Ready in about [n] days”. The order arrives as “To order from [supplier]”.')}</fieldset>
${pick > 0 ? `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Moving between shops takes', { value: '[n] days' })}${pick === 2 ? field('Ordering in takes about', { value: '[n] days', hint: 'Or each supplier’s own time, from their details in Stockroom.' }) : ''}</div>` : ''}
${note('Stock is held for the customer as soon as they’ve paid.')}`;
const showOpen = () => `<p style="margin: 0; font-size: 15px">Started with every product online on [date].</p>
${['Bearings', 'Drivetrain › Derailleurs', '[Category]'].map((c, i) => rowSwitch(`${c}`, i < 2)).join('')}
<p style="margin: 0; font-size: 14px">[n] products are set differently from their category. ${linkBtn('See them')}</p>
${note('New products follow their category. Each product’s page in Stock has its own “Show on website” switch.')}`;
const payOpen = () => `${status('Connected to [payment provider] by Jack Lewis on [date]')}
${rowSwitch('Apple Pay and Google Pay', true)}${rowSwitch('Gift cards', true)}${rowSwitch('Store credit (for signed-in customers)', true)}`;
const collectOpen = () => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Remind the customer after', { value: '[n] days' })}${field('Show on Today after', { value: '[n] days' })}</div>${note('Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.')}`;
const onlineSettings = (open, toast) => withOnlineArea(() => settingsPage('online', 'Online orders', ONLINE_INTRO, onlineFolds(open), { who: OWNER, toast }));
const startQuestion = () => popup('st-title', 'How should your website start?', 'You’re turning on buying online', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Start with</legend>${radioCard('Start with every product online', true, 'Everything with a price shows. Switch off what you don’t want to sell online.')}${radioCard('Start with nothing online', false, 'Add categories and products as you go.')}</fieldset>${note('Either way, every category and product has its own “Show on website” switch afterwards.')}`, `${button('Not now', { variant: 'ghost' })}${button('Turn on buying online')}`, 560);

// ---------- The boards ----------
def('on-product', () => product('shelf', { basket: 0 }));
def('on-product-two-shops', () => product('other', { twoShops: true }));
def('on-product-order-in', () => product('orderin', { twoShops: true }));
def('on-product-out', () => product('out'));
def('on-product-no-shop', () => product('noshop', { twoShops: true, shopChosen: false }));
def('on-choose-shop', () => overlay(product('noshop', { twoShops: true, shopChosen: false }), chooseShop()));
def('on-basket', () => basket());
def('on-checkout', () => checkout());
def('on-checkout-credit', () => checkout({ signedIn: true, credit: true, scroll: 200 }));
def('on-checkout-gift', () => checkout({ gift: true, scroll: 330 }));
def('on-checkout-declined', () => checkout({ error: 'Your card was declined — nothing has been taken. Try another card, or Apple Pay or Google Pay.', scroll: 470 }));
def('on-confirmed', () => confirmed());
def('on-order', () => orderPage('getting'));
def('on-order-moving', () => orderPage('moving'));
def('on-order-ready', () => orderPage('ready'));
def('on-order-cancel', () => overlay(orderPage('getting'), cancelOrder()));
def('on-order-cancelled', () => orderPage('cancelled'));
def('on-order-cant-supply', () => orderPage('cantSupply'));
def('on-orders', () => ordersPage());
def('on-orders-ready', () => ordersPage({ toast: true }));
def('on-order-staff', () => overlay(ordersPage(), orderDialog()));
def('on-cant-supply', () => overlay(ordersPage(), cantSupply()));
def('on-today', () => today({ onlineNew: true }));
def('on-today-uncollected', () => today({ onlineUncollected: true }));
def('on-settings', () => onlineSettings({ sells: sellsOpen(0) }));
def('on-settings-order-in', () => onlineSettings({ sells: sellsOpen(2) }));
def('on-settings-start', () => overlay(onlineSettings({}), startQuestion()));
def('on-settings-show', () => onlineSettings({ show: showOpen() }));
def('on-settings-pay', () => onlineSettings({ pay: payOpen(), collect: collectOpen() }));

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'on-product': 'A product: ready today at Bolton',
  'on-product-two-shops': 'Two shops: “Collecting from Bolton”, the item at the other shop',
  'on-product-order-in': 'An item the shop orders in',
  'on-product-out': 'Only what’s on the shelf, and it isn’t',
  'on-product-no-shop': 'No shop chosen yet',
  'on-choose-shop': 'Which shop will you collect from? (asked once)',
  'on-basket': 'The basket',
  'on-checkout': 'Checkout: how you’ll get it, your details, pay — one page',
  'on-checkout-credit': 'Signed in, with store credit used (scrolled to Pay)',
  'on-checkout-gift': 'A gift card used (scrolled to Pay)',
  'on-checkout-declined': 'Card declined: nothing taken (scrolled to Pay)',
  'on-confirmed': 'Order in: what happens next, and save your details',
  'on-order': 'The order’s page: getting it ready',
  'on-order-moving': 'On its way from the other shop',
  'on-order-ready': 'Ready to collect',
  'on-order-cancel': 'Cancel this order? (until it’s ready)',
  'on-order-cancelled': 'Cancelled and refunded',
  'on-order-cant-supply': 'An item the shop couldn’t supply, refunded',
  'on-orders': 'Front desk › Online orders: to get ready, ready, collected',
  'on-orders-ready': 'Marked ready: the customer is emailed',
  'on-order-staff': 'One order: items, where each comes from, the customer',
  'on-cant-supply': 'Can’t supply an item: refund it, with a reason',
  'on-today': 'Today: new online orders',
  'on-today-uncollected': 'Today: an order not collected',
  'on-settings': 'Settings › Online orders: what the website sells',
  'on-settings-order-in': 'Also things we order in: how long it takes',
  'on-settings-start': 'Turning on buying online: start with everything, or nothing',
  'on-settings-show': 'Showing products: switches on each category',
  'on-settings-pay': 'Paying online, and orders not collected',
};
export const ROWS = [
  { label: 'Finding it', screens: ['on-product', 'on-product-two-shops', 'on-product-order-in', 'on-product-out', 'on-product-no-shop', 'on-choose-shop'] },
  { label: 'Basket and checkout', screens: ['on-basket', 'on-checkout', 'on-checkout-credit', 'on-checkout-gift', 'on-checkout-declined', 'on-confirmed'] },
  { label: 'Your order', screens: ['on-order', 'on-order-moving', 'on-order-ready', 'on-order-cancel', 'on-order-cancelled', 'on-order-cant-supply'] },
  { label: 'The shop’s side', screens: ['on-orders', 'on-orders-ready', 'on-order-staff', 'on-cant-supply', 'on-today', 'on-today-uncollected'] },
  { label: 'Settings', screens: ['on-settings', 'on-settings-order-in', 'on-settings-start', 'on-settings-show', 'on-settings-pay'] },
];
