// Journey 21, Lightspeed (after the trading week) — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-12-21.md merge table. Consolidated like the rest
// (spec decision log): keep/into, not later.
import { keep, into } from './plan.mjs';

const STRIP = 'Lightspeed 2, 3, 6, 10 (H3), 12';

export default {
  // Connecting Lightspeed
  'ls-settings-off': into('ls-settings-on', 'Lightspeed 7', "Not connected: what it does, what Wheelhouse never does; 'Connect Lightspeed'"),
  'ls-connect-signin': keep(7),
  'ls-connect-shops': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)', "Step 2 'Shops and staff': 'One shop: Bolton is linked'; staff matched; 'Alex doesn’t use Lightspeed'"),
  'ls-connect-shops-two': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)', "Step 2 at two shops: 'Which Lightspeed shop is Bolton?' and '[Second site]?'"),
  'ls-connect-checks': into('ls-connect-signin', 'Lightspeed 7, 10 (M5)', "Step 3 'What works': '2 working · 3 will show on first use.'; 'Done'"),
  'ls-settings-on': keep(1),
  'ls-settings-manager': into('ls-settings-on', 'Lightspeed 7', "Manager, read only: no buttons; 'Only the owner can connect, disconnect or check Lightspeed.'"),
  'ls-disconnect': into('ls-settings-on', 'Lightspeed 10 (L5)', "'Disconnect Lightspeed?' box: what stays and stops; 'Keep connected' or 'Disconnect'"), // report: shared "Are you sure?" box; no owner for it, so a line on the page it opens over
  'ls-reconnect': into('ls-settings-on', 'Lightspeed 7', "Warning 'Lightspeed signed Wheelhouse out on [date].'; 'Reconnect Lightspeed'"),
  // Quote and approval
  'ls-today': into('op-today', 'Lightspeed 6, 10', "Lightspeed shop: a 'Lightspeed · Up to date' section instead of the tills"),
  'ls-book-in': into('ls-customer-pick', 'Lightspeed 4; walk-through 6 M1', "At book-in over Today: 'Maya is at the desk'; 'Link and book in'; nothing sent yet"),
  'ls-job-not-connected': into('ls-job-sent', STRIP, "'Not in Lightspeed': 'Lightspeed isn’t connected'"),
  'ls-part-search': keep(17),
  'ls-part-search-down': into('ls-part-search', 'Lightspeed 5, 11', "Warning 'Showing products and stock as of [time].' Prices may have changed"),
  'ls-job-sent': keep(24), // the job page's Lightspeed strip, 14 lines
  'ls-job-changed': into('ls-job-sent', STRIP, "'work order [number] updated · now £[£]'; 'Maya approved the new price at [time]'"),
  'ls-job-price-changed': into('ls-job-sent', STRIP, "Amber 'Price changed in Lightspeed': £28.00 → £[£]; 'Keep £28.00' or 'Ask Maya again'"),
  'ls-job-price-asked': into('ls-job-sent', STRIP, "'Waiting for Maya’s answer': the work order keeps £28.00 until she answers"),
  'ls-job-cancelled': into('ls-job-sent', STRIP, "Status 'Cancelled': 'work order [number] marked cancelled in Lightspeed'; footer 'Done'"),
  'ls-job-pick': into('ls-job-sent', STRIP, "'Not sent yet': 'Choose Maya in Lightspeed'; button 'Choose the customer'"),
  'ls-customer-pick': keep(21),
  // When Lightspeed can't be reached
  'ls-job-waiting': into('ls-job-sent', STRIP, "'Waiting to reach Lightspeed': 'Wheelhouse keeps trying by itself'"),
  'ls-job-unsure': into('ls-job-sent', STRIP, "'Not sure it arrived': won’t send again; button 'Check this in Lightspeed'"),
  'ls-job-check': keep(9),
  'ls-today-down': into('op-today', 'Lightspeed 6, 10', "Line 'Can’t reach Lightspeed since [time]' with 'See the jobs'; section reads 'Can’t reach'"),
  'ls-today-person': into('op-today', 'Lightspeed 6, 10', "Line '2 jobs need someone to look at Lightspeed' with 'See the jobs'"), // repeats op-today-staff-lightspeed
  // Payment and collection
  'ls-job-ready-no-wo': into('ls-job-sent', STRIP, "Ready, 'Not in Lightspeed yet': Maya can’t pay at the till yet; 'Hand over'"),
  'ls-hand-over-no-wo': into('ls-job-check', 'Lightspeed 6; walk-through 6 H2', "'The work order isn’t in Lightspeed yet': 'Maya pays later' or 'Rung up in Lightspeed by hand'"),
  'ls-job-unpaid': into('ls-job-sent', STRIP, "Ready, 'Waiting to be paid in Lightspeed'; footer 'Hand over'"),
  'ls-hand-over-unpaid': keep(9),
  'ls-hand-over-found': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)', "'Paid in Lightspeed': 'Found it — work order [number] was paid at [time].'; 'Hand over'"),
  'ls-hand-over-unreachable': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)', "'Can’t reach Lightspeed to check': no 'Check Lightspeed now'; 'Hand over anyway'"),
  'ls-job-paid': into('ls-job-sent', STRIP, "Green 'Paid in Lightspeed' at [time]"),
  'ls-job-fallback': into('ls-job-sent', STRIP, "Payment not checked: 'Paid in Lightspeed' tick box beside 'Hand over'"),
  'ls-hand-over-unchecked': into('ls-hand-over-unpaid', 'Lightspeed 10 (H2, L5)', "'Has Maya paid?': check the till; 'Not yet' or 'Yes, she paid'"),
  'ls-job-collected-unpaid': into('ls-job-sent', STRIP, "Status 'Collected', 'not shown as paid in Lightspeed'; 'Done' and 'Mark it sorted…'"),
  'ls-job-sorted': keep(9), // "Mark it sorted" box, kept by the report
  'ls-today-unpaid': into('op-today', 'Lightspeed 6, 10', "Line 'Handed over, not paid in Lightspeed · Maya Patel · WH-1042'; 'Open the job'"),
  // Settings and the customer
  'ls-messages': into('set-msg-list', 'Lightspeed 10 (M1, M2)', "Lightspeed shop: '13 on', no online order messages; ready messages say 'pay at the till'"),
  'ls-office-data': into('ops-log', 'Lightspeed 10 (M1, M2)', "Settings › Your data's 'Activity' fold (Reports hidden): three entries, 'Open the activity log'"), // Settings › Your data's activity log; owner list's activity log is ops-log
  'ls-workshop-settings': into('set-workshop-services', 'Lightspeed 10 (M1, M2)', "Banner 'Deposits and paying online are off.'; Online booking 'no deposit'"), // Settings › Workshop page
  'ls-customer-ready': into('cp-summary', 'Walk-through 6 H1', "No 'Pay now': 'Agreed price £111.00 — pay at the till'"), // report: same as j05's cp-summary-ls; owner list names cp-summary
};

