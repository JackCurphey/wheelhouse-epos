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
import { page, note, popup, overlay, withSize, isPhone, MANAGER } from './settings-frame.mjs';
import { sideItem, railItem, screens as diaryScreens } from './diary.mjs';
import { today } from './opening.mjs';
import { practiceScreen } from './till.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
// UX walk-through 4 L1: the move's boards are signed in as Jack Lewis, the
// Owner in every example (settings-frame.mjs MANAGER), not "Shop owner".
const OWNER = MANAGER;

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
let SWITCHED = false; // Run alongside carries on until switch-over day (audit H1)
const STAGES = ['Bring your data', 'Run alongside', 'Switch over'];
function stages() {
  const item = (t, i) => {
    const running = i === 1 && STAGE === 2 && !SWITCHED;
    const done = i < STAGE && !running;
    const state = running ? 'Still running' : done ? 'Done' : i === STAGE ? 'Now' : 'Later';
    const [bg, ink] = done ? [C.okBg, C.successInk] : i === STAGE ? [C.ink, '#ffffff'] : [C.mutedBg, C.muted];
    // Phone: three compact boxes in a row. UX walk-through 4 L3: the state is
    // shown in words under each stage's name at 13px, as on tablet, so Run
    // alongside "Still running" doesn't look like Later.
    if (isPhone()) return `<li style="display: flex; flex: 1 1 0; min-width: 0"><a href="#stage-${i + 1}" ${i === STAGE ? 'aria-current="step"' : ''} style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; flex-grow: 1; min-width: 0; min-height: 64px; box-sizing: border-box; padding: 8px; border-radius: 10px; border: 1px solid ${i === STAGE ? C.ink : C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="display: inline-flex; width: 24px; height: 24px; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700">${done ? icon('check', 13) : i + 1}</span><span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 13px; font-weight: 700; line-height: 1.25">${t}</span><span style="font-size: 13px; line-height: 1.25; color: ${C.muted}">${state}</span></span></a></li>`;
    // Audit H1: each stage is a link to its part of the page.
    return `<li style="display: flex; flex: 1 1 0; min-width: 0"><a href="#stage-${i + 1}" ${i === STAGE ? 'aria-current="step"' : ''} style="display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 0; min-height: 56px; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid ${i === STAGE ? C.ink : C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}; font-size: 13px; font-weight: 700">${done ? icon('check', 15) : i + 1}</span><span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">${state}</span></span></a></li>`;
  };
  return `<nav aria-label="Stages of the move"><ol style="margin: 0; padding: 0; list-style: none; display: flex; gap: ${isPhone() ? 6 : 8}px">${STAGES.map(item).join('')}</ol></nav>`;
}
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '') => `<section aria-labelledby="t-${slug(title)}" style="flex-shrink: 0">${card(`<div style="padding: ${isPhone() ? '14px' : '16px 20px'}; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 18px; font-weight: 700">${title}</h2>${action}</div>${body}</div>`)}</section>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}; ${isPhone() ? 'flex-wrap: wrap' : ''}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 180px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const link = (t) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
// Audit L2: "Ask us to help" always sits top right of the card it helps with.
const helpLink = link('Ask us to help');
const srOnly = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
const named = (html, label) => html.replace(/^<(\w+)/, `<$1 aria-label="${label}"`);
const offBtn = (t) => button(t).replace(/^<(\w+)/, '<$1 aria-disabled="true"').replace('style="', 'style="opacity: 0.45; cursor: not-allowed; ');
const smallDrop = (t) => `<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; min-height: 64px; padding: 10px 14px; box-sizing: border-box; border: 2px dashed ${C.input}; border-radius: 12px; background: ${C.panel}"><span style="font-size: 15px; font-weight: 700">${t}</span>${button('Choose files', { variant: 'default' })}</div>`;
const KINDS = ['Products', 'Stock levels', 'Customers', 'Sales', 'Workshop jobs'];

