-- Trust PIN on the workshop computer (openspec/changes/trust-pin-workshop,
-- the contract; roles and switches 3 and 9; stage-1 gaps 9; shops and
-- sites 1). One setting for the whole business, on the shop's row like the
-- float until the settings store (WP-1.2): trust PIN, off to start, and how
-- long a workshop computer waits before going back to the start, 5, 10, 15
-- or 30 minutes or null for Off, 10 to start (it applies only with trust
-- PIN on). On each check-in, whether it was made by tapping a name rather
-- than typing a PIN; on each person, when their PIN was last set. Additive
-- and safe to run twice; pin_checkins keeps its row-level security from
-- migration 097.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS trust_pin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS workshop_idle_minutes INTEGER DEFAULT 10
  CHECK (workshop_idle_minutes IS NULL OR workshop_idle_minutes IN (5, 10, 15, 30));

ALTER TABLE pin_checkins ADD COLUMN IF NOT EXISTS by_tap BOOLEAN NOT NULL DEFAULT false;

-- When each person's PIN was last set (kept), so a changed PIN takes them
-- off "Who's working?" until they type the new one, as a cleared one does
-- (the review, 29 Oct). Null for a PIN set before 103.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ;
