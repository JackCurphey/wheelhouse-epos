// Journey 4 — Drop off and approve the quote, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-drop-off-and-quote-review.md
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
// £12 "Optional · cable still serviceable"; £111.00 approved, £123.00 if all),
// the mechanic's note, Alex Morgan, Jo Taylor, booked in Thu 17 Sep at 09:12,
// ready by Thu 17 Sep, the delayed pads moved to Sat 19 Sep 16:00, North
// Street Cycles, Bolton. Anything else is a bracketed placeholder. As on the
// diary's own quote board, this example has no spending limit set (Workshop
// day 43: under a limit, no quote is sent).
import { C, MONO, esc, icon, button, card, badge } from './ui.mjs';
import { popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { STAFF_NOTE_BRAKES } from './job-page.mjs';
import { quoteJobBoards } from './diary.mjs';
import { today } from './opening.mjs';
import { msgPage, msgListOpen } from './setup.mjs';
import { screens as collectScreens } from './collect.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
const VH = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0';
let SIZE = 'desktop';

// ---------- The job's page (decision 1) ----------
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Book a repair', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Book a repair') : sitePhone('sand', { content: body });
};
const shopLines = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>24 North Street · [shop phone]</span></div>`;
const cardBox = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 22}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, extra);
const h2 = (t, id) => `<h2 id="${id}" style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const page = (inner, { width = 720 } = {}) => site(`<div style="width: 100%; max-width: ${width}px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px"><div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; color: ${C.muted}">Your booking · ${mono('WH-1042')}</span><h1 tabindex="-1" style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Trek Domane AL 3 · Standard service</h1></div>${inner}</div>`);

// Decision 6: Booked → In the shop → Being worked on → Ready.
const STEPS = ['Booked', 'In the shop', 'Being worked on', 'Ready'];
function tracker(at, { sub = '', warn = '' } = {}) {
  const dot = (i) => {
    const done = i < at, now = i === at;
    return `<li style="display: flex; flex-direction: ${isPhone() ? 'row' : 'column'}; align-items: ${isPhone() ? 'center' : 'flex-start'}; gap: 8px; flex: 1 1 0; min-width: 0"${now ? ' aria-current="step"' : ''}><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : now ? `background: ${C.ink}; color: #ffffff` : `border: 1px solid ${C.border}; color: ${C.muted}`}; font-size: 13px; font-weight: 700">${done ? icon('check', 14) : i + 1}</span><span style="font-size: 14px; font-weight: ${now ? 700 : 500}; color: ${done || now ? C.ink : C.muted}">${STEPS[i]}<span style="${VH}">${done ? ', done' : now ? ', now' : ', to come'}</span></span></li>`;
  };
  return cardBox(`<h2 id="where" style="margin: 0; font-size: 18px; font-weight: 700">Where your bike is</h2>
<ol aria-labelledby="where" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: ${isPhone() ? 10 : 12}px">${STEPS.map((_, i) => dot(i)).join('')}</ol>
${warn ? `<p role="status" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>${warn}</span></p>` : ''}
${sub ? `<p style="margin: 0; font-size: 15px; line-height: 1.5">${sub}</p>` : ''}`);
}
const kv = (k, v, extra = '') => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px; ${extra}"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
// The work agreed so far (decision 6).
const agreed = (rows, total) => cardBox(`<h2 id="agreed" style="margin: 0; font-size: 18px; font-weight: 700">Work agreed</h2><div aria-labelledby="agreed">${rows}${kv('<strong style="color: ' + C.ink + '">Total</strong>', mono(total, 'font-size: 17px'))}</div>
<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Add a note for the shop', { variant: 'default' })}</div>${shopLines}`);
const SERVICE_ROW = kv('Standard service', mono('£65.00'));
const readyLine = `Expected ready: <strong>Thu 17 Sep</strong>, [time].`;