// ---------- Stage 1: bring your data (decision 2) ----------
// The files to download from Citrus Lime, and one place to drop them all.
const dropZone = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 150px; padding: 18px; box-sizing: border-box; border: 2px dashed ${C.input}; border-radius: 12px; background: ${C.panel}; text-align: center"><span style="font-size: 16px; font-weight: 700">Drop all the files here</span><span style="font-size: 14px; color: ${C.muted}">Wheelhouse works out which file is which</span>${button('Choose files', { variant: 'default' })}</div>`;
const startBoard = () => movePage(`${section('Bring your data from Citrus Lime', `${note('Download these from Citrus Lime, then drop them in together. Nothing in Citrus Lime changes.')}
${list(KINDS.map((k) => line(k, '[Which Citrus Lime export, and where to find it]', tag('Not added yet', 'grey'))))}
${dropZone}`, helpLink)}`);

// Straight after the drop: it starts by itself, no "Import" button.
// Audit M4: progress is announced, help is at hand, and a file Wheelhouse
// can't read says so and asks for another.
const progressBoard = (failed = false) => movePage(section('Bringing your data across', `${note('You can leave this page — Wheelhouse carries on and shows the result here.')}
<div role="status" aria-live="polite">${list([
    line('Products', '[file name]', tag('Done')),
    line('Stock levels', '[file name]', tag('Done')),
    failed
      ? line('Customers', '[file name] · Wheelhouse couldn’t read this file', `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${tag('Couldn’t read it', 'warn')}${button('Choose another file', { variant: 'default' })}</span>`)
      : line('Customers', `[file name] · ${mono('[n]')} of ${mono('[n]')}`, tag('Bringing across', 'grey')),
    line('Sales', '[file name]', tag(failed ? 'Bringing across' : 'Waiting', 'grey')),
    line('Workshop jobs', '[file name]', tag('Waiting', 'grey')),
  ])}</div>`, helpLink));

