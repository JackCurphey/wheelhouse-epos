// Shared "job page" building blocks — the settled design (decision 40, 28
// Sep 2026 round): board job-final-2 in job-options.mjs (title bar, customer
// strip with Mechanic, compact job details, notes box with a "From the
// customer" section + underline + plain notes, the "Full service checklist"
// bar, full work-and-parts table, footer) and job-final-2-detailed (the Full
// service checklist full-screen pop-up).
//
// Both job-options.mjs (job-final-2 / job-final-2-detailed, unchanged
// rendering, fixed example data) and diary.mjs (the seven per-stage job
// boards + job-checklist, stage-varying data) import from here instead of
// each other, so neither file needs to depend on the other's internals.
// This module only depends on ui.mjs — no circular import.
import { C, MONO, FONT_DISPLAY, THEME, esc, icon, button, badge, card } from './ui.mjs';

// Only declared under Sand (empty string under Fjell) so job-options.mjs's
// build (always default theme, no --theme flag) emits byte-identical HTML —
// under Fjell, FONT_DISPLAY equals the inherited body font anyway, so
// declaring it explicitly would be a no-op visually but not byte-for-byte.
const DISPLAY_FONT_STYLE = THEME === 'sand' ? `font-family: ${FONT_DISPLAY}; ` : '';

// ---------- small layout helpers (as job-options.mjs's copies) ----------
export const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
export const h2 = (t, size = 16) => `<h2 style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: ${size}px; line-height: 1.3; font-weight: 700">${esc(t)}</h2>`;
export const panel = (inner, extra = '', pad = 16, gap = 10) => card(`<div style="padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px; box-sizing: border-box; min-height: 0">${inner}</div>`, `box-sizing: border-box; ${extra}`);
export const row = (inner, gap = 12, extra = '') => `<div style="display: flex; align-items: center; gap: ${gap}px; ${extra}">${inner}</div>`;
export const grid = (cols, inner, gap = 16, extra = '') => `<div style="display: grid; grid-template-columns: ${cols}; gap: ${gap}px; align-items: start; min-height: 0; ${extra}">${inner}</div>`;
const ghostBtn = (text, iconName, extra = '') => `<button type="button" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 13px; font-weight: 600; ${extra}">${icon(iconName, 16)}${esc(text)}</button>`;
export const checkRow = (label, checked, id, sub = '', bordered = false, minH = 44) => `<div style="display: flex; flex-direction: column; ${bordered ? `border-top: 1px solid ${C.border};` : ''}">
<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: ${minH}px; cursor: pointer">
<input id="${id}" type="checkbox"${checked ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0">
<span style="font-size: 14px; color: ${C.ink}">${esc(label)}</span>
</label>
${sub ? `<div style="padding-left: 30px">${sub}</div>` : ''}
</div>`;
// Clickable toggle pill (decision 50, 28 Sep 2026): a real button with
// aria-pressed, not a tick box — filled in the primary ink with light text
// and a small check icon when on; outlined with muted text when off. Used
// for "Bike is here" on the job page and, for consistency, both "The bike is
// here now" and "New bike build or pre-delivery check" on the New job form.
export const togglePill = (label, on, id, extra = '') => `<button type="button" id="${id}" aria-pressed="${on ? 'true' : 'false'}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${extra}">${on ? icon('check', 15, C.panel) : ''}${esc(label)}</button>`;

export const selectFieldS = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 3px"><label for="${id}" style="font-size: 12px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><select id="${id}" style="width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"><option>${esc(value)}</option></select></div>`;
export const staticFieldS = (label, value, id) => `<div style="display: flex; flex-direction: column; gap: 1px"><label for="${id}" style="font-size: 12px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><div id="${id}" style="min-height: 20px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.bg}; display: flex; align-items: center; font-size: 13px; color: ${C.ink}">${esc(value)}</div></div>`;

