// Journey 15 — Customer service, designed in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-customer-service-review.md
//
// Round 1: two options for the shape of the customer page (Front desk ›
// Customers › Maya Patel), desktop only. Real example data only: Maya Patel,
// 07700 900 142, her Trek Domane AL 3, her jobs from the diary's example week
// (diary.mjs JOBS — nothing hand-picked), the till sale B1-[0000] and the
// approved £111 on WH-1042. Anything else is a bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { JOBS, DAYS, ST, customerBikeOf } from './diary.mjs';
import { page, fold, pill, note, setSize } from './settings-frame.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };

const MAYA = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards' };
const mayaJobs = JOBS.filter((j) => customerBikeOf(j)[0] === 'Maya Patel').sort((a, b) => a.day - b.day || a.start - b.start);
const when = (j) => { const [d, n] = DAYS[j.day]; return `${d} ${n} Sep · ${String(Math.floor(j.start / 60)).padStart(2, '0')}:${String(j.start % 60).padStart(2, '0')}`; };
const status = (key) => { const [bg, ink, word] = ST[key]; return `<span style="display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${word}</span>`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The top of the page, the same in both options: who, how to reach them,
// and the two things staff most often do next.
const header = () => `<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 17px; font-weight: 700">MP</span>
<span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="font-size: 22px; font-weight: 700">${MAYA.name}</span><span style="font-size: 14px; color: ${C.muted}">${mono(MAYA.phone)} · ${MAYA.email}</span></span>
${button('New job', { variant: 'default' })}${button('Add to a sale')}</div>`;

const jobRow = (j) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}">${mono(j.job, 'font-size: 14px; width: 76px; flex-shrink: 0')}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${cap(j.svc)}</span><span style="font-size: 13px; color: ${C.muted}">${when(j)} · ${j.mech === 'Alex' ? 'Alex Morgan' : 'Jo Taylor'}</span></span>${status(j.key)}</div>`;
const saleRow = () => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}">${mono('B1-[0000]', 'font-size: 14px; width: 76px; flex-shrink: 0')}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Sale · Till B1</span><span style="font-size: 13px; color: ${C.muted}">[date] · [what was bought]</span></span>${mono('[£ total]', 'font-size: 15px')}</div>`;

// ---------- Option 1: one page, everything in folding sections ----------
function optionFolds() {
  const jobs = `${mayaJobs.slice(0, 4).map(jobRow).join('')}<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Show all ${mayaJobs.length} jobs</a>`;
  const sections = fold('Bikes', 'Trek Domane AL 3')
    + fold('Workshop jobs', `${mayaJobs.length} jobs`, jobs)
    + fold('Sales and refunds', 'B1-[0000] and [n] more')
    + fold('Account and loyalty', 'Owes [£] · [n] points')
    + fold('Messages', 'Texts and emails sent')
    + fold('Details and permissions', 'Marketing: [yes or no]');
  return page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 980px">${header()}${card(sections, 'overflow: hidden; flex-shrink: 0')}</div>`, STAFF);
}

// ---------- Option 2: a summary down the left, one history on the right ----------
function optionTimeline() {
  const facts = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 40px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; color: ${C.muted}">${k}</span><span style="font-size: 15px; font-weight: 600; text-align: right">${v}</span></div>`;
  const left = card(`<div style="padding: 16px 18px; display: flex; flex-direction: column">
<span style="font-size: 15px; font-weight: 700; padding-bottom: 8px">Bikes</span>
<div style="display: flex; align-items: center; gap: 10px; min-height: 44px; border-top: 1px solid ${C.border}"><span style="font-size: 15px">${MAYA.bike}</span></div>
<span style="font-size: 15px; font-weight: 700; padding: 16px 0 8px">At a glance</span>
${facts('Owes on account', mono('[£ owed]'))}${facts('Loyalty points', mono('[n]'))}${facts('Store credit', mono('[£]'))}${facts('Marketing', '[yes or no]')}
</div>`, 'width: 300px; flex-shrink: 0; align-self: flex-start');
  const history = `${mayaJobs.slice(0, 5).map(jobRow).join('')}${saleRow()}`;
  const right = card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 17px; font-weight: 700">History</span><div role="group" aria-label="Show" style="display: flex; gap: 6px">${pill('Everything', true)}${pill('Jobs')}${pill('Sales')}${pill('Messages')}</div></div>
<div style="display: flex; flex-direction: column">${history}</div></div>`, 'flex-grow: 1; min-width: 0');
  return page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${header()}<div style="display: flex; gap: 16px; align-items: flex-start">${left}${right}</div></div>`, STAFF);
}

def('cs-opt-folds', optionFolds);
def('cs-opt-timeline', optionTimeline);

setSize('desktop');
for (const [id, fn] of recipes) screens[id] = { desktop: fn() };

export const TITLES = {
  'cs-opt-folds': 'Option 1: one page, everything in folding sections',
  'cs-opt-timeline': 'Option 2: a summary on the left, one history on the right',
};
export const ROWS = [
  { label: 'Options: the shape of the customer page', screens: ['cs-opt-folds', 'cs-opt-timeline'] },
];
