// Journey 20 — Management oversight, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-management-oversight-review.md
// UI audit: docs/design/user-journeys/oversight-ui-audit.md (decision 6: every
// recommendation taken)
//
// Decision 1: one activity log for owners and managers — everything already
// recorded, filtered by person, type of action, shop and date. 2: a few
// things reach Today's Needs attention above amounts the shop sets, cleared
// with "Seen". 3: one "Signed-in devices" list in Settings › Office, and
// "Sign out everywhere" on each person. 4: "Send feedback" in Your
// settings, for everyone, the picture of the screen unticked to start.
// 5: the log opens from Reports, beside the ready-made reports. 6: the UI
// audit, every recommendation.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner; Manager on the manager's boards, as in other journeys),
// Jo Taylor (Staff), Alex Morgan (Mechanic), Till B1, Shimano brake pads
// B05S-RX (£28.00), WH-1045 Jamie Brooks (Giant Escape 2, gear
// adjustment), Thursday 17 September. Times, amounts, sale numbers, reasons,
// devices and the keeping period are bracketed placeholders.
import { C, MONO, esc, icon, button, card, badge } from './ui.mjs';
import { page, note, popup, overlay, withSize, settingsPage, staffFolds, STAFF_INTRO, rowSwitch, MANAGER } from './settings-frame.mjs';
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
const KEPT = 'Kept for [period], then removed. A customer’s name is taken out when their account is deleted.';
const TILL_NOTE = 'At a till, the name is whoever’s PIN was last typed there.';

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: ${isP() ? 22 : 26}px; font-weight: 700">${t}</h2>`;
const box = (inner, extra = '') => card(`<div style="padding: ${isP() ? 14 : 18}px; display: flex; flex-direction: column; gap: 12px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'reports', 18)}<span>${t}</span></p>`;
// Audit M9: 44px targets, padded.
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; justify-content: center; min-width: 44px; padding: 0 6px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const toast = (t, action = '') => `<div role="status" style="position: absolute; ${isP() ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%); white-space: nowrap'}; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="flex-grow: 1; padding: 8px 0">${t}</span>${action ? `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">${action}</button>` : ''}</div>`;
const withToast = (html, t) => html.replace('<main style="', '<main style="position: relative; ').replace('</main>', `${t}</main>`);

// ---------- The activity log: Reports › Activity log (decisions 1, 5; audit H1, H3, M1, M2, M4, M7, L1–L3, L5) ----------
const reportsPage = (content, site = 'Bolton', who = OWNER) => withSite(site, () => page('reports', 'Reports', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${content}</div>`, who));
const select = (label, value) => `<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0"><label style="font-size: 13px; font-weight: 600">${label}</label><button type="button" aria-haspopup="listbox" aria-label="${esc(label)}: ${esc(value.replace(/<[^>]+>/g, ''))}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; white-space: nowrap">${value}${icon('chevron', 14)}</button></div>`;
const chip = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid ${C.ink}; background: ${on ? C.ink : 'transparent'}; color: ${on ? '#ffffff' : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${on ? icon('check', 14) : ''}${t}</button>`;
const PERIODS = ['Today', 'This week', 'This month', 'Pick dates'];
const filters = ({ person = 'Everyone', kind = 'Everything', period = 'Today', shops = false } = {}) => `<div style="display: grid; grid-template-columns: ${isP() ? '1fr 1fr' : shops ? '190px 190px 190px minmax(0, 1fr)' : '220px 220px minmax(0, 1fr)'}; gap: 10px; align-items: end">${select('Person', person)}${select('Type of action', kind)}${shops ? select('Shop', 'All shops') : ''}${isP() ? '' : `<div style="display: flex; flex-direction: column; gap: 4px"><label for="log-q" style="font-size: 13px; font-weight: 600">Search the log</label><input id="log-q" type="search" placeholder="A product, job, sale or customer" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>`}</div>
<div role="radiogroup" aria-label="Period" style="display: flex; flex-wrap: wrap; gap: 6px">${PERIODS.map((p) => chip(p, p === period)).join('')}</div>`;
const KINDS = { price: ['Price changed', 'reports'], void: ['Sale voided', 'close'], refund: ['Refund', 'cash'], discount: ['Discount', 'card'], job: ['Job changed', 'workshop'], stock: ['Stock adjusted', 'stock'], setting: ['Setting changed', 'settings'], day: ['Day reopened', 'till'], website: ['Website published', 'website'], signout: ['Signed out', 'lock'], download: ['Log downloaded', 'reports'] };
// A name in the log filters the log to that person (audit L2).
const personLink = (who) => `<a href="#" aria-label="Show only ${esc(who)}" style="${tall}; font-size: 15px; font-weight: 700; color: ${C.ink}; text-decoration: none; border-bottom: 1px dotted ${C.muted}">${who}</a>`;
const entry = (time, who, kind, what, detail, open, { shop = '', flag = '', mine = false } = {}) => {
  const [kindName, ic] = KINDS[kind];
  const name = mine ? `<span style="font-size: 15px; font-weight: 700">${who}</span>` : personLink(who);
  const flagHtml = flag === 'today' ? badge('On Today', 'amber') : flag ? badge(flag, 'green') : '';
  return `<li style="list-style: none; display: grid; grid-template-columns: ${isP() ? '1fr auto' : '64px 150px minmax(0, 1fr) auto'}; gap: ${isP() ? '4px 10px' : '14px'}; align-items: center; min-height: 60px; padding: 8px 0; border-top: 1px solid ${C.border}">
${isP() ? '' : mono(time, 'font-size: 14px')}${isP() ? '' : name}
<span style="display: flex; flex-direction: column; gap: 3px; min-width: 0">${isP() ? `<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: ${C.muted}">${mono(time)} · ${name}</span>` : ''}<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 15px"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600">${icon(ic, 16)}${kindName}</span><span>${what}</span>${flagHtml}${shop ? badge(shop, 'grey') : ''}</span><span style="font-size: 14px; color: ${C.ink}; line-height: 1.4">${detail}</span></span>
${open ? link('Open', `Open ${open}`) : '<span></span>'}</li>`;
};
const TODAY_ENTRIES = (shops = false) => {
  const s = (x) => (shops ? { shop: x } : {});
  return [
    entry('[time]', 'Jo Taylor', 'discount', '£[£] off Sale [sale number]', '“[reason]” · Till B1, while Jo Taylor was checked in', 'Sale [sale number]', { ...s('Bolton'), flag: 'Seen by Jack Lewis at [time]' }),
    entry('[time]', 'Jack Lewis', 'price', `Shimano brake pads ${mono('B05S-RX')}`, '£28.00 → £[£] · now below cost (£[£])', 'Shimano brake pads B05S-RX', { ...s('Bolton'), flag: 'today' }),
    entry('[time]', 'Alex Morgan', 'job', 'WH-1045 · Jamie Brooks', 'Giant Escape 2 · gear adjustment · In progress → Waiting for a part', 'job WH-1045', s('Bolton')),
    entry('[time]', 'Jo Taylor', 'void', 'Sale [sale number] · £[£]', '“[reason]” · Till B1, while Jo Taylor was checked in · [n]th void today', 'the voided sale', { ...s('Bolton'), flag: 'today' }),
    entry('[time]', 'Jo Taylor', 'refund', '£[£] to card · from Sale [sale number]', '“[reason]” · Till B1, while Jo Taylor was checked in', 'the refund', s('Bolton')),
    entry('[time]', 'Jack Lewis', 'stock', '[Product] · −[n]', '“[reason]” · stock take', '[Product]', s('[Second site]')),
    entry('[time]', 'Jack Lewis', 'signout', '[Computer] · [browser]', 'Signed out from Signed-in devices', '', s('Bolton')),
    entry('[time]', 'Jack Lewis', 'setting', 'Float, Till B1', '£[£] → £[£] · Settings › Front desk › End of day', 'the float setting', s('Bolton')),
    entry('[time]', 'Jack Lewis', 'website', 'Home page and Theme', '4 changes published', 'the website’s history', s('All shops')),
  ];
};
const dayGroup = (label, items) => `<section aria-label="${esc(label)}" style="display: flex; flex-direction: column"><h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: ${C.muted}">${label}</h3><ul style="margin: 0; padding: 0">${items.join('')}</ul></section>`;
const logHead = (sub, backTo = 'All reports') => `${back(backTo)}<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Activity log')}${note(sub)}</div>${button(isP() ? 'Download' : 'Download as spreadsheet', { variant: 'default' })}</div>${note(`${TILL_NOTE} ${KEPT}`)}`;
const logPage = ({ site = 'Bolton', filtered = false, empty = false, who = OWNER } = {}) => {
  const shops = site === 'All shops';
  const manager = who !== OWNER;
  const sub = `${shops ? 'All shops' : `North Street Cycles, ${site}`} · what was done, when and by whom, newest first · ${manager ? 'managers and the owner see everyone’s lines' : 'owners and managers only'}`;
  if (empty) return reportsPage(`${logHead(sub)}${filters({ person: 'Alex Morgan', kind: 'Refund', period: 'Today' })}${box(`<p role="status" style="margin: 0; font-size: 15px">Nothing matches: Alex Morgan made no refunds today.</p><div>${button('Clear the filters', { variant: 'default' })}</div>`)}`, site, who);
  if (filtered) return reportsPage(`${logHead(sub, 'Back to Today')}${msg('From Today: <strong>voids on Till B1, while Jo Taylor was checked in, today</strong>. <a href="#" style="display: inline-flex; align-items: center; min-height: 44px; color: inherit; font-weight: 700">Show everything</a>', 'grey')}${filters({ person: 'Jo Taylor', kind: 'Sale voided', period: 'Today' })}${box(dayGroup('Thursday 17 September · [n] voids', [1, 2, 3].map((i) => entry('[time]', 'Jo Taylor', 'void', 'Sale [sale number] · £[£]', '“[reason]” · Till B1, while Jo Taylor was checked in', `voided sale ${i}`))))}`, site, who);
  return reportsPage(`${logHead(sub)}${filters({ shops })}${box(`${dayGroup('Thursday 17 September', TODAY_ENTRIES(shops))}`)}`, site, who);
};
// Staff who follow a link to the log (audit M2).
const logRefused = () => page('', 'Activity log', `<div style="max-width: 640px; display: flex; flex-direction: column; gap: 14px; padding-top: 8px">${box(`<span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${C.mutedBg}">${icon('lock', 22)}</span>${h2('Only owners and managers see the activity log')}<p style="margin: 0; font-size: 15px; line-height: 1.5">You can see your own activity in Your settings.</p><div style="display: flex; flex-wrap: wrap; gap: 10px">${button('See my own activity', { variant: 'default' })}${button('Back to Today', { variant: 'ghost' })}</div>`)}</div>`, STAFF);
// A person's own lines, from Your settings (audit H2).
const myActivity = () => page('', 'Your activity', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${back('Your settings')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Your activity')}${note('What Wheelhouse has recorded with your name. Owners and managers can see it too.')}</div>${note(`${TILL_NOTE} ${KEPT}`)}
<div role="radiogroup" aria-label="Period" style="display: flex; flex-wrap: wrap; gap: 6px">${PERIODS.map((p) => chip(p, p === 'Today')).join('')}</div>
${box(dayGroup('Thursday 17 September', [
    entry('[time]', 'Jo Taylor', 'discount', '£[£] off Sale [sale number]', '“[reason]” · Till B1', '', { mine: true }),
    entry('[time]', 'Jo Taylor', 'void', 'Sale [sale number] · £[£]', '“[reason]” · Till B1', '', { mine: true }),
    entry('[time]', 'Jo Taylor', 'refund', '£[£] to card · from Sale [sale number]', '“[reason]” · Till B1', '', { mine: true }),
  ]))}</div>`, STAFF);
// The first time someone signs in (audit H2).
const firstNote = () => overlay(diaryScreens.diary[SIZE], popup('fn-title', 'Before you start', 'Jo Taylor · North Street Cycles', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Wheelhouse keeps a record of sales, discounts, refunds, voids, and price and job changes, with the name of whoever was checked in. Owners and managers can see it, and so can you, in Your settings › Your activity.</p>${note(KEPT)}`, `<span></span>${button('OK')}`, 520, { close: false }));

// ---------- Alerts on Today (decision 2; audit M3, M7) ----------
const alertRow = (t, v, would, on) => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="flex: 1 1 260px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${t}</span><span style="font-size: 13px; color: ${C.muted}">${would}</span></span>${v !== null ? `<input aria-label="${esc(t)}" value="${v}" placeholder="Set an amount" style="width: 130px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}">` : ''}<span style="width: 150px">${rowSwitch(`<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">${esc(t)}</span>`, on)}</span></div>`;
const alertsOpen = () => `${note('For owners and managers only, in Needs attention on Today; “Seen” clears them and shows in the activity log. Nothing stops a sale. Only the owner changes these — managers see them as they are.')}
${alertRow('A discount over', '£[amount]', 'Would have raised [n] alerts in the last 30 days', true)}
${alertRow('A refund over', '', 'Off until you set an amount', false)}
${alertRow('Voids by one person in a day, more than', '[n]', 'Would have raised [n] alerts in the last 30 days', true)}
${alertRow('A price changed to below what it cost', null, 'Changing many prices at once raises one alert, not one each', true)}`;

// ---------- Signed-in devices (decision 3; audit H5, M6, M8, L5) ----------
const devRow = (device, who, where, when, action = 'Sign out') => `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 60px; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 220px; min-width: 0"><span style="font-size: 15px; font-weight: 700">${device}</span><span style="font-size: 13px; color: ${C.muted}">${who} · ${where} · ${when}</span></span>${action ? button(action, { variant: 'default' }).replace('<button', `<button aria-label="${esc(action)} — ${esc(device.replace(/<[^>]+>/g, ''))}"`) : ''}</div>`;
const devicesOpen = (signedOut = false) => `${note('Tills are added by the owner, in <a href="#" style="color: inherit; font-weight: 600">Settings › Front desk › Till</a>. Checking someone out of a till leaves it ready for the next PIN.')}
<h4 style="margin: 4px 0 0; font-size: 14px; font-weight: 700">Tills</h4>
${devRow('Till B1', 'Jo Taylor checked in', 'Bolton', 'in use now', 'Check out Jo Taylor')}${devRow('[Till]', 'Nobody checked in', '[Second site]', 'last used [date]', '')}
<h4 style="margin: 8px 0 0; font-size: 14px; font-weight: 700">Phones and computers</h4>
${devRow('[Phone model] · [browser]', 'Jack Lewis (you)', 'Bolton', 'used just now', '')}${signedOut ? '' : devRow('[Computer] · [browser]', 'Jack Lewis', 'Bolton', 'last used [date]')}${devRow('[Phone model] · [browser]', 'Jo Taylor', 'Bolton', 'last used [date]')}
${note('Only the owner can sign out the owner’s own devices.')}`;
const officeStaff = (open, who = OWNER) => settingsPage('staff', 'Staff and roles', STAFF_INTRO, staffFolds(open), { who });
const signOutAsk = () => popup('so-title', 'Sign out [Computer] · [browser]?', 'Jack Lewis · Bolton · last used [date]', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Anyone using it will need to sign in again with their email. Nothing else changes, and it’s recorded in the activity log.</p>`, `${button('Cancel', { variant: 'ghost' })}${button('Sign out')}`, 480);
// Audit H5: see what the till is doing first; never during a card payment.
const tillOption = (t, on, sub) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="when"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${t}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></label>`;
const tillCheckout = () => popup('tc-title', 'Check Jo Taylor out of Till B1?', 'Bolton · checked in since [time]', `${msg('<strong>A sale is open on Till B1:</strong> [n] items, £[£]. No card payment is in progress.', 'grey')}
<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">When</legend>${tillOption('After this sale', true, 'Jo finishes the sale, then the till asks for the next PIN.')}${tillOption('Now', false, 'The basket is put on hold, to pick up with any PIN.')}</fieldset>
${note('Not possible while a card payment is in progress. Anyone can check in again with their PIN.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Check out Jo Taylor')}`, 540);
const everywhereAsk = () => popup('se-title', 'Sign Jo Taylor out everywhere?', 'Till B1 now · [n] phone or computer', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Jo is checked out of Till B1 after the sale that’s open, and signed out of every phone and computer. Their sales and jobs stay as they are; they can sign in again with their email and PIN.</p>`, `${button('Cancel', { variant: 'ghost' })}${button('Sign out everywhere')}`, 500);

// ---------- Send feedback (decision 4; audit H6, L4) ----------
const behind = () => diaryScreens.diary[SIZE] || diaryScreens.diary.desktop;
const fbText = (typed) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="fb-text" style="font-size: 14px; font-weight: 600">What happened, or what’s missing?</label><textarea id="fb-text" rows="${isP() ? 6 : 4}" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}; resize: vertical">${typed ? '[What Jo wrote]' : ''}</textarea></div>`;
const feedback = ({ shot = false, typed = true, failed = false } = {}) => popup('fb-title', 'Send feedback', 'To the Wheelhouse team', `${failed ? msg('<strong>Couldn’t send — no connection.</strong> What you wrote is kept here. Try again when you’re back online.', 'warn', true) : ''}${fbText(typed)}
<p style="margin: 0; display: flex; gap: 8px; font-size: 14px; color: ${C.muted}">${icon('website', 16)}<span>We’ll see you were on <strong style="color: ${C.ink}">Diary</strong>, and that you’re Jo Taylor at North Street Cycles.</span></p>
<label style="display: flex; align-items: flex-start; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox"${shot ? ' checked' : ''} style="width: 20px; height: 20px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Add a picture of the screen</span><span style="font-size: 13px; color: ${C.muted}">Customer names and contact details are hidden in it. You’ll see it first.</span></span></label>
${shot ? `<div style="display: flex; flex-direction: column; gap: 6px"><div role="img" aria-label="Picture of the Diary: this week’s jobs, with customer names and phone numbers hidden" style="height: ${isP() ? 160 : 140}px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.muted}; font-size: 14px">[Picture of the Diary, customer details hidden]</div><div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px"><a href="#" style="${tall}; font-size: 14px; font-weight: 600; color: ${C.ink}">View larger</a><span style="font-size: 13px; color: ${C.muted}">This week’s jobs, with customer names and phone numbers hidden.</span></div><p role="status" style="margin: 0; font-size: 13px; color: ${C.ink}; line-height: 1.45">Only the Wheelhouse support team sees it, and it’s deleted after [n] days.</p></div>` : ''}`, `${button('Cancel', { variant: 'ghost' })}${typed ? button(failed ? 'Try again' : 'Send') : button('Send').replace('<button', '<button aria-disabled="true" title="Write something first"').replace('style="', 'style="opacity: 0.45; ')}`, 560);
const sentToast = () => toast('Thanks — we’ve got it. Any reply comes to your email.');

// ---------- The boards ----------
const board = (inner) => `<div style="position: relative; width: ${DIMS[SIZE][0]}px; height: ${DIMS[SIZE][1]}px; overflow: hidden">${inner}</div>`;
def('ops-reports-home', () => reportScreens['rp-home'][SIZE]);
def('ops-reports-staff', () => reportScreens['rp-home-staff'][SIZE]);
def('ops-log', () => logPage());
def('ops-log-manager', () => logPage({ who: MANAGER }));
def('ops-log-all', () => logPage({ site: 'All shops' }));
def('ops-log-filtered', () => logPage({ filtered: true }));
def('ops-log-empty', () => logPage({ empty: true }));
def('ops-log-refused', () => logRefused());
def('ops-first-note', () => firstNote());
def('ops-my-activity', () => myActivity());
def('ops-today-alerts', () => today({ watch: true }));
def('ops-alert-settings', () => officeStaff({ alerts: alertsOpen() }));
def('ops-devices', () => officeStaff({ devices: devicesOpen() }));
def('ops-till-checkout', () => overlay(officeStaff({ devices: devicesOpen() }), tillCheckout()));
def('ops-devices-signout', () => overlay(officeStaff({ devices: devicesOpen() }), signOutAsk()));
def('ops-devices-signed-out', () => withToast(officeStaff({ devices: devicesOpen(true) }), toast('Signed out [Computer] · [browser]')));
def('ops-person', () => overlay(staffPage({ people: peopleOpen(false) }), personDialog()));
def('ops-person-everywhere', () => overlay(staffPage({ people: peopleOpen(false) }), everywhereAsk()));
// On a phone the Help cards come after Accessibility, so the board is
// scrolled down to them.
const scrolledPhoneSettings = (px) => { const h = yourSettingsDialog('phone'); const out = h.replace('<div data-scroll style="padding: 14px; display: flex; flex-direction: column; gap: 10px; flex-grow: 1; min-height: 0; overflow-y: auto">', `<style>.ys-sc > * { position: relative; top: -${px}px }</style><div data-scroll class="ys-sc" style="padding: 14px; display: flex; flex-direction: column; gap: 10px; flex-grow: 1; min-height: 0; overflow-y: hidden">`); if (out === h) throw new Error('oversight.mjs: Your settings layout changed'); return out; };
def('ops-your-settings', () => (isP() ? board(scrolledPhoneSettings(400)) : overlay(behind(), yourSettingsDialog(SIZE))));
def('ops-feedback-empty', () => overlay(behind(), feedback({ typed: false })));
def('ops-feedback', () => overlay(behind(), feedback()));
def('ops-feedback-shot', () => overlay(behind(), feedback({ shot: true })));
def('ops-feedback-failed', () => overlay(behind(), feedback({ failed: true })));
def('ops-feedback-sent', () => board(`${behind()}${sentToast()}`));

// Desktop, tablet and phone (tablet and phone drawn after the UI audit).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ops-reports-home': 'Reports: “Activity log” beside the ready-made reports',
  'ops-reports-staff': 'Staff with “Can see reports”: no activity log',
  'ops-log': 'Reports › Activity log: what was done today, by whom',
  'ops-log-manager': 'A manager’s activity log: everyone’s lines',
  'ops-log-all': 'All shops: every line shows its shop',
  'ops-log-filtered': 'Opened from a Today alert, with Back to Today',
  'ops-log-empty': 'Nothing matches the filters',
  'ops-log-refused': 'Staff following a link to the log',
  'ops-first-note': 'The first sign-in: what Wheelhouse records',
  'ops-my-activity': 'Your activity: a person’s own lines',
  'ops-today-alerts': 'Today, owners and managers: a discount, voids, a price below cost',
  'ops-alert-settings': 'Settings › Office › Alerts on Today: set by the owner',
  'ops-devices': 'Settings › Office › Signed-in devices',
  'ops-till-checkout': 'Check Jo Taylor out of Till B1: after this sale, or now',
  'ops-devices-signout': 'Sign a computer out',
  'ops-devices-signed-out': 'Signed out',
  'ops-person': 'A person: “Sign out everywhere”',
  'ops-person-everywhere': 'Sign Jo Taylor out everywhere?',
  'ops-your-settings': 'Your settings: Send feedback, and what’s recorded about you',
  'ops-feedback-empty': 'Send feedback: Send waits until something is written',
  'ops-feedback': 'Send feedback: what happened, and which screen',
  'ops-feedback-shot': 'With a picture of the screen, customer details hidden',
  'ops-feedback-failed': 'Couldn’t send: kept, try again',
  'ops-feedback-sent': 'Thanks — we’ve got it',
};
export const ROWS = [
  { label: 'The activity log', screens: ['ops-reports-home', 'ops-reports-staff', 'ops-log', 'ops-log-manager', 'ops-log-all', 'ops-log-filtered', 'ops-log-empty', 'ops-log-refused'] },
  { label: 'What staff are told', screens: ['ops-first-note', 'ops-your-settings', 'ops-my-activity'] },
  { label: 'Alerts on Today', screens: ['ops-today-alerts', 'ops-alert-settings'] },
  { label: 'Signed-in devices', screens: ['ops-devices', 'ops-till-checkout', 'ops-devices-signout', 'ops-devices-signed-out', 'ops-person', 'ops-person-everywhere'] },
  { label: 'Send feedback', screens: ['ops-feedback-empty', 'ops-feedback', 'ops-feedback-shot', 'ops-feedback-failed', 'ops-feedback-sent'] },
];
