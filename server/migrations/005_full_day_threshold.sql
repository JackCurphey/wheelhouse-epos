-- How many minutes of genuinely free time a mechanic's day can drop to
-- before the customer portal treats the whole day as full, even if a few
-- small gaps between jobs technically remain. Editable in Office > Edit
-- Shop > Workshop; enforced both there for display and authoritatively in
-- server.js's POST /api/portal/:shopSlug/bookings.
ALTER TABLE workshop_settings ADD COLUMN full_day_threshold_minutes INTEGER NOT NULL DEFAULT 120;
