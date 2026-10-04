// Journey B, Signing in — where each button goes in the mockup.
import { go, STAY, BACK, outside } from '../controls.mjs';

// The PIN pad: each key acts in place (the fourth digit checks you in).
const PAD = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete the last digit'].map((k) => [k, STAY]));

export default {
  '*': {
    ...PAD,
    'Serving: Jack Lewis — switch who’s serving': STAY,
    'Give me a different one': STAY,
    'Sign in again': go('workos-signin'),
    'Send a new code': STAY,
    'Use a different email': go('cust-signin'),
  },
  'workos-signin': { Continue: go('auth-site'), 'Forgot your password?': outside('WorkOS’s reset-your-password page') },
  'auth-site': {
    'Bolton North Street Cycles · Till B1 Last time': go('op-today'),
    '[Second site] North Street Cycles 3 need attention': go('ms-switched'),
    'All shops Owners, and managers at two or more shops': go('ms-today-all'),
  },
  'auth-noaccess': { 'Go to Today': go('op-today-staff') },
  'cust-signin': { 'Email me a code': go('cust-code') },
  // The PIN pad: the real till moves on after the fourth digit. In the mockup
  // any digit stands for the whole PIN and opens the till; only the first
  // check-in of the day opens the float check (Opening the shop 2; walk-through
  // 10 L1). `first` is used by a story step marked `firstIn`.
  'till-checkin': Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((k) => [k, { ...go('till-empty'), first: 'op-float-check' }])),
  // A workshop computer's PIN opens the diary as that person (third walk, answer 8).
  'till-checkin-workshop': Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((k) => [k, go('diary-mechanic', 'Now working: Alex Morgan')])),
  'till-setup': { 'Make this computer Till B1': go('till-checkin'), 'Make this device Till B1': go('till-checkin') },
  // Change PIN from Your settings
  'pin-change': { 'Keep this PIN': go('your-settings') },
  // First sign-in: the PIN box opens over the diary
  // Staff land on Front desk › Till (App map 11; third walk, walk-through 4 L1).
  'pin-first': { 'Keep this PIN': go('till-sale'), 'Skip for now': go('op-today-staff') },
  'pin-cleared': { 'Keep this PIN': go('till-sale'), 'Skip for now': go('op-today-staff') },
  // Given at the till: then back to the PIN screen
  'till-give-pin': { 'Keep this PIN': go('till-checkin'), 'Close without giving a PIN': BACK },
};
