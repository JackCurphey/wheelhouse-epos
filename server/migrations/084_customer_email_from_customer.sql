-- Whether a customer's email is one they gave themselves (an online booking, an
-- online account), so a first sign-in by code may join them (Jack, 26 Oct,
-- option 2; docs/decisions/2026-10-26-customer-account.md). An email staff typed
-- in could be someone else's, so it never joins. Every customer already here
-- starts false: where their email came from isn't known.
ALTER TABLE customers ADD COLUMN email_from_customer BOOLEAN NOT NULL DEFAULT false;