// The plain summary: what came across, and how many need a look.
const count = (n) => mono(n, 'font-size: 15px');
// Audit M5's line on what running alongside does to the tills is gone:
// practice mode is dropped (Moving from Citrus Lime, later change, issue #116
// question 4; "Draw the decisions" MV2).
const summaryBoard = () => movePage(`${section('Here’s what came across', `${list([
    line('Products', `${count('[n]')} brought across`, tag('All in')),
    line('Stock levels', `${count('[n]')} brought across`, tag('All in')),
    line('Customers', `${count('[n]')} brought across`, tag('[n] need a look', 'warn')),
    line('Sales', `${count('[n]')} brought across, back to [date]`, tag('All in')),
    line('Workshop jobs', `${count('[n]')} brought across`, tag('[n] need a look', 'warn')),
  ])}
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 6px">${button('Next: run alongside', { variant: 'default' })}${button('Look at the [n]')}</div>`, helpLink)}`);

// The rows that didn't fit: say why, fix it or leave it out.
const fixRow = (what, why) => line(what, why, `<span style="display: flex; gap: 8px">${named(button('Leave it out', { variant: 'default' }), `Leave out ${what}`)}${named(button('Fix', { variant: 'default' }), `Fix ${what}`)}</span>`);
const fixBoard = () => movePage(`${section('[n] need a look', `${note('Everything else is in. These didn’t fit, so they’re waiting for you — leave any out and add it by hand later.')}
<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Customers · [n]</h3>
${list([fixRow('[Customer name]', 'Looks like the same person as [customer name]'), fixRow('[Customer row]', 'No name')])}
<h3 style="margin: 4px 0 0; font-size: 15px; font-weight: 700">Workshop jobs · [n]</h3>
${list([fixRow('[Job number]', 'The customer on this job isn’t in the customers file')])}
<div style="display: flex; justify-content: flex-end; padding-top: 6px">${button('Done for now')}</div>`, helpLink)}`);
// Audit M3: when every row is fixed or left out.
const sortedBoard = () => movePage(section('Everything’s sorted', `${note('Everything that fitted is in. The ones you left out are listed under Settings › Office › Your data, to add by hand when you like.')}
${list([line('Left out', `${count('[n]')} rows`, link('See them'))])}
<div style="display: flex; justify-content: flex-end; padding-top: 6px">${button('Next: run alongside')}</div>`, helpLink));

// ---------- Stage 2: run alongside, with a weekly refresh (decision 3) ----------
// Today with the refresh card. Practice mode is dropped (issue #116 question
// 4; "Draw the decisions" MV7), so the Tills card is the usual one.
const todayRefresh = () => withMoveNav(today({ refresh: true, practice: false, as: OWNER }), 'today');
// Audit M1: the refresh drop zone is on the card; Today's "Refresh now"
// opens it. H3: the note says what "Changed in both" does.
// UX walk-through 4 M5: the refresh remembers every import decision, and says
// how many rows are still left out. H3 (option 1): no automatic messages to
// customers until switch-over day; a job or booking says "Not sent — before
// switch-over". M4's practice Tills section is gone: practice mode is dropped
// (issue #116 question 4; "Draw the decisions" MV1).
const alongsideBoard = () => movePage(`${section('Weekly refresh', `${list([
    line('Every [day]', 'Last refreshed [date] · next [date]', link('Change day')),
  ])}
${smallDrop('Drop this week’s files here')}
${note('Download the same files from Citrus Lime. Only what changed comes across, and what you did in Wheelhouse stays — except where both changed the same thing: Citrus Lime’s kept until switch-over.')}
${note('Every refresh remembers what you decided when you brought your data across. Rows you left out stay out, and their changes don’t come in. A customer you merged takes changes from both Citrus Lime records.')}`, helpLink)}
${section('Messages to customers', list([line('None go out until switch-over day', 'Where one would have gone, the job or booking says “Not sent — before switch-over” · you can still send one by hand', tag('Off', 'grey'))]))}
${section('What the last refresh changed', `${list([
    line('Came across', `${count('[n]')} new products · ${count('[n]')} price changes · ${count('[n]')} new customers`),
    line('Changed in both — Citrus Lime’s kept', count('[n]'), link('See them')),
    line('Left out when you brought your data across', `${count('[n]')} still left out · their changes weren’t brought in`, link('See them')),
  ])}`)}`);

const dayPill = (t) => `<button type="button" aria-pressed="false" style="min-width: 64px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 15px; font-weight: 600">${t}</button>`;
const changeDay = () => popup('cd-title', 'Refresh day', 'Now every [day]', `<div role="group" aria-label="Day of the week" style="display: flex; flex-wrap: wrap; gap: 8px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dayPill).join('')}</div>
${note('Today reminds you on this day.')}`, `${button('Cancel', { variant: 'default' })}${button('Save')}`, 560);

// Decision 5: after each refresh, last week's totals from Wheelhouse beside
// a box for Citrus Lime's figure; a tick or the difference, and a record of
// the weeks that matched.
const CHECKS = ['Sales total', 'Number of sales', 'Stock value', 'Number of customers'];
const money = (k) => k === 'Sales total' || k === 'Stock value';
const checkCols = () => isPhone() ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)';
function checkRow(k, result, typed = false) {
  const id = `cl-${slug(k)}`;
  const fig = mono(money(k) ? '£[figure]' : '[figure]', 'font-size: 15px');
  const shown = result || typed;
  const box = shown ? fig
    : `<input id="${id}" inputmode="decimal" aria-label="Citrus Lime’s ${k.toLowerCase()}" placeholder="${money(k) ? '£' : ''}" style="width: 140px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">`;
  const verdict = !shown ? '<span></span>' : k === 'Stock value' ? `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${tag('[£] different', 'warn')}${helpLink}</span>` : `<span>${tag('Matches')}</span>`;
  // Phone: no column headings, so each figure says whose it is.
  const who = (t) => isPhone() ? `<span style="color: ${C.muted}">${t}</span> ` : srOnly(`${t} `);
  return `<div role="listitem" style="display: grid; grid-template-columns: ${checkCols()}; gap: ${isPhone() ? 6 : 12}px; align-items: center; min-height: 60px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><label for="${id}" style="font-size: 15px; font-weight: 600">${k}</label><span style="font-size: 14px">${who('Wheelhouse')}${fig}</span><span style="display: flex; align-items: center; gap: 8px; font-size: 14px">${who('Citrus Lime')}${box}</span>${verdict}</div>`;
}
const checkHead = () => isPhone() ? '' : `<div aria-hidden="true" style="display: grid; grid-template-columns: ${checkCols()}; gap: 12px; padding: 4px 0; font-size: 13px; font-weight: 700; color: ${C.muted}"><span></span><span>Wheelhouse</span><span>Citrus Lime</span><span></span></div>`;
// Audit M2: each row checks itself as its figure goes in — no Check button.
// H2: a week counts only when all four match.
const checkSection = (result) => section('Check last week against Citrus Lime', `${note(result ? '3 of 4 match, so this week doesn’t count yet. A week counts when all four match.' : 'Type in the same four figures from Citrus Lime’s reports for [date]–[date]. Each one checks itself.')}
${checkHead()}<div role="list" aria-live="polite">${CHECKS.map((k, i) => checkRow(k, result, !result && i < 2)).join('')}</div>
<p style="margin: 0; padding-top: 6px; font-size: 14px; color: ${C.muted}">Weeks in a row that matched: ${mono(result ? '0' : '[n]')} of ${mono('2')}</p>`, helpLink);

