// Journey 3 — Book a repair, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-book-a-repair-review.md
// UI audit: docs/design/user-journeys/book-ui-audit.md (decision 12: every
// recommendation taken)
//
// Decision 1: the whole /book flow redrawn on the shop's website (its theme),
// keeping the agreed steps and rules. Decision 2: one page, one step at a
// time — an answered step closes to a line with Change — and "Your booking"
// down the side. Decisions 3–4: an optional deposit with a refund cut-off.
// 5: every service at once. 6: signing in offered, never required. 7: a
// two-week strip of days with Earliest first. 8: requests, or confirmed at
// once (a shop setting). 9: nothing typed is lost. 10: change or cancel on
// the booking's own page. 11: Settings › Workshop › Online booking.
//
// Real example data only: Release 1's booking fixture (Maya Patel, Trek
// Domane AL 3 · green · black mudguards, her note, Standard service £65 /
// 60 min, Thursday 17 September, drop-off 09:00–18:00, the appointment
// times, 07700 900 142, maya@example.test), Oliver Chen's Brompton C Line
// "not sure" fixture, the diary's services and people, North Street Cycles,
// Bolton, and Workshop day 41's "up to £200". Anything else is a bracketed
// placeholder.
import { C, MONO, esc, icon, button, card, badge } from './ui.mjs';
import { settingsPage, rowSwitch, workshopFolds, WORKSHOP_INTRO, note, popup, overlay, withSize, isPhone, remindBox } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { CUSTOMER_NOTE } from './job-page.mjs';
import { requestDepositBoard } from './diary.mjs';
import { msgPage, msgListOpen } from './setup.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
// Audit L6: one visually hidden style (clipped, not moved off the page).
const VH = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0';
const hidden = (t) => `<span style="${VH}">${t}</span>`;

// ---------- Example data (Release 1's booking fixture) ----------
const MAYA = { name: 'Maya Patel', first: 'Maya', phone: '07700 900 142', email: 'maya@example.test' };
const BIKE = 'Trek Domane AL 3';
const BIKE_DETAIL = 'Green · black mudguards';
const DAY = 'Thursday 17 September';
const DAY_SHORT = 'Thu 17 Sep';
const TIMES = [['09:30', false], ['10:00', true], ['10:30', false], ['11:00', true], ['11:30', true], ['12:00', false], ['14:00', false], ['14:30', true], ['15:00', true]];
// Audit L2: one money style everywhere (pounds and pence).
const FULL = [{ name: 'Standard service', what: 'Safety check, gears, brakes and tune-up', time: '60 min', price: '£65.00' },
  { name: '[Full service]', what: '[What’s included]', time: '[time]', price: '£[price]' },
  { name: '[Full service]', what: '[What’s included]', time: '[time]', price: '£[price]' }];
const SINGLE = [['Brake service', '45 min'], ['Gear adjustment', '60 min'], ['Safety check', '60 min']];
const LIMIT = 'OK if the whole bill is up to £200';
const CUTOFF = '[date and time]';

// ---------- The page frame (decision 2) ----------
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Book a repair', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Book a repair') : sitePhone('sand', { content: body });
};
const link = (t, extra = '') => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}; ${extra}">${t}</a>`;
// Decision 6: signing in is offered at the top, never required.
const signLine = (signedIn) => signedIn
  ? `<p style="margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px">${icon('user', 16)}Signed in as <strong>${MAYA.name}</strong> ${link('Not you?')}</p>`
  : `<p style="margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; color: ${C.muted}">Booked with us before? ${link('Sign in to use your saved bikes and details')}</p>`;
const title = (signedIn = false) => `<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 2px"><h1 style="margin: 0; font-size: ${isPhone() ? 26 : 30}px; font-weight: 700">Book a repair</h1>${signLine(signedIn)}</div>`;

