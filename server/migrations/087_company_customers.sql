-- Company customers (openspec/changes/company-customers design 1;
-- cs-add-company; customer service review 3; leftover screens H2): a
-- customer can be a company or club, whose name is the customer's name, with
-- a contact name, an optional VAT number and an optional address to send
-- invoices to. Additive only; everyone already here is a person.
ALTER TABLE customers
  ADD COLUMN is_company    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN contact_name  TEXT,
  ADD COLUMN vat_number    TEXT,
  ADD COLUMN invoice_email TEXT;
