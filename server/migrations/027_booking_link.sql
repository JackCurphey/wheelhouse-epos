-- The private booking link (piece 4). Only a SHA-256 hash of the link's code is
-- kept, so the database alone cannot open a booking. A new link replaces the
-- hash, which switches the old link off. customer_description is what the
-- customer wrote when booking, kept apart from notes because staff edit notes
-- and the link must never show a staff comment.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN link_token_hash TEXT,
  ADD COLUMN customer_description TEXT;

CREATE UNIQUE INDEX idx_workshop_jobs_link_token_hash
  ON workshop_jobs (link_token_hash) WHERE link_token_hash IS NOT NULL;
