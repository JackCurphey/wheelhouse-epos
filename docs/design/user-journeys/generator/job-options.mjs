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

// ================= Option 5: Citrus Lime style =================
// Jack's brief (28 Sep): a very basic version of our job page laid out like
// Citrus Lime's Cloud POS workshop job page (his screenshot), before deciding
// whether to go that way — same top-to-bottom structure (title bar, tinted
// customer strip, collapsible "Workshop Job Information", collapsible
// "Workshop Items" table, footer) but with our content and Fjell look.
// Line-level detail (sub-type, code, qty) is the same real data diary.mjs/
// stage2.mjs already draw for WH-1042 — nothing invented (ws-text.json:104,
// diary.mjs:221, stage2.mjs:48/259).
const LINE_DETAILS = [
  { work: 'Standard service', sub: 'Labour · 60 min', code: '', qty: '1', price: 65.0, decision: 'Approved' },
  { work: 'Shimano brake pads', sub: 'Part · B05S-RX', code: 'B05S-RX', qty: '1', price: 28.0, decision: 'Approved' },
  { work: 'Fit & adjust brakes', sub: 'Labour · 30 min', code: '', qty: '1', price: 18.0, decision: 'Approved' },
  { work: 'Replace gear cable', sub: 'Optional · cable still serviceable', code: '', qty: '1', price: 12.0, decision: 'Declined' },
];
// Collapsible section shell: chevron + title (+ meta) on the left of the
// header, tags/extra on the right; body only rendered when expanded — the
// Citrus Lime reference folds sections, and showing the checklist section
// collapsed (with its counts summarised in the header) is the honest way to
// show that this pattern hides detail behind a click, even though Jack's own
// brief is "all on one page".
function foldSection(title, { expanded = true, meta = '', tags = '', body = '', grow = false } = {}) {
  const chev = `<span style="display: inline-flex; flex-shrink: 0; transform: rotate(${expanded ? 0 : -90}deg); color: ${C.muted}">${icon('chevron', 16)}</span>`;
  const header = `<div style="box-sizing: border-box; min-height: 32px; padding: 6px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; ${expanded ? `border-bottom: 1px solid ${C.border};` : ''}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap">${chev}${h2(title, 15)}${meta ? `<span style="font-size: 12px; color: ${C.muted}">${meta}</span>` : ''}</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap">${tags}</div>
</div>`;
  const boxStyle = expanded
    ? `${grow ? 'flex-grow: 1;' : 'flex-shrink: 0;'} min-height: 0; display: flex; flex-direction: column; overflow: hidden;`
    : 'flex-shrink: 0;';
  return `<div style="box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}; ${boxStyle}">
${header}
${expanded ? `<div style="box-sizing: border-box; padding: 8px 14px; ${grow ? 'flex-grow: 1;' : ''} min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 6px">${body}</div>` : ''}
</div>`;
}
function option5() {
  // Title bar — brief: job title + status chip + close only (no job number
  // here; it's in the "Job details" section below, as in the reference).
  const titleBar = `<header style="flex-shrink: 0; box-sizing: border-box; padding: 13px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0"><h2 id="job-opt-title" style="margin: 0; font-size: 18px; font-weight: 700">Standard service</h2>${badge('In workshop', 'blue')}</div>
<a href="#" aria-label="Close, back to the diary" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
  // Tinted customer strip — account link, contact details, bike, storage
  // slot; three icon buttons on the right (reusing the icon set: 'inbox' for
  // messaging, 'mail' for email, 'menu' — a lines glyph — standing in for
  // notes, since the icon set has no chat-bubble/pencil/note glyphs of its
  // own and this file only reuses ui.mjs, not adds to it).
  const iconBtn = (name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLink5 = `<a href="#" aria-label="View ${esc(JOB_CUSTOMER.name)}'s account" style="font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(JOB_CUSTOMER.name)}</a>`;
  const custStrip = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 9px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLink5}<span>${esc(JOB_CUSTOMER.phone)}</span><span>${esc(JOB_CUSTOMER.email)}</span><span>Trek Domane AL 3 · green</span><span style="color: ${C.muted}">Kept on Hook 3</span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtn('inbox', 'Message Maya Patel')}${iconBtn('mail', 'Email Maya Patel')}${iconBtn('menu', 'Notes')}</div>