export const dialogBody = (inner, pad = 4, gap = 3) => `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
// Vertical padding trimmed to 6px (from 10px, S2/decision 58 follow-up): the
// footer's own 44px buttons set its floor, same reasoning as
// finalTitleBar/finalCustStripTwoRow above — reclaiming the two-row header's
// extra ~25px without shrinking anything a mechanic reads or taps.
export const dialogFooter = (inner) => `<div style="flex-shrink: 0; box-sizing: border-box; padding: 6px 22px; border-top: 1px solid ${C.border}; display: flex; align-items: center; gap: 12px; background: ${C.panel}">${inner}</div>`;

// ---------- title bar / customer strip ----------
// jobTitle/status/tone parameterised (job-options.mjs calls this with the
// fixed "Standard service"/"In workshop"/"blue" — same output as before).
export function finalTitleBar(titleId, jobTitle, status, tone, closeHref = '#') {
  // Vertical padding trimmed to 4px (from 9px): the 44px close button, not
  // the padding, sets this header's floor, so the extra padding was pure
  // slack — reclaimed here (and in finalCustStrip below) to make room for
  // H3's taller "Done" touch targets without any board needing to scroll.
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 4px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0"><h2 id="${titleId}" style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 18px; font-weight: 700">${esc(jobTitle)}</h2>${badge(status, tone)}</div>
<a href="${closeHref}" aria-label="Close, back to the diary" title="Close" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</header>`;
}
// customer: { name, phone, email, bike, storageSlot }; mechanicName: plain
// text (decision 32 — no mechanic select); custHref: the account link.
export function finalCustStrip(customer, mechanicName, custHref = '#') {
  // M6 (29 Sep audit): these three icon-only buttons had an aria-label for
  // screen readers but nothing a sighted mouse user hovering would see — the
  // inbox-tray and envelope icons in particular are similar enough to
  // hesitate over. Added `title` (a native browser tooltip) alongside the
  // existing aria-label, same text.
  const iconBtnF = (name, label) => `<button type="button" aria-label="${esc(label)}" title="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLinkF = `<a href="${custHref}" aria-label="View ${esc(customer.name)}'s account" style="font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(customer.name)}</a>`;
  return `<div style="flex-shrink: 0; box-sizing: border-box; padding: 2px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLinkF}<span>${esc(customer.phone)}</span><span>${esc(customer.email)}</span><span>${esc(customer.bike)}</span>${customer.storageSlot ? `<span style="color: ${C.muted}">Kept on ${esc(customer.storageSlot)}</span>` : ''}<span>Mechanic: <strong>${esc(mechanicName)}</strong></span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtnF('inbox', `Message ${esc(customer.name)}`)}${iconBtnF('mail', `Email ${esc(customer.name)}`)}${iconBtnF('menu', 'Notes')}</div>
</div>`;
}

// M1/S2 (29 Sep audit, idea board only — not wired into the live job pages):
// the single-line customer strip already sits close to full width with a
// short example name and bike description (see the audit's M1); this is the
// "after" for the S2 idea board — the same fields as finalCustStrip, split
// into an identity row (name link, phone, email, the same three icon
// buttons) and a logistics row (bike, storage, mechanic, plus — per Jack's
// 29 Sep brief for this board — the spending-limit/ready-by/approved tags
// moved down here from the job-details strip, so "who" and "what's booked
// in" are visually separated from "what the diary/quote says").
export function finalCustStripTwoRow(customer, mechanicName, custHref = '#', tags = '', touchLinks = false) {
  const iconBtnF = (name, label) => `<button type="button" aria-label="${esc(label)}" title="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const custLinkF = `<a href="${custHref}" aria-label="View ${esc(customer.name)}'s account" style="${touchLinks ? 'display: inline-flex; align-items: center; min-height: 44px; ' : ''}font-size: 14px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(customer.name)}</a>`;
  // Rows trimmed to 0px vertical padding (from finalCustStrip's 2px): the
  // 44px icon buttons already set the identity row's floor, and the
  // logistics row's plain text needs no extra air either — every px here is
  // one the fixed-height dialog below (jobPopupContent) has to find again
  // now that S2 (decision 58) turned one row into two.
  const identityRow = `<div style="box-sizing: border-box; padding: 0 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}">${custLinkF}<span>${esc(customer.phone)}</span><span>${esc(customer.email)}</span></div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtnF('inbox', `Message ${esc(customer.name)}`)}${iconBtnF('mail', `Email ${esc(customer.name)}`)}${iconBtnF('menu', 'Notes')}</div>
</div>`;
  const logisticsRow = `<div style="box-sizing: border-box; padding: 1px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-top: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-width: 0; font-size: 13px; color: ${C.ink}"><span>${esc(customer.bike)}</span>${customer.storageSlot ? `<span style="color: ${C.muted}">Kept on ${esc(customer.storageSlot)}</span>` : ''}<span>Mechanic: <strong>${esc(mechanicName)}</strong></span></div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap">${tags}</div>
</div>`;
  return `<div style="flex-shrink: 0; box-sizing: border-box; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">${identityRow}${logisticsRow}</div>`;
}

