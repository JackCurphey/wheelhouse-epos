-- A photo on a quote line (Jack, 1 Oct, docs/decisions/2026-10-01-drop-off-and-quote-review.md;
-- dq-quote-photo; openspec/changes/quote-line-photos). Additive only.
--
-- One photo per line, as drawn: one of the job's files. Removing the file
-- from the job takes it off the line; a draft's lines are replaced on every
-- save, and the staff screen sends the photo back with each line.
ALTER TABLE workshop_quote_lines
  ADD COLUMN photo_attachment_id INTEGER REFERENCES workshop_job_attachments(id) ON DELETE SET NULL;
