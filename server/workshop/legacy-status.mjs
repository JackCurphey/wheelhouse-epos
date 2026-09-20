// The bridge from the three state columns back to the old five-value
// workshop_jobs.status, for readers that have not moved yet: public/app.js and
// public-portal/. Phase 4 replaces both; this file dies with them.
//
// Hand-written, not generated from the machines. The machines do not hold this
// mapping and should not - it is a compatibility fact about two front-ends, not
// a fact about how a workshop works. What keeps it honest is
// tests/workshop-legacy-status.test.js, which round-trips every legacy value
// through readLegacyStatus() and this expression and requires the same value
// back, and checks that no combination of states can produce a sixth value the
// old front-ends have no label for.
//
// Order matters. A cancelled booking is tested before the work states because a
// cancelled job whose work never started must not read as 'pending' - the old
// diary would show it as awaiting approval and offer to approve it.
export const LEGACY_STATUS_SQL = `
  CASE
    WHEN booking_state IN ('declined', 'expired', 'cancelled') THEN 'complete'
    WHEN work_state = 'complete' THEN 'complete'
    WHEN work_state = 'waiting_parts' THEN 'waiting_parts'
    WHEN work_state = 'on_hold' THEN 'on_hold'
    WHEN booking_state = 'pending' THEN 'pending'
    ELSE 'scheduled'
  END`;

export const JOB_LEGACY_VALUES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete'];

export { readLegacyStatus } from './state-machines.js';
