// Journey 16, Close the day — where each button goes in the mockup.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

const ATTENTION = {
  Check: go('eod-check'),
  'Resume the sale in the basket': go('till-sale'),
  'Resume the parked sale': go('till-sale'),
  'Clear the sale in the basket': STAY,
  'Clear the parked sale': STAY,
};

export default {
  '*': {
    'Serving: Jack Lewis — switch who’s serving': STAY,
    'Check again': STAY,
    'Add a paid-out': go('eod-paidout'),
    // A clean night: the card machine matches, so the report step opens next
    // (Cash-up 6); eod-card draws the night it doesn't.
    'Banking bagged — next step': go('eod-finish'),
    'Count again': go('eod-count'),
    'Keep this count and go on': go('eod-banking'),
  },
  // The till with Close the day in the bar
  'eod-entry': {
    'Take payment': STAY, // the basket is empty at closing (third walk, walk-through 10 L2)
    'Add a customer (optional)': go('till-customer'),
    'Standard service Labour · 60 min £65.00': STAY,
    'Fit & adjust brakes Labour · 30 min £18.00': STAY,
    'Fit & adjust brakes Labour · 30 min': STAY,
    'Replace gear cable Labour £12.00': STAY,
    'Shimano brake pads Part · B05S-RX': STAY,
    'Take payment · £74.00': go('till-pay'),
    'Open the sale': notDrawn('The sale opened on a phone till (the phone till shows it only as a bottom bar)'),
  },
  'eod-attention': ATTENTION,
  'eod-check': { ...ATTENTION, 'Save and mark checked': BACK, 'Leave for now': BACK },
  'eod-count': { 'Done counting — show the difference': go('eod-count-result') },
  'eod-count-shown': { 'Done counting': go('eod-count-result') },
  'eod-paidout': { 'Take it out · open the drawer': go('eod-banking') },
  'eod-card': { 'Match to a sale': notDrawn('Choosing the sale a card-machine-only payment belongs to (Close the day, card step)') },
  'eod-finish': { 'Close the day and show the report': go('eod-z') },
  // Close after closing the day goes to the till (third walk, walk-throughs 2 L1, 10 L3).
  'eod-z': { Close: go('till-empty'), 'see Reports': go('rp-takings'), 'Email it': outside('The day’s report, emailed'), Email: outside('The day’s report, emailed') },
};
