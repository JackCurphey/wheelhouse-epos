// Journey 6 — Cycle to Work, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-cycle-to-work-review.md
//
// Not a scheme: Wheelhouse organises the shop's side of a bike sold through
// one (Jack, 2 Oct). Decision 1: its own kind of order, with stages — quote
// given, waiting for the certificate, certificate received, ready to
// collect, collected, paid by the provider. 2: Front desk › Cycle to Work in
// the sidebar. 3: a bike in stock is held from the quote for days the shop
// sets, then firmly from the certificate. 4: a bike not in stock is ordered
// by a rule the shop picks (certificate, applied, or a deposit), with a
// recorded override. 5: the shop lists its providers once; Wheelhouse works
// out what's owed and chases it. 6: a proper quote, then a message at each
// step. 7: the UI audit (c2w-ui-audit.md), every recommendation taken.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner), Jo Taylor (Staff), Maya Patel (customer, 07700 900 142,
// maya@example.test). Scheme providers, bikes, sizes, prices, dates and
// reference numbers are bracketed placeholders. No provider's process is
// drawn as fact (audit H1): what a provider asks for at hand-over is the
// shop's own note, shown line by line.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, c2wFolds, C2W_INTRO, msgFolds, MSG_INTRO } from './settings-frame.mjs';
import { today } from './opening.mjs';
import { msgListOpen } from './setup.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const sr = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
const tall = 'display: inline-flex; align-items: center; min-height: 44px';
const BIKE = '[Bike]', SIZE_ = '[Size]', PROV = '[Provider]', QNUM = '[quote number]';
// Audit H3: cost and commission only for people who can see costs.
let WHO = STAFF;
const seesMoney = () => WHO !== STAFF;

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: ${isPhone() ? 22 : 26}px; font-weight: 700">${t}</h2>`;
const h3 = (t, id = '') => `<h3${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 17px; font-weight: 700">${t}</h3>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 14 : 18}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'bike', 18)}<span>${t}</span></p>`;
// Audit L2: links 44px wide as well as high.
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; justify-content: center; min-width: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const named = (html, label) => html.replace(/^<(button|a)/, `<$1 aria-label="${esc(label)}"`);
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const kv = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid ${C.border}; font-size: 15px${strong ? '; font-weight: 700' : ''}"><span style="color: ${strong ? C.ink : C.muted}">${k}</span><span style="text-align: right">${v}</span></div>`;
const toast = (t, action = '') => `<div role="status" style="position: absolute; ${isPhone() ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%); white-space: nowrap'}; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="flex-grow: 1; padding: 8px 0">${t}</span>${action ? `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">${action}</button>` : ''}</div>`;
const withToast = (html, t) => html.replace('<main style="', '<main style="position: relative; ').replace('</main>', `${t}</main>`);
const radio = (name, on, sub, group) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span>` : ''}</span></label>`;
const group = (legend, inner) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">${legend}</legend>${inner}</fieldset>`;
const tick = (t, on = false, sub = '') => `<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${t}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span></label>`;
const textBox = (id, label, value, hint = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><textarea id="${id}" rows="3" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; line-height: 1.5; color: ${C.ink}; resize: none">${value}</textarea>${hint ? `<span style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</div>`;
const logged = () => note('This goes in the order’s history and the activity log.');

// ---------- The page: Front desk › Cycle to Work (decision 2) ----------
// Audit M3: the count is what's due or late — here a hold ending, a bike
// ready to order and a late payment.
const COUNT = '3';
const countIn = (html) => html.replace(/(>Cycle to Work<\/span>)(<\/a>)/, `$1<span style="margin-left: auto; padding: 0 7px; border-radius: 999px; background: ${C.highlight}; color: ${C.ink}; font-size: 12px; font-weight: 700">${COUNT}${sr(' due or late')}</span>$2`);
const c2wPage = (content, who = WHO) => page('c2w', 'Cycle to Work', `<div data-scroll style="position: relative; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${content}</div>`, who);

// ---------- The list, grouped by stage (decision 1) ----------
const cols = () => (isPhone() ? '1fr' : '200px minmax(0, 1fr) 230px 190px');
const orderRow = ({ who, quote = `Quote ${QNUM}`, bike = `${BIKE} · ${SIZE_}`, prov = PROV, status, action }) => `<div role="listitem" style="display: grid; grid-template-columns: ${cols()}; gap: ${isPhone() ? 6 : 16}px; align-items: center; padding: 12px 0; border-top: 1px solid ${C.border}"><a href="#" aria-label="Open ${esc(who)}’s order" style="display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; color: ${C.ink}; text-decoration: none"><span style="font-size: 15px; font-weight: 700; text-decoration: underline">${who}</span><span style="font-size: 13px; color: ${C.muted}">${quote}</span></a><span style="display: flex; flex-direction: column; gap: 3px; font-size: 14px"><span>${bike}</span><span style="color: ${C.muted}">${prov}</span></span><span style="font-size: 14px">${status}</span><span style="justify-self: ${isPhone() ? 'start' : 'end'}">${action}</span></div>`;
const stageGroup = (title, count, rows, sub = '') => box(`<h2 style="margin: 0; font-size: 17px; font-weight: 700">${title} · ${count}</h2>${sub ? note(sub) : ''}<div role="list">${rows.join('')}</div>`);
const listPage = () => {
  const money = seesMoney();
  const markPaid = (who) => named(button('Mark paid', { variant: 'default' }), `Mark paid: ${who} · ${PROV}`);
  return c2wPage(`${note('Thursday 17 September · North Street Cycles, Bolton')}
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px"><p style="margin: 0; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 15px">${badge('1 hold ending soon', 'amber')}${badge('1 bike ready to order', 'blue')}${badge('1 payment late', 'amber')}${money ? `<a href="#" style="${tall}; font-weight: 600; color: ${C.ink}">Owed by providers £[£] · 1 late</a>` : ''}</p>${button('+ New Cycle to Work order')}</div>
${stageGroup('Waiting for the certificate', 3, [
    orderRow({ who: 'Maya Patel', status: `Held until [date]<br>${badge('Hold ends in [n] days', 'amber')}`, action: named(button('Add the certificate', { variant: 'default' }), 'Add Maya Patel’s certificate') }),
    orderRow({ who: '[Customer]', status: 'Held until [date]', action: named(button('Add the certificate', { variant: 'default' }), 'Add [Customer]’s certificate') }),
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · not in stock`, status: `Applied [date]<br>${badge('Ready to order', 'blue')}`, action: named(button('Order from [supplier]', { variant: 'default' }), 'Order [Customer]’s bike from [supplier]') }),
  ], 'Bikes in stock are held for the customer. Ones to order follow your rule in Settings.')}
