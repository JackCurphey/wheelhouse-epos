-- The workshop computer's Owner lock, held on the server
-- (openspec/changes/workshop-lock-server, design 1; 29 Oct answer 4): the
-- workshop computer a signed-in session was used on, recorded at its setup
-- or its first request there, so deleting the browser's workshop cookie
-- can't open the Owner's pages. Null for a session never used on one.
-- `sessions` is the sign-in registry (no row-level security); a shop's
-- removal deletes its sessions before its workshop computers. Additive and
-- safe to run twice.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workshop_computer_id INTEGER REFERENCES workshop_computers(id);