// A choice of one: a real radio group (audit M3); arrow keys move within it.
const radios = (label, inner, style = 'display: flex; flex-wrap: wrap; gap: 8px') => `<div role="radiogroup" aria-label="${label}" style="${style}">${inner}</div>`;
const rpill = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.input}; background: ${on ? C.ink : C.panel}; color: ${on ? '#ffffff' : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600; white-space: nowrap">${t}</button>`;

// A step: done (a line with Change), open (its questions), or still to come.
// Audit M3: each reads "Step n of 4"; after Next, focus moves to the new
// step's heading (tabindex -1). Audit L7: an answered step is labelled with
// what it holds, not the question.
const STEPS = ['What does your bike need?', 'Your bike', 'When?', 'Your details'];
const NOUNS = ['Service', 'Bike', 'When', 'Your details'];
const num = (n, state) => `<span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; font-size: 14px; font-weight: 700; ${state === 'done' ? `background: ${C.okBg}; color: ${C.successInk}` : state === 'open' ? `background: ${C.ink}; color: #ffffff` : `border: 1px solid ${C.border}; color: ${C.muted}`}">${state === 'done' ? icon('check', 14) : n}</span>`;
const stepDone = (n, summary) => card(`<div style="padding: 12px 18px; display: flex; align-items: center; gap: 12px"><h2 style="margin: 0; display: flex; align-items: center; gap: 12px; flex-grow: 1; min-width: 0; font-size: 15px; font-weight: 400">${num(n, 'done')}<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 13px; color: ${C.muted}">${hidden(`Step ${n} of 4, done: `)}${NOUNS[n - 1]}</span><span style="font-weight: 600">${summary}</span></span></h2>${link(`Change${hidden(` ${NOUNS[n - 1].toLowerCase()}`)}`)}</div>`, 'flex-shrink: 0');
const stepOpen = (n, body, heading = STEPS[n - 1]) => `<section aria-labelledby="step-${n}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 12px"><h2 id="step-${n}" tabindex="-1" style="margin: 0; display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700">${num(n, 'open')}${hidden(`Step ${n} of 4: `)}${heading}</h2>${body}</div>`, `border: 2px solid ${C.ink}`)}</section>`;
// The steps still to come share one quiet line under the open step.
const stepsLater = (from) => (from > 4 ? '' : `<div style="flex-shrink: 0; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 4px 18px; font-size: 15px; color: ${C.muted}"><span>Then:</span>${[1, 2, 3, 4].filter((n) => n >= from).map((n) => `<span style="display: inline-flex; align-items: center; gap: 8px">${num(n, 'later')}${STEPS[n - 1]}</span>`).join('')}</div>`);
const steps = (open, doneLines, openBody, openHeading) => [1, 2, 3, 4].filter((n) => n <= open).map((n) => (n < open ? stepDone(n, doneLines[n - 1]) : stepOpen(n, openBody, openHeading))).join('') + stepsLater(open + 1);
const next = (t) => `<div style="display: flex; justify-content: flex-end">${button(t)}</div>`;

// "Your booking" (decision 2): fills in as the customer goes. Audit L2:
// empty rows say so in words; a deposit shop shows the deposit from the
// start; a drop-off booking shows its window and mechanic. Audit M2: the
// extra-work row and the footnote agree.
function summaryBox({ service = null, price = null, bike = null, when = null, mechanic = null, deposit = null, limit = null } = {}) {
  const empty = `<span style="font-weight: 400; color: ${C.muted}">Not chosen yet</span>`;
  const r = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 14px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v ?? empty}</span></div>`;
  const priceVal = price === 'agree' ? `<span style="font-size: 14px; font-weight: 600; text-align: right">Agreed with you first</span>` : price ? mono(price, 'font-size: 20px') : empty;
  const dep = deposit === 'later'
    ? `<div style="display: flex; justify-content: space-between; font-size: 14px"><span>Deposit, paid at the last step</span>${mono('£[deposit]')}</div>`
    : deposit === 'now' ? `<div style="display: flex; justify-content: space-between; font-size: 14px"><span>Deposit to pay now</span>${mono('£[deposit]')}</div>` : '';
  const depNote = deposit ? `<p style="margin: 4px 0 0; font-size: 13px; line-height: 1.45; color: ${C.muted}">Free to cancel until ${CUTOFF}. If the shop can’t fit you in, the deposit comes back in full.</p>` : '';
  // Decision 2: on a phone the summary is a bar along the bottom, opening
  // to the same box.
  if (isPhone()) return `<aside aria-label="Your booking" style="flex-shrink: 0"><button type="button" aria-expanded="false" style="display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; box-sizing: border-box; padding: 8px 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0"><span style="font-size: 14px; font-weight: 700">Your booking</span><span style="font-size: 13px; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${[service, when].filter(Boolean).join(' · ') || 'Not chosen yet'}${deposit ? ' · deposit £[deposit]' : ''}</span></span>${price === 'agree' ? `<span style="font-size: 13px; font-weight: 600">Price agreed first</span>` : price ? mono(price, 'font-size: 17px') : ''}<span style="display: inline-flex; transform: rotate(180deg)">${icon('chevron', 16)}</span></button></aside>`;
  return `<aside aria-label="Your booking" style="flex-shrink: 0">${card(`<div style="padding: 18px; display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0 0 6px; font-size: 18px; font-weight: 700">Your booking</h2>
${r('Service', service)}${r('Bike', bike)}${r('When', when)}${mechanic ? r('Mechanic', mechanic) : ''}${limit === 'call' ? r('Extra work', 'We’ll call you first') : limit ? r('Extra work', LIMIT) : ''}
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0 4px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Price</span>${priceVal}</div>
${dep}${depNote}
<p style="margin: 6px 0 0; font-size: 13px; line-height: 1.45; color: ${C.muted}">Prices include VAT. ${limit && limit !== 'call' ? 'Anything above your limit is agreed with you first.' : 'Any extra work is agreed with you first.'}</p></div>`)}</aside>`;
}
// Two columns on a wide screen: the steps, and Your booking beside them,
// staying in view as the page scrolls. A board past the first step shows
// the page scrolled to the open step (its bottom in view), as the customer
// would see it; the answered steps above have scrolled up.
const layout = (left, right, signedIn = false, { top = false } = {}) => isPhone()
  ? site(`<div style="flex-grow: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px"><div style="flex-grow: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: ${top ? 'flex-start' : 'flex-end'}; gap: 12px">${title(signedIn)}${left}</div>${right}</div>`)
  : site(`<div style="flex-grow: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start"><div style="height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: ${top ? 'flex-start' : 'flex-end'}; gap: 12px; min-width: 0">${title(signedIn)}${left}</div><div style="display: flex; flex-direction: column; gap: 12px">${right}</div></div>`);

// ---------- Step 1: every service at once (decision 5) ----------
const fullCard = (s, chosen) => `<button type="button" role="radio" aria-checked="${chosen}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${chosen ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${chosen ? C.hover : C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="font-size: 16px; font-weight: 700">${s.name}</span><span style="font-size: 13px; line-height: 1.4; color: ${C.muted}">${s.what}</span><span style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 4px"><span style="display: inline-flex; align-items: baseline; gap: 8px">${mono(s.price, 'font-size: 16px')}<span style="font-size: 13px; color: ${C.muted}">${s.time}</span></span>${chosen ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700">${icon('check', 14)}Chosen</span>` : ''}</span></button>`;
const tick = (label, sub, price, on = false) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 2px 0; border-top: 1px solid ${C.border}; font-size: 15px"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; accent-color: ${C.ink}"><span style="flex-grow: 1"><span style="font-weight: 600">${label}</span> <span style="font-size: 13px; color: ${C.muted}">· ${sub}</span></span>${mono(price, 'font-size: 15px')}</label>`;
const notSure = (on = false) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px dashed ${C.input}`}; background: ${on ? C.hover : 'transparent'}; color: ${C.ink}; font-family: inherit; text-align: left; font-size: 15px"><span aria-hidden="true" style="display: inline-flex; width: 32px; height: 32px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 999px; background: ${C.mutedBg}; font-weight: 700">?</span><span><strong>Not sure what’s wrong?</strong> <span style="color: ${C.muted}">Describe it and we’ll take a look.</span></span></button>`;
function serviceStep({ chosen = 0, many = false } = {}) {
  const cols = isPhone() ? 1 : 3;
  const singles = many
    ? `<label style="display: flex; align-items: center; gap: 8px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: #ffffff; color: ${C.muted}">${icon('search', 16)}<input type="search" aria-label="Search the individual services" placeholder="Search [n] individual services — like “brakes” or “puncture”" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
<div role="group" aria-label="Individual services">${SINGLE.map(([n, t]) => tick(n, t, '£[price]')).join('')}${tick('[Individual service]', '[time]', '£[price]')}</div>${link('Show all [n] individual services')}`
    : `<div role="group" aria-label="Individual services">${SINGLE.map(([n, t]) => tick(n, t, '£[price]')).join('')}</div>`;
  return `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Full services</span>${radios('Full services', FULL.map((s, i) => fullCard(s, i === chosen)).join(''), `display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 10px`)}</div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Or just one job — tick any you need</span>${singles}</div>
${notSure()}
${next('Next: your bike')}`;
}
const DONE_SERVICE = 'Standard service · £65.00';

