// Journey 3, Book a repair — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // Booking: the booking page, one drawing per step open (Book 2, 9)
  'bk-service': keep(36),
  'bk-service-chosen': into('bk-service', 'Book 2, 9', "step 1 already closed to 'Brake service · £[price]'; opens on 'Your bike'"),
  'bk-service-many': into('bk-service', 'Book 2, 9', "'Search [n] individual services' box and 'Show all [n] individual services'"),
  'bk-bike': keep(36),
  'bk-bike-signed-in': into('bk-bike', 'Book 2, 9', "'Signed in as Maya Patel'; saved-bike cards, 'A different bike'; deposit shown from the start"),
  'bk-not-sure': into('bk-bike', 'Book 2, 9', "'What have you noticed?': Brompton C Line, 'What’s happening?', price 'Agreed with you first'"),
  'bk-when': keep(36),
  'bk-when-full': into('bk-when', 'Book 2, 9', "no time chosen; full Friday 18 explains 'Fully booked…' on hover"),
  'bk-when-dropoff': into('bk-when', 'Book 2, 9', "'Drop your bike off between 09:00 and 10:00' (the shop's drop-off window) and 'Who would you like to work on it?'"),
  'bk-details': keep(36),
  'bk-details-deposit': into('bk-details', 'Book 2, 9', "signed-in contact line, 'Deposit · £[deposit]' card form, 'Pay £[deposit] and send request'"),
  // Sending: 5 of the 8 are situations of the booking page's last step
  'bk-sending': into('bk-details', 'Book 2, 9', "button reads 'Sending…'; 'Sending your booking — this takes a moment.'"),
  'bk-card-failed': into('bk-details', 'Book 2, 9', "'The card didn’t go through.' — nothing taken, nothing booked; 'Try again'"),
  'bk-not-sent': into('bk-details', 'Book 2, 9', "'Not sent yet — check your connection.' Everything typed kept; 'Try again'"),
  'bk-checking-payment': into('bk-details', 'Book 2, 9', "'We’re checking whether your payment went through — please don’t pay again'; 'Check again'"),
  'bk-resume': into('bk-details', 'Book 2, 9', "'You didn’t finish booking.' banner with 'Carry on' and 'Start again'"),
  // "Booking sent": 1 drawing, 3 situations
  'bk-request': into('bk-page', 'Book 8; walk-through 1 L1 (one drawing per page)', "Just sent: 'Thanks, Maya — your request is with us'"),
  'bk-request-deposit': into('bk-page', 'Book 8', "adds 'Deposit paid £[deposit]', 'Free to cancel until', and the deposit-back line"),
  'bk-confirmed': into('bk-page', 'Book 8', "green 'Booking confirmed': 'See you on Thursday 17 September, Maya'; 'Cancel booking'"),
  // Your booking: the one customer job page
  'bk-bookings': into('ac-account', '', "'Your bookings' list: 'Coming up' and 'Earlier' cards, each with 'Open'"), // inferred — report Low 7: overlaps journey 7's account list of repairs; left out of its reduced count
  'bk-page-request': into('bk-page', 'Quote 1', "'Your booking request', purple 'Waiting for the shop to confirm'; 'Cancel request'"),
  'bk-offered': into('bk-page', 'Quote 1', "'The shop has suggested another time': 'Accept this time' or 'Cancel my request'"),
  'bk-page': keep(37),
  'bk-page-dropoff': into('bk-page', 'Quote 1', "'drop off 09:00–10:00', 'Mechanic: Alex Morgan'"),
  'bk-change': keep(37),
  'bk-change-pending': into('bk-change', 'Quote 1', "purple 'New date waiting for the shop'; 'Cancel my date change' button"),
  'bk-change-declined': into('bk-change', 'Quote 1', "warning 'The shop couldn’t do Friday 25 September.' — still Thursday"),
  // Cancelling
  'bk-cancel': keep(8),
  'bk-cancel-late': into('bk-cancel', 'Book 10', "'your £[deposit] deposit isn’t refundable'; 'Cancel and lose the deposit'"),
  'bk-cancelled': into('bk-page', 'Quote 1', "'Your booking is cancelled': deposit back in [n] working days; 'Book another time'"),
  'bk-cancelled-late': into('bk-page', 'Quote 1', "'Your booking is cancelled': deposit 'was kept, because it was after [date and time]'"),
  'bk-declined': into('bk-page', 'Quote 1', "'Sorry, we can’t fit this booking in', the shop’s message, deposit refunded"),
  'bk-expired': into('bk-page', 'Walk-through 1 M5', "'This booking link has expired' — only 'Book a repair' and shop details"),
  'bk-unavailable': into('bk-service', '', "no steps: 'Online booking is unavailable just now' — call the shop"), // inferred — edge case not in the merge table; shown in place of the booking page
  // A Lightspeed shop
  'bk-page-ls': into('bk-page', 'Quote 1', "no Basket in the header"),
  'bk-cancel-ls': into('bk-cancel', 'Book 10', "cancel pop-up says 'There’s nothing to pay or refund.'"),
  // The shop's side
  'bk-staff-request': into('diary', '', "request pop-up: 'Deposit paid £[deposit]', 'Customer OK up to £[amount]', updates choice"),
  'bk-staff-decline': into('diary', '', "'Decline booking request' pop-up: 'deposit is refunded automatically'"),
  'bk-messages': into('set-msg-list', 'Receiving 7', "scrolled to 'Booking messages': six rows, 'Request received' to 'Booking cancelled'"),
  'bk-settings': keep(1),
  'bk-settings-deposits': into('bk-settings', 'Book 11', "scrolled to 'Deposits' and 'Terms': 'Free to cancel until', 'Use your own'"),
};

// Situation lines with no old drawing behind them ("Draw the answers" BK3).
export const lines = [
  { on: 'bk-settings', text: "'A day to drop off' chosen: a 'Drop-off window' row, [09:00] to [10:00], that every drop-off customer is told", who: 'Manager', decision: 'Booking mode 2026-09-04 §2 item 3; Book a repair, 3 Oct (drop-off window)' },
  { on: 'bk-page', text: 'Confirmed, after paying a deposit: Deposit paid £[deposit] and Free to cancel until [date and time]', who: 'Customer', decision: 'Book a repair 8; walk-through 1 M3' },
];
