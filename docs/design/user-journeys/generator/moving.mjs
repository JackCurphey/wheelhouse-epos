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

// Where both changed the same thing: Citrus Lime wins until switch-over,
// and the owner is told what was kept.
const bothRow = (what, cl, wh) => `<div role="listitem" style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)'}; gap: ${isPhone() ? 4 : 12}px; align-items: center; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">${what}</span><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px"><span><span style="color: ${C.muted}">Citrus Lime:</span> ${cl}</span>${tag('Kept')}</span><span style="font-size: 14px; color: ${C.muted}">Wheelhouse: <s>${wh}</s></span></div>`;
const bothPopup = () => popup('both-title', 'Changed in both', 'Refresh on [date] · Citrus Lime’s version kept until you switch over', `${note('While you run alongside, Citrus Lime is the one that counts. After switch-over, Wheelhouse is.')}
<div role="list">${bothRow('[Product] · price', mono('£[price]'), mono('£[price]'))}${bothRow('[Customer] · phone', '[phone]', '[phone]')}</div>`, `<span></span>${button('Got it')}`, 720);
const bothBoard = () => overlay(alongsideBoard(), bothPopup());

def('mv-start', () => { STAGE = 0; return startBoard(); });
def('mv-progress', () => { STAGE = 0; return progressBoard(); });
def('mv-summary', () => { STAGE = 0; return summaryBoard(); });
def('mv-fix', () => { STAGE = 0; return fixBoard(); });
def('mv-today-refresh', () => todayRefresh());
def('mv-alongside', () => { STAGE = 1; return alongsideBoard(); });
def('mv-both', () => { STAGE = 1; return bothBoard(); });

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
};
export const ROWS = [
  { label: 'Bring your data', screens: ['mv-start', 'mv-progress', 'mv-summary', 'mv-fix'] },
  { label: 'Run alongside', screens: ['mv-today-refresh', 'mv-alongside', 'mv-both'] },
];
