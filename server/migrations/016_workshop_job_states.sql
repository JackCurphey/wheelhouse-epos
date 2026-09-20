-- The Phase 1 state machines, given somewhere to live. See
-- docs/design/workshop-states.md (generated) and
-- server/workshop/state-machines.js (the source of truth for these values).
--
-- ADDITIVE ONLY. workshop_jobs.status keeps its five values, its default and
-- every reader: server.js, public/app.js and the customer portal are all still
-- on it and must keep working. Phase 3 moves the API across; a later migration
-- drops the column once nothing reads it. Nothing here touches it.
--
-- No backfill. When this was written the database held 30 workshop jobs, all in
-- Test Shop tenants, and both 'complete' rows were titled "Edited after
-- completion" - test residue. Nothing is deployed and no shop uses this
-- product, so there is no history to recover and no rule to invent. The open
-- question Phase 1 recorded - that the old column never said whether a finished
-- bike was collected - is answered by there being no real finished bikes.

-- One file, not five: a job with booking_state but no custody_state would be a
-- real half-state between two migrations, and each file runs in its own
-- transaction. Same reasoning as 015_booking_mode.sql.

ALTER TABLE workshop_jobs
  ADD COLUMN booking_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (booking_state IN ('pending', 'scheduled', 'reschedule_requested', 'declined', 'expired', 'cancelled')),
  ADD COLUMN custody_state TEXT NOT NULL DEFAULT 'expected'
    CHECK (custody_state IN ('expected', 'in_shop', 'collected')),
  ADD COLUMN work_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (work_state IN ('not_started', 'in_progress', 'waiting_parts', 'on_hold', 'complete'));

-- The immutable job reference a tag is printed with (WH-1042 in the atlas).
-- Nullable because every existing row predates it and this migration writes no
-- data; Phase 3 allocates one when it creates a job.
ALTER TABLE workshop_jobs ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX idx_workshop_jobs_shop_reference
  ON workshop_jobs (shop_id, reference) WHERE reference IS NOT NULL;

-- Effort the shop has committed to this job, independent of any start time: a
-- drop-off job reserves minutes without reserving a slot.
ALTER TABLE workshop_jobs ADD COLUMN planned_minutes INTEGER;

-- Optimistic concurrency. A conditional update on this column is how a stale
-- edit is rejected rather than silently overwriting someone else's change.
ALTER TABLE workshop_jobs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Job numbers count per shop. A global sequence would leak one shop's job
-- volume to another shop's customers, who see the reference on their tag and
-- in their messages. 1000 so the first reference reads WH-1000, not WH-1.
ALTER TABLE shops ADD COLUMN next_job_number INTEGER NOT NULL DEFAULT 1000;
