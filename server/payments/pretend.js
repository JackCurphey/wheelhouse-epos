// The pretend payment provider (openspec/changes/deposit-payments design 2):
// it keeps its own records in pretend_payments, as Stripe would on its side,
// and its card form (routes/deposit-payments.js) answers as Stripe's test
// cards do. No money moves and no card goes anywhere.
import { randomBytes } from 'node:crypto';
import { prepare } from '../db.js';
import { PaymentError } from './errors.js';

export const ACCEPTED_CARD = '4242424242424242';
export const DECLINED_CARD = '4000000000000002';

async function find(ref) {
  const row = await prepare('SELECT * FROM pretend_payments WHERE ref = ? FOR UPDATE').get(ref);
  if (!row) throw new PaymentError('not_found', 'That payment wasn’t found.');
  return row;
}

async function move(ref, from, to) {
  const row = await find(ref);
  if (!from.includes(row.status)) throw new PaymentError('wrong_state', `A ${row.status} payment can’t be ${to}.`);
  await prepare('UPDATE pretend_payments SET status = ?, updated_at = now() WHERE ref = ?').run(to, ref);
}

export const pretend = {
  name: 'pretend',
  async hold({ amountPence, key }) {
    const made = await prepare(
      `INSERT INTO pretend_payments (ref, idempotency_key, amount_pence) VALUES (?, ?, ?)
       ON CONFLICT (shop_id, idempotency_key) DO NOTHING RETURNING ref`
    ).get(`pretend_${randomBytes(12).toString('hex')}`, key, amountPence);
    if (made) return { ref: made.ref };
    const held = await prepare('SELECT ref, amount_pence FROM pretend_payments WHERE idempotency_key = ?').get(key);
    if (held.amount_pence !== amountPence) throw new PaymentError('key_reused', 'That key was used for another amount.');
    return { ref: held.ref };
  },
  async status(ref) {
    const row = await prepare('SELECT status, amount_pence FROM pretend_payments WHERE ref = ?').get(ref);
    if (!row) throw new PaymentError('not_found', 'That payment wasn’t found.');
    return { status: row.status, amountPence: row.amount_pence };
  },
  take: (ref) => move(ref, ['held'], 'taken'),
  release: (ref) => move(ref, ['waiting', 'held'], 'released'),
  async refund(ref, amountPence) {
    const row = await find(ref);
    if (row.status !== 'taken') throw new PaymentError('wrong_state', `A ${row.status} payment can’t be refunded.`);
    if (!Number.isInteger(amountPence) || amountPence < 1 || row.refunded_pence + amountPence > row.amount_pence) {
      throw new PaymentError('too_much', 'That’s more than was taken.');
    }
    const refunded = row.refunded_pence + amountPence;
    await prepare('UPDATE pretend_payments SET refunded_pence = ?, status = ?, updated_at = now() WHERE ref = ?')
      .run(refunded, refunded === row.amount_pence ? 'refunded' : 'taken', ref);
  },
  /** The pretend card form: Stripe's test cards. */
  async card(ref, cardNumber) {
    const digits = typeof cardNumber === 'string' ? cardNumber.replace(/[\s-]/g, '') : '';
    if (digits !== ACCEPTED_CARD && digits !== DECLINED_CARD) throw new PaymentError('bad_card', 'Check the card number.');
    const row = await find(ref);
    if (row.status !== 'waiting') throw new PaymentError('wrong_state', `A ${row.status} payment can’t take a card.`);
    const status = digits === ACCEPTED_CARD ? 'held' : 'declined';
    await prepare('UPDATE pretend_payments SET status = ?, card_last4 = ?, updated_at = now() WHERE ref = ?').run(status, digits.slice(-4), ref);
    return { status };
  },
};
