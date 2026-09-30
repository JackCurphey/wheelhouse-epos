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
function summary({ accounts = true, loyalty = true, credit = true } = {}) {
  const details = `${secHead('Details', smallLink('Edit'))}
<div style="display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; color: ${C.muted}">Address</span><span style="font-size: 15px; line-height: 1.45">[address]<br>[postcode]</span></div>
<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}"><span style="font-size: 13px; font-weight: 700">Note</span><span style="font-size: 14px; line-height: 1.45">[A note everyone in the shop should know]</span></div>`;
  const bikes = `${secHead('Bikes', smallLink('+ Add'))}
<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">Trek Domane AL 3</span><span style="font-size: 13px; color: ${C.muted}">Green · black mudguards · bought here [date]</span>${warranty(true)}</div>`;
  // Decision 6: only what the shop has switched on in Payments › Ways to pay.
  const glance = `${secHead('At a glance')}${accounts ? facts('<a href="cs-account-desktop.dc.html" style="color: ' + C.ink + '; font-weight: 600">Owes on account</a>', mono('[£ owed]')) : ''}${loyalty ? facts('Loyalty points', mono('[n]')) : ''}${credit ? facts('Store credit', mono('[£]')) : ''}${facts('Marketing', '[yes or no]')}`;
  return card(`<div style="padding: 4px 18px 14px; display: flex; flex-direction: column">${details}${bikes}${glance}</div>`, `width: ${isPhone() ? 'auto' : '320px'}; flex-shrink: 0; align-self: ${isPhone() ? 'stretch' : 'flex-start'}`);
}
function history(filter = 'Everything') {
  const rows = filter === 'Sales' ? saleRow() : `${mayaJobs.slice(0, 5).map(jobRow).join('')}${saleRow()}`;
  return card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 17px; font-weight: 700">History</span><div role="group" aria-label="Show" style="display: flex; gap: 6px; flex-wrap: wrap">${['Everything', 'Jobs', 'Sales', 'Messages'].map((t) => pill(t, t === filter)).join('')}</div></div>
<div style="display: flex; flex-direction: column">${rows}</div></div>`, 'flex-grow: 1; min-width: 0');
}
const customerPage = (on = {}) => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${header()}<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 16px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}">${summary(on)}${history()}</div></div>`, STAFF);

// ---------- Customers: find someone, or add them ----------
const CUSTOMERS = [['Maya Patel', 'Trek Domane AL 3', MAYA.phone], ['Oliver Chen', 'Brompton C Line', '[phone]'], ['Sam Reed', 'Specialized Sirrus', '[phone]'], ['Jamie Brooks', 'Giant Escape 2', '[phone]'], ['Aisha Khan', 'Cannondale Quick', '[phone]']];
const custRow = ([n, bike, ph]) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 14px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: inline-flex; width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 13px; font-weight: 700">${n.split(' ').map((x) => x[0]).join('')}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">${bike}</span></span>${isPhone() ? '' : mono(ph, 'font-size: 14px; color: ' + C.muted)}</a>`;
const customerList = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 980px">
<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap"><label style="flex-grow: 1; min-width: 220px; display: flex; align-items: center; gap: 10px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input aria-label="Find a customer" placeholder="Name, phone, email or postcode" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>${button('+ Add a customer')}</div>
${card(CUSTOMERS.map(custRow).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden')}
${note('Most recent first. Search finds anyone by name, phone, email or postcode.')}</div>`, STAFF);
// Add a customer (decision 3): a person or a company or club; address and
// a note are optional; marketing permission starts off (booking spec).
function addDialog(company = false, match = false) {
  const who = choice('This is', [['A person', !company], ['A company or club', company]]);
  const names = company ? `${field('Company or club name', { placeholder: 'e.g. the club’s name' })}${field('Contact name', { placeholder: 'Who we deal with' })}` : field('Name', { placeholder: 'First and last name', value: match ? 'Maya P.' : '' });
  // Decision 5: a match shows while typing, before anyone is added twice.
  const found = match ? `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">Maya Patel already has this number</span><span style="font-size: 13px; color: ${C.muted}">${mono(MAYA.phone)} · Trek Domane AL 3</span></span>${button('Use Maya Patel', { variant: 'default' })}</div>` : '';
  const two = (a, b) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${a}${b}</div>`;
  return popup('add-title', 'Add a customer', 'Only a name and one way to reach them are needed', `${who}${names}
${two(field('Phone', { type: 'tel', value: match ? MAYA.phone : '' }), field('Email', { type: 'email' }))}${found}
${two(field('Address (optional)'), field('Postcode (optional)'))}
${field('Note (optional)', { placeholder: 'e.g. prefers texts, not calls' })}
<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span><span style="font-size: 13px; color: ${C.muted}">Only if they say yes. Job updates always go.</span></span>${offer('Off', false)}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Add the customer')}`, 640);
}

def('cs-list', customerList);
def('cs-page', () => customerPage());
def('cs-page-off', () => customerPage({ accounts: false, loyalty: false }));
def('cs-add', () => overlay(customerList(), addDialog()));
def('cs-add-company', () => overlay(customerList(), addDialog(true)));

