// A request the shop confirms after its "free to cancel until" has passed
// gets 1 hour from then, never past the booking's start (Jack, 24 Oct,
// docs/decisions/2026-10-24-request-deposit-refund.md).
import { prepare } from '../db.js';
import { currentMoment } from '../clock.js';

export async function graceOnConfirm(jobId) {
  const now = currentMoment().toISOString();
  await prepare(
    `UPDATE workshop_jobs w SET deposit_cancel_until = LEAST(?::timestamptz + interval '1 hour',
        (w.job_date::date + COALESCE(NULLIF(w.start_time, '')::time, time '00:00')) AT TIME ZONE ws.time_zone)
      FROM (SELECT time_zone FROM workshop_settings LIMIT 1) ws
      WHERE w.id = ? AND w.deposit_cancel_until IS NOT NULL AND w.deposit_cancel_until < ?::timestamptz`
  ).run(now, jobId, now);
}
