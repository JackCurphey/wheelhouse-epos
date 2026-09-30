// Journey 5 — Collect the bike and pay, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-collect-and-pay-review.md
//
// Decision 2: the "Bike ready" link (Owner setup 23) opens one job's summary
// with nothing to sign into; when the shop has online payments on, it has
// "Pay now". Decision 3: at the counter the job has one main button — "Take
// payment" (the till, where paying records collection) or, when already
// paid, "Hand over". Real example data only: WH-1042, Maya Patel, Trek
// Domane AL 3, the approved lines and £111.00 total, the declined gear
// cable, the full service checklist (a ticked item with no note reads "All
// working well", Workshop day 21), Maya's booking note, North Street Cycles,
// Bolton. Anything else is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { settingsPage, workshopFolds, WORKSHOP_INTRO, note, withSize, isPhone, size } from './settings-frame.mjs';
import { screens as diaryScreens, toggleSwitch, LINES_APPROVED, WORK_TOTAL_APPROVED } from './diary.mjs';
import { screens as tillScreens } from './till.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { today } from './opening.mjs';
import { screens as setupScreens } from './setup.mjs';
import { CHECKLIST_10, CUSTOMER_NOTE } from './job-page.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
let SIZE = 'desktop';

// ---------- The customer's page: the job summary (decision 2) ----------
// The shop's website frame, as journey B's customer pages use it.
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', '', body) : SIZE === 'tablet' ? siteTablet('sand', body) : sitePhone('sand', { content: body });
};
const h = (t, sz = 18) => `<h2 style="margin: 0; font-size: ${sz}px; font-weight: 700">${t}</h2>`;
const box = (inner) => card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px">${inner}</div>`, 'flex-shrink: 0');
const row = (left, sub, right) => `<div role="listitem" style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;

const approved = LINES_APPROVED.filter((l) => l.approval === 'Approved');
const declined = LINES_APPROVED.filter((l) => l.approval === 'Declined');
const work = () => box(`${h('What we did')}
<div role="list">${approved.map((l) => row(esc(l.work), l.note ? esc(l.note) : '', mono(money(l.price), 'font-size: 15px'))).join('')}</div>
${declined.map((l) => `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Not done — you said not now: ${esc(l.work)} (${money(l.price)})</p>`).join('')}`);
// Workshop day 21: a ticked item with no note reads "All working well".
const checks = () => box(`${h('Full service checklist')}
<div role="list">${CHECKLIST_10.filter((c) => c.checked).map((c) => row(esc(c.t), '', c.note ? '' : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: ${C.successInk}; white-space: nowrap">${icon('check', 14)}All working well</span>`).replace('</span></span>', c.note ? `</span><span style="font-size: 14px; line-height: 1.45">${esc(c.note)}</span></span>` : '</span></span>')).join('')}</div>`);
const yourNote = () => box(`${h('What you told us', 16)}<p style="margin: 0; font-size: 15px; line-height: 1.5">“${esc(CUSTOMER_NOTE)}”</p>`);

const pay = (online) => box(`${h(online ? 'To pay' : 'To pay when you collect')}
${mono(money(WORK_TOTAL_APPROVED), 'font-size: 30px')}
${online ? `${button(`Pay ${money(WORK_TOTAL_APPROVED)} now`, { block: true })}${note('Or pay when you collect — either is fine.')}` : note('Pay at the counter by card or cash.')}
<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>Open [opening hours]</span><span>[Shop address] · [shop phone]</span></div>`);

const heading = () => `<div style="display: flex; flex-direction: column; gap: 4px"><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 30}px; font-weight: 700">Your Trek Domane AL 3 is ready</h1><span style="font-size: 15px; color: ${C.muted}">Job ${mono('WH-1042')} · Maya Patel</span></div>`;
function summary(online) {
  if (isPhone()) return site(`${heading()}${pay(online)}${work()}${checks()}${yourNote()}`);
  return site(`${heading()}<div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="display: flex; flex-direction: column; gap: 16px">${work()}${checks()}${yourNote()}</div><div style="display: flex; flex-direction: column; gap: 16px">${pay(online)}</div></div>`);
}

// Paying online: the payment provider's own card form sits inside the page
// (no provider is chosen yet, so it's a placeholder).
const centred = (inner) => site(`<div style="width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
const payOnline = () => centred(`${heading()}${box(`${h(`Pay ${money(WORK_TOTAL_APPROVED)}`)}${note('For job WH-1042 at North Street Cycles, Bolton.')}
<div style="display: flex; align-items: center; justify-content: center; min-height: 150px; padding: 16px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center; font-size: 14px; color: ${C.muted}">[The payment provider’s secure card form]</div>
${button(`Pay ${money(WORK_TOTAL_APPROVED)}`, { block: true })}
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Back to the summary</a>`)}`);
const paid = () => centred(`${box(`<span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 24)}</span>
${h('Paid — thank you, Maya', 22)}
<p style="margin: 0; font-size: 15px; line-height: 1.5">${money(WORK_TOTAL_APPROVED)} paid for job ${mono('WH-1042')}. Your receipt is on its way by email.</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5">When you come in, just give your name — your Trek Domane AL 3 is ready to go.</p>
<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>Open [opening hours]</span></div>`)}`);

// ---------- At the counter (decision 3) ----------
// Not paid: the job's main button is Take payment; the till opens with the
// job loaded and "Bike collected when paid" on (journey 11's board).
// Paid online: the main button is Hand over (journey 12's board, redrawn).

// ---------- Settings › Workshop › Collection (decision 3) ----------
// Decision 4: a reminder, then a flag on Today, for a bike left uncollected.
const days = (id, label, hint) => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><label for="${id}" style="font-size: 15px; font-weight: 700">${label}</label><span style="font-size: 13px; color: ${C.muted}">${hint}</span></span><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px"><input id="${id}" inputmode="numeric" value="[n]" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">days</span></div>`;
const collectionOpen = () => `${days('rem-days', 'Remind the customer after', 'Sends “Bike still waiting” — <a href="#" style="color: inherit">edit it in Messages</a>')}
${days('flag-days', 'Show it on Today after', 'Under Needs attention, for owners and managers')}
<div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 8px">${toggleSwitch('Hand-back reminders', false, 'hb-sw', size())}
${note('When on, staff confirm two things before Hand over, or at the till after paying: the bike went to the customer or someone they sent, and the lock key and rear light were returned. Off, collection is one tap.')}</div>`;

def('cp-summary', () => summary(true));
def('cp-pay', () => payOnline());
def('cp-paid', () => paid());
def('cp-summary-inshop', () => summary(false));
def('cp-ready-unpaid', () => diaryScreens['job-ready-unpaid'][SIZE]);
def('cp-till', () => tillScreens['till-job'][SIZE]);
def('cp-ready-paid', () => diaryScreens['job-collection'][SIZE]);
def('cp-today-uncollected', () => today({ uncollected: true }));
def('cp-messages', () => setupScreens['set-msg-list'][SIZE]);
def('cp-setting', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ collection: collectionOpen() })));

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'cp-summary': 'The “Bike ready” link: what we did, and Pay now',
  'cp-pay': 'Pay online',
  'cp-paid': 'Paid — see you soon',
  'cp-summary-inshop': 'The same link, for a shop without online payments',
  'cp-ready-unpaid': 'At the counter, not paid: Take payment',
  'cp-till': 'The till: the job loaded, collected when paid',
  'cp-ready-paid': 'At the counter, paid online: Hand over',
  'cp-today-uncollected': 'Today: a ready bike left too long',
  'cp-messages': 'Settings › Messages: “Bike still waiting”',
  'cp-setting': 'Settings › Workshop › Collection: reminder, flag, hand-back',
};
export const ROWS = [
  { label: 'The customer’s link', screens: ['cp-summary', 'cp-pay', 'cp-paid', 'cp-summary-inshop'] },
  { label: 'At the counter', screens: ['cp-ready-unpaid', 'cp-till', 'cp-ready-paid'] },
  { label: 'Not collected', screens: ['cp-today-uncollected'] },
  { label: 'Settings', screens: ['cp-setting', 'cp-messages'] },
];
