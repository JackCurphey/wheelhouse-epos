// Journey 17 — Reports and accounts, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-reports-and-accounts-review.md
// UI audit: docs/design/user-journeys/reports-ui-audit.md (decision 8: every
// recommendation taken)
//
// Decision 1: ready-made reports, plus a report you can build yourself.
// 2: build by starting from any report ("Change what's shown"), then save it
// as your own, shared or not. 3: a VAT report for a VAT quarter; the return
// is filed elsewhere. 4: Xero or QuickBooks gets one summary per shop per
// closed day. 5: two switches on a person — "Can see reports", "Can see
// costs and margin". 6: the Workshop report. 7: a graph above every report
// (VAT excepted, audit H6), the table always below.
//
// Real example data only: North Street Cycles, Bolton (tills B1–B3), Jack
// Lewis, Jo Taylor, Alex Morgan, the diary's example week (Mon 14 – Sun 20
// September 2026, today Thursday 17), the till's quick-button categories
// (Workshop, Parts, Accessories), the Stockroom's categories (Bearings,
// Drivetrain — Stock control 10) and UK VAT rates (20%, 5%, 0%). No real day's
// or period's figures exist, so every amount and count is a bracketed
// placeholder, and graphs are even placeholder bars and a flat line.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, dataFolds, DATA_INTRO, fold } from './settings-frame.mjs';
import { withSite, withRooms } from './diary.mjs';
import { today } from './opening.mjs';
import { personDialog, staffPage, peopleOpen, managerStaffPage, MGR } from './setup.mjs';
import { yourSettingsDialog } from './app-map.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const DAYS = [['Mon', '14'], ['Tue', '15'], ['Wed', '16'], ['Thu', '17'], ['Fri', '18'], ['Sat', '19'], ['Sun', '20']];
const CATS = ['Workshop', 'Parts', 'Accessories'];
// UX walk-through 3 M10: Margin and stock value use the Stockroom's
// categories (Settings › Stockroom › Categories: Bearings, Drivetrain and the
// shop's own), not the till's quick-button groups. Margin adds labour as its
// own row; stock value has no labour row, since labour holds no stock.
const STOCK_CATS = ['Bearings', 'Drivetrain', '[Category]'];
const MARGIN_ROWS = [...STOCK_CATS, 'Labour'];
const SECOND = '[Second site]';

// The page: Owner by default. Staff with "Can see reports" get Reports in
// their sidebar and, working at one shop, a plain shop label (audit H3).
const wrap = (inner, who = OWNER, site = 'Bolton') => {
  const draw = () => page('reports', 'Reports', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, who);
  return who === STAFF ? withRooms(['reports'], () => withSite('Bolton', draw, 'one')) : withSite(site, draw);
};
const box = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 14 : 18}px; display: flex; flex-direction: column; gap: 10px">${inner}</div>`, extra);
const h3 = (t) => `<h3 style="margin: 0; font-size: 17px; font-weight: 700">${t}</h3>`;
const back = () => `<a href="#" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}All reports</a>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="min-height: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const bar = (t, action = '', tone = 'warn') => `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: 8px; background: ${tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : 'check', 18)}<span style="flex: 1 1 260px">${t}</span>${action}</div>`;

// One chip look for every choice: the chosen one dark with a tick (audit M3).
// A choice that doesn't fit is greyed and struck through, with its reason
// said under the group (M2).
const chip = (t, on, role = 'radio', why = '') => `<button type="button" role="${role}" aria-checked="${on}"${why ? ` aria-disabled="true" aria-description="${esc(why)}"` : ''} style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid ${why ? C.border : C.ink}; background: ${on ? C.ink : 'transparent'}; color: ${on ? '#ffffff' : why ? C.muted : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600; ${why ? 'text-decoration: line-through; ' : ''}">${on ? icon('check', 14) : ''}${t}</button>`;
const PERIODS = ['Today', 'This week', 'This month', 'Last month', 'Last 12 months', 'Pick dates'];
const periodGroup = (on, list = PERIODS) => `<div role="radiogroup" aria-label="Period" style="display: flex; flex-wrap: wrap; gap: 6px">${list.map((p) => chip(p, p === on)).join('')}</div>`;
// The report's title (an h2 under the page's one h1, audit L1) with Change
// what's shown and Download beside it (M1), then the period.
const title = (t, sub, actions) => `<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: ${isPhone() ? 22 : 26}px; font-weight: 700">${t}</h2>${note(sub)}</div><div style="${isPhone() ? 'flex: 1 1 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr))' : 'flex: 0 0 auto; display: flex; flex-wrap: wrap'}; gap: 8px">${actions}</div></div>`;
// On a phone the download button says just "Download" so both fit side by side.
const DL = () => button(isPhone() ? 'Download' : 'Download as spreadsheet', { variant: 'default' });
const head = (t, sub, period, { list = PERIODS, change = true } = {}) => `${back()}${title(t, sub, `${change ? button('Change what’s shown', { variant: 'default' }) : ''}${DL()}`)}${periodGroup(period, list)}`;
// A headline figure, with the comparison in words (audit M9).
const stat = (k, v, cmp) => `<div style="display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; min-width: 0"><span style="font-size: 13px; color: ${C.muted}">${k}</span><span style="font-size: 22px; font-weight: 700">${v}</span><span style="font-size: 12px; color: ${C.ink}">${cmp}</span></div>`;
const stats = (items) => `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : items.length}, minmax(0, 1fr)); gap: 10px">${items.join('')}</div>`;
const UP = (what = '£[£]', vs = 'the same days last week') => `[Up or down] ${what} on ${vs}`;
// A plain table; `text` lists the columns of words, the rest are amounts.
const table = (label, cols, rows, total = null, text = [0]) => { const n = (i) => !text.includes(i); return `<div style="overflow-x: auto"><table aria-label="${esc(label)}" style="width: 100%; border-collapse: collapse; font-size: ${isPhone() ? 13 : 14}px"><thead><tr>${cols.map((c, i) => `<th scope="col" style="text-align: ${n(i) ? 'right' : 'left'}; padding: 8px ${isPhone() ? 4 : 6}px; font-size: 12px; font-weight: 700; color: ${C.muted}; border-bottom: 1px solid ${C.border}; white-space: ${isPhone() ? 'normal' : 'nowrap'}; vertical-align: bottom">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<${i ? 'td' : 'th scope="row"'} style="text-align: ${n(i) ? 'right' : 'left'}; padding: 8px ${isPhone() ? 4 : 6}px; border-bottom: 1px solid ${C.border}; font-weight: ${i ? 400 : 600}; ${n(i) ? `font-family: ${MONO}; ` : ''}white-space: nowrap">${v}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}${total ? `<tr>${total.map((v, i) => `<${i ? 'td' : 'th scope="row"'} style="text-align: ${n(i) ? 'right' : 'left'}; padding: 10px 6px; font-weight: 700; ${n(i) ? `font-family: ${MONO}; ` : ''}white-space: nowrap">${v}</${i ? 'td' : 'th'}>`).join('')}</tr>` : ''}</tbody></table></div>`; };

// A phone board scrolled part-way down (as journey 3's Messages board).
const scrolled = (html, px) => (px ? `<style>.rp-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;?/, '<div data-scroll class="rp-scrolled" style="$1overflow-y: hidden;')}` : html);
const onPhone = (px) => (isPhone() ? px : 0);

// ---------- Graphs (decision 7; audit M1, M16, L7) ----------
// Even placeholder bars — they show where the graph sits, not a shape. A
// scale (zero and two gridlines), the same days before as a dashed outline,
// days not reached yet marked "Not yet", and a spoken description that names
// the busiest bar and the change, from the table's figures.
// Leftover audit M5: `stacked` draws two parts of one solid bar (the lower
// part dark, the upper part striped, so colour isn't the only signal) and
// leaves the dashed outline meaning "the period before" in every report.
const STRIPES = `repeating-linear-gradient(45deg, ${C.input} 0 2px, ${C.panel} 2px 6px)`;
const graph = (t, labels, { value = '[£]', key = ['This week so far', 'Same days last week'], upto = labels.length, says = 'busiest day [day]; [up or down] £[£] on the same days last week', stacked = false } = {}) => {
  const h = 120;
  const grid = [1, 0.5, 0].map((f) => `<div style="position: absolute; left: 0; right: 0; bottom: ${Math.round(h * f)}px; border-top: 1px ${f ? 'dashed' : 'solid'} ${f ? C.border : C.input}"><span style="position: absolute; left: 0; top: -8px; font-size: 11px; font-family: ${MONO}; color: ${C.muted}">${f === 1 ? value : f ? '' : '0'}</span></div>`).join('');
  const bars = labels.map((l, i) => `<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px"><div style="position: relative; width: 100%; max-width: 56px; height: ${h}px; display: flex; align-items: flex-end; justify-content: center">${stacked ? `<div style="width: 60%; display: flex; flex-direction: column"><div style="height: ${Math.round(h * 0.25)}px; background: ${STRIPES}; border: 1px solid ${C.ink}; border-bottom: 0; border-radius: 4px 4px 0 0; box-sizing: border-box"></div><div style="height: ${Math.round(h * 0.4)}px; background: ${C.ink}; opacity: 0.85"></div></div>` : i < upto ? `<div style="position: absolute; left: 50%; transform: translateX(-30%); bottom: 0; width: 60%; height: ${Math.round(h * 0.6)}px; border: 1px dashed ${C.input}; border-bottom: 0; border-radius: 4px 4px 0 0"></div><div style="position: relative; width: 60%; transform: translateX(-15%); height: ${Math.round(h * 0.6)}px; background: ${C.ink}; opacity: 0.85; border-radius: 4px 4px 0 0"></div>` : `<span style="padding-bottom: 6px; font-size: 11px; color: ${C.muted}">Not yet</span>`}</div><span style="font-size: 12px; font-weight: 600; text-align: center; line-height: 1.25; ${isPhone() && labels.length > 8 ? `white-space: nowrap${i % 2 ? '; visibility: hidden' : ''}` : 'max-width: 100%; overflow-wrap: anywhere'}">${l}</span></div>`).join('');
  return `<figure style="margin: 0; display: flex; flex-direction: column; gap: 12px" role="img" aria-label="${esc(`${t}: ${says}. The figures are in the table below.`)}">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><figcaption style="font-size: 15px; font-weight: 700">${t}</figcaption><span style="display: inline-flex; align-items: center; gap: 14px; font-size: 12px; color: ${C.ink}"><span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 2px; background: ${C.ink}; opacity: 0.85"></span>${key[0]}</span>${key[1] ? `<span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 2px; ${stacked ? `box-sizing: border-box; border: 1px solid ${C.ink}; background: ${STRIPES}` : `border: 1px dashed ${C.input}`}"></span>${key[1]}</span>` : ''}</span></div>
