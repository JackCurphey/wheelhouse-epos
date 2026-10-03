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
