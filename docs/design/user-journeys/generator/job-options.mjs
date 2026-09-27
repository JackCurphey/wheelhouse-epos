// Design exploration — four alternative layouts for the job page (Jack's
// brief, 27 Sep 2026): "spin up several different ways to have the job page
// ... all on one page ... no scroll ... not cramped." Desktop only, one
// board per option plus a plain comparison sheet.
//
// diary.mjs is being edited concurrently by another helper (its jobPageHeader,
// dialogOverlay etc. are private, not exported, and unsafe to depend on right
// now) — so beyond the exported shell (shellDesktop) this file copies the
// small helpers/example data it needs from diary.mjs/stage2.mjs rather than
// importing them. Same job for every option: WH-1042, Maya Patel, Trek
// Domane AL 3, in the workshop with Alex Morgan (mechanic view).
import { C, MONO, esc, icon, button, badge, card, logoSlot } from './ui.mjs';
import { DW, DH, stack } from './stage1.mjs';
import { shellDesktop } from './diary.mjs';

// ---------- small helpers (copied from diary.mjs's private helpers; kept
// minimal — this file only needs a subset) ----------
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const h2 = (t, size = 16) => `<h2 style="margin: 0; font-size: ${size}px; line-height: 1.3; font-weight: 700">${esc(t)}</h2>`;
const txt = (t, size = 14, extra = '') => `<p style="margin: 0; font-size: ${size}px; line-height: 1.45; color: ${C.ink}; ${extra}">${t}</p>`;
const meta = (t, size = 12, extra = '') => `<p style="margin: 0; font-size: ${size}px; line-height: 1.4; color: ${C.muted}; ${extra}">${t}</p>`;
const eyebrow = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: ${C.muted}">${esc(t)}</div>`;
const panel = (inner, extra = '', pad = 16, gap = 10) => card(`<div style="padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px; box-sizing: border-box; min-height: 0">${inner}</div>`, `box-sizing: border-box; ${extra}`);
const row = (inner, gap = 12, extra = '') => `<div style="display: flex; align-items: center; gap: ${gap}px; ${extra}">${inner}</div>`;
const grid = (cols, inner, gap = 16, extra = '') => `<div style="display: grid; grid-template-columns: ${cols}; gap: ${gap}px; align-items: start; min-height: 0; ${extra}">${inner}</div>`;
const quoteBlock = (t, size = 14) => `<blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid ${C.border}; font-size: ${size}px; line-height: 1.45; color: ${C.ink}">${esc(t)}</blockquote>`;
const ghostBtn = (text, iconName, extra = '') => `<button type="button" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 13px; font-weight: 600; ${extra}">${icon(iconName, 16)}${esc(text)}</button>`;
// Checkbox row with a ≥44px touch target (constraint: touch targets ≥44px
// for checkboxes/buttons, since the mechanic may use a touchscreen).
const checkRow = (label, checked, id, sub = '', bordered = false, minH = 44) => `<div style="display: flex; flex-direction: column; ${bordered ? `border-top: 1px solid ${C.border};` : ''}">
<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: ${minH}px; cursor: pointer">
<input id="${id}" type="checkbox"${checked ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0">
<span style="font-size: 14px; color: ${C.ink}">${esc(label)}</span>
</label>
${sub ? `<div style="padding-left: 30px">${sub}</div>` : ''}
</div>`;
const link = (t, href = '#') => `<a href="${href}" style="font-size: 13px; font-weight: 600; color: ${C.accentDark}">${esc(t)}</a>`;

