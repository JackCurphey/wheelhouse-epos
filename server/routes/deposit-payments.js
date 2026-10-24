// Paying a booking's deposit, the public routes (openspec/changes/deposit-payments
// design 2 and 4). Portal routes run in the shop's row-level security, from
// :shopSlug.
import { randomUUID } from 'node:crypto';
import { prepare, dbExec } from '../db.js';
import { badRequest, makeRateLimiter, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { clientIp } from '../proxy-trust.js';
import { payments, PaymentError } from '../payments/index.js';
import { readRequestKey } from '../booking-request-key.js';
import { bookingDeposit } from '../workshop/booking-deposit.js';
import { settleDeposits } from '../payments/settle.js';

// A hold per booking request; a page asks again only when the services change.
const holdLimiter = makeRateLimiter(30, 60 * 60 * 1000);
const OPEN = ['waiting', 'held'];

export function register(route) {
  // Before sending, the booking page asks for the deposit on the services
  // chosen: worked out here on the stored prices, and held once per booking
  // request (design 4). { depositPence: null } when no deposit is taken.
  // screens: details
  route('POST', '/api/portal/:shopSlug/deposit-holds', async (req, res) => {
    const body = (await readJsonBody(req)) ?? {};
    const notSure = body.notSure === true;
    const serviceIds = notSure ? [] : body.serviceIds;
    if (!notSure && !(Array.isArray(serviceIds) && serviceIds.length > 0 && serviceIds.every((id) => Number.isInteger(id) && id > 0 && id <= 2_147_483_647))) {
      return badRequest(res, 'Choose a service');
    }
    const key = readRequestKey({ requestKey: body.requestKey });
    if (key.error || !key.value) return badRequest(res, 'Invalid request key');
    await settleDeposits();
    const deposit = await bookingDeposit({ serviceIds, notSure });
    if (deposit.error) return badRequest(res, deposit.error);
    const provider = payments();
    if (deposit.pence === null || !provider) return sendJson(res, 200, { depositPence: null });
    if (!holdLimiter.check(clientIp(req))) return sendJson(res, 429, { error: 'Too many tries from this network - please try again later.' });

    const keyHash = key.value.keyHash;
    let made = null; // a hold made in this transaction, let go if it doesn't commit
    await dbExec('BEGIN');
    try {
      await prepare(
        `INSERT INTO online_payments (provider, provider_ref, amount_pence, request_key_hash) VALUES (?, '', ?, ?)
         ON CONFLICT (shop_id, request_key_hash) DO NOTHING RETURNING id`
      ).all(provider.name, deposit.pence, keyHash);
      const row = await prepare('SELECT * FROM online_payments WHERE request_key_hash = ? FOR UPDATE').get(keyHash);
      if (row.job_id) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'This booking has already been sent.', code: 'already_booked' });
      }
      let ref = row.provider_ref;
      if (!(ref && row.amount_pence === deposit.pence && OPEN.includes(row.status))) {
        // Another amount (other services, or the shop's setting changed): the
        // old hold goes, so the customer is never held for two.
        if (ref && OPEN.includes(row.status)) await provider.release(ref);
        ({ ref } = await provider.hold({ amountPence: deposit.pence, key: `${keyHash}:${randomUUID()}` }));
        made = ref;
        await prepare("UPDATE online_payments SET provider = ?, provider_ref = ?, amount_pence = ?, status = 'waiting', updated_at = now() WHERE id = ?")
          .run(provider.name, ref, deposit.pence, row.id);
      }
      await dbExec('COMMIT');
      made = null;
      sendJson(res, 200, { paymentId: row.id, depositPence: deposit.pence, provider: provider.name, ref });
    } catch (err) {
      await dbExec('ROLLBACK');
      if (made) await provider.release(made).catch((e) => console.error('deposit hold not recorded, and couldn’t be let go', e));
      throw err;
    }
  });

  // The pretend provider's stand-in for its card form: only while it's the
  // provider (design 2). A real provider's form talks to the provider itself.
  // screens: details
  route('POST', '/api/portal/:shopSlug/pretend-payments/:ref/card', async (req, res, params) => {
    const provider = payments();
    if (provider?.name !== 'pretend') return notFound(res, 'Not found');
    const { cardNumber } = (await readJsonBody(req)) ?? {};
    try {
      const { status } = await provider.card(params.ref, cardNumber);
      await prepare('UPDATE online_payments SET status = ?, updated_at = now() WHERE provider = ? AND provider_ref = ?').run(status, 'pretend', params.ref);
      if (status === 'declined') return sendJson(res, 402, { error: 'The card didn’t go through.', code: 'card_declined' });
      sendJson(res, 200, { status });
    } catch (err) {
      if (!(err instanceof PaymentError)) throw err;
      if (err.code === 'not_found') return notFound(res, 'Payment not found');
      if (err.code === 'bad_card') return badRequest(res, err.message);
      sendJson(res, 409, { error: err.message, code: err.code });
    }
  });
}
