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
// well", Workshop day 21), Maya's booking note, North Street Cycles,
// Bolton. A deposit paid at booking is £[deposit], fixed when she booked
// (UX walk-through 1 M6). Anything else is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { settingsPage, rowSwitch, workshopFolds, WORKSHOP_INTRO, note, popup, overlay, withSize, isPhone, size, remindBox } from './settings-frame.mjs';
import { screens as diaryScreens, LINES_APPROVED, WORK_TOTAL_APPROVED, barcode128 } from './diary.mjs';
import { screens as tillScreens } from './till.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { CHECKLIST_10, CUSTOMER_NOTE } from './job-page.mjs';
import { today } from './opening.mjs';
import { chan, wordingBox, bubble, msgPage, msgListOpen } from './setup.mjs';
import { lightspeedShop, withLightspeedShop } from './shop-mode.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
let SIZE = 'desktop';

// ---------- The customer's page: the job summary (decision 2) ----------
// The shop's website frame, as journey B's customer pages use it.
const site = (content, active = 'Book a repair') => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', active, body) : SIZE === 'tablet' ? siteTablet('sand', body, active) : sitePhone('sand', { content: body });
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
// UX walk-through 1 L5: the checks not done are named.
const notDone = CHECKLIST_10.filter((c) => !c.checked);
const okMark = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: ${C.successInk}; white-space: nowrap">${icon('check', 14)}All working well</span>`;
const checks = () => box('Full service checklist', `<div role="list">${ticked.map((c) => row(esc(c.t), c.note ? `<span style="font-size: 14px; line-height: 1.45"><span style="font-weight: 600">What the mechanic found:</span> ${esc(c.note)}</span>` : '', c.note ? '' : okMark)).join('')}</div>
<p style="margin: 0; font-size: 14px; color: ${C.muted}">${ticked.length} of ${CHECKLIST_10.length} checks done.${notDone.length ? ` Not done: ${notDone.map((c) => esc(c.t)).join(', ')}.` : ''}</p>`);
const yourNote = () => box('What you told us', `<p style="margin: 0; font-size: 15px; line-height: 1.5">“${esc(CUSTOMER_NOTE)}”</p>`, 16);