// ---------- example data (only names/bikes/jobs/prices already used by
// diary.mjs/stage2.mjs — nothing invented) ----------
const JOB_CUSTOMER = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards' };
const CONCERN = '“My rear brake squeals and feels weak. The gears could use a tune-up too.”';
const LINES = [
  ['Standard service', '£65.00', 'Approved'],
  ['Shimano brake pads', '£28.00', 'Approved'],
  ['Fit & adjust brakes', '£18.00', 'Approved'],
  ['Replace gear cable', '£12.00', 'Declined'],
];
const APPROVED_TOTAL = 111.0;
const DECLINED_NOTE = 'Gear cable declined. Anything beyond these lines needs a new approval.';
// 10-item standard service checklist (brief: reuse the 5 already in
// diary.mjs's CHECKLIST and add 5 more generic, plausible checks to reach 10).
const CHECKLIST = [
  { t: 'Frame & fork', checked: true, note: '' },
  { t: 'Wheels & tyres', checked: true, note: '' },
  { t: 'Tyre pressure', checked: true, note: '' },
  { t: 'Brakes bled & adjusted', checked: true, note: 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' },
  { t: 'Gears indexed', checked: true, note: '' },
  { t: 'Chain & drivetrain', checked: true, note: '' },
  { t: 'Bottom bracket', checked: true, note: '' },
  { t: 'Headset', checked: true, note: '' },
  { t: 'Cables & housing', checked: false, note: '' },
  { t: 'Bolts torqued', checked: false, note: '' },
];
const MESSAGES = [
  { who: 'You', time: '09:14', text: 'Your bike is booked in and we’ve started the safety check.' },
  { who: 'Maya Patel', time: '09:20', text: 'Thanks, how long roughly?' },
];
const HISTORY = [
  ['08:02', 'Booking confirmed by Maya Patel'],
  ['09:05', 'Bike booked in · tag printed'],
  ['09:40', 'Quote sent — awaiting approval'],
  ['10:10', 'Quote approved (pads); gear cable declined'],
  ['11:30', 'Work started by Alex Morgan'],
];

// ---------- shared chrome: header, dialog frame, footer ----------
// The pop-up sits over the dimmed diary, near-fullscreen, with a slim ~32px
// dimmed edge — decisions 15/16. The diary content itself isn't needed for
// this exploration (it's dimmed to near-invisible behind the overlay), so a
// plain placeholder stands in for it rather than depending on diary.mjs's
// private, in-flux diary-drawing helpers.
const DIALOG_PAD = 32;
function dialogFrame(bodyHtml) {
  const diaryPlaceholder = `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`;
  const base = shellDesktop('diary', 'Workshop diary', diaryPlaceholder);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${base}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-opt-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${bodyHtml}
</div>
</div>
</div>`;
}
// Header (decision 24): job number, status, stage in the workshop; customer
// name (a link to their account), phone, email, bike, storage slot.
function jobHeader(extraActions = '') {
  const custLink = `<a href="#" aria-label="View ${esc(JOB_CUSTOMER.name)}'s account" style="display: inline-flex; align-items: center; gap: 4px; font-size: 16px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(JOB_CUSTOMER.name)}<span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 13, C.accentDark)}</span></a>`;
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 11px 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 5px; min-width: 0">
<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
<h2 id="job-opt-title" style="margin: 0; font-family: ${MONO}; font-size: 16px; font-weight: 700">WH-1042</h2>${badge('In workshop', 'blue')}<span style="font-size: 12px; color: ${C.muted}">In the workshop with Alex Morgan</span>
</div>
<div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">${custLink}<span style="font-size: 13px; color: ${C.muted}">${esc(JOB_CUSTOMER.phone)} · ${esc(JOB_CUSTOMER.email)}</span></div>
<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap"><span style="font-size: 13px; color: ${C.ink}">${esc(JOB_CUSTOMER.bike)}</span><span style="font-size: 12px; color: ${C.muted}">Kept on Hook 3</span></div>
</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0">${extraActions}<a href="#" aria-label="Close, back to the diary" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a></div>
</header>`;
}
const dialogBody = (inner, pad = 22, gap = 16) => `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
const dialogFooter = (inner) => `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 22px; border-top: 1px solid ${C.border}; display: flex; align-items: center; gap: 12px; background: ${C.panel}">${inner}</div>`;
// Same main action for every option (brief): "Mark ready for collection".
const footerAction = () => `<div style="max-width: 340px">${button('Mark ready for collection', { block: true })}</div><span style="font-size: 12px; color: ${C.muted}">The customer is notified automatically.</span>`;

// ---------- compact building blocks reused across options ----------
const concernPanel = (size = 14) => panel(`${h2('What the customer told us', 14)}${quoteBlock(CONCERN, size)}`, '', 14, 6);
const agreedCompact = () => panel(`${h2('Agreed work', 14)}
<div style="display: flex; flex-direction: column; gap: 6px">
${LINES.map(([w, a, decision]) => `<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px; ${decision === 'Declined' ? `color: ${C.muted}; text-decoration: line-through;` : ''}"><span style="font-size: 14px">${esc(w)}</span>${mono(a, `font-size: 13px; ${decision === 'Declined' ? '' : 'font-weight: 600'}`)}</div>`).join('')}
</div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 15px; font-weight: 700"><span>Approved total</span>${mono(`£${APPROVED_TOTAL.toFixed(2)}`)}</div>
${meta(DECLINED_NOTE)}`, '', 14, 8);
const latestMessage = () => { const m = MESSAGES[MESSAGES.length - 1]; return meta(`<strong style="color: ${C.ink}">${esc(m.who)}</strong> · ${mono(m.time)} — “${esc(m.text)}”`, 13); };
const historyLast = () => meta(`Last: ${esc(HISTORY[HISTORY.length - 1][1])} at ${mono(HISTORY[HISTORY.length - 1][0])}`, 12);

// ================= Option 1: Checklist first =================
// Checklist is the hero (two columns of 5 items). Narrow rail: what the
// customer told us + agreed work (compact) + total. Messages/history
// demoted to header buttons with counts (a click away).
function option1() {
  const cols = [CHECKLIST.slice(0, 5), CHECKLIST.slice(5, 10)];
  const checklistCol = (items, offset) => `<div style="display: flex; flex-direction: column; gap: 22px">${items.map((it, i) => {
    const idx = offset + i;
    let sub = '';
    if (it.note) sub = meta(it.note, 12, `color: ${C.ink}`);
    else if (!it.checked) sub = link('+ Add note');
    return checkRow(it.t, it.checked, `cl1-${idx}`, sub, false, 50);
  }).join('')}</div>`;
  const rail = stack(`${concernPanel()}${agreedCompact()}`, 20);
  const main = stack(`${row(`${h2('Standard service checklist', 17)}<span style="flex-grow: 1"></span>`, 8)}${grid('1fr 1fr', `${checklistCol(cols[0], 0)}${checklistCol(cols[1], 5)}`, 36)}`, 22);
  const headerActions = `${ghostBtn('Messages (2)', 'mail')}${ghostBtn('History', 'today')}`;
  const body = dialogBody(grid('320px 1fr', `<div style="min-height: 0; overflow: hidden">${rail}</div><div style="min-height: 0; overflow: hidden">${main}</div>`, 32));
  return dialogFrame(`${jobHeader(headerActions)}${body}${dialogFooter(footerAction())}`);
}

// ================= Option 2: Three columns =================
// What the customer asked & agreed | checklist | activity, balanced widths.
function option2() {
  const left = stack(`${concernPanel(13)}${agreedCompact()}`, 16);
  const checklistList = panel(`${h2('Standard service checklist', 14)}<div style="display: flex; flex-direction: column">${CHECKLIST.map((it, i) => {
    let sub = '';
    if (it.note) sub = meta(it.note, 12, `color: ${C.ink}`);
    else if (!it.checked) sub = link('+ Add note');
    return checkRow(it.t, it.checked, `cl2-${i}`, sub, i > 0);
  }).join('')}</div>`, '', 8, 4);
  const activity = stack(`${panel(`${row(`${h2('Messages', 14)}${badge('2', 'grey')}`, 8, 'justify-content: space-between')}${latestMessage()}${link('See all messages')}`, '', 14, 8)}
${panel(`${h2('History', 14)}${HISTORY.slice(0, 5).map(([t, d]) => `<div style="display: flex; gap: 8px; font-size: 12px; color: ${C.muted}"><span style="font-family: ${MONO}; flex-shrink: 0">${esc(t)}</span><span>${esc(d)}</span></div>`).join('')}${link('Full history')}`, '', 14, 6)}`, 16);
  const body = dialogBody(grid('1fr 1fr 1fr', `<div style="min-height: 0; overflow: hidden">${left}</div><div style="min-height: 0; overflow: hidden">${checklistList}</div><div style="min-height: 0; overflow: hidden">${activity}</div>`, 20), 16);
  return dialogFrame(`${jobHeader()}${body}${dialogFooter(footerAction())}`);
}

// ================= Option 3: Top summary strip =================
// A horizontal strip under the header: concern (short) + agreed total/line
// count + latest message. Below: the checklist full width, as a grid of
// item cards with inline "Add note".
function option3() {
  const stripItem = (label, content) => `<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 4px">${eyebrow(label)}${content}</div>`;
  const strip = panel(`${grid('1fr 1fr 1fr', `
${stripItem('What the customer told us', txt('“My rear brake squeals and feels weak…”', 14))}
${stripItem('Agreed work', txt(`4 lines · ${mono(`£${APPROVED_TOTAL.toFixed(2)}`)} · 1 declined`, 14))}
${stripItem('Latest message', txt(`“${esc(MESSAGES[MESSAGES.length - 1].text)}”`, 14))}
`, 24)}`, '', 18, 0);
  const card3 = (it, i) => {
    let sub;
    if (it.note) sub = meta(it.note, 12, `color: ${C.ink}`);
    else if (it.checked) sub = meta('All working well', 12);
    else sub = link('+ Add note');
    return `<div style="box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; padding: 16px 16px 18px; display: flex; flex-direction: column; gap: 6px; min-height: 110px">${checkRow(it.t, it.checked, `cl3-${i}`)}${sub}</div>`;
  };
  const checklistGrid = panel(`${h2('Standard service checklist', 17)}${grid('repeat(5, minmax(0, 1fr))', CHECKLIST.map(card3).join(''), 18)}`, '', 20, 16);
  const body = dialogBody(`${strip}<div style="flex-grow: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: center">${checklistGrid}</div>`, 22, 22);
  return dialogFrame(`${jobHeader()}${body}${dialogFooter(footerAction())}`);
}

// ================= Option 4: Asked vs found =================
// Left half: what the customer asked for (concern, agreed work). Right
// half: what we found (checklist + notes). One thin activity line at the
// bottom, above the footer.
function option4() {
  const left = stack(`${eyebrow('What the customer asked for')}${concernPanel()}${agreedCompact()}`, 16);
  const rightChecklist = panel(`${h2('Standard service checklist', 16)}${grid('1fr 1fr', `
<div style="display: flex; flex-direction: column; gap: 18px">${CHECKLIST.slice(0, 5).map((it, i) => { let sub = it.note ? meta(it.note, 12, `color: ${C.ink}`) : (it.checked ? '' : link('+ Add note')); return checkRow(it.t, it.checked, `cl4-${i}`, sub, false, 50); }).join('')}</div>
<div style="display: flex; flex-direction: column; gap: 18px">${CHECKLIST.slice(5, 10).map((it, i) => { let sub = it.note ? meta(it.note, 12, `color: ${C.ink}`) : (it.checked ? '' : link('+ Add note')); return checkRow(it.t, it.checked, `cl4-${i + 5}`, sub, false, 50); }).join('')}</div>
`, 28)}`, '', 20, 14);
  const right = stack(`${eyebrow('What we found')}${rightChecklist}`, 16);
  const activityLine = row(`${icon('mail', 15, C.muted)}${meta(`Last message: “${esc(MESSAGES[MESSAGES.length - 1].text)}” (${MESSAGES.length})`, 12)}<span style="width: 1px; height: 14px; background: ${C.border}"></span>${icon('today', 15, C.muted)}${historyLast()}${link('Full history')}`, 10);
  const body = dialogBody(`<div style="flex-grow: 1; min-height: 0; overflow: hidden">${grid('1fr 1fr', `<div style="min-height: 0; overflow: hidden">${left}</div><div style="min-height: 0; overflow: hidden">${right}</div>`, 32)}</div>${activityLine}`, 22, 16);
  return dialogFrame(`${jobHeader()}${body}${dialogFooter(footerAction())}`);
}

// ================= Comparison sheet =================
const OPTIONS_SUMMARY = [
  {
    name: 'Checklist first',
    best: 'Best for: a mechanic working through the checklist item by item — it is the biggest thing on the screen.',
    cost: 'Costs: the customer\'s concern and the agreed work are both squeezed into a 320px rail, so their detail is the most reduced of the four.',
    omits: 'Omits/demotes: messages and history are both header buttons with counts ("Messages (2)", "History") — a click away, not shown.',
  },
  {
    name: 'Three columns',
    best: 'Best for: a balanced, at-a-glance view — asked/agreed, checklist and activity are all visible with equal weight.',
    cost: 'Costs: three narrower columns mean less room per section than the other options; the checklist column is the tightest fit of the four.',
    omits: 'Omits/demotes: history is capped at 5 events with a "Full history" link; messages show only the latest with a "See all messages" link.',
  },
  {
    name: 'Top summary strip',
    best: 'Best for: a quick read of the whole job before diving in — concern, total and latest message in one glance, then the checklist as the main event.',
    cost: 'Costs: the concern in the strip is shortened to one line; the full quote is not shown on this page.',
    omits: 'Omits/demotes: the agreed work table is reduced to "4 lines · £111.00 · 1 declined" — the line-by-line breakdown is not shown; history and full messages are dropped entirely from this board.',
  },
  {
    name: 'Asked vs found',
    best: 'Best for: comparing what was asked against what the mechanic found, side by side — good for handover or a second opinion.',
    cost: 'Costs: the checklist is split into two 5-item sub-columns to fit the right half, which is a slightly less natural reading order than one list.',
    omits: 'Omits/demotes: messages and history are both collapsed to a single activity line ("Last message… · Last: … ") with a "Full history" link.',
  },
];
function introBoard() {
  const rowFor = (o, i) => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 18px 0; ${i ? `border-top: 1px solid ${C.border};` : ''}">
<div style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 12px; font-weight: 700; color: ${C.muted}">${i + 1}</span>${h2(o.name, 17)}</div>
${txt(o.best, 14)}
${meta(o.cost, 13)}
${meta(o.omits, 13)}
</div>`;
  return `<div style="width: ${DW}px; height: ${DH}px; box-sizing: border-box; padding: 40px 56px; background: ${C.bg}; display: flex; flex-direction: column; gap: 18px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 6px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: ${C.accent}">JOB PAGE — DESIGN EXPLORATION</div>
<h1 style="margin: 0; font-size: 26px; font-weight: 700">Four ways to lay out the job page</h1>
<p style="margin: 0; font-size: 14px; color: ${C.muted}; max-width: 900px">Same job on every option (WH-1042, Maya Patel, Trek Domane AL 3, mechanic view). No scrolling on any option; body text stays at 14px or larger. What each one is best for, what it costs, and what it leaves out or moves a click away.</p>
</div>
<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 12px; padding: 4px 28px">
${OPTIONS_SUMMARY.map(rowFor).join('')}
</div>
</div>`;
}

export const boards = [
  { id: 'job-option-1', title: 'Job page option 1 · Checklist first', html: option1() },
  { id: 'job-option-2', title: 'Job page option 2 · Three columns', html: option2() },
  { id: 'job-option-3', title: 'Job page option 3 · Top summary strip', html: option3() },
  { id: 'job-option-4', title: 'Job page option 4 · Asked vs found', html: option4() },
  { id: 'job-options-intro', title: 'Job page options · comparison sheet', html: introBoard() },
];
