// Journey A, How Wheelhouse fits together — where each button goes in the mockup.
import { go, STAY, BACK, notDrawn } from '../controls.mjs';

export default {
  '*': {
    'Take payment · £111.00': go('till-pay'),
  },
  'site-menu': { Account: go('ac-account') },
  'site-ocean-menu': { Account: go('ac-account') },
  'staff-app': { 'Showing Everyone. Change whose jobs are shown': STAY },
  'staff-app-menu': { 'Close menu': BACK },
  'till-rail': { 'Open the basket': notDrawn('The basket opened on a phone till (the phone till shows it only as a bottom bar)') },
  // The search's rows (App map, 3 Oct; third walk, answers 1 and 8): each
  // row's name opens its page; the button on the right does the till action.
  'till-search': {
    'Take payment': go('till-pay'),
    'WH-1042 · Maya Patel': go('job-overview'),
    'Order [order number] · Maya Patel': go('on-order-staff'),
    'Maya Patel': go('cs-page'),
    'Book in WH-1042': go('till-book-in'),
    'Hand over order [order number]': go('till-collect'),
    'Add Maya Patel to the sale': go('till-customer'),
  },
  // WH-1042 paid online: Hand over opens the till's hand-over (walk-through 8
  // decision 8; walk-through 10 H1).
  'till-search-paid': {
    'WH-1042 · Maya Patel': go('cp-ready-paid'),
    'Hand over WH-1042': go('till-hand-over-job'),
  },
  // The header search on a staff page: rows open their pages, no till buttons.
  'staff-search': {
    'WH-1042 · Maya Patel': go('job-overview'),
    'Order [order number] · Maya Patel': go('on-order-staff'),
    'Maya Patel': go('cs-page'),
    'Close search': BACK,
  },
};
