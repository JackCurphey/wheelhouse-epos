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
import { page, fold, pill, offer, choice, note, popup, overlay, setSize, withSize, isPhone, settingsPage, payFolds, PAY_INTRO } from './settings-frame.mjs';
import { field } from './ui.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };

const MAYA = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards' };
// Built on first use, not at load: diary.mjs imports this file (journey 15
// decision 11) and JOBS isn't ready while that import is starting up.
let _mj;
const mj = () => (_mj ??= JOBS.filter((j) => customerBikeOf(j)[0] === 'Maya Patel').sort((a, b) => b.day - a.day || b.start - a.start));
const when = (j) => { const [d, n] = DAYS[j.day]; return `${d} ${n} Sep · ${String(Math.floor(j.start / 60)).padStart(2, '0')}:${String(j.start % 60).padStart(2, '0')}`; };
const status = (key) => { const [bg, ink, word] = ST[key]; return `<span style="display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${word}</span>`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The top of the page, the same in both options: who, how to reach them,
// and the two things staff most often do next.
// Decision 12: an "Owes" chip beside the name (warning colour when over the
// limit); "Add to a sale" shows only on a till, so the staff app offers New
// job; a back link to Customers.
const owesChip = (over = false) => `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border-radius: 999px; background: ${over ? C.warnBg : C.mutedBg}; color: ${over ? C.warnInk : C.ink}; font-size: 13px; font-weight: 700">${over ? icon('alert', 14) : ''}${over ? 'Over her limit by [£]' : 'Owes [£ owed]'}</span>`;
const backLink = () => `<a href="cs-list-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Customers</a>`;
const header = ({ owes = true, over = false } = {}) => `<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 17px; font-weight: 700">MP</span>
<span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap"><span style="font-size: 22px; font-weight: 700">${MAYA.name}</span>${owes ? owesChip(over) : ''}</span><span style="font-size: 14px; color: ${C.muted}">${mono(MAYA.phone)} · ${MAYA.email}</span></span>
${button('New job')}</div>`;

const jobRow = (j) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${mono(j.job, 'font-size: 14px; width: 76px; flex-shrink: 0')}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${cap(j.svc)}</span><span style="font-size: 13px; color: ${C.muted}">${when(j)} · ${j.mech === 'Alex' ? 'Alex Morgan' : 'Jo Taylor'}</span></span>${status(j.key)}<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;
const saleRow = () => `<a href="cs-sale-desktop.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${mono('B1-[0000]', 'font-size: 14px; width: 76px; flex-shrink: 0')}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Sale · Till B1</span><span style="font-size: 13px; color: ${C.muted}">[date] · [what was bought]</span></span>${mono('[£ total]', 'font-size: 15px')}<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;

// ---------- Option 1: one page, everything in folding sections ----------
function optionFolds() {
  const jobs = `${mj().slice(0, 4).map(jobRow).join('')}<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Show all ${mj().length} jobs</a>`;
  const sections = fold('Bikes', 'Trek Domane AL 3')
    + fold('Workshop jobs', `${mj().length} jobs`, jobs)
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
  const history = `${mj().slice(0, 5).map(jobRow).join('')}${saleRow()}`;
  const right = card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 17px; font-weight: 700">History</span><div role="group" aria-label="Show" style="display: flex; gap: 6px">${pill('Everything', true)}${pill('Jobs')}${pill('Sales')}${pill('Messages')}</div></div>
<div style="display: flex; flex-direction: column">${history}</div></div>`, 'flex-grow: 1; min-width: 0');
  return page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${header()}<div style="display: flex; gap: 16px; align-items: flex-start">${left}${right}</div></div>`, STAFF);
}


// ---------- The customer page (decisions 2–4) ----------
// Left: details (decision 3: address and a note), bikes with warranty for
// ones bought here (decision 4), at a glance. Right: one history.
const facts = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 40px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; color: ${C.muted}">${k}</span><span style="font-size: 15px; font-weight: 600; text-align: right">${v}</span></div>`;
// Decision 12: a whole row opens its pop-up (44px, with an arrow).
const factLink = (href, k, v) => `<a href="${href}" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600">${k}</span><span style="display: inline-flex; align-items: center; gap: 8px">${v}<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></span></a>`;
const secHead = (t, action = '') => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 0 6px"><span style="font-size: 15px; font-weight: 700">${t}</span>${action}</div>`;
const smallLink = (t) => `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const warranty = (inWarranty) => inWarranty
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}">${icon('check', 14)}Under warranty · [n] months left</span>`
  : `<span style="font-size: 13px; color: ${C.muted}">Warranty ended [date]</span>`;
