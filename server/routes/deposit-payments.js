// Paying a booking's deposit, the public routes (openspec/changes/deposit-payments
// design 2 and 4). Portal routes run in the shop's row-level security, from
// :shopSlug.
import { prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { payments, PaymentError } from '../payments/index.js';

export function register(route) {
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