// The pay card in each state (decision 2; audit H1, H2, H3).
// UX walk-through 1 M6: a deposit paid when booking was worked out on the
// price then and fixed, so here it's £[deposit] and the rest £[rest]. L2: a
// customer who said yes to reminders when booking sees that, not the box.
function pay(state, remind = false) {
  const due = WORK_TOTAL_APPROVED;
  const dueText = state === 'deposit' ? '£[rest]' : money(due);
  const depositLine = state === 'deposit' ? `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Deposit paid ${mono('£[deposit]')} · [date], when you booked</p>` : '';
  const remindHtml = remind === 'yes' ? `<p style="margin: 0; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5">You’ll get a reminder when the next service is due. <a href="#" style="color: ${C.ink}; font-weight: 600">Change</a></p>` : remind ? `<div style="padding-top: 8px; border-top: 1px solid ${C.border}">${remindBox(false, { collect: true })}</div>` : '';
  // UX walk-through 6 H1, M2, M6: a Lightspeed shop takes no money in
  // Wheelhouse (Lightspeed shops decision 9), so the one ready page has no
  // Pay now: it states the agreed price and tells Maya how the Lightspeed
  // till finds her job. Once Wheelhouse sees the work order paid, it says
  // so and nothing about a receipt — the receipt is the Lightspeed till's.
  if (lightspeedShop()) {
    if (state === 'paid') return box('Paid', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}Paid at the till · [date], [time]</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing more to pay.</p>${shopLines}`);
    return box('Pay when you collect', `<p style="margin: 0; font-size: 17px; line-height: 1.5">Agreed price ${mono(money(WORK_TOTAL_APPROVED), 'font-size: 22px; font-weight: 700')} — pay at the till</p>
${note(`When you come in, give your name or job number ${mono('WH-1042')}.`)}${remindHtml}${shopLines}${button('Add a note for the shop', { variant: 'default' })}`);
  }
  if (state === 'paid') return box('Paid', `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: ${C.successInk}">${icon('check', 18)}${money(WORK_TOTAL_APPROVED)} paid on [date]</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing more to pay. When you come in, just give your name.</p>${shopLines}`);
  if (state === 'counter') return box('To pay', `${mono(money(WORK_TOTAL_APPROVED), 'font-size: 30px')}
<p role="status" style="margin: 0; font-size: 15px; line-height: 1.5">This is being paid at the counter right now, so there’s nothing to pay here.</p>${shopLines}`);
  if (state === 'inshop') return box('To pay when you collect', `${mono(dueText, 'font-size: 30px')}
${note('Pay at the counter by card or cash. When you come in, just give your name.')}${shopLines}`);
  return box('To pay', `${mono(dueText, 'font-size: 30px')}${depositLine}
${button(`Pay ${dueText} now`, { block: true })}${note('Or pay when you collect — either is fine.')}${remindHtml}${shopLines}${button('Add a note for the shop', { variant: 'default' })}`);
}

// Drop off and approve the quote audit H4: the same page as the booking and
// the quote — the "Your booking" line and the tracker, now at Ready.
const STEPS = ['Booked', 'In the shop', 'Being worked on', 'Ready'];
const trackerDone = () => `<ol aria-label="Where your bike is" style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: ${isPhone() ? 8 : 16}px">${STEPS.map((t, i) => `<li${i === 3 ? ' aria-current="step"' : ''} style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: ${i === 3 ? 700 : 500}"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; ${i === 3 ? `background: ${C.ink}; color: #ffffff` : `background: ${C.okBg}; color: ${C.successInk}`}">${icon('check', 12)}</span>${t}</li>`).join('')}</ol>`;
const heading = () => `<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; color: ${C.muted}">Your repair · ${mono('WH-1042')}</span><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 30}px; font-weight: 700">Your Trek Domane AL 3 is ready</h1>${trackerDone()}</div>`;
// Audit L1: the pay card comes first in reading order; on a wide screen it
// sits in the right-hand column.
function summary(state, remind = true) {
  if (isPhone()) return site(`${heading()}${pay(state, remind)}${work()}${checks()}${yourNote()}`);
  return site(`${heading()}<div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="grid-column: 2; grid-row: 1; display: flex; flex-direction: column; gap: 16px">${pay(state, remind)}</div><div style="grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: 16px">${work()}${checks()}${yourNote()}</div></div>`);
}

// Paying online: the payment provider's own card form sits inside the page
// (no provider is chosen yet, so it's a placeholder). Audit H1: a card that
// fails says nothing was taken and offers the way on.
const centred = (inner) => site(`<div style="width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
// Walk-through 12 L7 (Jack, 3 Oct, answer 14): the same ways to pay as online
// checkout (Buy online 5), drawn as on-checkout draws them.
const wallets = `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">${['Apple Pay', 'Google Pay'].map((w) => `<button type="button" style="min-height: 48px; border-radius: 8px; border: 1px solid ${C.ink}; background: ${C.ink}; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 700">Pay with ${w}</button>`).join('')}</div>`;
const payOnline = (failed = false, balance = false) => { const amt = balance ? '£[rest]' : money(WORK_TOTAL_APPROVED); return centred(`${heading()}${box(`Pay ${amt}`, `${note('For your repair · WH-1042 at North Street Cycles, Bolton.')}
${failed ? `<p role="alert" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>The card didn’t go through.</strong> Nothing was taken. Try another card, or pay when you collect.</span></p>` : ''}
${wallets}<div style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: ${C.muted}"><span style="flex-grow: 1; height: 1px; background: ${C.border}"></span>or pay by card<span style="flex-grow: 1; height: 1px; background: ${C.border}"></span></div>
<div style="display: flex; align-items: center; justify-content: center; min-height: 150px; padding: 16px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center; font-size: 14px; color: ${C.muted}">[The payment provider’s secure card form]</div>
${balance ? `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Your ${mono('£[deposit]')} deposit is already taken off.</p>` : ''}${button(failed ? 'Try again' : `Pay ${amt}`, { block: true })}
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Back to the summary</a>`)}`); };
// Audit L1: the confirmation is the page's heading and is announced.
const paid = (balance = false) => centred(`<div role="status" style="display: flex; flex-direction: column; gap: 16px">${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px"><span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 24)}</span>
<h1 style="margin: 0; font-size: 24px; font-weight: 700">Paid — thank you, Maya</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">${balance ? `${mono('£[rest]')} paid for job ${mono('WH-1042')}, with your ${mono('£[deposit]')} deposit: ${money(WORK_TOTAL_APPROVED)} in all.` : `${money(WORK_TOTAL_APPROVED)} paid for job ${mono('WH-1042')}.`} Your receipt is on its way by email.</p>
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
// Built from the "Bike ready" wording (Owner setup 23). UX walk-through 1
// M8: what's left to pay fills in as paid for a paid job. Maya's figures fill
// the preview, as on the "Bike ready" board.
const waitingDialog = () => popup('wait-title', 'Bike still waiting', 'Sent when a ready bike isn’t collected after [n] days — set in Settings › Workshop › Collection', `
<p style="margin: 0; font-size: 15px">Sent the way each customer chose: text, WhatsApp or email.</p>
${wordingBox('wait-words', 'Hi [Customer’s first name], just a reminder that your [Bike] is ready to collect from [Shop name]. [What’s left to pay]. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].', isPhone() ? 8 : 4)}
${note('[What’s left to pay] reads “£111.00 to pay on collection”, or “Paid — nothing more to pay” once it’s paid.')}
${bubble('Hi Maya, just a reminder that your Trek Domane AL 3 is ready to collect from North Street Cycles. £111.00 to pay on collection. See what we did: [link]. Your repair · WH-1042. We’re open [opening hours].')}
${bubble('Hi Maya, just a reminder that your Trek Domane AL 3 is ready to collect from North Street Cycles. Paid — nothing more to pay. See what we did: [link]. Your repair · WH-1042. We’re open [opening hours].').replace('PREVIEW · TEXT TO MAYA PATEL', 'PREVIEW · ONCE IT’S PAID')}`, `${button('Go back to Wheelhouse’s wording', { variant: 'ghost' })}${button('Done')}`, 620);

def('cp-summary', () => summary('pay'));
def('cp-summary-deposit', () => summary('deposit'));
def('cp-summary-said-yes', () => summary('pay', 'yes'));
def('cp-pay', () => payOnline());
def('cp-pay-failed', () => payOnline(true));
def('cp-pay-balance', () => payOnline(false, true));
def('cp-paid', () => paid());
def('cp-paid-balance', () => paid(true));
def('cp-summary-paid', () => summary('paid'));
def('cp-summary-counter', () => summary('counter'));
def('cp-summary-inshop', () => summary('inshop'));
def('cp-expired', () => expired());
// UX walk-through 6 H1: the same page at a Lightspeed shop — no Pay now, no
// Basket in the header — before and after Maya pays at the Lightspeed till.
def('cp-summary-ls', () => withLightspeedShop(() => summary('pay')));
def('cp-summary-ls-paid', () => withLightspeedShop(() => summary('paid')));
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

// ---------- The receipt by email or text (leftover screens decisions 1–3, 2 Oct) ----------
// One receipt email for every sale; for a customer with a company name it
// is headed "VAT invoice" with their company details. A text is a short
// line with a link to the same receipt, no sign-in. With no customer on the
// sale, the address is for this receipt only unless "Save to a customer
// record" is ticked.
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
// Leftover audit L2: the first column is row headings, and the table is named.
const rkv = (k, v, strong = false) => `<tr style="border-top: 1px solid ${C.border}"><th scope="row" style="padding: 7px 0; text-align: left; font-weight: ${strong ? 700 : 400}">${k}</th><td style="padding: 7px 0; text-align: right${strong ? '; font-weight: 700' : ''}">${v}</td></tr>`;
const hidden = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap';
const qty = (n, each) => `<span style="display: block; font-size: 13px; color: ${C.muted}">${n} × ${mono(money(each))}</span>`;
// Audit M3: a till sale as well as a repair — the till's own example lines
// (journey 11: 2 × brake pads, fitting, a split of £20.00 cash); the
// discount and what follows from it are placeholders. One VAT row until the
// accountant says whether lines can have different rates.
const tillLines = () => `${rkv(`Shimano brake pads${qty(2, 28)}`, mono(money(56)))}${rkv('Fit &amp; adjust brakes', mono(money(18)))}${rkv('Discount · [reason]', mono('−£[amount]'))}${rkv('Total (includes VAT)', mono('£[total]'), true)}${rkv('VAT at [rate]', mono('£[VAT]'))}${rkv('Paid by cash', mono(money(20)))}${rkv('Paid by card · [card ending]', mono('£[rest]'))}`;
const repairLines = (deposit = false) => `${approved.map((l) => rkv(esc(l.work), mono(money(l.price)))).join('')}${rkv('Total (includes VAT)', mono(money(WORK_TOTAL_APPROVED)), true)}${rkv('VAT at [rate]', mono('£[VAT]'))}${deposit ? `${rkv('Deposit paid online · [date]', mono('£[deposit]'))}${rkv('Paid by card · [card ending]', mono('£[rest]'))}` : rkv('Paid by', 'Card · [card ending]')}`;
// Audit H2: the "Invoice to" block comes from the company's record (Add a
// customer gains "VAT number" and "Send invoices to"); a blank line is left out.
const receiptBody = ({ invoice = false, till = false, deposit = false } = {}) => `<div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap"><div style="display: flex; flex-direction: column; gap: 3px; font-size: 14px"><strong style="font-size: 16px">North Street Cycles</strong><span>[Shop address] · [shop phone]</span><span>VAT number [VAT number]</span></div><div style="display: flex; flex-direction: column; gap: 3px; align-items: ${isPhone() ? 'flex-start' : 'flex-end'}; font-size: 14px"><span>${invoice ? 'Invoice' : 'Receipt'} ${mono('B1-[0000]')}</span><span>[date] · [time]</span>${barcode128('B1-[0000]', 150, 30)}</div></div>
${invoice ? `<div style="padding: 10px 12px; border-radius: 6px; background: ${C.bg}; font-size: 14px; line-height: 1.5"><strong>Invoice to</strong><br>[Company name] · [Company address]<br>VAT number [Company VAT number]</div>` : ''}
<table style="width: 100%; border-collapse: collapse; font-size: 14px"><caption style="${hidden}">${invoice ? 'Items on this invoice' : 'Items on this receipt'}</caption><thead><tr style="text-align: left; font-size: 12px; color: ${C.muted}"><th scope="col" style="padding: 6px 0; font-weight: 600">${till ? 'Till sale' : `${mono('WH-1042')} · Trek Domane AL 3`}</th><th scope="col" style="padding: 6px 0; text-align: right; font-weight: 600">Price</th></tr></thead><tbody>${till ? tillLines() : repairLines(deposit)}</tbody></table>`;
// Audit H1: with no customer on the sale there's no account to see, so that
// email has no account button and its returns line uses the receipt itself.
// L1: in an email the button is a real link.
const receiptEmail = ({ invoice = false, guest = false, till = false, deposit = false } = {}) => {
  const [W, H] = DIMS[SIZE];
  const P = isPhone();
  const to = invoice ? '[accounts email]' : guest ? '[email address]' : 'maya@example.test';
  const foot = guest
    ? `<p style="margin: 0; font-size: 14px">Questions? Call [shop phone].</p><p style="margin: 0; font-size: 13px; color: ${C.muted}">Keep this for returns. Show this email or give the receipt number.</p>`
    : `${button('See it in your account', { variant: 'default', href: '#' })}<p style="margin: 0; font-size: 13px; color: ${C.muted}">Keep this for returns — or just give your name in the shop.</p>`;
  return `<div style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: ${P ? 12 : 40}px; display: flex; justify-content: center; align-items: flex-start; background: ${C.bg}; overflow: hidden"><article aria-label="${guest ? 'Email to [email address]' : invoice ? 'Email to [Company name]' : 'Email to Maya Patel'}" style="width: ${P ? '100%' : '620px'}; box-sizing: border-box; padding: ${P ? 18 : 28}px; background: #ffffff; border: 1px solid ${C.border}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px; font-size: 15px; line-height: 1.5; color: ${C.ink}"><span style="font-size: 13px; color: ${C.muted}">From North Street Cycles · to ${to}</span><h1 style="margin: 0; font-size: 22px">${invoice ? 'VAT invoice' : 'Your receipt'}</h1>${receiptBody({ invoice, till, deposit })}${foot}</article></div>`;
};
// Audit L3, M11: no website tab is marked, the buttons sit by the heading so
// nothing is cut off, the download says what the file is, and the heading
// follows the email (a company's link opens its VAT invoice).
const receiptText = ({ invoice = false } = {}) => site(`<div style="width: 100%; max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${bubble(`North Street Cycles: your receipt for ${money(WORK_TOTAL_APPROVED)} — [link]`).replace('PREVIEW · TEXT TO MAYA PATEL', 'THE TEXT MAYA GETS')}<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px"><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">${invoice ? 'VAT invoice' : 'Your receipt'}</h1><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Download receipt (PDF)', { variant: 'default' })}${button('Email it to me', { variant: 'default' })}</div></div>${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 12px">${receiptBody({ invoice })}</div>`)}</div>`, null);
// "Email it to me" on the receipt page: one box, like the till's.
const emailBox = (id, label, { type = 'email', value = '', error = '' } = {}) => {
  const tel = type === 'tel';
  return `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><input id="${id}" type="${type}" autocomplete="${tel ? 'tel' : 'email'}" inputmode="${tel ? 'tel' : 'email'}" enterkeyhint="send" autofocus${value ? ` value="${value}"` : ''}${tel ? '' : ' placeholder="name@example.com"'}${error ? ` aria-invalid="true" aria-describedby="${id}-err"` : ''} style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: ${error ? 2 : 1}px solid ${error ? C.dangerInk : C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">${error ? `<p id="${id}-err" style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: ${C.dangerInk}">${icon('alert', 16)}${error}</p>` : ''}</div>`;
};
const receiptTextEmail = () => overlay(receiptText(), popup('rte-title', 'Email the receipt', 'We’ll send this receipt to your email', `${emailBox('rte-email', 'Email address')}${note('Used for this receipt only.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Send')}`, 480));
// Audit L6: the tick's line says what leaving it unticked does.
const tick = (t, what = 'address') => `<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox" style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${t}</span><span style="font-size: 13px; color: ${C.muted}">Leave this unticked and we’ll use the ${what} for this receipt only.</span></span></label>`;
// Audit M1: pressing Email or Text pauses the till's next-sale countdown;
// the cursor starts in the box and Enter sends. M2: the states around it.
const paidPaused = () => tillScreens['till-receipt'][SIZE].replace('<p role="timer"', '<p role="status"').replace('Next sale starts in 5 seconds', 'Next sale waits until the receipt is sent');
const offlineBar = `<p role="status" style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; font-weight: 600; line-height: 1.45">${icon('wifi', 16)}The till is offline. The receipt will send when the till is back online.</p>`;
const receiptAddress = ({ mode = 'email', error = false, customer = false, offline = false } = {}) => {
  const text = mode === 'text';
  const sub = `Receipt ${mono('B1-[0000]')} · ${customer ? 'Maya Patel' : 'no customer on this sale'}`;
  const box = text
    ? emailBox('ra-phone', 'Mobile number', { type: 'tel' })
    : emailBox('ra-email', 'Email address', customer ? { value: 'maya@example.test' } : error ? { value: '[typed address]', error: 'That doesn’t look like an email address — check it' } : {});
  const after = customer ? note('From Maya’s customer record. A change here is used for this receipt only.') : tick('Save to a customer record', text ? 'number' : 'address');
  return overlay(paidPaused(), popup('ra-title', text ? 'Text the receipt' : 'Email the receipt', sub, `${offline ? offlineBar : ''}${box}${after}`, `${button('Cancel', { variant: 'ghost' })}${button(offline ? 'Send when back online' : 'Send receipt')}`, 520));
};
// Ticked: the receipt goes first, then a quick Add a customer with the
// address filled in; "Not now" keeps the receipt sent and adds no one.
const receiptSave = () => overlay(paidPaused(), popup('rs-title', 'Add a customer', `Receipt sent to [email address]`, `${emailBox('rs-name', 'Name').replace('type="email" autocomplete="email" inputmode="email" enterkeyhint="send"', 'type="text" autocomplete="name"').replace(' placeholder="name@example.com"', ' placeholder="First and last name"')}${emailBox('rs-email', 'Email', { value: '[email address]' }).replace(' autofocus', '')}${emailBox('rs-phone', 'Phone (optional)', { type: 'tel' }).replace(' autofocus', '')}<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span><span style="font-size: 13px; color: ${C.muted}">Only if they say yes. Off to start.</span></span><input type="checkbox" aria-label="Happy to hear about offers" style="width: 20px; height: 20px; accent-color: ${C.ink}"></div>${note('“Not now” keeps the receipt sent and adds no one.')}`, `${button('Not now', { variant: 'ghost' })}${button('Add the customer')}`, 560));
def('cp-receipt-email', () => receiptEmail());
def('cp-receipt-email-guest', () => receiptEmail({ guest: true }));
def('cp-invoice-email', () => receiptEmail({ invoice: true }));
def('cp-receipt-email-deposit', () => receiptEmail({ deposit: true }));
def('cp-receipt-email-till', () => receiptEmail({ guest: true, till: true }));
def('cp-receipt-text', () => receiptText());
def('cp-receipt-text-email', () => receiptTextEmail());
def('cp-receipt-address', () => receiptAddress());
def('cp-receipt-address-error', () => receiptAddress({ error: true }));
def('cp-receipt-address-save', () => receiptSave());
def('cp-receipt-address-text', () => receiptAddress({ mode: 'text' }));
def('cp-receipt-address-customer', () => receiptAddress({ customer: true }));
def('cp-receipt-address-offline', () => receiptAddress({ offline: true }));

const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'cp-summary': 'The “Bike ready” link: what we did, and Pay now',
  'cp-summary-said-yes': 'Said yes to reminders when booking: not asked again',
  'cp-summary-deposit': 'The same link, after a deposit: only the rest to pay',
  'cp-pay': 'Pay online',
  'cp-pay-failed': 'Pay online: the card didn’t go through',
  'cp-pay-balance': 'Pay online after a deposit: only the rest',
  'cp-paid-balance': 'Paid after a deposit',
  'cp-paid': 'Paid — see you soon',
  'cp-summary-paid': 'The link opened again after paying',
  'cp-summary-counter': 'The link while it’s being paid at the counter',
  'cp-summary-inshop': 'The same link, for a shop without online payments',
  'cp-expired': 'The link, [n] days after collection',
  'cp-summary-ls': 'A Lightspeed shop: the agreed price, pay at the till',
  'cp-summary-ls-paid': 'A Lightspeed shop: paid at the till',
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
  'cp-receipt-email': 'The receipt email',
  'cp-invoice-email': 'For a business: headed “VAT invoice”',
  'cp-receipt-text': 'A text receipt: a link to the same receipt',
  'cp-receipt-email-guest': 'No customer on the sale: the email without an account',
  'cp-receipt-email-till': 'A till sale: quantities, a discount, a split payment',
  'cp-receipt-email-deposit': 'After a deposit: the deposit and the rest as two payments',
  'cp-receipt-text-email': 'The receipt page: Email it to me',
  'cp-receipt-address': 'No customer on the sale: this receipt only',
  'cp-receipt-address-error': 'The address doesn’t look right',
  'cp-receipt-address-save': 'Ticked: the receipt goes, then Add a customer',
  'cp-receipt-address-text': 'Text the receipt: a mobile number',
  'cp-receipt-address-customer': 'A customer on the sale: their address filled in',
  'cp-receipt-address-offline': 'The till is offline: it sends when back online',
};
export const ROWS = [
  { label: 'The customer’s link', screens: ['cp-summary', 'cp-summary-said-yes', 'cp-summary-deposit', 'cp-pay', 'cp-pay-failed', 'cp-pay-balance', 'cp-paid', 'cp-paid-balance', 'cp-summary-paid', 'cp-summary-counter', 'cp-summary-inshop', 'cp-expired'] },
  // UX walk-through 6 H1.
  { label: 'A Lightspeed shop', screens: ['cp-summary-ls', 'cp-summary-ls-paid'] },
  { label: 'At the counter', screens: ['cp-ready-unpaid', 'cp-ready-deposit', 'cp-till', 'cp-ready-paid', 'cp-ready-ticks', 'cp-collected'] },
  { label: 'Not collected', screens: ['cp-today-uncollected'] },
  { label: 'Settings', screens: ['cp-setting', 'cp-messages', 'cp-message-wording'] },
  { label: 'The receipt', screens: ['cp-receipt-email', 'cp-receipt-email-guest', 'cp-invoice-email', 'cp-receipt-email-till', 'cp-receipt-email-deposit', 'cp-receipt-text', 'cp-receipt-text-email', 'cp-receipt-address', 'cp-receipt-address-error', 'cp-receipt-address-save', 'cp-receipt-address-text', 'cp-receipt-address-customer', 'cp-receipt-address-offline'] },
];

// Account, history and reminders decision 2: the reminder tick, at collection.
// UX walk-through 1 L3: the account opens the same receipt as the email and
// the text link.
export const receiptBodyAt = (size, opts = {}) => withSize(size, () => { const was = SIZE; SIZE = size; try { return receiptBody(opts); } finally { SIZE = was; } });
export const summaryRemindAt = (size) => withSize(size, () => { const was = SIZE; SIZE = size; try { return summary('pay', true); } finally { SIZE = was; } });
// UX walk-through 6 H1: the one ready page at a Lightspeed shop, for
// journey 21's ls-customer-ready.
export const summaryLsAt = (size, { paid = false } = {}) => withSize(size, () => { const was = SIZE; SIZE = size; try { return withLightspeedShop(() => summary(paid ? 'paid' : 'pay')); } finally { SIZE = was; } });
