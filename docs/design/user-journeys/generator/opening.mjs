// Journey 10 — Opening the shop and checking in, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-opening-the-shop-review.md
//
// Decision 2: the first person to check in gets a one-tap float check;
// "Count it" opens the note-and-coin count from cash-up. Decision 3: Office ›
// Today is the start-of-day overview for owners and managers — Tills, Who's
// in, Workshop today, Needs attention. Real example data only: North Street
// Cycles, Bolton, Till B1, Jo Taylor, Alex Morgan, Jack Lewis, and the
// Workshop Overview's example day (Thursday 17 September: 8 bikes expected,
// 3 still to arrive, 4 ready to collect; WH-1042 Maya Patel, WH-1045 Jamie
// Brooks at 10:30, WH-1047 Aisha Khan dropping off). Everything else is a
// bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { screens as tillScreens } from './till.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const MANAGER = { role: 'M', person: 'Jack Lewis', roleName: 'Manager' };

// The till just after Jo checks in: journey 11's empty sale screen, with Jo
// serving (journey B: PIN check-in).
const tillBase = () => tillScreens['till-empty'][SIZE];

// ---------- Decision 2: the one-tap float check ----------
const floatCheck = () => popup('fc-title', 'Good morning, Jo', 'Till B1 · first in today', `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; text-align: center"><span style="font-size: 15px; color: ${C.muted}">The drawer should have</span>${mono('[£ float]', 'font-size: 30px')}<span style="font-size: 14px; color: ${C.muted}">The shop’s float, left in last night</span></div>
${note('Have a quick look. If it doesn’t look right, count it — it only takes a minute.')}`, `${button('Count it', { variant: 'default' })}${button('Looks right')}`, 480);

// "Count it": the cash-up count (journey 16 decision 3) — a box for each note
// and coin, adding up to a total that can be typed over.
const DENOMS = ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p'];
const denomGrid = () => `<div role="group" aria-label="Count each note and coin" style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 4}, minmax(0, 1fr)); gap: 8px">${DENOMS.map((d) => `<label style="display: flex; align-items: center; gap: 8px; min-height: 48px; box-sizing: border-box; padding: 4px 10px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}"><span style="min-width: 34px; font-size: 15px; font-weight: 700">${d}</span><span style="font-size: 13px; color: ${C.muted}">×</span><input inputmode="numeric" aria-label="Number of ${d}" style="width: 48px; min-height: 40px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></label>`).join('')}</div>`;
const totalRow = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; ${strong ? 'font-weight: 700' : ''}">${k}</span>${mono(v, `font-size: ${strong ? 20 : 15}px`)}</div>`;
const floatCount = () => popup('cnt-title', 'Count the float', 'Till B1 · should be [£ float]', `${denomGrid()}
${totalRow('Counted', '[£ counted]', true)}`, `${button('Back', { variant: 'ghost' })}${button('Done counting')}`, 720);
// A difference: say so, ask why (optional), and it goes to Needs attention.
const floatShort = () => popup('short-title', 'The float is short', 'Till B1 · counted by Jo Taylor', `
${totalRow('Should have', '[£ float]')}${totalRow('Counted', '[£ counted]')}${totalRow('Difference', '[£] short', true)}
<div style="display: flex; flex-direction: column; gap: 6px"><label for="short-why" style="font-size: 14px; font-weight: 600">Any idea why? <span style="font-weight: 400; color: ${C.muted}">(optional)</span></label><input id="short-why" placeholder="e.g. change taken for the window cleaner" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>
${note('A manager sees this on Today. The till starts with what you counted.')}`, `${button('Count again', { variant: 'ghost' })}${button('Start the day')}`, 520);