</div>`;
  // "Job details" — expanded. Meta line + tags in the header; left form
  // grid (mechanic/status/diary time/ready-by/ticks), right notes column
  // (customer's concern read-only, staff notes editable).
  const jobMeta = `WH-1042 · Created Thu 17 Sep · by Jo Taylor`;
  const jobTags = `${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`;
  // Mechanic/Status are the two real dropdowns on this section — those keep
  // a ≥44px touch target. Diary time/Ready by are read-only display fields
  // (not inputs), so they're drawn smaller, like the "Bike is here"/"New
  // bike build" ticks which keep their own 44px target via checkRow.
  const selectField = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 3px"><label for="${id}" style="font-size: 11px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><select id="${id}" style="width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>${esc(value)}</option></select></div>`;
  const staticField = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 1px"><label for="${id}" style="font-size: 11px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><div id="${id}" style="min-height: 20px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.bg}; display: flex; align-items: center; font-size: 13px; color: ${C.ink}">${esc(value)}</div></div>`;
  const jobLeft = `${grid('1fr 1fr', `${selectField('Mechanic', 'Alex Morgan', 'j5-mech')}${selectField('Status', 'In workshop', 'j5-status')}`, 14)}
${grid('1fr 1fr', `${staticField('Diary time', 'Thu 17 Sep · 11:30–13:00', 'j5-time')}${staticField('Ready by', 'Fri 18 Sep', 'j5-ready')}`, 14)}
<div style="display: flex; gap: 24px; flex-wrap: wrap">${checkRow('Bike is here', true, 'j5-here')}${checkRow('New bike build', false, 'j5-newbuild')}</div>`;
  const jobRight = `${panel(`${h2('What the customer told us', 12)}${quoteBlock(CONCERN, 12)}`, '', 5, 2)}
<div style="display: flex; flex-direction: column; gap: 2px"><label for="j5-notes" style="font-size: 11px; font-weight: 600; color: ${C.ink}">Staff notes</label><textarea id="j5-notes" rows="1" placeholder="Add a note for the team…" style="box-sizing: border-box; resize: none; padding: 4px 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; color: ${C.ink}; line-height: 1.3"></textarea></div>`;
  const jobBody = grid('1fr 340px', `<div style="display: flex; flex-direction: column; gap: 8px; min-height: 0">${jobLeft}</div><div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${jobRight}</div>`, 24);
  const jobSection = foldSection('Job details', { expanded: true, meta: jobMeta, tags: jobTags, body: jobBody, grow: false });
  // "Work and parts" — expanded. Toolbar, then the table itself. Columns
  // exactly as Jack's brief lists: Code, Work/part, Done, Note, Qty, In
  // stock, Price, Total, Customer approval. Cells with no real source
  // (bin/qty-on-PO/qty-returned aren't tracked in our data) show "—".
  // Compact toolbar buttons: this row is a secondary toolbar (not the
  // primary per-line touch controls, which stay ≥44px — see the Done
  // checkboxes and footer actions below), so it uses a smaller control
  // similar to Citrus Lime's own dense toolbar.
  const toolbarBtn = (text, iconName) => `<button type="button" style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 12px; font-weight: 600">${icon(iconName, 13)}${esc(text)}</button>`;
  const toolbar = row(`${toolbarBtn('Add item', 'plus')}${toolbarBtn('Scan barcode', 'search')}${toolbarBtn('Print', 'reports')}`, 8);
  const th = (t, extra = '') => `<th style="text-align: left; font-size: 11px; font-weight: 700; color: ${C.muted}; padding: 2px 10px; border-bottom: 1px solid ${C.border}; line-height: 1.2; ${extra}">${esc(t)}</th>`;
  const td = (inner, extra = '') => `<td style="padding: 2px 10px; font-size: 13px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; vertical-align: middle; line-height: 1.25; ${extra}">${inner}</td>`;
  const rowsHtml = LINE_DETAILS.map((l, i) => {
    const declined = l.decision === 'Declined';
    const strike = declined ? `text-decoration: line-through; color: ${C.muted};` : '';
    return `<tr>
${td(mono(l.code || '—'))}
${td(`<span style="${strike}"><span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${C.muted}"> · ${esc(l.sub)}</span></span>`)}
${td(`<input type="checkbox" ${declined ? '' : 'checked'} aria-label="${esc(l.work)} done" style="width: 18px; height: 18px; accent-color: ${C.accent}">`, 'text-align: center')}
${td(l.work === 'Shimano brake pads' ? esc('Rear pads worn — replacing') : '—', `color: ${C.muted}`)}
${td(mono(l.qty))}
${td('—', `color: ${C.muted}`)}
${td(mono(`£${l.price.toFixed(2)}`, strike))}
${td(mono(`£${l.price.toFixed(2)}`, `font-weight: 600; ${strike}`))}
${td(declined ? badge('Declined', 'red') : badge('Approved', 'green'))}
</tr>`;
  }).join('');
  const totalRow = `<tr><td colspan="7" style="padding: 5px 10px; text-align: right; font-size: 13px; font-weight: 700">Approved total</td><td style="padding: 5px 10px">${mono(`£${APPROVED_TOTAL.toFixed(2)}`, 'font-weight: 700; font-size: 14px')}</td><td></td></tr>`;
  const table = `<table style="width: 100%; border-collapse: collapse">
<thead><tr>${th('Code')}${th('Work / part')}${th('Done', 'text-align: center')}${th('Note')}${th('Qty')}${th('In stock')}${th('Price')}${th('Total')}${th('Customer approval')}</tr></thead>
<tbody>${rowsHtml}${totalRow}</tbody>
</table>`;
  const workBody = `${toolbar}${table}${meta(DECLINED_NOTE, 12)}`;
  const workSection = foldSection('Work and parts', { expanded: true, body: workBody, grow: false });
  // "Checklist" — shown collapsed on purpose (see comment above foldSection):
  // 8 of 10 items checked, 1 has a note (the worn-pads finding).
  const checkedCount = CHECKLIST.filter((c) => c.checked).length;
  const notedCount = CHECKLIST.filter((c) => c.note).length;
  const checklistSection = foldSection('Checklist', { expanded: false, meta: `Standard service checklist · ${checkedCount} of ${CHECKLIST.length} done · ${notedCount} note` });
  const body = dialogBody(`${jobSection}${workSection}${checklistSection}`, 12, 8);
  const footer = dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-opt-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${titleBar}${custStrip}${body}${footer}
</div>
</div>
</div>`;
}

// ================= Option 6: Citrus Lime style, revised =================
// Decision 31 (2026-09-27-workshop-day-review.md) revises option 5: one big
// notes box holds everything written about the job (the customer's own words
// from booking, marked as theirs, alongside staff notes with who/when);
// writing notes is the main thing a staff member does, so notes get the
// largest, most prominent area; job details become a compact always-visible
// strip (no fold, no card heading); work and parts stay small by default at
// the bottom with Scan barcode/Add item always reachable. Title bar and
// customer strip are option 5's, unchanged, so the two boards compare
// directly (Jack's brief) — copied rather than shared, since option 5's own
// function is left untouched.
function option6() {
  // ---- Title bar & customer strip: verbatim from option 5. ----
  const titleBar6 = `<header style="flex-shrink: 0; box-sizing: border-box; padding: 13px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0"><h2 id="job-opt6-title" style="margin: 0; font-size: 18px; font-weight: 700">Standard service</h2>${badge('In workshop', 'blue')}</div>
<a href="#" aria-label="Close, back to the diary" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
  const iconBtn6 = (name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLink6 = `<a href="#" aria-label="View ${esc(JOB_CUSTOMER.name)}'s account" style="font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(JOB_CUSTOMER.name)}</a>`;
  const custStrip6 = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 9px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLink6}<span>${esc(JOB_CUSTOMER.phone)}</span><span>${esc(JOB_CUSTOMER.email)}</span><span>Trek Domane AL 3 · green</span><span style="color: ${C.muted}">Kept on Hook 3</span><span>Mechanic: <strong>Alex Morgan</strong></span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtn6('inbox', 'Message Maya Patel')}${iconBtn6('mail', 'Email Maya Patel')}${iconBtn6('menu', 'Notes')}</div>
</div>`;
  // ---- Job details: a compact, always-visible strip — no chevron, no card
  // heading (decision 31: "Job details are a compact strip at the top,
  // always visible, not a folding section"). Two tight rows: identity + tags
  // on top, the controls/ticks below. Mechanic/Status stay real selects
  // (≥44px touch target); diary time/ready-by stay plain text, as in option
  // 5 — only their layout is flattened out of the card.
  const compactSelect6 = (label, value, id) => `<div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 0">
<label for="${id}" style="font-size: 11px; font-weight: 600; color: ${C.muted}; flex-shrink: 0">${esc(label)}</label>
<select id="${id}" style="min-height: 44px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; color: ${C.ink}"><option>${esc(value)}</option></select>
</div>`;
  const compactStatic6 = (label, value) => `<div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 0">
<span style="font-size: 11px; font-weight: 600; color: ${C.muted}">${esc(label)}</span>
<span style="font-size: 13px; color: ${C.ink}">${esc(value)}</span>
</div>`;
  const jobStripTop6 = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 12);
  const jobStripBottom6 = row(`${compactSelect6('Status', 'In workshop', 'j6-status')}${compactStatic6('Diary time', 'Thu 17 Sep · 11:30–13:00')}${compactStatic6('Ready by', 'Fri 18 Sep')}${checkRow('Bike is here', true, 'j6-here', '', false, 44)}${checkRow('New bike build', false, 'j6-newbuild', '', false, 44)}`, 22, 'flex-wrap: wrap');
  const jobStrip6 = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 8px 22px; display: flex; flex-direction: column; gap: 4px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}">${jobStripTop6}${jobStripBottom6}</div>`;
  // ---- Notes: the main, largest area (decision 31: "writing notes is the
  // main thing... so the notes box is large and prominent"). A composer at
  // the top, then the feed, newest first. The customer's own words from
  // booking get a "Customer" badge, a calm green tint and a left marker —
  // three signals, not colour alone — so a colour-blind reader still reads
  // "Customer" straight off the badge text.
  const NOTES6 = [
    { author: 'Alex Morgan', role: 'staff', when: 'Thu 17 Sep · 12:10', text: 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' },
    { author: 'Jo Taylor', role: 'staff', when: 'Thu 17 Sep · 09:05', text: 'Bike booked in, tag printed.' },
    { author: 'Maya Patel', role: 'customer', when: 'Wed 16 Sep', sub: 'from her booking', text: 'My rear brake squeals and feels weak. The gears could use a tune-up too.' },
  ];
  const noteCard6 = (n) => {
    const isCust = n.role === 'customer';
    return `<div style="box-sizing: border-box; padding: 8px 12px; border-radius: 8px; border: 1px solid ${isCust ? C.accent : C.border}; border-left: 3px solid ${isCust ? C.accent : C.border}; background: ${isCust ? C.okBg : C.panel}; display: flex; flex-direction: column; gap: 3px">
<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
<span style="font-size: 13px; font-weight: 700; color: ${C.ink}">${esc(n.author)}</span>
${isCust ? badge('Customer', 'green') : ''}
${n.sub ? `<span style="font-size: 12px; color: ${C.muted}">${esc(n.sub)}</span>` : ''}
<span style="flex-grow: 1"></span>
<span style="font-size: 12px; color: ${C.muted}">${esc(n.when)}</span>
</div>
<p style="margin: 0; font-size: 14px; line-height: 1.35; color: ${C.ink}">${esc(n.text)}</p>
</div>`;
  };
  const noteComposer6 = `<div style="display: flex; flex-direction: column; gap: 6px">
<textarea id="j6-note" rows="2" placeholder="Write a note…" style="box-sizing: border-box; resize: none; min-height: 50px; padding: 8px 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; line-height: 1.35"></textarea>
<div style="display: flex; justify-content: flex-end">${button('Add note', { variant: 'accent' })}</div>
</div>`;
  const notesFeed6 = `<div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1; min-height: 0; overflow: hidden">${NOTES6.map(noteCard6).join('')}</div>`;
  const notesSection6 = `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.bg}; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow: hidden">
${eyebrow('Notes')}
${noteComposer6}
${notesFeed6}
</div>`;
  // ---- Checklist: a folding section, collapsed (as option 5's), placed
  // after notes rather than beside them — with notes now the largest thing
  // on the page, stacking checklist/work-parts underneath, smallest-last,
  // reads better on a 1280-wide board than a side-by-side rail would.
  const checkedCount6 = CHECKLIST.filter((c) => c.checked).length;
  const notedCount6 = CHECKLIST.filter((c) => c.note).length;
  const checklistFold6 = foldSection('Checklist', { expanded: false, meta: `Standard service checklist · ${checkedCount6} of ${CHECKLIST.length} done · ${notedCount6} note` });
  // ---- Work and parts: small by default, at the bottom. Scan barcode/Add
  // item stay ≥44px touch targets and always visible on the collapsed row
  // itself (usually you just scan an item in); "Show all" plus the fold's
  // own chevron expand it. The expanded table isn't drawn on this board
  // (brief).
  const workSummary6 = `4 lines · £${APPROVED_TOTAL.toFixed(2)} approved · 1 declined`;
  const workTags6 = `${ghostBtn('Scan barcode', 'search')}${ghostBtn('Add item', 'plus')}${link('Show all')}`;
  const workFold6 = foldSection('Work and parts', { expanded: false, meta: workSummary6, tags: workTags6 });
  const body6 = dialogBody(`${jobStrip6}${notesSection6}${checklistFold6}${workFold6}`, 6, 4);
  const footer6 = dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-opt6-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${titleBar6}${custStrip6}${body6}${footer6}
</div>
</div>
</div>`;
}

// ================= Comparison sheet =================
const OPTIONS_SUMMARY = [
  {
    name: 'Checklist first',
    best: 'Best for: working the checklist item by item — it is the biggest thing on the screen.',
    cost: 'Costs: the concern and agreed work are squeezed into a 320px rail — most reduced of the six.',
    omits: 'Omits/demotes: messages and history are header buttons with counts, a click away.',
  },
  {
    name: 'Three columns',
    best: 'Best for: a balanced, at-a-glance view — asked/agreed, checklist and activity with equal weight.',
    cost: 'Costs: three narrower columns; the checklist column is the tightest fit of the six.',
    omits: 'Omits/demotes: history capped at 5 events; messages show only the latest, both behind "See all".',
  },
  {
    name: 'Top summary strip',
    best: 'Best for: a quick read of the whole job before diving in, then the checklist as the main event.',
    cost: 'Costs: the concern is shortened to one line; the full quote isn\'t shown on this page.',
    omits: 'Omits/demotes: the agreed work table is reduced to a count; history and full messages are dropped.',
  },
  {
    name: 'Asked vs found',
    best: 'Best for: comparing what was asked against what the mechanic found, side by side.',
    cost: 'Costs: the checklist splits into two 5-item sub-columns to fit the right half.',
    omits: 'Omits/demotes: messages and history collapse to a single activity line with a "Full history" link.',
  },
  {
    name: 'Citrus Lime style',
    best: 'Best for: comparing directly against Citrus Lime\'s Cloud POS job page (Jack\'s reference).',
    cost: 'Costs: folding "Job details" and "Work and parts" into bordered sections adds chrome; the table is the densest text on any board.',
    omits: 'Omits/demotes: the checklist shows collapsed with only a count — the one option folded away by default.',
  },
  {
    name: 'Citrus Lime style, revised',
    best: 'Best for: how shops actually work — scan-and-go at the bottom, one big notes box (customer\'s words + staff notes together) where most of the job time is spent (Jack\'s brief, decision 31).',
    cost: 'Costs: the job details strip packs mechanic/status selects, times and ticks into one dense row to keep notes largest.',
    omits: 'Omits/demotes: both the checklist and the full work/parts table fold away by default, each to a one-line summary.',
  },
];
function introBoard() {
  const rowFor = (o, i) => `<div style="display: flex; flex-direction: column; gap: 3px; padding: 10px 0; ${i ? `border-top: 1px solid ${C.border};` : ''}">
<div style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 12px; font-weight: 700; color: ${C.muted}">${i + 1}</span>${h2(o.name, 15)}</div>
${txt(o.best, 13)}
${meta(o.cost, 12)}
${meta(o.omits, 12)}
</div>`;
  return `<div style="width: ${DW}px; height: ${DH}px; box-sizing: border-box; padding: 26px 56px; background: ${C.bg}; display: flex; flex-direction: column; gap: 12px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: ${C.accent}">JOB PAGE — DESIGN EXPLORATION</div>
<h1 style="margin: 0; font-size: 24px; font-weight: 700">Six ways to lay out the job page</h1>
<p style="margin: 0; font-size: 13px; color: ${C.muted}; max-width: 950px">Same job on every option (WH-1042, Maya Patel, Trek Domane AL 3, mechanic view). No scrolling on any option; body text stays at 14px or larger (option 5's dense table is the one exception). Option 6 is option 5 revised per Jack's brief. What each one is best for, what it costs, and what it leaves out or moves a click away.</p>
</div>
<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 12px; padding: 2px 28px">
${OPTIONS_SUMMARY.map(rowFor).join('')}
</div>
</div>`;
}

export const boards = [
  { id: 'job-option-1', title: 'Job page option 1 · Checklist first', html: option1() },
  { id: 'job-option-2', title: 'Job page option 2 · Three columns', html: option2() },
  { id: 'job-option-3', title: 'Job page option 3 · Top summary strip', html: option3() },
  { id: 'job-option-4', title: 'Job page option 4 · Asked vs found', html: option4() },
  { id: 'job-option-5', title: 'Job page option 5 · Citrus Lime style', html: option5() },
  { id: 'job-option-6', title: 'Job page option 6 · Citrus Lime style, revised', html: option6() },
  { id: 'job-options-intro', title: 'Job page options · comparison sheet', html: introBoard() },
];
