-- The quote stage (journey 4; Jack, 3 Oct 2026: "1"). Additive only.
-- Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md
--
-- Each line: Needed or Optional and a reason for the customer (journey 4
-- decision 3); how, when and by whom it was decided (decision 4 - an answer
-- taken by phone or in the shop records who took it and when); and when an
-- approved line joined the job's work and parts. That last is a time, not a
-- link to the order line: saving work and parts rewrites every line of the
-- order, so a link would point at a deleted row the first time anyone edited
-- the job.
ALTER TABLE workshop_quote_lines
  ADD COLUMN need TEXT NOT NULL DEFAULT 'needed'
    CONSTRAINT workshop_quote_lines_need_check CHECK (need IN ('needed', 'optional')),
  ADD COLUMN reason TEXT,
  ADD COLUMN decided_via TEXT
    CONSTRAINT workshop_quote_lines_decided_via_check CHECK (decided_via IN ('online', 'phone', 'in_shop')),
  ADD COLUMN decided_by_login_id INTEGER REFERENCES logins(id),
  ADD COLUMN decided_at TIMESTAMPTZ,
  ADD COLUMN added_to_order_at TIMESTAMPTZ;

-- When the quote went to the customer.
ALTER TABLE workshop_quotes ADD COLUMN sent_at TIMESTAMPTZ;

-- The state 'withdrawn' (journey 4 decision 7). The CHECK below is rendered
-- from the quote machine by server/workshop/render-constraints.mjs; the drift
-- test holds this file to it (MIGRATION_COLUMNS now points here).
ALTER TABLE workshop_quotes DROP CONSTRAINT workshop_quotes_state_check;
ALTER TABLE workshop_quotes ADD CONSTRAINT workshop_quotes_state_check
  CHECK (state IN ('draft', 'sent', 'partly_approved', 'approved', 'declined', 'superseded', 'expired', 'withdrawn'));
