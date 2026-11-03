-- Bringing a shop's data across from Citrus Lime (openspec/changes/citrus-import-products,
-- design 3; Moving from Citrus Lime decision 2; mv-progress, mv-summary). One
-- row per file sent and per row in it. A row's data is emptied once it has come
-- across, so a copy of the file isn't kept. A request key means a retried send
-- counts once. Additive and safe to run twice.
CREATE TABLE IF NOT EXISTS move_files (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  report TEXT NOT NULL CHECK (report IN ('price_list', 'barcodes')),
  file_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'bringing' CHECK (state IN ('bringing', 'done')),
  store_name TEXT NOT NULL DEFAULT '',
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_in INTEGER NOT NULL DEFAULT 0,
  rows_look INTEGER NOT NULL DEFAULT 0,
  stock_in INTEGER NOT NULL DEFAULT 0,
  sent_by_login_id INTEGER REFERENCES logins(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  request_key_hash TEXT,
  request_body_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_move_files_bringing ON move_files(shop_id, id) WHERE state = 'bringing';
CREATE UNIQUE INDEX IF NOT EXISTS idx_move_files_request_key ON move_files(shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL;
ALTER TABLE move_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_files FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_files_shop_isolation ON move_files;
CREATE POLICY move_files_shop_isolation ON move_files
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS move_rows (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  file_id INTEGER NOT NULL REFERENCES move_files(id),
  data JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'in', 'look')),
  why TEXT
);
CREATE INDEX IF NOT EXISTS idx_move_rows_file_state ON move_rows(file_id, state, id);
ALTER TABLE move_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_rows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_rows_shop_isolation ON move_rows;
CREATE POLICY move_rows_shop_isolation ON move_rows
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
