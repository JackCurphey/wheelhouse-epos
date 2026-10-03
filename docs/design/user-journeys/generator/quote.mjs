// Journey 4 — Drop off and approve the quote, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-drop-off-and-quote-review.md
// UI audit: docs/design/user-journeys/quote-ui-audit.md (decision 7: every
// recommendation taken)
//
// Decision 1: one page per job, from the booking link to "Ready to collect".
// 2: a quote answered with ticks set the way the mechanic recommends, pairs
// ticking together, one button. 3: photos on each line. 4: a reminder, then
// "No answer yet" for staff, who can record a phone answer. 5: sending is one
// click, then Undo. 6: a four-step tracker with the expected ready time.
//
// Real example data only: Maya Patel, WH-1042, Trek Domane AL 3, the job's
// lines and prices (Standard service £65, Shimano brake pads B05S-RX £28
// "Rear pads worn — replacing", Fit & adjust brakes £18, Replace gear cable
// £12, cable still serviceable; £111.00 approved, £123.00 if all), the
// mechanic's note, Alex Morgan, Jo Taylor, booked in Thu 17 Sep at [time]
// (walk-through 8 decisions, 3 Oct: walk-through 1 L3 replaces 09:12),
// ready by Thu 17 Sep, the delayed pads moved to Sat 19 Sep 16:00, North
// Street Cycles, Bolton. Anything else is a bracketed placeholder. UX
// walk-through 1 H1: Maya asked at booking to be asked before any extra
// work (Drop off and approve the quote, 3 Oct: "Ask me", not "Call me"),
// so her quote is sent (Workshop day 43: under a limit, no quote is
// sent). The within-limit path is drawn for a customer with a £200 limit.
import { C, MONO, esc, icon, button, card, badge } from './ui.mjs';
import { popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { STAFF_NOTE_BRAKES } from './job-page.mjs';
import { quoteJobBoards, screens as diaryScreens, diaryWithJobState } from './diary.mjs';
import { today } from './opening.mjs';
import { msgPage, msgListOpen } from './setup.mjs';
import { screens as collectScreens } from './collect.mjs';
import { withLightspeedShop } from './shop-mode.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
// Walk-through 12 M5: the quote's badges at the page's body size (15px).
const bigBadge = (t, tone) => badge(t, tone).replace('font-size: 12px', 'font-size: 15px');
const VH = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0';
const hidden = (t) => `<span style="${VH}">${t}</span>`;
let SIZE = 'desktop';

// ---------- The job's page (decision 1) ----------
const site = (content, bar = '') => {
  const scroll = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  const body = bar ? `<div style="flex-grow: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px">${scroll}${bar}</div>` : scroll;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Book a repair', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Book a repair') : sitePhone('sand', { content: body });
};
const shopLines = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>[Shop address] · [shop phone]</span></div>`;
const cardBox = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 22}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, extra);
const h2 = (t, id, focus = false) => `<h2 id="${id}"${focus ? ' tabindex="-1"' : ''} style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const page = (inner, { width = 720, bar = '' } = {}) => site(`<div style="width: 100%; max-width: ${width}px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px"><div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; color: ${C.muted}">Your repair · ${mono('WH-1042')}</span><h1 tabindex="-1" style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Trek Domane AL 3 · Standard service</h1></div>${inner}</div>`, bar);
const note = (t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">${t}</p>`;

// Decision 6: Booked → In the shop → Being worked on → Ready. Audit L4: the
// circles are one size; audit M4: the current step is announced once.
const STEPS = ['Booked', 'In the shop', 'Being worked on', 'Ready'];
function tracker(at, { sub = '', warn = '' } = {}) {
  const dot = (i) => {
    const done = i < at, now = i === at;
    return `<li style="display: flex; flex-direction: ${isPhone() ? 'row' : 'column'}; align-items: ${isPhone() ? 'center' : 'flex-start'}; gap: 8px; flex: 1 1 0; min-width: 0"${now ? ' aria-current="step"' : ''}><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; box-sizing: border-box; flex-shrink: 0; border-radius: 999px; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : now ? `background: ${C.ink}; color: #ffffff` : `border: 1px solid ${C.border}; color: ${C.muted}`}; font-size: 13px; font-weight: 700">${done ? icon('check', 14) : i + 1}</span><span style="font-size: 14px; font-weight: ${now ? 700 : 500}; color: ${done || now ? C.ink : C.muted}">${STEPS[i]}${done ? hidden(', done') : now ? '' : hidden(', to come')}</span></li>`;
  };
  return cardBox(`<h2 id="where" style="margin: 0; font-size: 18px; font-weight: 700">Where your bike is</h2>
<ol aria-labelledby="where" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: ${isPhone() ? 10 : 12}px">${STEPS.map((_, i) => dot(i)).join('')}</ol>
${warn ? `<p role="status" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>${warn}</span></p>` : ''}
${sub ? `<p style="margin: 0; font-size: 15px; line-height: 1.5">${sub}</p>` : ''}`);
}
const kv = (k, v, extra = '') => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px; ${extra}"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
// Audit H3: a deposit paid at booking carries through, in journey 5's words.
const depositRows = (total) => `${kv('Deposit paid', mono('£[deposit]'))}${kv('Still to pay when you collect', mono(total === null ? '£[balance]' : '£[balance]'))}`;
// The work agreed so far (decision 6).
const agreed = (rows, total, { deposit = false } = {}) => cardBox(`<h2 id="agreed" style="margin: 0; font-size: 18px; font-weight: 700">Work agreed</h2><div aria-labelledby="agreed">${rows}${kv(`<strong style="color: ${C.ink}">Total</strong>`, mono(total, 'font-size: 17px'))}${deposit ? depositRows(total) : ''}</div>
<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add a note for the shop', { variant: 'default' })}</div>${shopLines}`);
const SERVICE_ROW = kv('Standard service', mono('£65.00'));
const readyLine = `Expected ready: <strong>Thu 17 Sep</strong>, [time].`;

// ---------- The quote (decisions 2 and 3; audit H1, H2, M2–M4, L1–L3) ----------
// The new lines; the reason is the line's note on the job page (audit M2),
// and staff set which line goes with which.
const NEW_LINES = [
  { id: 'pads', work: 'Shimano brake pads', reason: 'Rear pads worn — replacing', price: 28, need: 'Needed', photo: true, without: '[What happens without it, in Alex’s words]' },
  { id: 'fit', work: 'Fit & adjust brakes', reason: 'Goes together with the new pads', price: 18, need: 'Needed', pair: 'pads' },
  { id: 'cable', work: 'Replace gear cable', reason: 'Cable still serviceable', price: 12, need: 'Optional' },
];
// Audit L2: the photo shows it can be enlarged.
const photoThumb = (big = false) => `<button type="button" aria-label="Photo of Shimano brake pads: rear pads worn — open larger photo" style="position: relative; flex-shrink: 0; width: ${big ? '100%' : '96px'}; height: ${big ? 360 : 72}px; display: flex; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box; border-radius: 8px; border: 1px dashed ${C.input}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 12px; text-align: center">[Photo of the worn rear pads]${big ? '' : `<span aria-hidden="true" style="position: absolute; right: 4px; bottom: 4px; display: inline-flex; padding: 3px; border-radius: 6px; background: ${C.ink}; color: #ffffff">${icon('search', 12)}</span>`}</button>`;
// Audit M4: the price is part of the tick box's label.
const quoteLine = (l, on) => `<li style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-top: 1px solid ${C.border}"><div style="display: flex; gap: 12px; align-items: flex-start">
<label style="display: flex; gap: 12px; align-items: flex-start; flex-grow: 1; min-width: 0; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; flex-shrink: 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex-grow: 1"><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 16px; font-weight: 700">${l.work}</span>${bigBadge(l.need, l.need === 'Needed' ? 'amber' : 'grey')}<span style="margin-left: auto">${mono(money(l.price), 'font-size: 16px')}</span></span><span style="font-size: 14px; line-height: 1.45">${l.reason}</span></span></label>
${l.photo ? `<span style="display: flex; flex-direction: column; align-items: center; gap: 2px">${photoThumb()}<span style="font-size: 12px; color: ${C.muted}">Tap to enlarge</span></span>` : ''}</div>
${!on && l.need === 'Needed' && l.without ? `<p style="margin: 0 0 0 34px; padding: 8px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; line-height: 1.45"><strong>Alex recommends this.</strong> ${l.without}</p>` : ''}</li>`;
const quoteSums = ({ ticks = { pads: true, fit: true, cable: false }, newer = false } = {}) => {
  const newOnes = NEW_LINES.filter((l) => ticks[l.id]);
  const total = 65 + newOnes.reduce((a, l) => a + l.price, 0);
  return { total, totalText: newer ? '£[total]' : money(total), label: newer ? 'Approve £[total]' : newOnes.length ? `Approve ${money(total)}` : 'Decline the extra work' };
};
// Decision 8: on tablet and phone the quote is longer than the screen, so the
// new total, the final-answer line and the button sit in a bar pinned below.
const quoteBar = (opts = {}) => {
  const { totalText, label } = quoteSums(opts);
  // UX walk-through 6 M4: a price that went up has two answers, both in the bar.
  if (opts.priceUp) return `<div aria-live="polite" style="flex-shrink: 0; box-sizing: border-box; width: 100%; max-width: 720px; margin: 0 auto; padding: 10px 14px; border-radius: 10px; border: 2px solid ${C.ink}; background: ${C.panel}; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px">New total <strong>${mono('£[new total]', 'font-size: 17px')}</strong></span><span style="font-size: 13px; font-weight: 600">Your answer is final once sent.</span></span><span style="display: flex; flex-wrap: wrap; gap: 8px; ${isPhone() ? 'width: 100%' : ''}">${button('Approve £[new total]', { block: isPhone() })}${button('No thanks — keep to £111.00', { variant: 'default', block: isPhone() })}</span></div>`;
  return `<div aria-live="polite" style="flex-shrink: 0; box-sizing: border-box; width: 100%; max-width: 720px; margin: 0 auto; padding: 10px 14px; border-radius: 10px; border: 2px solid ${C.ink}; background: ${C.panel}; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px">New total <strong>${mono(totalText, 'font-size: 17px')}</strong>${opts.deposit ? ` <span style="font-size: 13px; color: ${C.muted}">· deposit £[deposit] paid</span>` : ''}</span><span style="font-size: 15px; font-weight: 600">Your answers are final once sent.</span></span>${button(label, { block: isPhone() })}</div>`;
};
function quoteCard({ ticks = { pads: true, fit: true, cable: false }, newer = false, deposit = false, reminded = false, priceUp = false } = {}) {
  const { total, label } = quoteSums({ ticks, newer });
  const inCard = SIZE === 'desktop';
  // Audit M3: facts only — when it was sent, and any reminder.
  const sentLine = `<p style="margin: 0; font-size: 14px; color: ${C.muted}">Sent Thu 17 Sep, [time]${reminded ? ' · we sent a reminder at [time]' : ''}</p>`;
  // UX walk-through 6 M4: at a Lightspeed shop a part's price changed after
  // Maya approved it ("Ask Maya again", journey 21). The page says what went
  // up and by how much, and her two answers: the new total, or keep to the
  // price she agreed. Nothing was added.
  if (priceUp) return cardBox(`${badge('A price has changed', 'purple')}${h2('A price has gone up since you agreed', 'q')}${sentLine}
<p style="margin: 0; font-size: 15px; line-height: 1.5">You agreed to new brake pads at ${mono('£28.00')}. That price has gone up, so we’re asking before we charge you more.</p>
<div aria-labelledby="q">${kv('Shimano brake pads', `${hidden('was ')}${mono('£28.00', `text-decoration: line-through; color: ${C.muted}`)}<span aria-hidden="true"> → </span>${hidden(', now ')}${mono('£[new price]')}`)}${kv('You agreed', mono('£111.00'))}</div>
<div aria-live="polite" style="display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid ${C.border}">${kv(`<strong style="color: ${C.ink}">New total</strong>`, mono('£[new total]', 'font-size: 18px'), 'border-top: 0; padding-top: 0')}</div>
${inCard ? `<p style="margin: 0; font-size: 14px; font-weight: 600">Your answer is final once sent.</p>` : ''}
${note('Prices include VAT. Nothing to pay today.')}
${inCard ? `<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end">${button('No thanks — keep to £111.00', { variant: 'default' })}${button('Approve £[new total]')}</div>` : ''}
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 14px">Not sure? Call ${mono('[shop phone]')}, or</span>${button('Add a note for the shop', { variant: 'default' })}</div>`, `border: 2px solid ${C.ink}`);
  return cardBox(`${bigBadge(newer ? 'The quote has changed' : 'Waiting for your answer', 'purple')}${h2(newer ? 'Alex has added to the quote' : 'Alex recommends more work', 'q')}${sentLine}
<p style="margin: 0; font-size: 15px; line-height: 1.5">${newer ? 'Your earlier answers are kept. Please answer the new line below.' : `“${STAFF_NOTE_BRAKES}” — Alex Morgan, your mechanic`}</p>
${newer ? `<div>${kv('Already agreed', `Standard service, brake pads, fitting · ${mono('£111.00')}`)}${kv('You said no thanks', 'Replace gear cable')}</div>` : ''}
<p style="margin: 0; font-size: 15px; font-weight: 600">Untick anything you don’t want.</p>
<ul aria-labelledby="q" style="list-style: none; margin: 0; padding: 0">${newer ? `<li style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid ${C.border}"><label style="display: flex; gap: 12px; align-items: flex-start; flex-grow: 1; min-height: 44px"><input type="checkbox" checked style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 16px; font-weight: 700">[New line]</span>${bigBadge('Needed', 'amber')}<span style="margin-left: auto">${mono('£[price]', 'font-size: 16px')}</span></span><span style="font-size: 14px">[The mechanic’s reason]</span></span></label></li>` : NEW_LINES.map((l) => quoteLine(l, ticks[l.id])).join('')}</ul>
${newer ? '' : `<div>${kv('Already agreed', `Standard service · ${mono('£65.00')}`)}</div>`}
<div aria-live="polite" style="display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid ${C.border}">${kv(`<strong style="color: ${C.ink}">New total</strong>`, mono(newer ? '£[total]' : money(total), 'font-size: 18px'), 'border-top: 0; padding-top: 0')}${deposit ? depositRows(total) : ''}${ticks.pads === false ? hidden('Fit & adjust brakes unticked too.') : ''}</div>
${inCard ? `<p style="margin: 0; font-size: 15px; font-weight: 600">Your answers are final once sent.</p>` : ''}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px">${note(deposit ? 'Prices include VAT. Nothing to pay today — the rest is due when you collect.' : 'Prices include VAT. Nothing to pay today.')}${inCard ? button(label) : ''}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 14px">Not sure? Call ${mono('[shop phone]')}, or</span>${button('Add a note for the shop', { variant: 'default' })}</div>`, `border: 2px solid ${C.ink}`);
}
const quotePage = (opts = {}) => page(`${quoteCard(opts)}${tracker(1, { sub: `The rest of the service is going ahead. ${readyLine}` })}`, { bar: SIZE === 'desktop' ? '' : quoteBar(opts) });
// Decision 3: a photo, enlarged.
const photoDialog = () => popup('photo-title', 'Shimano brake pads', 'Rear pads worn — replacing', photoThumb(true), button('Close', { variant: 'default' }), 720);
// Answered (audit H1: all declined has its own words; L1: "No thanks").
const noThanks = (work, price) => kv(`<span style="color: ${C.muted}">${work} · no thanks</span>`, mono(price, `text-decoration: line-through; color: ${C.muted}`));
const DONE_ROWS = `${SERVICE_ROW}${kv('Shimano brake pads', mono('£28.00'))}${kv('Fit & adjust brakes', mono('£18.00'))}${noThanks('Replace gear cable', '£12.00')}`;
const DECLINED_ROWS = `${SERVICE_ROW}${noThanks('Shimano brake pads', '£28.00')}${noThanks('Fit & adjust brakes', '£18.00')}${noThanks('Replace gear cable', '£12.00')}`;
// UX walk-through 6 M4: Maya said no to the higher price; the price she
// agreed stands while the shop decides what to do next.
const priceNo = () => page(`<div role="status">${badge('Answered', 'green')}</div>${cardBox(`${h2('Thanks, Maya — you said no to the new price', 'ans', true)}<p style="margin: 0; font-size: 15px; line-height: 1.5">You said no to ${mono('£[new price]')} for the Shimano brake pads. Your agreed price stays ${mono('£111.00')}. The shop will let you know what happens next. Call ${mono('[shop phone]')} if you have a question.</p>`)}${tracker(2, { sub: readyLine })}${agreed(DONE_ROWS, '£111.00')}`);
const answered = ({ byPhone = false, declined = false, deposit = false } = {}) => page(`<div role="status">${badge('Answered', 'green')}</div>${cardBox(`${h2(byPhone ? 'Your answers, from your call' : declined ? 'Thanks, Maya — Alex will carry on with the service' : 'Thanks, Maya — Alex is carrying on', 'ans', true)}<p style="margin: 0; font-size: 15px; line-height: 1.5">${byPhone ? 'You answered by phone with Jo Taylor at [time]. Here’s what was agreed.' : declined ? 'You didn’t add any extra work. We’ve saved your answers.' : 'We’ve saved your answers. The work you agreed is going ahead.'}</p>`)}${tracker(2, { sub: readyLine })}${agreed(declined ? DECLINED_ROWS : DONE_ROWS, declined ? '£65.00' : '£111.00', { deposit })}`);
// Decision 6: the tracker on its own, at each stage.
const inShop = (extra = '') => page(`${tracker(1, { sub: `We’ve got your bike — booked in Thu 17 Sep at [time]. ${readyLine}` })}${extra}${agreed(SERVICE_ROW, '£65.00')}`);
// Account, history and reminders decision 3: the job's page with its conversation.
export const inShopAt = (size, extra = '') => withSize(size, () => { const was = SIZE; SIZE = size; try { return inShop(typeof extra === 'function' ? extra() : extra); } finally { SIZE = was; } });
const waitingPart = () => page(`${tracker(2, { warn: '<strong>Waiting for a part — we’ll update you.</strong> Your new brake pads are taking longer to arrive.', sub: `Expected ready: <strong>Sat 19 Sep</strong>, ${mono('16:00')}.` })}${agreed(DONE_ROWS, '£111.00')}`);
// Audit M3: a withdrawn quote, on the customer's page.
const withdrawn = () => page(`${cardBox(`${badge('Quote withdrawn', 'grey')}${h2('Alex has withdrawn this quote', 'wd')}<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing to answer. Call ${mono('[shop phone]')} if you have a question.</p>`)}${tracker(1, { sub: readyLine })}${agreed(SERVICE_ROW, '£65.00')}`);

// ---------- The shop's side (decisions 4 and 5) ----------
// Audit M3/L4: the Undo bar says it's still sending, for how long, and sits
// above the footer bar.
const withToast = (base, [W, H]) => `<div style="position: relative; width: ${W}px; height: ${H}px; overflow: hidden">${base}<div role="status" style="position: absolute; left: 50%; bottom: ${isPhone() ? 150 : 96}px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; max-width: calc(100% - 32px); box-sizing: border-box; padding: 10px 12px 10px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 15px; box-shadow: 0 8px 24px rgba(0,0,0,0.25)"><span>Sending the quote to Maya by text in 1 minute</span><button type="button" style="min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">Undo</button><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; color: #ffffff; font-size: 14px; font-weight: 600">See what Maya sees</a></div></div>`;
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
// Decision 4 with audit M5: the recommended ticks, and a save button that
// reads back what will be saved.
const recordDialog = () => popup('record-title', 'Record Maya’s answer', 'Quote for WH-1042 · answered by phone', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Tick what Maya agreed to on the phone. These answers are final once saved, as if answered online.</p>
<div role="group" aria-label="What Maya agreed to">${NEW_LINES.map((l) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid ${C.border}; font-size: 15px"><input type="checkbox"${l.id !== 'cable' ? ' checked' : ''} style="width: 22px; height: 22px; accent-color: ${C.ink}"><span style="flex-grow: 1"><strong>${l.work}</strong> <span style="color: ${C.muted}">· ${l.need}</span></span>${mono(money(l.price))}</label>`).join('')}</div>
${kv(`<strong style="color: ${C.ink}">New total</strong>`, mono('£111.00', 'font-size: 17px'))}
${note('Saved as answered by phone, taken by Jo Taylor at [time]. Maya gets a text — the way Maya chose — with what was agreed.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save: yes to 2 lines, no thanks to 1')}`, 560);
const withdrawDialog = () => popup('withdraw-title', 'Withdraw this quote?', 'WH-1042 · Maya Patel', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Maya’s page will say the quote was withdrawn and there’s nothing to answer. Only the booked Standard service stays agreed.</p>`, `${button('Keep the quote', { variant: 'ghost' })}${button('Withdraw quote', { variant: 'danger' })}`, 520);

// ---------- The boards ----------
def('dq-in-shop', () => inShop());
def('dq-waiting-part', () => waitingPart());
def('dq-ready', () => collectScreens['cp-summary'][SIZE]);
def('dq-quote', () => quotePage());
def('dq-quote-photo', () => overlay(quotePage(), photoDialog()));
def('dq-quote-untick', () => quotePage({ ticks: { pads: true, fit: true, cable: true } }));
def('dq-quote-decline', () => quotePage({ ticks: { pads: false, fit: false, cable: false } }));
def('dq-quote-deposit', () => quotePage({ deposit: true }));
def('dq-quote-reminded', () => quotePage({ reminded: true }));
def('dq-answered', () => answered());
def('dq-answered-declined', () => answered({ declined: true }));
def('dq-answered-deposit', () => answered({ deposit: true }));
def('dq-answered-by-phone', () => answered({ byPhone: true }));
def('dq-quote-newer', () => page(`${quoteCard({ newer: true })}${tracker(2, { sub: readyLine })}`, { bar: SIZE === 'desktop' ? '' : quoteBar({ newer: true }) }));
def('dq-withdrawn', () => withdrawn());
// UX walk-through 6 H1: Maya's quote at a Lightspeed shop — the same words
// ("Nothing to pay today" is already true), no Basket in the header.
def('dq-quote-ls', () => withLightspeedShop(() => quotePage()));
// UX walk-through 6 M4: a price went up after Maya agreed, and her "no".
def('dq-quote-price-ls', () => withLightspeedShop(() => page(`${quoteCard({ priceUp: true })}${tracker(2, { sub: readyLine })}`, { bar: SIZE === 'desktop' ? '' : quoteBar({ priceUp: true }) })));
def('dq-answered-price-no-ls', () => withLightspeedShop(() => priceNo()));
def('dq-job-quote', () => quoteJobBoards('build')[SIZE]);
def('dq-job-sent', () => withToast(quoteJobBoards('sent')[SIZE], DIMS[SIZE]));
def('dq-today-no-answer', () => today({ noAnswer: true }));
def('dq-record-answer', () => overlay(quoteJobBoards('sent')[SIZE], recordDialog()));
def('dq-job-withdraw', () => overlay(quoteJobBoards('sent')[SIZE], withdrawDialog()));
def('dq-job-answered', () => quoteJobBoards('answered')[SIZE]);
// UX walk-through 1 M3: the diary shows the job waiting for Maya's answer.
def('dq-diary-waiting', () => diaryWithJobState('WH-1042', 'answer')[SIZE]);
// H1: a £200 limit and work within it — no quote; the customer is told.
def('dq-job-within', () => quoteJobBoards('within')[SIZE]);
const WITHIN_ROWS = `${SERVICE_ROW}${kv('Shimano brake pads', mono('£28.00'))}${kv('Fit & adjust brakes', mono('£18.00'))}${kv('Replace gear cable', mono('£12.00'))}`;
def('dq-within-limit', () => page(`${cardBox(`<div role="status">${badge('Work added', 'green')}</div>${h2('Alex added some work, within your limit', 'wl', true)}<p style="margin: 0; font-size: 15px; line-height: 1.5">Brake pads, fitting and a gear cable, ${mono('£58.00')} — within your ${mono('£200')} limit, so we’ve gone ahead. Nothing to pay today.</p><p style="margin: 0; font-size: 15px; line-height: 1.5">Not what you wanted? Call ${mono('[shop phone]')}.</p>`)}${agreed(WITHIN_ROWS, money(123))}${tracker(2, { sub: readyLine })}`));
def('dq-job-waiting', () => diaryScreens['job-waiting-parts'][SIZE]);
def('dq-messages', () => msgPage({ list: msgListOpen() }));

const SIZES = ['desktop', 'tablet', 'phone']; // decision 8
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'dq-in-shop': 'The job’s page once the bike is in: where it is, when it’s ready',
  'dq-waiting-part': 'Waiting for a part',
  'dq-ready': 'Ready to collect (journey 5): the same page, at Ready',
  'dq-quote': 'A quote to answer: ticked the way the mechanic recommends',
  'dq-quote-photo': 'A line’s photo, enlarged',
  'dq-quote-untick': 'Ticking the optional line: the total follows',
  'dq-quote-decline': 'Unticking the needed pair: what happens without it',
  'dq-quote-deposit': 'A quote after a deposit: still to pay',
  'dq-quote-reminded': 'After the reminder: when it was sent, and reminded',
  'dq-answered': 'Answered: the work carries on',
  'dq-answered-declined': 'Answered no thanks to all of it',
  'dq-answered-deposit': 'Answered, with the deposit taken off',
  'dq-answered-by-phone': 'Answered by phone, recorded by the shop',
  'dq-quote-newer': 'The quote has changed: earlier answers kept',
  'dq-withdrawn': 'The shop withdrew the quote',
  'dq-quote-ls': 'A Lightspeed shop: the quote, no deposit, no Basket',
  'dq-quote-price-ls': 'A Lightspeed shop: a price has gone up since you agreed',
  'dq-answered-price-no-ls': 'A Lightspeed shop: no thanks to the new price',
  'dq-job-quote': 'Job page: each new line Needed or Optional, its reason, a photo, what it goes with',
  'dq-job-sent': 'Sending the quote, with Undo for a minute',
  'dq-today-no-answer': 'Today: no answer to a quote',
  'dq-record-answer': 'Record their answer, from a phone call',
  'dq-job-withdraw': 'Withdraw the quote',
  'dq-job-answered': 'The job page once answered: approved and declined',
  'dq-diary-waiting': 'The diary: the job waiting for the customer’s answer',
  'dq-job-within': 'A £200 limit, and the work within it: no quote',
  'dq-within-limit': 'Within the limit: told what was added',
  'dq-job-waiting': 'The job page: waiting for a part (Workshop day)',
  'dq-messages': 'Settings › Front desk › Messages: the quote and its reminder',
};
export const ROWS = [
  { label: 'While the bike is in', screens: ['dq-in-shop', 'dq-waiting-part', 'dq-ready'] },
  { label: 'The quote', screens: ['dq-quote', 'dq-quote-photo', 'dq-quote-untick', 'dq-quote-decline', 'dq-quote-deposit', 'dq-quote-reminded', 'dq-quote-newer', 'dq-withdrawn', 'dq-within-limit'] },
  { label: 'Answered', screens: ['dq-answered', 'dq-answered-declined', 'dq-answered-deposit', 'dq-answered-by-phone'] },
  // UX walk-through 6 H1 and M4.
  { label: 'A Lightspeed shop', screens: ['dq-quote-ls', 'dq-quote-price-ls', 'dq-answered-price-no-ls'] },
  { label: 'The shop’s side', screens: ['dq-job-quote', 'dq-job-sent', 'dq-diary-waiting', 'dq-today-no-answer', 'dq-record-answer', 'dq-job-withdraw', 'dq-job-answered', 'dq-job-within', 'dq-job-waiting', 'dq-messages'] },
];