function summary({ accounts = true, credit = true } = {}) {
  const details = `${secHead('Details', smallLink('Edit'))}
<div style="display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; color: ${C.muted}">Address</span><span style="font-size: 15px; line-height: 1.45">[address]<br>[postcode]</span></div>
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; color: ${C.muted}">Group</span><span style="font-size: 15px; font-weight: 600; text-align: right">[Club name] members · [n]% off</span></div>
<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}"><span style="font-size: 13px; font-weight: 700">Note</span><span style="font-size: 14px; line-height: 1.45">[A note everyone in the shop should know]</span></div>`;
  const bikes = `${secHead('Bikes', smallLink('+ Add'))}
<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Trek Domane AL 3</span><span style="font-size: 13px; color: ${C.muted}">Green · black mudguards · bought here [date]</span>${warranty(true)}</span><span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;
  // Decision 6: only what the shop has switched on in Payments › Ways to pay.
  const glance = `${secHead('At a glance')}${accounts ? factLink('cs-account-desktop.dc.html', 'Owes on account', mono('[£ owed]')) : ''}${credit ? factLink('cs-credit-desktop.dc.html', 'Store credit', mono('[£]')) : ''}<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span>${offer('On', true)}</div>`;
  return card(`<div style="padding: 4px 18px 14px; display: flex; flex-direction: column">${details}${bikes}${glance}</div>`, `width: ${isPhone() ? 'auto' : '320px'}; flex-shrink: 0; align-self: ${isPhone() ? 'stretch' : 'flex-start'}`);
}
// Decision 12: what's open now sits at the top; then everything else,
// newest first, with refunds, messages and store credit changes; "Show all".
const otherRow = (tag, title, sub, right = '') => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}; width: 76px; flex-shrink: 0">${tag}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${title}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${right}<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;
const subHead = (t) => `<span style="font-size: 13px; font-weight: 700; color: ${C.muted}; padding: 10px 0 4px">${t}</span>`;
function history(filter = 'Everything', empty = false) {
  const pills = `<div role="group" aria-label="Show" style="display: flex; gap: 6px; flex-wrap: wrap">${['Everything', 'Jobs', 'Sales', 'Messages'].map((t) => pill(t, t === filter)).join('')}</div>`;
  if (empty) return card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px"><span style="font-size: 17px; font-weight: 700">History</span><div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 16px; border: 2px dashed ${C.border}; border-radius: 10px; text-align: center"><span style="font-size: 16px; font-weight: 700">Nothing yet</span>${note('Jobs, sales and messages show here, newest first.')}${button('New job', { variant: 'default' })}</div></div>`, 'flex-grow: 1; min-width: 0');
  const open = mj().filter((j) => j.key !== 'ready');
  const past = mj().filter((j) => j.key === 'ready');
  const rows = `${subHead('Open now')}${open.slice(0, 3).map(jobRow).join('')}
${subHead('Earlier, newest first')}${past.slice(0, 1).map(jobRow).join('')}${otherRow('Refund', 'Refund · Till B1', '[date] · [what came back]', mono('−[£]', 'font-size: 15px'))}${saleRow()}${otherRow('Text', 'Bike ready', '[date] · sent to ' + MAYA.phone)}${otherRow('Credit', 'Store credit added', '[date] · [reason] · by [name]', mono('+[£]', 'font-size: 15px'))}
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Show all ([n])</a>`;
  return card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="font-size: 17px; font-weight: 700">History</span>${pills}</div>
