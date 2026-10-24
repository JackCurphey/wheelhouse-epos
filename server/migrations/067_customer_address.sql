-- Customers' address and postcode (Add a customer, cs-add; customer service
-- review 3; openspec/changes/customers-list). Both optional, kept as typed;
-- the header search finds a postcode. And indexes for a customer's jobs and
-- sales, which Recent customers and a customer's history read (review).
-- Additive only.
ALTER TABLE customers
  ADD COLUMN address TEXT,
  ADD COLUMN postcode TEXT;
CREATE INDEX idx_workshop_jobs_customer ON workshop_jobs(customer_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