// ---------- job details strip (job number, created, badges + status/time/ticks) ----------
// Decision 42: the customer's spending limit from their booking (decision 41),
// shown as a tag so a mechanic sees how far extra work can go before a call.
// UX walk-through 1 H1: in the story Maya asked to be called first.
export const SPEND_LIMIT = 'Call before any extra work';
// M2 (29 Sep audit): this is the one chip meant to stop a mechanic doing
// unapproved work, but the plain "blue" badge() sat at the same quiet visual
// weight as the "Ready by" chip next to it — nothing marked it as the one
// with a consequence if missed. Its own badge-shaped chip keeps the blue
// tone and bold text, so it reads heavier than an ordinary info badge
// without growing in size. Decision 67 (29 Sep): a thin full outline, not a
// heavy coloured left edge.
export const limitBadge = (text) => `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; border: 1px solid ${C.blueInk}; background: ${C.blueBg}; color: ${C.blueInk}; font-size: 12px; font-weight: 700; white-space: nowrap">${esc(text)}</span>`;
export function jobMetaRow(jobNum, created, readyByBadge, totalBadge, limit = SPEND_LIMIT) {
  return row(`${mono(jobNum, 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">${esc(created)}</span><span style="flex-grow: 1"></span>${limit ? limitBadge(limit) : ''}${readyByBadge}${totalBadge}`, 10);
}
// Decision 50 (28 Sep 2026): "Bike is here" is a clickable toggle pill, not a
// tick box; "New bike build" is dropped from the job page entirely — it only
// appears on the New job form, before the job exists (the `newBuild` param is
// gone — nothing calls this with it any more).
export function jobLeftCol({ status, diaryTime, readyBy, bikeHere, idPrefix, stackTimes = false }) {
  return `${selectFieldS('Status', status, `${idPrefix}-status`)}
${grid(stackTimes ? '1fr' : '1fr 1fr', `${staticFieldS('Diary time', diaryTime, `${idPrefix}-time`)}${staticFieldS('Ready by', readyBy, `${idPrefix}-ready`)}`, 12)}
${togglePill('Bike is here', bikeHere, `${idPrefix}-here`)}`;
}

