// Journey A, How Wheelhouse fits together — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-A-10-16.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'map': keep(16), // inferred: the map of the three frames; no closer block
  'staff-app': keep(16), // owner of the staff app frame (brief rule 6)
  'staff-app-mechanic': into('staff-app', 'App map 11, 14', "Alex Morgan, Mechanic: sidebar shows only the Workshop room; diary filtered to Alex, no Waiting column"),
  'staff-search': into('staff-app', 'App map 2; Customer service 12; walk-through 9 M1; 3 Oct (third walk, answer 1)', "Header search typed 'maya' over Jo's diary: Jobs, Orders, Customers and Products, each row only a link to its page; no till buttons, no basket"),
  'staff-app-menu': into('staff-app', 'App map 11, 14', "Phone menu open over the dimmed page: rooms, shop switcher, your name, 'Close menu'"),
  'till-rail': keep(16),
  'till-rail-open': into('till-rail', 'App map 4, 5', "Rail unfolded over the till: room names, 'Shop: Bolton' switcher, 'Fold the menu', 'Check out'"),
  'till-search': keep(17),
  'till-search-paid': into('till-search', 'Walk-through 8, decision 8; Collect and pay 5 (H3); 3 Oct (third walk, answers 1 and 8)', "WH-1042 row reads 'Paid online · [date]' with 'Hand over' in place of 'Book in'"),
  'your-settings': keep(2), // owner of Your settings (brief rule 6)
  'your-settings-no-pin': into('your-settings', 'WT4 H1', "Till PIN reads 'No PIN yet' with 'Get your PIN' in place of 'Change PIN'"),
  'site': keep(16),
  'site-menu': into('site', 'App map 3, 10', "Phone menu open: 'Shop', 'Book a repair', 'Our shops', 'Account' as a full-width list"),
  'site-ocean': keep(16), // kept: App map 3 — report says a list line "goes against App map 3's 'one extra board'"
  'site-ocean-menu': into('site-ocean', 'App map 3, 10', "Phone menu open, Ocean Blue: 'Book a repair' as a big button above the list"),
};

// Decisions drawn as lines, with no old drawing behind them
// ("Draw the decisions" spec, section 5: A2, A5, A6, A7).
export const lines = [
  { on: 'your-settings', text: 'On a workshop computer: Your settings belong to the person who typed their PIN, and switch with them', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M3' },
  { on: 'your-settings', text: 'On a workshop computer: no Change PIN', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 3' },
  { on: 'till-rail', text: 'On a till, the rest of the shop opens as the person checked in by PIN, with their role', who: 'Staff', decision: 'Walk-through 8, fix M6 part 1' },
  { on: 'staff-app', text: 'On a workshop computer, owner and manager pages open only after an Owner or Manager PIN', who: 'Owner and Manager', decision: 'Walk-through 8, decision 3' },
  // "Draw the answers" spec, section 3: A3–A6.
  { on: 'till-search', text: 'Enter and scanning still do the till action', who: 'Staff', decision: 'App map, 3 Oct (walk-through 9 H1)' },
  { on: 'till-search', text: 'A job row shows its stage and ready-by date: Waiting for parts · ready by Thu 17 Sep · approved £111.00', who: 'Staff', decision: 'App map, 3 Oct (walk-through 9 H1)' },
  { on: 'till-search', text: 'A product row shows its price and [n] in stock here · [n] at [Second site], for everyone, Staff included', who: 'Staff', decision: 'Stock control, 3 Oct (walk-through 9 M2)' },
  { on: 'till-rail', text: 'Till only (no email): the rail opens the till and Front desk › Online orders, so they can mark online orders ready; every other room stays hidden', who: 'Staff', decision: 'Walk-through 8 decision 8; 3 Oct (walk-through 10 M1)' },
  // The second walk-through's smaller questions, 3 Oct (answer 12).
  { on: 'staff-app', text: 'Search also finds bikes, frame numbers and booking requests', who: 'Staff', decision: 'Second walk, 3 Oct, answer 12 (walk-through 9 L3)' },
  { on: 'till-search', text: 'On the till the cursor starts in the search box', who: 'Staff', decision: 'Second walk, 3 Oct, answer 12 (walk-through 9 L3)' },
  { on: 'site', text: 'A Lightspeed shop: no Shop or Basket in the header', who: 'Customer', decision: 'Lightspeed shops 10 (H1); walk-through 6 L4' },
// The coverage walks (4 Oct, docs/design/user-journeys/walk-4/): Jack's answers and the walks' fixes drawn as lines.
  { on: 'staff-app', text: "On a workshop computer the sidebar's foot reads 'Alex Morgan · Mechanic · Check out'; Check out goes back to Enter your PIN; no Sign out", who: 'Mechanic', decision: 'Walk-through 8, decision 1, fix M6 part 1, L3; 4 Oct (coverage walk 2 M2)' },
];