// Decision 5: one that slipped through (two tills offline) is flagged on the
// page; Check opens a side-by-side comparison. Nothing merges by itself.
const dupNotice = () => `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 8px 8px 14px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="display: inline-flex; color: ${C.ink}">${icon('user', 18)}</span><span style="font-size: 15px; flex-grow: 1"><strong>Might be the same person as Maya P.</strong> <span style="color: ${C.muted}">· same phone number</span></span>${button('Check', { variant: 'default' })}</div>`;
const customerPageDup = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${header()}${dupNotice()}<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 16px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}">${summary()}${history()}</div></div>`, STAFF);
function mergeDialog() {
  const cmpRow = (label, a, b, keepA = true) => `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '120px 1fr 1fr'}; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">${label}</span>${[[a, keepA], [b, !keepA]].map(([v, on]) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${on ? C.ink : C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; text-align: left; color: ${C.ink}">${on ? icon('check', 15) : '<span style="width: 15px"></span>'}${v}</button>`).join('')}</div>`;
  const heads = isPhone() ? '' : `<div style="display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px"><span></span><span style="font-size: 15px; font-weight: 700">Maya Patel</span><span style="font-size: 15px; font-weight: 700">Maya P.</span></div>`;
  return popup('merge-title', 'The same person?', 'Pick what to keep. Jobs, sales and bikes from both are kept together.', `${heads}
${cmpRow('Name', 'Maya Patel', 'Maya P.')}${cmpRow('Phone', mono(MAYA.phone), mono(MAYA.phone))}${cmpRow('Email', MAYA.email, '[none]')}${cmpRow('Address', '[address]', '[none]')}
${note('Added on [date] and [date], on different tills. Merging can be undone from the customer’s page for [n] days.')}`, `${button('They’re different people', { variant: 'ghost' })}${button('Merge into one')}`, 760);
}
def('cs-add-match', () => overlay(customerList(), addDialog(false, true)));
def('cs-page-dup', customerPageDup);
def('cs-merge', () => overlay(customerPageDup(), mergeDialog()));

// ---------- Account (decision 7; Owner setup decision 7) ----------
// Opened from "Owes on account" in At a glance: the balance, the statement,
// her own limit, and the two ways to pay it off.
const stmtRow = (what, when, amt) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px">${what}</span><span style="font-size: 13px; color: ${C.muted}">${when}</span></span>${mono(amt, 'font-size: 15px')}</div>`;
function accountDialog() {
  const big = (k, v) => `<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; padding: 12px 14px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="font-size: 13px; color: ${C.muted}">${k}</span>${mono(v, 'font-size: 20px')}</div>`;
  return popup('acct-title', 'Maya Patel’s account', 'Pay later, settled from here', `
<div style="display: flex; gap: 10px; flex-wrap: wrap">${big('Owes now', '[£ owed]')}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><label style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Most Maya can owe</span><span style="font-size: 13px; color: ${C.muted}">The shop’s limit is [£ limit] · managers can change hers</span></label><input aria-label="Maya’s own limit" value="[£ limit]" style="width: 120px; min-height: 44px; box-sizing: border-box; text-align: right; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></div>
<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 700; padding-bottom: 6px">Statement</span>${stmtRow('Sale on account · B1-[0000]', '[date]', '+[£]')}${stmtRow('Paid by bank transfer · [reference]', '[date]', '−[£]')}${stmtRow('Sale on account · B1-[0000]', '[date]', '+[£]')}</div>
<div style="display: flex; gap: 8px; flex-wrap: wrap">${button('Email the statement', { variant: 'default' })}${button('Record a bank transfer', { variant: 'default' })}</div>`, `${button('Close', { variant: 'ghost' })}${button('Take a payment at the till')}`, 640);
}
const transferDialog = () => popup('bt-title', 'Record a bank transfer', 'For money that didn’t come through the till', `
${field('Amount', { placeholder: '£0.00' })}
<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Date it arrived', { placeholder: '[date]' })}${field('Reference', { placeholder: 'As it shows on the bank statement' })}</div>
${note('It comes off what Maya owes. It isn’t counted in the till’s takings, so cash-up isn’t affected.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Record it')}`, 560);
def('cs-account', () => overlay(customerPage(), accountDialog()));
def('cs-transfer', () => overlay(customerPage(), transferDialog()));

def('cs-opt-folds', optionFolds);
def('cs-opt-timeline', optionTimeline);

setSize('desktop');
for (const [id, fn] of recipes) screens[id] = { desktop: fn() };

export const TITLES = {
  'cs-list': 'Customers: find someone, or add them',
  'cs-page': 'A customer’s page: details, bikes with warranty, one history',
  'cs-page-off': 'A shop with accounts and loyalty switched off (Payments › Ways to pay)',
  'cs-add': 'Add a customer: a person',
  'cs-add-company': 'Add a customer: a company or club',
  'cs-account': 'Her account: balance, her limit, statement, pay it off',
  'cs-transfer': 'Record a bank transfer',
  'cs-add-match': 'Adding someone who’s already here',
  'cs-page-dup': 'A possible duplicate, flagged on the page',
  'cs-merge': 'The same person? Keep or merge',
  'cs-opt-folds': 'Option 1: one page, everything in folding sections',
  'cs-opt-timeline': 'Option 2: a summary on the left, one history on the right',
};
export const ROWS = [
  { label: 'Customers and the customer page', screens: ['cs-list', 'cs-page', 'cs-page-off', 'cs-add', 'cs-add-company'] },
  { label: 'Accounts (pay later)', screens: ['cs-account', 'cs-transfer'] },
  { label: 'Possible duplicates', screens: ['cs-add-match', 'cs-page-dup', 'cs-merge'] },
  { label: 'Options: the shape of the customer page (decision 2: option 2)', screens: ['cs-opt-folds', 'cs-opt-timeline'] },
];
