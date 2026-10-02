// Journey 21 — Lightspeed shops, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-lightspeed-shops-review.md
//
// A shop that keeps Lightspeed as its till. Decision 1: the workshop only,
// Lightspeed doing the money. 2: Wheelhouse shows when the linked work
// order is paid. 3: the work order is made automatically on approval. 4:
// customers linked by Wheelhouse where it's sure, by staff when it isn't.
// 5: quote parts come from Lightspeed's products. 6: when Lightspeed can't
// be reached the workshop carries on and Wheelhouse catches up by itself.
// 7: the owner connects Lightspeed in Settings with a checklist. 8: labour
// priced in Wheelhouse, sent as labour lines. 9: no money through
// Wheelhouse for these shops. 10: the UI audit (lightspeed-ui-audit.md),
// every recommendation taken.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner), Jo Taylor (Staff), Alex Morgan (Mechanic), Maya Patel
// with WH-1042 (Trek Domane AL 3, Standard service, agreed £111.00),
// Shimano brake pads B05S-RX £28.00. Lightspeed's own names, numbers and
// products are bracketed placeholders; Lightspeed's sign-in page is not
// drawn (it is Lightspeed's). What Lightspeed allows is unverified until
// there is a test account (proof steps LS-01–09).
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, lsFolds, LS_INTRO, workshopFolds, WORKSHOP_INTRO, msgFolds, MSG_INTRO, dataFolds, DATA_INTRO } from './settings-frame.mjs';
import { today } from './opening.mjs';
import { jobVariant, quoteJobBoards, phoneStagePanel, footNote, handOverFooter } from './diary.mjs';
import { panel as jpPanel, row as jpRow, mono as jpMono } from './job-page.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { msgListOpen } from './setup.mjs';
import { withLightspeedShop } from './shop-mode.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const MANAGER = { role: 'M', person: 'Jack Lewis', roleName: 'Manager' };
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const tall = 'display: inline-flex; align-items: center; min-height: 44px';
const WO = 'work order [number]';
// Audit M7: no promised timings — when it last checked, and a "Why?".
const WHY = `<a href="#" aria-label="Why it can take a moment to show" style="${tall}; min-width: 44px; justify-content: center; font-weight: 600; color: ${C.ink}">Why?</a>`;
const checked = (when = '[n] seconds ago') => `Last checked ${when} · ${WHY}`;
// Audit H4: exactly what Wheelhouse writes.
const PROMISE = 'Wheelhouse never takes a payment, gives a refund or closes a sale in Lightspeed. It does put the prices the customer approved on the work order, so the till shows what they agreed.';
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'store', 18)}<span>${t}</span></p>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 44px; border-top: 1px solid ${C.border}; font-size: 15px"><span>${k}</span><span style="text-align: right">${v}</span></div>`;
const radio = (name, on, sub, grp) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${grp}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span>` : ''}</span></label>`;
const group = (legend, inner) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">${legend}</legend>${inner}</fieldset>`;
const selectBox = (id, label, value, hint = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label id="${id}-l" for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><button id="${id}" type="button" aria-haspopup="listbox" aria-labelledby="${id}-l ${id}"${hint ? ` aria-describedby="${id}-h"` : ''} style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button>${hint ? `<span id="${id}-h" style="font-size: 13px; color: ${C.warnInk}">${hint}</span>` : ''}</div>`;
const greyBtn = (t, why) => `<span style="display: inline-flex; align-items: center; gap: 8px"><button type="button" aria-disabled="true" style="min-height: 44px; padding: 0 16px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 15px; font-weight: 600">${t}</button><span style="font-size: 13px; color: ${C.muted}">${why}</span></span>`;
const steps = (at) => `<ol aria-label="Steps" style="margin: 0; padding: 0; display: flex; gap: 6px">${['Sign in to Lightspeed', 'Shops and staff', 'Check it works'].map((s, i) => `<li${i === at ? ' aria-current="step"' : ''} style="list-style: none; flex: 1; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; border: ${i === at ? 2 : 1}px solid ${i === at ? C.ink : C.border}; background: ${i < at ? C.mutedBg : C.panel}; font-size: 13px; font-weight: 700; color: ${i <= at ? C.ink : C.muted}">${i < at ? `${icon('check', 13)}<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Done: </span>` : `${i + 1} · `}${s}</li>`).join('')}</ol>`;

// ---------- Settings › Office › Lightspeed (decision 7; audit H4, L3, M5) ----------
const lsSettings = (open, opts = {}) => settingsPage('lightspeed', 'Lightspeed', LS_INTRO, lsFolds(open), { who: OWNER, ...opts });
const offOpen = () => `<p style="margin: 0; font-size: 15px; line-height: 1.5">Connect the Lightspeed till this shop uses. Wheelhouse then reads your products and stock, finds and adds customers, makes a work order for each approved job — a work order is Lightspeed's name for a job — and sees when it's paid.</p>${msg(PROMISE, 'grey')}<div>${button('Connect Lightspeed')}</div>`;
const connOpen = (readOnly = false) => `${kv('Lightspeed account', '[Lightspeed account name]')}${kv('Connected by', 'Jack Lewis · [date]')}${kv('Last checked', `[n] seconds ago · ${WHY}`)}${readOnly ? note('Only the owner can connect, disconnect or check Lightspeed.') : `<div style="display: flex; flex-wrap: wrap; gap: 10px">${greyBtn('Check now', 'Checked just now — again in [n] seconds')}${button('Disconnect…', { variant: 'default' })}</div>`}`;
// Audit M5: three states — working, not working, not proven yet.
const CHECKS = [
  ['Read products and stock', 'ok', '[n] products read'],
  ['Find customers', 'ok', '[n] customers read'],
  ['Make and update work orders', 'later', 'Not proven yet — shows on the first approved job'],
  ['Add customers', 'later', 'Not proven yet — shows the first time a new customer’s job goes to Lightspeed'],
  ['See when a work order is paid', 'later', 'Not proven yet — shows on the first job paid at the Lightspeed till. Until then, staff tick “Paid in Lightspeed” when they hand a bike over.'],
];
const STATE = { ok: ['check', C.okBg, C.successInk, 'Working'], no: ['alert', C.warnBg, C.warnInk, 'Not working'], later: ['store', C.mutedBg, C.muted, 'Not proven yet'] };
const checkList = () => `<ul style="margin: 0; padding: 0; display: flex; flex-direction: column">${CHECKS.map(([t, st, sub]) => { const [ic, bg, ink, word] = STATE[st]; return `<li style="list-style: none; display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span aria-hidden="true" style="flex-shrink: 0; display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border-radius: 999px; background: ${bg}; color: ${ink}">${icon(ic, 15)}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">${t} <span style="font-weight: 600; color: ${ink}">· ${word}</span></span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></li>`; }).join('')}</ul>`;
const STAFF = [['Jack Lewis', '[Lightspeed employee]'], ['Jo Taylor', '[Lightspeed employee]'], ['Alex Morgan', '[Lightspeed employee]']];
// Audit M6: someone can be marked as not using Lightspeed.
const staffList = () => `<div style="display: flex; flex-direction: column">${STAFF.map(([n, l], i) => `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '160px 1fr'}; gap: 6px 12px; align-items: center; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">${n}</span>${i === 2 ? selectBox(`ls-emp-${i}`, `${n} in Lightspeed`, 'Alex doesn’t use Lightspeed', 'Work orders for Alex’s jobs show no staff name') : `<span style="font-size: 15px">${l} ${badge('Matched by name', 'green')}</span>`}</div>`).join('')}</div>`;
const startSignin = () => popup('ls1-title', 'Connect Lightspeed', 'North Street Cycles', `${steps(0)}<p style="margin: 0; font-size: 15px; line-height: 1.5">Lightspeed opens in a new tab. Sign in there as the account owner and allow Wheelhouse to:</p><ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.7"><li>read products and stock</li><li>find and add customers</li><li>make and update work orders — Lightspeed's name for a job</li><li>see when a work order is paid</li></ul>${msg(PROMISE, 'grey')}`, `${button('Cancel', { variant: 'ghost' })}${button('Continue to Lightspeed')}`, 580);
const startShops = (two = false) => popup('ls2-title', 'Connect Lightspeed', 'Signed in as [Lightspeed account name]', `${steps(1)}${two ? `${selectBox('ls-shop', 'Which Lightspeed shop is Bolton?', '[Lightspeed shop 1]')}${selectBox('ls-shop2', 'Which Lightspeed shop is [Second site]?', '[Lightspeed shop 2]')}` : msg('One shop: Bolton is linked to [Lightspeed shop].', 'ok')}${group('Staff on work orders', `${note('So each work order shows who did the job.')}${staffList()}`)}`, `${button('Back', { variant: 'ghost' })}${button('Next')}`, 620);
const startChecks = () => popup('ls3-title', 'Connect Lightspeed', 'What works', `${steps(2)}${checkList()}${msg('<strong>2 working · 3 will show on first use.</strong> You can start using it now.', 'ok', true)}`, `${button('Check again', { variant: 'ghost' })}${button('Done')}`, 620);
const disconnect = () => popup('dc-title', 'Disconnect Lightspeed?', '[Lightspeed account name]', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Wheelhouse stops sending to Lightspeed and stops checking it.</p><ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.7"><li>Jobs, quotes and the diary stay in Wheelhouse.</li><li>Work orders already in Lightspeed stay there, and can still be paid at the till.</li><li>[n] jobs waiting to send won't be sent until you connect again.</li><li>Staff will tick “Paid in Lightspeed” at hand-over.</li></ul>`, `${button('Keep connected', { variant: 'ghost' })}${button('Disconnect', { variant: 'danger' })}`, 540);
const reconnectBanner = () => msg('<strong>Lightspeed signed Wheelhouse out on [date].</strong> Nothing is being sent or checked. [n] jobs are waiting. Only the owner can reconnect.', 'warn', true);

// ---------- Jobs (decisions 2, 3, 4, 5, 6; audit H2, H3, M8, M11, L2) ----------
// Each strip: a badge, the main line (the instruction lives here, not in
// small print), an optional side note and button; announced when it changes.
const strip = (b, main, side = '', act = '') => () => `<div role="status">${jpPanel(`${jpRow(`${b}<span style="font-size: 14px; font-weight: 700">${main}</span><span style="flex-grow: 1"></span>${side ? `<span style="font-size: 13px; color: ${C.muted}">${side}</span>` : ''}${act}`, 8)}`, '', 6, 3)}</div>`;
const phoneTop = (b, main, side = '', act = '') => () => phoneStagePanel(`<div role="status" style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; align-items: center; gap: 8px">${b}</div><span style="font-size: 15px; font-weight: 700">${main}</span>${side ? `<span style="font-size: 13px; color: ${C.muted}">${side}</span>` : ''}${act}</div>`);
const sbtn = (t, label) => button(t, { variant: 'default' }).replace('<button', `<button aria-label="${esc(label)}"`);
const AGREED = `Agreed ${jpMono('£111.00')}`;
const JOBS = {
  notConnected: [badge('Not in Lightspeed', 'grey'), 'Lightspeed isn’t connected', 'The work order is made once the owner connects it'],
  sent: [badge('In Lightspeed', 'blue'), `${WO} · ${AGREED}`, 'Made when Maya approved · updated [time]'],
  changed: [badge('In Lightspeed', 'blue'), `${WO} updated · now ${jpMono('£[£]')}`, 'Maya approved the new price at [time]'],
  cancelled: [badge('Cancelled', 'grey'), `${WO} marked cancelled in Lightspeed`, 'By Jo Taylor at [time]'],
  pick: [badge('Not sent yet', 'amber'), 'Choose Maya in Lightspeed to send the work order', '', sbtn('Choose the customer', 'Choose the customer in Lightspeed for WH-1042')],
  waitReach: [badge('Waiting to reach Lightspeed', 'amber'), 'Not sent yet — Wheelhouse keeps trying by itself', 'Since [time]'],
  unsure: [badge('Not sure it arrived', 'amber'), 'Wheelhouse won’t send it again until someone has looked', '', sbtn('Check this in Lightspeed', 'Check WH-1042’s work order in Lightspeed')],
  readyNoWo: [badge('Not in Lightspeed yet', 'amber'), 'Maya can’t pay at the Lightspeed till yet — the work order isn’t there', 'Waiting to reach Lightspeed since [time]'],
  unpaid: [badge('Waiting to be paid in Lightspeed', 'amber'), `Maya pays at the Lightspeed till · ${AGREED}`, `${WO} · ${checked()}`],
  paid: [badge('Paid in Lightspeed', 'green'), `[time] · ${AGREED}`, WO],
  fallback: [badge('In Lightspeed', 'blue'), `Take payment at the Lightspeed till · ${AGREED}`, `${WO} · payment isn’t checked for this shop`],
  collectedUnpaid: [badge('Collected · not shown as paid in Lightspeed', 'amber'), `Handed over by Jo Taylor at [time] before payment showed · ${AGREED}`, `${WO} · ${checked()}`],
};
const job = (status, tone, k, footer) => { const [b, m, s, a] = JOBS[k]; return jobVariant(status, tone, strip(b, m, s, a), phoneTop(b, m, s, a), footer); };
const plainFooter = (t, sub) => (size) => `${button(t, { variant: 'primary', block: true })}${footNote(sub, size)}`;
const readyFooter = plainFooter('Mark ready for collection', 'Tells Maya her bike is ready to collect and pay for.');
const fallbackFooter = (size) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; flex-shrink: 0"><input type="checkbox" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"><span style="font-size: 14px; font-weight: 600">Paid in Lightspeed</span></label>${handOverFooter(size)}`;
const JOB_AT = {
  notConnected: () => job('In the workshop', 'blue', 'notConnected', readyFooter),
  sent: () => job('In the workshop', 'blue', 'sent', readyFooter),
  changed: () => job('In the workshop', 'blue', 'changed', readyFooter),
  cancelled: () => job('Cancelled', 'grey', 'cancelled', plainFooter('Done', 'Closes the job.')),
  pick: () => job('In the workshop', 'blue', 'pick', readyFooter),
  waitReach: () => job('In the workshop', 'blue', 'waitReach', readyFooter),
  unsure: () => job('In the workshop', 'blue', 'unsure', readyFooter),
  readyNoWo: () => job('Ready for collection', 'green', 'readyNoWo', (size) => handOverFooter(size)),
  unpaid: () => job('Ready for collection', 'green', 'unpaid', (size) => handOverFooter(size)),
  paid: () => job('Ready for collection', 'green', 'paid', (size) => handOverFooter(size)),
  fallback: () => job('Ready for collection', 'green', 'fallback', fallbackFooter),
  collectedUnpaid: () => job('Collected', 'grey', 'collectedUnpaid', plainFooter('Done', 'The job stays marked until payment shows.')),
};
const jobAt = (k) => withLightspeedShop(() => JOB_AT[k]())[SIZE];

// Decision 5; audit M10: one press adds a part.
const PRODUCTS = [
  ['Shimano brake pads B05S-RX', '£28.00', '3 in stock'],
  ['[Product]', '£[£]', '0 in stock · [n] on order'],
  ['[Product]', '£[£]', '[n] in stock'],
];
const partSearch = (down = false) => popup('ps-title', 'Add a part', down ? 'Lightspeed can’t be reached' : `From Lightspeed’s products · ${checked('40 seconds ago')}`, `${down ? msg('<strong>Showing products and stock as of [time].</strong> Prices may have changed since — the work order uses Lightspeed’s price when it sends.', 'warn', true) : ''}<div style="display: flex; flex-direction: column; gap: 6px"><label for="ps-q" style="font-size: 14px; font-weight: 600">Search products</label><input id="ps-q" value="brake pads" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div><ul aria-label="Products" style="margin: 0; padding: 0">${PRODUCTS.map(([n, p, s]) => `<li style="list-style: none"><button type="button" aria-label="Add ${esc(n)} to the quote" style="display: grid; grid-template-columns: ${isPhone() ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto auto auto'}; gap: ${isPhone() ? '4px 10px' : '12px'}; align-items: center; width: 100%; min-height: 52px; padding: 6px 4px; border: 0; border-top: 1px solid ${C.border}; background: transparent; text-align: left; font-family: inherit; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600${isPhone() ? '; grid-column: 1 / -1' : ''}">${n}</span>${mono(p, 'font-size: 14px')}<span style="font-size: 13px; color: ${C.muted}; white-space: nowrap">${down ? `${s} as of [time]` : s}</span><span style="display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700">${icon('plus', 14)}Add</span></button></li>`).join('')}</ul>${note('Prices and stock come from Lightspeed. Labour is priced here, in Settings › Workshop.')}`, button('Done', { variant: 'default' }), 640);

// Decision 4; audit M9: nothing chosen to start; each row says what matched.
const customerPick = () => popup('cp-title', 'Which Maya Patel in Lightspeed?', 'WH-1042 is ready to go to Lightspeed', `${note('Wheelhouse found more than one possible match. Pick once — the link stays for Maya’s next jobs, and can be changed on her customer page.')}${group('Lightspeed customers', `${radio('Maya Patel', false, `${mono('07700 900 142')} · maya@example.test — same phone and email as Maya`, 'cp')}${radio('M. Patel', false, `${mono('[phone]')} — no phone or email to compare`, 'cp')}${radio('None of these — add Maya to Lightspeed', false, '', 'cp')}`)}`, `${button('Not now', { variant: 'ghost' })}${greyBtn('Link and send', 'Choose one')}`, 580);

// Decision 6: a send that may or may not have arrived.
const checkInLs = () => popup('ck-title', 'Check this in Lightspeed', 'WH-1042 · Maya Patel', `${msg('<strong>Not sure the work order arrived.</strong> Lightspeed stopped answering while it was being sent, and Wheelhouse couldn’t find it afterwards. It won’t send it again until you’ve looked.', 'warn', true)}${field('Work order number in Lightspeed', { value: '', placeholder: 'If you find it', hint: 'Look for WH-1042 · Maya Patel · agreed £111.00 in Lightspeed’s work orders', linked: true, id: 'ck-wo' })}`, `${button('It isn’t there — send it', { variant: 'ghost' })}${button('Link this work order')}`, 560);

// Decision 2; audit H2, M7, L4: the pop-up's words follow the cause.
const HANDOVER = {
  notShown: ['Not paid in Lightspeed yet', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Lightspeed hasn’t shown ${WO} as paid. ${checked()}</p><div>${button('Check Lightspeed now', { variant: 'default' })}</div>${note('Handing over anyway is recorded on the job, and the job stays marked until payment shows.')}`, 'Hand over anyway'],
  unreachable: ['Can’t reach Lightspeed to check', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Wheelhouse can’t see whether Maya has paid — Lightspeed hasn’t answered since [time].</p>${note('Handing over is recorded on the job, and Wheelhouse checks the payment once Lightspeed answers.')}`, 'Hand over anyway'],
  unchecked: ['Has Maya paid?', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Payment isn’t checked for this shop. Check the Lightspeed till for ${WO} · ${AGREED}.</p>${note('Your answer is recorded on the job.')}`, 'Yes, she paid'],
};
const handOverPop = (k) => { const [t, body, go] = HANDOVER[k]; return popup('hu-title', t, 'WH-1042 · Maya Patel', body, `${button('Not yet', { variant: 'default' })}${button(go)}`, 540); };
const handOverFound = () => popup('hf-title', 'Paid in Lightspeed', 'WH-1042 · Maya Patel', msg(`<strong>Found it — ${WO} was paid at [time].</strong>`, 'ok', true), `${button('Cancel', { variant: 'ghost' })}${button('Hand over')}`, 520);

