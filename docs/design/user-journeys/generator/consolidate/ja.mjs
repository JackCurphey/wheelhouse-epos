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
