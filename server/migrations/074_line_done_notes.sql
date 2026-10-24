-- A Done tick and a staff note on each line of a job's work and parts (Jack,
-- 24 Oct, docs/decisions/2026-10-24-line-notes.md; drawn as job-page.mjs's
-- Done and Note columns; openspec/changes/line-done-notes design 1). Only
-- order lines use them. The note is for staff only. Additive only.
ALTER TABLE sale_document_items ADD COLUMN done BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sale_document_items ADD COLUMN note TEXT;
