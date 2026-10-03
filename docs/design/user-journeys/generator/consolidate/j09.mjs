// Journey 9, Moving from Citrus Lime — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'mv-start': keep(24),
  'mv-progress': into('mv-start', ''),
  'mv-progress-failed': into('mv-start', ''),
  'mv-summary': into('mv-start', ''),
  'mv-fix': into('mv-start', ''),
  'mv-sorted': into('mv-start', ''),
  'mv-today-refresh': into('op-today', ''), // inferred: Today with one card changed
  'mv-alongside': into('mv-start', ''),
  'mv-change-day': keep(21), // inferred: a box with its own choice
  'mv-both': keep(25), // inferred: a box over the move page
  'mv-check': into('mv-start', ''),
  'mv-check-result': into('mv-start', ''),
  'mv-practice-checkin': later('Issue #116 question 4: practice mode dropped'),
  'mv-practice-sale': later('Issue #116 question 4: practice mode dropped'),
  'mv-practice-card': later('Issue #116 question 4: practice mode dropped'),
  'mv-practice-job': later('Issue #116 question 4: practice mode dropped'),
  'mv-ready': into('mv-start', ''),
  'mv-weeks': keep(21), // inferred: a box with its own choice
  'mv-ready-all': into('mv-start', ''),
  'mv-pick-day': keep(21), // inferred: a box with its own choice
  'mv-morning': into('mv-start', ''),
  'mv-go-real': later('Issue #116 question 4: practice mode dropped'),
  'mv-week': into('mv-start', ''),
  'mv-week-done': into('mv-start', ''),
};
