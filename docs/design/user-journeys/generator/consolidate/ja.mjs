// Journey A, How Wheelhouse fits together — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'map': keep(16), // inferred: the map of the three frames; no closer block
  'staff-app': keep(16), // owner of the staff app frame (brief rule 6)
  'staff-app-mechanic': into('staff-app', 'App map 11, 14'),
  'staff-app-menu': into('staff-app', 'App map 11, 14'),
  'till-rail': keep(16),
  'till-rail-open': into('till-rail', 'App map 4, 5'),
  'till-search': keep(17),
  'your-settings': keep(2), // owner of Your settings (brief rule 6)
  'your-settings-no-pin': into('your-settings', 'WT4 H1'),
  'site': keep(16),
  'site-menu': into('site', 'App map 3, 10'),
  'site-ocean': keep(16), // kept: App map 3 — report says a list line "goes against App map 3's 'one extra board'"
  'site-ocean-menu': into('site-ocean', 'App map 3, 10'),
};

// Decisions drawn as lines, with no old drawing behind them
// ("Draw the decisions" spec, section 5: A2, A5, A6, A7).
export const lines = [
  { on: 'your-settings', text: 'On a workshop computer: Your settings belong to the person who typed their PIN, and switch with them', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M3' },
  { on: 'your-settings', text: 'On a workshop computer: no Change PIN', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 3' },
  { on: 'till-rail', text: 'On a till, the rest of the shop opens as the person checked in by PIN, with their role', who: 'Staff', decision: 'Walk-through 8, fix M6 part 1' },
  { on: 'staff-app', text: 'On a workshop computer, owner and manager pages open only after an Owner or Manager PIN', who: 'Owner and Manager', decision: 'Walk-through 8, decision 3' },
  { on: 'till-search', text: 'A job paid online: Paid online · [date], with Hand over in place of Add to basket', who: 'Staff', decision: 'Walk-through 8, decision 8; Collect and pay 5 (H3)' },
  { on: 'till-search', text: 'A job expected today: Book in', who: 'Staff', decision: 'Walk-through 8, decision 8' },
];
