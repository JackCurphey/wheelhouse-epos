// Journey 8, Owner setup and onboarding — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'fr-today': keep(7),
  'fr-today-moving': later('Issue #116 question 4: practice mode dropped, so its "tills in practice" wording is out of date; one checklist while moving is still to draw (consolidation-back-office.md finding 5)'),
  'fr-step': into('set-pay-ways', ''), // inferred: the Payments page with the Getting started banner
  'fr-done': into('fr-today', ''),
  'set-list': into('set-till-quick', ''), // inferred: the Settings frame on a phone (rule 3: other sizes become written rules)
  'set-till-quick': keep(1),
  'set-till-quick-add': keep(9),
  'set-till-quick-saved': into('set-till-quick', ''),
  'set-till-reasons': into('set-till-quick', ''),
  'set-till-receipts': into('set-till-quick', ''),
  'set-till-printer': into('set-till-quick', ''),
  'set-till-tills': into('set-till-quick', ''),
  'set-till-tills-owner': into('set-till-quick', ''),
  'set-till-remove': into('set-till-quick', ''),
  'set-till-empty': into('set-till-quick', ''),
  'set-eod': keep(1),
  'set-eod-close': into('set-eod', ''),
  'set-save-failed': into('set-eod', ''),
  'set-pay-ways': keep(1),
  'set-pay-other': into('set-pay-ways', ''),
  'set-pay-card': into('set-pay-ways', ''),
  'set-staff': keep(1),
  'set-staff-person': keep(9),
  'set-staff-person-all': into('set-staff-person', ''),
  'set-staff-clear-pin': into('set-staff-person', ''), // inferred: a yes/no box opened from the person's till PIN
  'set-staff-roles': into('set-staff', ''),
  'set-staff-invite': keep(9),
  'set-staff-invited': into('set-staff', ''),
  'set-staff-invite-expired': into('set-staff', ''),
  'set-staff-invite-till-only': into('set-staff-invite', ''),
  'set-shop-details': keep(1),
  'set-shop-hours': into('set-shop-details', ''),
  'set-workshop-services': keep(1),
  'set-workshop-mechanics': into('set-workshop-services', ''),
  'set-workshop-diary': keep(1), // owner of Settings › Workshop diary (journey 12's diary-settings goes into it)
  'set-msg-list': keep(1),
  'set-msg-edit': keep(9), // inferred: a box with its own form
  'set-msg-new': keep(9), // inferred: a box with its own form
  'set-msg-alongside': into('set-msg-list', ''),
  'set-data-export': keep(1),
  'set-data-history': keep(14), // kept: Management oversight 1 — "the histories already drawn (Settings changes…) stay"
};

// "Draw the decisions" S4: a decision drawn as a line (spec B0).
export const lines = [
  { on: 'set-staff-person', text: 'Uses a workshop computer: needs a PIN, not only people with Can use the till', who: 'Owner', decision: 'Walk-through 8, decision 1' },
];
