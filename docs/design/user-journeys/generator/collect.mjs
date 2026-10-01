// Journey 5 — Collect the bike and pay, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-collect-and-pay-review.md
// UI audit: docs/design/user-journeys/collect-ui-audit.md
//
// Decision 2: the "Bike ready" link (Owner setup 23) opens one job's summary
// with nothing to sign into; when the shop has online payments on, it has
// "Pay now". Decision 3: at the counter the job has one main button — "Take
// payment" (the till, where paying records collection) or, when already
// paid, "Hand over". Decision 4: a reminder, then a Today flag, for a bike
// left uncollected. Real example data only: WH-1042, Maya Patel, Trek Domane
// AL 3, the approved lines and £111.00 total, the declined gear cable, the
// full service checklist (a ticked item with no note reads "All working
// well", Workshop day 21), Maya's booking note, journey 11's example deposit
// (25%, £27.75), North Street Cycles, Bolton. Anything else is a bracketed
// placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { settingsPage, rowSwitch, workshopFolds, WORKSHOP_INTRO, note, popup, overlay, withSize, isPhone, size, remindBox } from './settings-frame.mjs';
import { screens as diaryScreens, LINES_APPROVED, WORK_TOTAL_APPROVED } from './diary.mjs';
import { screens as tillScreens } from './till.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { CHECKLIST_10, CUSTOMER_NOTE } from './job-page.mjs';
import { today } from './opening.mjs';
import { chan, wordingBox, bubble, msgPage, msgListOpen } from './setup.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
const DEPOSIT = WORK_TOTAL_APPROVED * 0.25; // journey 11's example deposit
let SIZE = 'desktop';

// ---------- The customer's page: the job summary (decision 2) ----------
// The shop's website frame, as journey B's customer pages use it.
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Book a repair', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Book a repair') : sitePhone('sand', { content: body });
};
// Audit L1: each card is a labelled section.
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const box = (title, inner, sz = 18) => `<section aria-labelledby="c-${slug(title)}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px"><h2 id="c-${slug(title)}" style="margin: 0; font-size: ${sz}px; font-weight: 700">${title}</h2>${inner}</div>`)}</section>`;
const row = (left, sub, right) => `<div role="listitem" style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub}</span>${right}</div>`;
const sub = (t) => (t ? `<span style="font-size: 13px; color: ${C.muted}">${t}</span>` : '');
const shopLines = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>Open [opening hours]</span><span>[Shop address] · [shop phone]</span></div>`;

const approved = LINES_APPROVED.filter((l) => l.approval === 'Approved');
const declined = LINES_APPROVED.filter((l) => l.approval === 'Declined');
// Drop off and approve the quote audit H4: the quote's photo carries through.
const padsPhoto = `<button type="button" aria-label="Photo of Shimano brake pads: rear pads worn — open larger photo" style="position: relative; flex-shrink: 0; width: 96px; height: 72px; display: flex; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box; border-radius: 8px; border: 1px dashed ${C.input}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 12px; text-align: center">[Photo of the worn rear pads]</button>`;
const work = () => box('What we did', `<div role="list">${approved.map((l) => row(esc(l.work), sub(l.note ? esc(l.note) : ''), l.code === 'B05S-RX' ? `<span style="display: inline-flex; align-items: flex-start; gap: 12px">${padsPhoto}${mono(money(l.price), 'font-size: 15px')}</span>` : mono(money(l.price), 'font-size: 15px'))).join('')}</div>
${declined.map((l) => `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Not done — you said no thanks: ${esc(l.work)} (${money(l.price)})</p>`).join('')}`);
// Workshop day 21: a ticked item with no note reads "All working well".
// Audit M1: a note is labelled as what the mechanic found; the count says
// how many of the checks were done (wording confirmed by Jack, 30 Sep).
const ticked = CHECKLIST_10.filter((c) => c.checked);
const okMark = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: ${C.successInk}; white-space: nowrap">${icon('check', 14)}All working well</span>`;
const checks = () => box('Full service checklist', `<div role="list">${ticked.map((c) => row(esc(c.t), c.note ? `<span style="font-size: 14px; line-height: 1.45"><span style="font-weight: 600">What the mechanic found:</span> ${esc(c.note)}</span>` : '', c.note ? '' : okMark)).join('')}</div>
<p style="margin: 0; font-size: 14px; color: ${C.muted}">${ticked.length} of ${CHECKLIST_10.length} checks done.</p>`);
const yourNote = () => box('What you told us', `<p style="margin: 0; font-size: 15px; line-height: 1.5">“${esc(CUSTOMER_NOTE)}”</p>`, 16);