<div aria-hidden="true" style="position: relative; padding-left: 40px"><div style="position: absolute; left: 0; right: 0; top: 0; height: ${h}px">${grid}</div><div style="position: relative; display: flex; align-items: flex-start; gap: ${isPhone() ? 4 : 10}px">${bars}</div></div></figure>`;
};
const DAY_LABELS = DAYS.map(([d, n]) => `${d}<br>${n}`);
const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const lineGraph = (t, labels) => {
  const W = isPhone() ? 330 : 1000, H = 120, step = W / (labels.length - 1), y = Math.round(H * 0.4), y2 = Math.round(H * 0.6);
  const pts = labels.map((_, i) => `${Math.round(i * step)},${y}`).join(' ');
  const pts2 = labels.map((_, i) => `${Math.round(i * step)},${y2}`).join(' ');
  return `<figure style="margin: 0; display: flex; flex-direction: column; gap: 10px" role="img" aria-label="${esc(`${t}: busiest month [month]; [up or down] £[£] on the 12 months before. The figures are in the table below.`)}">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><figcaption style="font-size: 15px; font-weight: 700">${t}</figcaption><span style="display: inline-flex; align-items: center; gap: 14px; font-size: 12px"><span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 16px; height: 0; border-top: 3px solid ${C.ink}"></span>Last 12 months</span><span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 16px; height: 0; border-top: 2px dashed ${C.input}"></span>The 12 months before</span></span></div>
<svg aria-hidden="true" viewBox="-40 -10 ${W + 50} ${H + 20}" style="width: 100%; height: ${H + 20}px; overflow: visible">${[0, 0.5, 1].map((f) => `<line x1="0" y1="${Math.round(H * f)}" x2="${W}" y2="${Math.round(H * f)}" stroke="${f === 1 ? C.input : C.border}"${f === 1 ? '' : ' stroke-dasharray="4 4"'}/>`).join('')}<text x="-8" y="4" text-anchor="end" font-size="11" fill="${C.muted}">[£]</text><text x="-8" y="${H + 4}" text-anchor="end" font-size="11" fill="${C.muted}">0</text><polyline points="${pts2}" fill="none" stroke="${C.input}" stroke-width="2" stroke-dasharray="6 5"/><polyline points="${pts}" fill="none" stroke="${C.ink}" stroke-width="3"/>${labels.map((_, i) => `<circle cx="${Math.round(i * step)}" cy="${y}" r="4" fill="${C.ink}"/>`).join('')}</svg>
<div aria-hidden="true" style="display: flex; justify-content: space-between; padding-left: ${isPhone() ? 0 : 36}px; font-size: 12px; font-weight: 600">${labels.map((l, i) => `<span style="${isPhone() && i % 2 ? 'visibility: hidden' : ''}">${l}</span>`).join('')}</div></figure>`;
};

// ---------- The Reports page (decisions 1, 2, 5; audit M6, L1, L5) ----------
const REPORTS = [
  ['Sales', 'Takings, number of sales and the average sale', false],
  ['Takings and cash-ups', 'Each closed day and till, and any cash difference', false],
  ['Workshop', 'Jobs, labour and parts, how full each mechanic was', false],
  ['Discounts and refunds', 'Every discount and refund, with its reason', false],
  // Leftover screens decision 5 (2 Oct): REP-10.
  ['Returning customers', 'Who comes back, and who hasn’t been in for a while', false],
  ['Margin and stock value', 'What you made on what you sold, what’s on the shelves, and stock written off', true], // UX walk-through 3 M7
  ['VAT', 'VAT by rate for your VAT quarter, for your accountant', true],
  // Management oversight (journey 20) decisions 1 and 5: owners and
  // managers only.
  ['Activity log', 'What was done, when and by whom: prices, voids, refunds, discounts, jobs, stock', true],
  // Cycle to Work (journey 6) audit M6: what scheme providers still owe.
  // UX walk-through 5 H3 (option 1): owed and paid, with the commission.
  ['Cycle to Work: owed and paid', 'What each provider owes, has paid, and kept as commission', true],
];
const reportCard = ([name, sub]) => `<a href="#" style="display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}; min-height: 76px; box-sizing: border-box"><span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="font-size: 16px; font-weight: 700">${name}</span><span aria-hidden="true" style="color: ${C.muted}">›</span></span><span style="font-size: 13px; color: ${C.muted}; line-height: 1.4">${sub}</span></a>`;
const menuBtn = (name) => `<button type="button" aria-label="More for ${esc(name)}" aria-haspopup="menu" style="flex-shrink: 0; width: 44px; height: 44px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 20px; font-weight: 700; color: ${C.ink}">…</button>`;
const mine = (name, sub, who, own = true) => `<div style="display: flex; align-items: center; gap: 8px; min-height: 56px; border-top: 1px solid ${C.border}"><a href="#" style="display: flex; align-items: center; gap: 12px; flex-grow: 1; min-height: 56px; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${badge(who, 'grey')}</a>${own ? menuBtn(name) : ''}</div>`;
const yourReports = (staff) => box(`${h3('Your reports')}${note('Start from any report, choose “Change what’s shown”, then “Save as my report”.')}${staff
  ? `${mine('[Report name]', 'Sales: items sold by product · Accessories only', 'Just you')}${mine('[Report name]', 'Workshop: jobs by service', 'Shared by Jack Lewis', false)}`
  : `${mine('[Report name]', 'Sales: items sold by product · Accessories only', 'Shared with managers')}${mine('[Report name]', 'Workshop: jobs by service', 'Just you')}`}`);
