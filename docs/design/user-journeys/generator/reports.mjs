// Journey 17 — Reports and accounts, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-reports-and-accounts-review.md
//
// Decision 1: ready-made reports, plus a report you can build yourself.
// 2: build by starting from any report ("Change what's shown"), then save it
// as your own, shared or not. 3: a VAT report for any quarter; the return is
// filed elsewhere. 4: Xero or QuickBooks gets one summary per shop per closed
// day. 5: two switches on a person — "Can see reports", "Can see costs and
// margin". 6: the Workshop report.
//
// Real example data only: North Street Cycles, Bolton (tills B1–B3), Jack
// Lewis, Jo Taylor, Alex Morgan, the diary's example week (Mon 14 – Sun 20
// September 2026), the till's quick-button categories (Workshop, Parts,
// Accessories) and UK VAT rates (20%, 5%, 0%). No real day's or period's
// figures exist, so every amount and count is a bracketed placeholder.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, pill, offer, note, popup, overlay, withSize, isPhone, settingsPage, dataFolds, DATA_INTRO, fold, MANAGER } from './settings-frame.mjs';
import { withSite } from './diary.mjs';
import { today } from './opening.mjs';
import { personDialog, staffPage, peopleOpen } from './setup.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const DAYS = [['Mon', '14'], ['Tue', '15'], ['Wed', '16'], ['Thu', '17'], ['Fri', '18'], ['Sat', '19'], ['Sun', '20']];
const CATS = ['Workshop', 'Parts', 'Accessories'];

const wrap = (inner, who = OWNER, site = 'Bolton') => withSite(site, () => page('reports', 'Reports', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, who));
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 14 : 18}px; display: flex; flex-direction: column; gap: 10px">${inner}</div>`, extra);
const h2 = (t) => `<h2 style="margin: 0; font-size: 18px; font-weight: 700">${t}</h2>`;
const back = () => `<a href="#" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}Reports</a>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="min-height: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;

// The period choice every report opens with (decision 1).
const PERIODS = ['Today', 'This week', 'This month', 'Last month', 'Pick dates'];
const periodRow = (on = 'This week', extra = '') => `<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px"><div role="group" aria-label="Period" style="display: flex; flex-wrap: wrap; gap: 6px">${PERIODS.map((p) => pill(p, p === on)).join('')}</div><div style="display: flex; flex-wrap: wrap; gap: 8px">${extra}${button('Change what’s shown', { variant: 'default' })}${button('Download', { variant: 'default' })}</div></div>`;
const head = (title, sub, period, extra) => `${back()}<div style="display: flex; flex-direction: column; gap: 4px"><h1 style="margin: 0; font-size: ${isPhone() ? 22 : 26}px; font-weight: 700">${title}</h1>${note(sub)}</div>${periodRow(period, extra)}`;
// A headline figure with the comparison to the period before.
const stat = (k, v, before) => `<div style="display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; min-width: 0"><span style="font-size: 13px; color: ${C.muted}">${k}</span><span style="font-size: 22px; font-weight: 700">${v}</span><span style="font-size: 12px; color: ${C.muted}">${before}</span></div>`;
const stats = (items) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : items.length}, minmax(0, 1fr)); gap: 10px">${items.join('')}</div>`;
const VS = 'Last week [£]';
// A plain table: real headers, numbers right-aligned.
// `text` lists the columns that hold words (left-aligned, ordinary font); the
// rest are amounts and counts.
const table = (label, cols, rows, total = null, text = [0]) => { const n = (i) => !text.includes(i); return `<div style="overflow-x: auto"><table aria-label="${esc(label)}" style="width: 100%; border-collapse: collapse; font-size: 14px"><thead><tr>${cols.map((c, i) => `<th scope="col" style="text-align: ${n(i) ? 'right' : 'left'}; padding: 8px 6px; font-size: 12px; font-weight: 700; color: ${C.muted}; border-bottom: 1px solid ${C.border}; white-space: nowrap">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<${i ? 'td' : 'th scope="row"'} style="text-align: ${n(i) ? 'right' : 'left'}; padding: 8px 6px; border-bottom: 1px solid ${C.border}; font-weight: ${i ? 400 : 600}; ${n(i) ? `font-family: ${MONO}; ` : ''}white-space: nowrap">${v}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}${total ? `<tr>${total.map((v, i) => `<${i ? 'td' : 'th scope="row"'} style="text-align: ${n(i) ? 'right' : 'left'}; padding: 10px 6px; font-weight: 700; ${n(i) ? `font-family: ${MONO}; ` : ''}white-space: nowrap">${v}</${i ? 'td' : 'th'}>`).join('')}</tr>` : ''}</tbody></table></div>`; };

// ---------- Graphs (decision 7) ----------
// A graph above each report's table. No real figures exist, so the bars are
// even placeholders marked [£]: they show where the graph sits, not a shape.
// The period before is a faint outline behind each bar. The figures are in
// the table below, which the graph's label says.
const graph = (title, labels, valueLabel = '[£]') => {
  const h = isPhone() ? 120 : 150;
  const bars = labels.map((l) => `<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="font-size: 11px; font-family: ${MONO}; color: ${C.muted}">${valueLabel}</span><div style="position: relative; width: 100%; max-width: 56px; height: ${h}px; display: flex; align-items: flex-end; justify-content: center"><div style="position: absolute; left: 50%; transform: translateX(-30%); bottom: 0; width: 60%; height: ${Math.round(h * 0.6)}px; border: 1px dashed ${C.input}; border-bottom: 0; border-radius: 4px 4px 0 0"></div><div style="position: relative; width: 60%; transform: translateX(-15%); height: ${Math.round(h * 0.6)}px; background: ${C.ink}; opacity: 0.85; border-radius: 4px 4px 0 0"></div></div><span style="font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%">${l}</span></div>`).join('');
  return `<figure style="margin: 0; display: flex; flex-direction: column; gap: 10px" role="img" aria-label="${esc(title)}. The figures are in the table below.">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><figcaption style="font-size: 15px; font-weight: 700">${title}</figcaption><span style="display: inline-flex; align-items: center; gap: 14px; font-size: 12px; color: ${C.muted}"><span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 2px; background: ${C.ink}; opacity: 0.85"></span>This period</span><span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 2px; border: 1px dashed ${C.input}"></span>Period before</span></span></div>
