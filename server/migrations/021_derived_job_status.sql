-- Phase 3. workshop_jobs.status stops being a column anyone writes and becomes
-- one Postgres derives from booking_state and work_state.
--
-- Why derive rather than keep it in step from application code: a shadow write
-- is a promise, and a future write path that forgets the helper puts the two
-- out of step silently. A generated column cannot be written at all - Postgres
-- refuses with "cannot insert a non-DEFAULT value into column status" - so
-- every writer that still exists fails loudly the moment this lands, which is
-- how they were all found.
--
-- custody_state is deliberately absent from the expression. The old column
-- never recorded whether the bike left, which is the gap Phase 1 recorded when
-- readLegacyStatus('complete') returned custody: null. Deriving a custody fact
-- for readers that never had one would be inventing history.
--
-- The mapping is duplicated from server/workshop/legacy-status.mjs, which is
-- the source and is round-tripped against readLegacyStatus() by
-- tests/workshop-legacy-status.test.js. Change it there first.
--
-- No data is lost. The database holds only Test Shop residue (see
-- 016_workshop_job_states.sql), and the dropped values are recomputed from the
-- state columns for every row.

ALTER TABLE workshop_jobs
  DROP COLUMN status,
  ADD COLUMN status TEXT NOT NULL GENERATED ALWAYS AS (
    CASE
      WHEN booking_state IN ('declined', 'expired', 'cancelled') THEN 'complete'
      WHEN work_state = 'complete' THEN 'complete'
      WHEN work_state = 'waiting_parts' THEN 'waiting_parts'
      WHEN work_state = 'on_hold' THEN 'on_hold'
      WHEN booking_state = 'pending' THEN 'pending'
      ELSE 'scheduled'
    END
  ) STORED;
