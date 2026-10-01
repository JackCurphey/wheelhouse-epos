// Journey 3 — Book a repair, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-book-a-repair-review.md
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
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { settingsPage, rowSwitch, workshopFolds, WORKSHOP_INTRO, note, pill, popup, withSize, isPhone } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { CUSTOMER_NOTE } from './job-page.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';

// ---------- Example data (Release 1's booking fixture) ----------
const MAYA = { name: 'Maya Patel', first: 'Maya', phone: '07700 900 142', email: 'maya@example.test' };
const BIKE = 'Trek Domane AL 3';
const BIKE_DETAIL = 'Green · black mudguards';
const DAY = 'Thursday 17 September';
const DAY_SHORT = 'Thu 17 Sep';
const TIMES = [['09:30', false], ['10:00', true], ['10:30', false], ['11:00', true], ['11:30', true], ['12:00', false], ['14:00', false], ['14:30', true], ['15:00', true]];
const FULL = [{ name: 'Standard service', what: 'Safety check, gears, brakes and tune-up', time: '60 min', price: '£65' },
  { name: '[Full service]', what: '[What’s included]', time: '[time]', price: '£[price]' },
  { name: '[Full service]', what: '[What’s included]', time: '[time]', price: '£[price]' }];
const SINGLE = [['Brake service', '45 min'], ['Gear adjustment', '60 min'], ['Safety check', '60 min']];

// ---------- The page frame (decision 2) ----------
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Book a repair', body) : SIZE === 'tablet' ? siteTablet('sand', body) : sitePhone('sand', { content: body });
};
const link = (t, extra = '') => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}; ${extra}">${t}</a>`;
// Decision 6: signing in is offered at the top, never required.
const signLine = (signedIn) => signedIn
  ? `<p style="margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px">${icon('user', 16)}Signed in as <strong>${MAYA.name}</strong> ${link('Not you?')}</p>`
  : `<p style="margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; color: ${C.muted}">Booked with us before? ${link('Sign in to use your saved bikes and details')}</p>`;
const title = (signedIn = false) => `<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 2px"><h1 style="margin: 0; font-size: ${isPhone() ? 26 : 30}px; font-weight: 700">Book a repair</h1>${signLine(signedIn)}</div>`;

// A step: done (a line with Change), open (its questions), or still to come.
const STEPS = ['What does your bike need?', 'Your bike', 'When?', 'Your details'];
const num = (n, state) => `<span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; font-size: 14px; font-weight: 700; ${state === 'done' ? `background: ${C.okBg}; color: ${C.successInk}` : state === 'open' ? `background: ${C.ink}; color: #ffffff` : `border: 1px solid ${C.border}; color: ${C.muted}`}">${state === 'done' ? icon('check', 14) : n}</span>`;
const stepDone = (n, summary) => card(`<div style="padding: 12px 18px; display: flex; align-items: center; gap: 12px"><h2 style="margin: 0; display: flex; align-items: center; gap: 12px; flex-grow: 1; min-width: 0; font-size: 15px; font-weight: 400">${num(n, 'done')}<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 13px; color: ${C.muted}">${STEPS[n - 1]}</span><span style="font-weight: 600">${summary}</span></span></h2>${link(`Change<span style="position: absolute; left: -9999px"> ${STEPS[n - 1].toLowerCase()}</span>`, 'position: relative')}</div>`, 'flex-shrink: 0');
const stepOpen = (n, body, heading = STEPS[n - 1]) => `<section aria-labelledby="step-${n}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 12px"><h2 id="step-${n}" style="margin: 0; display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700">${num(n, 'open')}${heading}</h2>${body}</div>`, `border: 2px solid ${C.ink}`)}</section>`;
// The steps still to come share one quiet line under the open step.
const stepsLater = (from) => (from > 4 ? '' : `<div style="flex-shrink: 0; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 4px 18px; font-size: 15px; color: ${C.muted}"><span>Then:</span>${[1, 2, 3, 4].filter((n) => n >= from).map((n) => `<span style="display: inline-flex; align-items: center; gap: 8px">${num(n, 'later')}${STEPS[n - 1]}</span>`).join('')}</div>`);
const steps = (open, doneLines, openBody, openHeading) => [1, 2, 3, 4].filter((n) => n <= open).map((n) => (n < open ? stepDone(n, doneLines[n - 1]) : stepOpen(n, openBody, openHeading))).join('') + stepsLater(open + 1);
const next = (t) => `<div style="display: flex; justify-content: flex-end">${button(t)}</div>`;

// "Your booking" (decision 2): fills in as the customer goes.
function summaryBox({ service = null, price = null, bike = null, when = null, deposit = false, limit = false, pending = false } = {}) {
  const r = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 14px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v ?? `<span style="font-weight: 400; color: ${C.muted}">—</span>`}</span></div>`;
  return `<aside aria-label="Your booking" style="flex-shrink: 0">${card(`<div style="padding: 18px; display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0 0 6px; font-size: 18px; font-weight: 700">Your booking</h2>
