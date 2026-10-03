// Journey 20, Management oversight — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ops-reports-home': into('rp-home', ''),
  'ops-reports-staff': into('rp-home', ''),
  'ops-log': keep(14),
  'ops-log-manager': into('ops-log', ''),
  'ops-log-all': into('ops-log', ''),
  'ops-log-filtered': later('Issue #116 question 5: oversight extras later'),
  'ops-log-empty': into('ops-log', ''),
  'ops-log-refused': into('ops-log', ''),
  'ops-first-note': later('Issue #116 question 5: oversight extras later'),
  'ops-your-settings': later('Issue #116 question 5: oversight extras later'),
  'ops-my-activity': later('Issue #116 question 5: "What Wheelhouse records about you" and See my own activity (audit H2) later'),
  'ops-today-alerts': later('Issue #116 question 5: oversight extras later'),
  'ops-alert-settings': later('Issue #116 question 5: oversight extras later'),
  'ops-devices': later('Issue #116 question 5: oversight extras later'),
  'ops-till-checkout': into('till-sale', 'Management oversight 6 H5'), // inferred: the button is on the till ("Check out Jo Taylor"), not one of the deferred extras
  'ops-devices-signout': later('Issue #116 question 5: oversight extras later'),
  'ops-devices-signed-out': later('Issue #116 question 5: oversight extras later'),
  'ops-person': later('Issue #116 question 5: oversight extras later'),
  'ops-person-everywhere': later('Issue #116 question 5: oversight extras later'),
  'ops-feedback-empty': later('Issue #116 question 5: oversight extras later'),
  'ops-feedback': later('Issue #116 question 5: oversight extras later'),
  'ops-feedback-shot': later('Issue #116 question 5: oversight extras later'),
  'ops-feedback-failed': later('Issue #116 question 5: oversight extras later'),
  'ops-feedback-sent': later('Issue #116 question 5: oversight extras later'),
};