const home = (staff = false) => wrap(`${note(`Thursday 17 September · North Street Cycles, Bolton${staff ? '' : ' · use the shop menu for another shop or all shops'}`)}
${box(`${h3('Ready-made reports')}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 10px">${REPORTS.filter((r) => !staff || !r[2]).map(reportCard).join('')}</div>`)}
${yourReports(staff)}`, staff ? STAFF : OWNER);
// The "…" menu on your own saved report (audit M6). One shared with you
// says who shared it and has no menu (on the Staff board).
const homeShared = () => wrap(`${note('Thursday 17 September · North Street Cycles, Bolton · use the shop menu for another shop or all shops')}
${box(`${h3('Ready-made reports')}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 10px">${REPORTS.map(reportCard).join('')}</div>`)}
${box(`${h3('Your reports')}${mine('[Report name]', 'Sales: items sold by product · Accessories only', 'Shared with managers')}<div style="position: relative">${mine('[Report name]', 'Workshop: jobs by service', 'Just you')}<div role="menu" aria-label="[Report name]" style="position: absolute; right: 0; top: 50px; z-index: 5; width: 240px; padding: 6px; box-sizing: border-box; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28)">${['Rename', 'Share with managers', 'Delete'].map((t) => `<button type="button" role="menuitem" style="display: flex; align-items: center; width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; font-family: inherit; font-size: 15px; font-weight: 600; text-align: left; color: ${t === 'Delete' ? C.danger : C.ink}">${t}</button>`).join('')}</div></div>`)}
<div style="height: 120px"></div>`);
const deletedBar = () => wrap(`${bar('“[Report name]” deleted.', linkBtn('Undo'), 'done')}
${box(`${h3('Ready-made reports')}<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 3}, minmax(0, 1fr)); gap: 10px">${REPORTS.map(reportCard).join('')}</div>`)}
${box(`${h3('Your reports')}${mine('[Report name]', 'Sales: items sold by product · Accessories only', 'Shared with managers')}`)}`);

// ---------- Sales (decisions 1, 2; audit M7, M8, M13) ----------
// This week, on Thursday: so far, against the same days last week.
const SO_FAR = 'So far: Mon 14 – Thu 17 September, against the same days last week';
const shopName = (site) => (site === 'All shops' ? 'All shops' : `North Street Cycles, ${site}`);
const salesRows = () => DAYS.map(([d, n], i) => (i < 4 ? [`${d} ${n} Sep`, '[£]', '[n]', '[£]'] : [`${d} ${n} Sep`, '—', '—', '—']));
const sales = (site = 'Bolton') => wrap(`${head('Sales', `${shopName(site)} · ${SO_FAR}`, 'This week')}
${stats([stat('Takings (with VAT)', '£[£]', UP()), stat('Number of sales', '[n]', UP('[n]')), stat('Average sale', '£[£]', UP()), stat('Refunds', '£[£]', UP())])}
${box(`${site === 'All shops'
  ? `${graph('Takings by shop', ['Bolton', SECOND], { says: 'Bolton £[£], [Second site] £[£]' })}${table('Sales by shop', ['Shop', 'Takings', 'Sales', 'Average'], [['Bolton', '[£]', '[n]', '[£]'], [SECOND, '[£]', '[n]', '[£]']], ['All shops', '[£]', '[n]', '[£]'])}`
  : `${graph('Takings by day', DAY_LABELS, { upto: 4 })}${table('Sales by day', ['Day', 'Takings', 'Sales', 'Average'], salesRows(), ['So far', '[£]', '[n]', '[£]'])}`}`)}
${note('Takings include VAT and take refunds off. Practice sales from moving across are never counted.')}`, OWNER, site);
// Nothing sold yet, and no period before to compare with (audit M7).
const salesEmpty = () => wrap(`${head('Sales', 'North Street Cycles, Bolton · Today, Thursday 17 September', 'Today')}
${box(`<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 12px; text-align: center"><span style="font-size: 17px; font-weight: 700">Nothing sold yet today</span>${note('Sales show here as soon as the first one goes through a till.')}</div>`)}
${box(`${h3('Nothing to compare with yet')}${note('The shop started on Wheelhouse on [date], so there’s no period before this one. Comparisons start once there is.')}`)}`);
const salesYear = () => wrap(`${head('Sales', 'North Street Cycles, Bolton · October 2025 – September 2026, against the 12 months before', 'Last 12 months')}
${stats([stat('Takings (with VAT)', '£[£]', UP('£[£]', 'the 12 months before')), stat('Number of sales', '[n]', UP('[n]', 'the 12 months before')), stat('Average sale', '£[£]', UP('£[£]', 'the 12 months before')), stat('Refunds', '£[£]', UP('£[£]', 'the 12 months before'))])}
${box(`${lineGraph('Takings by month', MONTHS)}${table('Takings by month', ['Month', 'Takings', 'Sales', 'Average'], MONTHS.map((m) => [m, '[£]', '[n]', '[£]']), ['12 months', '[£]', '[n]', '[£]'])}`)}`);
// Pick dates (audit M8).
const pickDates = () => popup('pd-title', 'Pick dates', 'Sales · North Street Cycles, Bolton', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 12px">${field('From', { type: 'date', value: '2026-09-01' })}${field('To', { type: 'date', value: '2026-09-17' })}</div>${note('Compared with the same number of days just before.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Show report')}`, 520);
// Your settings: graphs on or off, in Accessibility (decision 7; audit L4).
// Scrolled down the Accessibility list so the new row is in view.
const settingsGraphs = () => overlay(home(), scrolled(yourSettingsDialog(SIZE, { graphs: true }).replace('Jo Taylor · Staff', 'Jack Lewis · Owner'), onPhone(420))
  .replace('padding: 18px 22px 22px; display: grid;', 'padding: 18px 22px 22px; min-height: 0; overflow: hidden; display: grid;')
  .replace(/(grid-template-columns: 250px[^>]*>.*?<\/div>)<div style="display: flex; flex-direction: column; gap: 12px">/s, '$1<div style="display: flex; flex-direction: column; gap: 12px; position: relative; top: -250px">'));

