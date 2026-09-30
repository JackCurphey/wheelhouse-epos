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
import { page, fold, pill, offer, choice, note, popup, overlay, setSize, isPhone } from './settings-frame.mjs';
import { field } from './ui.mjs';

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


// ---------- The customer page (decisions 2–4) ----------
// Left: details (decision 3: address and a note), bikes with warranty for
// ones bought here (decision 4), at a glance. Right: one history.
const facts = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 40px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; color: ${C.muted}">${k}</span><span style="font-size: 15px; font-weight: 600; text-align: right">${v}</span></div>`;
const secHead = (t, action = '') => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 0 6px"><span style="font-size: 15px; font-weight: 700">${t}</span>${action}</div>`;
const smallLink = (t) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const warranty = (inWarranty) => inWarranty
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}">${icon('check', 14)}Under warranty · [n] months left</span>`
  : `<span style="font-size: 13px; color: ${C.muted}">Warranty ended [date]</span>`;
function summary() {
  const details = `${secHead('Details', smallLink('Edit'))}
<div style="display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; color: ${C.muted}">Address</span><span style="font-size: 15px; line-height: 1.45">[address]<br>[postcode]</span></div>
<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}"><span style="font-size: 13px; font-weight: 700">Note</span><span style="font-size: 14px; line-height: 1.45">[A note everyone in the shop should know]</span></div>`;
  const bikes = `${secHead('Bikes', smallLink('+ Add'))}
<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">Trek Domane AL 3</span><span style="font-size: 13px; color: ${C.muted}">Green · black mudguards · bought here [date]</span>${warranty(true)}</div>`;
  const glance = `${secHead('At a glance')}${facts('Owes on account', mono('[£ owed]'))}${facts('Loyalty points', mono('[n]'))}${facts('Store credit', mono('[£]'))}${facts('Marketing', '[yes or no]')}`;
  return card(`<div style="padding: 4px 18px 14px; display: flex; flex-direction: column">${details}${bikes}${glance}</div>`, `width: ${isPhone() ? 'auto' : '320px'}; flex-shrink: 0; align-self: ${isPhone() ? 'stretch' : 'flex-start'}`);
}
function history(filter = 'Everything') {
  const rows = filter === 'Sales' ? saleRow() : `${mayaJobs.slice(0, 5).map(jobRow).join('')}${saleRow()}`;
  return card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 17px; font-weight: 700">History</span><div role="group" aria-label="Show" style="display: flex; gap: 6px; flex-wrap: wrap">${['Everything', 'Jobs', 'Sales', 'Messages'].map((t) => pill(t, t === filter)).join('')}</div></div>
<div style="display: flex; flex-direction: column">${rows}</div></div>`, 'flex-grow: 1; min-width: 0');
}
const customerPage = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${header()}<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 16px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}">${summary()}${history()}</div></div>`, STAFF);

// ---------- Customers: find someone, or add them ----------
const CUSTOMERS = [['Maya Patel', 'Trek Domane AL 3', MAYA.phone], ['Oliver Chen', 'Brompton C Line', '[phone]'], ['Sam Reed', 'Specialized Sirrus', '[phone]'], ['Jamie Brooks', 'Giant Escape 2', '[phone]'], ['Aisha Khan', 'Cannondale Quick', '[phone]']];
const custRow = ([n, bike, ph]) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 14px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: inline-flex; width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 13px; font-weight: 700">${n.split(' ').map((x) => x[0]).join('')}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">${bike}</span></span>${isPhone() ? '' : mono(ph, 'font-size: 14px; color: ' + C.muted)}</a>`;
const customerList = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 980px">
<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap"><label style="flex-grow: 1; min-width: 220px; display: flex; align-items: center; gap: 10px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input aria-label="Find a customer" placeholder="Name, phone, email or postcode" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>${button('+ Add a customer')}</div>
${card(CUSTOMERS.map(custRow).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden')}
${note('Most recent first. Search finds anyone by name, phone, email or postcode.')}</div>`, STAFF);
// Add a customer (decision 3): a person or a company or club; address and
// a note are optional; marketing permission starts off (booking spec).
function addDialog(company = false) {
  const who = choice('This is', [['A person', !company], ['A company or club', company]]);
  const names = company ? `${field('Company or club name', { placeholder: 'e.g. the club’s name' })}${field('Contact name', { placeholder: 'Who we deal with' })}` : field('Name', { placeholder: 'First and last name' });
  const two = (a, b) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${a}${b}</div>`;
  return popup('add-title', 'Add a customer', 'Only a name and one way to reach them are needed', `${who}${names}
${two(field('Phone', { type: 'tel' }), field('Email', { type: 'email' }))}
${two(field('Address (optional)'), field('Postcode (optional)'))}
${field('Note (optional)', { placeholder: 'e.g. prefers texts, not calls' })}
<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span><span style="font-size: 13px; color: ${C.muted}">Only if they say yes. Job updates always go.</span></span>${offer('Off', false)}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Add the customer')}`, 640);
}

def('cs-list', customerList);
def('cs-page', customerPage);
def('cs-add', () => overlay(customerList(), addDialog()));
def('cs-add-company', () => overlay(customerList(), addDialog(true)));

def('cs-opt-folds', optionFolds);
def('cs-opt-timeline', optionTimeline);

setSize('desktop');
for (const [id, fn] of recipes) screens[id] = { desktop: fn() };

export const TITLES = {
  'cs-list': 'Customers: find someone, or add them',
  'cs-page': 'A customer’s page: details, bikes with warranty, one history',
  'cs-add': 'Add a customer: a person',
  'cs-add-company': 'Add a customer: a company or club',
  'cs-opt-folds': 'Option 1: one page, everything in folding sections',
  'cs-opt-timeline': 'Option 2: a summary on the left, one history on the right',
};
export const ROWS = [
  { label: 'Customers and the customer page', screens: ['cs-list', 'cs-page', 'cs-add', 'cs-add-company'] },
  { label: 'Options: the shape of the customer page (decision 2: option 2)', screens: ['cs-opt-folds', 'cs-opt-timeline'] },
];
