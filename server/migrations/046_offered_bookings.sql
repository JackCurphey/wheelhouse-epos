-- Offering another time for a booking request (Jack, 20 Oct,
-- docs/decisions/2026-10-20-offer-another-time.md): a request the shop has
-- moved to a time it suggests waits as 'offered' until the customer accepts
-- or cancels. The offer moves the job itself, so its hold follows (answer 1:
-- only the suggested time is kept free). Additive apart from the two
-- re-made definitions below, which only widen what they allow.
-- Spec: openspec/changes/offer-another-time/design.md

-- The state 'offered'. The CHECK below is rendered from the booking machine
-- by server/workshop/render-constraints.mjs; the drift test holds this file
-- to it (MIGRATION_COLUMNS now points here).
ALTER TABLE workshop_jobs DROP CONSTRAINT workshop_jobs_booking_state_check;
ALTER TABLE workshop_jobs ADD CONSTRAINT workshop_jobs_booking_state_check
  CHECK (booking_state IN ('pending', 'offered', 'scheduled', 'reschedule_requested', 'declined', 'expired', 'cancelled'));

-- The old screens' status reads an offer as a request ('pending'), as
-- server/workshop/legacy-status.mjs does. Nothing indexes or views it, so it
-- is re-made in place; every row's value is recomputed.
ALTER TABLE workshop_jobs
  DROP COLUMN status,
  ADD COLUMN status TEXT NOT NULL GENERATED ALWAYS AS (
    CASE
      WHEN booking_state IN ('declined', 'expired', 'cancelled') THEN 'complete'
      WHEN work_state = 'complete' THEN 'complete'
      WHEN work_state = 'waiting_parts' THEN 'waiting_parts'
      WHEN work_state = 'on_hold' THEN 'on_hold'
      WHEN booking_state IN ('pending', 'offered') THEN 'pending'
      ELSE 'scheduled'
    END
  ) STORED;

-- Where the customer first asked (for their page: "can't do Thursday 17
-- September at 11:30"), and the shop's message. Cleared once the offer is
-- accepted.
ALTER TABLE workshop_jobs
  ADD COLUMN offered_from_date TEXT,
  ADD COLUMN offered_from_time TEXT,
  ADD COLUMN offer_message TEXT;

-- When the customer accepted an offer, so pressing Accept again answers with
-- the confirmed booking rather than a refusal.
ALTER TABLE workshop_jobs ADD COLUMN offer_accepted_at TIMESTAMPTZ;
