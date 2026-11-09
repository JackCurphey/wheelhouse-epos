-- Which products are bikes: a mark on a category, "Bikes" or "E-bikes" (Jack's 9 Nov answer to
-- finish-customers' bike question, his option 3), in place of the rule on category names. A
-- category without a mark follows the category it sits in; "E-bikes" counts as bikes and adds
-- the Electronics warranty line. Additive and safe to run twice.
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS bike_kind TEXT CHECK (bike_kind IS NULL OR bike_kind IN ('bikes', 'ebikes'));

-- Nothing that works today stops working: in each business that has marked nothing yet, every
-- category the old rule matched (its name ends in the word bike or bikes: "Bikes", "Road
-- bikes", "Kids’ bikes", "E-bikes") is marked "Bikes"; categories below it follow it, as the
-- old rule's "any part of the path" did. A default logged for Jack.
DO $$
DECLARE
  business RECORD;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    IF NOT EXISTS (SELECT 1 FROM product_categories WHERE bike_kind IS NOT NULL) THEN
      UPDATE product_categories SET bike_kind = 'bikes' WHERE btrim(name) ~* '(^|[[:space:]''’‐-])bikes?$';
    END IF;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
