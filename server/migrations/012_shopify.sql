-- Per-shop Shopify connection. Each shop connects their own Shopify store
-- via a custom-app Admin API token they generate themselves (not a public
-- OAuth "install app" flow - see the design spec). location_id is fetched
-- and cached at connect time so inventory pushes don't need an extra API
-- call per update.
CREATE TABLE shopify_connections (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  shop_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  storefront_api_token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  location_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY shopify_connections_shop_isolation ON shopify_connections
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Populated once a show_online product is successfully pushed to the
-- shop's connected Shopify store; null means "not yet synced".
ALTER TABLE products ADD COLUMN shopify_product_id TEXT;
ALTER TABLE products ADD COLUMN shopify_variant_id TEXT;
ALTER TABLE products ADD COLUMN shopify_inventory_item_id TEXT;

-- Idempotency + audit log for inbound Shopify order/refund webhooks. The
-- unique constraint is the atomic "claim this event" gate - a webhook
-- handler INSERTs (ON CONFLICT DO NOTHING) before doing any work, and
-- treats zero rows affected as "already processed, skip".
CREATE TABLE shopify_processed_events (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  shopify_order_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'order' | 'refund'
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error'
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_order_id, kind)
);
ALTER TABLE shopify_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_processed_events FORCE ROW LEVEL SECURITY;
CREATE POLICY shopify_processed_events_shop_isolation ON shopify_processed_events
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
