-- Bringing a shop's data across from Citrus Lime (openspec/changes/citrus-import-products,
-- design 3 and 13; Moving from Citrus Lime decision 2; mv-progress, mv-summary).
-- One row per file sent and per row in it. A file waits as bytes only until it's
-- been read (move_file_bytes), then those go. A row's data is emptied once it has
-- been dealt with, so a copy of the file isn't kept. A request key means a retried
-- send counts once. Additive and safe to run twice, including over an earlier
-- draft of this file: delete this file's row from schema_migrations there.
CREATE TABLE IF NOT EXISTS move_files (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  report TEXT,
  file_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'reading',
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
ALTER TABLE move_files ALTER COLUMN report DROP NOT NULL;
ALTER TABLE move_files ALTER COLUMN state SET DEFAULT 'reading';
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS rows_same INTEGER NOT NULL DEFAULT 0;
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS rows_skipped INTEGER NOT NULL DEFAULT 0;
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS stock_look INTEGER NOT NULL DEFAULT 0;
-- All the reports the move reads, so running this again over a database that has
-- them is safe (customers and bikes come with citrus-import-customers).
ALTER TABLE move_files DROP CONSTRAINT IF EXISTS move_files_report_check;
ALTER TABLE move_files ADD CONSTRAINT move_files_report_check CHECK (report IN ('price_list', 'barcodes', 'customers', 'bikes'));
ALTER TABLE move_files DROP CONSTRAINT IF EXISTS move_files_state_check;
ALTER TABLE move_files ADD CONSTRAINT move_files_state_check CHECK (state IN ('reading', 'cant_read', 'bringing', 'done'));
DROP INDEX IF EXISTS idx_move_files_bringing;
CREATE INDEX IF NOT EXISTS idx_move_files_to_do ON move_files(shop_id, id) WHERE state IN ('reading', 'bringing');
CREATE UNIQUE INDEX IF NOT EXISTS idx_move_files_request_key ON move_files(shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL;
ALTER TABLE move_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_files FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_files_shop_isolation ON move_files;
CREATE POLICY move_files_shop_isolation ON move_files
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS move_file_bytes (
  file_id INTEGER PRIMARY KEY REFERENCES move_files(id),
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  bytes BYTEA NOT NULL
);
ALTER TABLE move_file_bytes ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_file_bytes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_file_bytes_shop_isolation ON move_file_bytes;
CREATE POLICY move_file_bytes_shop_isolation ON move_file_bytes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS move_rows (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  file_id INTEGER NOT NULL REFERENCES move_files(id),
  data JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting',
  why TEXT
);
ALTER TABLE move_rows DROP CONSTRAINT IF EXISTS move_rows_state_check;
ALTER TABLE move_rows ADD CONSTRAINT move_rows_state_check CHECK (state IN ('waiting', 'in', 'same', 'skipped', 'look'));
CREATE INDEX IF NOT EXISTS idx_move_rows_file_state ON move_rows(file_id, state, id);
ALTER TABLE move_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_rows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_rows_shop_isolation ON move_rows;
CREATE POLICY move_rows_shop_isolation ON move_rows
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