// ---------- Decision 3: Office › Today ----------
const section = (title, body, action = '') => card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`, 'flex-shrink: 0');
const line = (left, sub, right = '') => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const stat = (k, v, sub) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="font-size: 13px; color: ${C.muted}">${k}</span><span style="font-size: 20px; font-weight: 700">${v}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></div>`;
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
// Decision 4: Staff see Who's in and Workshop today; Tills and Needs
// attention are for owners, managers and anyone with "Can close the day".
// Decision 6: someone due in who hasn't checked in just shows — "Not in yet",
// then "Late" once their start time has passed. No alert, no Needs attention.
// Decision 7: if last night's day was never closed, the till still opens with
// the usual float check; "Yesterday wasn't closed" goes to Needs attention.
function today({ short = false, waiting = false, staff = false, late = false, unclosed = false } = {}) {
  const tills = section('Tills', line('Till B1', `Open · float checked by Jo Taylor at [time]`, waiting ? tag('[n] sales waiting to send', 'warn') : tag(short ? 'Float short' : 'All sent', short ? 'warn' : 'ok')));
  const who = section('Who’s in', `${line('Jo Taylor', 'Checked in at [time] · Staff', tag('In'))}${line('Alex Morgan', 'Due in at [start time] · Mechanic', tag(late ? 'Late' : 'Not in yet', 'grey'))}${line('Jack Lewis', 'Checked in at [time] · Manager', tag('In'))}`);
  const work = section('Workshop today', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 8px">${stat('Expected today', '8 bikes', '3 still to arrive')}${stat('Ready to collect', '4', 'In the workshop now')}</div>
${line('WH-1045 · Jamie Brooks', 'Giant Escape 2 · Gear adjustment', `<span style="font-size: 14px">${mono('10:30')} appointment</span>`)}${line('WH-1047 · Aisha Khan', 'Cannondale Quick · Safety check', '<span style="font-size: 14px">Drop-off</span>')}${line('WH-1042 · Maya Patel', 'Trek Domane AL 3 · Standard service', button('Book in', { variant: 'default' }))}`, `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Open the diary</a>`);
  const attention = section('Needs attention', short
    ? line('Till B1’s float was [£] short this morning', 'Counted by Jo Taylor at [time] · “[their reason]”', button('Check', { variant: 'default' }))
    : unclosed
    ? line('Wednesday 16 September wasn’t closed', 'Till B1 · yesterday’s takings still to count', button('Close it', { variant: 'default' }))
    : `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; border-top: 1px solid ${C.border}; font-size: 15px; color: ${C.muted}">${icon('check', 16)}Nothing needs you right now</div>`);
  const left = staff ? who : `${attention}${tills}${who}`;
  const cols = isPhone() ? `${left}${work}` : `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${work}</div></div>`;
  return page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, Bolton · open [opens]–[closes]')}${cols}</div>`, staff ? STAFF : MANAGER);
}

def('op-float-check', () => overlay(tillBase(), floatCheck()));
def('op-float-count', () => overlay(tillBase(), floatCount()));
def('op-float-short', () => overlay(tillBase(), floatShort()));
def('op-today', () => today());
def('op-today-short', () => today({ short: true }));
def('op-today-waiting', () => today({ waiting: true }));
def('op-today-staff', () => today({ staff: true }));
def('op-today-late', () => today({ late: true }));
def('op-today-unclosed', () => today({ unclosed: true }));

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const size of SIZES) screens[id][size] = withSize(size, () => { SIZE = size; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'op-float-check': 'First in: a one-tap float check',
  'op-float-count': 'Count it: note by note',
  'op-float-short': 'The float is short',
  'op-today': 'Office › Today: the start of the day',
  'op-today-short': 'Today, with a short float to check',
  'op-today-waiting': 'Today, with sales waiting to send',
  'op-today-staff': 'Today, as Staff see it',
  'op-today-late': 'Today, when someone due in is late',
  'op-today-unclosed': 'Today, when yesterday wasn’t closed',
};
export const ROWS = [
  { label: 'Opening the till', screens: ['op-float-check', 'op-float-count', 'op-float-short'] },
  { label: 'Office › Today', screens: ['op-today', 'op-today-short', 'op-today-waiting', 'op-today-staff', 'op-today-late', 'op-today-unclosed'] },
];