// ---------- Step 2: the bike and the problem (decision 6) ----------
// Audit L6: hints are tied to their fields; audit M4: browser fill-in.
let FID = 0;
function bfield(label, { value = '', placeholder = '', type = 'text', auto = '', hint = '' } = {}) {
  const id = `bf-${++FID}`;
  return `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><input id="${id}" type="${type}"${auto ? ` autocomplete="${auto}"` : ''}${hint ? ` aria-describedby="${id}-h"` : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" style="width: 100%; box-sizing: border-box; min-height: 44px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; padding: 0 12px; font-family: inherit; font-size: 15px; color: ${C.ink}">${hint ? `<span id="${id}-h" style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</div>`;
}
const textarea = (label, value, hint = '', rows = 3) => { const id = `bt-${++FID}`; return `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><textarea id="${id}" rows="${rows}"${hint ? ` aria-describedby="${id}-h"` : ''} style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; padding: 10px 12px; font-family: inherit; font-size: 15px; line-height: 1.45; color: ${C.ink}; resize: vertical">${esc(value)}</textarea>${hint ? `<span id="${id}-h" style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</div>`; };
const photos = () => `<button type="button" style="display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px dashed ${C.input}; background: transparent; color: ${C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${icon('plus', 16)}Add photos or a short video <span style="font-weight: 400; color: ${C.muted}">· optional</span></button>`;
// Workshop day 41: the customer can name how much the whole bill may come to.
const limit = (set = true) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="padding: 0 0 6px; font-size: 14px; font-weight: 600">If the mechanic finds more to do</legend>
<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px"><input type="radio" name="limit"${set ? '' : ' checked'} style="width: 20px; height: 20px; accent-color: ${C.ink}">Call me before any extra work</label>
<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; flex-wrap: wrap; font-size: 15px"><input type="radio" name="limit"${set ? ' checked' : ''} style="width: 20px; height: 20px; accent-color: ${C.ink}">Go ahead if the whole bill comes to no more than <span style="display: inline-flex; align-items: center; gap: 4px">£<input aria-label="Most the whole bill can come to, in pounds" inputmode="numeric" value="200" style="width: 72px; min-height: 44px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></span></label></fieldset>`;
const twoCol = (a, b) => `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '1fr 1fr'}; gap: 12px">${a}${b}</div>`;
const bikeGuest = () => `${twoCol(bfield('Make and model', { value: BIKE }), bfield('Colour, or anything that helps us spot it', { value: BIKE_DETAIL }))}
${textarea('Anything we should look at?', CUSTOMER_NOTE, 'Optional')}${photos()}${limit()}${next('Next: when')}`;
const bikeCard = (name, sub, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: flex; align-items: center; gap: 12px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${on ? C.hover : C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${on ? icon('check', 18) : ''}</button>`;
const bikeSignedIn = () => `${radios('Which bike?', `${bikeCard(BIKE, BIKE_DETAIL, true)}${bikeCard('A different bike', 'Tell us its make and model', false)}`, `display: grid; grid-template-columns: ${isPhone() ? '1fr' : '1fr 1fr'}; gap: 10px`)}
${textarea('Anything we should look at?', CUSTOMER_NOTE, 'Optional')}${photos()}${limit()}${next('Next: when')}`;
// Oliver Chen's "not sure" fixture (Release 1).
const OLIVER_NOTE = 'There’s a clicking sound when I pedal hard. I’m not sure where it comes from.';
const bikeNotSure = () => `<p style="margin: 0; font-size: 15px; line-height: 1.5">You don’t need to know what’s wrong. Tell us what you’ve noticed, and the workshop will look at it and agree the work and price with you before starting.</p>
${twoCol(bfield('Make and model', { value: 'Brompton C Line' }), bfield('Colour, or anything that helps us spot it', { value: 'Black' }))}
${textarea('What’s happening?', OLIVER_NOTE)}${bfield('When did it start?', { placeholder: 'Optional' })}${photos()}${next('Next: when')}`;
const DONE_BIKE = `${BIKE} · green`;

// ---------- Step 3: when (decision 7) ----------
// Audit L3: ten days from today fit the strip (Thu 17 to Sat 26), with no
// "Earlier" while nothing is earlier; each card reads its full date.
const DAYS = [['Thu', 17, 'Thursday'], ['Fri', 18, 'Friday'], ['Sat', 19, 'Saturday'], ['Sun', 20, 'Sunday'], ['Mon', 21, 'Monday'], ['Tue', 22, 'Tuesday'], ['Wed', 23, 'Wednesday'], ['Thu', 24, 'Thursday'], ['Fri', 25, 'Friday'], ['Sat', 26, 'Saturday']];
const dayState = (d) => (d === 20 ? 'closed' : d === 18 ? 'full' : 'open');
function strip(chosen, { hoverFull = false, booked = null } = {}) {
  const cell = ([w, d, long]) => {
    const s = dayState(d), on = d === chosen, mine = d === booked;
    const sub = mine ? 'Your booking' : s === 'closed' ? 'Closed' : s === 'full' ? 'Full' : '[n] times';
    const tipId = `full-${d}`;
    const tip = hoverFull && s === 'full' ? `<span role="tooltip" id="${tipId}" style="position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 2; width: 200px; padding: 10px 12px; border-radius: 8px; background: ${C.ink}; color: #ffffff; font-size: 13px; font-weight: 400; line-height: 1.4; text-align: left">Fully booked. The shop is open, but the workshop has no room left that day.</span>` : '';
    // A full day also explains itself on keyboard focus (audit M3).
    return `<button type="button" role="radio" aria-checked="${on}" aria-label="${long} ${d} September, ${sub === '[n] times' ? '[n] times free' : sub}"${s !== 'open' ? ' aria-disabled="true"' : ''}${s === 'full' ? ` aria-describedby="${tipId}"` : ''} style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 70px; padding: 10px 6px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : mine ? `2px dashed ${C.ink}` : `1px solid ${s === 'open' ? C.input : C.border}`}; background: ${on ? C.ink : s === 'open' ? C.panel : C.mutedBg}; color: ${on ? '#ffffff' : s === 'open' ? C.ink : C.muted}; font-family: inherit; flex-shrink: 0; ${hoverFull && s === 'full' ? `box-shadow: 0 0 0 3px rgba(${C.highlightRgb},0.6);` : ''}"><span style="font-size: 13px">${w}</span><span style="font-size: 20px; font-weight: 700">${d}</span><span style="font-size: 12px">${sub}</span>${tip}</button>`;
  };
  return `<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 700; flex-grow: 1">September 2026</span>${link('Later weeks ›')}</div>
${radios('Days', DAYS.map(cell).join(''), `display: flex; gap: 8px; overflow-x: auto; padding-bottom: ${hoverFull ? 84 : 4}px`)}`;
}
// Audit L1: Earliest shows when it's the choice, and "Book this time" goes
// straight to the details step — one click.
const earliest = (chosen, label = `${DAY_SHORT}, 09:30`) => `<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; border: ${chosen ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${chosen ? C.hover : C.panel}"><span style="flex-grow: 1"><span style="display: block; font-size: 13px; color: ${C.muted}">Earliest you can have</span><span style="font-size: 16px; font-weight: 700">${label}</span></span>${chosen ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700">${icon('check', 14)}Chosen</span>` : button('Book this time', { variant: 'default' })}</div>`;
const time = ([t, taken], chosen) => `<button type="button" role="radio" aria-checked="${t === chosen}"${taken ? ' aria-disabled="true"' : ''} style="min-height: 44px; min-width: 76px; padding: 0 12px; border-radius: 8px; border: ${t === chosen ? `2px solid ${C.ink}` : `1px solid ${taken ? C.border : C.input}`}; background: ${t === chosen ? C.ink : taken ? C.mutedBg : C.panel}; color: ${t === chosen ? '#ffffff' : taken ? C.muted : C.ink}; font-family: ${MONO}; font-size: 15px; ${taken ? 'text-decoration: line-through;' : ''}">${t}${taken ? hidden(' taken') : ''}</button>`;
const timesFor = (chosen) => `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${DAY} — choose a time to arrive</span>${radios(`Times on ${DAY}`, TIMES.map((x) => time(x, chosen)).join(''))}</div>`;
const whenAppt = (chosen = '09:30', opts = {}) => `${earliest(chosen === '09:30')}${strip(chosen ? 17 : null, opts)}${chosen ? timesFor(chosen) : ''}${chosen ? next('Next: your details') : ''}`;
// Drop-off days: the window, and the mechanic (2026-09-24).
const whenDropoff = () => `${earliest(true, `${DAY_SHORT}, drop off 09:00–18:00`)}${strip(17)}
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${DAY}</span><p style="margin: 0; font-size: 15px; line-height: 1.5">Drop your bike off any time from ${mono('09:00')} to ${mono('18:00')}. The mechanic starts on it later that day.</p></div>
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Who would you like to work on it?</span>${radios('Mechanic', `${rpill('Whoever’s free', true)}${rpill('Alex Morgan', false)}`)}</div>${next('Next: your details')}`;
const DONE_WHEN = `${DAY_SHORT}, arrive 09:30`;

// ---------- Step 4: details, and the deposit (decisions 3, 6, 9) ----------
// Audit M4: no terms tick box — the sentence by the button is the agreement.
// Audit M2: the button says what will happen. A shop that confirms
// automatically shows "Confirm booking" / "Pay £[deposit] and book".
const detailsBody = ({ deposit = false, signedIn = false, state = '', remind = false } = {}) => {
  const contact = signedIn
    ? `<p style="margin: 0; font-size: 15px; line-height: 1.5">${MAYA.name} · ${mono(MAYA.phone)} · ${MAYA.email} ${link('Change')}</p>`
    : `${bfield('Your name', { value: MAYA.name, auto: 'name' })}${twoCol(bfield('Mobile number', { value: MAYA.phone, type: 'tel', auto: 'tel' }), bfield('Email', { value: MAYA.email, type: 'email', auto: 'email', hint: 'For your receipt, and updates if you choose Email' }))}`;
  const updates = `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Send me updates by</span>${radios('Send me updates by', `${rpill('Text', true)}${rpill('WhatsApp', false)}${rpill('Email', false)}`)}</div>`;
  const alert = (strong, rest) => `<p role="alert" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>${strong}</strong> ${rest}</span></p>`;
  const failedCard = state === 'card-failed' ? alert('The card didn’t go through.', 'Nothing was taken and nothing is booked yet. Try again, or use another card.') : '';
  // Audit H3: the refund if the shop can't fit them in is said before paying.
  const pay = deposit ? `<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Deposit · ${mono('£[deposit]')}</span><p style="margin: 0; font-size: 14px; line-height: 1.5">We take the deposit now, and it comes off the bill when you collect. <strong>If the shop can’t fit you in, it comes back in full</strong> within [n] working days.</p><p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">Free to cancel until ${CUTOFF}. After that, or if you don’t come, the shop keeps it.</p>${failedCard}${state === 'checking' ? '' : `<div style="display: flex; align-items: center; justify-content: center; min-height: 100px; padding: 16px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center; font-size: 14px; color: ${C.muted}">[The payment provider’s secure card form]</div>`}</div>` : '';
  // Decision 9: a send that fails keeps everything; sending twice books once
  // and pays once. After paying, a dropped connection is checked, never
  // re-paid (audit H3).
  const notSent = state === 'not-sent' ? alert('Not sent yet — check your connection.', 'Everything you’ve typed is still here.')
    : state === 'checking' ? alert('We’re checking whether your payment went through — please don’t pay again.', 'Your connection dropped while sending. Nothing will be taken twice.') : '';
  const label = state === 'sending' ? 'Sending…' : state === 'checking' ? 'Check again' : state === 'not-sent' || state === 'card-failed' ? 'Try again' : deposit ? 'Pay £[deposit] and send request' : 'Send booking request';
  const agree = `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">By sending, you agree to North Street Cycles’ <a href="#" style="color: ${C.ink}; font-weight: 600">booking terms</a> and <a href="#" style="color: ${C.ink}; font-weight: 600">privacy notice</a>.</p>`;
  const send = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap">${state === 'sending' ? `<span role="status" style="font-size: 14px; color: ${C.muted}">Sending your booking — this takes a moment.</span>` : ''}${button(label).replace('style="', state === 'sending' ? 'aria-disabled="true" style="opacity: 0.75; ' : 'style="')}</div>`;
  // Account, history and reminders decision 2: say yes once to service reminders.
  const remindTick = remind ? remindBox() : '';
  return `${contact}${updates}${remindTick}${pay}${notSent}${agree}${send}`;
};

