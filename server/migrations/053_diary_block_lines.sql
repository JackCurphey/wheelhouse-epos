-- What a diary block shows first and second (Workshop day 17 and 29, 27 Sep;
-- drawn as set-workshop-diary's Diary blocks): bike, then job title, by
-- default; each shop may choose bike, job title, customer or job number for
-- each line. One setting for the business (shops and sites, 5 Oct). Additive.
ALTER TABLE workshop_settings
  ADD COLUMN block_first TEXT NOT NULL DEFAULT 'bike'
    CHECK (block_first IN ('bike', 'jobTitle', 'customer', 'reference')),
  ADD COLUMN block_second TEXT NOT NULL DEFAULT 'jobTitle'
    CHECK (block_second IN ('bike', 'jobTitle', 'customer', 'reference'));
