// The deposit a job's bill counts at the till (Jack, 29 Sep, selling at the
// till decision 11; openspec/changes/till-online-deposit design 1): the job's
// latest online payment, taken, with no refund owed or made, the job not
// marked Didn't come and its booking not cancelled (the job serializer's
// "paid"). A held card isn't charged until it's taken, so it doesn't count.
import { prepare } from '../db.js';

export const DEPOSIT_TENDER = 'Deposit paid online';

/** { pence, paidAt } or null. */
export async function countedDeposit(jobId) {
  if (!jobId) return null;
  const row = await prepare(
    `SELECT p.amount_pence, p.created_at FROM workshop_jobs w
       JOIN LATERAL (SELECT * FROM online_payments op WHERE op.job_id = w.id ORDER BY op.id DESC LIMIT 1) p ON true
      WHERE w.id = ? AND p.status = 'taken' AND p.refund_due_reason IS NULL AND p.refunded_at IS NULL
        AND w.no_show_at IS NULL AND w.booking_state <> 'cancelled'`
  ).get(jobId);
  return row ? { pence: row.amount_pence, paidAt: new Date(row.created_at).toISOString() } : null;
}

/** What the deposit pays of a bill in pence, at most the bill, and what's left. */
export function depositShare(totalPence, deposit) {
  const used = deposit ? Math.min(deposit.pence, Math.max(0, totalPence)) : 0;
  return { usedPence: used, leftPence: totalPence - used };
}