// ---------- Booked: the customer's answer (decision 8) ----------
const centred = (inner, w = 640) => site(`<div style="width: 100%; max-width: ${w}px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
const shopLines = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>24 North Street · [shop phone]</span></div>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
// Audit H1: "Free to cancel until" is the same row on every answer screen.
const WHEN_APPT = `${DAY}, arrive ${mono('09:30')}`;
const bookingLines = ({ deposit = true, when = WHEN_APPT, mechanic = null } = {}) => `<div>${kv('Service', DONE_SERVICE)}${kv('Bike', `${BIKE} · green`)}${kv('When', when)}${mechanic ? kv('Mechanic', mechanic) : ''}${kv('Extra work', LIMIT)}${deposit ? kv('Deposit paid', mono('£[deposit]')) : ''}${deposit ? kv('Free to cancel until', CUTOFF) : ''}${kv('Reference', mono('WH-1042'))}</div>`;
const bigIcon = (tone, ic) => `<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${tone === 'ok' ? C.okBg : tone === 'purple' ? C.purpleBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'purple' ? C.purpleInk : C.muted}">${icon(ic, 24)}</span>`;
const answerCard = (inner) => card(`<div style="padding: ${isPhone() ? 18 : 24}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`);
// Audit M3: only the one-line outcome is announced; focus goes to the heading.
const announce = (b) => `<div role="status">${b}</div>`;
const h1 = (t, size = 26) => `<h1 tabindex="-1" style="margin: 0; font-size: ${size}px; font-weight: 700">${t}</h1>`;
const btnRow = (inner) => `<div style="display: flex; flex-wrap: wrap; gap: 10px">${inner}</div>`;
// Audit L7: "Add a note for the shop" is a button like the others.
const pageButtons = (request = false) => btnRow(`${button('Change the date', { variant: 'default' })}${button(request ? 'Cancel request' : 'Cancel booking', { variant: 'default' })}${button('Add a note for the shop', { variant: 'default' })}`);
// Audit M2: messages go the way the customer chose — Maya chose Text.
const requestReceived = () => centred(answerCard(`${bigIcon('purple', 'inbox')}${announce(badge('Waiting for the shop to confirm', 'purple'))}${h1(`Thanks, ${MAYA.first} — your request is with us`)}
<p style="margin: 0; font-size: 15px; line-height: 1.5">We’ll check the workshop diary and send you a text to confirm. Please wait for that before bringing your bike in. If we can’t fit you in, your deposit comes back in full.</p>${bookingLines()}
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">We’ve sent you a link to this page by text, so you can check it, change the date or cancel.</p>${pageButtons(true)}${shopLines}`));
const confirmedNow = () => centred(answerCard(`${bigIcon('ok', 'check')}${announce(badge('Booking confirmed', 'green'))}${h1(`See you on ${DAY}, ${MAYA.first}`)}
<p style="margin: 0; font-size: 15px; line-height: 1.5">Arrive at ${mono('09:30')} with your ${BIKE}. Please bring the lock key, and tell us about any accessories.</p>${bookingLines()}
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">We’ve sent you a link to this page by text.</p>${pageButtons()}${shopLines}`));
// Decision 9: coming back to an unfinished booking.
const resume = () => layout(`<div role="status" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 10px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px"><span style="flex-grow: 1"><strong>You didn’t finish booking.</strong> Carry on where you left off — everything you typed is still here.</span>${button('Carry on')}${link('Start again', `color: ${C.warnInk}`)}</div>
${steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody())}`, summaryBox({ service: 'Standard service', price: '£65.00', bike: BIKE, when: DONE_WHEN, limit: true }));

// ---------- The booking's own page (decision 10; audit H2) ----------
const notice = (tone, inner) => `<p role="status" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${tone === 'warn' ? C.warnBg : C.purpleBg}; color: ${tone === 'warn' ? C.warnInk : C.purpleInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>${inner}</span></p>`;
const bookingPage = ({ state = 'confirmed', dialog = '' } = {}) => {
  let head, body, heading = `${BIKE} · Standard service`;
  if (state === 'request') {
    heading = 'Your booking request';
    head = `${badge('Waiting for the shop to confirm', 'purple')}<p style="margin: 0; font-size: 15px; line-height: 1.5">We’ll send you a text when the shop confirms. Please wait for that before bringing your bike in.</p>`;
    body = `${bookingLines()}${pageButtons(true)}`;
  } else if (state === 'offered') {
    // Audit H2, option 1: an offered time is answered here, in one click.
    heading = 'Your booking request';
    head = `${badge('The shop has suggested another time', 'purple')}<p style="margin: 0; font-size: 15px; line-height: 1.5">North Street Cycles can’t do ${DAY} at ${mono('09:30')}. They suggest:</p><p style="margin: 0; font-size: 20px; font-weight: 700">Saturday 19 September, arrive [time]</p><blockquote style="margin: 0; padding: 10px 14px; border-left: 3px solid ${C.border}; font-size: 15px; line-height: 1.5">“[The shop’s message]”</blockquote>`;
    body = `${btnRow(`${button('Accept this time')}${button('Cancel my request', { variant: 'default' })}`)}${bookingLines({ when: `${DAY}, arrive ${mono('09:30')} — not available` })}`;
  } else if (state === 'change') {
    head = badge('Booking confirmed', 'green');
    body = `<div>${kv('Booked now', WHEN_APPT)}${kv('Free to cancel until', CUTOFF)}</div><section aria-labelledby="chg" style="display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid ${C.border}"><h2 id="chg" style="margin: 0; font-size: 18px; font-weight: 700">Choose a new date</h2>${strip(25, { booked: 17 })}<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Friday 25 September — choose a time to arrive</span>${radios('Times on Friday 25 September', ['[time]', '[time]', '[time]', '[time]'].map((t, i) => `<button type="button" role="radio" aria-checked="${i === 1}" style="min-height: 44px; min-width: 76px; padding: 0 12px; border-radius: 8px; border: ${i === 1 ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${i === 1 ? C.ink : C.panel}; color: ${i === 1 ? '#ffffff' : C.ink}; font-family: ${MONO}; font-size: 15px">${t}</button>`).join(''))}</div>
${note('Your booking stays on Thursday until the shop confirms the new time.')}<div style="display: flex; justify-content: flex-end; gap: 10px">${button('Keep Thursday', { variant: 'ghost' })}${button('Ask for this date')}</div></section>`;
  } else if (state === 'pending-change') {
    head = `${badge('New date waiting for the shop', 'purple')}<p style="margin: 0; font-size: 15px; line-height: 1.5">You asked to move to <strong>Fri 25 Sep, arrive [time]</strong>. Your booking stays on ${DAY} until the shop confirms the new time — we’ll send you a text.</p>`;
    // Audit L4: the button says it withdraws the date change.
    body = `${bookingLines()}${btnRow(`${button('Cancel my date change', { variant: 'default' })}${button('Cancel booking', { variant: 'default' })}`)}`;
  } else if (state === 'change-declined') {
    head = `${notice('warn', `<strong>The shop couldn’t do Friday 25 September.</strong> Your booking is still ${DAY}, arrive ${mono('09:30')}.`)}${badge('Booking confirmed', 'green')}`;
    body = `${bookingLines()}${pageButtons()}`;
  } else if (state === 'dropoff') {
    // A drop-off shop, no deposit, the mechanic picked (decision 10).
    head = badge('Booking confirmed', 'green');
    body = `${bookingLines({ deposit: false, when: `${DAY}, drop off ${mono('09:00')}–${mono('18:00')}`, mechanic: 'Alex Morgan' })}${pageButtons()}`;
  } else {
    head = badge('Booking confirmed', 'green');
    body = `${bookingLines()}${pageButtons()}`;
  }
  const page = centred(`<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; color: ${C.muted}">Your booking · ${mono('WH-1042')}</span>${h1(heading, 28)}</div>${answerCard(`${head}${body}${state === 'change' ? '' : shopLines}`)}`, state === 'change' ? 1000 : 640);
  return dialog ? overlay(page, dialog) : page;
};
// Decision 4: the cancel question says what happens to the deposit.
const cancelDialog = (late = false) => popup('cancel-title', 'Cancel this booking?', `${DAY}, arrive 09:30 · ${BIKE}`, late
  ? `<p style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>It’s past ${CUTOFF}, so <strong>your £[deposit] deposit isn’t refundable</strong>. If something’s gone wrong, call the shop on [shop phone] — they can still refund it.</span></p>`
  : `<p style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px; line-height: 1.45">${icon('check', 18)}<span><strong>Your £[deposit] deposit will be refunded</strong> to the card you paid with, within [n] working days.</span></p>`,
  `${button('Keep my booking', { variant: 'ghost' })}${button(late ? 'Cancel and lose the deposit' : 'Cancel booking', { variant: 'danger' })}`, 520);
// Audit H2: the cancelled screen says whether the deposit came back.
const cancelled = (late = false) => centred(answerCard(`${bigIcon('grey', 'close')}${announce(`<span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Cancelled</span>`)}${h1('Your booking is cancelled')}
<p style="margin: 0; font-size: 15px; line-height: 1.5">${DAY}, Standard service for your ${BIKE}. ${late ? `Your £[deposit] deposit was kept, because it was after ${CUTOFF}.` : 'Your £[deposit] deposit comes back to your card within [n] working days.'} We’ve sent you a text to confirm.</p>${button('Book another time', { variant: 'default' })}${shopLines}`));
// Workshop day 15: the shop can decline with a message; the deposit comes back.
const declined = () => centred(answerCard(`${bigIcon('grey', 'alert')}${announce(`<span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Not booked</span>`)}${h1('Sorry, we can’t fit this booking in')}
<p style="margin: 0; font-size: 15px; line-height: 1.5">A message from North Street Cycles:</p><blockquote style="margin: 0; padding: 12px 16px; border-left: 3px solid ${C.border}; font-size: 15px; line-height: 1.5">“[The shop’s message]”</blockquote>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing is booked. Your £[deposit] deposit comes back to your card within [n] working days.</p>${button('Choose another date — we’ve kept your details', { variant: 'default' })}${shopLines}`));
const expired = () => centred(answerCard(`${h1('This booking link has expired', 24)}<p style="margin: 0; font-size: 15px; line-height: 1.5">It was for ${mono('WH-1042')}, booked for ${DAY}. Links stop working 30 days after the booked date.</p>${button('Book a repair', { variant: 'default' })}${shopLines}`));
const unavailable = () => centred(answerCard(`${h1('Online booking is unavailable just now', 24)}<p style="margin: 0; font-size: 15px; line-height: 1.5">Please try again in a little while, or call the shop to book.</p>${shopLines}`));
// Signed in: Your bookings (decision 10; audit H2). The second booking is a
// placeholder — nothing in the examples says what else Maya has booked.
const bookingCard = (title, sub, chip, extra = '') => card(`<div style="padding: 16px 18px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap"><span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${title}</span><span style="font-size: 14px; color: ${C.muted}">${sub}</span>${extra}</span>${chip}${button('Open', { variant: 'default' })}</div>`);
const yourBookings = () => centred(`<div style="display: flex; flex-direction: column; gap: 4px">${h1('Your bookings', 28)}<p style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px">${icon('user', 16)}Signed in as <strong>${MAYA.name}</strong></p></div>
<section aria-labelledby="up" style="display: flex; flex-direction: column; gap: 10px"><h2 id="up" style="margin: 0; font-size: 18px; font-weight: 700">Coming up</h2>${bookingCard(`${BIKE} · Standard service`, `${DAY}, arrive ${mono('09:30')} · ${mono('WH-1042')}`, badge('Booking confirmed', 'green'), `<span style="font-size: 13px; color: ${C.muted}">Free to cancel until ${CUTOFF}</span>`)}</section>
<section aria-labelledby="past" style="display: flex; flex-direction: column; gap: 10px"><h2 id="past" style="margin: 0; font-size: 18px; font-weight: 700">Earlier</h2>${bookingCard('[Bike] · [Service]', '[date] · [job number]', badge('Collected', 'grey'))}</section>
<div>${button('Book a repair')}</div>`, 760);

// ---------- Settings › Workshop › Online booking (decision 11) ----------
// Audit L5: who and what can be booked is said first; "Notice" matches
// decision 11; the deposit's unit follows the choice (a % here; £ for a
// fixed amount); a "Not sure" booking takes a fixed deposit (audit H3,
// option 1).
const sub = (t) => `<h4 style="margin: 8px 0 0; padding-top: 12px; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 700">${t}</h4>`;
const numRow = (id, label, hint, unit, value = '[n]', before = '') => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><label for="${id}" style="font-size: 15px; font-weight: 600">${label}</label>${hint ? `<span id="${id}-h" style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</span><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px">${before}<input id="${id}"${hint ? ` aria-describedby="${id}-h"` : ''} inputmode="numeric" value="${value}" style="width: 72px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${unit}</span></div>`;
const choiceRow = (label, opts, on) => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="font-size: 15px; font-weight: 600">${label}</span>${radios(label, opts.map((o, i) => rpill(o, i === on)).join(''))}</div>`;
const onlineOpen = () => `${note('Which services can be booked online is set on each service, in Services; who can be booked is set on each person, in Mechanics.')}
${sub('How customers book')}
${choiceRow('Customers choose', ['An exact time to arrive', 'A day to drop off'], 0)}
${numRow('notice', 'Notice', 'Customers book at least this far ahead', 'hours ahead', '2')}
${rowSwitch('Show prices on the booking page', true)}
${rowSwitch('Confirm bookings automatically', false)}
${note('Off: each booking is a request, purple in the diary until someone accepts it. On: a booking that fits the diary is confirmed straight away. Changing a confirmed booking is always a request.')}
${sub('Deposits')}
${rowSwitch('Take a deposit when booking', true)}
${choiceRow('Deposit', ['A fixed amount', 'A percentage of the price'], 1)}
${numRow('dep-pc', 'How much', '', '%')}
${numRow('dep-unknown', 'If the price isn’t known', 'For “Not sure what’s wrong?” bookings', '', '[n]', '£')}
${choiceRow('For', ['Every booking', 'Chosen services (choose on each service)'], 0)}
${numRow('cutoff', 'Free to cancel until', 'Before the booked time · after that, or if they don’t come, the shop keeps the deposit', 'hours before', '24')}
${note('With automatic confirming off, the customer pays before the shop has said yes; if the shop declines, the deposit is refunded automatically.')}
${sub('Terms')}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Booking terms</span><span style="font-size: 13px; color: ${C.muted}">Wheelhouse’s standard terms · a copy is kept with each booking</span></span>${button('Use your own', { variant: 'default' })}</div>
<div>${link('See your booking page ↗')}</div>`;
const settings = () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ online: onlineOpen() }));

// ---------- The boards ----------
const S = (o = {}) => summaryBox({ service: 'Standard service', price: '£65.00', ...o });
const DONE3 = [DONE_SERVICE, DONE_BIKE, DONE_WHEN];
def('bk-service', () => layout(steps(1, [], serviceStep()), S(), false, { top: true }));
def('bk-service-many', () => layout(steps(1, [], serviceStep({ many: true })), S(), false, { top: true }));
def('bk-bike', () => layout(steps(2, [DONE_SERVICE], bikeGuest()), S({ bike: BIKE, limit: true })));
// The signed-in boards are a shop that takes a deposit, shown from the start.
def('bk-bike-signed-in', () => layout(steps(2, [DONE_SERVICE], bikeSignedIn()), S({ bike: BIKE, limit: true, deposit: 'later' }), true));
def('bk-not-sure', () => layout(steps(2, ['Not sure — we’ll take a look'], bikeNotSure(), 'What have you noticed?'), summaryBox({ service: 'We’ll take a look', price: 'agree', bike: 'Brompton C Line' })));
def('bk-when', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenAppt()), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-when-full', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenAppt(null, { hoverFull: true })), S({ bike: BIKE, limit: true })));
def('bk-when-dropoff', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenDropoff()), S({ bike: BIKE, when: `${DAY_SHORT}, drop off 09:00–18:00`, mechanic: 'Whoever’s free', limit: true })));
def('bk-details', () => layout(steps(4, DONE3, detailsBody()), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-details-deposit', () => layout(steps(4, DONE3, detailsBody({ deposit: true, signedIn: true })), S({ bike: BIKE, when: DONE_WHEN, limit: true, deposit: 'now' }), true));
def('bk-sending', () => layout(steps(4, DONE3, detailsBody({ state: 'sending' })), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-card-failed', () => layout(steps(4, DONE3, detailsBody({ deposit: true, signedIn: true, state: 'card-failed' })), S({ bike: BIKE, when: DONE_WHEN, limit: true, deposit: 'now' }), true));
def('bk-not-sent', () => layout(steps(4, DONE3, detailsBody({ state: 'not-sent' })), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-checking-payment', () => layout(steps(4, DONE3, detailsBody({ deposit: true, signedIn: true, state: 'checking' })), S({ bike: BIKE, when: DONE_WHEN, limit: true, deposit: 'now' }), true));
def('bk-resume', () => resume());
def('bk-request', () => requestReceived());
def('bk-confirmed', () => confirmedNow());
def('bk-bookings', () => yourBookings());
def('bk-page-request', () => bookingPage({ state: 'request' }));
def('bk-offered', () => bookingPage({ state: 'offered' }));
def('bk-page', () => bookingPage());
def('bk-page-dropoff', () => bookingPage({ state: 'dropoff' }));
def('bk-change', () => bookingPage({ state: 'change' }));
def('bk-change-pending', () => bookingPage({ state: 'pending-change' }));
def('bk-change-declined', () => bookingPage({ state: 'change-declined' }));
def('bk-cancel', () => bookingPage({ dialog: cancelDialog() }));
def('bk-cancel-late', () => bookingPage({ dialog: cancelDialog(true) }));
def('bk-cancelled', () => cancelled());
def('bk-cancelled-late', () => cancelled(true));
def('bk-declined', () => declined());
def('bk-expired', () => expired());
def('bk-unavailable', () => unavailable());
def('bk-staff-request', () => requestDepositBoard(SIZE));
def('bk-staff-decline', () => requestDepositBoard(SIZE, true));
// Scrolled down to the booking messages, below the shop's other messages.
def('bk-messages', () => `<style>.bk-scrolled > * { position: relative; top: -${{ desktop: 330, tablet: 330, phone: 600 }[SIZE]}px }</style>${msgPage({ list: msgListOpen() }).replace('<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto;', '<div data-scroll class="bk-scrolled" style="flex-grow: 1; min-height: 0; overflow-y: hidden;')}`);
def('bk-settings', () => settings());
// The same page scrolled down to Deposits and Terms (the section is long).
def('bk-settings-deposits', () => `<style>.bk-scrolled > * { position: relative; top: -${{ desktop: 420, tablet: 420, phone: 720 }[SIZE]}px }</style>${settings().replace('<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto;', '<div data-scroll class="bk-scrolled" style="flex-grow: 1; min-height: 0; overflow-y: hidden;')}`);

const SIZES = ['desktop', 'tablet', 'phone']; // decision 13
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; FID = 0; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'bk-service': 'Book a repair: every service at once',
  'bk-service-many': 'A shop with many single jobs: search them',
  'bk-bike': 'Your bike, and what to look at',
  'bk-bike-signed-in': 'Signed in, in a shop that takes a deposit',
  'bk-not-sure': 'Not sure what’s wrong: tell us what you’ve noticed',
  'bk-when': 'When: Earliest, then a strip of days and times',
  'bk-when-full': 'A full day says why',
  'bk-when-dropoff': 'A shop that takes drop-off days: the window and the mechanic',
  'bk-details': 'Your details, and how to send updates',
  'bk-details-deposit': 'Pay the deposit and send',
  'bk-sending': 'Sending',
  'bk-card-failed': 'The card didn’t go through',
  'bk-not-sent': 'Not sent yet — everything kept',
  'bk-checking-payment': 'The connection dropped after paying: checking, not paying again',
  'bk-resume': 'Coming back: carry on where you left off',
  'bk-request': 'Request received: waiting for the shop',
  'bk-confirmed': 'Confirmed straight away (the shop’s setting)',
  'bk-bookings': 'Signed in: Your bookings',
  'bk-page-request': 'The booking’s page while it’s still a request',
  'bk-offered': 'The shop suggests another time: accept, or cancel',
  'bk-page': 'The booking’s page, confirmed',
  'bk-page-dropoff': 'A drop-off booking, no deposit, the mechanic picked',
  'bk-change': 'Change the date, in place',
  'bk-change-pending': 'New date waiting for the shop',
  'bk-change-declined': 'The shop couldn’t do the new date',
  'bk-cancel': 'Cancel: the deposit comes back',
  'bk-cancel-late': 'Cancel after the cut-off: the deposit is kept',
  'bk-cancelled': 'Cancelled, deposit refunded',
  'bk-cancelled-late': 'Cancelled after the cut-off, deposit kept',
  'bk-declined': 'The shop couldn’t fit it in',
  'bk-expired': 'The link, 30 days after the booked date',
  'bk-unavailable': 'Online booking unavailable',
  'bk-staff-request': 'The diary: a request with a deposit',
  'bk-staff-decline': 'Declining it refunds the deposit',
  'bk-messages': 'Settings › Front desk › Messages: the booking messages',
  'bk-settings': 'Settings › Workshop › Online booking',
  'bk-settings-deposits': 'Online booking, scrolled: deposits and terms',
};
export const ROWS = [
  { label: 'Booking', screens: ['bk-service', 'bk-service-many', 'bk-bike', 'bk-bike-signed-in', 'bk-not-sure', 'bk-when', 'bk-when-full', 'bk-when-dropoff', 'bk-details', 'bk-details-deposit'] },
  { label: 'Sending', screens: ['bk-sending', 'bk-card-failed', 'bk-not-sent', 'bk-checking-payment', 'bk-resume', 'bk-request', 'bk-confirmed'] },
  { label: 'Your booking', screens: ['bk-bookings', 'bk-page-request', 'bk-offered', 'bk-page', 'bk-page-dropoff', 'bk-change', 'bk-change-pending', 'bk-change-declined'] },
  { label: 'Cancelling', screens: ['bk-cancel', 'bk-cancel-late', 'bk-cancelled', 'bk-cancelled-late', 'bk-declined', 'bk-expired', 'bk-unavailable'] },
  { label: 'The shop’s side', screens: ['bk-staff-request', 'bk-staff-decline', 'bk-messages', 'bk-settings', 'bk-settings-deposits'] },
];

// Account, history and reminders decision 2: step 4 with the reminder tick.
export const detailsRemindAt = (size) => withSize(size, () => { const was = SIZE; SIZE = size; FID = 0; try { return layout(steps(4, DONE3, detailsBody({ remind: true })), S({ bike: BIKE, when: DONE_WHEN, limit: true })); } finally { SIZE = was; } });
