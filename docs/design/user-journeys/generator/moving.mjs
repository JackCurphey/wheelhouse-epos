// Journey 9 — Moving from Citrus Lime, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-moving-from-citrus-lime-review.md
//
// Decision 2: the owner drops in their Citrus Lime export files; Wheelhouse
// matches the columns behind the scenes and shows a plain summary; the owner
// only looks at the few rows that didn't fit, with "Ask us to help" for
// anything odd. Decision 3: a weekly refresh with a reminder while running
// alongside; only what changed comes across, and where both systems changed
// the same thing Citrus Lime wins until switch-over. Decision 4: the move has
// its own page, Office › Moving from Citrus Lime, with three stages.
//
// What Citrus Lime exports is not yet known (Release 2 design §4), so file
// names, columns and every count are bracketed placeholders. The five kinds
// of data are the ones the Release 2 design names: products, stock,
// customers, sales, workshop jobs.
import { C, MONO, icon, button, card } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { sideItem, railItem } from './diary.mjs';
import { today } from './opening.mjs';
import { practiceScreen } from './till.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
// No owner name exists in the example data (as in journey 8).
const OWNER = { role: 'O', person: 'Shop owner', roleName: 'Owner' };

// Decision 4: the page sits under Office, after Today, while the move is on.
// Added to this journey's boards only; the shared sidebar is unchanged.
const MOVE_NAV = ['moving', 'Moving from Citrus Lime', 'inbox'];
function withMoveNav(html, active) {
  if (SIZE === 'desktop') return html.replace(/(<a href="today-desktop\.dc\.html"[\s\S]*?<\/a>)/, `$1${sideItem(MOVE_NAV, active)}`);
  if (SIZE === 'tablet') return html.replace(/(<a href="today-tablet\.dc\.html"[\s\S]*?<\/a>)/, `$1${railItem(['moving', 'Moving', 'inbox'], active)}`);
  return html; // phone: the sidebar is behind the menu button
}
const movePage = (content) => withMoveNav(page('moving', 'Moving from Citrus Lime', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 900px">${stages()}${content}</div>`, OWNER), 'moving');

// ---------- Shared pieces ----------
let STAGE = 0; // 0 Bring your data, 1 Run alongside, 2 Switch over
const STAGES = ['Bring your data', 'Run alongside', 'Switch over'];
function stages() {
  const item = (t, i) => {
    const state = i < STAGE ? 'Done' : i === STAGE ? 'Now' : 'Later';
    const [bg, ink] = i < STAGE ? [C.okBg, C.successInk] : i === STAGE ? [C.ink, '#ffffff'] : [C.mutedBg, C.muted];
    return `<li style="display: flex; align-items: center; gap: 10px; flex: 1 1 0; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid ${i === STAGE ? C.ink : C.border}; background: ${C.panel}" ${i === STAGE ? 'aria-current="step"' : ''}><span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}; font-size: 13px; font-weight: 700">${i < STAGE ? icon('check', 15) : i + 1}</span><span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">${state}</span></span></li>`;
  };
  return `<nav aria-label="Stages of the move"><ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 8px">${STAGES.map(item).join('')}</ol></nav>`;
}
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '') => `<section aria-labelledby="t-${slug(title)}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? '14px' : '16px 20px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`)}</section>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 180px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const link = (t) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const helpLink = link('Ask us to help');
const KINDS = ['Products', 'Stock levels', 'Customers', 'Sales', 'Workshop jobs'];

// ---------- Stage 1: bring your data (decision 2) ----------
// The files to download from Citrus Lime, and one place to drop them all.
const dropZone = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 150px; padding: 18px; box-sizing: border-box; border: 2px dashed ${C.input}; border-radius: 12px; background: ${C.panel}; text-align: center"><span style="font-size: 16px; font-weight: 700">Drop all the files here</span><span style="font-size: 14px; color: ${C.muted}">Wheelhouse works out which file is which</span>${button('Choose files', { variant: 'default' })}</div>`;
const startBoard = () => movePage(`${section('Bring your data from Citrus Lime', `${note('Download these from Citrus Lime, then drop them in together. Nothing in Citrus Lime changes.')}
${list(KINDS.map((k) => line(k, '[Which Citrus Lime export, and where to find it]', tag('Not added yet', 'grey'))))}
${dropZone}`, helpLink)}`);

// Straight after the drop: it starts by itself, no "Import" button.
const progressBoard = () => movePage(section('Bringing your data across', `${note('You can leave this page — Wheelhouse carries on and shows the result here.')}
${list([
    line('Products', '[file name]', tag('Done')),
    line('Stock levels', '[file name]', tag('Done')),
    line('Customers', `[file name] · ${mono('[n]')} of ${mono('[n]')}`, tag('Bringing across', 'grey')),
    line('Sales', '[file name]', tag('Waiting', 'grey')),
    line('Workshop jobs', 'Not added — you can add it later', link('Add it')),
  ])}`));

