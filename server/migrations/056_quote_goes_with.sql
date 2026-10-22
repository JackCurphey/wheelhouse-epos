-- Quote lines that go together, and what happens without a Needed line
-- (Jack, 1 Oct, docs/decisions/2026-10-01-drop-off-and-quote-review.md
-- decisions 2 and 7; openspec/changes/quote-goes-with). Additive only.
--
-- goes_with_line_id: the part a labour line goes with (pads and fitting tick
-- and untick together). Only labour goes with a part, so pairs never chain;
-- the server checks that. A draft's lines are replaced on every save, and a
-- deleted part simply leaves the labour line on its own.
-- without_text: the mechanic's words on what happens without a Needed line.
ALTER TABLE workshop_quote_lines
  ADD COLUMN goes_with_line_id INTEGER REFERENCES workshop_quote_lines(id) ON DELETE SET NULL,
  ADD COLUMN without_text TEXT
    CONSTRAINT workshop_quote_lines_without_text_check CHECK (char_length(without_text) <= 300);
