// Journey 8, Owner setup and onboarding — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'fr-today': keep(7),
  'fr-today-moving': later('Issue #116 question 4: practice mode dropped, so its "tills in practice" wording is out of date; one checklist while moving is still to draw (consolidation-back-office.md finding 5)'),
  'fr-step': into('set-pay-ways', '', "Getting started banner: 'Connect the card machine', 'Next: Invite your staff'; 'No card machine yet'"), // inferred: the Payments page with the Getting started banner
  'fr-done': into('fr-today', '', "Checklist gone: 'You’re all set up. You can change any of it in Settings.'"),
  'set-list': into('set-till-quick', '', "Phone: Settings is a list of rooms, each saying what's in it, e.g. 'Till, payments, messages, end of day'"), // inferred: the Settings frame on a phone (rule 3: other sizes become written rules)
  'set-till-quick': keep(1),
  'set-till-quick-add': keep(9),
  'set-till-quick-saved': into('set-till-quick', '', "Toast after adding: 'Saved · Shimano brake pads added to Workshop' with 'Undo'"),
  'set-till-reasons': into('set-till-quick', '', "Reasons page: a list each for Discount, Void, Refund, Paid-out; till always offers 'Other…'"),
  'set-till-receipts': into('set-till-quick', '', "Receipts page: offer 'Print', 'Email', 'Text'; 'Words at the bottom'; a receipt preview"),
  'set-till-printer': into('set-till-quick', '', "Printer and cash drawer page: 'Connected'; 'Print a test receipt', 'Open the drawer'"),
  'set-till-tills': into('set-till-quick', '', "Tills page, Manager: 'Rename' only; 'Only the owner can add or remove tills.'"),
  'set-till-tills-owner': into('set-till-quick', '', "Tills page, owner: adds 'Make this computer a till'"),
  'set-till-remove': into('set-till-quick', '', "'Remove Till B1?' box: 'Keep the till' or 'Remove the till'"),
  'set-till-empty': into('set-till-quick', '', "No buttons: 'No quick buttons yet' — add the things you sell most"),
  'set-eod': keep(1),
  'set-eod-close': into('set-eod', '', "Adds 'Show “Close the day” in the till bar': at closing time, 30 minutes or 1 hour before"),
  'set-save-failed': into('set-eod', '', "'Not saved — no internet connection. Your change is kept here.' with 'Try again'"),
  'set-pay-ways': keep(1),
  'set-pay-other': into('set-pay-ways', '', "Other ways to pay: Finance, Cycle to Work, 'Payment link' (needs setting up first), 'Add'"),
  'set-pay-card': into('set-pay-ways', '', "Card machine page: each till shows '[Card machine] connected' or 'Connect a card machine'"),
  'set-staff': keep(1),
  'set-staff-person': keep(9),
  'set-staff-person-all': into('set-staff-person', '', "Switch on: 'Everything a Manager can do — Jo’s role still says Staff'"),
  'set-staff-clear-pin': into('set-staff-person', '', "'Clear Jo Taylor’s till PIN?' box: 'Keep the PIN' or 'Clear the PIN'"), // inferred: a yes/no box opened from the person's till PIN
  'set-staff-roles': into('set-staff', '', "What each role can do: Owner, Manager, Staff, Mechanic, one line each"),
  'set-staff-invite': keep(9),
  'set-staff-invited': into('set-staff', '', "Jo 'Invited [date] · not joined yet' with 'Send again', 'Cancel the invite'; a 'Till only' person"),
  'set-staff-invite-expired': into('set-staff', '', "Jo's row says 'Invite expired' with 'Send again'"),
  'set-staff-invite-till-only': into('set-staff-invite', '', "'No email — they use the till only': name only; their PIN is given at the till"),
  'set-shop-details': keep(1),
  'set-shop-hours': into('set-shop-details', '', "Opening hours page: Mon to Sun, open and close times, or 'Closed'"),
  'set-workshop-services': keep(1),
  'set-workshop-mechanics': into('set-workshop-services', '', "Mechanics page: who customers can book online; a column for 'Jobs for whoever’s free'"),
  'set-workshop-diary': keep(1), // owner of Settings › Workshop diary (journey 12's diary-settings goes into it)
  'set-msg-list': keep(1),
  'set-msg-edit': keep(9), // inferred: a box with its own form
  'set-msg-new': keep(9), // inferred: a box with its own form
  'set-msg-alongside': into('set-msg-list', '', "Running alongside Citrus Lime: '25 on · none sent until switch-over'"),
  'set-data-export': keep(1),
  'set-data-history': keep(14), // kept: Management oversight 1 — "the histories already drawn (Settings changes…) stay"
};

// "Draw the decisions" S4: a decision drawn as a line (spec B0).
export const lines = [
  { on: 'set-staff-person', text: 'Uses a workshop computer: needs a PIN, not only people with Can use the till', who: 'Owner', decision: 'Walk-through 8, decision 1' },
  // "Draw the answers" S3, S5, S7, S8: Jack's 3 Oct answers drawn as lines.
  { on: 'set-staff-person', text: 'Give a new PIN, from your own phone: a one-time PIN to read out over a call; they change it at check-in', who: 'Owner and Manager', decision: 'Signing in, 3 Oct (walk-through 10 M2)' },
  { on: 'fr-today', text: 'Running alongside Citrus Lime: the tills start on switch-over day', who: 'Owner', decision: 'Moving from Citrus Lime, 3 Oct (walk-through 4 H2)' },
  { on: 'set-msg-list', text: 'Request received, draft: Hi Maya, North Street Cycles, Bolton has your request for a Standard service on your Trek Domane AL 3, Thu 17 Sep, 11:30. We\'ll let you know when it\'s confirmed. See your booking: [link] — no app or sign-in needed. Job WH-1042.', who: 'Manager', decision: 'Build-plan questions Q9, 3 Oct (walk-through 12 M2)' },
  { on: 'set-msg-list', text: 'Booking confirmed, draft: Hi Maya, your Standard service at North Street Cycles, Bolton is booked for Thu 17 Sep: bring your Trek Domane AL 3 at 11:30. See or change your booking: [link] — no app or sign-in needed. Job WH-1042.', who: 'Manager', decision: 'Build-plan questions Q9, 3 Oct (walk-through 12 M2)' },
  { on: 'set-msg-list', text: 'Quote to approve, draft: Hi Maya, North Street Cycles, Bolton has a quote for more work on your Trek Domane AL 3. See it and say yes or no to each part: [link] — no app or sign-in needed. Job WH-1042.', who: 'Manager', decision: 'Build-plan questions Q9, 3 Oct (walk-through 12 M2)' },
  { on: 'set-till-quick', text: 'Workshop computers, listed beside the tills: [name] · … › Stop using as a workshop computer', who: 'Owner', decision: 'Walk-through 8 decision 1; 3 Oct (walk-through 8 H3)' },
  { on: 'set-till-quick', text: 'A till\'s …: Check Jo Taylor out', who: 'Owner', decision: 'Walk-through 8, 3 Oct (walk-through 8 H3)' },
];
