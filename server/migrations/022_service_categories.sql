-- Shop-defined service categories, one level deep (Jack, 24 Sep): a category
-- holds individual services and never other categories. Full services (whole-
-- bike services a customer picks from a short list) carry no category.
-- Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md

CREATE TABLE workshop_service_categories (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_service_categories_shop ON workshop_service_categories(shop_id, position);
ALTER TABLE workshop_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_service_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_service_categories_shop_isolation ON workshop_service_categories
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Existing services become 'individual' with no category: the list a customer
-- sees is unchanged until the shop sorts it.
-- ON DELETE SET NULL: deleting a category moves its services to "Other"; it
-- never deletes a service, which job lines may still point at.
ALTER TABLE workshop_services
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('full', 'individual')),
  ADD COLUMN category_id INTEGER REFERENCES workshop_service_categories(id) ON DELETE SET NULL,
  ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