// ---------- notes box (decisions 35/36/38/39) ----------
// paragraphs: array of { text }. customer's booking note(s) render in the
// "From the customer" section, closed off by an underline; staff notes are
// plain text below, oldest-first, no name/time stamps (decision 38).
export function bigNoteParagraph(text) {
  return `<p style="margin: 0; font-size: 14px; line-height: 1.45; color: ${C.ink}">${esc(text)}</p>`;
}
export function bigNoteBody(customerTexts, staffTexts) {
  const customerSection = `<div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 2px solid ${C.input}">
<span style="font-size: 12px; font-weight: 700; color: ${C.accentDark}">From the customer</span>
${customerTexts.map(bigNoteParagraph).join('')}
</div>`;
  return `${customerSection}${staffTexts.map(bigNoteParagraph).join('')}`;
}
// "Full service checklist" bar (decision 39: its own full-screen pop-up).
// href: link to the checklist board — a plain <button> (as job-final-2's
// study board originally drew it) when there's nowhere to link yet; an
// <a href> (diary.mjs's per-stage boards) when there is.
export function detailedNotesButton(checkedCount, totalCount, notedCount, href = null) {
  const chev = `<span style="display: inline-flex; flex-shrink: 0; transform: rotate(-90deg); color: ${C.muted}">${icon('chevron', 16)}</span>`;
  const tag = href ? 'a' : 'button';
  const attrs = href ? `href="${href}"` : `type="button"`;
  return `<${tag} ${attrs} style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box; min-height: 44px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; text-align: left${href ? '; text-decoration: none' : ''}">
<span style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700">${chev}Full service checklist</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(`${checkedCount} of ${totalCount} done · ${notedCount} note${notedCount === 1 ? '' : 's'}`)}</span>
</${tag}>`;
}
// Decision 67 (29 Sep): a thin full outline in the accent colour, not a
// heavy coloured left edge.
export function bigNotesColumn({ customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref = null }) {
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 3px 14px; display: flex; flex-direction: column; gap: 3px; overflow: hidden">
${h2('Notes', 15)}
<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; padding: 7px 14px; display: flex; flex-direction: column; gap: 6px; overflow: hidden">${bigNoteBody(customerTexts, staffTexts)}</div>
${detailedNotesButton(checkedCount, totalCount, notedCount, checklistHref)}
</div>`;
}

// ---------- section shell (no fold affordance — decision 33) ----------
export function plainFinalSection(title, { meta = '', tags = '', body = '', grow = false } = {}) {
  const header = `<div style="box-sizing: border-box; min-height: 24px; padding: 2px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap">${h2(title, 15)}${meta ? `<span style="font-size: 12px; color: ${C.muted}">${meta}</span>` : ''}</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap">${tags}</div>
</div>`;
  const boxStyle = `${grow ? 'flex-grow: 1;' : 'flex-shrink: 0;'} min-height: 0; display: flex; flex-direction: column; overflow: hidden;`;
  return `<div style="box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}; ${boxStyle}">
${header}
<div style="box-sizing: border-box; padding: 2px 14px; ${grow ? 'flex-grow: 1;' : ''} min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 3px">${body}</div>
</div>`;
}

// ---------- work and parts table (decision 33: full table, small toolbar) ----------
// lines: [{ code, work, sub, note, qty, price, approval: 'Approved'|'Declined'|'Awaiting approval'|'On order' }]
// toolbar: default Add item/Scan barcode/Print; quoteAction adds "Send
// quote" for the quoting stage (task: quote stage needs a "Send quote" action
// here as well as in the footer).
// Item 46 (decision 46): labour lines first, then parts, keeping each
// group's original order; a line that's neither a labour nor a part line
// (its `sub` doesn't start with "Labour" or "Part" — e.g. "Replace gear
// cable · Optional · cable still serviceable", an optional extra rather
// than a stocked part or timed labour) sorts after the parts. This is a
// sort applied at render — `lines` itself is never reordered by hand.
const classifyLine = (sub = '') => (/^Labour\b/i.test(sub) ? 0 : /^Part\b/i.test(sub) ? 1 : 2);
const sortLines = (lines) => lines.map((l, i) => [l, i]).sort(([a, ai], [b, bi]) => classifyLine(a.sub) - classifyLine(b.sub) || ai - bi).map(([l]) => l);
// Drop off and approve the quote, decisions 2, 3 and 5: while a quote is
// being built, each new line carries Needed or Optional (lines with \`need\`)
// and a photo control (lines with \`photos\`, a count). Lines without them
// draw exactly as before.
const needToggle = (l, h = 44) => `<span role="radiogroup" aria-label="${esc(l.work)}: needed or optional" style="display: inline-flex; border: 1px solid ${C.input}; border-radius: 6px; overflow: hidden">${['Needed', 'Optional'].map((o) => `<button type="button" role="radio" aria-checked="${l.need === o}" style="min-height: ${h}px; padding: 0 8px; border: 0; background: ${l.need === o ? C.ink : C.panel}; color: ${l.need === o ? '#ffffff' : C.ink}; font-family: inherit; font-size: 12px; font-weight: 600">${o}</button>`).join('')}</span>`;
const photoBtn = (l, h = 44) => (l.photos === undefined ? '' : `<button type="button" aria-label="${l.photos ? `${l.photos} photo — view or add for ${esc(l.work)}` : `Add photo for ${esc(l.work)}`}" style="display: inline-flex; align-items: center; gap: 4px; min-height: ${h}px; padding: 0 8px; border-radius: 6px; border: 1px ${l.photos ? 'solid' : 'dashed'} ${C.input}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 12px; font-weight: 600; white-space: nowrap">${icon('camera', 13)}${l.photos ? `${l.photos} photo` : 'Add photo'}</button>`);
// Audit M2 (journey 4): the line's note is the reason the customer reads;
// staff choose which line a labour line goes with.
const reasonCell = (l) => `<span style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; white-space: nowrap">${l.note ? esc(l.note) : l.pairWith ? '' : `<span style="font-style: italic">Reason for the customer</span>`}${l.pairWith ? `<label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: ${C.ink}">Goes with<select style="min-height: 44px; box-sizing: border-box; padding: 0 6px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 12px; color: ${C.ink}"><option>${esc(l.pairWith)}</option><option>Nothing</option></select></label>` : ''}${photoBtn(l)}</span>`;
// Audit L6 (journey 4): once sent, Needed or Optional stays as grey text.
const approvalCell = (l, tone) => (l.need ? needToggle(l) : l.needText ? `<span style="display: inline-flex; align-items: center; gap: 6px">${badge(l.approval, tone)}<span style="font-size: 12px; color: ${C.muted}">${esc(l.needText)}</span></span>` : badge(l.approval, tone));
// UX walk-through 1 H1: the hint says when a quote goes, or that none is needed.
const quoteHintText = (q) => (q === 'within' ? 'Within Maya’s £200 limit — no quote needed. She’ll be told what was added.' : 'Quotes are sent when the customer asked to be called first, or the total is over their limit.');
export function finalWorkAndPartsBody(lines, { totalLabel = 'Approved total', totalValue, footerNote = '', quoteAction = false, doneH = 34 } = {}) {
  const toolbarBtns = quoteAction === true
    ? `${ghostBtn('Send quote', 'mail')}${ghostBtn('Add item', 'plus')}${ghostBtn('Print', 'reports')}`
    : `${ghostBtn('Add item', 'plus')}${ghostBtn('Scan barcode', 'search')}${ghostBtn('Print', 'reports')}`;
  const toolbar = row(toolbarBtns, 8);
  // Item 43 (decision 43): a quote is only sent when the total is over the
  // customer's limit, or they set none — shown once, near the "Send quote"
  // toolbar button, on whichever stage passes quoteAction (currently the
  // quote stage only).
  const quoteHint = quoteAction ? `<p style="margin: 0; font-size: 12px; line-height: 1.3; color: ${C.muted}">${esc(quoteHintText(quoteAction))}</p>` : '';
  const thF = (t, extra = '') => `<th style="text-align: left; font-size: 12px; font-weight: 700; color: ${C.muted}; padding: 1px 10px; border-bottom: 1px solid ${C.border}; line-height: 1.05; ${extra}">${esc(t)}</th>`;
  const tdF = (inner, extra = '') => `<td style="padding: 1px 10px; font-size: 14px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; vertical-align: middle; line-height: 1.05; ${extra}">${inner}</td>`;
  const approvalTone = (a) => ({ Approved: 'green', Declined: 'red', 'Awaiting approval': 'purple', 'On order': 'amber' })[a] || 'grey';
  const rowsHtml = sortLines(lines).map((l) => {
    const declined = l.approval === 'Declined';
    const totalStrike = declined ? `text-decoration: line-through; color: ${C.muted};` : '';
    // H3 (29 Sep audit, decision 34), re-measured with S2 as the default
    // (decision 58, 29 Sep round 2): the Done tick is the control a
    // mechanic — often gloved, often glancing not looking — presses most on
    // this table, so its hit area is a label around a smaller (20px) visible
    // box, the same pattern as "Bike is here". Widened to 44px (the full
    // accessibility floor) with no trouble; height is 34px, not 44 — a
    // genuinely full 44px row, times a 4-line table's worth of rows, still
    // doesn't fit. S2's two-row customer strip actually *costs* about 25px
    // here (two rows, one with 44px icon buttons, vs. one wrapped line
    // before) rather than freeing any — every bit of that was reclaimed by
    // trimming this dialog's own chrome to its floor (finalCustStripTwoRow's
    // row padding, dialogFooter, jobPopupContent's dialogBody/jobSection),
    // which is what keeps the board at no-scroll now. Re-tried 44px on top
    // of those trims and it still overflowed job-collection (the tightest
    // board) by 41px, job-finished by 26px, job-waiting-parts by 36px — so
    // 34px stays. It still gives roughly 3.5x the tap area of the original
    // bare 20px checkbox (44x34 vs 20x20) — the audit's own fallback for
    // exactly this conflict ("rows may grow a little — keep no-scroll on
    // every job board") reads as choosing no-scroll over the full 44px
    // when the two collide, so that's the version shipped here. Flagged for
    // Jack: full 44px would need more layout rework than S2 turned out to
    // give (e.g. a shorter work-and-parts table, or letting this one dialog
    // scroll) if he'd rather have that than 34px.
    // (Also tried a -12px-margin overlay so the row wouldn't grow at all: it
    // does give a real 44px click box, but every TD/TR then reports
    // scrollHeight > clientHeight to the project's own no-scroll fit check —
    // a real, if harmless, discrepancy the check has no way to wave through,
    // so it's not usable here.)
    return `<tr>
${tdF(mono(l.code || '—'))}
${tdF(`<span><span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${C.muted}"> · ${esc(l.sub)}</span></span>`)}
${tdF(`<label aria-label="${esc(l.work)} done" style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: ${doneH}px; cursor: pointer"><input type="checkbox" ${(l.done ?? l.approval === 'Approved') ? 'checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"></label>`, 'text-align: center; padding-top: 0; padding-bottom: 0')}
${tdF(l.photos !== undefined ? reasonCell(l) : l.note ? esc(l.note) : '—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(l.qty))}
${tdF(l.stock ? `<span style="font-weight: 600; color: ${C.successInk}">${esc(l.stock)}</span>` : '—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(`£${l.price.toFixed(2)}`))}
${tdF(mono(`£${l.price.toFixed(2)}`, `font-weight: 600; ${totalStrike}`))}
${tdF(approvalCell(l, approvalTone(l.approval)))}
</tr>`;
  }).join('');
  const totalRow = `<tr><td colspan="7" style="padding: 3px 10px; text-align: right; font-size: 14px; font-weight: 700">${esc(totalLabel)}</td><td style="padding: 3px 10px">${mono(`£${totalValue.toFixed(2)}`, 'font-weight: 700; font-size: 15px')}</td><td></td></tr>`;
  const table = `<table style="width: 100%; border-collapse: collapse">
<thead><tr>${thF('Code')}${thF('Work / part')}${thF('Done', 'text-align: center')}${thF('Note')}${thF('Qty')}${thF('In stock')}${thF('Price')}${thF('Total')}${thF('Customer approval')}</tr></thead>
<tbody>${rowsHtml}${totalRow}</tbody>
</table>`;
  return `${toolbar}${quoteHint}${table}${footerNote ? `<p style="margin: 0; font-size: 12px; line-height: 1.3; color: ${C.muted}">${esc(footerNote)}</p>` : ''}`;
}

// ---------- the job pop-up's content (title bar + strip + details/notes + work/parts + footer) ----------
export function jobPopupContent({
  titleId, jobTitle, status, tone, closeHref,
  customer, mechanicName, custHref,
  jobNum, created, readyByBadge, totalBadge, limit, // limit: spending-limit tag override (decision 43's "No spending limit set" on the quote board only) — jobMetaRow's SPEND_LIMIT default otherwise
  left, // jobLeftCol() html
  customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref,
  lines, totalLabel, totalValue, footerNote, quoteAction,
  footer, // html for dialogFooter's inner
  stageTop = '', // optional stage-only section (bike tag, waiting-for-parts, payment) — inserted above the job details/notes section
  // S2 (decision 58, 29 Sep audit): finalCustStripTwoRow is the default for
  // every job page and job-final-2-style board — the identity row (name,
  // phone, email) and the logistics row (bike, storage, mechanic, plus the
  // limit/ready-by/approved tags) split apart instead of one dense line
  // (audit §3 S2). Pass twoRowHeader: false only to redraw the old one-line
  // strip, which idea-s2-before still does as the "before" record.
  twoRowHeader = true,
  touchLinks = false, // decision 68: tablet — the customer link gets a 44px-tall hit area (same row height)
  doneH = 34, // decision 68: the tablet board has the room for a full 44px Done tick; desktop keeps 34px (see H3 above)
}) {
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${left}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${bigNotesColumn({ customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref })}</div>`, 24);
  const metaLimit = limit !== undefined ? limit : SPEND_LIMIT;
  const jobSection = panel(`${jobMetaRow(jobNum, created, twoRowHeader ? '' : readyByBadge, twoRowHeader ? '' : totalBadge, twoRowHeader ? '' : metaLimit)}${jobBody}`, '', 2, 2);
  const workSection = plainFinalSection('Work and parts', { body: finalWorkAndPartsBody(lines, { totalLabel, totalValue, footerNote, quoteAction, doneH }), grow: false });
  // pad trimmed to 2px (from 4px, S2/decision 58 follow-up — same reclaim as
  // dialogFooter/finalCustStripTwoRow above).
  const body = dialogBody(`${stageTop}${jobSection}${workSection}`, 2, 1);
  const headerTags = twoRowHeader ? `${metaLimit ? limitBadge(metaLimit) : ''}${readyByBadge}${totalBadge}` : '';
  const custStripHtml = twoRowHeader ? finalCustStripTwoRow(customer, mechanicName, custHref, headerTags, touchLinks) : finalCustStrip(customer, mechanicName, custHref);
  return `${finalTitleBar(titleId, jobTitle, status, tone, closeHref)}${custStripHtml}${body}${footer ? dialogFooter(footer) : ''}`;
}

// ---------- The job page on a phone (decision 68) ----------
// One scrolling page in decision 35's three parts: (1) information — the
// two-row customer strip stacked (S2), any stage-only section, the job
// details; (2) the notes box — customer section on top, underline, plain
// notes, the Full service checklist bar (decisions 38/39); (3) work and parts
// as stacked rows, not a wide table, with Add item / Scan barcode ready
// (decisions 31/33/46). The stage's main action is pinned below by the
// caller. Same data as the desktop pop-up; nothing new.
const approvalTone = (a) => ({ Approved: 'green', Declined: 'red', 'Awaiting approval': 'purple', 'On order': 'amber', Booked: 'grey' })[a] || 'grey';
const partHead = (n, t) => `<div style="padding: 4px 2px 0">${h2(t, 16)}</div>`;
export function jobPhoneSections({
  customer, mechanicName, custHref, jobNum, created, limit, readyByBadge, totalBadge, left,
  customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref,
  lines, totalLabel, totalValue, footerNote = '', quoteAction = false, stageTop = '',
}) {
  const iconBtn = (name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}">${icon(name, 18)}</button>`;
  const metaLimit = limit !== undefined ? limit : SPEND_LIMIT;
  const strip = `<div style="flex-shrink: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.mutedBg}; overflow: hidden">
<div style="padding: 8px 8px 10px 12px; display: flex; flex-direction: column; gap: 2px">
<div style="display: flex; align-items: center; gap: 6px"><a href="${custHref}" aria-label="View ${esc(customer.name)}'s account" style="flex-grow: 1; display: inline-flex; align-items: center; min-height: 44px; font-size: 16px; font-weight: 700; color: ${C.accentDark}; text-decoration: underline; text-underline-offset: 3px">${esc(customer.name)}</a>${iconBtn('inbox', `Message ${customer.name}`)}${iconBtn('mail', `Email ${customer.name}`)}${iconBtn('menu', 'Notes')}</div>
<span style="font-size: 14px; color: ${C.ink}">${esc(customer.phone)}</span><span style="font-size: 14px; color: ${C.ink}">${esc(customer.email)}</span>
</div>
<div style="padding: 10px 12px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: ${C.ink}">
<span>${esc(customer.bike)}</span>
<span>${customer.storageSlot ? `<span style="color: ${C.muted}">Kept on ${esc(customer.storageSlot)}</span> · ` : ''}Mechanic: <strong>${esc(mechanicName)}</strong></span>
<div style="display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px">${metaLimit ? limitBadge(metaLimit) : ''}${readyByBadge}${totalBadge}</div>
</div>
</div>`;
  const details = `<div style="flex-shrink: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap">${mono(jobNum, 'font-size: 14px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">${esc(created)}</span></div>
${left}
</div>`;
  const notes = `<div style="flex-shrink: 0; box-sizing: border-box; border: 1px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px">
${h2('Notes', 15)}
<div style="min-height: 150px; box-sizing: border-box; border: 1px solid ${C.input}; border-radius: 8px; background: ${C.panel}; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px">${bigNoteBody(customerTexts, staffTexts)}</div>
${detailedNotesButton(checkedCount, totalCount, notedCount, checklistHref)}
</div>`;
  const tb = (text, iconName) => `<button type="button" style="flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 8px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.panel}; color: ${C.ink}; font-family: inherit; font-size: 14px; font-weight: 600; white-space: nowrap">${icon(iconName, 16)}${esc(text)}</button>`;
  const toolbar = `<div style="display: flex; gap: 6px">${quoteAction === true ? `${tb('Send quote', 'mail')}${tb('Add item', 'plus')}${tb('Print', 'reports')}` : `${tb('Add item', 'plus')}${tb('Scan barcode', 'search')}${tb('Print', 'reports')}`}</div>`;
  const rowHtml = (l, i) => {
    const declined = l.approval === 'Declined';
    const done = l.done ?? l.approval === 'Approved';
    return `<div style="display: flex; align-items: flex-start; gap: 6px; padding: 8px 0; border-top: 1px solid ${C.border}">
<label aria-label="${esc(l.work)} done" style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0; margin-left: -8px; cursor: pointer"><input type="checkbox" ${done ? 'checked' : ''} style="width: 22px; height: 22px; margin: 0; accent-color: ${C.accent}"></label>
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding-top: 3px">
<span style="font-size: 15px; font-weight: 600; color: ${C.ink}">${esc(l.work)}</span>
<span style="font-size: 13px; color: ${C.muted}">${esc(l.sub)} · Qty ${esc(l.qty)}</span>
${l.note ? `<span style="font-size: 13px; color: ${C.ink}">${esc(l.note)}</span>` : ''}
${l.need || l.photos !== undefined ? `<div style="padding-top: 2px; display: flex; flex-wrap: wrap; gap: 6px">${approvalCell(l, approvalTone(l.approval))}${photoBtn(l)}${l.pairWith ? `<span style="font-size: 13px; color: ${C.muted}; align-self: center">Goes with ${esc(l.pairWith)}</span>` : ''}</div>` : `<div style="padding-top: 2px">${badge(l.approval, approvalTone(l.approval))}</div>`}
</div>
${mono(`£${l.price.toFixed(2)}`, `flex-shrink: 0; padding-top: 4px; font-size: 15px; font-weight: 600; ${declined ? `text-decoration: line-through; color: ${C.muted};` : `color: ${C.ink};`}`)}
</div>`;
  };
  const work = `<div style="flex-shrink: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px">
${toolbar}
${quoteAction ? `<p style="margin: 0; font-size: 13px; line-height: 1.35; color: ${C.muted}">${esc(quoteHintText(quoteAction))}</p>` : ''}
<div>${sortLines(lines).map(rowHtml).join('')}
<div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">${esc(totalLabel)}</span>${mono(`£${totalValue.toFixed(2)}`, 'font-size: 17px; font-weight: 700')}</div></div>
${footerNote ? `<p style="margin: 0; font-size: 13px; line-height: 1.35; color: ${C.muted}">${esc(footerNote)}</p>` : ''}
</div>`;
  // Parts 1 and 2 carry their own titles (the customer's name, "Notes");
  // part 3 gets a heading, since its box starts with its toolbar.
  return `${strip}${stageTop}${details}
${notes}
${partHead('3', 'Work and parts')}${work}`;
}

// ---------- Full service checklist pop-up (decision 39) ----------
export function fullChecklistItem(it, id) {
  const tick = `<input id="${id}" type="checkbox"${it.checked ? ' checked' : ''} style="width: 22px; height: 22px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0">`;
  const field = `<div style="box-sizing: border-box; padding-left: 32px"><textarea id="${id}-note" rows="2" aria-label="${esc(it.t)} note" style="box-sizing: border-box; width: 100%; resize: none; padding: 8px 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; color: ${C.ink}; line-height: 1.35">${esc(it.note)}</textarea></div>`;
  const caption = it.checked && !it.note ? `<div style="padding-left: 32px; margin-top: -3px"><span style="font-size: 12px; color: ${C.muted}">Customer sees: All working well</span></div>` : '';
  return `<div style="display: flex; flex-direction: column; gap: 4px">
<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer">${tick}<span style="font-size: 14px; color: ${C.ink}">${esc(it.t)}</span></label>
${field}${caption}
</div>`;
}
// S3 idea board only (29 Sep audit): the checklist's ten items collapsed to
// a tick + label by default — a full-width empty note textarea under every
// item (the "before") pays the same visual cost whether it's used or not;
// this shows the note only where one exists, and a "+ Add note" action on
// the rest, so the two items that actually have something to say stand out
// instead of getting lost among eight empty boxes. min-height: 44px on both
// the label and the "+ Add note" button, per decision 34's touch-target floor.
export function fullChecklistItemCollapsed(it, id) {
  const tick = `<input id="${id}" type="checkbox"${it.checked ? ' checked' : ''} style="width: 22px; height: 22px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0">`;
  const hasNote = !!it.note;
  return `<div style="box-sizing: border-box; border-bottom: 1px solid ${C.border}">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
<label for="${id}" style="flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer">${tick}<span style="font-size: 14px; color: ${C.ink}">${esc(it.t)}</span></label>
${hasNote ? '' : `<button type="button" aria-label="Add a note for ${esc(it.t)}" style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 10px; border-radius: 6px; border: 0; background: transparent; color: ${C.accentDark}; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer">${icon('plus', 14)}Add note</button>`}
</div>
${hasNote ? `<div style="box-sizing: border-box; padding: 0 0 10px 32px"><p style="margin: 0; font-size: 13px; line-height: 1.4; color: ${C.ink}; background: ${C.mutedBg}; border-radius: 6px; padding: 8px 10px">${esc(it.note)}</p></div>` : ''}
</div>`;
}
export function fullChecklistHeader(titleId, subtitle, doneHref, closeHref) {
  return `<header style="flex-shrink: 0; box-sizing: border-box; padding: 14px 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${C.border}; background: ${C.panel}">
<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
<h2 id="${titleId}" style="margin: 0; ${DISPLAY_FONT_STYLE}font-size: 20px; font-weight: 700">Full service checklist</h2>
<span style="font-size: 13px; color: ${C.muted}">${subtitle}</span>
</div>
<div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0">
${button('Done', { variant: 'primary', href: doneHref || null })}
<a href="${closeHref}" aria-label="Close, back to the job" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>
</div>
</header>`;
}
export function fullChecklistDialog({ titleId = 'checklist-title', subtitle, checklist, doneHref = null, closeHref = '#', idPrefix = 'fcd', collapsed = true }) {
  const checkedCount = checklist.filter((c) => c.checked).length;
  const notedCount = checklist.filter((c) => c.note).length;
  const summary = `<div style="flex-shrink: 0; padding: 6px 24px 0"><span style="font-size: 13px; color: ${C.muted}">${esc(`${checkedCount} of ${checklist.length} done · ${notedCount} note${notedCount === 1 ? '' : 's'}`)}</span></div>`;
  // S3 (decision 58, 29 Sep audit): collapsed rows are the default — a
  // single column of short rows reads top-to-bottom in about one screen (the
  // audit spec's "AFTER" sketch), rather than the two 5-item columns the old
  // full note-per-item layout needed to fit at all. Pass collapsed: false
  // only to redraw the old layout, which idea-s3-before still does.
  let cols;
  if (collapsed) {
    cols = `<div style="flex-grow: 1; min-height: 0; overflow: hidden; max-width: 560px">${checklist.map((it, i) => fullChecklistItemCollapsed(it, `${idPrefix}-${i}`)).join('')}</div>`;
  } else {
    const left = checklist.slice(0, 5);
    const right = checklist.slice(5, 10);
    const colHtml = (items, offset) => `<div style="display: flex; flex-direction: column; gap: 16px; min-height: 0">${items.map((it, i) => fullChecklistItem(it, `${idPrefix}-${offset + i}`)).join('')}</div>`;
    cols = grid('1fr 1fr', `${colHtml(left, 0)}${colHtml(right, 5)}`, 40, 'flex-grow: 1; min-height: 0; overflow: hidden;');
  }
  const body = `<div style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: 14px 24px 22px; display: flex; flex-direction: column">${cols}</div>`;
  return `<div role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 28px 72px rgba(28,30,25,0.45); display: flex; flex-direction: column; overflow: hidden">
${fullChecklistHeader(titleId, subtitle, doneHref, closeHref)}${summary}${body}
</div>`;
}

// ---------- shared example data (fixed values already used across the
// generator — job-options.mjs's job-final-2/-detailed keep calling these
// exact values so their rendered output is unchanged) ----------
export const JOB_CUSTOMER = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green', storageSlot: 'Hook 3' };
export const LINE_DETAILS = [
  { work: 'Standard service', sub: 'Labour · 60 min', code: '', qty: '1', price: 65.0, approval: 'Approved' },
  { work: 'Shimano brake pads', sub: 'Part · B05S-RX', code: 'B05S-RX', qty: '1', price: 28.0, approval: 'Approved', note: 'Rear pads worn — replacing' },
  { work: 'Fit & adjust brakes', sub: 'Labour · 30 min', code: '', qty: '1', price: 18.0, approval: 'Approved' },
  { work: 'Replace gear cable', sub: 'Optional · cable still serviceable', code: '', qty: '1', price: 12.0, approval: 'Declined' },
];
export const APPROVED_TOTAL = 111.0;
export const DECLINED_NOTE = 'Gear cable declined. Anything beyond these lines needs a new approval.';
// 10-item standard service checklist (job-final-2-detailed's board; also the
// canonical checklist for the diary's seven job boards + job-checklist, so
// counts stay consistent everywhere the checklist is summarised).
export const CHECKLIST_10 = [
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
// Notes — customer's booking note + staff notes (already-used texts:
// "Bike booked in, tag printed." and the brakes note, oldest-first).
export const CUSTOMER_NOTE = 'My rear brake squeals and feels weak. The gears could use a tune-up too.';
export const STAFF_NOTE_BOOKED_IN = 'Bike booked in, tag printed.';
export const STAFF_NOTE_BRAKES = 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.';
