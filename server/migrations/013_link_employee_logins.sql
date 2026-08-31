-- Links a login (who can sign in) to an employee (their roster roles) so the
-- two can be managed as one person in the Office > Edit Shop > Office team
-- view. Nullable and optional both ways: a login can exist without an
-- employee (e.g. the owner, or any login created before this column
-- existed) and an employee can exist without a login (roster-only staff who
-- never sign in) - existing rows on both sides are left exactly as they are.
-- ON DELETE SET NULL because permanently deleting someone's roster entry
-- (their roles/working days) must never delete or block deleting their
-- login - it just goes back to being a login-only row, same as the owner.
ALTER TABLE logins ADD COLUMN employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE SET NULL;
