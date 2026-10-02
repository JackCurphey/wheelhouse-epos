// Journey 20 — Management oversight, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-management-oversight-review.md
//
// Decision 1: one activity log for owners and managers — everything already
// recorded, filtered by person, kind, shop and date. 2: a few things reach
// Today's Needs attention above amounts the shop sets, cleared with "Seen".
// 3: one "Signed-in devices" list in Settings › Office, and "Sign out
// everywhere" on each person. 4: "Send feedback" in Your settings, for
// everyone, the screenshot unticked to start. 5: the log opens from
// Reports, beside the ready-made reports.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner), Jo Taylor (Staff), Alex Morgan (Mechanic), Till B1,
// Shimano brake pads B05S-RX (£28.00), WH-1045 Jamie Brooks (Giant Escape 2,
// gear adjustment), Thursday 17 September. Times, amounts, sale numbers,
// reasons and devices are bracketed placeholders.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, staffFolds, STAFF_INTRO, rowSwitch } from './settings-frame.mjs';
import { withSite } from './diary.mjs';
import { today } from './opening.mjs';
import { personDialog, staffPage, peopleOpen } from './setup.mjs';
import { yourSettingsDialog } from './app-map.mjs';
import { screens as reportScreens } from './reports.mjs';
import { screens as diaryScreens } from './diary.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
const tall = 'display: inline-flex; align-items: center; min-height: 44px';
const isP = () => SIZE === 'phone';

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: ${isP() ? 22 : 26}px; font-weight: 700">${t}</h2>`;
const h3 = (t, id = '') => `<h3${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 16px; font-weight: 700">${t}</h3>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isP() ? 14 : 18}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'reports', 18)}<span>${t}</span></p>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const toast = (t, action = '') => `<div role="status" style="position: absolute; ${isP() ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%); white-space: nowrap'}; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="flex-grow: 1; padding: 8px 0">${t}</span>${action ? `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">${action}</button>` : ''}</div>`;
const withToast = (html, t) => html.replace('<main style="', '<main style="position: relative; ').replace('</main>', `${t}</main>`);

