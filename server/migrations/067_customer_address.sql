-- Customers' address and postcode (Add a customer, cs-add; customer service
-- review 3; openspec/changes/customers-list). Both optional, kept as typed;
-- the header search finds a postcode. Additive only.
ALTER TABLE customers
  ADD COLUMN address TEXT,
  ADD COLUMN postcode TEXT;