// The plain summary: what came across, and how many need a look.
const count = (n) => mono(n, 'font-size: 15px');
const summaryBoard = () => movePage(`${section('Here’s what came across', `${list([
    line('Products', `${count('[n]')} brought across`, tag('All in')),
    line('Stock levels', `${count('[n]')} brought across`, tag('All in')),
    line('Customers', `${count('[n]')} brought across`, tag('[n] need a look', 'warn')),
    line('Sales', `${count('[n]')} brought across, back to [date]`, tag('All in')),
    line('Workshop jobs', `${count('[n]')} brought across`, tag('[n] need a look', 'warn')),
  ])}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px">${helpLink}<span style="display: flex; flex-wrap: wrap; gap: 8px">${button('Next: run alongside', { variant: 'default' })}${button('Look at the [n]')}</span></div>`)}`);

// The rows that didn't fit: say why, fix it or leave it out.
const fixRow = (what, why) => line(what, why, `<span style="display: flex; gap: 8px">${button('Leave it out', { variant: 'default' })}${button('Fix', { variant: 'default' })}</span>`);
const fixBoard = () => movePage(`${section('[n] need a look', `${note('Everything else is in. These didn’t fit, so they’re waiting for you — leave any out and add it by hand later.')}
<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Customers · [n]</h3>
${list([fixRow('[Customer name]', 'Looks like the same person as [customer name]'), fixRow('[Customer row]', 'No name')])}
<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Workshop jobs · [n]</h3>
${list([fixRow('[Job number]', 'The customer on this job isn’t in the customers file')])}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px">${helpLink}${button('Done for now')}</div>`)}`);

// ---------- Stage 2: run alongside, with a weekly refresh (decision 3) ----------
const todayRefresh = () => withMoveNav(today({ refresh: true, as: OWNER }), 'today');
const alongsideBoard = () => movePage(`${section('Weekly refresh', `${list([
    line('Every [day]', 'Last refreshed [date] · next [date]', `<span style="display: flex; gap: 8px">${button('Change day', { variant: 'default' })}${button('Refresh now')}</span>`),
  ])}
${note('Download the same files from Citrus Lime and drop them in. Only what changed comes across — nothing you did in Wheelhouse is overwritten.')}`)}
${section('What the last refresh changed', `${list([
    line('New products', count('[n]')),
    line('Price changes', count('[n]')),
    line('New customers', count('[n]')),
    line('Changed in both — Citrus Lime’s kept', count('[n]'), link('See them')),
  ])}`)}`);

// Decision 5: after each refresh, last week's totals from Wheelhouse beside
// a box for Citrus Lime's figure; a tick or the difference, and a record of
// the weeks that matched.
const CHECKS = ['Sales total', 'Number of sales', 'Stock value', 'Number of customers'];
const money = (k) => k === 'Sales total' || k === 'Stock value';
const checkCols = () => isPhone() ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)';
function checkRow(k, result) {
  const id = `cl-${slug(k)}`;
  const fig = mono(money(k) ? '£[figure]' : '[figure]', 'font-size: 15px');
  const box = result ? fig
    : `<input id="${id}" inputmode="decimal" aria-label="Citrus Lime’s ${k.toLowerCase()}" placeholder="${money(k) ? '£' : ''}" style="width: 140px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">`;
  const verdict = !result ? '<span></span>' : k === 'Stock value' ? `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${tag('[£] different', 'warn')}${helpLink}</span>` : `<span>${tag('Matches')}</span>`;
  // Phone: no column headings, so each figure says whose it is.
  const who = (t) => isPhone() ? `<span style="color: ${C.muted}">${t}</span> ` : '';
  return `<div role="listitem" style="display: grid; grid-template-columns: ${checkCols()}; gap: ${isPhone() ? 6 : 12}px; align-items: center; min-height: 60px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><label for="${id}" style="font-size: 15px; font-weight: 600">${k}</label><span style="font-size: 14px">${who('Wheelhouse')}${fig}</span><span style="display: flex; align-items: center; gap: 8px; font-size: 14px">${who('Citrus Lime')}${box}</span>${verdict}</div>`;
}
const checkHead = () => isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${checkCols()}; gap: 12px; padding: 4px 0; font-size: 13px; font-weight: 700; color: ${C.muted}"><span></span><span>Wheelhouse</span><span>Citrus Lime</span><span></span></div>`;
const checkSection = (result) => section('Check last week against Citrus Lime', `${note(result ? '3 of 4 match. The weeks that match build up the case for switching over.' : 'Type in the same four figures from Citrus Lime’s reports for [date]–[date].')}
${checkHead()}<div role="list">${CHECKS.map((k) => checkRow(k, result)).join('')}</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px">${result ? `<span style="font-size: 14px; color: ${C.muted}">Weeks that matched: ${mono('[n]')} of ${mono('[n]')}</span>${button('Check again', { variant: 'default' })}` : `<span></span>${button('Check')}`}</div>`);

// Where both changed the same thing: Citrus Lime wins until switch-over,
// and the owner is told what was kept.
const bothRow = (what, cl, wh) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)'}; gap: ${isPhone() ? 4 : 12}px; align-items: center; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">${what}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px"><span><span style="color: ${C.muted}">Citrus Lime:</span> ${cl}</span>${tag('Kept')}</span><span style="font-size: 14px; color: ${C.muted}">Wheelhouse: <s>${wh}</s></span></div>`;
const bothPopup = () => popup('both-title', 'Changed in both', 'Refresh on [date] · Citrus Lime’s version kept until you switch over', `${note('While you run alongside, Citrus Lime is the one that counts. After switch-over, Wheelhouse is.')}
<div role="list">${bothRow('[Product] · price', mono('£[price]'), mono('£[price]'))}${bothRow('[Customer] · phone', '[phone]', '[phone]')}</div>`, `<span></span>${button('Got it')}`, 720);
const bothBoard = () => overlay(alongsideBoard(), bothPopup());

