-- Who registered each till and workshop computer (openspec/changes/tills-list,
-- design 1), for the Tills list's "registered [date] by [name]"
-- (set-till-tills-owner). Null for those set up before 104: nobody made it
-- up. Additive and safe to run twice; both tables keep their row-level
-- security (migrations 036 and 101).
ALTER TABLE tills ADD COLUMN IF NOT EXISTS registered_by_login_id INTEGER REFERENCES logins(id);
ALTER TABLE workshop_computers ADD COLUMN IF NOT EXISTS registered_by_login_id INTEGER REFERENCES logins(id);
