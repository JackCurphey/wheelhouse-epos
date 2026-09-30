// Journey 10 — Opening the shop and checking in, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-opening-the-shop-review.md
// UI audit: docs/design/user-journeys/opening-ui-audit.md
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
import { screens as cashScreens } from './cashup.mjs';

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
// No ✕ (audit M1): both ways out are answers, so Today's "float checked by"
// is always true.
const floatCheck = () => popup('fc-title', 'Hello, Jo', 'Till B1 · first in today', `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; text-align: center"><span style="font-size: 15px; color: ${C.muted}">The drawer should have</span>${mono('[£ float]', 'font-size: 30px')}<span style="font-size: 14px; color: ${C.muted}">The shop’s float</span></div>
${note('Have a quick look. If it doesn’t look right, count it — it only takes a minute.')}`, `${button('Count it', { variant: 'default' })}${button('Looks right')}`, 480, { close: false });

// "Count it": the cash-up count (journey 16 decision 3) — a box for each note
// and coin, adding up to a total that can be typed over. Blind counting is on
// for a new shop (Owner setup decision 6), so the expected float isn't shown
// here; "Done counting" stays off until a box has a number (audit H1).
const DENOMS = ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p'];
const denomGrid = () => `<div role="group" aria-label="Count each note and coin" style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 4}, minmax(0, 1fr)); gap: 8px">${DENOMS.map((d) => `<label style="display: flex; align-items: center; gap: 8px; min-height: 52px; box-sizing: border-box; padding: 4px 10px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}"><span style="min-width: 34px; font-size: 15px; font-weight: 700">${d}</span><span style="font-size: 13px; color: ${C.muted}">×</span><input inputmode="numeric" aria-label="Number of ${d}" style="width: 48px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></label>`).join('')}</div>`;
const totalRow = (k, v, { strong = false, first = false, warn = false } = {}) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; ${first ? '' : `border-top: 1px solid ${C.border}`}"><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px; ${strong ? 'font-weight: 700' : ''}; ${warn ? `color: ${C.warnInk}` : ''}">${warn ? icon('alert', 16) : ''}${k}</span>${mono(v, `font-size: ${strong ? 20 : 15}px`)}</div>`;
const offButton = (t) => button(t).replace(/^<(\w+)/, '<$1 disabled aria-disabled="true"').replace('style="', 'style="opacity: 0.45; cursor: not-allowed; ');
const floatCount = () => popup('cnt-title', 'Count the float', 'Till B1 · count every note and coin', `${denomGrid()}
${totalRow('Counted', '[£ counted]', { strong: true })}`, `${button('Back', { variant: 'default' })}${offButton('Done counting')}`, 720);

// The count matches: the pop-up closes, the till is ready, and a short
// "Float checked" message shows (audit H1).
const matched = () => `<div style="position: relative">${tillBase()}<div role="status" style="position: absolute; ${isPhone() ? 'left: 12px; right: 12px; bottom: 112px' : 'left: 50%; bottom: 24px; transform: translateX(-50%)'}; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}Float checked · Till B1 · counted by Jo Taylor</div></div>`;

// A difference: say so, ask why (optional). Short always goes to Needs
// attention; over only when yesterday was closed (audit H1 — otherwise
// "wasn't closed" already explains it).
const floatDiff = (over = false) => popup('diff-title', `The float is ${over ? 'over' : 'short'}`, 'Till B1 · counted by Jo Taylor', `
<div>${totalRow('Should have', '[£ float]', { first: true })}${totalRow('Counted', '[£ counted]')}${totalRow('Difference', `[£] ${over ? 'over' : 'short'}`, { strong: true, warn: true })}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="diff-why" style="font-size: 14px; font-weight: 600">Any idea why? <span style="font-weight: 400; color: ${C.muted}">(optional)</span></label><input id="diff-why" placeholder="[reason]" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>
${note('A manager sees this on Today. The till starts with what you counted.')}`, `${button('Count again', { variant: 'default' })}${button('Start the day')}`, 520);

