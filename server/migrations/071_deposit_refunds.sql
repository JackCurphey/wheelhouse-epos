-- Refunding a booking's deposit (Jack, 24 Oct answers 1–5;
-- openspec/changes/deposit-refunds design 1). A refund owed is recorded with
-- the cancel or decline that owes it, then made; when and why it was made,
-- and by whom when staff refund by hand (part 4). Additive only.
ALTER TABLE online_payments ADD COLUMN refund_due_reason TEXT;
ALTER TABLE online_payments ADD COLUMN refunded_at TIMESTAMPTZ;
ALTER TABLE online_payments ADD COLUMN refund_reason TEXT;
ALTER TABLE online_payments ADD COLUMN refunded_by_login_id INTEGER REFERENCES logins(id);
