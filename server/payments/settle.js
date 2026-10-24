// Settling deposits that were left part-way (openspec/changes/deposit-payments
// design 5, review): a hold with no booking an hour on is let go, so nobody's
// card stays held for a booking that never came; a booked deposit still held
// (the provider couldn't take it as the booking was saved) is taken. Run when
// deposits are next held or booked; there's no timer. A refund still owed
// is made too (deposit-refunds design 2).
import { prepare } from '../db.js';
import { payments } from './index.js';
import { refundOwed } from './refund.js';

export async function settleDeposits() {
  const provider = payments();
  if (!provider) return;
  const due = await prepare(
    `SELECT id, provider_ref, job_id FROM online_payments
      WHERE provider = ? AND provider_ref <> '' AND (
        (job_id IS NULL AND status IN ('waiting', 'held') AND updated_at < now() - interval '1 hour')
        OR (job_id IS NOT NULL AND status = 'held'))
      ORDER BY id LIMIT 20`
  ).all(provider.name);
  for (const p of due) {
    const to = p.job_id ? 'taken' : 'released';
    try {
      if (to === 'taken') await provider.take(p.provider_ref);
      else await provider.release(p.provider_ref);
      await prepare('UPDATE online_payments SET status = ?, updated_at = now() WHERE id = ?').run(to, p.id);
    } catch (err) {
      console.error(`deposit ${p.id}: couldn’t be ${to} yet`, err);
    }
  }
  await refundOwed();
}
