-- Review requests (openspec/changes/review-requests; account and reminders
-- decision 5): the shop's review page (such as its Google page) and the days
-- after collection the request goes; and review requests as a kind a stop
-- code can stop. Additive, apart from widening 079's check.
ALTER TABLE workshop_settings
  ADD COLUMN review_page_url TEXT,
  ADD COLUMN review_request_days INTEGER NOT NULL DEFAULT 2 CHECK (review_request_days BETWEEN 1 AND 60);

ALTER TABLE reminder_stop_codes DROP CONSTRAINT reminder_stop_codes_kind_check;
ALTER TABLE reminder_stop_codes ADD CONSTRAINT reminder_stop_codes_kind_check
  CHECK (kind IN ('service_reminders', 'review_requests'));
