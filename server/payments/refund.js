// Refunding a booking's deposit (openspec/changes/deposit-refunds design 2):
// owed inside the transaction that owes it (a cancel, a decline), then made
// after the commit. A taken deposit is refunded in full; one only held is let
// go. One the provider can't make now is made by settleDeposits later.
import { prepare } from '../db.js';
import { payments } from './index.js';

/** Marks the job's deposit as owed back, with why. Nothing when it took none. */
export async function oweRefund(jobId, reason, byLoginId = null) {
  await prepare(
    `UPDATE online_payments SET refund_due_reason = ?, refunded_by_login_id = ?, updated_at = now()
      WHERE job_id = ? AND status IN ('held', 'taken') AND refund_due_reason IS NULL`
  ).run(reason, byLoginId, jobId);
}

/** Makes a refund owed, for one job or (no job) every one still owed. */
export async function refundOwed(jobId = null) {
  const provider = payments();
  if (!provider) return;
  const owed = await prepare(
    `SELECT id, provider_ref, status, amount_pence, refund_due_reason FROM online_payments
      WHERE refund_due_reason IS NOT NULL AND status IN ('held', 'taken') AND provider = ? ${jobId ? 'AND job_id = ?' : ''}
      ORDER BY id LIMIT 20`
  ).all(...(jobId ? [provider.name, jobId] : [provider.name]));
  for (const p of owed) {
    const to = p.status === 'taken' ? 'refunded' : 'released';
    try {
      if (to === 'refunded') await provider.refund(p.provider_ref, p.amount_pence);
      else await provider.release(p.provider_ref);
      await prepare(
        `UPDATE online_payments SET status = ?, refund_reason = refund_due_reason, refund_due_reason = NULL, refunded_at = now(), updated_at = now()
          WHERE id = ?`
      ).run(to, p.id);
    } catch (err) {
      console.error(`deposit ${p.id}: the refund couldn’t be made yet`, err);
    }
  }
}