// ---------- Decision 3: Office › Today ----------
// Each card is a labelled section and its rows a list, so a screen reader
// can move between them (audit L4).
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '', count = 0) => `<section aria-labelledby="t-${slug(title)}" style="display: flex; flex-direction: column; flex-shrink: 0">${card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 17px; font-weight: 700">${title}${count ? ` · ${count}` : ''}</h2>${action}</div>${body}</div>`)}</section>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const warnLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('alert', 18)}</span>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const stat = (k, v, sub) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="font-size: 13px; color: ${C.muted}">${k}</span><span style="font-size: 20px; font-weight: 700">${v}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></div>`;
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
// Decision 4: Staff see Who's in and Workshop today; Tills and Needs
// attention are for owners, managers and anyone with "Can close the day".
// Decision 6: someone due in who hasn't checked in just shows — "Not in yet",
// then "Late" once their start time has passed. No alert, no Needs attention.
// Decision 7: if last night's day was never closed, the till still opens with
// the usual float check; "Wednesday 16 September wasn't closed" goes to Needs
// attention. Audit H2: sales waiting to send go there too (after [n] minutes);
// H3: "Seen" clears a short float in one click.
// Journey 9 decision 3 (refresh): while a shop runs alongside Citrus Lime,
// the weekly "Time to refresh" reminder joins Needs attention for the owner.
export function today({ short = false, seen = false, waiting = false, staff = false, late = false, unclosed = false, refresh = false, uncollected = false, restock = false, as = null } = {}) {
  const tillTag = waiting ? tag('[n] sales waiting to send', 'warn') : seen ? tag('Float short · seen by Jack Lewis', 'grey') : short ? tag('Float short', 'warn') : tag('All sales sent');
  const tills = section('Tills', list([line('Till B1', `Open · float checked by Jo Taylor at [time]`, tillTag)]));
  const who = section('Who’s in', list([line('Jo Taylor', 'Checked in at [time] · Staff', tag('In')), line('Alex Morgan', 'Due in at [start time] · Mechanic', tag(late ? 'Late' : 'Not in yet', 'grey')), line('Jack Lewis', 'Checked in at [time] · Manager', tag('In'))]));
  const work = section('Workshop today', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 8px">${stat('Expected today', '8 bikes', '3 still to arrive')}${stat('Ready to collect', '4', 'In the workshop now')}</div>
<h3 style="margin: 6px 0 0; font-size: 14px; font-weight: 700">Still to arrive</h3>
${list([line('WH-1045 · Jamie Brooks', 'Giant Escape 2 · Gear adjustment', `<span style="font-size: 14px">${mono('10:30')} appointment</span>`), line('WH-1047 · Aisha Khan', 'Cannondale Quick · Safety check', '<span style="font-size: 14px">Drop-off</span>'), line('WH-1042 · Maya Patel', 'Trek Domane AL 3 · Standard service', button('Book in', { variant: 'default' }))])}`, `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Open the diary</a>`);
  const items = [
    short && !seen && line('Till B1’s float was [£] short this morning', 'Counted by Jo Taylor at [time] · “[their reason]”', button('Seen', { variant: 'default' }), warnLead),
    unclosed && line('Wednesday 16 September wasn’t closed', 'Till B1 · yesterday’s takings still to count', button('Close it', { variant: 'default' }), warnLead),
    // Journey 5 decision 4: a ready bike left too long.
    // WH-1050 is the diary's oldest ready job (Mon 14 Sep).
    // Journey 5 audit H4: the number is on the line; "Contacted" records it.
    // The line goes by itself when the bike is handed over.
    uncollected && line('WH-1050 · Aisha Khan — ready since Mon 14 Sep', `Cannondale Quick · reminder sent [date] · ${mono('[phone]')}`, button('Contacted', { variant: 'default' }), warnLead),
    // Journey 13 decision 2: the restock list, for managers.
    restock && line('[n] products running low or selling fast', 'Restock list · Stockroom › Deliveries and orders', button('Restock list', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('purchasing', 18)}</span>`),
    refresh && line('Time to refresh from Citrus Lime', 'Every [day] · last refreshed [date]', button('Refresh now', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('inbox', 18)}</span>`),
    waiting && line('Till B1 has [n] sales waiting to send', 'Waiting more than [n] minutes · they send by themselves when the internet is back', button('Try again', { variant: 'default' }), warnLead),
  ].filter(Boolean);
  const attention = section('Needs attention', items.length ? list(items)
    : `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; border-top: 1px solid ${C.border}; font-size: 15px; color: ${C.muted}">${icon('check', 16)}Nothing needs you right now</div>`, '', items.length);
  const left = staff ? who : `${attention}${tills}${who}`;
  const cols = isPhone() ? `${left}${work}` : `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${work}</div></div>`;
  return page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, Bolton · open [opens]–[closes]')}${cols}</div>`, as || (staff ? STAFF : MANAGER));
}

// "Close it" lands on journey 16's close-the-day page, for yesterday (audit H3).
const closeYesterday = () => cashScreens['eod-count'][SIZE].replace('[today’s date]', 'Wednesday 16 September');

def('op-float-check', () => overlay(tillBase(), floatCheck()));
def('op-float-count', () => overlay(tillBase(), floatCount()));
def('op-float-matched', () => matched());
def('op-float-short', () => overlay(tillBase(), floatDiff()));
def('op-float-over', () => overlay(tillBase(), floatDiff(true)));
def('op-today', () => today());
def('op-today-short', () => today({ short: true }));
def('op-today-seen', () => today({ short: true, seen: true }));
def('op-today-waiting', () => today({ waiting: true }));
def('op-today-unclosed', () => today({ unclosed: true }));
def('op-close-yesterday', () => closeYesterday());
def('op-today-two', () => today({ short: true, unclosed: true }));
def('op-today-staff', () => today({ staff: true }));
def('op-today-late', () => today({ late: true }));

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const size of SIZES) screens[id][size] = withSize(size, () => { SIZE = size; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'op-float-check': 'First in: a one-tap float check',
  'op-float-count': 'Count it: note by note',
  'op-float-matched': 'The count matches: the till is ready',
  'op-float-short': 'The float is short',
  'op-float-over': 'The float is over',
  'op-today': 'Office › Today: the start of the day',
  'op-today-short': 'Today, with a short float to check',
  'op-today-seen': 'Today, after the short float is marked Seen',
  'op-today-waiting': 'Today, with sales waiting to send',
  'op-today-unclosed': 'Today, when yesterday wasn’t closed',
  'op-close-yesterday': '“Close it”: yesterday’s close the day',
  'op-today-two': 'Today, with two things to deal with',
  'op-today-staff': 'Today, as Staff see it',
  'op-today-late': 'Today, when someone due in is late',
};
export const ROWS = [
  { label: 'Opening the till', screens: ['op-float-check', 'op-float-count', 'op-float-matched', 'op-float-short', 'op-float-over'] },
  { label: 'Office › Today', screens: ['op-today', 'op-today-short', 'op-today-seen', 'op-today-waiting', 'op-today-unclosed', 'op-close-yesterday', 'op-today-two', 'op-today-staff', 'op-today-late'] },
];
