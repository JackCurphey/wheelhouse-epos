-- The first PIN by itself (openspec/changes/whos-in-and-first-pin, the
-- contract; UX walk-through 4 H1; pin-first, pin-cleared): when a sign-in
-- last answered the first-time "Your till PIN" (Skip for now or Keep this
-- PIN), and when a person's PIN was last cleared, so a cleared PIN asks
-- again. Times only, no PIN. Additive and safe to run twice; both tables
-- keep their row-level security.
ALTER TABLE logins ADD COLUMN IF NOT EXISTS till_pin_asked_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_cleared_at TIMESTAMPTZ;
