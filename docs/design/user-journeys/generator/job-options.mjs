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
// Notes feed data — customer's booking note + staff notes, newest first.
// Module-level (rather than a local inside option6()) so option 6 and the
// job-study variants (A/B/E) share the same data without option 6's own
// code changing.
const NOTES6 = [
  { author: 'Alex Morgan', role: 'staff', when: 'Thu 17 Sep · 12:10', text: 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' },
  { author: 'Jo Taylor', role: 'staff', when: 'Thu 17 Sep · 09:05', text: 'Bike booked in, tag printed.' },
  { author: 'Maya Patel', role: 'customer', when: 'Wed 16 Sep', sub: 'from her booking', text: 'My rear brake squeals and feels weak. The gears could use a tune-up too.' },
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

// ================= Job page study — Variants A, B, E =================
// docs/design/user-journeys/job-page-study.md draws Variants A ("Faithful
// Five"), B ("Compact strip + standalone notes + mini-table") and E ("Six,
// fixed"); C and D are dropped (they move away from the Citrus Lime
// structure / hide the parts list — not drawn here). Decision 33 overrides
// the study where they'd conflict: work and parts stays visible without
// opening anything, so B/E's mini-table always shows real rows, never a
// link-only row. Same example job, same title bar/customer strip shape as
// option 6 (mechanic shown as plain text, no select) — reused/duplicated
// below rather than importing option 5/6's private locals, since those are
// declared inside option5()/option6() and this file leaves both functions
// untouched.
//
// Labels here are held to a 12px floor throughout (the brief's constraint
// for these three boards) — one px above option 5/6's own 11px labels,
// which predate this brief and are left as they were built.
function studyTitleBar(titleId) {
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 13px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0"><h2 id="${titleId}" style="margin: 0; font-size: 18px; font-weight: 700">Standard service</h2>${badge('In workshop', 'blue')}</div>
<a href="#" aria-label="Close, back to the diary" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
// Customer strip — verbatim shape from option 6's custStrip6: account link,
// contact, bike, storage slot, "Mechanic: Alex Morgan" as plain text (no
// select — decision 32), three icon buttons.
function studyCustStrip() {
  const iconBtnS = (name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLinkS = `<a href="#" aria-label="View ${esc(JOB_CUSTOMER.name)}'s account" style="font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(JOB_CUSTOMER.name)}</a>`;
  return `<div style="flex-shrink: 0; box-sizing: border-box; padding: 9px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLinkS}<span>${esc(JOB_CUSTOMER.phone)}</span><span>${esc(JOB_CUSTOMER.email)}</span><span>Trek Domane AL 3 · green</span><span style="color: ${C.muted}">Kept on Hook 3</span><span>Mechanic: <strong>Alex Morgan</strong></span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtnS('inbox', 'Message Maya Patel')}${iconBtnS('mail', 'Email Maya Patel')}${iconBtnS('menu', 'Notes')}</div>
</div>`;
}
const studyFooter = () => dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
function studyFrame(titleId, bodyHtml) {
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${studyTitleBar(titleId)}${studyCustStrip()}${bodyHtml}${studyFooter()}
</div>
</div>
</div>`;
}
// Field helpers, 12px labels (the study/option 5's own selectField/
// staticField are 11px locals inside option5() — duplicated here at the
// 12px floor rather than reused, so option 5 stays untouched).
const selectFieldS = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 3px"><label for="${id}" style="font-size: 12px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><select id="${id}" style="width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>${esc(value)}</option></select></div>`;
const staticFieldS = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 1px"><label for="${id}" style="font-size: 12px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><div id="${id}" style="min-height: 20px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.bg}; display: flex; align-items: center; font-size: 13px; color: ${C.ink}">${esc(value)}</div></div>`;
const compactSelectS = (label, value, id) => `<div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 0">
<label for="${id}" style="font-size: 12px; font-weight: 600; color: ${C.muted}; flex-shrink: 0">${esc(label)}</label>
<select id="${id}" style="min-height: 44px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; color: ${C.ink}"><option>${esc(value)}</option></select>
</div>`;
const compactStaticS = (label, value) => `<div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 0">
<span style="font-size: 12px; font-weight: 600; color: ${C.muted}">${esc(label)}</span>
<span style="font-size: 13px; color: ${C.ink}">${esc(value)}</span>
</div>`;
// Notes composer — one row (input + Add button), as the study's own diagram
// draws it ("[Write a note…    ] [Add]"), not option 6's stacked
// textarea-then-button. The Add button keeps a ≥44px touch target.
const studyComposer = (id) => `<div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0">
<input id="${id}" type="text" placeholder="Write a note…" style="flex-grow: 1; box-sizing: border-box; min-height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">
${button('Add', { variant: 'accent' })}
</div>`;
// One feed entry, newest first — a compact line, not a bordered card (the
// study's own diagrams draw the feed as plain lines): meta row (author,
// time) then the note text. The customer's booking note carries a
// "Customer" badge plus a tinted left rule — two signals beyond the badge
// text itself, so it doesn't read as anonymous staff chatter.
function studyNoteLine(n) {
  const isCust = n.role === 'customer';
  return `<div style="display: flex; flex-direction: column; gap: 1px; ${isCust ? `border-left: 3px solid ${C.accent}; padding: 3px 8px; background: ${C.okBg}; border-radius: 4px;` : ''}">
<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
${isCust ? badge('Customer', 'green') : ''}
<span style="font-size: 13px; font-weight: 700; color: ${C.ink}">${esc(n.author)}</span>
<span style="font-size: 12px; color: ${C.muted}">${n.sub ? `${esc(n.sub)} · ` : ''}${esc(n.when)}</span>
</div>
<p style="margin: 0; font-size: 14px; line-height: 1.3; color: ${C.ink}">${esc(n.text)}</p>
</div>`;
}
// Full notes section, its own bordered region, flex-grow so it fills
// whatever height the fixed-size siblings (strip, checklist, mini-table)
// leave — the same technique option 6 already uses for its notes section.
function studyNotesSection(id) {
  const feed = NOTES6.map(studyNoteLine).join('');
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; overflow: hidden">
${eyebrow('Notes')}
${studyComposer(id)}
<div style="display: flex; flex-direction: column; gap: 3px; min-height: 0; overflow: hidden">${feed}</div>
</div>`;
}
const studyChecklistFold = () => {
  const checkedCount = CHECKLIST.filter((c) => c.checked).length;
  const notedCount = CHECKLIST.filter((c) => c.note).length;
  return foldSection('Checklist', { expanded: false, meta: `Standard service checklist · ${checkedCount} of ${CHECKLIST.length} done · ${notedCount} note` });
};
// Full work-and-parts table body (toolbar + table), the same columns as
// option 5's table — duplicated at 12px header labels (option 5's are 11px
// locals, left untouched) rather than reused.
const toolbarBtnS = (text, iconName) => `<button type="button" style="display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 12px; font-weight: 600">${icon(iconName, 12)}${esc(text)}</button>`;
const thS = (t, extra = '') => `<th style="text-align: left; font-size: 12px; font-weight: 700; color: ${C.muted}; padding: 1px 8px; border-bottom: 1px solid ${C.border}; line-height: 1.1; ${extra}">${esc(t)}</th>`;
const tdS = (inner, extra = '') => `<td style="padding: 1px 8px; font-size: 13px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; vertical-align: middle; line-height: 1.1; ${extra}">${inner}</td>`;
function fullWorkAndPartsBody() {
  const toolbar = row(`${toolbarBtnS('Add item', 'plus')}${toolbarBtnS('Scan barcode', 'search')}${toolbarBtnS('Print', 'reports')}`, 8);
  const rowsHtml = LINE_DETAILS.map((l) => {
    const declined = l.decision === 'Declined';
    const strike = declined ? `text-decoration: line-through; color: ${C.muted};` : '';
    return `<tr>
${tdS(mono(l.code || '—'))}
${tdS(`<span style="${strike}"><span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${C.muted}"> · ${esc(l.sub)}</span></span>`)}
${tdS(`<input type="checkbox" ${declined ? '' : 'checked'} aria-label="${esc(l.work)} done" style="width: 18px; height: 18px; accent-color: ${C.accent}">`, 'text-align: center')}
${tdS(l.work === 'Shimano brake pads' ? esc('Rear pads worn — replacing') : '—', `color: ${C.muted}`)}
${tdS(mono(l.qty))}
${tdS('—', `color: ${C.muted}`)}
${tdS(mono(`£${l.price.toFixed(2)}`, strike))}
${tdS(mono(`£${l.price.toFixed(2)}`, `font-weight: 600; ${strike}`))}
${tdS(declined ? badge('Declined', 'red') : badge('Approved', 'green'))}
</tr>`;
  }).join('');
  const totalRow = `<tr><td colspan="7" style="padding: 3px 8px; text-align: right; font-size: 13px; font-weight: 700">Approved total</td><td style="padding: 3px 8px">${mono(`£${APPROVED_TOTAL.toFixed(2)}`, 'font-weight: 700; font-size: 14px')}</td><td></td></tr>`;
  const table = `<table style="width: 100%; border-collapse: collapse">
<thead><tr>${thS('Code')}${thS('Work / part')}${thS('Done', 'text-align: center')}${thS('Note')}${thS('Qty')}${thS('In stock')}${thS('Price')}${thS('Total')}${thS('Customer approval')}</tr></thead>
<tbody>${rowsHtml}${totalRow}</tbody>
</table>`;
  return `${toolbar}${table}<p style="margin: 0; font-size: 12px; line-height: 1.2; color: ${C.muted}">${esc(DECLINED_NOTE)}</p>`;
}
// Mini work-and-parts table — decision 33 overrides the study here: real
// rows, always (2 of the 4 lines, both already done/approved), never a
// link-only row.
function miniWorkRows() {
  return LINE_DETAILS.slice(0, 2).map((l) => {
    const declined = l.decision === 'Declined';
    return row(`<span style="font-size: 14px; color: ${C.ink}; flex-grow: 1; min-width: 0">${esc(l.work)}</span><span style="font-size: 13px; color: ${declined ? C.danger : C.muted}; width: 64px; flex-shrink: 0">${declined ? 'Declined' : 'Done'}</span>${mono(`£${l.price.toFixed(2)}`, 'font-size: 13px; font-weight: 600; flex-shrink: 0; width: 60px; text-align: right')}`, 14);
  }).join('');
}
function miniWorkPanel() {
  const header = row(`${ghostBtn('Scan barcode', 'search')}${ghostBtn('Add item', 'plus')}<span style="flex-grow: 1"></span>${meta(`4 lines · £${APPROVED_TOTAL.toFixed(2)} · 1 declined`, 13)}`, 10);
  return panel(`${h2('Work and parts', 14)}${header}<div style="display: flex; flex-direction: column; gap: 2px">${miniWorkRows()}</div><div style="display: flex; justify-content: flex-end">${link('Show all rows')}</div>`, '', 8, 4);
}

// ---- Variant A: "Faithful Five" ----
// Option 5's card structure, minimally refined: no mechanic select (decision
// 32); the details card's right column becomes the notes box (composer +
// feed, customer's note last) instead of a tiny staff-notes field. Work and
// parts stays the full table, open by default, same as option 5 — this
// variant tests whether notes can grow inside the details card without
// shrinking the table.
function optionStudyA() {
  const jobMetaRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 10);
  const leftCol = `${selectFieldS('Status', 'In workshop', 'ja-status')}
${grid('1fr 1fr', `${staticFieldS('Diary time', 'Thu 17 Sep · 11:30–13:00', 'ja-time')}${staticFieldS('Ready by', 'Fri 18 Sep', 'ja-ready')}`, 12)}
<div style="display: flex; gap: 24px; flex-wrap: wrap">${checkRow('Bike is here', true, 'ja-here')}${checkRow('New bike build', false, 'ja-newbuild')}</div>`;
  const notesFeed = NOTES6.map(studyNoteLine).join('');
  const rightCol = `${eyebrow('Notes')}${studyComposer('ja-note')}<div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${notesFeed}</div>`;
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${leftCol}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${rightCol}</div>`, 24);
  const jobSection = panel(`${jobMetaRow}${jobBody}`, '', 10, 6);
  const workSection = foldSection('Work and parts', { expanded: true, body: fullWorkAndPartsBody(), grow: false });
  const body = dialogBody(`${jobSection}${workSection}${studyChecklistFold()}`, 6, 4);
  return studyFrame('job-study-a-title', body);
}

// ---- Variant B: "Compact strip + standalone notes + mini-table" ----
// A genuinely compact single-purpose strip (one row: status/ticks left,
// diary time pinned right, so nothing wedges between labels); notes as
// their own full-width section, the biggest region on the page; work and
// parts as a real mini-table (decision 33) directly under notes, checklist
// folded last.
function jobStripB() {
  const topRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 12);
  const bottomRow = row(`${compactSelectS('Status', 'In workshop', 'jb-status')}${checkRow('Bike is here', true, 'jb-here')}${checkRow('New bike build', false, 'jb-newbuild')}<span style="flex-grow: 1"></span>${compactStaticS('Diary', 'Thu 17 Sep · 11:30–13:00')}`, 22, 'flex-wrap: wrap');
  return `<div style="flex-shrink: 0; box-sizing: border-box; padding: 6px 16px; display: flex; flex-direction: column; gap: 3px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}">${topRow}${bottomRow}</div>`;
}
function optionStudyB() {
  const body = dialogBody(`${jobStripB()}${studyNotesSection('jb-note')}${miniWorkPanel()}${studyChecklistFold()}`, 8, 6);
  return studyFrame('job-study-b-title', body);
}

// ---- Variant E: "Six, fixed" ----
// Option 6's original stack shape and section order (details → notes →
// checklist → work), repaired: a breathing two-row-plus-diary-line strip
// (not option 6's cramped single row), and a real mini-table for work and
// parts (decision 33) instead of option 6's link-only fold. Content is
// close to Variant B; the difference under test is ordering (checklist
// above work here, work directly under notes in B).
function jobStripE() {
  const topRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 12);
  const midRow = row(`${compactSelectS('Status', 'In workshop', 'je-status')}${checkRow('Bike is here', true, 'je-here')}${checkRow('New bike build', false, 'je-newbuild')}`, 22, 'flex-wrap: wrap');
  const diaryRow = `<div style="display: flex; justify-content: flex-end"><span style="font-size: 13px; color: ${C.muted}">Diary: Thu 17 Sep · 11:30–13:00</span></div>`;
  return `<div style="flex-shrink: 0; box-sizing: border-box; padding: 6px 16px; display: flex; flex-direction: column; gap: 2px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}">${topRow}${midRow}${diaryRow}</div>`;
}
function optionStudyE() {
  const body = dialogBody(`${jobStripE()}${studyNotesSection('je-note')}${studyChecklistFold()}${miniWorkPanel()}`, 8, 6);
  return studyFrame('job-study-e-title', body);
}

// ================= job-final: "Job page · final (in the workshop)" =================
// Decision 34: variant A ("Faithful Five"), with every §7.3 refinement from
// docs/design/user-journeys/job-page-study.md applied and every §7.2 defect
// fixed. Built from optionStudyA()'s shape — job-study-a itself is left
// untouched; everything below is new, dedicated to this one board, so fixing
// job-final never risks changing how the study boards render.
//
// §7.3 refinements applied here (numbers match the study doc):
// 1. "Work and parts" heading has no chevron — plainFinalSection() below has
//    no disclosure affordance at all, unlike foldSection().
// 2. Notes column: a real 15px section heading (not an 11px form caption), a
//    left accent border + tint so it reads as a feature, and it's naturally
//    the tallest block in the details card once the composer and dividers
//    are sized properly (no forced height hack needed).
// 3. Notes feed is newest-first with no exception; the customer's note is
//    genuinely oldest and sits last, but a date divider ("Thu 17 Sep" /
//    "Wed 16 Sep") makes that read as a day boundary, not a sort bug.
// 4. Declined row strikes the Total column only, not Price.
// 5. Touch targets: Add note, Add item/Scan barcode/Print, the two ticks,
//    Status select, footer buttons and the customer strip's icon buttons are
//    all ≥44px tall. (The dense work-and-parts table's own per-line "Done"
//    checkboxes are the one exception — refinement 8 says keep that table
//    "exactly as drawn", and neither §7.2's defect list nor §7.3's touch-
//    target list mentions those cells; they stay small and dense, as a real
//    Citrus Lime-style table does. Reported separately in the measurement.)
// 6. The bottom space freed by the old chevron/undersized controls goes on
//    the bigger notes composer, the taller icon buttons and dividers, rather
//    than sitting empty — a deliberate choice, not leftover gap.
// 7. Left column unchanged: Status select, Diary time, Ready by, the two
//    ticks — no mechanic field.
// 8. The full 8-column work-and-parts table is kept exactly as drawn.
const dateDivider = (label) => `<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; line-height: 1.1">
<span style="font-size: 12px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0">${esc(label)}</span>
<span style="flex-grow: 1; height: 1px; background: ${C.border}"></span>
</div>`;
// Groups NOTES6 (already newest-first) by its date label, so consecutive
// same-day notes sit under one divider and the customer's older note gets
// its own "Wed 16 Sep" divider — visible day grouping instead of an
// apparent sort bug (§7.2/§7.3 point 3).
function groupNotesByDate(notes) {
  const groups = [];
  for (const n of notes) {
    const dateLabel = n.when.split(' · ')[0];
    const last = groups[groups.length - 1];
    if (last && last.date === dateLabel) last.items.push(n);
    else groups.push({ date: dateLabel, items: [n] });
  }
  return groups;
}
// Only the date *boundary* needs a divider — today's notes at the top don't
// need one (there's nothing above them to distinguish from), so the first
// group renders without one and only the day change before the customer's
// older booking note gets the "Wed 16 Sep" divider (§7.2/§7.3 point 3).
function finalNotesFeed() {
  return groupNotesByDate(NOTES6).map((g, i) => `${i > 0 ? dateDivider(g.date) : ''}${g.items.map(studyNoteLine).join('')}`).join('');
}
// Roomy composer — a 2-row textarea, not the single-line input
// studyComposer uses, sat inline next to the Add note button (which keeps
// its own ≥44px touch target via button()'s default) so the composer's
// extra height comes only from the textarea growing to 2 visible lines, not
// from stacking the button underneath it.
const finalComposer = (id) => `<div style="display: flex; align-items: stretch; gap: 8px; flex-shrink: 0">
<textarea id="${id}" rows="2" placeholder="Write a note…" style="flex-grow: 1; box-sizing: border-box; resize: none; min-height: 44px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; line-height: 1.2"></textarea>
<div style="display: flex; align-items: flex-end; flex-shrink: 0">${button('Add note', { variant: 'accent' })}</div>
</div>`;
// Notes column with real visual weight: 15px heading (matches "Checklist"/
// "Work and parts" heading size, not a small form caption), a left accent
// border and a tint background so it reads as a feature of the page.
function finalNotesColumn(id) {
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-left: 4px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 5px 14px; display: flex; flex-direction: column; gap: 3px; overflow: hidden">
${h2('Notes', 15)}
${finalComposer(id)}
<div style="display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow: hidden">${finalNotesFeed()}</div>
</div>`;
}
// Section heading with no fold affordance at all (§7.3 point 1) — same
// visual weight as foldSection()'s header (15px title, meta, tags on the
// right) but never a chevron, because this table never folds.
function plainFinalSection(title, { meta = '', tags = '', body = '', grow = false } = {}) {
  const header = `<div style="box-sizing: border-box; min-height: 24px; padding: 2px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap">${h2(title, 15)}${meta ? `<span style="font-size: 12px; color: ${C.muted}">${meta}</span>` : ''}</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap">${tags}</div>
</div>`;
  const boxStyle = `${grow ? 'flex-grow: 1;' : 'flex-shrink: 0;'} min-height: 0; display: flex; flex-direction: column; overflow: hidden;`;
  return `<div style="box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}; ${boxStyle}">
${header}
<div style="box-sizing: border-box; padding: 4px 14px; ${grow ? 'flex-grow: 1;' : ''} min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 3px">${body}</div>
</div>`;
}
// Full work-and-parts table, kept exactly as drawn (decision 33/refinement
// 8) — code, work/part, done, note, qty, in stock, price, total, approval —
// with two fixes only: the toolbar buttons are ≥44px (ghostBtn, already used
// elsewhere in this file) instead of the tiny 24px toolbar buttons, and the
// declined row strikes the Total column only, not Price (§7.2/§7.3 point 4).
// Body text is 14px throughout (was 13px) to clear the ≥14px floor; the
// dense per-line "Done" checkboxes are left at their native size — see the
// comment above this section for why.
function finalWorkAndPartsBody() {
  const toolbar = row(`${ghostBtn('Add item', 'plus')}${ghostBtn('Scan barcode', 'search')}${ghostBtn('Print', 'reports')}`, 8);
  const thF = (t, extra = '') => `<th style="text-align: left; font-size: 12px; font-weight: 700; color: ${C.muted}; padding: 1px 10px; border-bottom: 1px solid ${C.border}; line-height: 1.05; ${extra}">${esc(t)}</th>`;
  const tdF = (inner, extra = '') => `<td style="padding: 1px 10px; font-size: 14px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; vertical-align: middle; line-height: 1.05; ${extra}">${inner}</td>`;
  const rowsHtml = LINE_DETAILS.map((l) => {
    const declined = l.decision === 'Declined';
    const totalStrike = declined ? `text-decoration: line-through; color: ${C.muted};` : '';
    return `<tr>
${tdF(mono(l.code || '—'))}
${tdF(`<span><span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${C.muted}"> · ${esc(l.sub)}</span></span>`)}
${tdF(`<input type="checkbox" ${declined ? '' : 'checked'} aria-label="${esc(l.work)} done" style="width: 18px; height: 18px; accent-color: ${C.accent}">`, 'text-align: center')}
${tdF(l.work === 'Shimano brake pads' ? esc('Rear pads worn — replacing') : '—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(l.qty))}
${tdF('—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(`£${l.price.toFixed(2)}`))}
${tdF(mono(`£${l.price.toFixed(2)}`, `font-weight: 600; ${totalStrike}`))}
${tdF(declined ? badge('Declined', 'red') : badge('Approved', 'green'))}
</tr>`;
  }).join('');
  const totalRow = `<tr><td colspan="7" style="padding: 3px 10px; text-align: right; font-size: 14px; font-weight: 700">Approved total</td><td style="padding: 3px 10px">${mono(`£${APPROVED_TOTAL.toFixed(2)}`, 'font-weight: 700; font-size: 15px')}</td><td></td></tr>`;
  const table = `<table style="width: 100%; border-collapse: collapse">
<thead><tr>${thF('Code')}${thF('Work / part')}${thF('Done', 'text-align: center')}${thF('Note')}${thF('Qty')}${thF('In stock')}${thF('Price')}${thF('Total')}${thF('Customer approval')}</tr></thead>
<tbody>${rowsHtml}${totalRow}</tbody>
</table>`;
  return `${toolbar}${table}<p style="margin: 0; font-size: 12px; line-height: 1.3; color: ${C.muted}">${esc(DECLINED_NOTE)}</p>`;
}
// Title bar and customer strip, dedicated to job-final: identical in
// substance to studyTitleBar()/studyCustStrip() (option 6's shape, mechanic
// shown as plain text per decision 32) but the close button and the three
// customer-strip icon buttons are 44×44, not 40×40 (§7.3 point 5's touch
// floor applies to every control a mechanic presses, including these).
function finalTitleBar(titleId) {
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 9px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0"><h2 id="${titleId}" style="margin: 0; font-size: 18px; font-weight: 700">Standard service</h2>${badge('In workshop', 'blue')}</div>
<a href="#" aria-label="Close, back to the diary" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
function finalCustStrip() {
  const iconBtnF = (name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLinkF = `<a href="#" aria-label="View ${esc(JOB_CUSTOMER.name)}'s account" style="font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(JOB_CUSTOMER.name)}</a>`;
  return `<div style="flex-shrink: 0; box-sizing: border-box; padding: 5px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLinkF}<span>${esc(JOB_CUSTOMER.phone)}</span><span>${esc(JOB_CUSTOMER.email)}</span><span>Trek Domane AL 3 · green</span><span style="color: ${C.muted}">Kept on Hook 3</span><span>Mechanic: <strong>Alex Morgan</strong></span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtnF('inbox', 'Message Maya Patel')}${iconBtnF('mail', 'Email Maya Patel')}${iconBtnF('menu', 'Notes')}</div>
</div>`;
}
function optionJobFinal() {
  const jobMetaRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 10);
  const leftCol = `${selectFieldS('Status', 'In workshop', 'jf-status')}
${grid('1fr 1fr', `${staticFieldS('Diary time', 'Thu 17 Sep · 11:30–13:00', 'jf-time')}${staticFieldS('Ready by', 'Fri 18 Sep', 'jf-ready')}`, 12)}
<div style="display: flex; gap: 24px; flex-wrap: wrap">${checkRow('Bike is here', true, 'jf-here')}${checkRow('New bike build', false, 'jf-newbuild')}</div>`;
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${leftCol}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${finalNotesColumn('jf-note')}</div>`, 24);
  const jobSection = panel(`${jobMetaRow}${jobBody}`, '', 5, 3);
  const workSection = plainFinalSection('Work and parts', { body: finalWorkAndPartsBody(), grow: false });
  const body = dialogBody(`${jobSection}${workSection}${studyChecklistFold()}`, 4, 3);
  const footer = dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-final-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${finalTitleBar('job-final-title')}${finalCustStrip()}${body}${footer}
</div>
</div>
</div>`;
}

// ================= job-final-stages: §7.4 as a plain table =================
// A companion board, not part of the pop-up study — a plain-English read of
// docs/design/user-journeys/job-page-study.md §7.4 ("How Variant A adapts at
// the other stages"), for Jack to check against the job-final layout without
// re-reading the markdown table.
const STAGE_TABLE = [
  { stage: 'Expected', strip: 'Ticks ("Bike is here", "New bike build") are the live controls staff are about to use', notes: 'As drawn, usually just the customer’s booking note so far', checklist: 'Folded, "0 of 10 done"', work: 'Empty state: "No items yet — Add item"', footer: '"Book in"' },
  { stage: 'Booked in', strip: '"Bike is here" gets ticked here', notes: 'As drawn', checklist: 'Unfolds by default until the first tick lands, then folds again', work: 'Table starts populating as work is agreed', footer: '"Send quote" / "Start work"' },
  { stage: 'Quoting / awaiting approval', strip: 'Unchanged', notes: 'Staff notes about the quote conversation likely appear here', checklist: 'Folded', work: 'Table shows proposed lines with a pending-approval badge instead of "Approved"', footer: '"Send quote", or a static "Awaiting approval" state' },
  { stage: 'In the workshop', strip: 'As drawn (worked example)', notes: 'As drawn — heaviest use', checklist: 'Folded, live progress count', work: 'Full table open, as drawn', footer: '"Mark ready for collection"' },
  { stage: 'Waiting for parts', strip: 'Unchanged', notes: 'A note about what’s on order is common here', checklist: 'Folded', work: 'Table shows an "on order" badge on the affected line', footer: '"Mark ready for collection", disabled with a reason' },
  { stage: 'Finished', strip: 'Unchanged', notes: 'As drawn', checklist: 'Folded, "10 of 10 done"', work: 'Table stays open — everything’s done, worth showing', footer: '"Take payment"' },
  { stage: 'Collection / payment', strip: 'Unchanged', notes: 'As drawn', checklist: 'Folded', work: 'Table stays open', footer: '"Take payment" / "Complete job"' },
];
function jobFinalStagesBoard() {
  const cols = ['Stage', 'Job details strip', 'Notes', 'Checklist', 'Work and parts', 'Footer'];
  const thG = (t) => `<th style="text-align: left; font-size: 12px; font-weight: 700; color: ${C.muted}; padding: 6px 10px; border-bottom: 2px solid ${C.border}; text-transform: uppercase; letter-spacing: 0.3px">${esc(t)}</th>`;
  const tdG = (t, bold = false) => `<td style="text-align: left; font-size: 14px; line-height: 1.4; color: ${C.ink}; padding: 10px; border-bottom: 1px solid ${C.border}; vertical-align: top; ${bold ? 'font-weight: 700' : ''}">${esc(t)}</td>`;
  const rowsHtml = STAGE_TABLE.map((r) => `<tr>${tdG(r.stage, true)}${tdG(r.strip)}${tdG(r.notes)}${tdG(r.checklist)}${tdG(r.work)}${tdG(r.footer)}</tr>`).join('');
  const table = `<table style="width: 100%; border-collapse: collapse; table-layout: fixed">
<colgroup><col style="width: 13%"><col style="width: 17%"><col style="width: 17%"><col style="width: 17%"><col style="width: 19%"><col style="width: 17%"></colgroup>
<thead><tr>${cols.map(thG).join('')}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>`;
  return `<div style="width: ${DW}px; height: ${DH}px; box-sizing: border-box; padding: 26px 40px; background: ${C.bg}; display: flex; flex-direction: column; gap: 12px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: ${C.accent}">JOB PAGE — FINAL</div>
<h1 style="margin: 0; font-size: 22px; font-weight: 700">How the job page changes at each stage</h1>
<p style="margin: 0; font-size: 13px; color: ${C.muted}; max-width: 1050px">Plain-English version of study §7.4. The layout is always the same page (job-final); only these bits change as a job moves through the workshop. "In the workshop" is the worked example on the job-final board.</p>
</div>
<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 12px; padding: 4px 12px">${table}</div>
</div>`;
}

// ================= job-final-2: notes turned into one big text box =================
// Decisions 35/36 (28 Sep): the job page has three parts — information,
// notes, work and parts — and the notes are "one big text box holding
// everything, with the checklist incorporated into it" rather than a
// composer-plus-feed. Jack's own description of the box: one text area
// where everything typed so far can be edited, with a "Detailed notes"
// section that opens from inside it to hold the checklist. Built from
// optionJobFinal()'s code (job-final itself is left untouched) — same
// title bar, customer strip, job details strip, full work-and-parts table
// and footer; only the notes column changes, and the old folded
// "Checklist" row is removed (superseded — the checklist now lives inside
// Detailed notes, decision 35).
//
// Order inside the box is oldest-first (a document you add to at the
// bottom), the opposite of job-final's newest-first feed: the customer's
// booking note reads first, then staff paragraphs in the order they were
// written, then room to keep typing — matching "you can edit everything
// that's been typed previously... then space to keep typing" (Jack).
const NOTES_CHRONO = [...NOTES6].reverse();
// One paragraph of the notes box. The customer's words get a small
// "Customer · from her booking, <date>" label plus a light tint band and
// left rule, so they read as quoted material inside an otherwise plain
// document, not as an anonymous line. Staff paragraphs get a small muted
// "<name> · <day> <time> — " stamp inline before the text, the way a real
// note-taking app auto-stamps what you write (decision 36's "who and
// when").
function bigNoteParagraph(n) {
  return `<p style="margin: 0; font-size: 14px; line-height: 1.45; color: ${C.ink}">${esc(n.text)}</p>`;
}
// Decision 38: a customer section at the top of the box, closed off by an
// underline. It holds the customer's words from their booking and is still
// editable, so staff can add what the customer explains in the shop. Below
// the line the job's notes are plain text — no name/time stamps.
function bigNoteBody() {
  const customer = NOTES_CHRONO.filter((n) => n.role === 'customer');
  const staff = NOTES_CHRONO.filter((n) => n.role !== 'customer');
  const placeholder = (t) => `<div style="display: flex; align-items: center; gap: 6px; min-height: 14px"><span style="width: 2px; height: 14px; background: ${C.ink}; opacity: 0.45"></span><span style="font-size: 13px; color: ${C.muted}">${t}</span></div>`;
  const customerSection = `<div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 2px solid ${C.input}">
<span style="font-size: 12px; font-weight: 700; color: ${C.accentDark}">From the customer</span>
${customer.map(bigNoteParagraph).join('')}
<span style="font-size: 13px; color: ${C.muted}">Add anything else they tell you in the shop…</span>
</div>`;
  return `${customerSection}${staff.map(bigNoteParagraph).join('')}${placeholder('Keep typing…')}`;
}
// "Detailed notes" button + summary — a clear control at the box's bottom
// edge that opens the checklist section from inside the notes box
// (decision 36). Sized as a full-width ≥44px row so it reads as one clear
// control, not a small link.
function detailedNotesButton(checkedCount, totalCount, notedCount) {
  const chev = `<span style="display: inline-flex; flex-shrink: 0; transform: rotate(-90deg); color: ${C.muted}">${icon('chevron', 16)}</span>`;
  return `<button type="button" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box; min-height: 44px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; text-align: left">
<span style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700">${chev}Detailed notes</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(`Standard service checklist · ${checkedCount} of ${totalCount} done · ${notedCount} note${notedCount === 1 ? '' : 's'}`)}</span>
</button>`;
}
// Notes column — same card shape as job-final's finalNotesColumn (heading
// keeps its visual weight, left accent border, tint background) but the
// composer+feed is replaced with the single bordered text box, the
// Detailed notes button and a quiet hint about auto-stamping.
function bigNotesColumn(checkedCount, totalCount, notedCount) {
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-left: 4px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 3px 14px; display: flex; flex-direction: column; gap: 3px; overflow: hidden">
${h2('Notes', 15)}
<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; padding: 7px 14px; display: flex; flex-direction: column; gap: 6px; overflow: hidden">${bigNoteBody()}</div>
${detailedNotesButton(checkedCount, totalCount, notedCount)}
</div>`;
}
function optionJobFinal2() {
  const checkedCount2 = CHECKLIST.filter((c) => c.checked).length;
  const notedCount2 = CHECKLIST.filter((c) => c.note).length;
  const jobMetaRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 10);
  const leftCol = `${selectFieldS('Status', 'In workshop', 'jf2-status')}
${grid('1fr 1fr', `${staticFieldS('Diary time', 'Thu 17 Sep · 11:30–13:00', 'jf2-time')}${staticFieldS('Ready by', 'Fri 18 Sep', 'jf2-ready')}`, 12)}
<div style="display: flex; gap: 24px; flex-wrap: wrap">${checkRow('Bike is here', true, 'jf2-here')}${checkRow('New bike build', false, 'jf2-newbuild')}</div>`;
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${leftCol}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${bigNotesColumn(checkedCount2, CHECKLIST.length, notedCount2)}</div>`, 24);
  const jobSection = panel(`${jobMetaRow}${jobBody}`, '', 5, 3);
  const workSection = plainFinalSection('Work and parts', { body: finalWorkAndPartsBody(), grow: false });
  const body = dialogBody(`${jobSection}${workSection}`, 4, 3);
  const footer = dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-final-2-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${finalTitleBar('job-final-2-title')}${finalCustStrip()}${body}${footer}
</div>
</div>
</div>`;
}

// ================= job-final-2-detailed: Detailed notes open =================
// Same job page as job-final-2, with Detailed notes opened, on the job
// page (decision 36: "It opens on the job page (no separate page)"). The
// notes box expands in place to show the checklist — the pattern chosen
// over a sliding sheet — because it needed no extra chrome (no overlay, no
// second close affordance) and decision 33's floor ("work and parts stay
// visible") is easy to clear outright: the left details column, the full
// title bar/customer strip, the *entire* work-and-parts table (not just
// its header) and the footer all stay exactly where they were on
// job-final-2 — only the notes card's own content swaps from the text box
// to the checklist. A sliding sheet was the other option on the table, but
// it would need to cover the same area to fit two columns of ten items
// with note fields, so it bought nothing beyond an extra "open" transition
// to reason about.
//
// Ten rows fit three columns without scrolling; a note field is only drawn
// where a note exists (the brakes item, decision 21/33's worked example) —
// everywhere else is a muted "Customer sees: All working well" for a plain
// tick, or "+ Add note" for the two unticked items, both sat on the same
// 44px row as the tick rather than a wrapped line underneath — so nine
// empty note fields never compete for the tight budget the one real note
// needs. Three columns, not two: the budget here is the same one
// bigNotesColumn used on job-final-2 (the notes card can only be as tall
// as the notes box it replaces, since the title bar, customer strip, full
// work-and-parts table and footer around it are all unchanged), and two
// columns of five put the brakes item's wrapped note text in a column too
// narrow to read comfortably; three columns of three or four keeps every
// column shallow enough to fit, and gives the one real note a wrapped
// two-line field rather than a single-line truncation (a truncated note a
// mechanic can't read isn't a usable "note field").
function detailedChecklistItem(it, id) {
  const tick = `<input id="${id}" type="checkbox"${it.checked ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0">`;
  if (it.note) {
    return `<div style="display: flex; flex-direction: column; gap: 2px">
<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer">${tick}<span style="font-size: 14px; color: ${C.ink}">${esc(it.t)}</span></label>
<div style="box-sizing: border-box; padding-left: 30px"><textarea id="${id}-note" rows="3" style="box-sizing: border-box; width: 100%; resize: none; padding: 3px 8px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 12px; color: ${C.ink}; line-height: 1.25">${esc(it.note)}</textarea></div>
</div>`;
  }
  if (it.checked) {
    // Narrower 3-up columns don't leave room for the full caption on the
    // same line as a longer item label ("Cables & housing", "Bolts
    // torqued"), so it sits on its own (short) line under the tick instead
    // of forcing a wrap mid-row.
    return `<div style="display: flex; flex-direction: column">
<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer">${tick}<span style="font-size: 14px; color: ${C.ink}">${esc(it.t)}</span></label>
<div style="padding-left: 30px; margin-top: -6px"><span style="font-size: 12px; color: ${C.muted}">Customer sees: All working well</span></div>
</div>`;
  }
  // "+ Add note" is a real control here (it opens a note field), so it
  // gets its own ≥44px hit area — a plain-text button sized to match the
  // row height it sits in, not the small text link the other (unopened)
  // study boards use for the same affordance.
  const addNoteBtn = `<button type="button" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0; border: none; background: transparent; color: ${C.accentDark}; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer">+ Add note</button>`;
  return `<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer">${tick}<span style="font-size: 14px; color: ${C.ink}; flex-shrink: 0">${esc(it.t)}</span><span style="flex-grow: 1"></span>${addNoteBtn}</label>`;
}
function detailedNotesColumn() {
  // Uneven groups (not a plain 4/3/3 slice of the list in order) so the
  // one item with a real note — the tallest row on the board — lands in a
  // column with fewer, shorter neighbours, keeping every column's total
  // height inside the same budget the notes box used on job-final-2.
  const cols = [[3, 0, 1], [2, 4, 5], [6, 7, 8, 9]];
  const colHtml = (indexes) => `<div style="display: flex; flex-direction: column">${indexes.map((idx) => detailedChecklistItem(CHECKLIST[idx], `jf2d-${idx}`)).join('')}</div>`;
  const header = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">
<div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap">${h2('Detailed notes', 15)}<span style="font-size: 12px; color: ${C.muted}">Standard service checklist</span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${button('Back to notes', { variant: 'default' })}${button('Done', { variant: 'accent' })}</div>
</div>`;
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-left: 4px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 2px 14px; display: flex; flex-direction: column; gap: 2px; overflow: hidden">
${header}
<div style="flex-grow: 1; min-height: 0; overflow: hidden">${grid('repeat(3, 1fr)', cols.map(colHtml).join(''), 20)}</div>
</div>`;
}
function optionJobFinal2Detailed() {
  const jobMetaRow = row(`${mono('WH-1042', 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">Created Thu 17 Sep · by Jo Taylor</span><span style="flex-grow: 1"></span>${badge('Ready by Fri 18 Sep', 'grey')}${badge(`Approved £${APPROVED_TOTAL.toFixed(2)}`, 'green')}`, 10);
  const leftCol = `${selectFieldS('Status', 'In workshop', 'jf2d-status')}
${grid('1fr 1fr', `${staticFieldS('Diary time', 'Thu 17 Sep · 11:30–13:00', 'jf2d-time')}${staticFieldS('Ready by', 'Fri 18 Sep', 'jf2d-ready')}`, 12)}
<div style="display: flex; gap: 24px; flex-wrap: wrap">${checkRow('Bike is here', true, 'jf2d-here')}${checkRow('New bike build', false, 'jf2d-newbuild')}</div>`;
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${leftCol}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${detailedNotesColumn()}</div>`, 24);
  const jobSection = panel(`${jobMetaRow}${jobBody}`, '', 5, 3);
  const workSection = plainFinalSection('Work and parts', { body: finalWorkAndPartsBody(), grow: false });
  const body = dialogBody(`${jobSection}${workSection}`, 4, 3);
  const footer = dialogFooter(`${button('Unschedule', { variant: 'danger' })}<span style="flex-grow: 1"></span>${button('Mark ready for collection', { variant: 'primary' })}`);
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shellDesktop('diary', 'Workshop diary', `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: ${C.muted}; font-size: 13px">Workshop diary</div>`)}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: ${DIALOG_PAD}px">
<div role="dialog" aria-modal="true" aria-labelledby="job-final-2-detailed-title" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${finalTitleBar('job-final-2-detailed-title')}${finalCustStrip()}${body}${footer}
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
  { id: 'job-study-a', title: 'Study A · Faithful Five', html: optionStudyA() },
  { id: 'job-study-b', title: 'Study B · Compact strip, notes, mini-table', html: optionStudyB() },
  { id: 'job-study-e', title: 'Study E · Six, fixed', html: optionStudyE() },
  { id: 'job-final', title: 'Job page · final (in the workshop)', html: optionJobFinal() },
  { id: 'job-final-stages', title: 'Job page · final, how it adapts by stage', html: jobFinalStagesBoard() },
  { id: 'job-final-2', title: 'Job page · notes box', html: optionJobFinal2() },
  { id: 'job-final-2-detailed', title: 'Job page · detailed notes open', html: optionJobFinal2Detailed() },
];
