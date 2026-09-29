// Before/after idea boards for three of the audit's structural ideas (S2,
// S3, S4 — docs/design/user-journeys/workshop-day-ui-audit.md §3), for Jack
// to choose from, per decision 55. Each "before" and "after" reuses the real
// board builders from diary.mjs/job-page.mjs (not a redrawn approximation),
// so what's shown is faithful to what the live boards would actually look
// like with the idea applied — only the ideas themselves are new code.
//
// Registered as their own row in build-diary.mjs's sand build only (these
// are options to choose between, not settled design — they don't belong in
// the default Fjell build or job-options.mjs).
import { DW, DH } from './stage1.mjs';
import { C, esc, icon, badge } from './ui.mjs';
import {
  buildJobPageDesktop, buildDiaryDesktopBoard, diaryFrozenContentMechanic,
  STORAGE, LINES_APPROVED, WORK_TOTAL_APPROVED, DECLINED_NOTE_TEXT,
  CHECKLIST_CHECKED, CHECKLIST_NOTED, NOTES_CUSTOMER, NOTES_STAFF_FULL, JOB_READY_BY,
  shellDesktop,
} from './diary.mjs';
import {
  jobPopupContent, jobLeftCol as jpJobLeftCol, fullChecklistDialog,
  CHECKLIST_10, JOB_CUSTOMER,
} from './job-page.mjs';

export const screens = {};

// ---------- S2: job header — one-line customer strip vs. two-row split ----------
// Same data as the live job-mechanic board (decision 40's worked example);
// only twoRowHeader differs.
function s2Board(twoRowHeader) {
  return buildJobPageDesktop({
    mechanic: true, status: 'In workshop', tone: 'blue', closeHref: '#',
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL,
    checkedCount: CHECKLIST_CHECKED, notedCount: CHECKLIST_NOTED,
    checklistHref: null,
    leftStatus: 'In workshop', bikeHere: true,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT,
    totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    footer: '', twoRowHeader,
  });
}
screens['idea-s2-before'] = { desktop: s2Board(false) };
screens['idea-s2-after'] = { desktop: s2Board(true) };

// ---------- S3: full service checklist — a note box under every item vs. collapsed rows ----------
// Same dimmed-diary + job pop-up + checklist pop-up-over-pop-up structure as
// the live job-checklist board (diary.mjs), just with fullChecklistDialog's
// collapsed option switched on for "after".
function s3Board(collapsed) {
  const base = shellDesktop('diary', 'Workshop diary', diaryFrozenContentMechanic('desktop'), { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' });
  const jobLayer = jobPopupContent({
    titleId: 'job-page-title', jobTitle: 'Standard service', status: 'In workshop', tone: 'blue', closeHref: '#',
    customer: { ...JOB_CUSTOMER, storageSlot: STORAGE['WH-1042'] }, mechanicName: 'Alex Morgan', custHref: '#',
    jobNum: 'WH-1042', created: 'Created Thu 17 Sep · by Jo Taylor',
    readyByBadge: badge(`Ready by ${JOB_READY_BY}`, 'grey'), totalBadge: badge(`Approved £${WORK_TOTAL_APPROVED.toFixed(2)}`, 'green'),
    left: jpJobLeftCol({ status: 'In workshop', diaryTime: 'Thu 17 Sep · 11:30–13:00', readyBy: JOB_READY_BY, bikeHere: true, idPrefix: `jpc-${collapsed ? 'after' : 'before'}` }),
    customerTexts: NOTES_CUSTOMER, staffTexts: NOTES_STAFF_FULL, checkedCount: CHECKLIST_CHECKED, totalCount: CHECKLIST_10.length, notedCount: CHECKLIST_NOTED, checklistHref: null,
    lines: LINES_APPROVED, totalLabel: 'Approved total', totalValue: WORK_TOTAL_APPROVED, footerNote: DECLINED_NOTE_TEXT, quoteAction: false,
    footer: '',
  });
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${base}
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 32px">
<div role="dialog" aria-modal="true" aria-hidden="true" style="width: 100%; height: 100%; box-sizing: border-box; background: ${C.panel}; border-radius: 14px; box-shadow: 0 24px 64px rgba(28,30,25,0.35); display: flex; flex-direction: column; overflow: hidden">
${jobLayer}
</div>
</div>
<div style="position: absolute; inset: 0; background: rgba(28,30,25,0.55); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 20px">
${fullChecklistDialog({ titleId: 'job-checklist-title', subtitle: 'Standard service · WH-1042 · Trek Domane AL 3', checklist: CHECKLIST_10, doneHref: null, closeHref: '#', idPrefix: `jc-${collapsed ? 'after' : 'before'}`, collapsed })}
</div>
</div>`;
}
screens['idea-s3-before'] = { desktop: s3Board(false) };
screens['idea-s3-after'] = { desktop: s3Board(true) };

// ---------- S4: overlapping diary slot — plain-text summary vs. stacked-card control ----------
screens['idea-s4-before'] = { desktop: buildDiaryDesktopBoard('text') };
screens['idea-s4-after'] = { desktop: buildDiaryDesktopBoard('stacked') };
// idea-s4-open: the "after" board with a short popover open, showing what
// clicking the stacked control does — a small list of the two jobs sharing
// the slot, either one openable directly. Position measured against the
// real rendered "after" board (Thursday/today column, 09:00 — WH-1038 and
// WH-1040, the two jobs already in that slot in JOBS/diary.mjs): x 860.7,
// y 208, w 91.6, h 83 — fixed values since this layout is static, not
// user-resizable.
function s4OpenPopover() {
  const BLOCK = { x: 860.7, y: 208, w: 91.6, h: 83 };
  const item = (job, svc, mech, time) => `<a href="job-overview-desktop.dc.html" style="display: flex; flex-direction: column; gap: 1px; text-decoration: none; color: inherit; padding: 8px 12px; border-radius: 6px;">
<span style="font-size: 13px; font-weight: 700; color: ${C.ink}">${esc(time)} · ${esc(svc)}</span>
<span style="font-size: 12px; color: ${C.muted}">${esc(job)} · ${esc(mech)}</span>
</a>`;
  const popW = 220;
  const left = BLOCK.x + BLOCK.w / 2 - popW / 2;
  const top = BLOCK.y + BLOCK.h + 8;
  return `<div role="dialog" aria-label="Choose which job to open" style="position: absolute; left: ${left}px; top: ${top}px; width: ${popW}px; box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(28,30,25,0.25); padding: 6px; display: flex; flex-direction: column; gap: 2px; z-index: 20">
<div style="padding: 4px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${C.muted}">2 jobs at 09:00</div>
${item('WH-1038', 'Safety check', 'Alex Morgan', '09:00')}
${item('WH-1040', 'Gear service', 'Jo Taylor', '09:00')}
</div>`;
}
screens['idea-s4-open'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${buildDiaryDesktopBoard('stacked')}
${s4OpenPopover()}
</div>`,
};