// ---------- Change what's shown, and saving (decision 2; audit M2–M5) ----------
const choiceGroup = (label, items, on, dims = {}) => `<div role="radiogroup" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">${label}</span><div style="display: flex; flex-wrap: wrap; gap: 6px">${items.map((t) => chip(t, t === on, 'radio', dims[t] || '')).join('')}</div>${Object.keys(dims).length ? `<span style="font-size: 13px; color: ${C.muted}">${Object.entries(dims).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>` : ''}</div>`;
const changePanel = () => popup('ch-title', 'Change what’s shown', 'Sales · this week so far', `
${choiceGroup('Measure', ['Takings', 'Items sold', 'Margin', 'Jobs', 'Hours'], 'Items sold', { Jobs: 'workshop only — choose it from the Workshop report', Hours: 'workshop only' })}
${choiceGroup('Split by', ['Day', 'Week', 'Category', 'Product', 'Staff member', 'Shop', 'Payment type'], 'Product', { 'Payment type': 'payments aren’t split by item' })}
<div role="group" aria-label="Only — pick one or more" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Only <span style="font-weight: 400; color: ${C.muted}">— pick one or more</span></span><div style="display: flex; flex-wrap: wrap; gap: 6px">${CATS.map((c) => chip(c, c === 'Accessories', 'checkbox')).join('')}</div><span style="font-size: 14px; font-weight: 600">Supplier</span><div style="display: flex; flex-wrap: wrap; gap: 6px">${chip('Any supplier', true, 'radio')}${chip('[Supplier]', false, 'radio')}${chip('[Supplier]', false, 'radio')}</div></div>`, `${button('Cancel', { variant: 'ghost' })}${button('Show report')}`, 680);
const CHANGED_SUB = `Changed from Sales · Accessories only · ${SO_FAR}`;
const changed = () => wrap(`${back()}${title('Sales: items sold by product', CHANGED_SUB, `${button('Change what’s shown', { variant: 'default' })}${DL()}`)}
${bar('You’ve changed this report. Save it to come back to it.', `<span style="display: inline-flex; gap: 8px; flex-wrap: wrap">${button('Save as my report')}${linkBtn('Back to Sales')}</span>`, 'done')}
${periodGroup('This week')}
${box(`${graph('Items sold by product', ['[Product]', '[Product]', '[Product]', '[Product]'], { value: '[n]', says: 'most sold [Product]; [up or down] [n] on the same days last week' })}${table('Items sold by product', ['Product', 'Items sold', 'Takings'], [['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]'], ['[Product]', '[n]', '[£]']], ['Total, Accessories only', '[n]', '[£]'])}`)}`);
const saveDialog = (taken = false) => popup('sv-title', 'Save as my report', 'Sales: items sold by product · Accessories only', `${field('Name (needed)', taken ? { value: '[Report name]', error: 'You already have a report with this name. Choose another name.' } : { value: '[Report name]' })}
<div role="radiogroup" aria-label="Who can see it" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Who can see it</span><div style="display: flex; flex-wrap: wrap; gap: 6px">${chip('Just me', true)}${chip('Me and the other managers', false)}</div></div>
${note('It opens on the latest period each time, under “Your reports”.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);

// ---------- Takings and cash-ups (Cash-up 6; audit H1, H2, M12, M17, L3) ----------
// Each closed day opens from its row (H1).
const dayLink = (day, till) => `<a href="#" style="display: inline-flex; align-items: center; gap: 6px; min-height: 40px; color: ${C.ink}; font-weight: 600">${day} · ${mono(till)}<span aria-hidden="true" style="color: ${C.muted}">›</span></a>`;
const sent = (s) => ({ sent: badge('Sent', 'green'), open: badge('Not closed yet', 'grey'), reopened: badge('Reopened', 'amber'), failed: badge('Not sent', 'amber') }[s]);
// UX walk-through 2 M5: each day's online payments are a line of their own,
// from [payment provider], kept out of every till's close. Nothing to count or
// bank, so those columns are empty; it goes to Xero with that day's summary.
const onlineRow = (day, s, soFar = false) => [`${day} · Online`, soFar ? '[£] so far' : '[£]', '—', '—', 'Not a till', sent(s)];
const dayRows = (reopened) => [
  [`Thu 17 Sep · ${mono('B1')}`, '—', '—', '—', 'Not closed yet', sent('open')],
  onlineRow('Thu 17 Sep', 'open', true),
  [dayLink('Wed 16 Sep', 'B2'), '[£]', '[£]', `<span style="color: ${C.warnInk}; font-weight: 700">−£[£]</span>`, 'Jo Taylor', reopened ? sent('reopened') : sent('failed')],
  [dayLink('Wed 16 Sep', 'B1'), '[£]', '[£]', '£[£]', 'Jo Taylor', reopened ? sent('reopened') : sent('failed')],
  onlineRow('Wed 16 Sep', reopened ? 'reopened' : 'failed'),
  [dayLink('Tue 15 Sep', 'B1'), '[£]', '[£]', '£[£]', 'Jack Lewis', sent('sent')],
  onlineRow('Tue 15 Sep', 'sent'),
  [dayLink('Mon 14 Sep', 'B1'), '[£]', '[£]', '£[£]', 'Jo Taylor', sent('sent')],
  onlineRow('Mon 14 Sep', 'sent'),
];
const ONLINE_NOTE = 'Online is what customers paid on the website, from [payment provider]. It’s separate from the tills: no till counts it, and it’s in no till’s close.';
// A reopened day is left out of every report until it closes again, and
// each report says so (H2).
const reopenedBar = () => bar('<strong>Wed 16 Sep, Till B2 is reopened</strong> — its figures are left out until it’s closed again.', button('Close the day', { variant: 'default' }));
const takings = ({ reopened = false, site = 'Bolton' } = {}) => wrap(`${head('Takings and cash-ups', `${shopName(site)} · ${SO_FAR}`, 'This week')}
${reopened ? reopenedBar() : ''}
${stats([stat('Takings (with VAT)', '£[£]', UP()), stat('Card', '£[£]', UP()), stat('Cash', '£[£]', UP()), stat('Other', '£[£]', 'Gift cards, store credit and customer accounts'), stat('Cycle to Work', '£[£]', 'Owed by providers, not in the drawer') /* UX walk-through 5 H3 */, stat('Online', '£[£]', 'Paid on the website · separate from the tills'), stat('Cash differences', '£[£]', UP())])}
${box(`${graph('Takings by closed day', DAY_LABELS, { upto: 3, key: ['Closed days this week', 'Same days last week'] })}${site === 'All shops'
  ? table('Closed days by shop', ['Shop', 'Takings at the tills', 'Online', 'Cash banked', 'Cash difference', 'Sent to Xero'], [['Bolton', '[£]', '[£]', '[£]', '£[£]', `${mono('[n]')} of ${mono('[n]')} days`], [SECOND, '[£]', '[£]', '[£]', '£[£]', `${mono('[n]')} of ${mono('[n]')} days`]], ['All shops', '[£]', '[£]', '[£]', '£[£]', ''], [0, 5])
  : table('Closed days', ['Day and till', 'Takings', 'Cash banked', 'Cash difference', 'Closed by', 'Sent to Xero'], dayRows(reopened), null, [0, 4, 5])}`)}
${note(ONLINE_NOTE)}
${note('Open a closed day for its end-of-day report. A manager can reopen it from there, with a reason.')}`, OWNER, site);
// A row's third part is a line under its name.
// UX walk-through 2 M2: the morning's float, and any difference, stays on the
// day's report after "Seen" is pressed.
const ZROWS = [['Sales', '£[£]'], ['Card', '£[£]'], ['Cash', '£[£]'], ['Gift cards, store credit, customer accounts', '£[£]'], ['Cycle to Work', '£[£]', 'Owed by providers, not in the drawer'] /* UX walk-through 5 H3 */, ['Refunds', '£[£]'], ['Voids', `${'[n]'} · £[£]`], ['Discounts given', '[n] · £[£]'], ['VAT in the day’s sales', '£[£]'], ['Float at the start', '£[£]', '£[£] short, counted by Jo Taylor at [time]'], ['Cash difference', '−£[£]'], ['Banked', '£[£]']];
const zRow = ([k, v, sub]) => `<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><dt style="display: flex; flex-direction: column; gap: 2px">${k}${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</dt><dd style="margin: 0; font-family: ${MONO}; white-space: nowrap">${v}</dd></div>`;
// UX walk-through 2 M5: the day's online payments, said apart from this till.
const zOnline = () => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}"><div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px; font-weight: 700"><span>Online that day</span>${mono('£[£]')}</div><span style="font-size: 13px; line-height: 1.45">Paid on the website, from [payment provider]. Separate from the tills — it isn’t in this till’s figures above.</span></div>`;
const dayReport = () => popup('z-title', 'Wed 16 September · Till B2', 'Closed by Jo Taylor at [time]', `<dl style="margin: 0">${ZROWS.map(zRow).join('')}</dl>${zOnline()}`, `${button('Reopen this day', { variant: 'default' })}${button('Print', { variant: 'default' })}${button('Download as spreadsheet')}`, 560);
const reopenDialog = () => popup('re-title', 'Reopen Wed 16 September, Till B2?', 'Its figures come out of the reports until it’s closed again', `${field('Why are you reopening it? (needed)', { placeholder: 'e.g. a card payment was counted as cash' })}
${note('Saved with your name and the time. The day goes back to Needs attention, and what was sent to Xero is corrected when it’s closed again.')}`, `${button('Keep it closed', { variant: 'ghost' })}${button('Reopen the day').replace('<button', '<button aria-disabled="true"').replace('style="', 'style="opacity: 0.45; ')}`, 560);

// ---------- VAT (decision 3; audit H6) ----------
// The shop's VAT quarter (asked once). No graph — the tables are what the
// accountant needs — and no "Change what's shown".
const VATP = ['This VAT quarter', 'Last VAT quarter', 'Pick dates'];
// UX walk-through 3 M8 (option 1): the Stock purchases box never shows a
// figure that's short. With the invoice check off it says to take the figure
// from the accounts software; with it on it says how many deliveries are
// still waiting for their invoice, and links to them.
const vat = (site = 'Bolton', { checkOff = false } = {}) => wrap(`${head('VAT', `${shopName(site)} · this VAT quarter, [start] – [end], against the quarter before`, 'This VAT quarter', { list: VATP, change: false })}
${box(`${h3('Sales')}${site === 'All shops'
  ? table('VAT on sales by shop', ['Shop', 'Sales before VAT', 'VAT charged', 'Quarter before'], [['Bolton', '[£]', '[£]', '[£]'], [SECOND, '[£]', '[£]', '[£]']], ['All shops', '[£]', '[£]', '[£]'])
  : table('VAT on sales by rate', ['Rate', 'Sales before VAT', 'VAT charged', 'Quarter before'], [['Standard 20%', '[£]', '[£]', '[£]'], ['Reduced rate 5%', '[£]', '[£]', '[£]'], ['Zero rate 0%', '[£]', '[£]', '[£]'], ['Refunds', '−[£]', '−[£]', '−[£]']], ['Total', '[£]', '[£]', '[£]'])}`)}
${box(`${h3('Stock purchases')}<p role="note" style="margin: 0; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; line-height: 1.45"><strong>Stock purchases only — not your full VAT reclaim.</strong> Rent, bills and other costs don’t go through Wheelhouse.</p>${checkOff
  ? `<p style="margin: 0; font-size: 15px; line-height: 1.5">Supplier invoices are checked in your accounts software — take this figure from there.</p>${note('The invoice check is off in Settings › Stockroom, so Wheelhouse has no supplier invoices to add up.')}`
  : `${table('VAT on stock invoices', ['From', 'Before VAT', 'VAT', 'Quarter before'], [['Supplier invoices booked in · [n]', '[£]', '[£]', '[£]']])}<p style="margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 14px; line-height: 1.45"><span>${mono('[n]')} deliveries are still waiting for their invoice and aren’t in this.</span>${linkBtn('See them', 'See the deliveries waiting for their invoice')}</p>`}`)}
${note('No graph here: these are the exact figures your accountant needs. Wheelhouse doesn’t file your VAT return — file it from your accounts software, or send this to your accountant.')}`, OWNER, site);
const vatFirst = () => overlay(vat(), popup('vq-title', 'When does your VAT quarter start?', 'Asked once. Change it later in Settings › Shop and sites.', `<div role="radiogroup" aria-label="Months your VAT quarters start" style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px">${['January, April, July, October', 'February, May, August, November', 'March, June, September, December'].map((t, i) => chip(t, i === 0)).join('')}</div>${note('It’s on your VAT registration, or ask your accountant.')}`, `${button('Not now', { variant: 'ghost' })}${button('Save')}`, 560));

// ---------- Margin and stock value (decision 5; audit M11) ----------
// UX walk-through 3 M7: "Stock written off" — a stock take's counted under
// and over, and each adjustment reason (Stock control 6's reasons), at cost,
// for the period; each row opens its counts or products.
// UX walk-through 3 L3: one line under the stock value says what it includes.
const WRITTEN_OFF = [
  ['Stock takes · counted under', '[n]', '−[£]', 'See the counts', 'See the stock takes counted under'],
  ['Stock takes · counted over', '[n]', '+[£]', 'See the counts', 'See the stock takes counted over'],
  ['Adjusted · Damaged', '[n]', '−[£]', 'See the products', 'See the products adjusted as damaged'],
  ['Adjusted · Lost or stolen', '[n]', '−[£]', 'See the products', 'See the products adjusted as lost or stolen'],
  ['Adjusted · Used in the workshop', '[n]', '−[£]', 'See the products', 'See the products adjusted as used in the workshop'],
  ['Adjusted · Faulty — to return to supplier', '[n]', '−[£]', 'See the products', 'See the products adjusted as faulty, to return to the supplier'],
  ['Adjusted · Found', '[n]', '+[£]', 'See the products', 'See the products adjusted as found'],
  ['Adjusted · Other', '[n]', '[£]', 'See the products', 'See the products adjusted for another reason'],
];
const margin = () => wrap(`${head('Margin and stock value', `North Street Cycles, Bolton · ${SO_FAR}`, 'This week')}
${stats([stat('Sales before VAT', '£[£]', UP()), stat('What it cost you', '£[£]', UP()), stat('Margin (sales less cost)', '£[£] · [n]%', UP('[n] points'))])}
<p role="note" style="margin: 0; font-size: 14px; line-height: 1.45"><strong>[n] products sold without a cost</strong> — their margin can’t be worked out, so they’re left out below. ${linkBtn('See them and add a cost')}</p>
${box(`${graph('Margin by category', MARGIN_ROWS, { value: '[n]%', says: 'highest [Category] [n]%; [up or down] [n] points on the same days last week' })}${table('Margin by category', ['Category', 'Sales before VAT', 'What it cost you', 'Margin', 'Margin %'], MARGIN_ROWS.map((c) => [c, '[£]', '[£]', '[£]', '[n]%']), ['All', '[£]', '[£]', '[£]', '[n]%'])}`)}
${box(`${h3('On the shelves today')}<p style="margin: 0; font-size: 15px">Stock value, at what it cost you: ${mono('£[£]', 'font-weight: 700')}</p>${note(`Includes stock held for customers (${mono('£[£]')}). Stock on its way between shops counts at the shop it’s going to (${mono('£[£]')}).`)}${table('Stock value by category', ['Category', 'Items', 'What it cost you'], STOCK_CATS.map((c) => [c, '[n]', '[£]']), ['All', '[n]', '[£]'])}`)}
${box(`${h3('Stock written off')}${note('Stock takes and adjustments this week, at what it cost you.')}${table('Stock written off', ['Why', 'Items', 'At cost', ''], WRITTEN_OFF.map(([why, n, v, link, label]) => [why, n, v, linkBtn(link, label)]), ['All', '[n]', '[£]', ''], [0, 3])}`)}`);

// ---------- Returning customers (leftover screens decision 5, 2 Oct) ----------
// New and returning customers each month, the share back within 12 months,
// then the customers not seen for [n] months. Contact is suggested only for
// customers who said yes to messages.
// Leftover audit M9: a Message button only for customers happy to hear from
// the shop; L7: the record's own wording, "Last bought or collected", and
// placeholders for every name.
const lapsed = (yes) => [`<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; color: ${C.ink}">[Customer]</a>`, '[date]', '[£]', yes ? `<span style="display: inline-flex; align-items: center; justify-content: flex-start; gap: 10px; flex-wrap: wrap">Yes${button('Message', { variant: 'default', size: 'sm' }).replace('<button type="button"', '<button type="button" aria-label="Message [Customer]"').replace('padding: 5px 10px', 'min-height: 44px; padding: 5px 12px')}</span>` : 'No'];
// M7: the period chips fit a yearly report, the spend column follows the
// period, and the [n] months is set beside the table's title.
const monthsBox = () => `<label style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600">Not seen for<input type="text" inputmode="numeric" value="[n]" aria-label="Months not seen" style="width: 64px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">months</label>`;
const returning = () => wrap(`${head('Returning customers', 'North Street Cycles, Bolton · the last 12 months', 'Last 12 months', { list: ['Last 12 months', 'Last 24 months', 'Pick dates'] })}
${stats([stat('Customers', '[n]', UP('[n]', 'the 12 months before')), stat('New', '[n]', UP('[n]', 'the 12 months before')), stat('Came back within 12 months', '[n]%', UP('[n] points', 'the 12 months before'))])}
${box(`${graph('New and returning customers by month', MONTHS, { value: '[n]', key: ['Returning', 'New'], says: 'most returning in [month], most new in [month]', stacked: true })}${note('A customer counts when they buy something or a repair is collected — in the shop or online. Sales with no customer on them are not counted.')}${table('New and returning customers by month', ['Month', 'Returning', 'New', 'All'], MONTHS.map((m) => [m, '[n]', '[n]', '[n]']), ['All 12 months', '[n]', '[n]', '[n]'])}`)}
${box(`<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${h3('Not seen lately')}${monthsBox()}</div>${note('Customers who used to come in. “Happy to hear about offers” is what they said yes or no to; Message shows only for a yes.')}${table('Not seen lately', ['Customer', 'Last bought or collected', 'Spent in the last 12 months', 'Happy to hear about offers'], [lapsed(true), lapsed(false), lapsed(true)], null, [0, 3])}`)}`);

// ---------- Workshop (decision 6; audit L2) ----------
const full = (name, booked, avail) => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid ${C.border}"><div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px"><span style="font-weight: 700">${name}</span><span>${avail ? `${mono(booked)} of ${mono(avail)} hours booked · <strong>[n]% full</strong>` : `${mono(booked)} hours booked · no set hours`}</span></div>${avail ? `<div aria-hidden="true" style="height: 10px; border-radius: 999px; border: 1px dashed ${C.input}; background: ${C.mutedBg}"></div>` : ''}</div>`;
const workshop = () => wrap(`${head('Workshop', `North Street Cycles, Bolton · ${SO_FAR}`, 'This week')}
${stats([stat('Jobs booked in', '[n]', UP('[n]')), stat('Finished', '[n]', UP('[n]')), stat('Collected', '[n]', UP('[n]')), stat('Booked in to ready', '[n] days', `Average · ${UP('[n] days')}`)])}
${box(graph('Jobs finished by day', DAY_LABELS, { value: '[n]', upto: 4, says: 'busiest day [day]; [up or down] [n] on the same days last week' }))}
<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : 'repeat(2, minmax(0, 1fr))'}; gap: 14px; align-items: start">
${box(`${h3('Workshop takings')}${table('Workshop takings', ['Money', 'This week so far', 'Same days last week'], [['Labour', '[£]', '[£]'], ['Parts', '[£]', '[£]']], ['Total', '[£]', '[£]'])}${h3('Quotes')}${table('Quotes', ['Quote', 'This week so far', 'Same days last week'], [['Approved', '[n]', '[n]'], ['Declined', '[n]', '[n]'], ['No answer', '[n]', '[n]']])}`)}
${box(`${h3('How full each mechanic was')}${full('Alex Morgan', '[n]', '[n]')}${full('Jo Taylor', '[n]', '[n]')}${full('Shared queue', '[n]', '')}${note('Hours booked in the diary against the hours each mechanic is in, from their working days.')}`)}
</div>`);

// ---------- Discounts and refunds (Selling at the till 4; audit M10) ----------
// Staff with "Can see reports" see every discount and reason, not who gave it.
const discounts = (staff = false) => wrap(`${head('Discounts and refunds', `North Street Cycles, Bolton · ${SO_FAR}`, 'This week')}
${stats([stat('Discounts given', '[n] · £[£]', UP()), stat('Refunds', '[n] · £[£]', UP())])}
${box(`${graph('Discounts and refunds by reason', ['[Club name] members', '[Reason]', '[Reason]'], { says: 'most given [reason]; [up or down] £[£] on the same days last week' })}${staff
  ? table('Discounts and refunds', ['Sale', 'What', 'Reason', 'Amount'], [[mono('B1-[0000]'), 'Discount', '[Club name] members', '−[£]'], [mono('B1-[0000]'), 'Discount', '“[their reason]”', '−[£]'], [mono('B2-[0000]'), 'Refund', '[Reason]', '−[£]']], null, [0, 1, 2])
  : table('Discounts and refunds', ['Sale', 'What', 'Reason', 'By', 'Amount'], [[mono('B1-[0000]'), 'Discount', '[Club name] members', 'Jo Taylor', '−[£]'], [mono('B1-[0000]'), 'Discount', '“[their reason]”', 'Jack Lewis', '−[£]'], [mono('B2-[0000]'), 'Refund', '[Reason]', 'Jo Taylor', '−[£]']], null, [0, 1, 2, 3])}`)}
${staff ? '' : note('Split by reason or by staff member with “Change what’s shown”.')}`, staff ? STAFF : OWNER);

// ---------- Accounts software (decision 4; audit H4, H5, M15) ----------
const dataPage = (extra) => withSite('Bolton', () => settingsPage('data', 'Your data', DATA_INTRO, dataFolds() + extra, { who: OWNER }));
const connectOpen = () => `<div style="display: flex; flex-direction: column; gap: 10px">${note('Each closed day goes across as one summary per shop: sales by account, the VAT, the money taken by how it was paid, and any Cycle to Work payments marked paid that day, with their commission. Only the owner can connect.')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Connect Xero', { variant: 'default' })}${button('Connect QuickBooks', { variant: 'default' })}</div>${note('Not using either? “Download everything” above has the same daily figures to import.')}</div>`;
const mapRow = (from, missing = false) => `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 6px 0; min-height: 52px; box-sizing: border-box; border-top: 1px solid ${C.border}"><label for="m-${esc(from)}" style="flex: 1 1 200px; display: flex; flex-direction: column; gap: 2px; font-size: 15px; font-weight: 600">${from}${missing ? `<span style="font-size: 13px; font-weight: 700; color: ${C.danger}">No Xero account chosen — days with ${from} sales can’t be sent</span>` : ''}</label><select id="m-${esc(from)}" style="min-width: 240px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: ${missing ? 2 : 1}px solid ${missing ? C.danger : C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>${missing ? 'Choose a Xero account' : '[Xero account]'}</option></select></div>`;
const group = (t, rows) => `<h4 style="margin: 12px 0 0; font-size: 14px; font-weight: 700">${t}</h4>${rows}`;
const mapOpen = (missing = false) => `<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">${badge('Connected to Xero', 'green')}<span style="font-size: 13px; color: ${C.muted}">by Jack Lewis on [date]</span><span style="flex-grow: 1"></span>${linkBtn('Disconnect Xero')}</div>
${group('Sales go to', CATS.map((c, i) => mapRow(c, missing && i === 2)).join(''))}
${group('Money taken goes to', ['Cash', 'Card', 'Customer accounts', 'Gift cards', 'Cycle to Work (owed by providers)'].map((p) => mapRow(p)).join(''))}
${group('Everything else goes to', ['Cash differences', 'Refunds', 'Discounts given', 'VAT on sales', 'Cycle to Work commission', 'Cycle to Work shortfalls'].map((p) => mapRow(p)).join(''))}
${note('VAT on sales goes to one Xero account for every rate. Check these choices with your accountant before the first day is sent.')}`;
// UX walk-through 5 H3: "Mark paid" on a Cycle to Work order goes with that
// day's summary, its commission beside it.
const LOG = { sent: ['Sent at [time] · £[£]', badge('Sent', 'green')], sentC2w: ['Sent at [time] · £[£] · with [Provider] paid £[£] · commission £[£]', badge('Sent', 'green')], failed: ['Closed at [time] · [Category] has no Xero account chosen', button('Choose an account for [Category]', { variant: 'default' })], waiting: ['Waiting for Till B3 to close', badge('Waiting', 'grey')], open: ['Not closed yet', badge('Not closed yet', 'grey')], held: ['Closed at [time] · sends when Xero is reconnected', badge('Waiting', 'grey')] };
const logRow = (day, shop, s) => `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 6px 0; min-height: 52px; box-sizing: border-box; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 240px"><span style="font-size: 15px; font-weight: 600">${day} · ${shop}</span><span style="font-size: 13px; color: ${s === 'failed' ? C.warnInk : C.muted}">${LOG[s][0]}</span></span>${LOG[s][1]}</div>`;
const logOpen = () => `${logRow('Thu 17 Sep', 'Bolton', 'open')}${logRow('Wed 16 Sep', 'Bolton', 'failed')}${logRow('Wed 16 Sep', SECOND, 'waiting')}${logRow('Tue 15 Sep', 'Bolton', 'sentC2w')}${logRow('Tue 15 Sep', SECOND, 'sent')}${note('Each day goes once all that shop’s tills are closed. A day that’s reopened is corrected when it closes again.')}`;
const lostOpen = () => `${bar('<strong>Xero disconnected on [date].</strong> Nothing has been sent since. Reconnect and the waiting days go across.', button('Reconnect Xero', { variant: 'default' }))}${logRow('Wed 16 Sep', 'Bolton', 'held')}${logRow('Tue 15 Sep', 'Bolton', 'sent')}`;
const accountsBoard = (open, summary) => dataPage(fold('Accounts software', summary, open));
const disconnectDialog = () => popup('dc-title', 'Disconnect Xero?', 'North Street Cycles, every shop', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Days already sent stay in Xero. Nothing more is sent until you connect again — the daily figures are still in “Download everything”.</p>${note('Your account choices are kept in case you reconnect.')}`, `${button('Keep connected', { variant: 'ghost' })}${button('Disconnect', { variant: 'danger' })}`, 520);

// ---------- Cycle to Work: owed and paid (UX walk-through 5 H3, option 1) ----------
// Opens on a period, by provider: bikes, owed, paid, commission, late. Owners
// and anyone with "Can see costs and margin" (commission is a cost). What's
// owed right now stays on Cycle to Work's own Owed page (cw-owed).
const C2W_COLS = ['Provider', 'Bikes collected', 'Owed now', 'Paid', 'Commission', 'Late'];
const c2wRow = () => ['[Provider]', '[n]', '[£]', '[£]', '[£]', '[n]'];
const c2wReport = () => wrap(`${head('Cycle to Work: owed and paid', 'North Street Cycles, Bolton · 1 – 17 September, against the same days in August', 'This month')}
${stats([stat('Owed now', '£[£]', '[n] bikes · [n] late'), stat('Paid', '£[£]', UP('£[£]', 'the same days in August')), stat('Commission', '£[£]', UP('£[£]', 'the same days in August')), stat('Shortfalls closed', '£[£]', '[n] orders closed with a reason')])}
${box(`${graph('Paid by provider', ['[Provider]', '[Provider]'], { key: ['Paid this month so far', 'Same days in August'], says: 'most paid by [Provider]; [up or down] £[£] on the same days in August' })}${table('Cycle to Work by provider', C2W_COLS, [c2wRow(), c2wRow()], ['All providers', '[n]', '[£]', '[£]', '[£]', '[n]'])}`)}
<p style="margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 14px; line-height: 1.45"><span>Each bike, and what’s owed on it right now, is on Cycle to Work’s Owed page.</span>${linkBtn('See what’s owed now', 'See what Cycle to Work providers owe now')}</p>
${note('Paid and commission are counted on the day each order is marked paid. They go to Xero with that day’s summary.')}`);

// ---------- Who sees what (decision 5; audit M14, L6) ----------
const HINTS = { 'Can see reports': 'Sales, takings, workshop, and discounts without who gave them', 'Can see costs and margin': 'Adds margin, stock value, cost columns and VAT. Turns on “Can see reports” too.' };
// UX walk-through 3 (decision 6 leftover): a manager's view, as on set-staff —
// signed in as [Manager], with Jack Lewis listed as the Owner.
const personBoard = () => overlay(managerStaffPage({ people: peopleOpen(false, false, MGR) }), personDialog({ costs: true, on: ['Can see reports'], hints: HINTS }));

// ---------- The boards ----------
def('rp-home', () => home());
def('rp-home-staff', () => home(true));
def('rp-report-menu', () => scrolled(homeShared(), onPhone(560)));
def('rp-report-deleted', () => deletedBar());
def('rp-your-settings', () => settingsGraphs());
def('rp-sales', () => sales());
def('rp-sales-all', () => sales('All shops'));
def('rp-sales-year', () => salesYear());
def('rp-sales-empty', () => salesEmpty());
def('rp-pick-dates', () => overlay(sales(), pickDates()));
def('rp-change', () => overlay(sales(), changePanel()));
def('rp-changed', () => changed());
def('rp-save', () => overlay(changed(), saveDialog()));
def('rp-save-taken', () => overlay(changed(), saveDialog(true)));
def('rp-takings', () => takings());
def('rp-takings-all', () => takings({ site: 'All shops' }));
def('rp-day', () => overlay(takings(), dayReport()));
def('rp-reopen', () => overlay(takings(), reopenDialog()));
def('rp-takings-reopened', () => takings({ reopened: true }));
def('rp-vat', () => vat());
def('rp-vat-first', () => vatFirst());
def('rp-vat-all', () => vat('All shops'));
def('rp-vat-check-off', () => vat('Bolton', { checkOff: true })); // UX walk-through 3 M8
def('rp-margin', () => margin());
def('rp-workshop', () => workshop());
def('rp-returning', () => returning());
def('rp-discounts', () => discounts());
def('rp-discounts-staff', () => discounts(true));
def('rp-accounts-connect', () => accountsBoard(connectOpen(), 'Not connected'));
def('rp-accounts-map', () => accountsBoard(mapOpen(), 'Connected to Xero'));
def('rp-accounts-missing', () => scrolled(accountsBoard(mapOpen(true), 'Connected to Xero · 1 account to choose'), onPhone(300)));
def('rp-accounts-log', () => accountsBoard(logOpen(), 'Connected to Xero · 1 day needs a look'));
def('rp-accounts-lost', () => accountsBoard(lostOpen(), 'Xero disconnected'));
def('rp-accounts-disconnect', () => overlay(accountsBoard(mapOpen(), 'Connected to Xero'), disconnectDialog()));
def('rp-today-accounts', () => today({ accounts: true, as: OWNER }));
def('rp-person', () => personBoard());
def('rp-c2w', () => c2wReport()); // UX walk-through 5 H3
// UX walk-through 5 H3: the Xero choices scrolled down to the Cycle to Work rows.
def('rp-accounts-c2w', () => scrolled(accountsBoard(mapOpen(), 'Connected to Xero'), { desktop: 800, tablet: 800, phone: 1060 }[SIZE]));

// Desktop, tablet and phone (tablet and phone drawn after the UI audit).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'rp-returning': 'Returning customers: who comes back, who hasn’t lately',
  'rp-home': 'Reports: the ready-made reports, and your own',
  'rp-home-staff': 'Reports for Staff with “Can see reports” (one shop, no costs)',
  'rp-report-menu': 'A saved report’s menu: rename, share, delete',
  'rp-report-deleted': 'A saved report deleted, with Undo',
  'rp-your-settings': 'Your settings › Accessibility (scrolled down): show graphs in reports',
  'rp-sales': 'Sales: this week so far, against the same days last week',
  'rp-sales-all': 'Sales for all shops: shop by shop',
  'rp-sales-year': 'Sales over 12 months: a line, against the year before',
  'rp-sales-empty': 'Nothing sold yet, and nothing to compare with',
  'rp-pick-dates': 'Pick dates',
  'rp-change': 'Change what’s shown: choices that don’t fit are greyed, with why',
  'rp-changed': 'The changed report, with Save as my report',
  'rp-save': 'Save as my report: Just me to start',
  'rp-save-taken': 'A name you’ve already used',
  'rp-takings': 'Takings and cash-ups: each closed day opens from its row',
  'rp-takings-all': 'Takings and cash-ups for all shops',
  'rp-day': 'A closed day’s end-of-day report',
  'rp-reopen': 'Reopen a closed day: a reason first',
  'rp-takings-reopened': 'A reopened day, left out and said so',
  'rp-vat': 'VAT for your VAT quarter, against the quarter before',
  'rp-vat-first': 'When does your VAT quarter start? (asked once)',
  'rp-vat-all': 'VAT for all shops',
  'rp-vat-check-off': 'VAT with the invoice check off: stock purchases from your accounts software',
  'rp-margin': 'Margin and stock value',
  'rp-workshop': 'Workshop: jobs, takings, how full, turnaround, quotes',
  'rp-discounts': 'Discounts and refunds, with reasons and who gave them',
  'rp-discounts-staff': 'Discounts and refunds as Staff see them (without who)',
  'rp-accounts-connect': 'Settings › Your data › Accounts software: connect',
  'rp-accounts-map': 'Which Xero account each line goes to',
  'rp-accounts-missing': 'A category with no Xero account',
  'rp-accounts-log': 'What was sent: sent, not sent, waiting, not closed yet',
  'rp-accounts-lost': 'Xero disconnected: days wait to be sent',
  'rp-accounts-disconnect': 'Disconnect Xero',
  'rp-today-accounts': 'Today: Wednesday didn’t go to Xero',
  'rp-person': 'A person: “Can see reports” on, “Can see costs and margin” off',
  'rp-c2w': 'Cycle to Work: owed and paid, by provider, with the commission', // UX walk-through 5 H3
  'rp-accounts-c2w': 'Xero choices (scrolled down): Cycle to Work, its commission and shortfalls', // UX walk-through 5 H3
};
export const ROWS = [
  { label: 'Reports', screens: ['rp-home', 'rp-home-staff', 'rp-report-menu', 'rp-report-deleted', 'rp-your-settings'] },
  { label: 'Sales', screens: ['rp-sales', 'rp-sales-all', 'rp-sales-year', 'rp-sales-empty', 'rp-pick-dates'] },
  { label: 'Your own reports', screens: ['rp-change', 'rp-changed', 'rp-save', 'rp-save-taken'] },
  { label: 'Takings and cash-ups', screens: ['rp-takings', 'rp-takings-all', 'rp-day', 'rp-reopen', 'rp-takings-reopened'] },
  { label: 'VAT, margin, workshop and discounts', screens: ['rp-vat', 'rp-vat-first', 'rp-vat-all', 'rp-vat-check-off', 'rp-margin', 'rp-workshop', 'rp-discounts', 'rp-discounts-staff', 'rp-returning', 'rp-c2w'] }, // UX walk-through 5 H3: rp-c2w
  { label: 'Accounts software and who sees what', screens: ['rp-accounts-connect', 'rp-accounts-map', 'rp-accounts-c2w', 'rp-accounts-missing', 'rp-accounts-log', 'rp-accounts-lost', 'rp-accounts-disconnect', 'rp-today-accounts', 'rp-person'] },
];
