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
export const dialogFooter = (inner) => `<div style="flex-shrink: 0; box-sizing: border-box; padding: 10px 22px; border-top: 1px solid ${C.border}; display: flex; align-items: center; gap: 12px; background: ${C.panel}">${inner}</div>`;

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

// ---------- job details strip (job number, created, badges + status/time/ticks) ----------
// Decision 42: the customer's spending limit from their booking (decision 41),
// shown as a tag so a mechanic sees how far extra work can go before a call.
export const SPEND_LIMIT = 'Customer OK up to £200';
// M2 (29 Sep audit): this is the one chip meant to stop a mechanic doing
// unapproved work, but the plain "blue" badge() sat at the same quiet visual
// weight as the "Ready by" chip next to it — nothing marked it as the one
// with a consequence if missed. Its own badge-shaped chip keeps the blue
// tone but adds a solid coloured left edge and bold text, so it reads
// heavier than an ordinary info badge without growing in size.
const limitBadge = (text) => `<span style="display: inline-flex; align-items: center; padding: 3px 10px 3px 8px; border-radius: 999px; border-left: 3px solid ${C.blueInk}; background: ${C.blueBg}; color: ${C.blueInk}; font-size: 12px; font-weight: 700; white-space: nowrap">${esc(text)}</span>`;
export function jobMetaRow(jobNum, created, readyByBadge, totalBadge, limit = SPEND_LIMIT) {
  return row(`${mono(jobNum, 'font-size: 13px; font-weight: 700')}<span style="font-size: 13px; color: ${C.muted}">${esc(created)}</span><span style="flex-grow: 1"></span>${limit ? limitBadge(limit) : ''}${readyByBadge}${totalBadge}`, 10);
}
// Decision 50 (28 Sep 2026): "Bike is here" is a clickable toggle pill, not a
// tick box; "New bike build" is dropped from the job page entirely — it only
// appears on the New job form, before the job exists (the `newBuild` param is
// gone — nothing calls this with it any more).
export function jobLeftCol({ status, diaryTime, readyBy, bikeHere, idPrefix }) {
  return `${selectFieldS('Status', status, `${idPrefix}-status`)}
${grid('1fr 1fr', `${staticFieldS('Diary time', diaryTime, `${idPrefix}-time`)}${staticFieldS('Ready by', readyBy, `${idPrefix}-ready`)}`, 12)}
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
export function bigNotesColumn({ customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref = null }) {
  return `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; border: 1px solid ${C.border}; border-left: 4px solid ${C.accent}; border-radius: 10px; background: ${C.bg}; padding: 3px 14px; display: flex; flex-direction: column; gap: 3px; overflow: hidden">
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
export function finalWorkAndPartsBody(lines, { totalLabel = 'Approved total', totalValue, footerNote = '', quoteAction = false } = {}) {
  const toolbarBtns = quoteAction
    ? `${ghostBtn('Send quote', 'mail')}${ghostBtn('Add item', 'plus')}${ghostBtn('Print', 'reports')}`
    : `${ghostBtn('Add item', 'plus')}${ghostBtn('Scan barcode', 'search')}${ghostBtn('Print', 'reports')}`;
  const toolbar = row(toolbarBtns, 8);
  // Item 43 (decision 43): a quote is only sent when the total is over the
  // customer's limit, or they set none — shown once, near the "Send quote"
  // toolbar button, on whichever stage passes quoteAction (currently the
  // quote stage only).
  const quoteHint = quoteAction ? `<p style="margin: 0; font-size: 12px; line-height: 1.3; color: ${C.muted}">${esc("Quotes are sent when the total is over the customer's limit, or they set none.")}</p>` : '';
  const thF = (t, extra = '') => `<th style="text-align: left; font-size: 12px; font-weight: 700; color: ${C.muted}; padding: 1px 10px; border-bottom: 1px solid ${C.border}; line-height: 1.05; ${extra}">${esc(t)}</th>`;
  const tdF = (inner, extra = '') => `<td style="padding: 1px 10px; font-size: 14px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; vertical-align: middle; line-height: 1.05; ${extra}">${inner}</td>`;
  const approvalTone = (a) => ({ Approved: 'green', Declined: 'red', 'Awaiting approval': 'purple', 'On order': 'amber' })[a] || 'grey';
  const rowsHtml = sortLines(lines).map((l) => {
    const declined = l.approval === 'Declined';
    const totalStrike = declined ? `text-decoration: line-through; color: ${C.muted};` : '';
    // H3 (29 Sep audit, decision 34): the Done tick is the control a
    // mechanic — often gloved, often glancing not looking — presses most on
    // this table, so its hit area is a label around a smaller (20px) visible
    // box, the same pattern as "Bike is here". Widened to 44px (the full
    // accessibility floor) with no trouble; height is 34px, not 44 — a
    // genuinely full 44px row, times a 4-line table's worth of rows, doesn't
    // fit this dialog's fixed, no-scroll height at once (confirmed: at 44px
    // it overflowed job-collection/job-finished/job-waiting-parts by
    // 25-40px even after trimming this dialog's own chrome padding below to
    // its floor). 34px still gives roughly 3.5x the tap area of the original
    // bare 20px checkbox (44x34 vs 20x20) — the audit's own fallback for
    // exactly this conflict ("rows may grow a little — keep no-scroll on
    // every job board") reads as choosing no-scroll over the full 44px
    // when the two collide, so that's the version shipped here. Flagged for
    // Jack: full 44px is achievable with more layout rework (e.g. splitting
    // the job header into two rows per S2, freeing space table-side) if he'd
    // rather have that than 34px.
    // (Also tried a -12px-margin overlay so the row wouldn't grow at all: it
    // does give a real 44px click box, but every TD/TR then reports
    // scrollHeight > clientHeight to the project's own no-scroll fit check —
    // a real, if harmless, discrepancy the check has no way to wave through,
    // so it's not usable here.)
    return `<tr>
${tdF(mono(l.code || '—'))}
${tdF(`<span><span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${C.muted}"> · ${esc(l.sub)}</span></span>`)}
${tdF(`<label aria-label="${esc(l.work)} done" style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 34px; cursor: pointer"><input type="checkbox" ${(l.done ?? l.approval === 'Approved') ? 'checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"></label>`, 'text-align: center; padding-top: 0; padding-bottom: 0')}
${tdF(l.note ? esc(l.note) : '—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(l.qty))}
${tdF('—', `color: ${C.muted}; font-size: 12px`)}
${tdF(mono(`£${l.price.toFixed(2)}`))}
${tdF(mono(`£${l.price.toFixed(2)}`, `font-weight: 600; ${totalStrike}`))}
${tdF(badge(l.approval, approvalTone(l.approval)))}
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
}) {
  const jobBody = grid('420px 1fr', `<div style="display: flex; flex-direction: column; gap: 6px; min-height: 0">${left}</div><div style="display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: hidden">${bigNotesColumn({ customerTexts, staffTexts, checkedCount, totalCount, notedCount, checklistHref })}</div>`, 24);
  const jobSection = panel(`${jobMetaRow(jobNum, created, readyByBadge, totalBadge, ...(limit !== undefined ? [limit] : []))}${jobBody}`, '', 3, 3);
  const workSection = plainFinalSection('Work and parts', { body: finalWorkAndPartsBody(lines, { totalLabel, totalValue, footerNote, quoteAction }), grow: false });
  const body = dialogBody(`${stageTop}${jobSection}${workSection}`, 4, 1);
  return `${finalTitleBar(titleId, jobTitle, status, tone, closeHref)}${finalCustStrip(customer, mechanicName, custHref)}${body}${footer ? dialogFooter(footer) : ''}`;
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
export function fullChecklistDialog({ titleId = 'checklist-title', subtitle, checklist, doneHref = null, closeHref = '#', idPrefix = 'fcd' }) {
  const checkedCount = checklist.filter((c) => c.checked).length;
  const notedCount = checklist.filter((c) => c.note).length;
  const summary = `<div style="flex-shrink: 0; padding: 6px 24px 0"><span style="font-size: 13px; color: ${C.muted}">${esc(`${checkedCount} of ${checklist.length} done · ${notedCount} note${notedCount === 1 ? '' : 's'}`)}</span></div>`;
  const left = checklist.slice(0, 5);
  const right = checklist.slice(5, 10);
  const colHtml = (items, offset) => `<div style="display: flex; flex-direction: column; gap: 16px; min-height: 0">${items.map((it, i) => fullChecklistItem(it, `${idPrefix}-${offset + i}`)).join('')}</div>`;
  const cols = grid('1fr 1fr', `${colHtml(left, 0)}${colHtml(right, 5)}`, 40, 'flex-grow: 1; min-height: 0; overflow: hidden;');
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
