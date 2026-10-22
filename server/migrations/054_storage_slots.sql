-- Storage slots (Workshop day 27, 27 Sep; drawn as set-workshop-diary's
-- Storage slots; openspec/changes/storage-slots): a shop's own hooks and
-- spaces, off until the shop switches them on, and the slot a bike in the
-- shop is kept on. Per shop for now; per site once sites reach the workshop
-- (WP-1.4). Additive only.
CREATE TABLE storage_slots (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX idx_storage_slots_shop ON storage_slots(shop_id, position);
-- A name once in a shop, whatever its capitals.
CREATE UNIQUE INDEX idx_storage_slots_name ON storage_slots(shop_id, lower(name));
ALTER TABLE storage_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_slots FORCE ROW LEVEL SECURITY;
CREATE POLICY storage_slots_shop_isolation ON storage_slots
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

ALTER TABLE workshop_settings ADD COLUMN storage_slots_on INTEGER NOT NULL DEFAULT 0;

-- The slot a bike in the shop is kept on; removing the slot clears it.
ALTER TABLE workshop_jobs
  ADD COLUMN storage_slot_id INTEGER REFERENCES storage_slots(id) ON DELETE SET NULL;