// ---------- The quote (decisions 2 and 3) ----------
// The new lines. Pads and fitting go together (decision 2).
const NEW_LINES = [
  { id: 'pads', work: 'Shimano brake pads', sub: 'Part · B05S-RX', reason: 'Rear pads worn — replacing', price: 28, need: 'Needed', pair: true, photo: true },
  { id: 'fit', work: 'Fit & adjust brakes', sub: 'Labour · 30 min', reason: 'Goes with the new pads', price: 18, need: 'Needed', pair: true },
  { id: 'cable', work: 'Replace gear cable', sub: 'Optional', reason: 'Cable still serviceable', price: 12, need: 'Optional' },
];
const photoThumb = (l, big = false) => `<button type="button" aria-label="Photo: ${esc(l.reason.toLowerCase())} — tap to enlarge" style="flex-shrink: 0; width: ${big ? '100%' : '96px'}; height: ${big ? 360 : 72}px; display: flex; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box; border-radius: 8px; border: 1px dashed ${C.input}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 12px; text-align: center">[Photo of the worn rear pads]</button>`;
const quoteLine = (l, on) => `<li style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid ${C.border}">
<label style="display: flex; gap: 12px; align-items: flex-start; flex-grow: 1; min-width: 0; min-height: 44px; cursor: pointer"><input type="checkbox"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; flex-shrink: 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span style="font-size: 16px; font-weight: 700">${l.work}</span>${badge(l.need, l.need === 'Needed' ? 'amber' : 'grey')}</span><span style="font-size: 14px; line-height: 1.45">${l.reason}${l.pair ? ` <span style="color: ${C.muted}">· goes together with ${l.id === 'pads' ? 'fitting' : 'the pads'}</span>` : ''}</span></span></label>
${l.photo ? photoThumb(l) : ''}${mono(money(l.price), 'flex-shrink: 0; font-size: 16px; padding-top: 2px')}</li>`;
function quoteCard({ ticks = { pads: true, fit: true, cable: false }, newer = false } = {}) {
  const total = 65 + NEW_LINES.filter((l) => ticks[l.id]).reduce((a, l) => a + l.price, 0);
  return cardBox(`${badge(newer ? 'The quote has changed' : 'Waiting for your answer', 'purple')}${h2(newer ? 'Alex has added to the quote' : 'Alex found more to do', 'q')}
<p style="margin: 0; font-size: 15px; line-height: 1.5">${newer ? 'Your earlier answers are kept. Please answer the new line below.' : `“${STAFF_NOTE_BRAKES}” — Alex Morgan, your mechanic`}</p>
${newer ? `<div>${kv('Already agreed', 'Standard service, brake pads, fitting · ' + mono('£111.00'))}${kv('You said not now', 'Replace gear cable')}</div>` : ''}
<ul aria-labelledby="q" style="list-style: none; margin: 0; padding: 0">${newer ? `<li style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid ${C.border}"><label style="display: flex; gap: 12px; align-items: flex-start; flex-grow: 1; min-height: 44px"><input type="checkbox" checked style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 16px; font-weight: 700">[New line]</span>${badge('Needed', 'amber')}</span><span style="font-size: 14px">[The mechanic’s reason]</span></span></label>${mono('£[price]', 'font-size: 16px')}</li>` : NEW_LINES.map((l) => quoteLine(l, ticks[l.id])).join('')}</ul>
${newer ? '' : `<div>${kv('Already agreed', 'Standard service · ' + mono('£65.00'))}</div>`}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="font-size: 15px">New total <strong>${mono(newer ? '£[total]' : money(total), 'font-size: 18px')}</strong></span>${button(newer ? 'Approve £[total]' : `Approve ${money(total)}`)}</div>
<p style="margin: 0; font-size: 13px; line-height: 1.45; color: ${C.muted}">Untick anything you don’t want. Prices include VAT; nothing is paid now.</p>`, `border: 2px solid ${C.ink}`);
}
const quotePage = (opts = {}) => page(`${quoteCard(opts)}${tracker(1, { sub: `The rest of the service is going ahead. ${readyLine}` })}`);
// Decision 2: before sending, say the answers are final.
const confirmDialog = () => popup('confirm-title', 'Send your answers?', 'Trek Domane AL 3 · WH-1042', `<div>${kv('Yes', 'Shimano brake pads, Fit & adjust brakes')}${kv('Not now', 'Replace gear cable')}${kv('<strong style="color: ' + C.ink + '">New total</strong>', mono('£111.00', 'font-size: 17px'))}</div>
<p style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>You can’t change these answers afterwards — call us on [shop phone] if you change your mind.</span></p>`, `${button('Go back', { variant: 'ghost' })}${button('Send my answers')}`, 520);
// Decision 3: a photo, enlarged.
const photoDialog = () => popup('photo-title', 'Shimano brake pads', 'Rear pads worn — replacing', photoThumb(NEW_LINES[0], true), button('Close', { variant: 'default' }), 720);
// Answered: the job carries on.
const DONE_ROWS = `${SERVICE_ROW}${kv('Shimano brake pads', mono('£28.00'))}${kv('Fit & adjust brakes', mono('£18.00'))}${kv(`<span style="color: ${C.muted}">Replace gear cable · not now</span>`, mono('£12.00', `text-decoration: line-through; color: ${C.muted}`))}`;
const answered = (byPhone = false) => page(`<div role="status">${cardBox(`${badge('Answered', 'green')}${h2(byPhone ? 'Your answers, from your call' : 'Thanks, Maya — Alex is carrying on', 'ans')}<p style="margin: 0; font-size: 15px; line-height: 1.5">${byPhone ? 'You answered by phone with Jo Taylor at [time]. Here’s what was agreed.' : 'We’ve saved your answers. The work you agreed is going ahead.'}</p>`)}</div>${tracker(2, { sub: readyLine })}${agreed(DONE_ROWS, '£111.00')}`);
// Decision 6: the tracker on its own, at each stage.
const inShop = () => page(`${tracker(1, { sub: `We’ve got your bike — booked in Thu 17 Sep at ${mono('09:12')}. ${readyLine}` })}${agreed(SERVICE_ROW, '£65.00')}`);
const waitingPart = () => page(`${tracker(2, { warn: '<strong>Waiting for a part — we’ll update you.</strong> Your new brake pads are taking longer to arrive.', sub: `Expected ready: <strong>Sat 19 Sep</strong>, ${mono('16:00')}.` })}${agreed(DONE_ROWS, '£111.00')}`);

