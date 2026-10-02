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
// step.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner), Jo Taylor (Staff), Maya Patel (customer, 07700 900 142,
// maya@example.test). Scheme providers, bikes, sizes, prices, dates and
// reference numbers are bracketed placeholders; no provider's name or process
// is drawn as fact.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, c2wFolds, C2W_INTRO, msgFolds, MSG_INTRO, rowSwitch } from './settings-frame.mjs';
import { today } from './opening.mjs';
import { msgListOpen } from './setup.mjs';

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
const BIKE = '[Bike]', SIZE_ = '[Size]', PROV = '[Provider]', QUOTE = 'Quote [quote number]';

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: ${isPhone() ? 22 : 26}px; font-weight: 700">${t}</h2>`;
const h3 = (t, id = '') => `<h3${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 17px; font-weight: 700">${t}</h3>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 14 : 18}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'bike', 18)}<span>${t}</span></p>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right">${v}</span></div>`;
const toast = (t, action = '') => `<div role="status" style="position: absolute; ${isPhone() ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%); white-space: nowrap'}; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="flex-grow: 1; padding: 8px 0">${t}</span>${action ? `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">${action}</button>` : ''}</div>`;
const withToast = (html, t) => html.replace('<main style="', '<main style="position: relative; ').replace('</main>', `${t}</main>`);
const radio = (name, on, sub, group) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span>` : ''}</span></label>`;

// ---------- The page: Front desk › Cycle to Work (decision 2) ----------
// The sidebar item carries a count when something needs doing.
const countIn = (html, count = '4') => html.replace(/(>Cycle to Work<\/span>)(<\/a>)/, `$1<span style="margin-left: auto; padding: 0 7px; border-radius: 999px; background: ${C.highlight}; color: ${C.ink}; font-size: 12px; font-weight: 700">${count}${sr(' need doing')}</span>$2`);
const c2wPage = (content, who = STAFF, count = '4') => countIn(page('c2w', 'Cycle to Work', `<div data-scroll style="position: relative; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${content}</div>`, who), count);

// ---------- The list, grouped by stage (decision 1) ----------
const cols = () => (isPhone() ? '1fr' : '200px minmax(0, 1fr) 210px 170px');
const orderRow = ({ who, quote = QUOTE, bike = `${BIKE} · ${SIZE_}`, prov = PROV, status, action }) => `<div role="listitem" style="display: grid; grid-template-columns: ${cols()}; gap: ${isPhone() ? 6 : 16}px; align-items: center; padding: 12px 0; border-top: 1px solid ${C.border}"><a href="#" style="display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; color: ${C.ink}; text-decoration: none"><span style="font-size: 15px; font-weight: 700">${who}</span><span style="font-size: 13px; color: ${C.muted}">${quote}</span></a><span style="display: flex; flex-direction: column; gap: 3px; font-size: 14px"><span>${bike}</span><span style="color: ${C.muted}">${prov}</span></span><span style="font-size: 14px">${status}</span><span style="justify-self: ${isPhone() ? 'start' : 'end'}">${action}</span></div>`;
const group = (title, count, rows, sub = '') => box(`${h3(`${title} · ${count}`)}${sub ? note(sub) : ''}<div role="list">${rows.join('')}</div>`);
const listPage = ({ toastHtml = '' } = {}) => {
  const html = c2wPage(`${note('Thursday 17 September · North Street Cycles, Bolton')}
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px">${note('Every bike sold through a Cycle to Work scheme, from the quote to the provider’s payment.')}${button('+ New Cycle to Work order')}</div>
${group('Waiting for the certificate', 3, [
    orderRow({ who: 'Maya Patel', status: `Held until [date]${'<br>'}${badge('Hold ends in 2 days', 'amber')}`, action: link('Open', 'Open Maya Patel’s order') }),
    orderRow({ who: '[Customer]', status: 'Held until [date]', action: link('Open', 'Open [Customer]’s order') }),
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · not in stock`, status: `Applied [date]${'<br>'}${badge('Ready to order', 'blue')}`, action: button('Order from [supplier]', { variant: 'default' }) }),
  ], 'Bikes in stock are held for the customer. Ones to order follow your rule in Settings.')}
${group('Certificate received', 1, [
    orderRow({ who: '[Customer]', bike: `${BIKE} · ${SIZE_} · on order`, status: 'Due from [supplier] [date]', action: link('Open', 'Open [Customer]’s order') }),
  ])}
