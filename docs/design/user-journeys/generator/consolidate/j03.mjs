// Journey 3, Book a repair — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // Booking: the booking page, one drawing per step open (Book 2, 9)
  'bk-service': keep(36),
  'bk-service-chosen': into('bk-service', 'Book 2, 9'),
  'bk-service-many': into('bk-service', 'Book 2, 9'),
  'bk-bike': keep(36),
  'bk-bike-signed-in': into('bk-bike', 'Book 2, 9'),
  'bk-not-sure': into('bk-bike', 'Book 2, 9'),
  'bk-when': keep(36),
  'bk-when-full': into('bk-when', 'Book 2, 9'),
  'bk-when-dropoff': into('bk-when', 'Book 2, 9'),
  'bk-details': keep(36),
  'bk-details-deposit': into('bk-details', 'Book 2, 9'),
  // Sending: 5 of the 8 are situations of the booking page's last step
  'bk-sending': into('bk-details', 'Book 2, 9'),
  'bk-card-failed': into('bk-details', 'Book 2, 9'),
  'bk-not-sent': into('bk-details', 'Book 2, 9'),
  'bk-checking-payment': into('bk-details', 'Book 2, 9'),
  'bk-resume': into('bk-details', 'Book 2, 9'),
  // "Booking sent": 1 drawing, 3 situations
  'bk-request': keep(40),
  'bk-request-deposit': into('bk-request', 'Book 8'),
  'bk-confirmed': into('bk-request', 'Book 8'),
  // Your booking: the one customer job page
  'bk-bookings': into('ac-account', ''), // inferred — report Low 7: overlaps journey 7's account list of repairs; left out of its reduced count
  'bk-page-request': into('bk-page', 'Quote 1'),
  'bk-offered': into('bk-page', 'Quote 1'),
  'bk-page': keep(37),
  'bk-page-dropoff': into('bk-page', 'Quote 1'),
  'bk-change': keep(37),
  'bk-change-pending': into('bk-change', 'Quote 1'),
  'bk-change-declined': into('bk-change', 'Quote 1'),
  // Cancelling
  'bk-cancel': keep(8),
  'bk-cancel-late': into('bk-cancel', 'Book 10'),
  'bk-cancelled': into('bk-page', 'Quote 1'),
  'bk-cancelled-late': into('bk-page', 'Quote 1'),
  'bk-declined': into('bk-page', 'Quote 1'),
  'bk-expired': into('bk-page', 'Walk-through 1 M5'),
  'bk-unavailable': into('bk-service', ''), // inferred — edge case not in the merge table; shown in place of the booking page
  // A Lightspeed shop
  'bk-page-ls': into('bk-page', 'Quote 1'),
  'bk-cancel-ls': into('bk-cancel', 'Book 10'),
  // The shop's side
  'bk-staff-request': into('diary', ''),
  'bk-staff-decline': into('diary', ''),
  'bk-messages': into('set-msg-list', 'Receiving 7'),
  'bk-settings': keep(1),
  'bk-settings-deposits': into('bk-settings', 'Book 11'),
};