<div aria-hidden="true" style="display: flex; align-items: flex-end; gap: ${isPhone() ? 4 : 10}px; padding: 6px 0 0; border-bottom: 1px solid ${C.border}">${bars}</div></figure>`;
};
const DAY_LABELS = DAYS.map(([d]) => d);

// ---------- The Reports page (decisions 1, 2, 5) ----------
const REPORTS = [
  ['Sales', 'Takings, number of sales and the average sale', false],
  ['Takings and cash-ups', 'Each closed day, each till, and any difference', false],
  ['Workshop', 'Jobs, labour and parts, how full each mechanic was', false],
  ['Discounts and refunds', 'Every discount and refund, with its reason', false],
  ['Margin and stock value', 'What you made on what you sold, and what’s on the shelves', true],
  ['VAT', 'VAT by rate for a quarter, ready for your accountant', true],
];
const reportCard = ([name, sub]) => `<a href="#" style="display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}; min-height: 76px; box-sizing: border-box"><span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="font-size: 16px; font-weight: 700">${name}</span><span aria-hidden="true" style="color: ${C.muted}">›</span></span><span style="font-size: 13px; color: ${C.muted}; line-height: 1.4">${sub}</span></a>`;
const mine = (name, sub, shared) => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${shared ? badge('Shared with managers', 'grey') : badge('Just you', 'grey')}<span aria-hidden="true" style="color: ${C.muted}">›</span></a>`;
const home = (staff = false) => wrap(`${note(`Thursday 17 September · North Street Cycles, Bolton${staff ? '' : ' · use the shop menu for another shop or all shops'}`)}
${box(`${h2('Reports')}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 10px">${REPORTS.filter((r) => !staff || !r[2]).map((r) => reportCard([r[0], r[1], false])).join('')}</div>`)}
${box(`${h2('Your reports')}${note('Start from any report, choose “Change what’s shown”, then “Save as my report”.')}${staff ? mine('[Report name]', 'Sales · by product · Accessories only', false) : `${mine('[Report name]', 'Sales · by product · Accessories only', true)}${mine('[Report name]', 'Workshop · by service · this month', false)}`}`)}`, staff ? STAFF : OWNER);

// ---------- Sales (decisions 1, 2) ----------
const salesRows = () => DAYS.map(([d, n]) => [`${d} ${n} Sep`, '[£]', '[n]', '[£]']);
const sales = (site = 'Bolton') => wrap(`${head('Sales', `${site === 'All shops' ? 'All shops' : `North Street Cycles, ${site}`} · Mon 14 – Sun 20 September, compared with the week before`, 'This week')}
${stats([stat('Takings', '£[sales]', VS), stat('Number of sales', '[n]', 'Last week [n]'), stat('Average sale', '£[£]', VS), stat('Refunds', '£[£]', VS)])}
${box(`${site === 'All shops' ? graph('Takings by shop', ['Bolton', '[Second site]']) : graph('Takings by day', DAY_LABELS)}${site === 'All shops' ? table('Sales by shop', ['Shop', 'Takings', 'Sales', 'Average'], [['Bolton', '[£]', '[n]', '[£]'], ['[Second site]', '[£]', '[n]', '[£]']], ['All shops', '[£]', '[n]', '[£]']) : table('Sales by day', ['Day', 'Takings', 'Sales', 'Average'], salesRows(), ['Week', '[£]', '[n]', '[£]'])}`)}
${note('Takings include VAT and take refunds off. Practice sales from moving across are never counted.')}`, OWNER, site);
// "Change what's shown" (decision 2): measure, split, narrow — then save.
const choiceGroup = (label, items, on) => `<div role="radiogroup" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${label}</span><div style="display: flex; flex-wrap: wrap; gap: 6px">${items.map((t) => `<button type="button" role="radio" aria-checked="${t === on}" style="min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid ${t === on ? C.ink : C.input}; background: ${t === on ? C.ink : C.panel}; color: ${t === on ? '#ffffff' : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`).join('')}</div></div>`;
const changePanel = () => popup('ch-title', 'Change what’s shown', 'Sales · this week', `
${choiceGroup('Measure', ['Takings', 'Items sold', 'Margin', 'Jobs', 'Hours'], 'Items sold')}
${choiceGroup('Split by', ['Day', 'Week', 'Category', 'Product', 'Staff member', 'Shop', 'Payment type'], 'Product')}
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Only</span><div role="group" aria-label="Only" style="display: flex; flex-wrap: wrap; gap: 6px">${offer('Accessories', true)}${offer('Workshop', false)}${offer('Parts', false)}${offer('A supplier…', false)}</div></div>
${note('“Margin” shows only for people who can see costs and margin.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save as my report', { variant: 'default' })}${button('Show it')}`, 640);
const changed = () => wrap(`${head('Sales', 'Items sold · by product · Accessories only · this week', 'This week', `<span style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.muted}">Changed</span>`)}
${box(`${graph('Items sold by product', ['[Product]', '[Product]', '[Product]', '[Product]'], '[n]')}${table('Items sold by product', ['Product', 'Items sold', 'Takings'], [['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]']], ['Accessories', '[n]', '[£]'])}`)}
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Save as my report')}${linkBtn('Back to the standard Sales report')}</div>`);
const saveDialog = () => popup('sv-title', 'Save as my report', 'Items sold · by product · Accessories only', `${field('Name', { value: '[Report name]' })}
<div role="radiogroup" aria-label="Who can see it" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Who can see it</span><div style="display: flex; flex-wrap: wrap; gap: 6px">${offer('Just me', false)}${offer('Me and the other managers', true)}</div></div>
${note('It opens on the latest period each time, under “Your reports”.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);

// ---------- Takings and cash-ups (Cash-up 6) ----------
const dayRow = (day, till, by, diff, warn = false) => [`${day} · ${mono(till)}`, `[£]`, `[£]`, warn ? `<span style="color: ${C.warnInk}; font-weight: 700">${diff}</span>` : diff, `<span style="font-family: inherit">${by}</span>`];
const takings = () => wrap(`${head('Takings and cash-ups', 'North Street Cycles, Bolton · each till’s closed days', 'This week')}
${stats([stat('Takings', '£[sales]', VS), stat('Card', '£[£]', VS), stat('Cash', '£[£]', VS), stat('Cash differences', '£[£]', 'Last week £[£]')])}
${box(`${graph('Takings by day', DAY_LABELS)}${table('Closed days', ['Day and till', 'Takings', 'Cash banked', 'Cash difference', 'Closed by'], [dayRow('Wed 16 Sep', 'B1', 'Jo Taylor', '£0.00'), dayRow('Wed 16 Sep', 'B2', 'Jo Taylor', '−£[£]', true), dayRow('Tue 15 Sep', 'B1', 'Jack Lewis', '£0.00'), dayRow('Mon 14 Sep', 'B1', 'Jo Taylor', '£0.00')], null, [0, 4])}`)}
${note('Open a day to see its end-of-day report. A manager can reopen a closed day, with a reason.')}`);
const ZROWS = ['Sales', 'Card', 'Cash', 'Gift cards, credit, accounts, other', 'Refunds', 'Voids [n] · £[£]', 'Discounts given [n] · £[£]', 'VAT in the day’s sales', 'Cash difference', 'Banked'];
const dayReport = () => popup('z-title', 'Wed 16 September · Till B2', 'Closed by Jo Taylor at [time]', `<div>${ZROWS.map((r) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span>${r.replace(/ \[n\].*$/, '')}</span><span style="font-family: ${MONO}">${r.includes('[n]') ? r.slice(r.indexOf('[n]')) : '£[£]'}</span></div>`).join('')}</div>`, `${button('Reopen this day', { variant: 'default' })}${button('Print', { variant: 'default' })}${button('Download')}`, 560);
const reopenDialog = () => popup('re-title', 'Reopen Wed 16 September, Till B2?', 'Its figures come out of the reports until it’s closed again', `${field('Why are you reopening it?', { placeholder: 'e.g. a card payment was counted as cash' })}
${note('Saved with your name and the time. It goes back to Needs attention until it’s closed again, and anything already sent to the accounts software is corrected when it is.')}`, `${button('Keep it closed', { variant: 'ghost' })}${button('Reopen the day')}`, 560);

// ---------- VAT (decision 3) ----------
const vat = () => wrap(`${head('VAT', 'North Street Cycles, Bolton · 1 July – 30 September 2026', 'This quarter', '').replace(PERIODS.map((p) => pill(p, p === 'This quarter')).join(''), ['This quarter', 'Last quarter', 'Pick dates'].map((p) => pill(p, p === 'This quarter')).join(''))}
${box(`${h2('Sales')}${table('VAT on sales by rate', ['Rate', 'Sales before VAT', 'VAT'], [['Standard 20%', '[£]', '[£]'], ['Reduced 5%', '[£]', '[£]'], ['Zero 0%', '[£]', '£0.00'], ['Refunds', '−[£]', '−[£]']], ['Total', '[£]', '[£]'])}`)}
${box(`${h2('Stock purchases')}<p role="note" style="margin: 0; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; line-height: 1.45"><strong>Stock purchases only — not your full VAT reclaim.</strong> Rent, bills and other costs don’t go through Wheelhouse.</p>${table('VAT on stock invoices', ['From', 'Before VAT', 'VAT'], [['Supplier invoices booked in · [n]', '[£]', '[£]']])}`)}
${note('Wheelhouse doesn’t file your VAT return. File it from your accounts software, or send this to your accountant.')}`, OWNER);

// ---------- Margin and stock value (decision 5) ----------
const margin = () => wrap(`${head('Margin and stock value', 'North Street Cycles, Bolton · this week', 'This week')}
${stats([stat('Sales before VAT', '£[£]', VS), stat('Cost of what sold', '£[£]', VS), stat('Margin', '£[£] · [n]%', 'Last week [n]%'), stat('Stock value at cost', '£[£]', 'Today')])}
${box(`${graph('Margin by category', CATS, '[n]%')}${table('Margin by category', ['Category', 'Sales before VAT', 'Cost', 'Margin', 'Margin %'], CATS.map((c) => [c, '[£]', '[£]', '[£]', '[n]%']), ['All', '[£]', '[£]', '[£]', '[n]%'])}`)}
${box(`<p role="note" style="margin: 0; font-size: 14px; line-height: 1.45"><strong>[n] products sold without a cost</strong> — their margin can’t be worked out, so they’re left out above.</p><div>${linkBtn('See them and add a cost')}</div>`)}`, OWNER);

// ---------- Workshop (decision 6) ----------
const full = (name, booked, avail) => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid ${C.border}"><div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px"><span style="font-weight: 700">${name}</span><span><span style="font-family: ${MONO}">${booked}</span> of <span style="font-family: ${MONO}">${avail}</span> hours booked · <strong>[n]% full</strong></span></div><div aria-hidden="true" style="height: 10px; border-radius: 999px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></div></div>`;
const workshop = () => wrap(`${head('Workshop', 'North Street Cycles, Bolton · this week', 'This week')}
${stats([stat('Jobs booked in', '[n]', 'Last week [n]'), stat('Finished', '[n]', 'Last week [n]'), stat('Collected', '[n]', 'Last week [n]'), stat('Booked in to ready', '[n] days', 'Average · last week [n]')])}
${box(graph('Jobs finished by day', DAY_LABELS, '[n]'))}
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'repeat(2, minmax(0, 1fr))'}; gap: 14px; align-items: start">
${box(`${h2('Workshop takings')}${table('Workshop takings', ['', 'This week', 'Last week'], [['Labour', '[£]', '[£]'], ['Parts', '[£]', '[£]']], ['Total', '[£]', '[£]'])}${h2('Quotes')}${table('Quotes', ['', 'Quotes'], [['Approved', '[n]'], ['Declined', '[n]'], ['No answer', '[n]']])}`)}
${box(`${h2('How full each mechanic was')}${full('Alex Morgan', '[n]', '[n]')}${full('Jo Taylor', '[n]', '[n]')}${full('Shared queue', '[n]', '—')}${note('Hours booked in the diary against the hours each mechanic is in, from their working days.')}`)}
</div>`, OWNER);

// ---------- Discounts and refunds (Selling at the till 4) ----------
const discounts = () => wrap(`${head('Discounts and refunds', 'North Street Cycles, Bolton · this week', 'This week')}
${stats([stat('Discounts given', '[n] · £[£]', VS), stat('Refunds', '[n] · £[£]', VS)])}
${box(table('Discounts and refunds', ['Sale', 'What', 'Reason', 'By', 'Amount'], [[`${mono('B1-[0000]')}`, 'Discount', '[Club name] members', 'Jo Taylor', '−[£]'], [`${mono('B1-[0000]')}`, 'Discount', '“[their reason]”', 'Jack Lewis', '−[£]'], [`${mono('B2-[0000]')}`, 'Refund', '[Reason]', 'Jo Taylor', '−[£]']], null, [0, 1, 2, 3]))}
${note('Split by reason or by staff member with “Change what’s shown”.')}`, OWNER);

// ---------- Accounts software (decision 4) ----------
const dataPage = (extra) => withSite('Bolton', () => settingsPage('data', 'Your data', DATA_INTRO, dataFolds() + extra, { who: OWNER }));
const connectOpen = () => `<div style="display: flex; flex-direction: column; gap: 10px">${note('Each closed day goes across as one summary per shop: sales by account, the VAT, and the money taken by how it was paid.')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Connect Xero', { variant: 'default' })}${button('Connect QuickBooks', { variant: 'default' })}</div>${note('Not using either? “Download everything” above has the same daily figures to import.')}</div>`;
const mapRow = (from, to, missing = false) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="flex-grow: 1; font-size: 15px; font-weight: 600">${from}</span><label style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)" for="m-${esc(from)}">Account for ${esc(from)}</label><select id="m-${esc(from)}" style="min-width: 220px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${missing ? C.danger : C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>${missing ? 'Choose an account' : to}</option></select></div>`;
const mapOpen = (missing = false) => `<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">${badge('Connected to Xero', 'green')}<span style="font-size: 13px; color: ${C.muted}">by Jack Lewis on [date]</span></div>
<h4 style="margin: 8px 0 0; font-size: 14px; font-weight: 700">Sales go to</h4>${CATS.map((c, i) => mapRow(c, '[Account]', missing && i === 2)).join('')}
<h4 style="margin: 12px 0 0; font-size: 14px; font-weight: 700">Money taken goes to</h4>${['Cash', 'Card', 'Customer accounts', 'Gift cards'].map((p) => mapRow(p, '[Account]')).join('')}
<h4 style="margin: 12px 0 0; font-size: 14px; font-weight: 700">VAT goes to</h4>${mapRow('VAT on sales', '[Account]')}`;
const logRow = (day, shop, ok) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${day} · ${shop}</span><span style="font-size: 13px; color: ${ok ? C.muted : C.warnInk}">${ok ? 'Sent at [time] · £[£]' : '[Category] has no account chosen'}</span></span>${ok ? badge('Sent', 'green') : button('Choose an account', { variant: 'default' })}</div>`;
const logOpen = () => `${logRow('Thu 17 Sep', 'Bolton', false)}${logRow('Wed 16 Sep', 'Bolton', true)}${logRow('Wed 16 Sep', '[Second site]', true)}${logRow('Tue 15 Sep', 'Bolton', true)}${note('Each day goes once its tills are all closed. A day that’s reopened is corrected when it closes again.')}`;
const accountsBoard = (open, summary) => dataPage(fold('Accounts software', summary, open));

// ---------- Who sees what (decision 5) ----------
const personBoard = () => overlay(staffPage({ people: peopleOpen(false) }), personDialog({ costs: true }));

// ---------- The boards ----------
def('rp-home', () => home());
def('rp-home-staff', () => home(true));
def('rp-sales', () => sales());
def('rp-sales-all', () => sales('All shops'));
def('rp-change', () => overlay(sales(), changePanel()));
def('rp-changed', () => changed());
def('rp-save', () => overlay(changed(), saveDialog()));
def('rp-takings', () => takings());
def('rp-day', () => overlay(takings(), dayReport()));
def('rp-reopen', () => overlay(takings(), reopenDialog()));
def('rp-vat', () => vat());
def('rp-margin', () => margin());
def('rp-workshop', () => workshop());
def('rp-discounts', () => discounts());
def('rp-accounts-connect', () => accountsBoard(connectOpen(), 'Not connected'));
def('rp-accounts-map', () => accountsBoard(mapOpen(), 'Connected to Xero'));
def('rp-accounts-log', () => accountsBoard(logOpen(), 'Connected to Xero · 1 day needs a look'));
def('rp-today-accounts', () => today({ accounts: true, as: OWNER }));
def('rp-person', () => personBoard());

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'rp-home': 'Reports: the ready-made reports, and your own',
  'rp-home-staff': 'Reports for Staff with “Can see reports” (no costs or margin)',
  'rp-sales': 'Sales: this week against last, day by day',
  'rp-sales-all': 'Sales for all shops: shop by shop',
  'rp-change': 'Change what’s shown: measure, split, only',
  'rp-changed': 'The changed report: items sold, by product, Accessories only',
  'rp-save': 'Save as my report: name, who can see it',
  'rp-takings': 'Takings and cash-ups: each till’s closed days',
  'rp-day': 'A closed day’s end-of-day report',
  'rp-reopen': 'Reopen a closed day, with a reason',
  'rp-vat': 'VAT for a quarter: sales by rate, stock purchases apart',
  'rp-margin': 'Margin and stock value',
  'rp-workshop': 'Workshop: jobs, takings, how full, turnaround, quotes',
  'rp-discounts': 'Discounts and refunds, with reasons',
  'rp-accounts-connect': 'Settings › Your data › Accounts software: connect',
  'rp-accounts-map': 'Which account each category and payment goes to',
  'rp-accounts-log': 'What was sent, and a day that needs a look',
  'rp-today-accounts': 'Today: a day that didn’t go to Xero',
  'rp-person': 'A person: “Can see reports” and “Can see costs and margin”',
};
export const ROWS = [
  { label: 'Reports', screens: ['rp-home', 'rp-home-staff', 'rp-sales', 'rp-sales-all'] },
  { label: 'Your own reports', screens: ['rp-change', 'rp-changed', 'rp-save'] },
  { label: 'Takings, VAT and margin', screens: ['rp-takings', 'rp-day', 'rp-reopen', 'rp-vat', 'rp-margin'] },
  { label: 'Workshop and discounts', screens: ['rp-workshop', 'rp-discounts'] },
  { label: 'Accounts software and who sees what', screens: ['rp-accounts-connect', 'rp-accounts-map', 'rp-accounts-log', 'rp-today-accounts', 'rp-person'] },
];
