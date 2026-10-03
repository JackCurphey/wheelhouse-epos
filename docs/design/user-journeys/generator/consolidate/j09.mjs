// Journey 9, Moving from Citrus Lime — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'mv-start': keep(24),
  'mv-progress': into('mv-start', '', "Files coming across one by one: 'Done', 'Bringing across', 'Waiting'; you can leave the page"),
  'mv-progress-failed': into('mv-start', '', "One file: 'Wheelhouse couldn’t read this file' with 'Choose another file'"),
  'mv-summary': into('mv-start', '', "'Here’s what came across': [n] brought across, '[n] need a look', 'Next: run alongside'"),
  'mv-fix': into('mv-start', '', "'[n] need a look': each row with 'Leave it out' or 'Fix', then 'Done for now'"),
  'mv-sorted': into('mv-start', '', "'Everything’s sorted': left-out rows listed under Your data; 'Next: run alongside'"),
  'mv-today-refresh': into('op-today', '', "Moving card: 'Time to refresh from Citrus Lime' with 'Refresh now'"), // inferred: Today with one card changed
  'mv-alongside': into('mv-start', '', "Weekly refresh: 'Every [day]', 'Change day', drop this week's files, what the last refresh changed"),
  'mv-change-day': keep(21), // inferred: a box with its own choice
  'mv-both': keep(25), // inferred: a box over the move page
  'mv-check': into('mv-start', '', "Weekly check: type four Citrus Lime figures, each shows 'Matches'; 'Weeks in a row that matched: [n] of 2'"),
  'mv-check-result': into('mv-start', '', "'3 of 4 match, so this week doesn’t count yet'; 'Stock value [£] different'"),
  'mv-practice-checkin': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'mv-practice-sale': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'mv-practice-card': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'mv-practice-job': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'mv-ready': into('mv-start', '', "'Before you switch over' checklist, 'Ready to switch over: 3 of 4'; website 'Not yet'"),
  'mv-weeks': keep(21), // inferred: a box with its own choice
  'mv-ready-all': into('mv-start', '', "Checklist all ticked, '4 of 4': 'Everything’s ready. Pick the day'"),
  'mv-pick-day': keep(21), // inferred: a box with its own choice
  'mv-morning': into('mv-start', '', "'Switch-over day · [date]': one last refresh, then 'Turn your website on'"),
  'mv-go-real': later('Dropped, not later: issue #116 question 4, practice mode dropped'),
  'mv-week': into('mv-start', '', "'Your first week on Wheelhouse': 'Day 5 of 7', days traded and to come; keep Citrus Lime"),
  'mv-week-done': into('mv-start', '', "'A full week on Wheelhouse': seven days traded; switch Citrus Lime off when ready"),
};
