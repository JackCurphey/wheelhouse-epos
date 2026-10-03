// Journey 20, Management oversight — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ops-reports-home': into('rp-home', '', "'Activity log' shown beside the ready-made reports"),
  'ops-reports-staff': into('rp-home', '', "Staff with 'Can see reports': no 'Activity log'; shared reports say 'Shared by Jack Lewis'"),
  'ops-log': keep(14),
  'ops-log-manager': into('ops-log', '', "Manager: 'managers and the owner see everyone’s lines'"),
  'ops-log-all': into('ops-log', '', "All shops: a 'Shop' column on every line; 'owners and managers only'"),
  'ops-log-filtered': later('Issue #116 question 5: oversight extras later'),
  'ops-log-empty': into('ops-log', '', "'Nothing matches: Alex Morgan made no refunds today.' with 'Clear the filters'"),
  'ops-log-refused': into('ops-log', '', "Staff: 'Only owners and managers see the activity log'; 'See my own activity', 'Back to Today'"),
  'ops-first-note': later('Issue #116 question 5: oversight extras later'),
  'ops-your-settings': later('Issue #116 question 5: oversight extras later'),
  'ops-my-activity': later('Issue #116 question 5: "What Wheelhouse records about you" and See my own activity (audit H2) later'),
  'ops-today-alerts': later('Issue #116 question 5: oversight extras later'),
  'ops-alert-settings': later('Issue #116 question 5: oversight extras later'),
  'ops-devices': later('Issue #116 question 5: oversight extras later'),
  'ops-till-checkout': into('till-sale', 'Management oversight 6 H5', "'Check Jo Taylor out of Till B1?' box: 'After this sale' or 'Now' (basket put on hold)"), // inferred: the button is on the till ("Check out Jo Taylor"), not one of the deferred extras
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