${r('Service', service)}${r('Bike', bike)}${r('When', when)}${limit ? r('Extra work', 'Go ahead up to £200') : ''}
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0 4px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Price</span>${price ? mono(price, 'font-size: 20px') : `<span style="font-size: 14px; color: ${C.muted}">—</span>`}</div>
${deposit ? `<div style="display: flex; justify-content: space-between; font-size: 14px"><span>Deposit to pay now</span>${mono('£[deposit]')}</div><p style="margin: 4px 0 0; font-size: 13px; line-height: 1.45; color: ${C.muted}">Free to cancel until ${pending ? '[date and time]' : '[date and time]'} — the deposit comes back in full.</p>` : ''}
<p style="margin: 6px 0 0; font-size: 13px; line-height: 1.45; color: ${C.muted}">Prices include VAT. Extra work is always agreed with you first.</p></div>`)}</aside>`;
}
// Two columns on a wide screen: the steps, and Your booking beside them,
// staying in view as the page scrolls. A board past the first step shows
// the page scrolled to the open step (its bottom in view), as the customer
// would see it; the answered steps above have scrolled up.
const layout = (left, right, signedIn = false, { top = false } = {}) => site(`<div style="flex-grow: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start"><div style="height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: ${top ? 'flex-start' : 'flex-end'}; gap: 12px; min-width: 0">${title(signedIn)}${left}</div><div style="display: flex; flex-direction: column; gap: 12px">${right}</div></div>`);

// ---------- Step 1: every service at once (decision 5) ----------
const fullCard = (s, chosen) => `<button type="button" aria-pressed="${chosen}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${chosen ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${chosen ? C.hover : C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="font-size: 16px; font-weight: 700">${s.name}</span><span style="font-size: 13px; line-height: 1.4; color: ${C.muted}">${s.what}</span><span style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 4px"><span style="display: inline-flex; align-items: baseline; gap: 8px">${mono(s.price, 'font-size: 16px')}<span style="font-size: 13px; color: ${C.muted}">${s.time}</span></span>${chosen ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700">${icon('check', 14)}Chosen</span>` : ''}</span></button>`;
const tick = (label, sub, price, on = false) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 2px 0; border-top: 1px solid ${C.border}; font-size: 15px"><input type="checkbox"${on ? ' checked' : ''} style="width: 20px; height: 20px; accent-color: ${C.ink}"><span style="flex-grow: 1"><span style="font-weight: 600">${label}</span> <span style="font-size: 13px; color: ${C.muted}">· ${sub}</span></span>${mono(price, 'font-size: 15px')}</label>`;
const notSure = (on = false) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px dashed ${C.input}`}; background: ${on ? C.hover : 'transparent'}; color: ${C.ink}; font-family: inherit; text-align: left; font-size: 15px"><span style="display: inline-flex; width: 32px; height: 32px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 999px; background: ${C.mutedBg}; font-weight: 700">?</span><span><strong>Not sure what’s wrong?</strong> <span style="color: ${C.muted}">Describe it and we’ll take a look.</span></span></button>`;
function serviceStep({ chosen = 0, many = false } = {}) {
  const cols = isPhone() ? 1 : 3;
  const singles = many
    ? `<label style="display: flex; align-items: center; gap: 8px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: #ffffff; color: ${C.muted}">${icon('search', 16)}<input type="search" aria-label="Search the individual services" placeholder="Search [n] individual services — like “brakes” or “puncture”" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
<div role="group" aria-label="Individual services">${SINGLE.map(([n, t]) => tick(n, t, '£[price]')).join('')}${tick('[Individual service]', '[time]', '£[price]')}</div>${link('Show all [n] individual services')}`
    : `<div role="group" aria-label="Individual services">${SINGLE.map(([n, t]) => tick(n, t, '£[price]')).join('')}</div>`;
  return `<div role="group" aria-label="Full services" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Full services</span><div style="display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 10px">${FULL.map((s, i) => fullCard(s, i === chosen)).join('')}</div></div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Or just one job — tick any you need</span>${singles}</div>
${notSure()}
${next('Next: your bike')}`;
}
const DONE_SERVICE = 'Standard service · £65';

