-- Set up this till (openspec/changes/till-setup, the contract; till-setup in
-- signin.mjs). A till's name is optional, as drawn ("Name (optional)"); each
-- PIN check-in and each float check records the till it was made on, null
-- for a browser that isn't a set-up till. Both tables already have
-- row-level security (097, 095). Additive and safe to run twice.
ALTER TABLE tills ALTER COLUMN name DROP NOT NULL;

ALTER TABLE pin_checkins ADD COLUMN IF NOT EXISTS till_id INTEGER REFERENCES tills(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pin_checkins_till_day ON pin_checkins(till_id, day);

ALTER TABLE float_checks ADD COLUMN IF NOT EXISTS till_id INTEGER REFERENCES tills(id) ON DELETE SET NULL;