// ---------- The shop's side (decisions 4 and 5) ----------
// The sent board carries the Undo bar for a minute (decision 5).
const withToast = (base, [W, H]) => `<div style="position: relative; width: ${W}px; height: ${H}px; overflow: hidden">${base}<div role="status" style="position: absolute; left: 50%; bottom: ${isPhone() ? 96 : 28}px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; max-width: calc(100% - 32px); box-sizing: border-box; padding: 10px 12px 10px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 15px; box-shadow: 0 8px 24px rgba(0,0,0,0.25)"><span>Quote sent to Maya by text</span><button type="button" style="min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">Undo</button><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; color: #ffffff; font-size: 14px; font-weight: 600">See what Maya sees</a></div></div>`;
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
// Decision 4: staff record an answer given on the phone.
const recordDialog = () => popup('record-title', 'Record Maya’s answer', 'Quote for WH-1042 · answered by phone', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Tick what Maya agreed to on the phone. Her answers are final once saved, as if she’d answered online.</p>
<div role="group" aria-label="What Maya agreed to">${NEW_LINES.map((l) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid ${C.border}; font-size: 15px"><input type="checkbox"${l.id !== 'cable' ? ' checked' : ''} style="width: 22px; height: 22px; accent-color: ${C.ink}"><span style="flex-grow: 1"><strong>${l.work}</strong> <span style="color: ${C.muted}">· ${l.need}</span></span>${mono(money(l.price))}</label>`).join('')}</div>
${kv('<strong style="color: ' + C.ink + '">New total</strong>', mono('£111.00', 'font-size: 17px'))}
<p style="margin: 0; font-size: 14px; color: ${C.muted}">Saved as answered by phone, taken by Jo Taylor at [time]. Maya gets a text with what was agreed.</p>`, `${button('Cancel', { variant: 'ghost' })}${button('Save her answer')}`, 560);

// ---------- The boards ----------
def('dq-in-shop', () => inShop());
def('dq-quote', () => quotePage());
def('dq-quote-photo', () => overlay(quotePage(), photoDialog()));
def('dq-quote-untick', () => quotePage({ ticks: { pads: true, fit: true, cable: true } }));
def('dq-quote-confirm', () => overlay(quotePage(), confirmDialog()));
def('dq-answered', () => answered());
def('dq-answered-phone', () => answered(true));
def('dq-quote-newer', () => page(`${quoteCard({ newer: true })}${tracker(2, { sub: readyLine })}`));
def('dq-waiting-part', () => waitingPart());
def('dq-ready', () => collectScreens['cp-summary'][SIZE]);
def('dq-job-quote', () => quoteJobBoards()[SIZE]);
def('dq-job-sent', () => withToast(quoteJobBoards(true)[SIZE], DIMS[SIZE]));
def('dq-today-no-answer', () => today({ noAnswer: true }));
def('dq-record-answer', () => overlay(quoteJobBoards(true)[SIZE], recordDialog()));
def('dq-messages', () => msgPage({ list: msgListOpen() }));

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'dq-in-shop': 'The job’s page once the bike is in: where it is, when it’s ready',
  'dq-quote': 'A quote to answer: ticked the way the mechanic recommends',
  'dq-quote-photo': 'A line’s photo, enlarged',
  'dq-quote-untick': 'Ticking the optional line: the total follows',
  'dq-quote-confirm': 'Send your answers? They’re final',
  'dq-answered': 'Answered: the work carries on',
  'dq-answered-phone': 'Answered by phone, recorded by the shop',
  'dq-quote-newer': 'The quote has changed: earlier answers kept',
  'dq-waiting-part': 'Waiting for a part',
  'dq-ready': 'Ready to collect (journey 5)',
  'dq-job-quote': 'Job page: each new line Needed or Optional, with a photo',
  'dq-job-sent': 'Quote sent, with Undo',
  'dq-today-no-answer': 'Today: no answer to a quote',
  'dq-record-answer': 'Record their answer, from a phone call',
  'dq-messages': 'Settings › Front desk › Messages: the quote and its reminder',
};
export const ROWS = [
  { label: 'While the bike is in', screens: ['dq-in-shop', 'dq-waiting-part', 'dq-ready'] },
  { label: 'The quote', screens: ['dq-quote', 'dq-quote-photo', 'dq-quote-untick', 'dq-quote-confirm', 'dq-answered', 'dq-answered-phone', 'dq-quote-newer'] },
  { label: 'The shop’s side', screens: ['dq-job-quote', 'dq-job-sent', 'dq-today-no-answer', 'dq-record-answer', 'dq-messages'] },
];
