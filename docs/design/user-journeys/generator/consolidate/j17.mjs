// Journey 17, Reports and accounts — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'rp-home': keep(5),
  'rp-home-all': into('rp-home', 'Reports and accounts, 3 Oct (the strip and the shop menu); Multiple sites 1; 3 Oct (third walk, answers 2 and 3)', "All shops: 'So far: Mon 14 – Thu 17 September', a row each for Bolton and [Second site] — the shop's name, takings, margin"),
  'rp-home-staff': into('rp-home', '', "Staff: one shop, no Margin, VAT, Activity log or Cycle to Work; shared reports say 'Shared by Jack Lewis'"),
  'rp-report-menu': into('rp-home', '', "A saved report's menu: 'Rename', 'Share with managers', 'Delete'"),
  'rp-report-deleted': into('rp-home', '', "'“[Report name]” deleted.' with 'Undo'"),
  'rp-your-settings': into('your-settings', '', "Accessibility adds 'Show graphs in reports' — the figures are always in the table below"),
  'rp-sales': keep(5),
  'rp-sales-all': into('rp-sales', '', "All shops: 'Takings by shop' — Bolton, [Second site] ('Opened [date] — nothing to compare before then'), All shops"),
  'rp-sales-year': into('rp-sales', '', "12 months: 'Takings by month' line, Oct to Sep, 'against the 12 months before'"),
  'rp-sales-empty': into('rp-sales', '', "'Nothing sold yet today'; 'Nothing to compare with yet' for a new shop"),
  'rp-pick-dates': into('rp-sales', '', "'Pick dates' box: From, To; 'Compared with the same number of days just before.'"),
  'rp-change': keep(9), // inferred: the one box kept as its own screen
  'rp-changed': into('rp-sales', '', "Changed report: 'You’ve changed this report.' bar with 'Save as my report', 'Back to Sales'"), // inferred
  'rp-save': into('rp-change', '', "'Save as my report' box: 'Name (needed)', who can see it — 'Just me' or 'Me and the other managers'"), // inferred
  'rp-save-taken': into('rp-change', '', "Name error: 'You already have a report with this name. Choose another name.'"), // inferred
  'rp-takings': keep(5),
  'rp-takings-all': into('rp-takings', '', "All shops: one row per shop — takings at the tills, online, cash banked, difference, sent to Xero"),
  'rp-day': keep(5),
  'rp-reopen': into('rp-day', '', "'Reopen Wed 16 September, Till B2?' box: a reason (needed); 'Keep it closed' or 'Reopen the day'"), // inferred
  'rp-takings-reopened': into('rp-takings', '', "Bar: 'Wed 16 Sep, Till B2 is reopened — its figures are left out'; row 'Reopened', 'Close the day'"),
  'rp-vat': keep(5),
  'rp-vat-first': into('rp-vat', '', "'When does your VAT quarter start?' box, asked once: three month groups; 'Not now' or 'Save'"), // inferred
  'rp-vat-all': into('rp-vat', '', "All shops: one row per shop instead of one per VAT rate"),
  'rp-vat-check-off': later('Issue #116 question 6: invoice check later'),
  'rp-margin': keep(5),
  'rp-workshop': keep(5),
  'rp-workshop-all': into('rp-workshop', '', "All shops: each table split by shop; mechanics with their shop, 'Jo Taylor · works at both'"),
  'rp-discounts': keep(5),
  'rp-discounts-staff': into('rp-discounts', '', "Staff: no 'By' column — who gave each discount isn't shown"),
  'rp-returning': keep(5),
  'rp-c2w': keep(5),
  'rp-accounts-connect': keep(1), // Settings › Your data › Accounts software: its own page (Reports and accounts 4)
  'rp-accounts-map': into('rp-accounts-connect', 'Reports and accounts 4', "'Connected to Xero': choose a Xero account for each sales category, payment type and everything else"),
  'rp-accounts-c2w': into('rp-accounts-connect', 'Reports and accounts 4', "Scrolled down: Cycle to Work owed, its commission and shortfalls, each to a Xero account"),
  'rp-accounts-missing': into('rp-accounts-connect', 'Reports and accounts 4', "'1 account to choose': 'Accessories No Xero account chosen — days with Accessories sales can’t be sent'"),
  'rp-accounts-log': into('rp-accounts-connect', 'Reports and accounts 4', "What was sent, day by day per shop: 'Not closed yet', a missing account, 'Waiting', 'Sent'"),
  'rp-accounts-lost': into('rp-accounts-connect', 'Reports and accounts 4', "'Xero disconnected on [date]. Nothing has been sent since.' with 'Reconnect Xero'; days 'Waiting'"),
  'rp-accounts-disconnect': into('rp-accounts-connect', 'Reports and accounts 4', "'Disconnect Xero?' box: days sent stay, choices kept; 'Keep connected' or 'Disconnect'"),
  'rp-today-accounts': into('op-today', '', "Card: 'Wednesday 16 September didn’t go to Xero' with 'Choose an account for [Category]'"),
  'rp-person': into('set-staff-person', '', "'Can see reports' on, 'Can see costs and margin' off, each with what it adds"),
};

// Decisions drawn as lines, with no old drawing behind them ("Draw the
// decisions" spec, section 2: R2–R4).
export const lines = [
  // Third walk, answer 3 (walk-through 11 Q2).
  { on: 'rp-home', text: 'A shop’s name in the strip opens that shop’s Sales report, with the shop menu switched to that shop', who: 'Owner', decision: '3 Oct (third walk, answer 3)' },
  { on: 'rp-home', text: 'Staff with Can see reports, without Can see costs and margin: no margin figure in the strip', who: 'Staff', decision: 'Reports and accounts 5; issue #116 question 1' },
  { on: 'rp-margin', text: 'Margin and stock value for all shops: a shop column', who: 'Owner', decision: 'Reports and accounts 8 (M13)' },
  { on: 'rp-discounts', text: 'Discounts and refunds for all shops: a shop column', who: 'Owner', decision: 'Reports and accounts 8 (M13)' },
  // "Draw the answers" spec, section 9 (R4).
  { on: 'rp-margin', text: "Cycle to Work bikes: margin after the provider's commission, taken from the provider's settings at the sale and corrected when the bike is marked paid, so a closed day's margin can move", who: 'Owner', decision: 'Reports and accounts, 3 Oct (walk-through 5 M3)' },
];