// ---------- Step 2: the bike and the problem (decision 6) ----------
const textarea = (id, label, value, hint = '', rows = 3) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><textarea id="${id}" rows="${rows}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; padding: 10px 12px; font-family: inherit; font-size: 15px; line-height: 1.45; color: ${C.ink}; resize: vertical">${esc(value)}</textarea>${hint ? `<span style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</div>`;
const photos = () => `<button type="button" style="display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px dashed ${C.input}; background: transparent; color: ${C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${icon('plus', 16)}Add photos or a short video <span style="font-weight: 400; color: ${C.muted}">· optional</span></button>`;
// Workshop day 41: the customer can name how much the work may come to.
const limit = (set = true) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="padding: 0 0 6px; font-size: 14px; font-weight: 600">If the mechanic finds more to do</legend>
<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px"><input type="radio" name="limit"${set ? '' : ' checked'} style="width: 20px; height: 20px; accent-color: ${C.ink}">Call me before any extra work</label>
<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; flex-wrap: wrap; font-size: 15px"><input type="radio" name="limit"${set ? ' checked' : ''} style="width: 20px; height: 20px; accent-color: ${C.ink}">Go ahead if it all comes to no more than <span style="display: inline-flex; align-items: center; gap: 4px">£<input aria-label="Most the work can come to, in pounds" value="200" style="width: 72px; min-height: 40px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></span></label></fieldset>`;
const twoCol = (a, b) => `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '1fr 1fr'}; gap: 12px">${a}${b}</div>`;
const bikeGuest = () => `${twoCol(field('Make and model', { value: BIKE }), field('Colour, or anything that helps us spot it', { value: BIKE_DETAIL }))}
${textarea('look', 'Anything we should look at?', CUSTOMER_NOTE, 'Optional')}${photos()}${limit()}${next('Next: when')}`;
const bikeCard = (name, sub, on) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 12px; padding: 14px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${on ? C.hover : C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${on ? icon('check', 18) : ''}</button>`;
const bikeSignedIn = () => `<div role="group" aria-label="Which bike?" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '1fr 1fr'}; gap: 10px">${bikeCard(BIKE, BIKE_DETAIL, true)}${bikeCard('A different bike', 'Tell us its make and model', false)}</div>
${textarea('look', 'Anything we should look at?', CUSTOMER_NOTE, 'Optional')}${photos()}${limit()}${next('Next: when')}`;
// Oliver Chen's "not sure" fixture (Release 1).
const OLIVER_NOTE = 'There’s a clicking sound when I pedal hard. I’m not sure where it comes from.';
const bikeNotSure = () => `<p style="margin: 0; font-size: 15px; line-height: 1.5">You don’t need to know what’s wrong. Tell us what you’ve noticed, and the workshop will look at it and agree the work and price with you before starting.</p>
${twoCol(field('Make and model', { value: 'Brompton C Line' }), field('Colour, or anything that helps us spot it', { value: 'Black' }))}
${textarea('look', 'What’s happening?', OLIVER_NOTE)}${field('When did it start?', { placeholder: 'Optional' })}${photos()}${next('Next: when')}`;
const DONE_BIKE = `${BIKE} · green`;

// ---------- Step 3: when (decision 7) ----------
// Fourteen days from Monday 14 September; [n] is how many times are free.
const DAYS = ['Mon 14', 'Tue 15', 'Wed 16', 'Thu 17', 'Fri 18', 'Sat 19', 'Sun 20', 'Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', 'Fri 25', 'Sat 26', 'Sun 27'];
const dayState = (d) => (['Mon 14', 'Tue 15', 'Wed 16'].includes(d) ? 'past' : ['Sun 20', 'Sun 27'].includes(d) ? 'closed' : d === 'Fri 18' ? 'full' : 'open');
function strip(chosen, { hoverFull = false } = {}) {
  const cell = (d) => {
    const s = dayState(d), on = d === chosen;
    if (s === 'past') return '';
    const [w, n] = d.split(' ');
    const sub = s === 'closed' ? 'Closed' : s === 'full' ? 'Full' : '[n] times';
    const tip = hoverFull && s === 'full' ? `<span role="tooltip" style="position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 2; width: 200px; padding: 10px 12px; border-radius: 8px; background: ${C.ink}; color: #ffffff; font-size: 13px; font-weight: 400; line-height: 1.4; text-align: left">Fully booked. The shop is open, but the workshop has no room left that day.</span>` : '';
    return `<button type="button" aria-pressed="${on}"${s !== 'open' ? ' aria-disabled="true"' : ''} style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 72px; padding: 10px 6px; box-sizing: border-box; border-radius: 10px; border: ${on ? `2px solid ${C.ink}` : `1px solid ${s === 'open' ? C.input : C.border}`}; background: ${on ? C.ink : s === 'open' ? C.panel : C.mutedBg}; color: ${on ? '#ffffff' : s === 'open' ? C.ink : C.muted}; font-family: inherit; flex-shrink: 0; ${hoverFull && s === 'full' ? `box-shadow: 0 0 0 3px rgba(${C.highlightRgb},0.6);` : ''}"><span style="font-size: 13px">${w}</span><span style="font-size: 20px; font-weight: 700">${n}</span><span style="font-size: 12px">${sub}</span>${tip}</button>`;
  };
  return `<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 700; flex-grow: 1">September 2026</span>${link('Earlier', `color: ${C.muted}`)}${link('Later weeks ›')}</div>
<div role="group" aria-label="Days" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: ${hoverFull ? 84 : 4}px">${DAYS.map(cell).join('')}</div>`;
}
const earliest = (on = false) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; text-align: left"><span style="flex-grow: 1"><span style="display: block; font-size: 13px; color: ${C.muted}">Earliest you can have</span><span style="font-size: 16px; font-weight: 700">${DAY_SHORT}, 09:30</span></span><span style="display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 6px; background: ${C.ink}; color: #ffffff; font-size: 14px; font-weight: 600">Take it</span></button>`;
const time = ([t, taken], chosen) => `<button type="button" aria-pressed="${t === chosen}"${taken ? ' aria-disabled="true"' : ''} style="min-height: 44px; min-width: 76px; padding: 0 12px; border-radius: 8px; border: ${t === chosen ? `2px solid ${C.ink}` : `1px solid ${taken ? C.border : C.input}`}; background: ${t === chosen ? C.ink : taken ? C.mutedBg : C.panel}; color: ${t === chosen ? '#ffffff' : taken ? C.muted : C.ink}; font-family: ${MONO}; font-size: 15px; ${taken ? 'text-decoration: line-through;' : ''}">${t}<span style="position: absolute; left: -9999px">${taken ? ' taken' : ''}</span></button>`;
const timesFor = (chosen) => `<div role="group" aria-label="Times on ${DAY}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${DAY} — choose a time to arrive</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${TIMES.map((x) => time(x, chosen)).join('')}</div></div>`;
const whenAppt = (chosen = '09:30', opts = {}) => `${earliest()}${strip('Thu 17', opts)}${timesFor(chosen)}${next('Next: your details')}`;
// Drop-off days: the window, and the mechanic (2026-09-24).
const whenDropoff = () => `${earliest().replace(`${DAY_SHORT}, 09:30`, `${DAY_SHORT}, drop-off 09:00–18:00`)}${strip('Thu 17')}
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${DAY}</span><p style="margin: 0; font-size: 15px; line-height: 1.5">Drop your bike off any time from ${mono('09:00')} to ${mono('18:00')}. The mechanic starts on it later that day.</p></div>
<div role="group" aria-label="Mechanic" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Who would you like to work on it?</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${pill('Whoever’s free', true)}${pill('Alex Morgan')}</div></div>${next('Next: your details')}`;
const DONE_WHEN = `${DAY_SHORT}, arrive 09:30`;

