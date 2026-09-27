-- Customers change or cancel through the private link (piece 12). A change to
-- a confirmed booking is a request staff answer: the day, mechanic and times
-- asked for are stored beside the booking's own until then, and the requested
-- slot is held in workshop_capacity_holds with purpose 'requested'. The 024
-- live-slot index is keyed on the slot - not the job, not the purpose - so it
-- keeps a requested slot from being double-booked as it does any booking's,
-- and a job may hold its own slot and a requested one at once.
-- cancelled_by says whose cancellation it was: a customer's shows in staff's
-- "Waiting for you" list until cancellation_seen_at is set. change_declined_at
-- tells the customer's link that staff declined their last change.
-- Additive only.
-- Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN requested_job_date TEXT,
  ADD COLUMN requested_mechanic_id INTEGER REFERENCES employees(id),
  ADD COLUMN requested_start_time TEXT,
  ADD COLUMN requested_end_time TEXT,
  ADD COLUMN requested_at TIMESTAMPTZ,
  ADD COLUMN cancelled_by TEXT
    CONSTRAINT workshop_jobs_cancelled_by_check CHECK (cancelled_by IN ('customer', 'staff')),
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancellation_seen_at TIMESTAMPTZ,
  ADD COLUMN change_declined_at TIMESTAMPTZ;

ALTER TABLE workshop_capacity_holds
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'booking'
    CONSTRAINT workshop_capacity_holds_purpose_check CHECK (purpose IN ('booking', 'requested'));

-- At most one live requested hold per job. The 024 index already stops a
-- requested slot from colliding with any other live hold on the same slot;
-- this stops a job from racking up more than one live requested hold at all
-- (e.g. a second change request queued before the first is answered), even
-- when the two requests point at different, otherwise-free slots.
CREATE UNIQUE INDEX idx_workshop_capacity_holds_one_requested_per_job
  ON workshop_capacity_holds (workshop_job_id)
  WHERE purpose = 'requested' AND state IN ('held', 'confirmed');
