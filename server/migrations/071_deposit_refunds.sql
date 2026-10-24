-- Refunding a booking's deposit (Jack, 24 Oct answers 1–5;
-- openspec/changes/deposit-refunds design 1). A refund owed is recorded with
-- the cancel or decline that owes it, then made; when and why it was made,
-- and by whom when staff refund by hand (part 4). Additive only.
ALTER TABLE online_payments ADD COLUMN refund_due_reason TEXT;
ALTER TABLE online_payments ADD COLUMN refunded_at TIMESTAMPTZ;
ALTER TABLE online_payments ADD COLUMN refund_reason TEXT;
ALTER TABLE online_payments ADD COLUMN refunded_by_login_id INTEGER REFERENCES logins(id);

-- A moved booking keeps its deposit (Jack, 24 Oct answer 3), and its "free to
-- cancel until" moves with it: the same hours before the job's new start, in
-- the shop's time, however the booking was moved (review). A whole-day
-- booking's start is the start of its day.
CREATE FUNCTION workshop_jobs_move_deposit_cut_off() RETURNS trigger AS $$
DECLARE
  zone TEXT := (SELECT time_zone FROM workshop_settings WHERE shop_id = NEW.shop_id LIMIT 1);
  old_start TIMESTAMPTZ := (OLD.job_date::date + COALESCE(NULLIF(OLD.start_time, '')::time, time '00:00')) AT TIME ZONE zone;
  new_start TIMESTAMPTZ := (NEW.job_date::date + COALESCE(NULLIF(NEW.start_time, '')::time, time '00:00')) AT TIME ZONE zone;
BEGIN
  IF NEW.deposit_cancel_until IS NOT NULL AND OLD.deposit_cancel_until IS NOT NULL
     AND (NEW.job_date IS DISTINCT FROM OLD.job_date OR NEW.start_time IS DISTINCT FROM OLD.start_time) THEN
    NEW.deposit_cancel_until := new_start - (old_start - OLD.deposit_cancel_until);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER workshop_jobs_move_deposit_cut_off BEFORE UPDATE OF job_date, start_time ON workshop_jobs
  FOR EACH ROW EXECUTE FUNCTION workshop_jobs_move_deposit_cut_off();
