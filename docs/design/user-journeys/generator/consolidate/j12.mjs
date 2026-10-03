// Journey 12, The workshop diary and the job — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-12-21.md merge table. Per-screen decision
// references are from that table's "Decision touched" column, matched to each
// screen by the decision named in its diary.mjs comment.
import { keep, into } from './plan.mjs';

export default {
  // The diary
  'diary': keep(23, { sizes: ['desktop', 'tablet', 'phone'] }), // rule 3: touch blocks on tablet, day strip on phone (consolidation-12-21.md)
  'diary-mechanic': into('diary', 'Workshop day 13'),
  'waiting-open': into('diary', 'Workshop day 14'),
  'diary-day': keep(23, { sizes: ['desktop', 'tablet', 'phone'] }), // its layout changes (Workshop day 18); rule 3 as diary
  'diary-settings': into('set-workshop-diary', 'Owner setup 12'),
  'change-selected': into('diary', 'Workshop day 19'),
  'diary-context-menu': into('diary', 'Workshop day 37'),
  'job-quick-overview': keep(25),
  'diary-stack-hover': into('diary', 'Workshop day 59, 61'),
  'diary-stack-open': into('diary', 'Workshop day 59, 61'),
  'diary-hover-summary': into('job-quick-overview', 'Workshop day 65'),
  // Requests, as a pop-up
  'request-new': keep(9),
  'request-decline': into('request-new', 'Workshop day 15'),
  'request-change': into('request-new', 'Workshop day 15'),
  'request-cancel': into('request-new', 'Workshop day 15'),
  // New job from an empty slot
  'new-job-pick': into('diary', 'Workshop day 22'),
  'new-job': keep(9),
  'new-job-day': into('new-job', 'Workshop day 18, 54'),
  // The job — one page, no tabs (the 7 stages are its situation list)
  'job-overview': keep(15, { sizes: ['desktop', 'tablet', 'phone'] }), // rule 3: own touch layout (Workshop day 3)
  'job-book-in': into('job-overview', 'Workshop day 20'),
  'job-quote': into('job-overview', 'Workshop day 20'),
  'job-mechanic': into('job-overview', 'Workshop day 20'),
  'job-waiting-parts': into('job-overview', 'Workshop day 20'),
  'job-finished': into('job-overview', 'Workshop day 20'),
  'job-collection': into('job-overview', 'Workshop day 20'),
  'job-checklist': keep(7),
  // Customer account
  'customer': into('cs-page', 'Customer service 11'),
  // Overview page
  'overview': keep(3),
};

// Extra situation lines with no old drawing behind them ("Draw the decisions"
// spec, section 8: D3, D4, D5).
export const lines = [
  // D3 — the diary
  { on: 'diary', text: 'A workshop computer: the Working: Alex Morgan · Switch bar, and everything done is recorded under that name and role', who: 'Mechanic', decision: 'Walk-through 8, decisions 1 and 4' },
  { on: 'diary', text: 'A change on another device shows here within a few seconds', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'diary', text: "A shared-queue job: I'll do this puts it in your column at your next free time; every device shows Taken by Jo Taylor", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 5' },
  { on: 'diary', text: 'Me is the person working now; anyone with Works in the workshop gets Me', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M2' },
  { on: 'diary', text: 'A workshop computer with nobody working: opens on Everyone', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M2' },
  // D4 — the job
  { on: 'job-overview', text: "A workshop computer: Working: Alex Morgan · Switch in the job's header", who: 'Mechanic', decision: 'Walk-through 8, decision 4' },
  { on: 'job-overview', text: 'Open on another device: Jo Taylor has this job open', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "Notes: the other person's words arrive as they type", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "Two people change one line: Keep mine or Keep Alex's", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "On a desktop, Add photo: Choose a file or Use my phone (a code to scan opens that line's photo step, no sign-in)", who: 'Mechanic', decision: 'Walk-through 8, decision 6' },
  { on: 'job-overview', text: 'Who did what, folded: name, what, time; Mark ready records Signed off by Alex Morgan · 15:30', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 7; build plan Q3' },
  // D5 — the quick look
  { on: 'job-quick-overview', text: 'After Mark ready: Signed off by Alex Morgan · 15:30 in the hover summary', who: 'Staff and Mechanic', decision: 'Build plan Q3' },
];