// ---------- Step 4: details, and the deposit (decisions 3, 6, 9) ----------
const chan = (t, on) => pill(t, on);
const detailsBody = ({ deposit = false, signedIn = false, state = '' } = {}) => {
  const contact = signedIn
    ? `<p style="margin: 0; font-size: 15px; line-height: 1.5">${MAYA.name} · ${mono(MAYA.phone)} · ${MAYA.email} ${link('Change')}</p>`
    : `${field('Your name', { value: MAYA.name })}${twoCol(field('Mobile number', { value: MAYA.phone, type: 'tel' }), field('Email', { value: MAYA.email, type: 'email', hint: 'For your receipt' }))}`;
  const updates = `<div role="group" aria-label="Send me updates by" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Send me updates by</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${chan('Text', true)}${chan('WhatsApp', false)}${chan('Email', false)}</div></div>`;
  const terms = `<label style="display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.5"><input type="checkbox" checked style="width: 20px; height: 20px; margin: 0; flex-shrink: 0; accent-color: ${C.ink}"><span>I agree to North Street Cycles’ ${link('booking terms', 'min-height: 0; display: inline')} and ${link('privacy notice', 'min-height: 0; display: inline')}.</span></label>`;
  const failedCard = state === 'card-failed' ? `<p role="alert" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>The card didn’t go through.</strong> Nothing was taken and nothing is booked yet. Try again, or use another card.</span></p>` : '';
  const pay = deposit ? `<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">Deposit · ${mono('£[deposit]')}</span><p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">Taken off the bill when you collect. Free to cancel until [date and time] — the deposit comes back in full. After that, or if you don’t come, the shop keeps it.</p>${failedCard}<div style="display: flex; align-items: center; justify-content: center; min-height: 110px; padding: 16px; box-sizing: border-box; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center; font-size: 14px; color: ${C.muted}">[The payment provider’s secure card form]</div></div>` : '';
  // Decision 9: a send that fails keeps everything; sending twice books once.
  const notSent = state === 'not-sent' ? `<p role="alert" style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>Not sent yet — check your connection.</strong> Everything you’ve typed is still here. ${deposit ? 'No money has been taken. ' : ''}</span></p>` : '';
  const label = state === 'sending' ? 'Sending…' : state === 'not-sent' || state === 'card-failed' ? 'Try again' : deposit ? 'Pay £[deposit] and send' : 'Send booking request';
  const send = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 12px">${state === 'sending' ? `<span role="status" style="font-size: 14px; color: ${C.muted}">Sending your booking — this takes a moment.</span>` : ''}${button(label).replace('style="', state === 'sending' ? `aria-disabled="true" style="opacity: 0.75; ` : 'style="')}</div>`;
  return `${contact}${updates}${terms}${pay}${notSent}${send}`;
};

