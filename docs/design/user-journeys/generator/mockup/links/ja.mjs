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
  // The search's rows: an online order's Hand over opens the till's hand-over;
  // a job's Add to basket puts it in the basket (walk-throughs 2 and 10, M4).
  'till-search': {
    'Take payment': go('till-pay'),
    'Order [order number] · Maya Patel Online order · ready Hand over': go('till-collect'),
    'WH-1042 · Maya Patel Trek Domane AL 3 · Standard service · approved £111.00 Add to basket ↵': go('till-job'),
  },
};
