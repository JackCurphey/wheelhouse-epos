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
// Walk-through 5 L3: the list's status badges and its top line at 14px.
const bigBadge = (t, tone) => badge(t, tone).replace('font-size: 12px', 'font-size: 14px');
const cols = () => (isPhone() ? '1fr' : '200px minmax(0, 1fr) 230px 190px');
const orderRow = ({ who, quote = `Quote ${QNUM}`, bike = `${BIKE} · ${SIZE_}`, prov = PROV, status, action }) => `<div role="listitem" style="display: grid; grid-template-columns: ${cols()}; gap: ${isPhone() ? 6 : 16}px; align-items: center; padding: 12px 0; border-top: 1px solid ${C.border}"><a href="#" aria-label="Open ${esc(who)}’s order" style="display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; color: ${C.ink}; text-decoration: none"><span style="font-size: 15px; font-weight: 700; text-decoration: underline">${who}</span><span style="font-size: 13px; color: ${C.muted}">${quote}</span></a><span style="display: flex; flex-direction: column; gap: 3px; font-size: 14px"><span>${bike}</span><span style="color: ${C.muted}">${prov}</span></span><span style="font-size: 14px">${status}</span><span style="justify-self: ${isPhone() ? 'start' : 'end'}">${action}</span></div>`;
const stageGroup = (title, count, rows, sub = '') => box(`<h2 style="margin: 0; font-size: 17px; font-weight: 700">${title} · ${count}</h2>${sub ? note(sub) : ''}<div role="list">${rows.join('')}</div>`);
// UX walk-through 5 M3: a hold that reaches its date with nobody choosing
// stays held and asks for a choice (holdEnded). H2: a deposit still to
// refund shows on the list (refund).
const listPage = ({ holdEnded = false, refund = false } = {}) => {
  const money = seesMoney();
  const maya = refund
    ? orderRow({ who: '[Customer]', status: `Held until [date]<br>${bigBadge('Hold ends in [n] days', 'amber')}`, action: named(button('Add the certificate', { variant: 'default' }), 'Add [Customer]’s certificate') })
    : holdEnded
      ? orderRow({ who: 'Maya Patel', status: `Still held<br>${bigBadge('Hold ended [date] — choose', 'amber')}`, action: named(button('Choose', { variant: 'default' }), 'Choose what to do with Maya Patel’s hold') })
      : orderRow({ who: 'Maya Patel', status: `Held until [date]<br>${bigBadge('Hold ends in [n] days', 'amber')}`, action: named(button('Add the certificate', { variant: 'default' }), 'Add Maya Patel’s certificate') });
  const markPaid = (who) => named(button('Mark paid', { variant: 'default' }), `Mark paid: ${who} · ${PROV}`);
  return c2wPage(`${note('Thursday 17 September · North Street Cycles, Bolton')}
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px"><p style="margin: 0; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 15px">${bigBadge(holdEnded ? '1 hold ended — choose' : '1 hold ending soon', 'amber')}${refund ? bigBadge('1 deposit to refund', 'amber') : ''}${bigBadge('1 bike ready to order', 'blue')}${bigBadge('1 payment late', 'amber')}${money ? `<a href="#" style="${tall}; font-weight: 600; color: ${C.ink}">Owed by providers £[£] · 1 late</a>` : ''}</p>${button('+ New Cycle to Work order')}</div>
${stageGroup('Waiting for the certificate', 3, [
    maya,
    orderRow({ who: '[Customer]', status: 'Held until [date]', action: named(button('Add the certificate', { variant: 'default' }), 'Add [Customer]’s certificate') }),
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · not in stock`, status: `Applied [date]<br>${bigBadge('Ready to order', 'blue')}`, action: named(button('Order from [supplier]', { variant: 'default' }), 'Order [Customer]’s bike from [supplier]') }),
  ], 'Bikes in stock are held for the customer. Ones to order follow your rule in Settings.')}
