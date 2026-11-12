-- The shop's website (openspec/changes/website-management, design 1): one row
-- per shop holding what the shop is working on (the draft) and what customers
-- see (published), plus History, the published and discarded versions kept
-- for 90 days. Additive; safe to run twice. The row is made the first time an
-- Owner opens the Website page, seeded from storefront_settings
-- (server/website.js), so no shop's data is copied here.

CREATE TABLE IF NOT EXISTS website_versions (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN ('published', 'discarded')),
  content JSONB NOT NULL,
  -- The names of the parts that changed, as the History list shows them.
  changed TEXT[] NOT NULL DEFAULT '{}',
  made_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  made_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_published BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_website_versions_shop ON website_versions (shop_id, made_at DESC);

CREATE TABLE IF NOT EXISTS website (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- NULL until the three-step start picks one.
  kind TEXT CHECK (kind IN ('wheelhouse', 'shopify')),
  set_up_at TIMESTAMPTZ,
  is_on BOOLEAN NOT NULL DEFAULT false,
  draft JSONB NOT NULL,
  draft_saved_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  draft_saved_at TIMESTAMPTZ,
  -- NULL until the first publish.
  published JSONB,
  published_at TIMESTAMPTZ,
  published_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  -- The History row customers see now, which clean-up never removes.
  live_version_id INTEGER REFERENCES website_versions(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['website', 'website_versions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;