// Where both changed the same thing: Citrus Lime wins until switch-over,
// and the owner is told what was kept.
const bothRow = (what, cl, wh) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)'}; gap: ${isPhone() ? 4 : 12}px; align-items: center; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">${what}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px"><span><span style="color: ${C.muted}">Citrus Lime:</span> ${cl}</span>${tag('Kept')}</span><span style="font-size: 14px; color: ${C.muted}">Wheelhouse: <s>${wh}</s></span></div>`;
const bothPopup = () => popup('both-title', 'Changed in both', 'Refresh on [date] · Citrus Lime’s version kept until you switch over', `${note('While you run alongside, Citrus Lime is the one that counts. After switch-over, Wheelhouse is.')}
<div role="list">${bothRow('[Product] · price', mono('£[price]'), mono('£[price]'))}${bothRow('[Customer] · phone', '[phone]', '[phone]')}</div>`, `<span></span>${button('Got it')}`, 720);
const bothBoard = () => overlay(alongsideBoard(), bothPopup());

// ---------- Decision 7: switch over — a checklist that ticks itself ----------
// Then the owner picks the day; that morning: one last refresh, then the
// website goes on; the tills are real from the first sale (issue #116
// question 4); then the first full trading week.
const tick = (done) => `<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; ${done ? `background: ${C.okBg}; color: ${C.successInk}` : `border: 2px solid ${C.input}; box-sizing: border-box`}">${done ? icon('check', 15) : ''}</span>`;
// Audit L2: the chip first, then any link, on every row.
const readyRow = (t, sub, done, action = '') => line(t, sub, `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">${done ? tag('Done') : tag('Not yet', 'grey')}${action}</span>`, tick(done));
// Decision 8: the owner picks how many matching weeks, 2 by default.
const weekPill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-width: 64px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 15px; font-weight: 600">${t}</button>`;
const weeksPopup = () => popup('wk-title', 'Matching weeks before switch-over', 'The weekly check must match this many weeks in a row', `<div role="group" aria-label="Weeks in a row" style="display: flex; flex-wrap: wrap; gap: 8px">${weekPill('2', true)}${weekPill('3')}${weekPill('4')}${weekPill('Other…')}</div>
${note('2 proves a refresh came across cleanly twice running. More weeks take in a month-end, but the move takes longer.')}`, `${button('Cancel', { variant: 'default' })}${button('Save')}`, 520);
// H2 (option 1): the website is made ready, not moved — it goes on during
// switch-over morning (this changes what Moving 7's fourth item means). It
// ticks once no Words and photos row says Check this (Website management,
// 3 Oct, walk-through 4 H3: one rule for this list and Getting started).
// M1: items shared with Getting started tick together, from the same
// setting, and say so. M4: "A float is set" joins the list.
const SHARED = 'also on Getting started';
const READY = (all) => [
  readyRow('The weekly check matched 2 weeks in a row', '2 of 2 so far', true, link('Change')),
  readyRow('The card machine is connected', `Settings › Front desk › Payments · ${SHARED}`, true),
  readyRow('A float is set', `Settings › Front desk › End of day · ${SHARED}`, true),
  readyRow('The website is ready', `It goes on during switch-over morning · until then only your staff can see it · ${SHARED}`, all, all ? '' : link('Open Website')),
];
// "Everyone has made a practice sale" is gone: practice mode is dropped
// (issue #116 question 4; "Draw the decisions" MV3).
const READY_COUNT = (all) => all ? 4 : 3; // ticked, of the 4 above
const readyBoard = (all) => movePage(section('Before you switch over', `${note(all ? 'Everything’s ready. Pick the day — it can be any day the shop is open.' : 'Each of these ticks itself when it’s done. Once they’re all ticked, you pick the day.')}
<p role="status" style="margin: 0; font-size: 14px; font-weight: 600">Ready to switch over: ${mono(String(READY_COUNT(all)))} of ${mono('4')}</p>
${list(READY(all))}
<div style="display: flex; justify-content: flex-end; padding-top: 6px">${all ? button('Pick the day') : offBtn('Pick the day')}</div>`, helpLink));
// Audit M6: the next days the shop is open, the first already chosen.
const openDay = (on) => `<button type="button" aria-pressed="${on}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; padding: 8px 14px; border-radius: 10px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; text-align: left"><span style="font-size: 15px; font-weight: 700">[day]</span><span style="font-size: 13px">[date]</span></button>`;
const pickDay = () => popup('day-title', 'Pick switch-over day', 'Everything on the checklist is ticked', `<div role="group" aria-labelledby="sw-day" style="display: flex; flex-direction: column; gap: 8px"><span id="sw-day" style="font-size: 14px; font-weight: 600">Switch over on</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${openDay(true)}${openDay(false)}${openDay(false)}${openDay(false)}</div>${link('Another day…')}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">That morning</span><ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; line-height: 1.5"><li>One last refresh from Citrus Lime</li><li>The tills take real money and messages to customers start</li><li>Your website goes on</li></ol></div>
${note('Keep Citrus Lime until the first full week — including a weekend — is done on Wheelhouse.')}`, `${button('Cancel', { variant: 'default' })}${button('Switch over on [date]')}`, 600);
// The morning: two steps, one after another ("Draw the decisions" MV5: no
// "Clear and go real", issue #116 question 4; MV6: no own-address step,
// Website management, later change, question 3).
// UX walk-through 4 H2 (option 1): turning the website on is the last step;
// Citrus Lime's website keeps selling until then. H3 (option 1): messages to
// customers start on switch-over day, with no backlog. M4: the first person in
// counts the float ("Count it" only — op-float-check-first).
const stepRow = (n, t, sub, state, action = '') => line(t, sub, state === 'done' ? tag('Done') : state === 'now' ? action : tag('Next', 'grey'), `<span style="display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; ${state === 'done' ? `background: ${C.okBg}; color: ${C.successInk}` : state === 'now' ? `background: ${C.ink}; color: #ffffff` : `background: ${C.mutedBg}; color: ${C.muted}`}">${state === 'done' ? icon('check', 15) : n}</span>`);
const morningBoard = () => movePage(section('Switch-over day · [date]', `${note('Do this before the first sale of the day. It takes a few minutes.')}
${list([
    stepRow(1, 'One last refresh from Citrus Lime', 'Last night’s files · only what changed comes across', 'done'),
    stepRow(2, 'Turn your website on', 'Customers can buy and book on it from now', 'now', button('Turn it on')),
  ])}
${note('The tills take real money and messages to customers start. The first person to check in counts the float — nothing has been counted in Wheelhouse before.')}`, helpLink));
// Audit M7: one act, confirmed once. Dropped with practice mode (issue #116
// question 4); only mv-go-real uses it.
const goReal = () => popup('real-title', 'Clear practice sales and go real?', 'Switch-over day · [date]', `${note('The [n] practice sales are deleted — they were never real money. From now on every till takes real money and the card machine is used. Messages to customers start too — nothing is sent for anything before today.')}`, `${button('Cancel', { variant: 'default' })}${button('Clear and go real')}`, 560);

// The first full trading week, including a weekend (the finish line).
const DAYS7 = [1, 2, 3, 4, 5, 6, 7].map((n) => `Day ${n}`); // from switch-over day, whichever day that is
const dayBox = (d, i, all = false) => { const done = all || i < 4, today = !all && i === 4;
  if (isPhone()) return `<li style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; border-radius: 10px; border: 1px solid ${today ? C.ink : C.border}; background: ${C.panel}" ${today ? 'aria-current="date"' : ''}><span style="font-size: 15px; font-weight: 700">${d}</span><span style="font-size: 13px; color: ${C.muted}; flex-grow: 1">[weekday]</span>${done ? tag('Traded') : `<span style="font-size: 13px; color: ${C.muted}">${today ? 'Today' : 'To come'}</span>`}</li>`;
  return `<li style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1 1 0; min-width: 0; padding: 10px 4px; border-radius: 10px; border: 1px solid ${today ? C.ink : C.border}; background: ${C.panel}" ${today ? 'aria-current="date"' : ''}><span style="font-size: 14px; font-weight: 700">${d}</span><span style="font-size: 12px; color: ${C.muted}">[weekday]</span>${done ? `<span style="display: inline-flex; color: ${C.successInk}">${icon('check', 18)}</span><span style="font-size: 12px; color: ${C.muted}">Traded</span>` : `<span style="font-size: 12px; color: ${C.muted}">${today ? 'Today' : 'To come'}</span>`}</li>`; };
const weekBoard = (all = false) => movePage(`${section(all ? 'A full week on Wheelhouse' : 'Your first week on Wheelhouse', `${note(all ? 'Seven trading days, weekend included. You can switch Citrus Lime off now.' : 'Day 5 of 7. Days the shop is shut don’t count. When the week — weekend included — is done, you can switch Citrus Lime off.')}
<ol aria-label="The first trading week" style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: ${isPhone() ? 6 : 8}px">${DAYS7.map((d, i) => dayBox(d, i, all)).join('')}</ol>
${list([line('Citrus Lime', all ? 'Switch it off in Citrus Lime when you’re ready · this page leaves the sidebar in a week' : 'Keep it until [date] · nothing needs doing in it')])}`, helpLink)}`);

// ---------- Decision 6 (dropped, issue #116 question 4: practice mode) ----------
// Kept only for this journey's own canvas; the one canvas lists these as
// dropped (consolidate/j09.mjs).
// The card machine isn't used: the practice card step lets staff try both
// outcomes. Totals come from journey 11's example sale.
const practiceCard = () => popup('pc-title', 'Card payment · £74.00 · practice', 'The card machine isn’t used in practice', `${note('Try what happens either way. Nothing is charged and nothing goes in the drawer.')}`, `${button('Pretend it’s declined', { variant: 'default' })}${button('Pretend it’s paid')}`, 520);
def('mv-practice-sale', () => practiceScreen('till-sale', SIZE));
def('mv-practice-card', () => overlay(practiceScreen('till-sale', SIZE), practiceCard()));
// UX walk-through 4 M4: checking in during practice goes straight to the till
// — no float check, since the drawer holds Citrus Lime's money.
def('mv-practice-checkin', () => practiceScreen('till-empty', SIZE));
// UX walk-through 4 H3 (option 1): a job marked ready in practice — "Bike
// ready" isn't sent, and the job says so.
const READY_SENT = '“Bike ready” goes to Maya by text in 1 minute.';
def('mv-practice-job', () => {
  const html = diaryScreens['job-finished'][SIZE];
  if (!html.includes(READY_SENT)) throw new Error('job-finished: “Bike ready” line not found');
  return html.replace(READY_SENT, '<strong>Not sent — practice.</strong> No messages go to customers until switch-over day.');
});

def('mv-ready', () => { STAGE = 2; SWITCHED = false; return readyBoard(false); });
def('mv-weeks', () => { STAGE = 2; SWITCHED = false; return overlay(readyBoard(false), weeksPopup()); });
def('mv-ready-all', () => { STAGE = 2; SWITCHED = false; return readyBoard(true); });
def('mv-pick-day', () => { STAGE = 2; SWITCHED = false; return overlay(readyBoard(true), pickDay()); });
def('mv-morning', () => { STAGE = 2; SWITCHED = true; return morningBoard(); });
def('mv-go-real', () => { STAGE = 2; SWITCHED = true; return overlay(morningBoard(), goReal()); });
def('mv-week', () => { STAGE = 2; SWITCHED = true; return weekBoard(); });
def('mv-week-done', () => { STAGE = 3; SWITCHED = true; return weekBoard(true); }); // every stage done
def('mv-start', () => { STAGE = 0; return startBoard(); });
def('mv-progress', () => { STAGE = 0; return progressBoard(); });
def('mv-progress-failed', () => { STAGE = 0; return progressBoard(true); });
def('mv-summary', () => { STAGE = 0; return summaryBoard(); });
def('mv-fix', () => { STAGE = 0; return fixBoard(); });
def('mv-sorted', () => { STAGE = 0; return sortedBoard(); });
def('mv-today-refresh', () => todayRefresh());
def('mv-alongside', () => { STAGE = 1; return alongsideBoard(); });
def('mv-change-day', () => { STAGE = 1; return overlay(alongsideBoard(), changeDay()); });
def('mv-both', () => { STAGE = 1; return bothBoard(); });
def('mv-check', () => { STAGE = 1; return movePage(checkSection(false)); });
def('mv-check-result', () => { STAGE = 1; return movePage(checkSection(true)); });

// Desktop first (journey process); tablet and phone once desktop is approved.
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const size of SIZES) screens[id][size] = withSize(size, () => { SIZE = size; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'mv-start': 'Bring your data: the files to drop in',
  'mv-progress': 'Bringing it across (starts by itself)',
  'mv-progress-failed': 'A file Wheelhouse couldn’t read',
  'mv-summary': 'Here’s what came across',
  'mv-fix': 'The few that need a look',
  'mv-sorted': 'Everything’s sorted',
  'mv-today-refresh': 'Today: time to refresh from Citrus Lime',
  'mv-alongside': 'Run alongside: the weekly refresh',
  'mv-change-day': 'Change the refresh day',
  'mv-both': 'Changed in both: Citrus Lime’s kept',
  'mv-check': 'The weekly check: each figure checks itself',
  'mv-check-result': 'The weekly check: three match, one doesn’t',
  'mv-practice-sale': 'The till before switch-over: practice, not real money',
  'mv-practice-card': 'A practice card payment: try either outcome',
  'mv-practice-checkin': 'Checked in during practice: no float check', // UX walk-through 4 M4
  'mv-practice-job': 'A job marked ready in practice: “Not sent — practice”', // UX walk-through 4 H3
  'mv-ready': 'Switch over: the checklist, one still to do',
  'mv-weeks': 'Change how many weeks must match (2 by default)',
  'mv-ready-all': 'Switch over: everything ticked',
  'mv-pick-day': 'Pick switch-over day',
  'mv-morning': 'Switch-over morning: last refresh, then turn the website on', // UX walk-through 4 H2; "Draw the decisions" J8
  'mv-go-real': 'Clear practice sales and go real?',
  'mv-week': 'The first full week on Wheelhouse',
  'mv-week-done': 'A full week done: Citrus Lime can go',
};
export const ROWS = [
  { label: 'Bring your data', screens: ['mv-start', 'mv-progress', 'mv-progress-failed', 'mv-summary', 'mv-fix', 'mv-sorted'] },
  { label: 'Run alongside', screens: ['mv-today-refresh', 'mv-alongside', 'mv-change-day', 'mv-both', 'mv-check', 'mv-check-result'] },
  { label: 'Practice: the till and jobs', screens: ['mv-practice-checkin', 'mv-practice-sale', 'mv-practice-card', 'mv-practice-job'] }, // UX walk-through 4 M4, H3
  { label: 'Switch over', screens: ['mv-ready', 'mv-weeks', 'mv-ready-all', 'mv-pick-day', 'mv-morning', 'mv-go-real', 'mv-week', 'mv-week-done'] },
];
