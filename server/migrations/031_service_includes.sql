-- Which individual services a full service includes, in the shop's order
-- (server piece 8). The customer booking screen names them on the full
-- service's card and warns when both are ticked; booking both is still
-- allowed. No backfill: every shop starts with empty lists, and nothing is
-- dropped, so older code runs unchanged against this schema.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
CREATE TABLE workshop_service_includes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  service_id INTEGER NOT NULL REFERENCES workshop_services(id) ON DELETE CASCADE,
  included_service_id INTEGER NOT NULL REFERENCES workshop_services(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  UNIQUE (service_id, included_service_id),
  CHECK (service_id <> included_service_id)
);
CREATE INDEX idx_workshop_service_includes_service ON workshop_service_includes(shop_id, service_id);
ALTER TABLE workshop_service_includes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_service_includes FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_service_includes_shop_isolation ON workshop_service_includes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