<div style="display: flex; flex-direction: column">${rows}</div></div>`, 'flex-grow: 1; min-width: 0');
}
// Account, history and reminders audit M11: a request to delete, made from
// the customer's own account, shows on their page with what's in the way.
const deleteLine = () => `<p role="note" style="margin: 0; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span><strong>Asked to delete their account on [date]</strong> · from their account on the website · answer by [date]. Still in the way: bike in the workshop, ${mono('WH-1042')}. Store credit ${mono('£[credit]')} will be lost.</span></p>`;
const customerPage = (on = {}) => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px">${backLink()}${header({ owes: on.accounts !== false, over: !!on.over })}${on.deleteRequest ? deleteLine() : ''}<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 16px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}">${summary(on)}${history('Everything', !!on.empty)}</div></div>`, STAFF);

// ---------- Customers: find someone, or add them ----------
const CUSTOMERS = [['Maya Patel', 'Trek Domane AL 3', MAYA.phone], ['Oliver Chen', 'Brompton C Line', '[phone]'], ['Sam Reed', 'Specialized Sirrus', '[phone]'], ['Jamie Brooks', 'Giant Escape 2', '[phone]'], ['Aisha Khan', 'Cannondale Quick', '[phone]']];
const custRow = ([n, bike, ph]) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 14px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: inline-flex; width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; font-size: 13px; font-weight: 700">${n.split(' ').map((x) => x[0]).join('')}</span><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">${bike}</span></span>${n === 'Maya Patel' ? owesChip() : ''}${isPhone() ? '' : mono(ph, 'font-size: 14px; color: ' + C.muted)}</a>`;
const customerList = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 980px">
<div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap"><div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 20px; font-weight: 700">Recent customers</h2>${note('To find anyone else, use the search at the top — by name, phone, email or postcode.')}</div>${button('+ Add a customer')}</div>
${card(CUSTOMERS.map(custRow).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden')}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span></span><a href="cs-privacy-desktop.dc.html" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Privacy requests · [n] open</a></div></div>`, STAFF);
// Add a customer (decision 3): a person or a company or club; address and
// a note are optional; marketing permission starts off (booking spec).
// A company also has an optional VAT number and "Send invoices to", for the
// VAT invoice email (leftover screens audit H2).
function addDialog(company = false, match = false) {
  const who = choice('This is', [['A person', !company], ['A company or club', company]]);
  const names = company ? `${field('Company or club name', { placeholder: 'e.g. the club’s name' })}${field('Contact name', { placeholder: 'Who we deal with' })}` : field('Name', { placeholder: 'First and last name', value: match ? 'Maya P.' : '' });
  // Decision 5: a match shows while typing, before anyone is added twice.
  const found = match ? `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">Maya Patel already has this number</span><span style="font-size: 13px; color: ${C.muted}">${mono(MAYA.phone)} · Trek Domane AL 3</span></span>${button('Use Maya Patel', { variant: 'default' })}</div>` : '';
  const two = (a, b) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${a}${b}</div>`;
  return popup('add-title', 'Add a customer', 'Only a name and one way to reach them are needed', `${who}${names}
${two(field('Phone', { type: 'tel', value: match ? MAYA.phone : '' }), field('Email', { type: 'email' }))}${note('A phone number or an email — at least one.')}${found}
${two(field('Address (optional)'), field('Postcode (optional)'))}${company ? `\n${two(field('VAT number (optional)', { placeholder: 'For VAT invoices' }), field('Send invoices to (optional)', { type: 'email', placeholder: 'The contact’s email if blank' }))}` : ''}
${choice('Group (optional)', [['None', true], ['[Club name] members', false]])}
${field('Note (optional)', { placeholder: 'e.g. prefers texts, not calls' })}
<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span><span style="font-size: 13px; color: ${C.muted}">Only if they say yes. Job updates always go.</span></span>${offer('Off', false)}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Add the customer')}`, 640);
}

def('cs-list', customerList);
def('cs-page', () => customerPage());
def('cs-page-off', () => customerPage({ accounts: false }));
def('cs-page-over', () => customerPage({ over: true }));
def('cs-page-new', () => customerPage({ empty: true }));
def('cs-add', () => overlay(customerList(), addDialog()));
def('cs-add-company', () => overlay(customerList(), addDialog(true)));

// Decision 5: one that slipped through (two tills offline) is flagged on the
// page; Check opens a side-by-side comparison. Nothing merges by itself.
const dupNotice = () => `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 8px 8px 14px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="display: inline-flex; color: ${C.ink}">${icon('user', 18)}</span><span style="font-size: 15px; flex-grow: 1"><strong>Might be the same person as Maya P.</strong> <span style="color: ${C.muted}">· same phone number</span></span>${button('Check', { variant: 'default' })}</div>`;
const customerPageDup = () => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px">${backLink()}${header()}${dupNotice()}<div style="display: flex; flex-direction: ${isPhone() ? 'column' : 'row'}; gap: 16px; align-items: ${isPhone() ? 'stretch' : 'flex-start'}">${summary()}${history()}</div></div>`, STAFF);
function mergeDialog() {
  const cmpRow = (label, a, b, keepA = true) => `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '120px 1fr 1fr'}; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">${label}</span>${[[a, keepA], [b, !keepA]].map(([v, on]) => `<button type="button" aria-pressed="${on}" style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${on ? C.ink : C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; text-align: left; color: ${C.ink}">${on ? icon('check', 15) : '<span style="width: 15px"></span>'}${v}</button>`).join('')}</div>`;
  const heads = isPhone() ? '' : `<div style="display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px"><span></span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">${mj().length} jobs · [n] sales</span></span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Maya P.</span><span style="font-size: 13px; color: ${C.muted}">[n] jobs · [n] sales</span></span></div>`;
  return popup('merge-title', 'The same person?', 'Pick what to keep. Jobs, sales and bikes from both are kept together.', `${heads}
${note('Only what’s different is shown. Both have ' + MAYA.phone + '.')}${cmpRow('Name', 'Maya Patel', 'Maya P.')}${cmpRow('Email', MAYA.email, '[none]')}${cmpRow('Address', '[address]', '[none]')}
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
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Most Maya can owe</span><span style="font-size: 13px; color: ${C.muted}">A manager can change it · the shop’s is [£ limit]</span></span>${mono('[£ limit]', 'font-size: 17px')}</div>
<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 700; padding-bottom: 6px">Statement</span>${stmtRow('Sale on account · B1-[0000]', '[date]', '+[£]')}${stmtRow('Paid by bank transfer · [reference]', '[date]', '−[£]')}${stmtRow('Sale on account · B1-[0000]', '[date]', '+[£]')}</div>
<div style="display: flex; gap: 8px; flex-wrap: wrap">${button('Email the statement', { variant: 'default' })}${button('Record a bank transfer', { variant: 'default' })}</div>`, `${button('Close', { variant: 'ghost' })}${button('Take a payment at the till')}`, 640);
}
const transferDialog = () => popup('bt-title', 'Record a bank transfer', 'For money that didn’t come through the till', `
${field('Amount', { value: '[£ owed]', hint: 'Everything she owes — change it if she paid part.' })}
<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Date it arrived', { value: 'Today' })}${field('Reference', { placeholder: 'As it shows on the bank statement' })}</div>
${note('It comes off what Maya owes. It isn’t counted in the till’s takings, so cash-up isn’t affected.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Record it')}`, 560);
def('cs-account', () => overlay(customerPage(), accountDialog()));
def('cs-transfer', () => overlay(customerPage(), transferDialog()));

// ---------- Customer groups (decision 8): Settings › Front desk › Payments ----------
const groupRow = (name, off, count) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 8px 0 14px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${count}</span></span>${mono(off, 'font-size: 15px')}<button type="button" style="min-height: 44px; padding: 0 12px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">Edit</button></div>`;
const groupsOpen = () => `${groupRow('[Club name] members', '[n]% off', '[n] customers')}
<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px">${note('The till gives the discount by itself when a group member is added to a sale, with the group as the reason.')}${button('+ Add a group', { variant: 'default' })}</div>`;
def('cs-groups', () => settingsPage('payments', 'Payments', PAY_INTRO, payFolds({ groups: groupsOpen() }), { who: { role: 'M', person: 'Jack Lewis', roleName: 'Manager' } }));

// ---------- Privacy requests (decision 9) ----------
// Reached from Customers; each request is dated, with the answer due within
// one month (UK data protection). Deleting keeps sales without the name.
const MANAGER_WHO = { role: 'M', person: 'Jack Lewis', roleName: 'Manager' };
const reqRow = (who, what, asked, due, open, overdue = false) => `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-height: 60px; padding: 8px 14px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 200px"><span style="font-size: 15px; font-weight: 700">${who} · ${what}</span><span style="font-size: 13px; color: ${overdue ? C.warnInk : C.muted}; ${overdue ? 'font-weight: 700' : ''}">${overdue ? 'Overdue · ' : ''}Asked ${asked} · ${open ? `answer by ${due}` : `done ${due}`}</span></span>${open ? button(what.startsWith('Delete') ? 'Delete their details' : 'Send the copy', { variant: what.startsWith('Delete') ? 'danger' : 'default' }) : `<span style="font-size: 14px; color: ${C.muted}">Done</span>`}</div>`;
// Account, history and reminders audit M11: where it came from, what's in
// the way, and the delete button held back until it's clear.
const webDeleteRow = () => `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-height: 60px; padding: 8px 14px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 200px"><span style="font-size: 15px; font-weight: 700">Maya Patel · Delete their details</span><span style="font-size: 13px; color: ${C.muted}">From their account on the website · asked [date] · answer by [date]</span><span style="font-size: 13px; color: ${C.warnInk}; font-weight: 700">Still in the way: bike in the workshop, ${mono('WH-1042')} · store credit ${mono('£[credit]')} will be lost</span></span>${button('Delete their details', { variant: 'danger' }).replace('<button', '<button disabled aria-describedby="del-why"').replace('style="', 'style="opacity: 0.5; ')}<span id="del-why" style="flex-basis: 100%; font-size: 13px; color: ${C.muted}">Can be deleted once the bike is collected.</span></div>`;
const privacyPage = (web = false) => page('customers', 'Customers', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-width: 980px">
<a href="cs-list-desktop.dc.html" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Customers</a>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 22px; font-weight: 700">Privacy requests</h2>${note('When someone asks for a copy of what the shop holds about them, or for it to be deleted. Answer within one month.')}</div>${button('+ Log a request', { variant: 'default' })}</div>
${card(`${reqRow('[Customer]', 'Copy of their data', '[date]', '[date]', true, true)}${web ? webDeleteRow() : reqRow('[Customer]', 'Delete their details', '[date]', '[date]', true)}${reqRow('[Customer]', 'Copy of their data', '[date]', '[date]', false)}`.replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden')}</div>`, MANAGER_WHO);
const deleteDialog = () => popup('del-title', 'Delete [Customer]’s details?', 'A privacy request asked on [date]', `${note('Their name, phone, email, address, note and bikes are removed. Sales and jobs stay in the books without their name, because the shop must keep them for tax. This can’t be undone.')}`, `${button('Keep their details', { variant: 'ghost' })}${button('Delete their details', { variant: 'danger' })}`, 560);
// Decision 12 (answer 2): someone who owes money, holds store credit or has
// a bike in can't be deleted until that's settled.
const deleteBlocked = () => popup('delb-title', 'Settle up first', 'Before Maya Patel’s details can be deleted', `${note('Deleting her now would lose what’s still open:')}
<div style="display: flex; flex-direction: column">${facts('Owes on account', mono('[£ owed]'))}${facts('Store credit', mono('[£]'))}${facts('Bike in the workshop', 'WH-1042')}</div>
${note('Take the payment, use or refund the credit, and hand the bike back — then delete.')}`, `<span></span>${button('OK')}`, 560);
def('cs-privacy', privacyPage);
def('cs-privacy-blocked', () => overlay(privacyPage(), deleteBlocked()));
def('cs-privacy-delete', () => overlay(privacyPage(), deleteDialog()));

// ---------- From the page: a sale, store credit, editing details ----------
// A sale in the history opens as the till's past sale (journey 11 decision
// 13): refunds start there. A job opens the job page (journey 12).
function saleDialog() {
  const line = (t, sub, amt) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px">${t}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${mono(amt, 'font-size: 15px')}</div>`;
  return popup('sale-title', `Sale ${'B1-[0000]'}`, 'Till B1 · [date] · served by [name] · Maya Patel', `${line('[What was bought]', '[quantity]', '[£]')}${line('[What was bought]', '[quantity]', '[£]')}
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-top: 1px solid ${C.ink}"><span style="font-size: 16px; font-weight: 700">Total</span>${mono('[£ total]', 'font-size: 18px')}</div>
<div style="display: flex; justify-content: space-between; font-size: 14px; color: ${C.muted}"><span>Paid by</span><span>[card or cash]</span></div>`, `${button('Print the receipt', { variant: 'ghost' })}${button('Refund at the till')}`, 560);
}
// Decision 10: store credit, earned by buying, can be added or taken away
// with a reason, like a discount.
const creditDialog = () => popup('cr-title', 'Maya Patel’s store credit', 'Has [£] now', `
${choice('Change', [['Add credit', true], ['Take some away', false]])}
${field('Amount', { placeholder: '£0.00' })}
${choice('Reason', [['[Shop’s reason]', true], ['[Shop’s reason]', false], ['Other…', false]])}
${note('The change and its reason show in her history and in the reports.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add the credit')}`, 520);
const editDialog = () => popup('edit-title', 'Edit Maya Patel’s details', 'Nothing changes until you save', `
${field('Name', { value: MAYA.name })}
<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Phone', { value: MAYA.phone })}${field('Email', { value: MAYA.email })}</div>
<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('Address', { value: '[address]' })}${field('Postcode', { value: '[postcode]' })}</div>
${choice('Group', [['None', false], ['[Club name] members', true]])}
${field('Note', { value: '[A note everyone in the shop should know]' })}
<div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">Happy to hear about offers</span><span style="font-size: 13px; color: ${C.muted}">Agreed [date]</span></span>${offer('On', true)}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Save changes')}`, 640);
def('cs-sale', () => overlay(customerPage(), saleDialog()));
def('cs-credit', () => overlay(customerPage(), creditDialog()));
def('cs-edit', () => overlay(customerPage(), editDialog()));

def('cs-opt-folds', optionFolds);
def('cs-opt-timeline', optionTimeline);

// Decision 13: every board at desktop, tablet and phone, except the two
// layout options (desktop only). Boards are built when first read (getters),
// so importing this file draws nothing.
const DESKTOP_ONLY = new Set(['cs-opt-folds', 'cs-opt-timeline']);
for (const [id, fn] of recipes) {
  const sizes = DESKTOP_ONLY.has(id) ? ['desktop'] : ['desktop', 'tablet', 'phone'];
  screens[id] = {};
  for (const size of sizes) Object.defineProperty(screens[id], size, { enumerable: true, get: () => withSize(size, fn) });
}
// Journey 12's Customer account board is this page (decision 11).
export const customerPageAt = (size) => withSize(size, () => customerPage());

export const TITLES = {
  'cs-list': 'Customers: find someone, or add them',
  'cs-page': 'A customer’s page: details, bikes with warranty, one history',
  'cs-page-off': 'A shop with customer accounts switched off (Payments › Ways to pay)',
  'cs-page-over': 'Over her account limit',
  'cs-page-new': 'A new customer: nothing in the history yet',
  'cs-sale': 'A sale from her history: refunds start here',
  'cs-credit': 'Add or take away store credit, with a reason',
  'cs-edit': 'Edit her details',
  'cs-add': 'Add a customer: a person',
  'cs-add-company': 'Add a customer: a company or club',
  'cs-account': 'Her account: balance, her limit, statement, pay it off',
  'cs-transfer': 'Record a bank transfer',
  'cs-groups': 'Settings › Front desk › Payments › Customer groups',
  'cs-privacy': 'Privacy requests: dated, answered within a month',
  'cs-privacy-blocked': 'Can’t delete yet: money, credit or a bike still open',
  'cs-privacy-delete': 'Deleting someone’s details: sales stay, without their name',
  'cs-add-match': 'Adding someone who’s already here',
  'cs-page-dup': 'A possible duplicate, flagged on the page',
  'cs-merge': 'The same person? Keep or merge',
  'cs-opt-folds': 'Option 1: one page, everything in folding sections',
  'cs-opt-timeline': 'Option 2: a summary on the left, one history on the right',
};
export const ROWS = [
  { label: 'Customers and the customer page', screens: ['cs-list', 'cs-page', 'cs-page-over', 'cs-page-new', 'cs-page-off', 'cs-sale', 'cs-credit', 'cs-edit', 'cs-add', 'cs-add-company'] },
  { label: 'Accounts (pay later)', screens: ['cs-account', 'cs-transfer'] },
  { label: 'Customer groups', screens: ['cs-groups'] },
  { label: 'Privacy requests', screens: ['cs-privacy', 'cs-privacy-delete', 'cs-privacy-blocked'] },
  { label: 'Possible duplicates', screens: ['cs-add-match', 'cs-page-dup', 'cs-merge'] },
  { label: 'Options: the shape of the customer page (decision 2: option 2)', screens: ['cs-opt-folds', 'cs-opt-timeline'] },
];
// Account, history and reminders (journey 7) audit M11.
export const privacyPageAt = (size, web = false) => withSize(size, () => privacyPage(web));
export const customerPageWith = (size, on = {}) => withSize(size, () => customerPage(on));
