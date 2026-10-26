-- How we contact you (openspec/changes/how-we-contact-you design 1): a yes to
-- reminders or review requests can come from the customer's account.
ALTER TABLE customers DROP CONSTRAINT customers_reminders_said_yes_via_check;
ALTER TABLE customers ADD CONSTRAINT customers_reminders_said_yes_via_check
  CHECK (reminders_said_yes_via IN ('booking', 'collection', 'stop_page', 'account'));
