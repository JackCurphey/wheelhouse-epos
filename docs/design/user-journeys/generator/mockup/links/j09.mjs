// Journey 9, Moving from Citrus Lime — where each button goes in the mockup.
// Sources: Moving decisions 2–9 and the 3 Oct later changes
// (docs/decisions/2026-09-30-moving-from-citrus-lime-review.md); the
// mv-start lines in consolidate/j09.mjs; walk-through 4, second walk.
import { go, STAY, notDrawn } from '../controls.mjs';

const fixRow = notDrawn('Fix on a row that needs a look: the pop-up for that one row (second walk Q4, a line on mv-start, not drawn)');

export default {
  '*': {
    // The move's own page in the sidebar (Moving 4); "Moving" on tablet and phone.
    'Moving from Citrus Lime': go('mv-start'),
    Moving: go('mv-start'),
    'Ask us to help': notDrawn('Ask us to help: how the owner reaches Wheelhouse for help with the move (Moving 2, 9 H2)'),
    // The three stages across the top are links (Moving 9 H1).
    '1 Bring your data Now': STAY,
    'Bring your data Done': go('mv-sorted'),
    '2 Run alongside Later': go('mv-alongside'),
    '2 Run alongside Now': STAY,
    '2 Run alongside Still running': go('mv-alongside'),
    'Run alongside Done': go('mv-alongside'),
    '3 Switch over Later': go('mv-ready'),
    '3 Switch over Now': STAY,
    'Switch over Done': STAY,
    // The Weekly refresh card (Moving 3, 9 M1).
    'Change day': go('mv-change-day'),
    'Choose files': go('mv-check'), // once the refresh is in, the weekly check shows (Moving 5)
    'See them': go('mv-both'),
    // The switch-over checklist (Moving 7, 8).
    Change: go('mv-weeks'),
    'Open Website': go('ws-page-moving'),
    'Pick the day': go('mv-pick-day'),
  },
  'mv-start': { 'Choose files': go('mv-progress') },
  'mv-alongside': { 'Choose files': go('mv-check') },
  'mv-progress-failed': { 'Choose another file': go('mv-progress') },
  'mv-summary': { 'Next: run alongside': go('mv-alongside'), 'Look at the [n]': go('mv-fix') },
  'mv-fix': {
    'Leave out [Customer name]': STAY, 'Leave out [Customer row]': STAY, 'Leave out [Job number]': STAY,
    'Fix [Customer name]': fixRow, 'Fix [Customer row]': fixRow, 'Fix [Job number]': fixRow,
    'Done for now': go('mv-sorted'),
  },
  // Left-out rows are kept under Settings › Office › Your data (Moving 9 M3).
  'mv-sorted': { 'See them': go('set-data-export'), 'Next: run alongside': go('mv-alongside') },
  'mv-today-refresh': { 'Refresh now': go('mv-alongside'), 'Open the diary': go('diary'), 'Book in': go('till-book-in') },
  'mv-change-day': { Save: go('mv-alongside') },
  'mv-both': { 'Got it': go('mv-alongside') },
  // Pick the day is greyed out until every row ticks.
  'mv-ready': { 'Pick the day': STAY },
  'mv-weeks': { 'Pick the day': STAY, Save: go('mv-ready') },
  'mv-pick-day': {
    'Another day…': notDrawn('Another day…: picking a switch-over day beyond the next open days (Moving 9 M6)'),
    'Switch over on [date]': go('mv-morning'),
  },
  'mv-morning': { 'Turn it on': go('mv-week') },
};
