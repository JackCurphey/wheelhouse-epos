-- Work within the customer's spending limit (Workshop day 41-43,
-- docs/decisions/2026-09-27-workshop-day-review.md; openspec/changes/spend-limit-within).
--
-- A line agreed because the whole bill stays within the limit the customer
-- set is decided 'limit': no quote went to them, and they are told what was
-- added. The other ways stay as they were (migration 038).
ALTER TABLE workshop_quote_lines DROP CONSTRAINT workshop_quote_lines_decided_via_check;
ALTER TABLE workshop_quote_lines ADD CONSTRAINT workshop_quote_lines_decided_via_check
  CHECK (decided_via IN ('online', 'phone', 'in_shop', 'limit'));
