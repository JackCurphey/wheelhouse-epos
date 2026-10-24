-- DRILL ONLY (WP-0.5 task 3.5, 24 Oct). Never merged: this branch exists so
-- the hosted copy can be shown an update whose database change fails. The
-- table is made first so the drill also shows a half-done change is undone.
CREATE TABLE drill_should_never_exist (id INT);
SELECT 1 / 0;