// The pay card in each state (decision 2; audit H1, H2, H3).
function pay(state, remind = false) {
  const due = state === 'deposit' ? WORK_TOTAL_APPROVED - DEPOSIT : WORK_TOTAL_APPROVED;
  const depositLine = state === 'deposit' ? `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Deposit paid ${money(DEPOSIT)} · [date]</p>` : '';
  if (state === 'paid') return box('Paid', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}${money(WORK_TOTAL_APPROVED)} paid on [date]</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing more to pay. When you come in, just give your name.</p>${shopLines}`);
  if (state === 'counter') return box('To pay', `${mono(money(WORK_TOTAL_APPROVED), 'font-size: 30px')}
<p role="status" style="margin: 0; font-size: 15px; line-height: 1.5">This is being paid at the counter right now, so there’s nothing to pay here.</p>${shopLines}`);
  if (state === 'inshop') return box('To pay when you collect', `${mono(money(due), 'font-size: 30px')}
${note('Pay at the counter by card or cash. When you come in, just give your name.')}${shopLines}`);
  return box('To pay', `${mono(money(due), 'font-size: 30px')}${depositLine}
${button(`Pay ${money(due)} now`, { block: true })}${note('Or pay when you collect — either is fine.')}${remind ? `<div style="padding-top: 8px; border-top: 1px solid ${C.border}">${remindBox(false, { collect: true })}</div>` : ''}${shopLines}${button('Add a note for the shop', { variant: 'default' })}`);
}

// Drop off and approve the quote audit H4: the same page as the booking and
// the quote — the "Your booking" line and the tracker, now at Ready.
const STEPS = ['Booked', 'In the shop', 'Being worked on', 'Ready'];
const trackerDone = () => `<ol aria-label="Where your bike is" style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: ${isPhone() ? 8 : 16}px">${STEPS.map((t, i) => `<li${i === 3 ? ' aria-current="step"' : ''} style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: ${i === 3 ? 700 : 500}"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; ${i === 3 ? `background: ${C.ink}; color: #ffffff` : `background: ${C.okBg}; color: ${C.successInk}`}">${icon('check', 12)}</span>${t}</li>`).join('')}</ol>`;
const heading = () => `<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; color: ${C.muted}">Your booking · ${mono('WH-1042')}</span><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 30}px; font-weight: 700">Your Trek Domane AL 3 is ready</h1>${trackerDone()}</div>`;
// Audit L1: the pay card comes first in reading order; on a wide screen it
// sits in the right-hand column.
function summary(state, remind = false) {
  if (isPhone()) return site(`${heading()}${pay(state, remind)}${work()}${checks()}${yourNote()}`);
  return site(`${heading()}<div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="grid-column: 2; grid-row: 1; display: flex; flex-direction: column; gap: 16px">${pay(state, remind)}</div><div style="grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: 16px">${work()}${checks()}${yourNote()}</div></div>`);
}

// Paying online: the payment provider's own card form sits inside the page
// (no provider is chosen yet, so it's a placeholder). Audit H1: a card that
// fails says nothing was taken and offers the way on.
const centred = (inner) => site(`<div style="width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
const payOnline = (failed = false) => centred(`${heading()}${box(`Pay ${money(WORK_TOTAL_APPROVED)}`, `${note('For job WH-1042 at North Street Cycles, Bolton.')}
${failed ? `<p role="alert" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>The card didn’t go through.</strong> Nothing was taken. Try another card, or pay when you collect.</span></p>` : ''}
<div style="display: flex; align-items: center; justify-content: center; min-height: 150px; padding: 16px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center; font-size: 14px; color: ${C.muted}">[The payment provider’s secure card form]</div>
${button(failed ? 'Try again' : `Pay ${money(WORK_TOTAL_APPROVED)}`, { block: true })}
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Back to the summary</a>`)}`);
// Audit L1: the confirmation is the page's heading and is announced.
const paid = () => centred(`<div role="status" style="display: flex; flex-direction: column; gap: 16px">${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px"><span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 24)}</span>
<h1 style="margin: 0; font-size: 24px; font-weight: 700">Paid — thank you, Maya</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">${money(WORK_TOTAL_APPROVED)} paid for job ${mono('WH-1042')}. Your receipt is on its way by email.</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5">When you come in, just give your name — your Trek Domane AL 3 is ready to go.</p>${shopLines}</div>`)}</div>`);
// Audit H1: the link stays live for [n] days after collection, then says so.
const expired = () => centred(box('This link has expired', `<p style="margin: 0; font-size: 15px; line-height: 1.5">It was for job ${mono('WH-1042')}, which has been collected. If you need a copy of anything, get in touch.</p>${shopLines}`, 22));

// ---------- Settings › Workshop › Collection (decisions 3 and 4) ----------
// Audit M5: the hand-back switch says On or Off in words, the whole row is
// the control, and the day counts say what they count from.
const days = (id, label, hint) => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><label for="${id}" style="font-size: 15px; font-weight: 700">${label}</label><span style="font-size: 13px; color: ${C.muted}">${hint}</span></span><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px"><input id="${id}" inputmode="numeric" value="[n]" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">days</span></div>`;
const collectionOpen = () => `${days('rem-days', 'Remind the customer after', 'Counted from when the bike is marked ready · sends “Bike still waiting” — <a href="#" style="color: inherit">edit it in Messages</a>')}
${days('flag-days', 'Show it on Today after', 'Counted the same way, and longer than the reminder · for owners and managers')}
<div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 6px">${rowSwitch('Hand-back reminders', false)}
${note('When on, staff tick two things before Hand over, or at the till after paying: the bike went to the customer or someone they sent, and the lock key and rear light were returned. Off, collection is one tap.')}</div>`;

// ---------- Messages › "Bike still waiting" wording (audit M6) ----------
// Built from the "Bike ready" wording (Owner setup 23). Maya's figures fill
// the preview, as on the "Bike ready" board.
const waitingDialog = () => popup('wait-title', 'Bike still waiting', 'Sent when a ready bike isn’t collected after [n] days — set in Settings › Workshop › Collection', `
<p style="margin: 0; font-size: 15px">Sent the way each customer chose: text, WhatsApp or email.</p>
${wordingBox('wait-words', 'Hi [Customer’s first name], just a reminder that your [Bike] is ready to collect from [Shop name]. [Amount to pay] to pay on collection. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].', isPhone() ? 8 : 4)}
${bubble('Hi Maya, just a reminder that your Trek Domane AL 3 is ready to collect from North Street Cycles. £111.00 to pay on collection. See what we did: [link]. Job WH-1042. We’re open [opening hours].')}`, `${button('Go back to Wheelhouse’s wording', { variant: 'ghost' })}${button('Done')}`, 620);

def('cp-summary', () => summary('pay'));
def('cp-summary-deposit', () => summary('deposit'));
def('cp-pay', () => payOnline());
def('cp-pay-failed', () => payOnline(true));
def('cp-paid', () => paid());
def('cp-summary-paid', () => summary('paid'));
def('cp-summary-counter', () => summary('counter'));
def('cp-summary-inshop', () => summary('inshop'));
def('cp-expired', () => expired());
def('cp-ready-unpaid', () => diaryScreens['job-ready-unpaid'][SIZE]);
def('cp-ready-deposit', () => diaryScreens['job-ready-deposit'][SIZE]);
def('cp-till', () => tillScreens['till-job'][SIZE]);
def('cp-ready-paid', () => diaryScreens['job-collection'][SIZE]);
def('cp-ready-ticks', () => diaryScreens['job-collection-ticks'][SIZE]);
def('cp-collected', () => diaryScreens['job-collected'][SIZE]);
def('cp-today-uncollected', () => today({ uncollected: true }));
def('cp-setting', () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ collection: collectionOpen() })));
def('cp-messages', () => msgPage({ list: msgListOpen() }));
def('cp-message-wording', () => overlay(msgPage({ list: msgListOpen() }), waitingDialog()));

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'cp-summary': 'The “Bike ready” link: what we did, and Pay now',
  'cp-summary-deposit': 'The same link, after a deposit: only the rest to pay',
  'cp-pay': 'Pay online',
  'cp-pay-failed': 'Pay online: the card didn’t go through',
  'cp-paid': 'Paid — see you soon',
  'cp-summary-paid': 'The link opened again after paying',
  'cp-summary-counter': 'The link while it’s being paid at the counter',
  'cp-summary-inshop': 'The same link, for a shop without online payments',
  'cp-expired': 'The link, [n] days after collection',
  'cp-ready-unpaid': 'At the counter, not paid: Take payment',
  'cp-ready-deposit': 'At the counter, deposit paid: the rest to pay',
  'cp-till': 'The till: the job’s lines locked, collected when paid',
  'cp-ready-paid': 'At the counter, paid online: Hand over',
  'cp-ready-ticks': 'Hand over, with hand-back reminders switched on',
  'cp-collected': 'Collected, with Undo for a few minutes',
  'cp-today-uncollected': 'Today: a ready bike left too long',
  'cp-setting': 'Settings › Workshop › Collection: reminder, flag, hand-back',
  'cp-messages': 'Settings › Front desk › Messages: “Bike still waiting”',
  'cp-message-wording': '“Bike still waiting”: the wording',
};
export const ROWS = [
  { label: 'The customer’s link', screens: ['cp-summary', 'cp-summary-deposit', 'cp-pay', 'cp-pay-failed', 'cp-paid', 'cp-summary-paid', 'cp-summary-counter', 'cp-summary-inshop', 'cp-expired'] },
  { label: 'At the counter', screens: ['cp-ready-unpaid', 'cp-ready-deposit', 'cp-till', 'cp-ready-paid', 'cp-ready-ticks', 'cp-collected'] },
  { label: 'Not collected', screens: ['cp-today-uncollected'] },
  { label: 'Settings', screens: ['cp-setting', 'cp-messages', 'cp-message-wording'] },
];

// Account, history and reminders decision 2: the reminder tick, at collection.
export const summaryRemindAt = (size) => withSize(size, () => { const was = SIZE; SIZE = size; try { return summary('pay', true); } finally { SIZE = was; } });
