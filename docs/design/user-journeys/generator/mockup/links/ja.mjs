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
  'till-search': { 'Take payment': go('till-pay') },
};
