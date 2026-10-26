-- Company customers (openspec/changes/company-customers design 1;
-- cs-add-company; customer service review 3; leftover screens H2): a
-- customer can be a company or club, whose name is the customer's name, with
-- a contact name, an optional VAT number and an optional address to send
-- invoices to. Additive only; everyone already here is a person.
-- IF NOT EXISTS: a shared dev database ran this once as 087 before it was
-- renumbered (087 is reserved for "Ask the shop a question").
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_company    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS vat_number    TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email TEXT;
