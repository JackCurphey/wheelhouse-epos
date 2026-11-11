-- Quick buttons for the till (openspec/changes/owner-setup-till-payments-eod,
-- design 1): the shop's groups, each with its buttons in order. A button is
-- one product or one service and keeps no price of its own, so it always shows
-- the item's current price (owner setup decision 5). Additive; safe to run twice.
-- (130 is taken by another piece in progress, 130_vat_quarter.sql.)

-- The tables a button points at first, before the new tables' links take a
-- lock on shops, so nothing waits on shops while holding these (as 129 orders
-- its locks): removing a shop deletes its products and services, then the shop.
LOCK TABLE products, workshop_services IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS quick_button_groups (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  position INTEGER NOT NULL CHECK (position >= 0)
);
-- One name per shop, ignoring capital letters.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_button_groups_name ON quick_button_groups (shop_id, lower(name));
-- A button names its business's own group only (as 117's (id, shop_id) keys).
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_button_groups_id_shop ON quick_button_groups (id, shop_id);

CREATE TABLE IF NOT EXISTS quick_buttons (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  group_id INTEGER NOT NULL,
  product_id INTEGER,
  service_id INTEGER REFERENCES workshop_services(id) ON DELETE CASCADE,
  -- NULL is the item's own name.
  label TEXT CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 40),
  position INTEGER NOT NULL CHECK (position >= 0),
  CHECK ((product_id IS NULL) <> (service_id IS NULL)),
  FOREIGN KEY (group_id, shop_id) REFERENCES quick_button_groups (id, shop_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quick_buttons_group ON quick_buttons (group_id, position);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['quick_button_groups', 'quick_buttons'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- Shops already using the app keep their till as it is (Jack's answer 1,
-- docs/decisions/2026-11-11-settings-rest-answers.md): their active workshop
-- services go into a "Workshop" group, in the till's order (active services by
-- name, as GET /api/workshop-services lists them), with no label. A shop with
-- no active services gets no group; shops that sign up later get none. A shop
-- that already has groups is left alone, so a second run adds nothing.
DO $$
DECLARE
  business RECORD;
  workshop INTEGER;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    -- shop_id named as well as set, so this stays one shop at a time even
    -- for a role that row-level security doesn't apply to.
    IF NOT EXISTS (SELECT 1 FROM quick_button_groups WHERE shop_id = business.id)
       AND EXISTS (SELECT 1 FROM workshop_services WHERE active = 1 AND shop_id = business.id) THEN
      INSERT INTO quick_button_groups (shop_id, name, position) VALUES (business.id, 'Workshop', 0) RETURNING id INTO workshop;
      INSERT INTO quick_buttons (shop_id, group_id, service_id, position)
        SELECT business.id, workshop, id, (row_number() OVER (ORDER BY name, id) - 1)::int
          FROM workshop_services WHERE active = 1 AND shop_id = business.id;
    END IF;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