// ---------- Decision 7: switch over — a checklist that ticks itself ----------
// Then the owner picks the day; that morning: one last refresh, practice
// sales cleared, tills made real; then the first full trading week.
const tick = (done) => `<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 2px solid ${C.input}; box-sizing: border-box`}">${done ? icon('check', 15) : ''}</span>`;
const readyRow = (t, sub, done, action = '') => line(t, sub, done ? tag('Done') : `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${tag('Not yet', 'grey')}${action}</span>`, tick(done));
const offBtn = (t) => button(t).replace(/^<(\w+)/, '<$1 disabled aria-disabled="true"').replace('style="', 'style="opacity: 0.45; cursor: not-allowed; ');
const READY = (all) => [
  readyRow('The weekly check matched [n] weeks in a row', '[n] of [n] so far', true),
  readyRow('The card machine is connected', 'Settings › Payments', true),
  readyRow('Everyone has made a practice sale', all ? 'Jo Taylor, Alex Morgan, Jack Lewis' : 'Jo Taylor and Jack Lewis have · Alex Morgan hasn’t yet', all, link('Remind Alex')),
  readyRow('The website is moved', 'Website', all, link('Open Website')),
];
const readyBoard = (all) => movePage(section('Before you switch over', `${note(all ? 'Everything’s ready. Pick the day — it can be any day the shop is open.' : 'Each of these ticks itself when it’s done. Once they’re all ticked, you pick the day.')}
${list(READY(all))}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px">${helpLink}${all ? button('Pick the day') : offBtn('Pick the day')}</div>`));
const pickDay = () => popup('day-title', 'Pick switch-over day', 'Everything on the checklist is ticked', `<div style="display: flex; flex-direction: column; gap: 6px"><label for="sw-day" style="font-size: 14px; font-weight: 600">Switch over on</label><input id="sw-day" type="text" value="[date]" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">That morning</span><ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; line-height: 1.5"><li>One last refresh from Citrus Lime</li><li>Practice sales are cleared</li><li>The tills take real money</li></ol></div>
${note('Keep Citrus Lime until the first full week — including a weekend — is done on Wheelhouse.')}`, `${button('Back', { variant: 'default' })}${button('Switch over on [date]')}`, 560);
// The morning: three steps, one after another.
const stepRow = (n, t, sub, state, action = '') => line(t, sub, state === 'done' ? tag('Done') : state === 'now' ? action : tag('Next', 'grey'), `<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; ${state === 'done' ? `background: ${C.okBg}; color: ${C.successInk}` : state === 'now' ? `background: ${C.ink}; color: #ffffff` : `background: ${C.mutedBg}; color: ${C.muted}`}">${state === 'done' ? icon('check', 15) : n}</span>`);
const morningBoard = () => movePage(section('Switch-over day · [date]', `${note('Do this before the first sale of the day. It takes a few minutes.')}
${list([
    stepRow(1, 'One last refresh from Citrus Lime', 'Last night’s files · only what changed comes across', 'done'),
    stepRow(2, 'Clear the practice sales', `${mono('[n]')} practice sales · they were never real money`, 'now', button('Clear them')),
    stepRow(3, 'Make the tills real', 'The practice band goes from every till', 'next'),
  ])}`, helpLink));
// The first full trading week, including a weekend (the finish line).
const DAYS7 = [1, 2, 3, 4, 5, 6, 7].map((n) => `Day ${n}`); // from switch-over day, whichever day that is
const dayBox = (d, i) => { const done = i < 4, today = i === 4; return `<li style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1 1 0; min-width: 0; padding: 10px 4px; border-radius: 10px; border: 1px solid ${today ? C.ink : C.border}; background: ${C.panel}" ${today ? 'aria-current="date"' : ''}><span style="font-size: 14px; font-weight: 700">${d}</span>${done ? `<span style="display: inline-flex; color: ${C.successInk}">${icon('check', 18)}</span><span style="font-size: 12px; color: ${C.muted}">Traded</span>` : `<span style="font-size: 12px; color: ${C.muted}">${today ? 'Today' : 'To come'}</span>`}</li>`; };
const weekBoard = () => movePage(`${section('Your first week on Wheelhouse', `${note('Day 5 of 7. When the week — weekend included — is done, you can switch Citrus Lime off.')}
<ol aria-label="The first trading week" style="margin: 0; padding: 0; list-style: none; display: flex; gap: 8px">${DAYS7.map(dayBox).join('')}</ol>
${list([line('Citrus Lime', 'Keep it until [date] · nothing needs doing in it', tag('Still on', 'grey'))])}`, helpLink)}`);

// ---------- Decision 6: every till is in practice until switch-over ----------
// The card machine isn't used: the practice card step lets staff try both
// outcomes. Totals come from journey 11's example sale.
const practiceCard = () => popup('pc-title', 'Card payment · £74.00 · practice', 'The card machine isn’t used in practice', `${note('Try what happens either way. Nothing is charged and nothing goes in the drawer.')}`, `${button('Pretend it’s declined', { variant: 'default' })}${button('Pretend it’s paid')}`, 520);
def('mv-practice-sale', () => practiceScreen('till-sale', SIZE));
def('mv-practice-card', () => overlay(practiceScreen('till-sale', SIZE), practiceCard()));

def('mv-ready', () => { STAGE = 2; return readyBoard(false); });
def('mv-ready-all', () => { STAGE = 2; return readyBoard(true); });
def('mv-pick-day', () => { STAGE = 2; return overlay(readyBoard(true), pickDay()); });
def('mv-morning', () => { STAGE = 2; return morningBoard(); });
def('mv-week', () => { STAGE = 2; return weekBoard(); });
def('mv-start', () => { STAGE = 0; return startBoard(); });
def('mv-progress', () => { STAGE = 0; return progressBoard(); });
def('mv-summary', () => { STAGE = 0; return summaryBoard(); });
def('mv-fix', () => { STAGE = 0; return fixBoard(); });
def('mv-today-refresh', () => todayRefresh());
def('mv-alongside', () => { STAGE = 1; return alongsideBoard(); });
def('mv-both', () => { STAGE = 1; return bothBoard(); });
def('mv-check', () => { STAGE = 1; return movePage(checkSection(false)); });
def('mv-check-result', () => { STAGE = 1; return movePage(checkSection(true)); });

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const size of SIZES) screens[id][size] = withSize(size, () => { SIZE = size; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'mv-start': 'Bring your data: the files to drop in',
  'mv-progress': 'Bringing it across (starts by itself)',
  'mv-summary': 'Here’s what came across',
  'mv-fix': 'The few that need a look',
  'mv-today-refresh': 'Today: time to refresh from Citrus Lime',
  'mv-alongside': 'Run alongside: the weekly refresh',
  'mv-both': 'Changed in both: Citrus Lime’s kept',
  'mv-check': 'The weekly check: type in Citrus Lime’s figures',
  'mv-check-result': 'The weekly check: three match, one doesn’t',
  'mv-practice-sale': 'The till before switch-over: practice, not real money',
  'mv-practice-card': 'A practice card payment: try either outcome',
  'mv-ready': 'Switch over: the checklist, two still to do',
  'mv-ready-all': 'Switch over: everything ticked',
  'mv-pick-day': 'Pick switch-over day',
  'mv-morning': 'Switch-over morning: last refresh, clear practice, tills real',
  'mv-week': 'The first full week on Wheelhouse',
};
export const ROWS = [
  { label: 'Bring your data', screens: ['mv-start', 'mv-progress', 'mv-summary', 'mv-fix'] },
  { label: 'Run alongside', screens: ['mv-today-refresh', 'mv-alongside', 'mv-both', 'mv-check', 'mv-check-result'] },
  { label: 'Practice at the till', screens: ['mv-practice-sale', 'mv-practice-card'] },
  { label: 'Switch over', screens: ['mv-ready', 'mv-ready-all', 'mv-pick-day', 'mv-morning', 'mv-week'] },
];