// ---------- Settings and messages (audit M1, M2) ----------
const workshopNoMoney = () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({}), { who: OWNER, banner: msg('<strong>Deposits and paying online are off.</strong> With Lightspeed, customers pay at the Lightspeed till — Wheelhouse takes no money.', 'grey') });
const messagesPage = () => settingsPage('messages', 'Messages', MSG_INTRO, msgFolds({ list: msgListOpen({ bringBack: true }) }), { who: OWNER });
const activityOpen = () => `${note('Everything recorded about jobs, settings and Lightspeed — for owners and managers.')}<ul style="margin: 0; padding: 0">${[['Jo Taylor', 'handed over WH-1042 before payment showed in Lightspeed'], ['Wheelhouse', `made ${WO} for WH-1042`], ['Jack Lewis', 'connected Lightspeed']].map(([w, t]) => `<li style="list-style: none; display: flex; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 14px">${mono('[time]', `flex-shrink: 0; color: ${C.muted}`)}<span><strong>${w}</strong> ${t}</span></li>`).join('')}</ul><div>${button('Open the activity log', { variant: 'default' })}</div>`;
const dataPage = () => settingsPage('data', 'Your data', DATA_INTRO, dataFolds({ activity: activityOpen() }), { who: OWNER });

// ---------- What the customer sees (decision 9; audit H1, M8) ----------
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const customerReady = () => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px"><div style="width: 100%; max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${back('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your bike is ready</h1>${note('WH-1042 · Trek Domane AL 3 · North Street Cycles, Bolton')}${card(`<div style="padding: 18px; display: flex; flex-direction: column; gap: 10px">${kv('Standard service, brake pads, brake fitting', '')}${kv('<strong>Agreed price</strong>', `<strong>${mono('£111.00')}</strong>`)}<p style="margin: 0; font-size: 15px; line-height: 1.5">You pay at the till when you collect. Open [opening hours].</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('See what we did', { variant: 'default' })}${button('Ask the shop a question', { variant: 'default' })}</div></div>`)}</div></div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};

// ---------- The boards ----------
const ls = (id, fn) => def(id, () => withLightspeedShop(fn));
const off = () => lsSettings({ off: true, connection: offOpen() });
ls('ls-settings-off', () => off());
ls('ls-connect-signin', () => overlay(off(), startSignin()));
ls('ls-connect-shops', () => overlay(off(), startShops()));
ls('ls-connect-shops-two', () => overlay(off(), startShops(true)));
ls('ls-connect-checks', () => overlay(off(), startChecks()));
ls('ls-settings-on', () => lsSettings({ connection: connOpen(), checks: checkList() }));
ls('ls-settings-manager', () => settingsPage('lightspeed', 'Lightspeed', LS_INTRO, lsFolds({ connection: connOpen(true) }), { who: MANAGER }));
ls('ls-disconnect', () => overlay(lsSettings({ connection: connOpen() }), disconnect()));
ls('ls-reconnect', () => lsSettings({ signedOut: true, connection: `${kv('Lightspeed account', '[Lightspeed account name]')}<div>${button('Reconnect Lightspeed')}</div>` }, { banner: reconnectBanner() }));
ls('ls-today', () => today({ lightspeed: true, as: OWNER }));
ls('ls-job-not-connected', () => jobAt('notConnected'));
ls('ls-part-search', () => overlay(quoteJobBoards('build')[SIZE], partSearch()));
ls('ls-part-search-down', () => overlay(quoteJobBoards('build')[SIZE], partSearch(true)));
ls('ls-job-sent', () => jobAt('sent'));
ls('ls-job-changed', () => jobAt('changed'));
ls('ls-job-cancelled', () => jobAt('cancelled'));
ls('ls-job-pick', () => jobAt('pick'));
ls('ls-customer-pick', () => overlay(jobAt('pick'), customerPick()));
ls('ls-job-waiting', () => jobAt('waitReach'));
ls('ls-job-unsure', () => jobAt('unsure'));
ls('ls-job-check', () => overlay(jobAt('unsure'), checkInLs()));
ls('ls-today-down', () => today({ lightspeed: true, lsDown: true, as: OWNER }));
ls('ls-today-person', () => today({ lightspeed: true, lsPerson: true, as: OWNER }));
ls('ls-job-ready-no-wo', () => jobAt('readyNoWo'));
ls('ls-job-unpaid', () => jobAt('unpaid'));
ls('ls-hand-over-unpaid', () => overlay(jobAt('unpaid'), handOverPop('notShown')));
ls('ls-hand-over-found', () => overlay(jobAt('unpaid'), handOverFound()));
ls('ls-hand-over-unreachable', () => overlay(jobAt('unpaid'), handOverPop('unreachable')));
ls('ls-job-paid', () => jobAt('paid'));
ls('ls-job-fallback', () => jobAt('fallback'));
ls('ls-hand-over-unchecked', () => overlay(jobAt('fallback'), handOverPop('unchecked')));
ls('ls-job-collected-unpaid', () => jobAt('collectedUnpaid'));
ls('ls-today-unpaid', () => today({ lightspeed: true, lsUnpaid: true, as: OWNER }));
ls('ls-messages', () => messagesPage());
ls('ls-office-data', () => dataPage());
ls('ls-workshop-settings', () => workshopNoMoney());
ls('ls-customer-ready', () => customerReady());

const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ls-settings-off': 'Settings › Office › Lightspeed: not connected',
  'ls-connect-signin': 'Connect Lightspeed: sign in on Lightspeed’s page',
  'ls-connect-shops': 'Connect Lightspeed: staff on work orders',
  'ls-connect-shops-two': 'Two shops: which Lightspeed shop is which',
  'ls-connect-checks': 'Connect Lightspeed: working, not proven yet',
  'ls-settings-on': 'Settings › Office › Lightspeed: connected',
  'ls-settings-manager': 'A manager sees the connection, read only',
  'ls-disconnect': 'Disconnect Lightspeed?',
  'ls-reconnect': 'Lightspeed signed Wheelhouse out: reconnect',
  'ls-today': 'Today for a Lightspeed shop',
  'ls-job-not-connected': 'A job before Lightspeed is connected',
  'ls-part-search': 'Add a part: Lightspeed’s products, one press',
  'ls-part-search-down': 'Add a part while Lightspeed can’t be reached',
  'ls-job-sent': 'Approved: the work order made in Lightspeed',
  'ls-job-changed': 'A new price approved: the work order updated',
  'ls-job-cancelled': 'Cancelled: the work order marked cancelled',
  'ls-job-pick': 'Not sent yet: choose the customer',
  'ls-customer-pick': 'Which customer in Lightspeed? Nothing chosen to start',
  'ls-job-waiting': 'Waiting to reach Lightspeed',
  'ls-job-unsure': 'Not sure the work order arrived',
  'ls-job-check': 'Check this in Lightspeed',
  'ls-today-down': 'Today: can’t reach Lightspeed',
  'ls-today-person': 'Today: jobs that need someone to look',
  'ls-job-ready-no-wo': 'Ready, but not in Lightspeed yet',
  'ls-job-unpaid': 'Ready: waiting to be paid in Lightspeed',
  'ls-hand-over-unpaid': 'Hand over before it shows as paid',
  'ls-hand-over-found': '“Check Lightspeed now” finds the payment',
  'ls-hand-over-unreachable': 'Hand over while Lightspeed can’t be reached',
  'ls-job-paid': 'Paid in Lightspeed',
  'ls-job-fallback': 'Payment not checked: tick “Paid in Lightspeed”',
  'ls-hand-over-unchecked': 'Payment not checked: “Has Maya paid?”',
  'ls-job-collected-unpaid': 'Collected, not shown as paid',
  'ls-today-unpaid': 'Today: handed over, not paid after [n] days',
  'ls-messages': 'Settings › Front desk › Messages for a Lightspeed shop',
  'ls-office-data': 'Settings › Office › Your data: the Activity log',
  'ls-workshop-settings': 'Settings › Workshop: no deposits or paying online',
  'ls-customer-ready': 'The customer’s “Your bike is ready”: agreed price, pay at the till',
};
export const ROWS = [
  { label: 'Connecting Lightspeed', screens: ['ls-settings-off', 'ls-connect-signin', 'ls-connect-shops', 'ls-connect-shops-two', 'ls-connect-checks', 'ls-settings-on', 'ls-settings-manager', 'ls-disconnect', 'ls-reconnect'] },
  { label: 'Quote and approval', screens: ['ls-today', 'ls-job-not-connected', 'ls-part-search', 'ls-part-search-down', 'ls-job-sent', 'ls-job-changed', 'ls-job-cancelled', 'ls-job-pick', 'ls-customer-pick'] },
  { label: 'When Lightspeed can’t be reached', screens: ['ls-job-waiting', 'ls-job-unsure', 'ls-job-check', 'ls-today-down', 'ls-today-person'] },
  { label: 'Payment and collection', screens: ['ls-job-ready-no-wo', 'ls-job-unpaid', 'ls-hand-over-unpaid', 'ls-hand-over-found', 'ls-hand-over-unreachable', 'ls-job-paid', 'ls-job-fallback', 'ls-hand-over-unchecked', 'ls-job-collected-unpaid', 'ls-today-unpaid'] },
  { label: 'Settings and the customer', screens: ['ls-messages', 'ls-office-data', 'ls-workshop-settings', 'ls-customer-ready'] },
];