// ---------- Booked: the customer's answer (decision 8) ----------
const centred = (inner, w = 640) => site(`<div style="width: 100%; max-width: ${w}px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
const shopLines = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 14px; line-height: 1.5"><strong>North Street Cycles, Bolton</strong><span>24 North Street · [shop phone]</span></div>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
const bookingLines = ({ deposit = false, when = `${DAY}, arrive ${mono('09:30')}` } = {}) => `<div>${kv('Service', 'Standard service · £65')}${kv('Bike', `${BIKE} · green`)}${kv('When', when)}${kv('Extra work', 'Go ahead up to £200')}${deposit ? kv('Deposit paid', mono('£[deposit]')) : ''}${kv('Reference', mono('WH-1042'))}</div>`;
const bigIcon = (tone, ic) => `<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${tone === 'ok' ? C.okBg : tone === 'purple' ? C.purpleBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'purple' ? C.purpleInk : C.muted}">${icon(ic, 24)}</span>`;
const answerCard = (inner) => card(`<div style="padding: ${isPhone() ? 18 : 24}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`);
const pageButtons = () => `<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Change the date', { variant: 'default' })}${button('Cancel booking', { variant: 'default' })}${link('Add a note for the shop')}</div>`;
const requestReceived = (deposit = true) => centred(`<div role="status">${answerCard(`${bigIcon('purple', 'inbox')}${badge('Waiting for the shop to confirm', 'purple')}<h1 style="margin: 0; font-size: 26px; font-weight: 700">Thanks, ${MAYA.first} — your request is with us</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">We’ll check the workshop diary and text you to confirm. Please wait for that before bringing your bike in.${deposit ? ' If we can’t fit you in, your deposit comes straight back.' : ''}</p>${bookingLines({ deposit })}
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">We’ve texted you a link to this page, so you can check it, change the date or cancel.</p>${pageButtons()}${shopLines}`)}</div>`);
const confirmedNow = () => centred(`<div role="status">${answerCard(`${bigIcon('ok', 'check')}${badge('Booking confirmed', 'green')}<h1 style="margin: 0; font-size: 26px; font-weight: 700">See you on ${DAY}, ${MAYA.first}</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Arrive at ${mono('09:30')} with your ${BIKE}. Please bring the lock key, and tell us about any accessories.</p>${bookingLines({ deposit: true })}
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">Free to cancel until [date and time]. We’ve texted you a link to this page.</p>${pageButtons()}${shopLines}`)}</div>`);
// Decision 9: coming back to an unfinished booking.
const resume = () => layout(`<div role="status" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 10px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px"><span style="flex-grow: 1"><strong>You didn’t finish booking.</strong> Carry on where you left off — everything you typed is still here.</span>${button('Carry on')}${link('Start again', `color: ${C.warnInk}`)}</div>
${steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody())}`, summaryBox({ service: 'Standard service', price: '£65.00', bike: BIKE, when: DONE_WHEN, limit: true }));

// ---------- The booking's own page (decision 10) ----------
const bookingPage = ({ state = 'confirmed', dialog = '' } = {}) => {
  const head = state === 'pending-change'
    ? `${badge('New date waiting for the shop', 'purple')}<p style="margin: 0; font-size: 15px; line-height: 1.5">You asked to move to <strong>Fri 25 Sep, arrive [time]</strong>. Your booking stays on ${DAY} until the shop confirms the new time — we’ll text you.</p>`
    : badge('Booking confirmed', 'green');
  const body = state === 'change'
    ? `<div>${kv('Booked now', `${DAY}, arrive ${mono('09:30')}`)}</div><section aria-labelledby="chg" style="display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid ${C.border}"><h2 id="chg" style="margin: 0; font-size: 18px; font-weight: 700">Choose a new date</h2>${strip('Fri 25').replace('aria-pressed="true"', 'aria-pressed="true"')}<div role="group" aria-label="Times on Fri 25 Sep" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Friday 25 September — choose a time to arrive</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${['[time]', '[time]', '[time]', '[time]'].map((t, i) => `<button type="button" aria-pressed="${i === 1}" style="min-height: 44px; min-width: 76px; padding: 0 12px; border-radius: 8px; border: ${i === 1 ? `2px solid ${C.ink}` : `1px solid ${C.input}`}; background: ${i === 1 ? C.ink : C.panel}; color: ${i === 1 ? '#ffffff' : C.ink}; font-family: ${MONO}; font-size: 15px">${t}</button>`).join('')}</div></div>
${note('Your booking stays on Thursday until the shop confirms the new time.')}<div style="display: flex; justify-content: flex-end; gap: 10px">${button('Keep Thursday', { variant: 'ghost' })}${button('Ask for this date')}</div></section>`
    : `${bookingLines({ deposit: true })}${state === 'pending-change' ? `<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Keep Thursday instead', { variant: 'default' })}${button('Cancel booking', { variant: 'default' })}</div>` : pageButtons()}`;
  const page = centred(`<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; color: ${C.muted}">Your booking · ${mono('WH-1042')}</span><h1 style="margin: 0; font-size: 28px; font-weight: 700">${BIKE} · Standard service</h1></div>${answerCard(`${head}${body}${state === 'change' ? '' : shopLines}`)}`, state === 'change' ? 1000 : 640);
  if (!dialog) return page;
  return `<div style="position: relative; width: 1280px; height: 800px; overflow: hidden">${page}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${dialog}</div></div>`;
};
// Decision 4: the cancel question says what happens to the deposit.
const cancelDialog = (late = false) => popup('cancel-title', 'Cancel this booking?', `${DAY}, arrive 09:30 · ${BIKE}`, late
  ? `<p style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span>It’s past [date and time], so <strong>your £[deposit] deposit isn’t refundable</strong>. If something’s gone wrong, call the shop on [shop phone] — they can still refund it.</span></p>`
  : `<p style="margin: 0; display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px; line-height: 1.45">${icon('check', 18)}<span><strong>Your £[deposit] deposit will be refunded</strong> to the card you paid with. It can take [n] working days to show.</span></p>`,
  `${button('Keep my booking', { variant: 'ghost' })}${button(late ? 'Cancel and lose the deposit' : 'Cancel booking', { variant: 'danger' })}`, 520);
const cancelled = () => centred(`<div role="status">${answerCard(`${bigIcon('grey', 'close')}<h1 style="margin: 0; font-size: 26px; font-weight: 700">Your booking is cancelled</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">${DAY}, Standard service for your ${BIKE}. Your £[deposit] deposit is on its way back to your card. We’ve texted you to confirm.</p>${button('Book another time', { variant: 'default' })}${shopLines}`)}</div>`);
// Workshop day 15: the shop can decline with a message; the deposit comes back.
const declined = () => centred(`<div role="status">${answerCard(`${bigIcon('grey', 'alert')}<h1 style="margin: 0; font-size: 26px; font-weight: 700">Sorry, we can’t fit this booking in</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5">A message from North Street Cycles:</p><blockquote style="margin: 0; padding: 12px 16px; border-left: 3px solid ${C.border}; font-size: 15px; line-height: 1.5">“[The shop’s message]”</blockquote>
<p style="margin: 0; font-size: 15px; line-height: 1.5">Nothing is booked. Your £[deposit] deposit is on its way back to your card.</p>${button('Choose another date', { variant: 'default' })}${shopLines}`)}</div>`);
const expired = () => centred(answerCard(`<h1 style="margin: 0; font-size: 24px; font-weight: 700">This booking link has expired</h1><p style="margin: 0; font-size: 15px; line-height: 1.5">It was for ${mono('WH-1042')}, booked for ${DAY}. Links stop working 30 days after the booked date.</p>${button('Book a repair', { variant: 'default' })}${shopLines}`));
const unavailable = () => centred(answerCard(`<h1 style="margin: 0; font-size: 24px; font-weight: 700">Online booking is unavailable just now</h1><p style="margin: 0; font-size: 15px; line-height: 1.5">Please try again in a little while, or call the shop to book.</p>${shopLines}`));

// ---------- Settings › Workshop › Online booking (decision 11) ----------
const sub = (t) => `<h4 style="margin: 8px 0 0; padding-top: 12px; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 700">${t}</h4>`;
const numRow = (id, label, hint, unit, value = '[n]') => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><label for="${id}" style="font-size: 15px; font-weight: 600">${label}</label>${hint ? `<span style="font-size: 13px; color: ${C.muted}">${hint}</span>` : ''}</span><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px"><input id="${id}" value="${value}" style="width: 72px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${unit}</span></div>`;
const choiceRow = (label, opts, on) => `<div role="group" aria-label="${label}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 52px"><span style="font-size: 15px; font-weight: 600">${label}</span><span style="display: flex; flex-wrap: wrap; gap: 8px">${opts.map((o, i) => pill(o, i === on)).join('')}</span></div>`;
const onlineOpen = () => `${sub('How customers book')}
${choiceRow('Customers choose', ['An exact time to arrive', 'A day to drop off'], 0)}
${numRow('notice', 'Earliest booking', 'How soon a customer can book from now', 'hours', '2')}
${rowSwitch('Show prices on the booking page', true)}
${rowSwitch('Confirm bookings automatically', false)}
${note('Off: each booking is a request, purple in the diary until someone accepts it. On: a booking that fits the diary is confirmed straight away. Changing a confirmed booking is always a request.')}
${sub('Deposits')}
${rowSwitch('Take a deposit when booking', true)}
${choiceRow('Deposit', ['A fixed amount', 'A percentage of the price'], 1)}
${numRow('dep-pc', 'How much', '', '%')}
${choiceRow('For', ['Every booking', 'Chosen services'], 0)}
${numRow('cutoff', 'Free to cancel until', 'Before the booked time · after that, or if they don’t come, the shop keeps the deposit', 'hours before', '24')}
${sub('Terms')}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Booking terms</span><span style="font-size: 13px; color: ${C.muted}">Wheelhouse’s standard terms · a copy is kept with each booking</span></span>${button('Use your own', { variant: 'default' })}</div>
${note('Which services can be booked online is set on each service; who can be booked is set on each person, in Mechanics.')}
<div>${link('See your booking page ↗')}</div>`;
const settings = () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ online: onlineOpen() }));

// ---------- The boards ----------
const S = (o = {}) => summaryBox({ service: 'Standard service', price: '£65.00', ...o });
def('bk-service', () => layout(steps(1, [], serviceStep()), S(), false, { top: true }));
def('bk-service-many', () => layout(steps(1, [], serviceStep({ many: true })), S(), false, { top: true }));
def('bk-bike', () => layout(steps(2, [DONE_SERVICE], bikeGuest()), S({ limit: true })));
def('bk-bike-signed-in', () => layout(steps(2, [DONE_SERVICE], bikeSignedIn()), S({ bike: BIKE, limit: true }), true));
def('bk-not-sure', () => layout(steps(2, ['Not sure — we’ll take a look'], bikeNotSure(), 'What have you noticed?'), summaryBox({ service: 'We’ll take a look', price: null })));
def('bk-when', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenAppt()), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-when-full', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenAppt(null, { hoverFull: true })), S({ bike: BIKE, limit: true })));
def('bk-when-dropoff', () => layout(steps(3, [DONE_SERVICE, DONE_BIKE], whenDropoff()), S({ bike: BIKE, when: `${DAY_SHORT}, drop-off`, limit: true })));
def('bk-details', () => layout(steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody()), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-details-deposit', () => layout(steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody({ deposit: true, signedIn: true })), S({ bike: BIKE, when: DONE_WHEN, limit: true, deposit: true }), true));
def('bk-card-failed', () => layout(steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody({ deposit: true, signedIn: true, state: 'card-failed' })), S({ bike: BIKE, when: DONE_WHEN, limit: true, deposit: true }), true));
def('bk-sending', () => layout(steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody({ state: 'sending' })), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-not-sent', () => layout(steps(4, [DONE_SERVICE, DONE_BIKE, DONE_WHEN], detailsBody({ state: 'not-sent' })), S({ bike: BIKE, when: DONE_WHEN, limit: true })));
def('bk-resume', () => resume());
def('bk-request', () => requestReceived());
def('bk-confirmed', () => confirmedNow());
def('bk-page', () => bookingPage());
def('bk-change', () => bookingPage({ state: 'change' }));
def('bk-change-pending', () => bookingPage({ state: 'pending-change' }));
def('bk-cancel', () => bookingPage({ dialog: cancelDialog() }));
def('bk-cancel-late', () => bookingPage({ dialog: cancelDialog(true) }));
def('bk-cancelled', () => cancelled());
def('bk-declined', () => declined());
def('bk-expired', () => expired());
def('bk-unavailable', () => unavailable());
def('bk-settings', () => settings());

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'bk-service': 'Book a repair: every service at once',
  'bk-service-many': 'A shop with many single jobs: search them',
  'bk-bike': 'Your bike, and what to look at',
  'bk-bike-signed-in': 'Signed in: your saved bike',
  'bk-not-sure': 'Not sure what’s wrong: tell us what you’ve noticed',
  'bk-when': 'When: Earliest, then a two-week strip and times',
  'bk-when-full': 'A full day says why',
  'bk-when-dropoff': 'A shop that takes drop-off days: the window and the mechanic',
  'bk-details': 'Your details, and how to send updates',
  'bk-details-deposit': 'A shop that takes a deposit: pay and send',
  'bk-card-failed': 'The card didn’t go through',
  'bk-sending': 'Sending',
  'bk-not-sent': 'Not sent yet — everything kept',
  'bk-resume': 'Coming back: carry on where you left off',
  'bk-request': 'Request received: waiting for the shop',
  'bk-confirmed': 'Confirmed straight away (the shop’s setting)',
  'bk-page': 'Your booking’s own page',
  'bk-change': 'Change the date, in place',
  'bk-change-pending': 'New date waiting for the shop',
  'bk-cancel': 'Cancel: the deposit comes back',
  'bk-cancel-late': 'Cancel after the cut-off: the deposit is kept',
  'bk-cancelled': 'Cancelled',
  'bk-declined': 'The shop couldn’t fit it in',
  'bk-expired': 'The link, 30 days after the booked date',
  'bk-unavailable': 'Online booking unavailable',
  'bk-settings': 'Settings › Workshop › Online booking',
};
export const ROWS = [
  { label: 'Booking', screens: ['bk-service', 'bk-service-many', 'bk-bike', 'bk-bike-signed-in', 'bk-not-sure', 'bk-when', 'bk-when-full', 'bk-when-dropoff', 'bk-details', 'bk-details-deposit'] },
  { label: 'Sending', screens: ['bk-sending', 'bk-card-failed', 'bk-not-sent', 'bk-resume', 'bk-request', 'bk-confirmed'] },
  { label: 'Your booking', screens: ['bk-page', 'bk-change', 'bk-change-pending', 'bk-cancel', 'bk-cancel-late', 'bk-cancelled', 'bk-declined', 'bk-expired', 'bk-unavailable'] },
  { label: 'The shop’s settings', screens: ['bk-settings'] },
];