${stageGroup('Certificate received', refund ? 2 : 1, [
    ...(refund ? [orderRow({ who: 'Maya Patel', bike: `${BIKE} · ${SIZE_} · on order`, status: `Due from [supplier] [date]<br>${bigBadge('Deposit to refund · Maya Patel', 'amber')}`, action: named(button('Refund the deposit', { variant: 'default' }), 'Refund Maya Patel’s £[£] deposit') })] : []),
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · on order`, status: 'Due from [supplier] [date]', action: link('Open', 'Open [Customer]’s order') }),
  ])}
${stageGroup('Ready to collect', 1, [
    orderRow({ who: '[Customer]', status: 'Certificate [certificate number] · put aside', action: named(button('Hand over', { variant: 'default' }), 'Hand over [Customer]’s bike') }),
  ])}
${stageGroup('Collected · waiting for payment', 2, [
    orderRow({ who: '[Customer]', status: 'Expected £[£] by [date]', action: money ? markPaid('[Customer]') : link('Open', 'Open [Customer]’s order') }),
    orderRow({ who: '[Customer]', status: `${bigBadge('[n] days late', 'amber')} £[£] was due [date]`, action: money ? markPaid('[Customer]') : link('Open', 'Open [Customer]’s late order') }),
  ])}
${stageGroup('Paid · last 30 days', '[n]', [orderRow({ who: '[Customer]', status: 'Paid £[£] on [date]', action: link('Open', 'Open [Customer]’s paid order') })])}`);
};
const firstUse = () => c2wPage(`${note('North Street Cycles, Bolton')}
${box(`${h3('No Cycle to Work orders yet')}<p style="margin: 0; font-size: 15px; line-height: 1.5">Each bike sold through a scheme gets an order here, from the quote to the provider’s payment.</p>${msg('<strong>No scheme providers yet.</strong> Add the providers your customers use, with their terms, before the first quote.', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add providers')}${button('Set how bikes are held and ordered', { variant: 'default' })}</div>${note('Staff can start orders once there’s a provider to choose.')}`, 'max-width: 720px')}`, OWNER);

// ---------- One order (decisions 1, 3, 4, 5) ----------
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider'];
const stages = (at, labels = STAGES) => `<ol aria-label="Stages" style="margin: 0; padding: 0; display: grid; grid-template-columns: repeat(${isPhone() ? 2 : labels.length}, minmax(0, 1fr)); gap: 6px">${labels.map((s, i) => { const done = i < at, now = i === at; return `<li${now ? ' aria-current="step"' : ''} style="list-style: none; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; border: ${now ? 2 : 1}px solid ${now ? C.ink : C.border}; background: ${done ? C.mutedBg : C.panel}; font-size: 13px"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${done || now ? C.ink : C.muted}">${done ? icon('check', 14) : `<span style="width: 14px; text-align: center">${i + 1}</span>`}${s}</span><span style="color: ${C.muted}">${done ? '[date]' : now ? 'Now' : ''}</span></li>`; }).join('')}</ol>`;
// Audit M10: one history that only grows, oldest first.
// UX walk-through 5 L3: the quote email says the bike is put aside, so "Your
// bike is put aside" isn't sent separately when the two go together.
// UX walk-through 5 M6: step messages go the way Maya chose (text); the quote
// stays an email. M1 (option 1): the certificate and "ready" in one save,
// one message. M3: "Hold longer" sends "put aside" again with the new date.
// UX walk-through 5 M3: the closing line names both dates.
const CLOSING = {
  held: 'We’re holding your bike until [date]. This quote is valid until [date]. Once your certificate reaches us, it’s yours to collect.',
  applied: `${BIKE} isn’t in stock. We’ll order it once you’ve applied, and let you know when it arrives.`,
  deposit: `${BIKE} isn’t in stock. We’ll order it once you’ve paid a £[£] deposit, refunded when your certificate reaches us.`,
};
const EV = {
  quote: ['Jo Taylor', `gave quote ${QNUM} and emailed it to maya@example.test · it says the bike is put aside until [date]`],
  // UX walk-through 5 L1: when the bike isn't in stock, the history ends with
  // the quote's own closing sentence.
  quoteApplied: ['Jo Taylor', `gave quote ${QNUM} and emailed it to maya@example.test · it says “${CLOSING.applied}”`],
  quoteDeposit: ['Jo Taylor', `gave quote ${QNUM} and emailed it to maya@example.test · it says “${CLOSING.deposit}”`],
  held: ['Jo Taylor', `held ${BIKE} · ${SIZE_} until [date]`],
  putAside: ['Wheelhouse', 'texted Maya: “Your bike is put aside”'],
  longer: ['Jo Taylor', 'held the bike longer, until [date]'],
  longerMail: ['Wheelhouse', 'texted Maya: “Your bike is put aside” · until [date]'],
  toOrder: ['Jo Taylor', `${BIKE} · ${SIZE_} not in stock — to order once Maya has applied (your rule)`],
  toOrderDep: ['Jo Taylor', `${BIKE} · ${SIZE_} not in stock — to order once a £[£] deposit is paid (your rule)`],
  applied: ['Jo Taylor', 'marked Maya as applied · employer [Employer] · reference [reference]'],
  deposit: ['Jo Taylor', 'took a £[£] deposit at the till · sale B1-[0000]'],
  ordered: ['Jo Taylor', 'ordered the bike from [supplier] · supplier order [order number]'],
  cert: ['Jack Lewis', 'added certificate [certificate number] · certificate £[£] · quote £[£]'],
  certMail: ['Wheelhouse', 'texted Maya: “Certificate received”'],
  certMailDep: ['Wheelhouse', 'texted Maya: “Certificate received” · her £[£] deposit is being refunded'],
  certReady: ['Jack Lewis', 'added certificate [certificate number] · certificate £[£] · quote £[£] · and marked the bike ready to collect'],
  ready: ['Jo Taylor', 'marked the bike ready to collect'],
  readyMail: ['Wheelhouse', 'texted Maya: “Ready to collect” · it says the certificate arrived'],
  readyOnly: ['Wheelhouse', 'texted Maya: “Ready to collect”'],
  handed: ['Jo Taylor', `handed over the bike · checks ticked [n] of [n] · till sale B1-[0000]: Cycle to Work · ${PROV} £[£]`],
  part: ['Jack Lewis', 'saved part paid: £[£] of £[£] received [date] · £[£] still owed'],
  paid: ['Jack Lewis', 'marked paid: £[£] received [date] · reference [reference]'],
};
const FLOW = ['quote', 'held', 'longer', 'longerMail', 'certReady', 'readyMail', 'handed', 'paid'];
const historyBox = (keys) => box(`${h3('What’s happened')}<ol style="margin: 0; padding: 0">${keys.map((k) => { const [w, t] = EV[k]; return `<li style="list-style: none; display: flex; gap: 12px; padding: 7px 0; border-top: 1px solid ${C.border}; font-size: 14px">${mono('[date]', `flex-shrink: 0; color: ${C.muted}`)}<span><strong>${w}</strong> ${t}</span></li>`; }).join('')}</ol>`);
const upTo = (k) => FLOW.slice(0, FLOW.indexOf(k) + 1);
// Audit H2: who pays what, worked out from the order.
// UX walk-through 5 H2 (option 1): it follows the shop's deposit rule. With
// "Refund the deposit" (the rule drawn in Settings) the deposit isn't taken
// off; only "Count it toward the price" subtracts it. deposit: false,
// 'refund' (or true) or 'count'.
const whoPays = ({ deposit = false, extra = false, title = true } = {}) => { const rule = deposit === true ? 'refund' : deposit; return `${title ? `<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Who pays what</h3>` : ''}<div>${kv('Order total', mono('£[£]'))}${rule === 'count' ? kv('Deposit Maya has paid', mono('−£[£]')) : ''}${kv(`${PROV} pays (the certificate)`, mono('£[£]'))}${kv('Maya pays at collection', mono(extra || rule === 'count' ? '£[£]' : '£0.00'), true)}${rule === 'refund' ? kv('Deposit £[£]', 'refunded when the certificate arrives') : ''}</div>`; };
const details = (stage, { order = false, deposit = false, expected = false } = {}) => box(`${h3('The order')}${kv('Bike', `${BIKE} · ${SIZE_}${order ? ' · not in stock' : ''}`)}${kv('Accessories', '[Accessory] · [Accessory]')}${kv('Provider', seesMoney() ? `${PROV} · commission [%]` : PROV)}${kv('Expected from the provider', expected ? mono('£[£] by [date]') : 'After collection')}${whoPays({ deposit })}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Email the quote again', { variant: 'default' })}${button('Print the quote', { variant: 'default' })}</div>`);
const customerBox = () => box(`${h3('Customer')}<a href="#" style="${tall}; font-size: 15px; font-weight: 700; color: ${C.ink}">Maya Patel</a><span style="font-size: 14px">${mono('07700 900 142')} · maya@example.test</span>${kv('Applied', '[date]')}${kv('Employer', '[Employer]')}${kv('Application reference', '[reference]')}<div>${link('Change', 'Change Maya’s application details')}</div>`);
// What to do next, at each stage.
const NEXT = {
  held: () => box(`${h3('Next: the certificate')}${msg(`<strong>${BIKE} · ${SIZE_} is held until [date].</strong> Hold ends in [n] days — we’ll remind the shop [n] days before.`, 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add the certificate')}${button('Hold longer', { variant: 'default' })}${button('Release the bike', { variant: 'default' })}</div>`),
  toApply: () => box(`${h3('Next: Maya applies')}${msg('<strong>Not in stock.</strong> Your rule: order once the customer has applied.', 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Mark as applied')}${button('Add the certificate', { variant: 'default' })}</div>`),
  applied: () => box(`${h3('Next: order the bike')}${msg('<strong>Maya has applied</strong> (reference [reference]). Your rule: order once the customer has applied.', 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Order from [supplier]')}${button('Add the certificate', { variant: 'default' })}</div>${note('Ordering creates the supplier order in Deliveries and orders.')}`),
  // UX walk-through 5 H2 (option 1): the deposit is one line at the till,
  // linked to the order (till.mjs, till-c2w-deposit); the refund is the order's next step once the
  // certificate is added, done through the till's refund of that sale.
  deposit: () => box(`${h3('Next: a deposit, then order')}${msg('<strong>Waiting for a £[£] deposit before ordering.</strong> Your rule: order straight away with a deposit, until the certificate arrives.', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Take the deposit at the till')}${seesMoney() ? button('Order now anyway…', { variant: 'default' }) : ''}</div>${note('Opens the till with one line, “Deposit · Maya Patel’s Cycle to Work order”, linked back to this order. Your rule in Settings: it’s refunded when the certificate arrives.')}`),
  depositPaid: () => box(`${h3('Next: the certificate')}${msg('<strong>£[£] deposit paid and the bike ordered</strong> from [supplier] · due [date].', 'ok')}<div>${button('Add the certificate')}</div>${note('Your rule: refund the deposit. When the certificate is added, “Refund the £[£] deposit” becomes this order’s next step, for whoever adds it.')}`),
  depositCounted: () => box(`${h3('Next: the certificate')}${msg('<strong>£[£] deposit paid and the bike ordered</strong> from [supplier] · due [date].', 'ok')}<div>${button('Add the certificate')}</div>${note('Your rule: count the deposit toward the price. It’s taken off what Maya pays at collection, and nothing is refunded.')}`),
  depositRefund: () => box(`${h3('Next: refund the deposit')}${msg('<strong>Certificate received. Refund Maya’s £[£] deposit</strong> — your rule in Settings. It was paid at the till, sale B1-[0000].', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${named(button('Refund the £[£] deposit'), 'Refund Maya Patel’s £[£] deposit at the till')}</div>${note('Opens the till’s refund of the deposit sale, back the way it was paid. Until it’s done, the list and Today show “Deposit to refund · Maya Patel”. The bike is still on order from [supplier], due [date].')}`),
  onOrder: () => box(`${h3('Next: the bike arrives')}${msg('<strong>Certificate received.</strong> The bike is on order from [supplier], due [date].', 'ok')}${note('When it’s booked in through Deliveries and orders, it’s put aside for Maya and this order moves to Ready to collect. Maya is emailed “Ready to collect” then.')}<div>${link('Open the supplier order', 'Open the supplier order for Maya’s bike')}</div>`),
  // UX walk-through 5 M1 (option 1): the certificate was saved with "The
  // bike is ready" unticked, because the bike needs work first.
  getReady: () => box(`${h3('Next: get the bike ready')}${msg(`<strong>Certificate received.</strong> ${BIKE} · ${SIZE_} is put aside for Maya. She’s been sent “Certificate received”.`, 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${named(button('Mark ready to collect'), 'Mark Maya Patel’s bike ready to collect')}</div>${note('One press, with Undo. Maya is sent “Ready to collect”.')}`),
  ready: () => box(`${h3('Next: hand over')}${msg(`<strong>Ready to collect.</strong> Certificate [certificate number] · ${BIKE} put aside.`, 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Hand over')}</div>`),
  owed: () => box(`${h3('Next: the provider’s payment')}${msg(`<strong>Expected £[£] from ${PROV} by [date]</strong> — the certificate £[£] less [%] commission.`, 'grey')}<div>${button('Mark paid')}</div>${note('If it hasn’t arrived [n] days after that, it shows on Today.')}`),
  part: () => box(`${h3('Next: the rest of the payment')}${msg(`<strong>£[£] of £[£] received from ${PROV}.</strong> £[£] still owed — it stays on the owed list and on Today if it’s late.`, 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Mark the rest paid')}${button('Close with a reason…', { variant: 'default' })}</div>`),
  paid: () => box(`${h3('Paid')}${msg(`<strong>£[£] received from ${PROV} on [date]</strong>, as expected.`, 'ok')}`),
};
const more = () => named(button('More…', { variant: 'default' }).replace('<button', '<button aria-haspopup="menu"'), 'More for Maya Patel’s order');
const orderPage = ({ stage = 1, next = 'held', hist = upTo('held'), order = false, deposit = false, expected = false, menu = '' } = {}) => {
  const left = `${NEXT[next]()}${historyBox(hist)}`;
  const right = `${details(stage, { order, deposit, expected })}${customerBox()}`;
  return c2wPage(`${back('Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Maya Patel · Cycle to Work')}${note(`Quote ${QNUM} · North Street Cycles, Bolton`)}</div><div style="position: relative">${more()}${menu}</div></div>
${stages(stage)}
${isPhone() ? `${left}${right}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${right}</div></div>`}`);
};
// Audit M9: the More menu.
const moreMenu = () => `<div role="menu" aria-label="More for Maya Patel’s order" style="position: absolute; ${isPhone() ? 'left: 0' : 'right: 0'}; top: 50px; z-index: 5; width: ${isPhone() ? 300 : 280}px; padding: 6px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(38,36,32,0.18); display: flex; flex-direction: column">${['Change the bike or size', 'Change the accessories', 'Change the provider', 'Release the bike'].map((t) => `<button type="button" role="menuitem" style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-family: inherit; font-size: 15px; color: ${C.ink}">${t}</button>`).join('')}<span style="height: 1px; margin: 4px 6px; background: ${C.border}"></span><button type="button" role="menuitem" style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-family: inherit; font-size: 15px; color: ${C.danger}">Cancel the order…</button><p style="margin: 6px 12px 8px; font-size: 13px; color: ${C.muted}; line-height: 1.45">A change after the quote is sent makes a revised quote; nothing is sent until you press Email.</p></div>`;

// ---------- Starting one (decisions 1, 3, 4, 6; audit H5, M1, M4, M11) ----------
const select = (id, label, value, sub = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label id="${id}-l" for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><button id="${id}" type="button" aria-haspopup="listbox" aria-labelledby="${id}-l ${id}"${sub ? ` aria-describedby="${id}-s"` : ''} style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button>${sub ? `<span id="${id}-s" style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</div>`;
const saysBox = (k) => `<div style="padding: 10px 12px; border-radius: 8px; border: 1px dashed ${C.input}; font-size: 14px; line-height: 1.5"><span style="display: block; font-size: 13px; font-weight: 700; color: ${C.muted}">The quote will say</span>${CLOSING[k]}</div>`;
const newOrder = (inStock = true) => popup('no-title', 'New Cycle to Work order', 'North Street Cycles, Bolton', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${select('no-cust', 'Customer', 'Maya Patel · 07700 900 142')}${select('no-prov', 'Scheme provider', PROV, 'Pays in about [n] days')}</div>
${select('no-bike', 'Bike', `${BIKE} · ${SIZE_}`, inStock ? '1 free at Bolton · none held' : 'None at Bolton or [Second site] · from [supplier], about [n] days')}
${select('no-acc', 'Accessories', '[Accessory] · [Accessory]', 'Optional')}
${inStock ? tick('Hold the bike until [date]', true, '[n] days, from Settings. Untick for an easy-to-replace bike.') : ''}
${saysBox(inStock ? 'held' : 'applied')}
${tick('Email the quote to maya@example.test now', true, inStock ? 'It says the bike is put aside, so no separate “put aside” message goes.' : '')}
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
// UX walk-through 5 M1 (option 1): a "the bike is ready" tick, ticked for a
// held bike in stock; saved ticked, the order goes to Ready to collect and
// Maya gets one message. H4: each choice says what Maya will be told, and a
// certificate for more is drawn. M3: a certificate after the quote ran out.
// kind: 'match', 'less', 'more' or 'late'.
const readyTick = () => tick('The bike is ready — tell Maya she can collect it', true, 'Leave it ticked if the bike can go now. Untick it if it needs work first: Maya is sent “Certificate received” now, and “Ready to collect” when you mark it ready.');
const certificate = (kind = 'match') => { const diff = kind === 'less' || kind === 'more'; return popup('ce-title', 'Add the certificate', `Maya Patel · ${PROV}`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Certificate number', { value: '[certificate number]' })}${field('Amount on the certificate', { value: kind === 'less' ? '£[£ less]' : kind === 'more' ? '£[£ more]' : '£[£]' })}</div>${field('Received', { value: '[date]' })}
${kind === 'less' ? `${msg('<strong>Certificate £[£ less] · quote £[£].</strong> £[£] less than the quote.', 'warn', true)}${group('What to do', `${radio('Change the order to match', true, 'Take something off so the total is the certificate amount. Maya is emailed “Certificate received” with the revised quote.', 'cd')}${radio('Keep the order; Maya pays the £[£] difference', false, 'At collection, as a second payment at the till. Maya is told “You pay £[£] when you collect”.', 'cd')}`)}${note(`What’s expected from ${PROV} follows the order either way.`)}`
    : kind === 'more' ? `${msg('<strong>Certificate £[£ more] · quote £[£].</strong> £[£] more than the quote.', 'warn', true)}${group('What to do', `${radio('Keep the order as quoted', true, `Maya pays nothing at collection. ${PROV} is expected to pay the order’s total, £[£].`, 'cm')}${radio('Change the order to match', false, 'Add to the order so the total is the certificate amount. Maya is emailed “Certificate received” with the revised quote.', 'cm')}`)}${note(`What’s expected from ${PROV} follows the order either way.`)}`
    : kind === 'late' ? `${msg('<strong>Quote ran out on [date] — check the price.</strong> Certificate £[£] · quote £[£]. The amounts match.', 'warn', true)}${readyTick()}${note(`${BIKE} stays put aside until Maya collects it.`)}`
    : `${msg('<strong>Certificate £[£] · quote £[£].</strong> They match.', 'ok')}${readyTick()}${note(`${BIKE} stays put aside until Maya collects it. With the tick, the order moves to Ready to collect and Maya is sent one message, “Ready to collect”, which says the certificate arrived.`)}`}`, `${button('Cancel', { variant: 'ghost' })}${button(kind === 'less' ? 'Next: what to take off' : 'Save')}`, 560); };
// UX walk-through 5 H4: "Change the order to match" opens the order's lines
// with a tick beside each item to take off, and the new total against the
// certificate. The bike itself is changed from More, as before.
const matchLines = () => popup('ml-title', 'Change the order to match', `Maya Patel · certificate £[£ less] · quote £[£]`, `${group('Tick what to take off', `<div style="display: flex; justify-content: space-between; gap: 12px; min-height: 44px; align-items: center; font-size: 15px; border-bottom: 1px solid ${C.border}"><span>${BIKE} · ${SIZE_}</span>${mono('£[£]')}</div>${['[Accessory]', '[Accessory]'].map((a, i) => `<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid ${C.border}">${tick(a, i === 0)}<span style="padding-top: 2px">${mono('£[£]')}</span></div>`).join('')}`)}${note('To change the bike or size, use More on the order.')}<div>${kv('New total (includes VAT)', mono('£[£]'), true)}${kv('Certificate', mono('£[£ less]'))}</div>${msg('<strong>They match.</strong> The revised quote goes to Maya with the “Certificate received” email.', 'ok', true)}`, `${button('Back', { variant: 'ghost' })}${button('Save and email Maya')}`, 560);
const certReleased = () => popup('cr-title', 'The bike was released', `Maya Patel · certificate [certificate number] saved`, `${msg(`<strong>${BIKE} · ${SIZE_} was released on [date]</strong> and has since been sold.`, 'warn', true)}${group('What to do for Maya', `${radio(`Hold another ${BIKE} · ${SIZE_}`, true, '1 free at [Second site] — it’s moved to Bolton for Maya.', 'cr')}${radio('Order one from [supplier]', false, 'About [n] days.', 'cr')}`)}`, `${button('Decide later', { variant: 'ghost' })}${button('Save')}`, 560);
const applied = () => popup('ap-title', 'Maya has applied', `Quote ${QNUM} · ${PROV}`, `${field('Applied on', { value: '[date]' })}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Employer', { value: '[Employer]', hint: 'Optional' })}${field('Application reference', { value: '[reference]', hint: 'Optional — if Maya has one' })}</div>${msg('Your rule: order once the customer has applied. The order will show “Order from [supplier]” next.', 'grey')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 540);
const orderAnyway = () => popup('oa-title', 'Order now anyway?', 'Your rule: a £[£] deposit first', `<p style="margin: 0; font-size: 15px; line-height: 1.5">${BIKE} · ${SIZE_} from [supplier] for £[£] cost, before a deposit or certificate.</p>${textBox('oa-why', 'Why?', '[reason]')}${logged()}`, `${button('Cancel', { variant: 'ghost' })}${button('Order now')}`, 520);
// UX walk-through 5 M3: Maya hears either way, and a hold is never released
// silently.
const holdReminder = () => popup('hr-title', `Maya Patel’s hold ends on [date]`, `${BIKE} · ${SIZE_} · quoted [n] days ago, no certificate yet`, `${group('What to do with the hold', `${radio('Hold longer', true, 'Until [date] — another [n] days. Maya is sent “Your bike is put aside” again, with the new date.', 'hold')}${radio('Release the bike', false, 'It goes back on sale. The order stays open; if the certificate comes, Wheelhouse checks the bike’s still here. Maya is sent “Your bike is no longer put aside”.', 'hold')}`)}${note('If nobody chooses by [date], the bike stays held and the list and Today show “Hold ended [date] — choose”. It’s never released without someone choosing.')}${note('Maya has been sent “Your hold ends on [date]”. Any of these messages can be switched off in Settings › Messages.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 540);
// Audit H1: the checks are the lines of the shop's own note for this provider.
// UX walk-through 5 H1 (c2w side): "Hand over at the till" leads to the till
// boards drawn in till.mjs — till-c2w (the order's basket, frame picked),
// till-c2w-pay ("Cycle to Work · [Provider]" first), till-c2w-extra
// (something added at the counter, a second payment) and till-c2w-paid
// (receipt; order Collected). Without an order, the till's own way in is
// till-c2w-pick.
const handOver = () => popup('ho-title', 'Hand over to Maya Patel', `${BIKE} · ${SIZE_} · certificate [certificate number]`, `${group(`${PROV}’s checks, from your note in Settings`, `${tick('[Line 1 of the shop’s note for this provider]')}${tick('[Line 2 of the shop’s note for this provider]')}`)}${box(whoPays({ title: false }))}${note(`“Hand over at the till” opens the till with Maya’s order in the basket: the bike, with its held frame number, and the order’s accessories, marked “on the order”. “Cycle to Work · ${PROV}” is the first way to pay. Anything Maya adds at the counter goes on the same sale, for her to pay. The ticked checks go in the order’s history.`)}`, `${button('Cancel', { variant: 'ghost' })}${button('Hand over at the till')}`, 560);
// UX walk-through 5 H3: the payment goes to the accounts software with that
// day's figures.
const markPaid = (diff = false) => popup('mp-title', 'Mark paid', `[Customer] · ${PROV} · expected £[£] by [date]`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Amount received', { value: diff ? '£[£ less]' : '£[£]' })}${field('Received on', { value: '[date]' })}</div>${field('Provider’s reference', { value: '[reference]', hint: 'Optional — from the remittance' })}
${diff ? msg('<strong>£[£] less than expected.</strong> Save it as part paid and keep chasing the rest, or close it with a reason.', 'warn', true) : msg('Matches what was expected.', 'ok')}${logged()}${note(`The payment goes to your accounts software with that day’s figures, as “${PROV} paid £[£] · commission £[£]”.`)}`, `${button('Cancel', { variant: 'ghost' })}${diff ? `${button('Close with a reason…', { variant: 'default' })}${button('Save as part paid')}` : button('Mark paid')}`, 560);
// UX walk-through 5 M8: "Your order is cancelled" says what happens to any
// deposit; cancelling after ordering with a deposit follows the shop's rule.
// M6: it goes the way Maya chose.
const tellMaya = () => tick('Tell Maya the order is cancelled', true, '“Your order is cancelled”, sent the way she chose. It says what happens to any deposit.');
// UX walk-through 5 M4: deposit is false, 'kept' (or true) or 'refund' — a
// deposit paid and the bike ordered, refunded by the shop's rule for a
// customer who pulls out.
const cancelOrder = (ordered = false, deposit = false) => { const dep = deposit === true ? 'kept' : deposit; return popup('cx-title', 'Maya isn’t going ahead?', `Quote ${QNUM} · ${BIKE} · ${SIZE_}`, ordered
  ? `${msg(dep ? '<strong>The bike was ordered from [supplier]</strong> on [date], after Maya paid a £[£] deposit.' : '<strong>The bike was ordered from [supplier]</strong> on [date], and certificate [certificate number] was added.', 'grey')}${group('The bike', `${radio('Keep it as shop stock', true, 'It goes on sale at Bolton when it arrives.', 'cxb')}${radio('Send it back to [supplier]', false, 'Starts a return in Deliveries and orders.', 'cxb')}`)}${dep === 'kept' ? msg('<strong>Deposit £[£] · kept, as your quote said.</strong> Your rule: keep it when the bike was ordered in.', 'grey') : dep === 'refund' ? msg('<strong>Deposit:</strong> £[£] refunded, the way it was paid — your rule for a customer who pulls out.', 'grey') : ''}${msg(`<strong>Tell ${PROV}</strong> the order is cancelled — the way your note for them says.`, 'warn')}${tellMaya()}${textBox('cx-why', 'Why?', '[reason]')}${logged()}`
  : `${msg(`<strong>${BIKE} · ${SIZE_}</strong> goes back on sale at Bolton.`, 'grey')}${msg('<strong>Deposit:</strong> £[£] refunded, the way it was paid — your rule for a customer who pulls out.', 'grey')}${tellMaya()}${textBox('cx-why', 'Why?', '[reason]')}${logged()}`, `${button('Keep the order', { variant: 'ghost' })}${button('Cancel the order', { variant: 'danger' })}`, 560); };

// ---------- Money owed (decision 5; audit M6) ----------
// UX walk-through 5 L1: the back link follows where Jack came from.
// M7: each provider opens its bikes owed, with "Record a payment".
const owedPage = (from = 'list') => c2wPage(`${back(from === 'reports' ? 'Reports' : 'Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Owed by Cycle to Work providers')}${note('Bikes collected, not yet paid for · North Street Cycles, Bolton')}</div>${button(isPhone() ? 'Download' : 'Download as spreadsheet', { variant: 'default' })}</div>
${box(`<table style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; font-size: 13px; color: ${C.muted}"><th style="padding: 8px 0; font-weight: 600">Provider</th><th style="padding: 8px; font-weight: 600">Bikes</th><th style="padding: 8px; font-weight: 600; text-align: right">Owed</th><th style="padding: 8px 0; font-weight: 600; text-align: right">Late</th></tr></thead><tbody>${[['[Provider]', '[n]', '£[£]', badge('£[£] · [n] days', 'amber')], ['[Provider]', '[n]', '£[£]', '—'], ['[Provider]', '[n]', '£[£]', '—']].map(([p, n, o, l]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 10px 0"><a href="#" aria-label="${esc(p)}: bikes owed and Record a payment" style="${tall}; font-weight: 700; color: ${C.ink}">${p}</a></td><td style="padding: 10px 8px">${n}</td><td style="padding: 10px 8px; text-align: right">${mono(o)}</td><td style="padding: 10px 0; text-align: right">${l}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 10px 0; font-weight: 700">Total</td><td></td><td style="padding: 10px 8px; text-align: right; font-weight: 700">${mono('£[£]')}</td><td></td></tr></tbody></table>`)}${note('Open a provider to record a payment that covers several bikes.')}`);
const OWED_BIKES = [['Maya Patel', '[date]', '[certificate number]', '£[£] by [date]', ''], ['[Customer]', '[date]', '[certificate number]', '£[£] by [date]', badge('[n] days late', 'amber')], ['[Customer]', '[date]', '[certificate number]', '£[£] by [date]', '']];
const owedProvider = () => c2wPage(`${back('Owed by Cycle to Work providers')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2(`${PROV} · [n] bikes owed`)}${note('Commission [%] · pays in about [n] days · North Street Cycles, Bolton')}</div>${button('Record a payment')}</div>
${box(isPhone() ? `<div role="list">${OWED_BIKES.map(([c, d, cert, e, l]) => `<div role="listitem" style="display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid ${C.border}; font-size: 15px"><a href="#" style="${tall}; font-weight: 700; color: ${C.ink}">${c}</a><span style="font-size: 14px; color: ${C.muted}">Collected ${d} · certificate ${mono(cert)}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">Expected ${mono(e)} ${l}</span><span>${named(button('Mark paid', { variant: 'default' }), `Mark paid: ${c} · ${PROV}`)}</span></div>`).join('')}</div>`
  : `<table style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; font-size: 13px; color: ${C.muted}"><th style="padding: 8px 0; font-weight: 600">Customer</th><th style="padding: 8px; font-weight: 600">Collected</th><th style="padding: 8px; font-weight: 600">Certificate</th><th style="padding: 8px; font-weight: 600; text-align: right">Expected</th><th style="padding: 8px; font-weight: 600">Late</th><th style="padding: 8px 0"><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Action</span></th></tr></thead><tbody>${OWED_BIKES.map(([c, d, cert, e, l]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 0"><a href="#" style="${tall}; font-weight: 700; color: ${C.ink}">${c}</a></td><td style="padding: 8px">${d}</td><td style="padding: 8px">${mono(cert)}</td><td style="padding: 8px; text-align: right">${mono(e)}</td><td style="padding: 8px">${l || '—'}</td><td style="padding: 8px 0; text-align: right">${named(button('Mark paid', { variant: 'default' }), `Mark paid: ${c} · ${PROV}`)}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 10px 0; font-weight: 700">Total</td><td></td><td></td><td style="padding: 10px 8px; text-align: right; font-weight: 700">${mono('£[£]')}</td><td></td><td></td></tr></tbody></table>`)}
${note('“Record a payment” is for one payment that covers several bikes. “Mark paid” on a row is still there for one bike.')}`);
// UX walk-through 5 M7: one payment, ticked against the bikes it covers.
const recordPayment = (more = false) => popup('rp-title', 'Record a payment', `${PROV} · [n] bikes owed`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 12px">${field('Amount received', { value: more ? '£[£ more]' : '£[£]' })}${field('Received on', { value: '[date]' })}${field('Provider’s reference', { value: '[reference]', hint: 'Optional' })}</div>
${group('Which bikes it covers', OWED_BIKES.map(([c, d, cert, e]) => tick(c, true, `Certificate ${cert} · expected ${e}`)).join(''))}
<div>${kv('Expected for the ticked bikes', mono('£[£]'))}${kv('Received', mono(more ? '£[£ more]' : '£[£]'))}${kv('Difference', mono(more ? '+£[£]' : '£0.00'), true)}</div>
${more ? msg(`<strong>£[£] more than expected — check with ${PROV}.</strong> Saving marks each ticked bike paid, and the extra £[£] is noted on the payment.`, 'warn', true) : msg('<strong>Matches the [n] ticked bikes.</strong> Saving marks each one paid. If a payment is less, the bikes it doesn’t fully cover are saved as part paid.', 'ok', true)}${note('This goes in each ticked order’s history and the activity log.')}${note(`It goes to your accounts software with that day’s figures, as “${PROV} paid £[£] · commission £[£]”.`) /* UX walk-through 5 H3 */}`, `${button('Cancel', { variant: 'ghost' })}${button(more ? 'Save as paid' : 'Save')}`, 720);



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
// UX walk-through 5 L2: links that look like buttons, not <button>s — they
// go to another page, and in an email a button goes nowhere.
const linkBtn = (t, variant = 'accent') => button(t, { variant, href: '#' });
const mailFrame = (inner, label = 'Email to Maya Patel') => {
  const [W, H] = DIMS[SIZE];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${isPhone() ? 12 : 40}px; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; background: ${C.bg}"><article aria-label="${esc(label)}" style="width: ${isPhone() ? '100%' : '600px'}; box-sizing: border-box; padding: ${isPhone() ? 20 : 28}px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px; font-size: 15px; line-height: 1.55; color: ${C.ink}">${inner}<p style="margin: 0; font-size: 13px; color: ${C.muted}">North Street Cycles · [Shop address] · [shop phone]</p></article></div>`;
};
const attachment = (t) => `<span style="display: inline-flex; align-self: flex-start; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.bg}; font-size: 14px; font-weight: 600">Attached: ${t}</span>`;
// UX walk-through 5 L3: when the quote and the hold start together, this one
// email carries both. M3: it names both dates. M6: the quote stays an email.
const email = () => mailFrame(`<span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to maya@example.test</span><h1 style="margin: 0; font-size: 22px">Your Cycle to Work quote</h1><p style="margin: 0">Hi Maya, here’s your quote ${mono(QNUM)} for ${BIKE} · ${SIZE_}, for your Cycle to Work scheme through ${PROV}.</p><p style="margin: 0"><strong>We’re holding your bike until [date].</strong> This quote is valid until [date]. We’ll let you know as soon as your certificate reaches us.</p>${attachment(`Quote ${QNUM}`)}<p style="margin: 0"><strong>How to apply:</strong> [The shop’s own words, from Settings]</p>${linkBtn('See your order')}`);
// UX walk-through 5 H4: the revised quote goes with "Certificate received".
// It's an email because the quote stays one (M6).
const emailRevised = () => mailFrame(`<span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to maya@example.test</span><h1 style="margin: 0; font-size: 22px">Certificate received</h1><p style="margin: 0">Hi Maya, your certificate for £[£] has reached us.</p><p style="margin: 0">To match your certificate, we’ve taken [Accessory] off. Your revised quote is attached.</p>${attachment(`Revised quote ${QNUM}`)}${linkBtn('See your order')}`);
// UX walk-through 5 M6: Cycle to Work messages go the way the customer chose.
// Maya chose text, so these are texts; customers who chose email get the same
// words by email. Each board shows the versions of one message.
const textBubble = (t) => `<div style="align-self: flex-start; max-width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: ${C.mutedBg}; font-size: 15px; line-height: 1.5">${t}</div>`;
const textsBoard = (title, versions) => {
  const [W, H] = DIMS[SIZE];
  return `<div data-scroll style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${isPhone() ? 12 : 40}px; display: flex; justify-content: center; align-items: flex-start; overflow-y: auto; background: ${C.bg}"><section aria-labelledby="tx-title" style="width: ${isPhone() ? '100%' : '600px'}; box-sizing: border-box; padding: ${isPhone() ? 18 : 28}px; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to Maya Patel, ${mono('07700 900 142')} · by text, the way Maya chose</span><h1 id="tx-title" style="margin: 0; font-size: 22px">${title}</h1>${note('Customers who chose email get the same words by email, with a “See your order” link. Each message can be switched off in Settings › Messages.')}${versions.map(([when, t]) => `<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${C.border}"><h2 style="margin: 0; font-size: 14px; font-weight: 700; color: ${C.muted}">${when}</h2>${textBubble(t)}</div>`).join('')}</section></div>`;
};
const TEXTS = {
  // UX walk-through 5 M1, H4, H2.
  certificate: () => textsBoard('Certificate received, or Ready to collect', [
    ['The bike was ready when the certificate came — one message, “Ready to collect”', `Hi Maya, your Cycle to Work certificate has reached us and ${BIKE} · ${SIZE_} is ready to collect. Quote ${QNUM}. See your order: [link]`],
    ['The bike needs work first — “Certificate received”', `Hi Maya, your Cycle to Work certificate has reached us. We’re getting ${BIKE} ready and we’ll text you when you can collect it. See your order: [link]`],
    ['A certificate for less, order kept', 'Hi Maya, your certificate for £[£] has reached us. You pay £[£] when you collect. See your order: [link]'],
    ['A deposit to refund — your rule', 'Hi Maya, your Cycle to Work certificate has reached us. Your £[£] deposit is being refunded, the way you paid it. See your order: [link]'],
  ]),
  // UX walk-through 5 M3.
  hold: () => textsBoard('Your bike is put aside, or no longer put aside', [
    ['“Hold longer” — “Your bike is put aside”, with the new date', `Hi Maya, we’re now holding ${BIKE} · ${SIZE_} for you until [date]. Quote ${QNUM}. See your order: [link]`],
    ['“Release the bike” — “Your bike is no longer put aside”', `Hi Maya, ${BIKE} · ${SIZE_} is no longer put aside. We’ll still get you one when your certificate comes. See your order: [link]`],
  ]),
  // UX walk-through 5 M8.
  cancelled: () => textsBoard('Your order is cancelled', [
    ['A deposit kept — your rule when the bike was ordered in', `Hi Maya, your Cycle to Work order, quote ${QNUM}, is cancelled. Your £[£] deposit is kept, as your quote said, because the bike was ordered in for you. Questions? Call [shop phone].`],
    ['A deposit refunded', `Hi Maya, your Cycle to Work order, quote ${QNUM}, is cancelled. Your £[£] deposit is being refunded, the way you paid it. Questions? Call [shop phone].`],
    ['No deposit', `Hi Maya, your Cycle to Work order, quote ${QNUM}, is cancelled. Questions? Call [shop phone].`],
  ]),
};
// UX walk-through 5 M3 and M8: the customer view draws "no longer put
// aside" and "cancelled" too. state: 'held', 'released' or 'cancelled'.
const customerView = (state = 'held') => {
  const top = {
    held: msg(`<strong>Your bike is put aside until [date].</strong> We’ll let you know when your certificate reaches us.`, 'grey'),
    released: msg(`<strong>Your bike is no longer put aside.</strong> We’ll still get you one when your certificate comes.`, 'warn'),
    cancelled: msg(`<strong>This order is cancelled.</strong> Your £[£] deposit is kept, as your quote said.`, 'grey'),
  }[state];
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px"><div style="width: 100%; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${back('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your Cycle to Work bike</h1>${note(`Quote ${QNUM} · North Street Cycles, Bolton · ${PROV}`)}
${state === 'cancelled' ? '' : stages(1, STAGES.slice(0, 5))}
${box(`${top}${kv('Bike', `${BIKE} · ${SIZE_}`)}${kv('Accessories', '[Accessory] · [Accessory]')}${kv('Total (includes VAT)', mono('£[£]'))}<div style="display: flex; flex-wrap: wrap; gap: 10px">${linkBtn('See your quote', 'default')}${button('Ask the shop a question', { variant: 'default' })}</div>`)}
${state === 'cancelled' ? '' : box(`${h3('How to apply')}<p style="margin: 0; font-size: 15px; line-height: 1.5">[The shop’s own words, from Settings]</p>`)}</div></div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};
const messages = () => settingsPage('messages', 'Messages', MSG_INTRO, msgFolds({ list: msgListOpen({ bringBack: false }) }), { who: OWNER });
const scrolledMsgs = (px) => messages().replace(/<div data-scroll style="([^"]*)overflow-y: auto;/, `<div data-scroll class="cw-sc" style="$1overflow-y: hidden;`).replace('<div data-scroll class="cw-sc"', `<style>.cw-sc > * { position: relative; top: -${px}px }</style><div data-scroll class="cw-sc"`);
// Audit L5: Jack is the Owner on every board, Who's in too.
const todayBoard = (held = false) => {
  const html = today({ c2w: held ? 'held' : true, as: OWNER }).replace('Checked in at [time] · Manager', 'Checked in at [time] · Owner');
  return held ? withToast(html, toast('Maya Patel’s bike is held until [date]. She’s sent “Your bike is put aside”.', 'Undo') /* UX walk-through 5 M3 */) : html;
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
staff('cw-applied', () => overlay(orderPage({ next: 'toApply', order: true, hist: ['quoteApplied', 'toOrder'] }), applied()));
staff('cw-order-applied', () => orderPage({ next: 'applied', order: true, hist: ['quoteApplied', 'toOrder', 'applied'] }));
staff('cw-ordered', () => withToast(listPage(), toast('Ordered [Customer]’s bike from [supplier].', 'Undo')));
staff('cw-order-deposit', () => orderPage({ next: 'deposit', order: true, hist: ['quoteDeposit', 'toOrderDep'] }));
owner('cw-order-anyway', () => overlay(orderPage({ next: 'deposit', order: true, hist: ['quoteDeposit', 'toOrderDep'] }), orderAnyway()));
staff('cw-order-deposit-paid', () => orderPage({ next: 'depositPaid', order: true, deposit: 'refund', hist: ['quoteDeposit', 'toOrderDep', 'deposit', 'ordered'] }));
// UX walk-through 5 H2 (option 1): the other rule, and the refund as the next step.
staff('cw-order-deposit-counted', () => orderPage({ next: 'depositCounted', order: true, deposit: 'count', hist: ['quoteDeposit', 'toOrderDep', 'deposit', 'ordered'] }));
staff('cw-order-deposit-refund', () => orderPage({ stage: 2, next: 'depositRefund', order: true, deposit: 'refund', hist: ['quoteDeposit', 'toOrderDep', 'deposit', 'ordered', 'cert', 'certMailDep'] }));
staff('cw-list-deposit-refund', () => listPage({ refund: true }));
staff('cw-certificate', () => overlay(orderPage({ hist: upTo('longerMail') }), certificate()));
staff('cw-certificate-diff', () => overlay(orderPage({ hist: upTo('longerMail') }), certificate('less')));
// UX walk-through 5 H4, M3, M1.
staff('cw-certificate-match', () => overlay(orderPage({ hist: upTo('longerMail') }), matchLines()));
staff('cw-certificate-more', () => overlay(orderPage({ hist: upTo('longerMail') }), certificate('more')));
staff('cw-certificate-late', () => overlay(orderPage({ hist: upTo('longerMail') }), certificate('late')));
staff('cw-order-get-ready', () => orderPage({ stage: 2, next: 'getReady', hist: [...upTo('longerMail'), 'cert', 'certMail'] }));
staff('cw-marked-ready', () => withToast(orderPage({ stage: 3, next: 'ready', hist: [...upTo('longerMail'), 'cert', 'certMail', 'ready', 'readyOnly'] }), toast('Marked ready to collect. Maya is sent “Ready to collect”.', 'Undo')));
staff('cw-list-hold-ended', () => listPage({ holdEnded: true }));
staff('cw-certificate-released', () => overlay(orderPage(), certReleased()));
staff('cw-order-on-order', () => orderPage({ stage: 2, next: 'onOrder', order: true, hist: ['quoteApplied', 'toOrder', 'applied', 'ordered', 'cert', 'certMail'] }));
staff('cw-order-ready', () => orderPage({ stage: 3, next: 'ready', hist: upTo('readyMail') }));
staff('cw-hand-over', () => overlay(orderPage({ stage: 3, next: 'ready', hist: upTo('readyMail') }), handOver()));
owner('cw-order-owed', () => orderPage({ stage: 4, next: 'owed', hist: upTo('handed'), expected: true }));
owner('cw-mark-paid', () => overlay(listPage(), markPaid()));
owner('cw-mark-paid-diff', () => overlay(listPage(), markPaid(true)));
owner('cw-order-part-paid', () => orderPage({ stage: 4, next: 'part', hist: [...upTo('handed'), 'part'], expected: true }));
owner('cw-order-paid', () => orderPage({ stage: 6, next: 'paid', hist: upTo('paid'), expected: true }));
owner('cw-owed', () => owedPage());
// UX walk-through 5 L1, M7.
owner('cw-owed-reports', () => owedPage('reports'));
owner('cw-owed-provider', () => owedProvider());
owner('cw-record-payment', () => overlay(owedProvider(), recordPayment()));
owner('cw-record-payment-more', () => overlay(owedProvider(), recordPayment(true)));
owner('cw-more', () => orderPage({ menu: moreMenu() }));
owner('cw-quote-revised', () => quoteDoc({ revised: true }));
// UX walk-through 5 M4: a state that can happen — deposit paid, bike ordered,
// the deposit refunded by the shop's rule for a customer who pulls out.
owner('cw-cancel', () => overlay(orderPage({ next: 'depositPaid', order: true, deposit: 'refund', hist: ['quoteDeposit', 'toOrderDep', 'deposit', 'ordered'] }), cancelOrder(true, 'refund')));
owner('cw-cancel-ordered', () => overlay(orderPage({ stage: 2, next: 'onOrder', order: true, hist: ['quoteApplied', 'toOrder', 'applied', 'ordered', 'cert', 'certMail'] }), cancelOrder(true)));
// UX walk-through 5 M8: cancelled after ordering, with a deposit the rule keeps.
owner('cw-cancel-ordered-deposit', () => overlay(orderPage({ next: 'depositPaid', order: true, deposit: 'refund', hist: ['quoteDeposit', 'toOrderDep', 'deposit', 'ordered'] }), cancelOrder(true, true)));
owner('cw-today', () => todayBoard());
owner('cw-today-held', () => todayBoard(true));
// UX walk-through 5 M3, H2: a hold nobody chose for, and a deposit to refund.
owner('cw-today-choose', () => today({ c2wHoldEnded: true, c2wDeposit: true, as: OWNER }).replace('Checked in at [time] · Manager', 'Checked in at [time] · Owner'));
owner('cw-settings', () => c2wSettings({ hold: holdOpen(), order: orderOpen() }));
owner('cw-settings-deposit', () => c2wSettings({ deposit: depositOpen(), apply: applyOpen() }));
owner('cw-settings-provider', () => overlay(c2wSettings({ providers: providersOpen() }), providerEdit()));
// UX walk-through 5 M6, M3, M8: Messages gained two Cycle to Work rows; the
// scroll still lands on the Cycle to Work heading.
owner('cw-messages', () => scrolledMsgs(isPhone() ? 1660 : 1032));
def('cw-email', () => email());
def('cw-customer-view', () => customerView());
// UX walk-through 5 H4, M1, H2, M3, M6, M8: what Maya is sent, and her view.
def('cw-email-certificate-revised', () => emailRevised());
def('cw-texts-certificate', () => TEXTS.certificate());
def('cw-texts-hold', () => TEXTS.hold());
def('cw-texts-cancelled', () => TEXTS.cancelled());
def('cw-customer-released', () => customerView('released'));
def('cw-customer-cancelled', () => customerView('cancelled'));

const SIZES = ['desktop', 'tablet', 'phone'];
const NO_SIDEBAR = new Set(['cw-email', 'cw-customer-view', 'cw-email-certificate-revised', 'cw-texts-certificate', 'cw-texts-hold', 'cw-texts-cancelled', 'cw-customer-released', 'cw-customer-cancelled']);
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
  'cw-order-deposit-counted': 'Deposit paid, counted toward the price',
  'cw-order-deposit-refund': 'Certificate in: refund the deposit next',
  'cw-list-deposit-refund': 'The list: a deposit to refund',
  'cw-certificate': 'Add the certificate',
  'cw-certificate-diff': 'A certificate for less than the quote',
  'cw-certificate-match': 'Change the order to match: tick what comes off',
  'cw-certificate-more': 'A certificate for more than the quote',
  'cw-certificate-late': 'A certificate after the quote ran out',
  'cw-order-get-ready': 'Certificate in, the bike needs work: get it ready',
  'cw-marked-ready': 'Marked ready to collect, with Undo',
  'cw-list-hold-ended': 'The list: a hold ended, nobody chose',
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
  'cw-owed-reports': 'Owed by providers, opened from Reports',
  'cw-owed-provider': 'One provider’s bikes owed',
  'cw-record-payment': 'Record a payment for several bikes',
  'cw-record-payment-more': 'A payment for more than expected',
  'cw-more': 'More: change or cancel the order',
  'cw-quote-revised': 'A revised quote, not sent until Email',
  'cw-cancel': 'The customer isn’t going ahead: a deposit to refund',
  'cw-cancel-ordered': 'Cancelling after the bike was ordered',
  'cw-cancel-ordered-deposit': 'Cancelling after ordering: the deposit kept',
  'cw-today': 'Today: no certificate yet, a payment late',
  'cw-today-held': 'Today: Hold longer, done in one press',
  'cw-today-choose': 'Today: a hold ended with no choice, a deposit to refund',
  'cw-settings': 'Settings › Front desk › Cycle to Work: holding and ordering',
  'cw-settings-deposit': 'Deposits, and how to apply',
  'cw-settings-provider': 'A provider: commission, payment days, hand-over checks',
  'cw-messages': 'Settings › Messages: the Cycle to Work messages',
  'cw-email': 'The quote email: the bike put aside, both dates',
  'cw-customer-view': 'The customer’s account: their Cycle to Work bike',
  'cw-customer-released': 'The customer’s view: no longer put aside',
  'cw-customer-cancelled': 'The customer’s view: the order cancelled',
  'cw-email-certificate-revised': '“Certificate received” email, with the revised quote',
  'cw-texts-certificate': '“Certificate received” and “Ready to collect” texts',
  'cw-texts-hold': '“Put aside” again, or “no longer put aside” texts',
  'cw-texts-cancelled': '“Your order is cancelled” texts',
};
export const ROWS = [
  { label: 'The list and a new order', screens: ['cw-list', 'cw-list-owner', 'cw-first-use', 'cw-new', 'cw-new-not-in-stock', 'cw-quote', 'cw-quote-deposit', 'cw-order-held'] },
  { label: 'Waiting for the certificate', screens: ['cw-hold-ending', 'cw-applied', 'cw-order-applied', 'cw-ordered', 'cw-order-deposit', 'cw-order-anyway', 'cw-order-deposit-paid', 'cw-order-deposit-counted', 'cw-list-hold-ended', 'cw-certificate', 'cw-certificate-diff', 'cw-certificate-match', 'cw-certificate-more', 'cw-certificate-late', 'cw-certificate-released'] },
  { label: 'Collection and payment', screens: ['cw-order-on-order', 'cw-order-deposit-refund', 'cw-list-deposit-refund', 'cw-order-get-ready', 'cw-marked-ready', 'cw-order-ready', 'cw-hand-over', 'cw-order-owed', 'cw-mark-paid', 'cw-mark-paid-diff', 'cw-order-part-paid', 'cw-order-paid', 'cw-owed', 'cw-owed-reports', 'cw-owed-provider', 'cw-record-payment', 'cw-record-payment-more'] },
  { label: 'Changes and cancelling', screens: ['cw-more', 'cw-quote-revised', 'cw-cancel', 'cw-cancel-ordered', 'cw-cancel-ordered-deposit'] },
  { label: 'Today, the customer, settings and messages', screens: ['cw-today', 'cw-today-held', 'cw-today-choose', 'cw-customer-view', 'cw-customer-released', 'cw-customer-cancelled', 'cw-email', 'cw-email-certificate-revised', 'cw-texts-certificate', 'cw-texts-hold', 'cw-texts-cancelled', 'cw-settings', 'cw-settings-deposit', 'cw-settings-provider', 'cw-messages'] },
];