${group('Ready to collect', 1, [
    orderRow({ who: '[Customer]', status: 'Certificate [certificate number] · put aside', action: button('Hand over', { variant: 'default' }) }),
  ])}
${group('Collected · waiting for payment', 2, [
    orderRow({ who: '[Customer]', status: `Expected £[£] by [date]`, action: button('Mark paid', { variant: 'default' }) }),
    orderRow({ who: '[Customer]', status: `${badge('[n] days late', 'amber')} £[£] was due [date]`, action: button('Mark paid', { variant: 'default' }) }),
  ])}
${group('Paid · last 30 days', '[n]', [orderRow({ who: '[Customer]', status: 'Paid £[£] on [date]', action: link('Open', 'Open [Customer]’s paid order') })])}`);
  return toastHtml ? withToast(html, toastHtml) : html;
};

// ---------- One order (decisions 1, 3, 4, 5) ----------
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider'];
const stages = (at) => `<ol aria-label="Stages" style="margin: 0; padding: 0; display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 6}, minmax(0, 1fr)); gap: 6px">${STAGES.map((s, i) => { const done = i < at, now = i === at; return `<li${now ? ' aria-current="step"' : ''} style="list-style: none; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; border: ${now ? 2 : 1}px solid ${now ? C.ink : C.border}; background: ${done ? C.mutedBg : C.panel}; font-size: 13px"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${done || now ? C.ink : C.muted}">${done ? icon('check', 14) : `<span style="width: 14px; text-align: center">${i + 1}</span>`}${s}</span><span style="color: ${C.muted}">${done ? '[date] · [name]' : now ? 'Now' : ''}</span></li>`; }).join('')}</ol>`;
const historyBox = (lines) => box(`${h3('What’s happened')}<ul style="margin: 0; padding: 0">${lines.map(([w, t]) => `<li style="list-style: none; display: flex; gap: 12px; padding: 7px 0; border-top: 1px solid ${C.border}; font-size: 14px">${mono('[date]', `flex-shrink: 0; color: ${C.muted}`)}<span><strong>${w}</strong> ${t}</span></li>`).join('')}</ul>`);
const HIST = {
  quoted: [['Jo Taylor', 'gave the quote, and emailed it to Maya'], ['Jo Taylor', `held ${BIKE} · ${SIZE_} until [date]`]],
  cert: [['Jo Taylor', 'gave the quote, and emailed it to Maya'], ['Jo Taylor', `held ${BIKE} · ${SIZE_} until [date]`], ['Jack Lewis', 'added certificate [certificate number] · £[£]'], ['Wheelhouse', 'emailed Maya: “Certificate received”']],
  collected: [['Jo Taylor', 'gave the quote, and emailed it to Maya'], ['Jack Lewis', 'added certificate [certificate number] · £[£]'], ['Jo Taylor', 'handed over the bike and took payment: Cycle to Work · [Provider]'], ['Jo Taylor', 'confirmed the collection with [Provider]']],
  paid: [['Jo Taylor', 'handed over the bike and took payment: Cycle to Work · [Provider]'], ['Jack Lewis', 'marked paid: £[£] received [date]']],
};
const details = (stage, { order = false, deposit = false } = {}) => box(`${h3('The order')}${kv('Bike', `${BIKE} · ${SIZE_}${order ? ' · not in stock' : ''}`)}${kv('Accessories', '[Accessory] · [Accessory]')}${kv('Total (includes VAT)', mono('£[£]'))}${kv('Provider', `${PROV} · commission [%]`)}${kv('Expected from the provider', stage >= 4 ? mono('£[£] by [date]') : `${mono('£[£]')} after collection`)}${deposit ? kv('Deposit', mono('£[£] · refunded when the certificate arrives')) : ''}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Email the quote again', { variant: 'ghost' })}${button('Print the quote', { variant: 'ghost' })}</div>`);
const customerBox = () => box(`${h3('Customer')}<a href="#" style="${tall}; font-size: 15px; font-weight: 700; color: ${C.ink}">Maya Patel</a><span style="font-size: 14px">${mono('07700 900 142')} · maya@example.test</span>${kv('Employer', '[Employer]')}${kv('Application reference', '[reference]')}`);
// What to do next, at each stage.
const NEXT = {
  held: () => box(`${h3('Next: the certificate')}${msg(`<strong>${BIKE} · ${SIZE_} is held until [date].</strong> Hold ends in 2 days — we’ll remind you the day before.`, 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add the certificate')}${button('Hold longer', { variant: 'default' })}${button('Release the bike', { variant: 'ghost' })}</div>`),
  applied: () => box(`${h3('Next: order the bike')}${msg('<strong>Maya has applied</strong> (reference [reference]). Your rule: order once the customer has applied.', 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Order from [supplier]')}${button('Add the certificate', { variant: 'default' })}</div>${note('Ordering creates the supplier order in Deliveries and orders.')}`),
  deposit: () => box(`${h3('Next: a deposit, then order')}${msg('<strong>Waiting for a £[£] deposit before ordering.</strong> Your rule: order straight away with a deposit, until the certificate arrives.', 'warn')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Take the deposit at the till')}${button('Order now anyway…', { variant: 'ghost' })}</div>${note('The deposit is refunded when the certificate arrives.')}`),
  ready: () => box(`${h3('Next: hand over')}${msg(`<strong>Ready to collect.</strong> Certificate [certificate number] · £[£] · ${BIKE} put aside.`, 'ok')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Hand over')}</div>${note(`${PROV} asks: [how they want the handover confirmed].`)}`),
  owed: () => box(`${h3('Next: the provider’s payment')}${msg('<strong>Expected £[£] from [Provider] by [date]</strong> — £[£] less [%] commission.', 'grey')}<div>${button('Mark paid')}</div>${note('If it hasn’t arrived [n] days after that, it shows on Today.')}`),
  paid: () => box(`${h3('Paid')}${msg('<strong>£[£] received from [Provider] on [date]</strong>, as expected.', 'ok')}`),
};
const orderPage = ({ stage = 1, next = 'held', hist = 'quoted', order = false, deposit = false, toastHtml = '' } = {}) => {
  const left = `${NEXT[next]()}${historyBox(HIST[hist])}`;
  const right = `${details(stage, { order, deposit })}${customerBox()}`;
  const html = c2wPage(`${back('Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Maya Patel · Cycle to Work')}${note(`${QUOTE} · North Street Cycles, Bolton`)}</div>${button('More…', { variant: 'ghost' }).replace('<button', '<button aria-haspopup="menu" aria-label="More for this order: change, cancel"')}</div>
${stages(stage)}
${isPhone() ? `${left}${right}` : `<div style="display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${right}</div></div>`}`);
  return toastHtml ? withToast(html, toastHtml) : html;
};

// ---------- Starting one (decisions 1, 3, 4, 6) ----------
const select = (label, value, sub = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label style="font-size: 14px; font-weight: 600">${label}</label><button type="button" aria-haspopup="listbox" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</div>`;
const newOrder = (inStock = true) => popup('no-title', 'New Cycle to Work order', 'North Street Cycles, Bolton', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${select('Customer', 'Maya Patel · 07700 900 142')}${select('Scheme provider', PROV, 'Commission [%] · pays in about [n] days')}</div>
${select('Bike', `${BIKE} · ${SIZE_}`, inStock ? '1 in stock at Bolton' : 'Not in stock at Bolton or [Second site] · from [supplier], about [n] days')}
${select('Accessories', '[Accessory] · [Accessory]', 'Optional — if the scheme allows them')}
${inStock ? `<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox" checked style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Hold the bike until [date]</span><span style="font-size: 13px; color: ${C.muted}">[n] days, from Settings. Untick for an easy-to-replace bike.</span></span></label>`
    : msg('<strong>Not in stock.</strong> Your rule: order once the customer has applied. The order will show “Ready to order” when they have.', 'grey')}
${kv('Total (includes VAT)', mono('£[£]'))}`, `${button('Cancel', { variant: 'ghost' })}${button('Make the quote')}`, 620);
// The quote, to print or email (decision 6).
const quoteDoc = () => {
  const [W, H] = DIMS[SIZE];
  const P = isPhone();
  const doc = `<article aria-label="Cycle to Work quote" style="width: ${P ? 'auto' : '620px'}; box-sizing: border-box; padding: ${P ? 18 : 36}px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 6px; box-shadow: 0 8px 24px rgba(38,36,32,0.12); display: flex; flex-direction: column; gap: 14px; font-size: 14px; color: ${C.ink}">
<div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start"><div style="display: flex; flex-direction: column; gap: 3px"><span title="No official logo file exists yet" aria-label="Shop logo goes here" style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; border: 1px dashed ${C.input}; color: ${C.muted}; font-size: 10px; font-weight: 700">LOGO</span><strong style="font-size: 16px">North Street Cycles</strong><span>[Shop address] · [shop phone]</span><span>VAT [VAT number]</span></div><div style="text-align: right; display: flex; flex-direction: column; gap: 3px"><strong style="font-size: 18px">Cycle to Work quote</strong><span>${mono('[quote number]')}</span><span>Given [date]</span><span><strong>Valid until [date]</strong></span></div></div>
<div style="padding: 10px 12px; border-radius: 6px; background: ${C.bg}">For <strong>Maya Patel</strong>, to apply through <strong>${PROV}</strong></div>
<table style="width: 100%; border-collapse: collapse"><thead><tr style="text-align: left; font-size: 12px; color: ${C.muted}"><th style="padding: 6px 0">Item</th><th style="padding: 6px 0; text-align: right">Price</th></tr></thead><tbody>${[[`${BIKE} · ${SIZE_}`, '£[£]'], ['[Accessory]', '£[£]'], ['[Accessory]', '£[£]']].map(([a, b]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 0">${a}</td><td style="padding: 8px 0; text-align: right">${mono(b)}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 8px 0; font-weight: 700">Total (includes VAT at [rate])</td><td style="padding: 8px 0; text-align: right; font-weight: 700">${mono('£[£]')}</td></tr></tbody></table>
<p style="margin: 0; color: ${C.muted}; line-height: 1.5">Use this quote number when you apply. We hold your bike until [date]; once your certificate arrives, it’s yours to collect.</p></article>`;
  return c2wPage(`${back('Maya Patel · Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${h2('The quote')}<span style="display: flex; gap: 10px">${button('Print', { variant: 'default' })}${button('Email to Maya')}</span></div><div style="display: flex; justify-content: center; padding: 6px 0 20px">${doc}</div>`);
};

// ---------- Pop-ups along the way (decisions 3, 4, 5) ----------
const certificate = (diff = false) => popup('ce-title', 'Add the certificate', `Maya Patel · ${PROV}`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Certificate number', { value: '[certificate number]' })}${field('Amount on the certificate', { value: diff ? '£[£ less]' : '£[£]' })}</div>${field('Received', { value: '[date]' })}
${diff ? msg('<strong>£[£] less than the quote.</strong> Check it with [Provider], or change the order to match — Maya pays nothing at the till for Cycle to Work, so a difference has to be agreed first.', 'warn', true) : msg(`Matches the quote. ${BIKE} stays put aside until Maya collects it, and Maya is emailed “Certificate received”.`, 'ok')}`, `${button('Cancel', { variant: 'ghost' })}${button(diff ? 'Save and change the order' : 'Save')}`, 560);
const orderAnyway = () => popup('oa-title', 'Order now anyway?', 'Your rule: a £[£] deposit first', `<p style="margin: 0; font-size: 15px; line-height: 1.5">${BIKE} · ${SIZE_} from [supplier] for £[£] cost, before a deposit or certificate.</p><div style="display: flex; flex-direction: column; gap: 6px"><label for="oa-why" style="font-size: 14px; font-weight: 600">Why?</label><textarea id="oa-why" rows="2" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">[reason]</textarea></div>${note('This goes in the order’s history and the activity log.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Order now')}`, 520);
const holdReminder = () => popup('hr-title', `Maya Patel’s hold ends on [date]`, `${BIKE} · ${SIZE_} · quoted [n] days ago, no certificate yet`, `${radio('Hold longer', true, 'Until [date] — another [n] days.', 'hold')}${radio('Release the bike', false, 'It goes back on sale. The order stays open; if the certificate comes, Wheelhouse checks the bike’s still here.', 'hold')}${note('Maya is emailed “Your hold ends soon” — switch that off in Settings › Messages.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 540);
const handOver = () => popup('ho-title', 'Hand over to Maya Patel', `${BIKE} · ${SIZE_} · certificate [certificate number]`, `<div style="display: flex; flex-direction: column; gap: 8px">${[[`Maya has signed ${PROV}’s collection form`, true], [`Collection confirmed with ${PROV}: [how they want it confirmed]`, false]].map(([t, on]) => `<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="font-size: 15px">${t}</span></label>`).join('')}</div>${box(`${kv('At the till', `Cycle to Work · ${PROV}`)}${kv('Amount', mono('£[£]'))}${kv('Maya pays', mono('£0.00'))}`)}${note('“Hand over” opens the till with this sale ready. The provider’s £[£] is then owed to the shop.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Hand over at the till')}`, 560);
const markPaid = (diff = false) => popup('mp-title', 'Mark paid', `[Customer] · ${PROV} · expected £[£] by [date]`, `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Amount received', { value: diff ? '£[£ less]' : '£[£]' })}${field('Received on', { value: '[date]' })}</div>${field('Provider’s reference', { value: '[reference]', hint: 'Optional — from the remittance' })}
${diff ? msg('<strong>£[£] less than expected.</strong> Save it as part paid and keep chasing the rest, or close it with a reason.', 'warn', true) : msg('Matches what was expected.', 'ok')}`, `${button('Cancel', { variant: 'ghost' })}${diff ? `${button('Close with a reason', { variant: 'ghost' })}${button('Save as part paid')}` : button('Mark paid')}`, 560);
const cancelOrder = () => popup('cx-title', 'Maya isn’t going ahead?', `${QUOTE} · ${BIKE} · ${SIZE_}`, `${msg(`<strong>${BIKE} · ${SIZE_}</strong> goes back on sale at Bolton.`, 'grey')}${msg('<strong>Deposit:</strong> £[£] refunded, the way it was paid — your rule for a customer who pulls out.', 'grey')}<div style="display: flex; flex-direction: column; gap: 6px"><label for="cx-why" style="font-size: 14px; font-weight: 600">Why?</label><input id="cx-why" value="[reason, e.g. employer’s scheme closed]" style="min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>`, `${button('Keep the order', { variant: 'ghost' })}${button('Cancel the order', { variant: 'danger' })}`, 540);

// ---------- Money owed (decision 5) ----------
const owedPage = () => c2wPage(`${back('Cycle to Work')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Owed by Cycle to Work providers')}${note('Bikes collected, not yet paid for · North Street Cycles, Bolton')}</div>${button(isPhone() ? 'Download' : 'Download as spreadsheet', { variant: 'default' })}</div>
${box(`<table style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; font-size: 13px; color: ${C.muted}"><th style="padding: 8px 0; font-weight: 600">Provider</th><th style="padding: 8px; font-weight: 600">Bikes</th><th style="padding: 8px; font-weight: 600; text-align: right">Owed</th><th style="padding: 8px 0; font-weight: 600; text-align: right">Late</th></tr></thead><tbody>${[['[Provider]', '[n]', '£[£]', badge('£[£] · [n] days', 'amber')], ['[Provider]', '[n]', '£[£]', '—'], ['[Provider]', '[n]', '£[£]', '—']].map(([p, n, o, l]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 10px 0"><a href="#" style="${tall}; font-weight: 700; color: ${C.ink}">${p}</a></td><td style="padding: 10px 8px">${n}</td><td style="padding: 10px 8px; text-align: right">${mono(o)}</td><td style="padding: 10px 0; text-align: right">${l}</td></tr>`).join('')}<tr style="border-top: 2px solid ${C.ink}"><td style="padding: 10px 0; font-weight: 700">Total</td><td></td><td style="padding: 10px 8px; text-align: right; font-weight: 700">${mono('£[£]')}</td><td></td></tr></tbody></table>`)}`, OWNER);

// ---------- Settings › Front desk › Cycle to Work (decisions 3, 4, 5) ----------
const numRow = (label, value, unit) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 52px"><label style="flex: 1 1 260px; font-size: 15px; font-weight: 600">${label}</label><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px"><input aria-label="${esc(label)}" value="${value}" style="width: 70px; min-height: 44px; box-sizing: border-box; text-align: center; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}">${unit}</span></div>`;
const holdOpen = () => `${numRow('Hold a bike in stock from the quote for', '[n]', 'days')}${numRow('Remind staff before the hold ends', '[n]', 'days before')}${note('The certificate makes the hold firm until the bike is collected.')}`;
const orderOpen = () => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">Order a bike that isn’t in stock</legend>${radio('Once the certificate arrives', true, 'Safest. The customer waits a little longer.', 'rule')}${radio('Once the customer has applied', false, 'Staff tick “Applied”, or note the application reference.', 'rule')}${radio('Straight away, with a deposit', false, 'Until the certificate arrives.', 'rule')}</fieldset>${numRow('Deposit', '£[£]', 'or [%] of the price')}${note('Staff can still “Order now anyway” on one order, with a reason that goes in the activity log.')}`;
const depositOpen = () => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">When the certificate arrives</legend>${radio('Refund the deposit', true, 'The way it was paid.', 'dep')}${radio('Count it toward the price', false, 'The certificate covers the rest.', 'dep')}</fieldset><fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">If the customer pulls out</legend>${radio('Refund it', true, '', 'out')}${radio('Keep it when the bike was ordered in', false, 'Say so on the quote.', 'out')}</fieldset>`;
const provRow = (n) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 56px; padding: 6px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 240px"><span style="font-size: 15px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">Commission [%] · pays in about [n] days</span></span>${link('Edit', `Edit ${n}`)}</div>`;
const providersOpen = () => `${note('The schemes your customers use. Their terms are yours to fill in, from each provider’s agreement.')}${provRow('[Provider]')}${provRow('[Provider]')}${provRow('[Provider]')}<div>${button('+ Add a provider', { variant: 'default' })}</div>`;
const todayOpen = () => `${numRow('Quote with no certificate after', '[n]', 'days')}${numRow('Provider’s payment late by', '[n]', 'days')}${note('These go to Needs attention on Today for owners and managers.')}`;
const c2wSettings = (open) => settingsPage('c2w', 'Cycle to Work', C2W_INTRO, c2wFolds(open), { who: OWNER });
const providerEdit = () => popup('pe-title', 'Edit provider', '[Provider]', `${field('Name', { value: '[Provider]' })}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Commission', { value: '[%]', hint: 'A % or a £ amount per bike' })}${field('Pays in about', { value: '[n] days', hint: 'After collection' })}</div><div style="display: flex; flex-direction: column; gap: 6px"><label for="pe-notes" style="font-size: 14px; font-weight: 600">How they want the handover confirmed</label><textarea id="pe-notes" rows="2" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">[From their agreement]</textarea><span style="font-size: 13px; color: ${C.muted}">Shown to staff at hand-over.</span></div>`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 560);

// ---------- What the customer gets (decision 6) ----------
const email = () => {
  const [W, H] = DIMS[SIZE];
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${isPhone() ? 12 : 40}px; display: flex; justify-content: center; align-items: flex-start; background: ${C.bg}"><article aria-label="Email to Maya Patel" style="width: ${isPhone() ? '100%' : '600px'}; box-sizing: border-box; padding: 28px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px; font-size: 15px; line-height: 1.55; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to maya@example.test</span><h1 style="margin: 0; font-size: 22px">Your bike is put aside</h1><p style="margin: 0">Hi Maya, we’re holding ${BIKE} · ${SIZE_} for you until [date], while your Cycle to Work application goes through ${PROV}.</p><p style="margin: 0">Your quote number is ${mono('[quote number]')} — you’ll need it when you apply. We’ll let you know as soon as your certificate reaches us.</p>${button('See your order')}<p style="margin: 0; font-size: 13px; color: ${C.muted}">North Street Cycles · [Shop address] · [shop phone]</p></article></div>`;
};
const messages = () => settingsPage('messages', 'Messages', MSG_INTRO, msgFolds({ list: msgListOpen({ bringBack: false }) }), { who: OWNER });
const scrolledMsgs = (px) => messages().replace(/<div data-scroll style="([^"]*)overflow-y: auto;/, `<div data-scroll class="cw-sc" style="$1overflow-y: hidden;`).replace('<div data-scroll class="cw-sc"', `<style>.cw-sc > * { position: relative; top: -${px}px }</style><div data-scroll class="cw-sc"`);

// ---------- The boards ----------
const board = (inner) => `<div style="position: relative; width: ${DIMS[SIZE][0]}px; height: ${DIMS[SIZE][1]}px; overflow: hidden">${inner}</div>`;
def('cw-list', () => listPage());
def('cw-new', () => overlay(listPage(), newOrder(true)));
def('cw-new-not-in-stock', () => overlay(listPage(), newOrder(false)));
def('cw-quote', () => quoteDoc());
def('cw-order-held', () => orderPage({ stage: 1, next: 'held', toastHtml: toast('Quote emailed to Maya. Bike held until [date].') }));
def('cw-hold-ending', () => overlay(orderPage({ stage: 1, next: 'held' }), holdReminder()));
def('cw-order-applied', () => orderPage({ stage: 1, next: 'applied', order: true }));
def('cw-order-deposit', () => orderPage({ stage: 1, next: 'deposit', order: true, deposit: true }));
def('cw-order-anyway', () => overlay(orderPage({ stage: 1, next: 'deposit', order: true, deposit: true }), orderAnyway()));
def('cw-certificate', () => overlay(orderPage({ stage: 1, next: 'held' }), certificate()));
def('cw-certificate-diff', () => overlay(orderPage({ stage: 1, next: 'held' }), certificate(true)));
def('cw-order-ready', () => orderPage({ stage: 3, next: 'ready', hist: 'cert' }));
def('cw-hand-over', () => overlay(orderPage({ stage: 3, next: 'ready', hist: 'cert' }), handOver()));
def('cw-order-owed', () => orderPage({ stage: 4, next: 'owed', hist: 'collected' }));
def('cw-mark-paid', () => overlay(listPage(), markPaid()));
def('cw-mark-paid-diff', () => overlay(listPage(), markPaid(true)));
def('cw-order-paid', () => orderPage({ stage: 6, next: 'paid', hist: 'paid' }));
def('cw-cancel', () => overlay(orderPage({ stage: 1, next: 'deposit', order: true, deposit: true }), cancelOrder()));
def('cw-today', () => today({ c2w: true }));
def('cw-owed', () => owedPage());
def('cw-settings', () => c2wSettings({ hold: holdOpen(), order: orderOpen() }));
def('cw-settings-deposit', () => c2wSettings({ deposit: depositOpen(), providers: providersOpen() }));
def('cw-settings-provider', () => overlay(c2wSettings({ providers: providersOpen() }), providerEdit()));
def('cw-messages', () => scrolledMsgs(isPhone() ? 900 : 420));
def('cw-email', () => email());

const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'cw-list': 'Front desk › Cycle to Work: every order, by stage',
  'cw-new': 'New Cycle to Work order: a bike in stock, held',
  'cw-new-not-in-stock': 'A bike that isn’t in stock: the shop’s ordering rule',
  'cw-quote': 'The quote, to print or email',
  'cw-order-held': 'The order: quote given, bike held until [date]',
  'cw-hold-ending': 'The hold is ending: hold longer, or release',
  'cw-order-applied': 'Not in stock, customer applied: ready to order',
  'cw-order-deposit': 'Not in stock, deposit rule: waiting for a deposit',
  'cw-order-anyway': 'Order now anyway, with a reason',
  'cw-certificate': 'Add the certificate',
  'cw-certificate-diff': 'A certificate for less than the quote',
  'cw-order-ready': 'Ready to collect',
  'cw-hand-over': 'Hand over: the provider’s checks, then the till',
  'cw-order-owed': 'Collected: expected from the provider',
  'cw-mark-paid': 'Mark paid',
  'cw-mark-paid-diff': 'Paid less than expected',
  'cw-order-paid': 'Paid by the provider',
  'cw-cancel': 'The customer isn’t going ahead',
  'cw-today': 'Today: no certificate yet, a payment late',
  'cw-owed': 'Owed by Cycle to Work providers',
  'cw-settings': 'Settings › Front desk › Cycle to Work: holding and ordering',
  'cw-settings-deposit': 'Deposits, and the scheme providers',
  'cw-settings-provider': 'A provider: commission, payment days, handover',
  'cw-messages': 'Settings › Messages: the Cycle to Work messages',
  'cw-email': '“Your bike is put aside” email',
};
export const ROWS = [
  { label: 'The list and a new order', screens: ['cw-list', 'cw-new', 'cw-new-not-in-stock', 'cw-quote', 'cw-order-held'] },
  { label: 'Waiting for the certificate', screens: ['cw-hold-ending', 'cw-order-applied', 'cw-order-deposit', 'cw-order-anyway', 'cw-certificate', 'cw-certificate-diff', 'cw-cancel'] },
  { label: 'Collection and payment', screens: ['cw-order-ready', 'cw-hand-over', 'cw-order-owed', 'cw-mark-paid', 'cw-mark-paid-diff', 'cw-order-paid', 'cw-owed'] },
  { label: 'Today, settings and messages', screens: ['cw-today', 'cw-settings', 'cw-settings-deposit', 'cw-settings-provider', 'cw-messages', 'cw-email'] },
];
