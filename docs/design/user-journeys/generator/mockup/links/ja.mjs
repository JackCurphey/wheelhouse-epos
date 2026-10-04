// Journey A, How Wheelhouse fits together — where each button goes in the mockup.
import { go, STAY, BACK, notDrawn } from '../controls.mjs';

export default {
  '*': {
    'Take payment · £111.00': go('till-pay'),
  },
  // Coverage walk 1: the shop's own theme opens its own menu (M1); Close menu goes back (L1).
  'site-ocean': { 'Open menu': go('site-ocean-menu') },
  'site-menu': { Account: go('ac-account'), 'Close menu': BACK },
  'site-ocean-menu': { Account: go('ac-account'), 'Close menu': BACK },
  'staff-app': { 'Showing Everyone. Change whose jobs are shown': STAY },
  // On a phone, Messages is the list, then the conversation (Account 9; coverage walk 10 L1).
  'staff-app-menu': { 'Close menu': BACK, Messages: go('ac-inbox-list') },
  // Alex's own pages: his Diary is his (coverage walk 2 L1).
  'staff-app-mechanic': { Diary: go('diary-mechanic') },
  // Close leaves you where you were (coverage walks 2 L1, 3 M2).
  'your-settings': { Close: BACK },
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
