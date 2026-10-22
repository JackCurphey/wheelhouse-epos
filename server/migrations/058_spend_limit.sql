-- The customer's spending limit (Workshop day 41-43,
-- docs/decisions/2026-09-27-workshop-day-review.md;
-- openspec/changes/spend-limit-booking). Additive only.
--
-- How much the whole bill may come to before the shop must ask, in whole
-- pounds, chosen when booking online. Empty: ask before any extra work.
ALTER TABLE workshop_jobs
  ADD COLUMN spend_limit INTEGER
    CONSTRAINT workshop_jobs_spend_limit_check CHECK (spend_limit BETWEEN 1 AND 100000);