// Extra situation lines with no old drawing behind them ("Draw the decisions"
// spec, section 17: L1, L2, L4, L5).
export const lines = [
  // L1 — the strip keeps the button for its cause (walk-through 6 H2 option 1)
  { on: 'ls-job-sent', text: 'Ready, Maya still to choose: the strip keeps Choose the customer', who: 'Staff', decision: 'Walk-through 6 H2; Lightspeed shops 10' },
  { on: 'ls-job-sent', text: 'Ready, not sure it arrived: the strip keeps Check this in Lightspeed', who: 'Staff', decision: 'Walk-through 6 H2; Lightspeed shops 10' },
  // L4
  { on: 'ls-job-sent', text: 'Maya said no to £[£]: back to Keep £28.00 or Ask Maya again', who: 'Staff', decision: 'Walk-through 6 M4; Lightspeed shops 12' },
  // L2
  { on: 'ls-job-check', text: "The box's first sentence follows the cause", who: 'Staff', decision: 'Walk-through 6 H2; Lightspeed shops 10' },
  // L5
  { on: 'ls-customer-pick', text: "Changing Maya's Lightspeed customer: WH-1042's unpaid work order moves to the customer you choose; paid work orders stay where they are", who: 'Staff', decision: 'Walk-through 6 M3; Lightspeed shops 4' },
];
