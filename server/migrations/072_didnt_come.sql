-- "Didn't come" on a booking whose bike never came in (Jack, 24 Oct answer 3;
-- approved drawings bk-staff-no-show and bk-staff-no-show-kept;
-- openspec/changes/deposit-diary-server design 1). A mark, not a booking
-- state: who marked it and when; Undo clears it. Additive only.
ALTER TABLE workshop_jobs ADD COLUMN no_show_at TIMESTAMPTZ;
ALTER TABLE workshop_jobs ADD COLUMN no_show_by_login_id INTEGER REFERENCES logins(id);
