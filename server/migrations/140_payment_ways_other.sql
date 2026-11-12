-- Other ways to pay (openspec/changes/owner-setup-till-payments-eod, design 4;
-- Jack's answer 3 of 11 Nov, docs/decisions/2026-11-11-settings-rest-answers.md):
-- the shop's list of ways to pay that sit under "Other" at the bottom of Take
-- payment, in order. Settings only for now; the till reads it once Take payment
-- offers "Other". Additive; running it twice changes nothing for a shop that has rows.
-- (First written as 133; renumbered to 140, after main's 137 and the End of day piece's 139, with 138 reserved.)

CREATE TABLE IF NOT EXISTS payment_ways_other (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  -- The drawn rows' lines; a shop's own rows have none.
  note TEXT,
  position INTEGER NOT NULL CHECK (position >= 0)
);
-- One name per shop, ignoring capital letters.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_ways_other_name ON payment_ways_other (shop_id, lower(name));

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_ways_other'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- Every shop starts with the three drawn rows and their lines (setup.mjs
-- payOther, set-pay-other). New shops get them in createShop (server/auth.js).
-- A shop that already has rows is left alone, so a second run adds nothing to it;
-- a shop that has removed all its rows by then gets the three drawn rows again.
DO $$
DECLARE
  business RECORD;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    -- shop_id named as well as set, so this stays one shop at a time even
    -- for a role that row-level security doesn't apply to.
    IF NOT EXISTS (SELECT 1 FROM payment_ways_other WHERE shop_id = business.id) THEN
      INSERT INTO payment_ways_other (shop_id, name, note, position) VALUES
        (business.id, 'Finance', 'Recorded at the till; the finance company pays the shop', 0),
        (business.id, 'Cycle to Work', 'Recorded at the till against a Cycle to Work order', 1),
        (business.id, 'Payment link', 'Needs setting up with [payment provider] first', 2);
    END IF;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
