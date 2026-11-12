-- A shop's link to its own Shopify shop, and the pretend Shopify
-- (openspec/changes/website-management, design 7). Additive; safe to run twice.
--
-- shopify_link: connected by an Owner through the adapter (server/shopify/).
-- Nothing is sent until the Owner presses Send; then the products waiting are
-- in to_send, and a background job sends them a few at a time
-- (server/shopify/sending.js), counting them in sent_count and keeping what
-- couldn't be sent in problems. 'stopped' once the shop uses Wheelhouse's own
-- website instead.
CREATE TABLE IF NOT EXISTS shopify_link (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL,
  address TEXT NOT NULL,
  connected_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL DEFAULT 'idle' CONSTRAINT shopify_link_state_check CHECK (state IN ('idle', 'sending', 'paused', 'stopped')),
  to_send INTEGER[] NOT NULL DEFAULT '{}',
  total INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  -- [{ productId, sku, name, kind: 'no_price' | 'no_photo' | 'shopify', reason }]
  problems JSONB NOT NULL DEFAULT '[]',
  last_sent_at TIMESTAMPTZ,
  -- How many of the shop's products were in Shopify when sending last finished.
  product_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The pretend Shopify's own records of the shops it pretends to be, as Shopify
-- would keep them on its side: each shop's products, the categories it wants a
-- photo for, and products it refuses with its own reason (by SKU). Only the
-- tests and a developer's .env use it (SHOPIFY_PROVIDER=pretend).
CREATE TABLE IF NOT EXISTS pretend_shopify (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  address TEXT NOT NULL,
  products JSONB NOT NULL DEFAULT '[]',
  needs_photo TEXT[] NOT NULL DEFAULT '{}',
  refuses JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (shop_id, address)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shopify_link', 'pretend_shopify'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;
