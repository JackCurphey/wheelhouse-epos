-- Staff sign in through WorkOS (openspec/changes/staff-signin-workos design 5).
-- A login's WorkOS person, linked on their first sign-in there (one person,
-- one login), and the WorkOS session behind a Wheelhouse session, so signing
-- out ends both. Both tables are the shop registry: no shop_id, no RLS.
ALTER TABLE logins ADD COLUMN workos_user_id TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN workos_session_id TEXT;
