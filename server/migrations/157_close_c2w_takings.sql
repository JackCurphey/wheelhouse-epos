-- Cycle to Work money at the close (openspec/changes/cycle-to-work, task 10.4; UX walk-through 5 H3):
-- a hand-over's provider share is owed by the provider, not in the drawer, so the close keeps it as a
-- figure of its own beside Other, and Takings and the end-of-day report show it on its own line. Takings
-- stays card + cash + other + Cycle to Work, so it still adds up. A day closed before this kept that money
-- in Other, so its Cycle to Work figure reads 0. The history of a reopened day keeps it too. Additive and
-- safe to run twice.
ALTER TABLE day_closes ADD COLUMN IF NOT EXISTS c2w_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE day_close_history ADD COLUMN IF NOT EXISTS c2w_pence INTEGER NOT NULL DEFAULT 0;
