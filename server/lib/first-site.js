// A business's first shop (openspec/changes/stock-per-shop, design 2): named after the
// business, its code the name's first letter, as Add a shop suggests one (ms-add-shop),
// or A with no letter to take. Run with the business set, in a transaction of the
// caller's. Two at once: the second waits for the first and adds nothing, as the code is
// taken. Migration 117 does the same for businesses already there.
export const MAKE_FIRST_SITE = `INSERT INTO sites (shop_id, name, code)
  SELECT id, name, COALESCE(upper(substring(name from '[A-Za-z]')), 'A') FROM shops
   WHERE id = current_setting('app.current_shop_id')::int
  ON CONFLICT (shop_id, code) DO NOTHING`;