${stageGroup('Certificate received', 1, [
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · on order`, status: 'Due from [supplier] [date]', action: link('Open', 'Open [Customer]’s order') }),
  ])}
${stageGroup('Ready to collect', 1, [
    orderRow({ who: '[Customer]', status: 'Certificate [certificate number] · put aside', action: named(button('Hand over', { variant: 'default' }), 'Hand over [Customer]’s bike') }),
  ])}
${stageGroup('Collected · waiting for payment', 2, [
    orderRow({ who: '[Customer]', status: 'Expected £[£] by [date]', action: money ? markPaid('[Customer]') : link('Open', 'Open [Customer]’s order') }),
    orderRow({ who: '[Customer]', status: `${badge('[n] days late', 'amber')} £[£] was due [date]`, action: money ? markPaid('[Customer]') : link('Open', 'Open [Customer]’s late order') }),
  ])}
${stageGroup('Paid · last 30 days', '[n]', [orderRow({ who: '[Customer]', status: 'Paid £[£] on [date]', action: link('Open', 'Open [Customer]’s paid order') })])}`);
};
const firstUse = () => c2wPage(`${note('North Street Cycles, Bolton')}
${box(`${h3('No Cycle to Work orders yet')}<p style="margin: 0; font-size: 15px; line-height: 1.5">Each bike sold through a scheme gets an order here, from the quote to the provider’s payment.</p>${msg('<strong>No scheme providers yet.</strong> Add the providers your customers use, with their terms, before the first quote.', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add providers')}${button('Set how bikes are held and ordered', { variant: 'default' })}</div>${note('Staff can start orders once there’s a provider to choose.')}`, 'max-width: 720px')}`, OWNER);

// ---------- One order (decisions 1, 3, 4, 5) ----------
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider'];
const stages = (at, labels = STAGES) => `<ol aria-label="Stages" style="margin: 0; padding: 0; display: grid; grid-template-columns: repeat(${isPhone() ? 2 : labels.length}, minmax(0, 1fr)); gap: 6px">${labels.map((s, i) => { const done = i < at, now = i === at; return `<li${now ? ' aria-current="step"' : ''} style="list-style: none; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; border: ${now ? 2 : 1}px solid ${now ? C.ink : C.border}; background: ${done ? C.mutedBg : C.panel}; font-size: 13px"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${done || now ? C.ink : C.muted}">${done ? icon('check', 14) : `<span style="width: 14px; text-align: center">${i + 1}</span>`}${s}</span><span style="color: ${C.muted}">${done ? '[date]' : now ? 'Now' : ''}</span></li>`; }).join('')}</ol>`;
// Audit M10: one history that only grows, oldest first.
const EV = {
  quote: ['Jo Taylor', `gave quote ${QNUM} and emailed it to maya@example.test`],
  held: ['Jo Taylor', `held ${BIKE} · ${SIZE_} until [date]`],
  putAside: ['Wheelhouse', 'emailed Maya: “Your bike is put aside”'],
  longer: ['Jo Taylor', 'held the bike longer, until [date]'],
  toOrder: ['Jo Taylor', `${BIKE} · ${SIZE_} not in stock — to order once Maya has applied (your rule)`],
  toOrderDep: ['Jo Taylor', `${BIKE} · ${SIZE_} not in stock — to order once a £[£] deposit is paid (your rule)`],
  applied: ['Jo Taylor', 'marked Maya as applied · employer [Employer] · reference [reference]'],
  deposit: ['Jo Taylor', 'took a £[£] deposit at the till · sale B1-[0000]'],
  ordered: ['Jo Taylor', 'ordered the bike from [supplier] · supplier order [order number]'],
  cert: ['Jack Lewis', 'added certificate [certificate number] · certificate £[£] · quote £[£]'],
  certMail: ['Wheelhouse', 'emailed Maya: “Certificate received”'],
  ready: ['Jo Taylor', 'marked the bike ready to collect'],
  readyMail: ['Wheelhouse', 'emailed Maya: “Ready to collect”'],
  handed: ['Jo Taylor', `handed over the bike · checks ticked [n] of [n] · till sale B1-[0000]: Cycle to Work · ${PROV} £[£]`],
  part: ['Jack Lewis', 'saved part paid: £[£] of £[£] received [date] · £[£] still owed'],
  paid: ['Jack Lewis', 'marked paid: £[£] received [date] · reference [reference]'],
};
const FLOW = ['quote', 'held', 'putAside', 'longer', 'cert', 'certMail', 'ready', 'readyMail', 'handed', 'paid'];
const historyBox = (keys) => box(`${h3('What’s happened')}<ol style="margin: 0; padding: 0">${keys.map((k) => { const [w, t] = EV[k]; return `<li style="list-style: none; display: flex; gap: 12px; padding: 7px 0; border-top: 1px solid ${C.border}; font-size: 14px">${mono('[date]', `flex-shrink: 0; color: ${C.muted}`)}<span><strong>${w}</strong> ${t}</span></li>`; }).join('')}</ol>`);
const upTo = (k) => FLOW.slice(0, FLOW.indexOf(k) + 1);
// Audit H2: who pays what, worked out from the order.
const whoPays = ({ deposit = false, extra = false, title = true } = {}) => `${title ? `<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Who pays what</h3>` : ''}<div>${kv('Order total', mono('£[£]'))}${deposit ? kv('Deposit Maya has paid', mono('−£[£]')) : ''}${kv(`${PROV} pays (the certificate)`, mono('£[£]'))}${kv('Maya pays at collection', mono(extra || deposit ? '£[£]' : '£0.00'), true)}</div>`;
const details = (stage, { order = false, deposit = false, expected = false } = {}) => box(`${h3('The order')}${kv('Bike', `${BIKE} · ${SIZE_}${order ? ' · not in stock' : ''}`)}${kv('Accessories', '[Accessory] · [Accessory]')}${kv('Provider', seesMoney() ? `${PROV} · commission [%]` : PROV)}${kv('Expected from the provider', expected ? mono('£[£] by [date]') : 'After collection')}${whoPays({ deposit })}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Email the quote again', { variant: 'default' })}${button('Print the quote', { variant: 'default' })}</div>`);
const customerBox = () => box(`${h3('Customer')}<a href="#" style="${tall}; font-size: 15px; font-weight: 700; color: ${C.ink}">Maya Patel</a><span style="font-size: 14px">${mono('07700 900 142')} · maya@example.test</span>${kv('Applied', '[date]')}${kv('Employer', '[Employer]')}${kv('Application reference', '[reference]')}<div>${link('Change', 'Change Maya’s application details')}</div>`);
// What to do next, at each stage.
const NEXT = {
  held: () => box(`${h3('Next: the certificate')}${msg(`<strong>${BIKE} · ${SIZE_} is held until [date].</strong> Hold ends in [n] days — we’ll remind the shop [n] days before.`, 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add the certificate')}${button('Hold longer', { variant: 'default' })}${button('Release the bike', { variant: 'default' })}</div>`),
  toApply: () => box(`${h3('Next: Maya applies')}${msg('<strong>Not in stock.</strong> Your rule: order once the customer has applied.', 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Mark as applied')}${button('Add the certificate', { variant: 'default' })}</div>`),
  applied: () => box(`${h3('Next: order the bike')}${msg('<strong>Maya has applied</strong> (reference [reference]). Your rule: order once the customer has applied.', 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Order from [supplier]')}${button('Add the certificate', { variant: 'default' })}</div>${note('Ordering creates the supplier order in Deliveries and orders.')}`),
  deposit: () => box(`${h3('Next: a deposit, then order')}${msg('<strong>Waiting for a £[£] deposit before ordering.</strong> Your rule: order straight away with a deposit, until the certificate arrives.', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Take the deposit at the till')}${seesMoney() ? button('Order now anyway…', { variant: 'default' }) : ''}</div>${note('The deposit is refunded when the certificate arrives — your rule in Settings.')}`),
  depositPaid: () => box(`${h3('Next: the certificate')}${msg('<strong>£[£] deposit paid and the bike ordered</strong> from [supplier] · due [date].', 'ok')}<div>${button('Add the certificate')}</div>${note('When the certificate arrives, Wheelhouse puts the deposit refund on the till for the next person to give back — your rule in Settings.')}`),
  onOrder: () => box(`${h3('Next: the bike arrives')}${msg('<strong>Certificate received.</strong> The bike is on order from [supplier], due [date].', 'ok')}${note('When it’s booked in through Deliveries and orders, it’s put aside for Maya and this order moves to Ready to collect. Maya is emailed “Ready to collect” then.')}<div>${link('Open the supplier order', 'Open the supplier order for Maya’s bike')}</div>`),
  ready: () => box(`${h3('Next: hand over')}${msg(`<strong>Ready to collect.</strong> Certificate [certificate number] · ${BIKE} put aside.`, 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Hand over')}</div>`),
  owed: () => box(`${h3('Next: the provider’s payment')}${msg(`<strong>Expected £[£] from ${PROV} by [date]</strong> — the certificate £[£] less [%] commission.`, 'grey')}<div>${button('Mark paid')}</div>${note('If it hasn’t arrived [n] days after that, it shows on Today.')}`),
  part: () => box(`${h3('Next: the rest of the payment')}${msg(`<strong>£[£] of £[£] received from ${PROV}.</strong> £[£] still owed — it stays on the owed list and on Today if it’s late.`, 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Mark the rest paid')}${button('Close with a reason…', { variant: 'default' })}</div>`),
  paid: () => box(`${h3('Paid')}${msg(`<strong>£[£] received from ${PROV} on [date]</strong>, as expected.`, 'ok')}`),
};
const more = () => named(button('More…', { variant: 'default' }).replace('<button', '<button aria-haspopup="menu"'), 'More for Maya Patel’s order');
const orderPage = ({ stage = 1, next = 'held', hist = upTo('putAside'), order = false, deposit = false, expected = false, menu = '' } = {}) => {
  const left = `${NEXT[next]()}${historyBox(hist)}`;
  const right = `${details(stage, { order, deposit, expected })}${customerBox()}`;
  return c2wPage(`${back('Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Maya Patel · Cycle to Work')}${note(`Quote ${QNUM} · North Street Cycles, Bolton`)}</div><div style="position: relative">${more()}${menu}</div></div>
${stages(stage)}
${isPhone() ? `${left}${right}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${right}</div></div>`}`);
};
// Audit M9: the More menu.
const moreMenu = () => `<div role="menu" aria-label="More for Maya Patel’s order" style="position: absolute; right: 0; top: 50px; z-index: 5; width: 280px; padding: 6px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(38,36,32,0.18); display: flex; flex-direction: column">${['Change the bike or size', 'Change the accessories', 'Change the provider', 'Release the bike'].map((t) => `<button type="button" role="menuitem" style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-family: inherit; font-size: 15px; color: ${C.ink}">${t}</button>`).join('')}<span style="height: 1px; margin: 4px 6px; background: ${C.border}"></span><button type="button" role="menuitem" style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-family: inherit; font-size: 15px; color: ${C.danger}">Cancel the order…</button><p style="margin: 6px 12px 8px; font-size: 13px; color: ${C.muted}; line-height: 1.45">A change after the quote is sent makes a revised quote; nothing is sent until you press Email.</p></div>`;

// ---------- Starting one (decisions 1, 3, 4, 6; audit H5, M1, M4, M11) ----------
const select = (id, label, value, sub = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label id="${id}-l" for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><button id="${id}" type="button" aria-haspopup="listbox" aria-labelledby="${id}-l ${id}"${sub ? ` aria-describedby="${id}-s"` : ''} style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button>${sub ? `<span id="${id}-s" style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</div>`;
const CLOSING = {
  held: 'We’re holding your bike until [date]. Once your certificate reaches us, it’s yours to collect.',
  applied: `${BIKE} isn’t in stock. We’ll order it once you’ve applied, and let you know when it arrives.`,
  deposit: `${BIKE} isn’t in stock. We’ll order it once you’ve paid a £[£] deposit, refunded when your certificate reaches us.`,
};
const saysBox = (k) => `<div style="padding: 10px 12px; border-radius: 8px; border: 1px dashed ${C.input}; font-size: 14px; line-height: 1.5"><span style="display: block; font-size: 13px; font-weight: 700; color: ${C.muted}">The quote will say</span>${CLOSING[k]}</div>`;
const newOrder = (inStock = true) => popup('no-title', 'New Cycle to Work order', 'North Street Cycles, Bolton', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${select('no-cust', 'Customer', 'Maya Patel · 07700 900 142')}${select('no-prov', 'Scheme provider', PROV, 'Pays in about [n] days')}</div>
${select('no-bike', 'Bike', `${BIKE} · ${SIZE_}`, inStock ? '1 free at Bolton · none held' : 'None at Bolton or [Second site] · from [supplier], about [n] days')}
${select('no-acc', 'Accessories', '[Accessory] · [Accessory]', 'Optional')}
${inStock ? tick('Hold the bike until [date]', true, '[n] days, from Settings. Untick for an easy-to-replace bike.') : ''}
${saysBox(inStock ? 'held' : 'applied')}
${tick('Email the quote to maya@example.test now', true)}
${kv('Total (includes VAT)', mono('£[£]'))}`, `${button('Cancel', { variant: 'ghost' })}${button('Make the quote')}`, 620);
// The quote, to print or email (decision 6; audit H1, H5, M9).
const quoteDoc = ({ closing = 'held', revised = false } = {}) => {
  const P = isPhone();
  const doc = `<article aria-labelledby="qd-title" style="width: ${P ? 'auto' : '620px'}; box-sizing: border-box; padding: ${P ? 18 : 36}px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 6px; box-shadow: 0 8px 24px rgba(38,36,32,0.12); display: flex; flex-direction: column; gap: 14px; font-size: 14px; color: ${C.ink}">
<div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start"><div style="display: flex; flex-direction: column; gap: 3px"><span title="No official logo file exists yet" aria-label="Shop logo goes here" style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; border: 1px dashed ${C.input}; color: ${C.muted}; font-size: 10px; font-weight: 700">LOGO</span><strong style="font-size: 16px">North Street Cycles</strong><span>[Shop address] · [shop phone]</span><span>VAT [VAT number]</span></div><div style="text-align: right; display: flex; flex-direction: column; gap: 3px"><h3 id="qd-title" style="margin: 0; font-size: 18px">Cycle to Work quote</h3><span>Quote number ${mono(QNUM)}</span><span>${revised ? '<strong>Revised [date]</strong>' : 'Given [date]'}</span><span><strong>Valid until [date]</strong></span></div></div>
<div style="padding: 10px 12px; border-radius: 6px; background: ${C.bg}">For <strong>Maya Patel</strong> · scheme provider <strong>${PROV}</strong></div>
<table style="width: 100%; border-collapse: collapse"><thead><tr style="text-align: left; font-size: 12px; color: ${C.muted}"><th style="padding: 6px 0">Item</th><th style="padding: 6px 0; text-align: right">Price</th></tr></thead><tbody>${[[`${revised ? '[Different bike]' : BIKE} · ${SIZE_}`, '£[£]'], ['[Accessory]', '£[£]'], ['[Accessory]', '£[£]']].map(([a, b]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 0">${a}</td><td style="padding: 8px 0; text-align: right">${mono(b)}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 8px 0; font-weight: 700">Total (includes VAT)</td><td style="padding: 8px 0; text-align: right; font-weight: 700">${mono('£[£]')}</td></tr></tbody></table>
<p style="margin: 0; line-height: 1.5">${CLOSING[closing]}</p>${closing === 'deposit' ? '<p style="margin: 0; line-height: 1.5">If you decide not to go ahead after we’ve ordered the bike, [the shop’s rule for the deposit].</p>' : ''}
<p style="margin: 0; color: ${C.muted}; line-height: 1.5"><strong style="color: ${C.ink}">How to apply:</strong> [The shop’s own words, from Settings]</p></article>`;
  const top = revised ? msg('<strong>Revised quote.</strong> The bike changed on [date] — it’s in the order’s history. Maya hasn’t been sent it yet.', 'grey') : '';
  return c2wPage(`${back('Maya Patel · Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${h2(revised ? 'The revised quote' : 'The quote')}<span style="display: flex; gap: 10px">${button('Print', { variant: 'default' })}${button(revised ? 'Email the revised quote to Maya' : 'Email to Maya')}</span></div>${top}<div style="display: flex; justify-content: center; padding: 6px 0 20px">${doc}</div>`);
};

// ---------- Pop-ups along the way (decisions 3, 4, 5; audit H1, H2, M8) ----------
const certificate = (diff = false) => popup('ce-title', 'Add the certificate', `Maya Patel · ${PROV}`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Certificate number', { value: '[certificate number]' })}${field('Amount on the certificate', { value: diff ? '£[£ less]' : '£[£]' })}</div>${field('Received', { value: '[date]' })}
${diff ? `${msg('<strong>Certificate £[£ less] · quote £[£].</strong> £[£] less than the quote.', 'warn', true)}${group('What to do', `${radio('Change the order to match', true, 'Take something off so the total is the certificate amount.', 'cd')}${radio('Keep the order; Maya pays the £[£] difference', false, 'At collection, as a second payment at the till.', 'cd')}`)}${note('“Certificate received” is emailed to Maya once you’ve chosen.')}`
    : `${msg('<strong>Certificate £[£] · quote £[£].</strong> They match.', 'ok')}${note(`${BIKE} stays put aside until Maya collects it, and Maya is emailed “Certificate received”.`)}`}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 560);
const certReleased = () => popup('cr-title', 'The bike was released', `Maya Patel · certificate [certificate number] saved`, `${msg(`<strong>${BIKE} · ${SIZE_} was released on [date]</strong> and has since been sold.`, 'warn', true)}${group('What to do for Maya', `${radio(`Hold another ${BIKE} · ${SIZE_}`, true, '1 free at [Second site] — it’s moved to Bolton for Maya.', 'cr')}${radio('Order one from [supplier]', false, 'About [n] days.', 'cr')}`)}`, `${button('Decide later', { variant: 'ghost' })}${button('Save')}`, 560);
const applied = () => popup('ap-title', 'Maya has applied', `Quote ${QNUM} · ${PROV}`, `${field('Applied on', { value: '[date]' })}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Employer', { value: '[Employer]', hint: 'Optional' })}${field('Application reference', { value: '[reference]', hint: 'Optional — if Maya has one' })}</div>${msg('Your rule: order once the customer has applied. The order will show “Order from [supplier]” next.', 'grey')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 540);
const orderAnyway = () => popup('oa-title', 'Order now anyway?', 'Your rule: a £[£] deposit first', `<p style="margin: 0; font-size: 15px; line-height: 1.5">${BIKE} · ${SIZE_} from [supplier] for £[£] cost, before a deposit or certificate.</p>${textBox('oa-why', 'Why?', '[reason]')}${logged()}`, `${button('Cancel', { variant: 'ghost' })}${button('Order now')}`, 520);
const holdReminder = () => popup('hr-title', `Maya Patel’s hold ends on [date]`, `${BIKE} · ${SIZE_} · quoted [n] days ago, no certificate yet`, `${group('What to do with the hold', `${radio('Hold longer', true, 'Until [date] — another [n] days.', 'hold')}${radio('Release the bike', false, 'It goes back on sale. The order stays open; if the certificate comes, Wheelhouse checks the bike’s still here.', 'hold')}`)}${note('Maya is emailed “Your hold ends on [date]” — switch that off in Settings › Messages.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 540);
// Audit H1: the checks are the lines of the shop's own note for this provider.
const handOver = () => popup('ho-title', 'Hand over to Maya Patel', `${BIKE} · ${SIZE_} · certificate [certificate number]`, `${group(`${PROV}’s checks, from your note in Settings`, `${tick('[Line 1 of the shop’s note for this provider]')}${tick('[Line 2 of the shop’s note for this provider]')}`)}${box(whoPays({ title: false }))}${note('“Hand over at the till” opens the till with this sale: Cycle to Work · [Provider]. The ticked checks go in the order’s history.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Hand over at the till')}`, 560);
const markPaid = (diff = false) => popup('mp-title', 'Mark paid', `[Customer] · ${PROV} · expected £[£] by [date]`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Amount received', { value: diff ? '£[£ less]' : '£[£]' })}${field('Received on', { value: '[date]' })}</div>${field('Provider’s reference', { value: '[reference]', hint: 'Optional — from the remittance' })}
${diff ? msg('<strong>£[£] less than expected.</strong> Save it as part paid and keep chasing the rest, or close it with a reason.', 'warn', true) : msg('Matches what was expected.', 'ok')}${logged()}`, `${button('Cancel', { variant: 'ghost' })}${diff ? `${button('Close with a reason…', { variant: 'default' })}${button('Save as part paid')}` : button('Mark paid')}`, 560);
const cancelOrder = (ordered = false) => popup('cx-title', 'Maya isn’t going ahead?', `Quote ${QNUM} · ${BIKE} · ${SIZE_}`, ordered
  ? `${msg(`<strong>The bike was ordered from [supplier]</strong> on [date], and certificate [certificate number] was added.`, 'grey')}${group('The bike', `${radio('Keep it as shop stock', true, 'It goes on sale at Bolton when it arrives.', 'cxb')}${radio('Send it back to [supplier]', false, 'Starts a return in Deliveries and orders.', 'cxb')}`)}${msg(`<strong>Tell ${PROV}</strong> the order is cancelled — the way your note for them says.`, 'warn')}${tick('Email Maya that the order is cancelled', true)}${textBox('cx-why', 'Why?', '[reason]')}${logged()}`
  : `${msg(`<strong>${BIKE} · ${SIZE_}</strong> goes back on sale at Bolton.`, 'grey')}${msg('<strong>Deposit:</strong> £[£] refunded, the way it was paid — your rule for a customer who pulls out.', 'grey')}${tick('Email Maya that the order is cancelled', true)}${textBox('cx-why', 'Why?', '[reason]')}${logged()}`, `${button('Keep the order', { variant: 'ghost' })}${button('Cancel the order', { variant: 'danger' })}`, 560);

// ---------- Money owed (decision 5; audit M6) ----------
const owedPage = () => c2wPage(`${back('Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Owed by Cycle to Work providers')}${note('Bikes collected, not yet paid for · North Street Cycles, Bolton')}</div>${button(isPhone() ? 'Download' : 'Download as spreadsheet', { variant: 'default' })}</div>
${box(`<table style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; font-size: 13px; color: ${C.muted}"><th style="padding: 8px 0; font-weight: 600">Provider</th><th style="padding: 8px; font-weight: 600">Bikes</th><th style="padding: 8px; font-weight: 600; text-align: right">Owed</th><th style="padding: 8px 0; font-weight: 600; text-align: right">Late</th></tr></thead><tbody>${[['[Provider]', '[n]', '£[£]', badge('£[£] · [n] days', 'amber')], ['[Provider]', '[n]', '£[£]', '—'], ['[Provider]', '[n]', '£[£]', '—']].map(([p, n, o, l]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 10px 0"><a href="#" style="${tall}; font-weight: 700; color: ${C.ink}">${p}</a></td><td style="padding: 10px 8px">${n}</td><td style="padding: 10px 8px; text-align: right">${mono(o)}</td><td style="padding: 10px 0; text-align: right">${l}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 10px 0; font-weight: 700">Total</td><td></td><td style="padding: 10px 8px; text-align: right; font-weight: 700">${mono('£[£]')}</td><td></td></tr></tbody></table>`)}${note('Also in Reports, as “Owed by Cycle to Work providers”.')}`);

// ---------- Settings › Front desk › Cycle to Work (decisions 3, 4, 5; audit L3, M9) ----------
const unitSwitch = (label, on) => `<span role="group" aria-label="${esc(label)} in" style="display: inline-flex; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden">${['£', '%'].map((u) => `<button type="button" aria-pressed="${u === on}" style="min-width: 44px; min-height: 44px; border: 0; background: ${u === on ? C.ink : C.panel}; color: ${u === on ? C.panel : C.ink}; font-family: inherit; font-size: 15px; font-weight: 700">${u}</button>`).join('')}</span>`;
const numRow = (label, value, unit) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 52px"><label style="flex: 1 1 260px; font-size: 15px; font-weight: 600">${label}</label><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px"><input aria-label="${esc(label)}" value="${value}" style="width: 70px; min-height: 44px; box-sizing: border-box; text-align: center; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}">${unit}</span></div>`;
const holdOpen = () => `${numRow('Hold a bike in stock from the quote for', '[n]', 'days')}${numRow('Remind the shop before the hold ends', '[n]', 'days before')}${numRow('Quotes are valid for', '[n]', 'days')}${note('The certificate makes the hold firm until the bike is collected.')}`;
const orderOpen = () => `${group('Order a bike that isn’t in stock', `${radio('Once the certificate arrives', true, 'Safest. The customer waits a little longer.', 'rule')}${radio('Once the customer has applied', false, 'Staff mark the order “Applied”, with the application reference if there is one.', 'rule')}${radio('Straight away, with a deposit', false, 'Until the certificate arrives.', 'rule')}`)}${numRow('Deposit', '[£]', unitSwitch('Deposit', '£'))}${note('Owners, managers and anyone with “Can close the day” can still “Order now anyway” on one order, with a reason that goes in the activity log.')}`;
const depositOpen = () => `${group('When the certificate arrives', `${radio('Refund the deposit', true, 'The way it was paid.', 'dep')}${radio('Count it toward the price', false, 'The provider pays the rest; Wheelhouse works out the split.', 'dep')}`)}${group('If the customer pulls out', `${radio('Refund it', true, '', 'out')}${radio('Keep it when the bike was ordered in', false, 'The quote says so.', 'out')}`)}`;
const applyOpen = () => `${textBox('ap-words', 'How to apply', '[The shop’s own words — for example, where customers start their application]', 'Printed on every quote and in the “Your bike is put aside” email.')}`;
const provRow = (n) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 56px; padding: 6px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 240px"><span style="font-size: 15px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">Commission [%] · pays in about [n] days · [n] checks at hand-over</span></span>${link('Edit', `Edit ${n}`)}${link('Retire', `Retire ${n}`)}</div>`;
const providersOpen = () => `${note('The schemes your customers use. Their terms are yours to fill in, from each provider’s agreement.')}${provRow('[Provider]')}${provRow('[Provider]')}${provRow('[Provider]')}<div>${button('+ Add a provider', { variant: 'default' })}</div>${note('Changing a provider’s terms applies to new orders; open orders keep the terms they were made with.')}`;
const c2wSettings = (open) => settingsPage('c2w', 'Cycle to Work', C2W_INTRO, c2wFolds(open), { who: OWNER });
const providerEdit = () => popup('pe-title', 'Edit provider', '[Provider]', `${field('Name', { value: '[Provider]' })}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px"><div style="display: flex; align-items: flex-end; gap: 8px"><div style="flex-grow: 1">${field('Commission', { value: '[%]' })}</div>${unitSwitch('Commission', '%')}</div>${field('Pays in about', { value: '[n] days', hint: 'After collection' })}</div>${group('Accessories', `${radio('Inside what the provider pays', true, '', 'pacc')}${radio('The customer pays for them at collection', false, '', 'pacc')}`)}${textBox('pe-notes', 'Checks at hand-over', '[From their agreement — one check per line]', 'Each line becomes a box for staff to tick at hand-over.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 580);

// ---------- What the customer gets (decision 6; audit M7) ----------
const email = () => {
  const [W, H] = DIMS[SIZE];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${isPhone() ? 12 : 40}px; display: flex; justify-content: center; align-items: flex-start; background: ${C.bg}"><article aria-label="Email to Maya Patel" style="width: ${isPhone() ? '100%' : '600px'}; box-sizing: border-box; padding: 28px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px; font-size: 15px; line-height: 1.55; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to maya@example.test</span><h1 style="margin: 0; font-size: 22px">Your bike is put aside</h1><p style="margin: 0">Hi Maya, we’re holding ${BIKE} · ${SIZE_} for you until [date], for your Cycle to Work scheme through ${PROV}.</p><p style="margin: 0">Your quote number is ${mono(QNUM)}. We’ll let you know as soon as your certificate reaches us.</p><p style="margin: 0"><strong>How to apply:</strong> [The shop’s own words, from Settings]</p>${button('See your order')}<p style="margin: 0; font-size: 13px; color: ${C.muted}">North Street Cycles · [Shop address] · [shop phone]</p></article></div>`;
};
const customerView = () => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px"><div style="width: 100%; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${back('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your Cycle to Work bike</h1>${note(`Quote ${QNUM} · North Street Cycles, Bolton · ${PROV}`)}
${stages(1, STAGES.slice(0, 5))}
${box(`${msg(`<strong>Your bike is put aside until [date].</strong> We’ll email you when your certificate reaches us.`, 'grey')}${kv('Bike', `${BIKE} · ${SIZE_}`)}${kv('Accessories', '[Accessory] · [Accessory]')}${kv('Total (includes VAT)', mono('£[£]'))}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('See your quote', { variant: 'default' })}${button('Ask the shop a question', { variant: 'default' })}</div>`)}
${box(`${h3('How to apply')}<p style="margin: 0; font-size: 15px; line-height: 1.5">[The shop’s own words, from Settings]</p>`)}</div></div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};
const messages = () => settingsPage('messages', 'Messages', MSG_INTRO, msgFolds({ list: msgListOpen({ bringBack: false }) }), { who: OWNER });
const scrolledMsgs = (px) => messages().replace(/<div data-scroll style="([^"]*)overflow-y: auto;/, `<div data-scroll class="cw-sc" style="$1overflow-y: hidden;`).replace('<div data-scroll class="cw-sc"', `<style>.cw-sc > * { position: relative; top: -${px}px }</style><div data-scroll class="cw-sc"`);
// Audit L5: Jack is the Owner on every board, Who's in too.
const todayBoard = (held = false) => {
  const html = today({ c2w: held ? 'held' : true, as: OWNER }).replace('Checked in at [time] · Manager', 'Checked in at [time] · Owner');
  return held ? withToast(html, toast('Maya Patel’s bike is held until [date].', 'Undo')) : html;
};

// ---------- The boards ----------
const as = (who, fn) => () => { const was = WHO; WHO = who; try { return fn(); } finally { WHO = was; } };
const staff = (id, fn) => def(id, as(STAFF, fn));
const owner = (id, fn) => def(id, as(OWNER, fn));
staff('cw-list', () => listPage());
owner('cw-list-owner', () => listPage());
owner('cw-first-use', () => firstUse());
staff('cw-new', () => overlay(listPage(), newOrder(true)));
staff('cw-new-not-in-stock', () => overlay(listPage(), newOrder(false)));
staff('cw-quote', () => quoteDoc());
staff('cw-quote-deposit', () => quoteDoc({ closing: 'deposit' }));
staff('cw-order-held', () => withToast(orderPage(), toast('Quote emailed to maya@example.test. Bike held until [date].')));
staff('cw-hold-ending', () => overlay(orderPage(), holdReminder()));
staff('cw-applied', () => overlay(orderPage({ next: 'toApply', order: true, hist: ['quote', 'toOrder'] }), applied()));
staff('cw-order-applied', () => orderPage({ next: 'applied', order: true, hist: ['quote', 'toOrder', 'applied'] }));
staff('cw-ordered', () => withToast(listPage(), toast('Ordered [Customer]’s bike from [supplier].', 'Undo')));
staff('cw-order-deposit', () => orderPage({ next: 'deposit', order: true, hist: ['quote', 'toOrderDep'] }));
owner('cw-order-anyway', () => overlay(orderPage({ next: 'deposit', order: true, hist: ['quote', 'toOrderDep'] }), orderAnyway()));
staff('cw-order-deposit-paid', () => orderPage({ next: 'depositPaid', order: true, deposit: true, hist: ['quote', 'toOrderDep', 'deposit', 'ordered'] }));
staff('cw-certificate', () => overlay(orderPage(), certificate()));
staff('cw-certificate-diff', () => overlay(orderPage(), certificate(true)));
staff('cw-certificate-released', () => overlay(orderPage(), certReleased()));
staff('cw-order-on-order', () => orderPage({ stage: 2, next: 'onOrder', order: true, hist: ['quote', 'toOrder', 'applied', 'ordered', 'cert', 'certMail'] }));
staff('cw-order-ready', () => orderPage({ stage: 3, next: 'ready', hist: upTo('readyMail') }));
staff('cw-hand-over', () => overlay(orderPage({ stage: 3, next: 'ready', hist: upTo('readyMail') }), handOver()));
owner('cw-order-owed', () => orderPage({ stage: 4, next: 'owed', hist: upTo('handed'), expected: true }));
owner('cw-mark-paid', () => overlay(listPage(), markPaid()));
owner('cw-mark-paid-diff', () => overlay(listPage(), markPaid(true)));
owner('cw-order-part-paid', () => orderPage({ stage: 4, next: 'part', hist: [...upTo('handed'), 'part'], expected: true }));
owner('cw-order-paid', () => orderPage({ stage: 6, next: 'paid', hist: upTo('paid'), expected: true }));
owner('cw-owed', () => owedPage());
owner('cw-more', () => orderPage({ menu: moreMenu() }));
owner('cw-quote-revised', () => quoteDoc({ revised: true }));
owner('cw-cancel', () => overlay(orderPage({ next: 'deposit', order: true, deposit: true, hist: ['quote', 'toOrderDep', 'deposit'] }), cancelOrder()));
owner('cw-cancel-ordered', () => overlay(orderPage({ stage: 2, next: 'onOrder', order: true, hist: ['quote', 'toOrder', 'applied', 'ordered', 'cert', 'certMail'] }), cancelOrder(true)));
owner('cw-today', () => todayBoard());
owner('cw-today-held', () => todayBoard(true));
owner('cw-settings', () => c2wSettings({ hold: holdOpen(), order: orderOpen() }));
owner('cw-settings-deposit', () => c2wSettings({ deposit: depositOpen(), apply: applyOpen() }));
owner('cw-settings-provider', () => overlay(c2wSettings({ providers: providersOpen() }), providerEdit()));
owner('cw-messages', () => scrolledMsgs(isPhone() ? 900 : 470));
def('cw-email', () => email());
def('cw-customer-view', () => customerView());

const SIZES = ['desktop'];
const NO_SIDEBAR = new Set(['cw-email', 'cw-customer-view']);
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; const html = fn(); return NO_SIDEBAR.has(id) ? html : countIn(html); });
}
SIZE = 'desktop';

export const TITLES = {
  'cw-list': 'Front desk › Cycle to Work: every order, by stage (staff)',
  'cw-list-owner': 'The list for the owner: what’s owed, and Mark paid',
  'cw-first-use': 'The first time: no providers yet',
  'cw-new': 'New Cycle to Work order: a bike in stock, held',
  'cw-new-not-in-stock': 'A bike that isn’t in stock: what the quote will say',
  'cw-quote': 'The quote, to print or email',
  'cw-quote-deposit': 'The quote for a bike ordered with a deposit',
  'cw-order-held': 'The order: quote given, bike held until [date]',
  'cw-hold-ending': 'The hold is ending: hold longer, or release',
  'cw-applied': 'Maya has applied: date and reference',
  'cw-order-applied': 'Not in stock, customer applied: ready to order',
  'cw-ordered': 'Ordered from the supplier, with Undo',
  'cw-order-deposit': 'Not in stock, deposit rule: waiting for a deposit',
  'cw-order-anyway': 'Order now anyway, with a reason',
  'cw-order-deposit-paid': 'Deposit paid, bike ordered',
  'cw-certificate': 'Add the certificate',
  'cw-certificate-diff': 'A certificate for less than the quote',
  'cw-certificate-released': 'A certificate for a bike already released',
  'cw-order-on-order': 'Certificate received, bike on order',
  'cw-order-ready': 'Ready to collect',
  'cw-hand-over': 'Hand over: the provider’s checks, then the till',
  'cw-order-owed': 'Collected: expected from the provider',
  'cw-mark-paid': 'Mark paid',
  'cw-mark-paid-diff': 'Paid less than expected',
  'cw-order-part-paid': 'Part paid: the rest still owed',
  'cw-order-paid': 'Paid by the provider',
  'cw-owed': 'Owed by Cycle to Work providers',
  'cw-more': 'More: change or cancel the order',
  'cw-quote-revised': 'A revised quote, not sent until Email',
  'cw-cancel': 'The customer isn’t going ahead: a deposit to refund',
  'cw-cancel-ordered': 'Cancelling after the bike was ordered',
  'cw-today': 'Today: no certificate yet, a payment late',
  'cw-today-held': 'Today: Hold longer, done in one press',
  'cw-settings': 'Settings › Front desk › Cycle to Work: holding and ordering',
  'cw-settings-deposit': 'Deposits, and how to apply',
  'cw-settings-provider': 'A provider: commission, payment days, hand-over checks',
  'cw-messages': 'Settings › Messages: the Cycle to Work messages',
  'cw-email': '“Your bike is put aside” email',
  'cw-customer-view': 'The customer’s account: their Cycle to Work bike',
};
export const ROWS = [
  { label: 'The list and a new order', screens: ['cw-list', 'cw-list-owner', 'cw-first-use', 'cw-new', 'cw-new-not-in-stock', 'cw-quote', 'cw-quote-deposit', 'cw-order-held'] },
  { label: 'Waiting for the certificate', screens: ['cw-hold-ending', 'cw-applied', 'cw-order-applied', 'cw-ordered', 'cw-order-deposit', 'cw-order-anyway', 'cw-order-deposit-paid', 'cw-certificate', 'cw-certificate-diff', 'cw-certificate-released'] },
  { label: 'Collection and payment', screens: ['cw-order-on-order', 'cw-order-ready', 'cw-hand-over', 'cw-order-owed', 'cw-mark-paid', 'cw-mark-paid-diff', 'cw-order-part-paid', 'cw-order-paid', 'cw-owed'] },
  { label: 'Changes and cancelling', screens: ['cw-more', 'cw-quote-revised', 'cw-cancel', 'cw-cancel-ordered'] },
  { label: 'Today, the customer, settings and messages', screens: ['cw-today', 'cw-today-held', 'cw-customer-view', 'cw-email', 'cw-settings', 'cw-settings-deposit', 'cw-settings-provider', 'cw-messages'] },
];
