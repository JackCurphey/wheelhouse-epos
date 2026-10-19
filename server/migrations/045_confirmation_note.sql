-- The shop's additional note on the booking confirmation (Jack, 19 Oct,
-- docs/decisions/2026-10-19-confirmation-note.md): each shop writes its own,
-- starting with the drawn sentence (bk-confirmed); empty shows no note.
-- Additive only.
-- Spec: openspec/changes/confirmation-note/design.md
ALTER TABLE workshop_settings ADD COLUMN confirmation_note TEXT NOT NULL
  DEFAULT 'Please bring the lock key, and tell us about any accessories.';
