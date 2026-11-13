-- What the website started with, and when (openspec/changes/website-buy-online,
-- design 15; the drawing on-settings-show, "Started with every product online
-- on [date]." with Change). set_up_at says when the website was set up, but not
-- which of set-up step 3's two answers was given, and Change asks that question
-- again later, so both the answer and the date it was given are kept here.
-- Websites set up before this have neither, and Showing products says nothing
-- about how they started. Additive; safe to run twice. 155 is
-- claude/c2w-10d-takings's.
ALTER TABLE website ADD COLUMN IF NOT EXISTS started_with TEXT;
ALTER TABLE website ADD COLUMN IF NOT EXISTS started_with_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'website'::regclass AND conname = 'website_started_with_check') THEN
    ALTER TABLE website ADD CONSTRAINT website_started_with_check CHECK (started_with IN ('every', 'nothing'));
  END IF;
END $$;