// ---------- The activity log: Reports › Activity (decisions 1, 5) ----------
const reportsPage = (content, site = 'Bolton') => withSite(site, () => page('reports', 'Reports', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${content}</div>`, OWNER));
const select = (label, value) => `<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0"><label style="font-size: 13px; font-weight: 600">${label}</label><button type="button" aria-haspopup="listbox" aria-label="${esc(label)}: ${esc(value.replace(/<[^>]+>/g, ''))}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; white-space: nowrap">${value}${icon('chevron', 14)}</button></div>`;
const chip = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid ${C.ink}; background: ${on ? C.ink : 'transparent'}; color: ${on ? '#ffffff' : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${on ? icon('check', 14) : ''}${t}</button>`;
const PERIODS = ['Today', 'This week', 'This month', 'Pick dates'];
const filters = ({ person = 'Everyone', kind = 'Everything', period = 'Today' } = {}) => `<div style="display: grid; grid-template-columns: ${isP() ? '1fr 1fr' : '220px 220px minmax(0, 1fr)'}; gap: 10px; align-items: end">${select('Person', person)}${select('Kind', kind)}${isP() ? '' : `<div style="display: flex; flex-direction: column; gap: 4px"><label for="log-q" style="font-size: 13px; font-weight: 600">Search the log</label><input id="log-q" type="search" placeholder="A product, job, sale or customer" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>`}</div>
<div role="radiogroup" aria-label="Period" style="display: flex; flex-wrap: wrap; gap: 6px">${PERIODS.map((p) => chip(p, p === period)).join('')}</div>`;
const KINDS = { price: ['Price changed', 'reports'], void: ['Sale voided', 'close'], refund: ['Refund', 'cash'], discount: ['Discount', 'card'], job: ['Job changed', 'workshop'], stock: ['Stock adjusted', 'stock'], setting: ['Setting changed', 'settings'], day: ['Day reopened', 'till'], website: ['Website published', 'website'] };
const entry = (time, who, kind, what, detail, open, { shop = '', flag = false } = {}) => {
  const [kindName, ic] = KINDS[kind];
  return `<li style="list-style: none; display: grid; grid-template-columns: ${isP() ? '1fr auto' : '64px 150px minmax(0, 1fr) auto'}; gap: ${isP() ? '4px 10px' : '14px'}; align-items: center; min-height: 60px; padding: 8px 0; border-top: 1px solid ${C.border}">
${isP() ? '' : mono(time, 'font-size: 14px')}${isP() ? '' : `<span style="font-size: 15px; font-weight: 700">${who}</span>`}
<span style="display: flex; flex-direction: column; gap: 3px; min-width: 0">${isP() ? `<span style="font-size: 13px; color: ${C.muted}">${mono(time)} · <strong style="color: ${C.ink}">${who}</strong></span>` : ''}<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 15px"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600">${icon(ic, 16)}${kindName}</span><span>${what}</span>${flag ? badge('On Today', 'amber') : ''}${shop ? badge(shop, 'grey') : ''}</span><span style="font-size: 13px; color: ${C.muted}; line-height: 1.4">${detail}</span></span>
${link('Open', `Open ${open}`)}</li>`;
};
const TODAY_ENTRIES = (shops = false) => [
  entry('[time]', 'Jo Taylor', 'discount', '£[£] off Sale [sale number]', '“[reason]” · Till B1', 'the sale', { flag: true }),
  entry('[time]', 'Jack Lewis', 'price', `Shimano brake pads ${mono('B05S-RX')}`, '£28.00 → £[£] · now below cost (£[£])', 'the product', { flag: true }),
  entry('[time]', 'Alex Morgan', 'job', 'WH-1045 · Jamie Brooks', 'Giant Escape 2 · gear adjustment · status: In progress → Waiting for a part', 'the job', shops ? { shop: 'Bolton' } : {}),
  entry('[time]', 'Jo Taylor', 'void', 'Sale [sale number] · £[£]', '“[reason]” · Till B1 · [n]th void today', 'the sale', { flag: true }),
  entry('[time]', 'Jo Taylor', 'refund', '£[£] to card · from Sale [sale number]', '“[reason]” · Till B1', 'the refund'),
  entry('[time]', 'Jack Lewis', 'stock', '[Product] · −[n]', '“[reason]” · stock take', 'the product', shops ? { shop: '[Second site]' } : {}),
  entry('[time]', 'Jack Lewis', 'setting', 'Float, Till B1', '£[£] → £[£] · Settings › Front desk › End of day', 'the setting'),
  entry('[time]', 'Jack Lewis', 'website', 'Home page and Theme', '4 changes published', 'the website history'),
];
const dayGroup = (label, items) => `<section aria-label="${esc(label)}" style="display: flex; flex-direction: column"><h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: ${C.muted}">${label}</h3><ul style="margin: 0; padding: 0">${items.join('')}</ul></section>`;
const logPage = ({ site = 'Bolton', filtered = false, empty = false } = {}) => {
  const shops = site === 'All shops';
  const sub = `${shops ? 'All shops' : `North Street Cycles, ${site}`} · everything staff did, newest first · owners and managers only`;
  const head = `${back('All reports')}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Activity')}${note(sub)}</div>${button(isP() ? 'Download' : 'Download as spreadsheet', { variant: 'default' })}</div>`;
  if (empty) return reportsPage(`${head}${filters({ person: 'Alex Morgan', kind: 'Refund', period: 'Today' })}${box(`<p role="status" style="margin: 0; font-size: 15px">Nothing matches: Alex Morgan made no refunds today.</p><div>${button('Clear the filters', { variant: 'default' })}</div>`)}`, site);
  if (filtered) return reportsPage(`${head}${msg('From Today: <strong>voids by Jo Taylor, today</strong>. <a href="#" style="color: inherit; font-weight: 700">Show everything</a>', 'grey')}${filters({ person: 'Jo Taylor', kind: 'Sale voided', period: 'Today' })}${box(dayGroup('Thursday 17 September · [n] voids', [1, 2, 3].map(() => entry('[time]', 'Jo Taylor', 'void', 'Sale [sale number] · £[£]', '“[reason]” · Till B1', 'the sale'))))}`, site);
  return reportsPage(`${head}${filters()}${box(`${dayGroup('Thursday 17 September', TODAY_ENTRIES(shops))}`)}`, site);
};

// ---------- Alerts on Today (decision 2) ----------
const alertsOpen = () => `${note('These come to Needs attention on Today, for owners and managers, and clear with “Seen”. Nothing stops a sale.')}
${[['A discount or refund over', '£[amount]'], ['Voids by one person in a day, more than', '[n]'], ['A price changed to below what it cost', '']].map(([t, v]) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="flex: 1 1 240px; font-size: 15px; font-weight: 600">${t}</span>${v ? `<input aria-label="${esc(t)}" value="${v}" style="width: 110px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}">` : ''}<span style="width: 150px">${rowSwitch(`<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">${esc(t)}</span>`, true)}</span></div>`).join('')}`;

// ---------- Signed-in devices (decision 3) ----------
const devRow = (device, who, where, when, btn = true) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 60px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 220px; min-width: 0"><span style="font-size: 15px; font-weight: 700">${device}</span><span style="font-size: 13px; color: ${C.muted}">${who} · ${where} · ${when}</span></span>${btn ? button('Sign out', { variant: 'default' }) : ''}</div>`;
const devicesOpen = () => `${note('Tills are added by the owner, in Settings › Front desk › Till. Signing a till out ends whoever is checked in there; it stays a till.')}
<h4 style="margin: 4px 0 0; font-size: 14px; font-weight: 700">Tills</h4>
${devRow('Till B1', 'Jo Taylor checked in', 'Bolton', 'in use now')}${devRow('[Till]', 'Nobody checked in', '[Second site]', 'last used [date]', false)}
<h4 style="margin: 8px 0 0; font-size: 14px; font-weight: 700">Phones and computers</h4>
${devRow('[Phone · browser]', 'Jack Lewis (you)', 'signed in with email', 'used just now', false)}${devRow('[Computer · browser]', 'Jack Lewis', 'signed in with email', 'last used [date]')}${devRow('[Phone · browser]', 'Jo Taylor', 'signed in with email', 'last used [date]')}`;
const officeStaff = (open) => settingsPage('staff', 'Staff and roles', STAFF_INTRO, staffFolds(open), { who: OWNER });
const signOutAsk = () => popup('so-title', 'Sign out [Computer · browser]?', 'Jack Lewis · last used [date]', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Anyone using it will need to sign in again with their email. Nothing else changes.</p>`, `${button('Cancel', { variant: 'ghost' })}${button('Sign out')}`, 480);
const everywhereAsk = () => popup('se-title', 'Sign Jo Taylor out everywhere?', 'Till B1 now · [n] phone or computer', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Jo is checked out of Till B1 and signed out of every phone and computer. Their sales and jobs stay as they are; they can sign in again with their email and PIN.</p>`, `${button('Cancel', { variant: 'ghost' })}${button('Sign out everywhere')}`, 500);

// ---------- Send feedback (decision 4) ----------
const behind = () => diaryScreens.diary[SIZE] || diaryScreens.diary.desktop;
const feedback = ({ shot = false } = {}) => popup('fb-title', 'Send feedback', 'To the Wheelhouse team', `<div style="display: flex; flex-direction: column; gap: 6px"><label for="fb-text" style="font-size: 14px; font-weight: 600">What happened, or what’s missing?</label><textarea id="fb-text" rows="${isP() ? 6 : 4}" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}; resize: vertical">[What Jo wrote]</textarea></div>
<p style="margin: 0; display: flex; gap: 8px; font-size: 14px; color: ${C.muted}">${icon('website', 16)}<span>We’ll see you were on <strong style="color: ${C.ink}">Diary</strong>, and that you’re Jo Taylor at North Street Cycles.</span></p>
<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox"${shot ? ' checked' : ''} style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Add a picture of the screen</span><span style="font-size: 13px; color: ${C.muted}">You’ll see it first, so you can check it doesn’t show anything private.</span></span></label>
${shot ? `<div style="display: flex; flex-direction: column; gap: 6px"><div role="img" aria-label="Picture of the Diary screen" style="height: ${isP() ? 160 : 150}px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.muted}; font-size: 14px">[Picture of the Diary screen]</div>${msg('It shows customer names and bikes. Leave it out if they don’t need to be in it.', 'warn')}</div>` : ''}`, `${button('Cancel', { variant: 'ghost' })}${button('Send')}`, 560);
const sentToast = () => toast('Thanks — we’ve got it. Any reply comes to your email.');

// ---------- The boards ----------
const [DW] = [1280];
def('ops-reports-home', () => reportScreens['rp-home'][SIZE]);
def('ops-log', () => logPage());
def('ops-log-all', () => logPage({ site: 'All shops' }));
def('ops-log-filtered', () => logPage({ filtered: true }));
def('ops-log-empty', () => logPage({ empty: true }));
def('ops-today-alerts', () => today({ watch: true }));
def('ops-alert-settings', () => officeStaff({ alerts: alertsOpen() }));
def('ops-devices', () => officeStaff({ devices: devicesOpen() }));
def('ops-devices-signout', () => overlay(officeStaff({ devices: devicesOpen() }), signOutAsk()));
def('ops-devices-signed-out', () => withToast(officeStaff({ devices: devicesOpen().replace(/(\[Computer · browser\][\s\S]*?)<button[^>]*>Sign out<\/button>/, '$1') }), toast('Signed out [Computer · browser]')));
def('ops-person', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog()));
def('ops-person-everywhere', () => overlay(staffPage({ people: peopleOpen(false) }), everywhereAsk()));
def('ops-your-settings', () => (isP() ? yourSettingsDialog('phone') : overlay(behind(), yourSettingsDialog(SIZE))));
def('ops-feedback', () => overlay(behind(), feedback()));
def('ops-feedback-shot', () => overlay(behind(), feedback({ shot: true })));
def('ops-feedback-sent', () => `<div style="position: relative; width: ${DIMS[SIZE][0]}px; height: ${DIMS[SIZE][1]}px; overflow: hidden">${behind()}${sentToast()}</div>`);

const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ops-reports-home': 'Reports: “Activity” beside the ready-made reports',
  'ops-log': 'Reports › Activity: everything staff did today',
  'ops-log-all': 'Activity across all shops',
  'ops-log-filtered': 'Opened from a Today alert: voids by Jo Taylor',
  'ops-log-empty': 'Nothing matches the filters',
  'ops-today-alerts': 'Today: a big discount, many voids, a price below cost',
  'ops-alert-settings': 'Settings › Office › Alerts on Today: the amounts',
  'ops-devices': 'Settings › Office › Signed-in devices',
  'ops-devices-signout': 'Sign a computer out',
  'ops-devices-signed-out': 'Signed out',
  'ops-person': 'A person: “Sign out everywhere”',
  'ops-person-everywhere': 'Sign Jo Taylor out everywhere?',
  'ops-your-settings': 'Your settings: “Send feedback”, for everyone',
  'ops-feedback': 'Send feedback: what happened, and which screen',
  'ops-feedback-shot': 'With a picture of the screen, seen first',
  'ops-feedback-sent': 'Thanks — we’ve got it',
};
export const ROWS = [
  { label: 'The activity log', screens: ['ops-reports-home', 'ops-log', 'ops-log-all', 'ops-log-filtered', 'ops-log-empty'] },
  { label: 'Alerts on Today', screens: ['ops-today-alerts', 'ops-alert-settings'] },
  { label: 'Signed-in devices', screens: ['ops-devices', 'ops-devices-signout', 'ops-devices-signed-out', 'ops-person', 'ops-person-everywhere'] },
  { label: 'Send feedback', screens: ['ops-your-settings', 'ops-feedback', 'ops-feedback-shot', 'ops-feedback-sent'] },
];
