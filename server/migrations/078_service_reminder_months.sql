-- When each service's reminder is due (openspec/changes/service-reminder-months;
-- account and reminders decision 2): a whole number of months from 1 to 60,
-- counted from collection, or none (a puncture, say). Additive only: every
-- service starts with none.
ALTER TABLE workshop_services
  ADD COLUMN reminder_months INTEGER CHECK (reminder_months BETWEEN 1 AND 60);
