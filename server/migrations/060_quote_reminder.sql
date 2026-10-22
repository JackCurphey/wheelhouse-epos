-- One reminder when a quote has no answer (Jack, 1 Oct, docs/decisions/2026-10-01-drop-off-and-quote-review.md;
-- Jack, 22 Oct: "sent once after 24 hours with no answer (shops can change
-- the hours)"; openspec/changes/quote-reminder). Additive only.
ALTER TABLE workshop_settings
  ADD COLUMN quote_reminder_hours INTEGER NOT NULL DEFAULT 24
    CONSTRAINT workshop_settings_quote_reminder_hours_check CHECK (quote_reminder_hours BETWEEN 1 AND 168);
