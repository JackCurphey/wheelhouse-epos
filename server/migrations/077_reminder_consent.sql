-- Saying yes to service reminders (openspec/changes/reminder-consent; account
-- and reminders decisions 2 and 8): one tick, when booking or collecting, is
-- the customer's yes to service reminders and to review requests. Kept as two
-- answers, because "How we contact you" switches them separately, with when
-- and where the yes was given. Additive only: everyone starts at no.
ALTER TABLE customers
  ADD COLUMN service_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN review_requests BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN reminders_said_yes_at TIMESTAMPTZ,
  ADD COLUMN reminders_said_yes_via TEXT CHECK (reminders_said_yes_via IN ('booking', 'collection'));
