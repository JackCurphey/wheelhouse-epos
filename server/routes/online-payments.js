// Online payments set up by the Owner, and the Online orders settings
// (openspec/changes/website-management design 6; drawings ws-pay-*). The shop
// connects its own account through the payments adapter: Wheelhouse sends the
// Owner to the provider's page and takes them back. Owner only, until roles
// are built (server/lib/owner-only.js).
import { prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';
import { endTrip, html, peekTrip, redirect, startTrip } from '../lib/trips.js';
import { payments, PaymentError } from '../payments/index.js';
import { isConnected, paymentAccount, paymentsState } from '../payments/provider.js';

const SETTINGS_PAGE = '/workshop/settings?room=front-desk&fold=paying-online';
const NOT_CONNECTED = { error: 'Connect online payments first.', code: 'payments_not_connected' };
const TEST_PENCE = 100;

async function settingsBody() {
  const provider = payments();
  const account = await paymentAccount();
  const stored = await prepare('SELECT buying_online FROM online_order_settings').get();
  const by = account?.connected_by ? await prepare('SELECT name FROM logins WHERE id = ?').get(account.connected_by) : null;
  return {
    buyingOnline: !!stored?.buying_online && isConnected(account),
    payments: {
      state: paymentsState(account),
      // False once a more-details date has passed: payments have stopped, so no Buying online switch.
      connected: isConnected(account),
      providerName: provider?.displayName ?? null,
      connectedByName: by?.name ?? null,
      connectedAt: account?.connected_at ?? null,
      testPaidAt: account?.test_paid_at ?? null,
      payoutLast4: account?.payout_last4 ?? null,
      payoutTiming: account?.payout_timing ?? null,
      needsDetailsBy: account?.needs_details_by ?? null,
      needsWhat: account?.needs_what ?? null,
    },
  };
}

const setBuyingOnline = (on) => prepare(
  `INSERT INTO online_order_settings (buying_online) VALUES (?)
   ON CONFLICT (shop_id) DO UPDATE SET buying_online = EXCLUDED.buying_online, updated_at = now()
   RETURNING shop_id`
).run(on);

/** Today's line for the Owner when the provider wants more details by a date (ws-today-pay-more). */
export async function paymentsNeedDetails() {
  const account = await paymentAccount();
  if (account?.status !== 'needs_details') return [];
  return [{ kind: 'payments_need_details', providerName: payments()?.displayName ?? null, needsDetailsBy: account.needs_details_by, needsWhat: account.needs_what }];
}

export function register(route) {
  // screens: settings-online-orders
  route('GET', '/api/online-orders-settings', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    sendJson(res, 200, await settingsBody());
  });

  route('PUT', '/api/online-orders-settings', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const body = (await readJsonBody(req)) ?? {};
    if (typeof body.buyingOnline !== 'boolean') return badRequest(res, 'Say whether Buying online is on');
    if (body.buyingOnline && !isConnected(await paymentAccount())) return sendJson(res, 409, NOT_CONNECTED);
    await setBuyingOnline(body.buyingOnline);
    sendJson(res, 200, await settingsBody());
  });

  // Connect [payment provider], and Add the details: off to the provider's page.
  route('POST', '/api/online-payments/connect', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const provider = payments();
    if (!provider) return sendJson(res, 409, { error: 'No payment provider is set up for Wheelhouse yet.', code: 'no_provider' });
    const ctx = await currentSession(req);
    sendJson(res, 200, { address: provider.connectAddress(startTrip({ shopId, loginId: ctx.login.id, kind: 'connect' })) });
  });

  // The pretend provider's own pages, only while it is the one this server uses.
  route('GET', '/api/online-payments/pretend-connect', async (req, res, params, query) => {
    if (payments()?.name !== 'pretend') return notFound(res);
    html(res, payments().connectPage(query.get('state') || ''));
  });
  route('GET', '/api/online-payments/pretend-card', async (req, res, params, query) => {
    if (payments()?.name !== 'pretend') return notFound(res);
    html(res, payments().payPage(query.get('state') || ''));
  });

  // Back from the provider's page: connected, or didn't finish (ws-pay-failed).
  route('GET', '/api/online-payments/return', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const provider = payments();
    const trip = provider && endTrip(query.get('state'), shopId, 'connect');
    if (!trip) return badRequest(res, 'That link has expired. Press Connect again.');
    const before = await paymentAccount();
    // Adding details to the same connection keeps who connected it and when, and
    // its test payment; a new connection (none before, failed, or another
    // provider's) starts again and asks for a new test payment.
    const same = isConnected(before) || before?.status === 'needs_details';
    const answer = await provider.connectFinish(query);
    if (!answer.connected) {
      // Cancelling "Add the details" leaves a connected shop as it was: nothing has changed.
      if (!same) {
        await prepare(
          `INSERT INTO online_payment_account (provider, status) VALUES (?, 'failed')
           ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = 'failed', updated_at = now()
   RETURNING shop_id`
        ).run(provider.name);
      }
      return redirect(res, `${SETTINGS_PAGE}&payments=failed`);
    }
    // Asked, not assumed: whether the provider still wants more details by a date.
    const state = await provider.accountState();
    const needsBy = state?.needsDetailsBy ?? null;
    await prepare(
      `INSERT INTO online_payment_account (provider, status, connected_by, connected_at, needs_details_by, needs_what, payout_last4, payout_timing)
       VALUES (?, ?, ?, now(), ?, ?, ?, ?)
       ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = EXCLUDED.status,
         connected_by = CASE WHEN ? THEN online_payment_account.connected_by ELSE EXCLUDED.connected_by END,
         connected_at = CASE WHEN ? THEN online_payment_account.connected_at ELSE EXCLUDED.connected_at END,
         test_paid_at = CASE WHEN ? THEN online_payment_account.test_paid_at END,
         needs_details_by = EXCLUDED.needs_details_by, needs_what = EXCLUDED.needs_what,
         payout_last4 = COALESCE(EXCLUDED.payout_last4, CASE WHEN ? THEN online_payment_account.payout_last4 END),
         payout_timing = COALESCE(EXCLUDED.payout_timing, CASE WHEN ? THEN online_payment_account.payout_timing END),
         updated_at = now()
   RETURNING shop_id`
    ).run(provider.name, needsBy ? 'needs_details' : 'connected', trip.loginId, needsBy, state?.needsWhat ?? null,
      answer.payoutLast4, answer.payoutTiming, same, same, same, same, same);
    // Connecting switches Buying online on (ws-pay-connected); adding details later leaves the Owner's choice.
    if (!same) await setBuyingOnline(true);
    redirect(res, `${SETTINGS_PAGE}&payments=connected`);
  });

  // Make a £1 test payment (ws-pay-connected): one payment, taken and refunded,
  // however many times it is pressed.
  route('POST', '/api/online-payments/test-payment', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const provider = payments();
    const account = await paymentAccount();
    if (!provider || !isConnected(account)) return sendJson(res, 409, NOT_CONNECTED);
    if (account.test_paid_at) return sendJson(res, 409, { error: 'The test payment has already been made.', code: 'already_tested' });
    // One payment per connection: connecting again makes a new one.
    const connectedMs = new Date(account.connected_at).getTime();
    const { ref } = await provider.hold({ amountPence: TEST_PENCE, key: `test-payment:${provider.name}:${connectedMs}` });
    sendJson(res, 200, { address: provider.payAddress(startTrip({ shopId, kind: 'test', ref, connectedMs })) });
  });

  // The pretend card page's answer, then back through the return below.
  route('GET', '/api/online-payments/pretend-card/pay', async (req, res, params, query, afterRelease, shopId) => {
    const provider = payments();
    if (provider?.name !== 'pretend') return notFound(res);
    const trip = peekTrip(query.get('state'));
    // Only the shop that started it, within its time; anyone else goes on to the return, which turns them away.
    if (trip?.kind === 'test' && trip.shopId === shopId) {
      try {
        await provider.card(trip.ref, query.get('card'));
      } catch (err) {
        // Already paid (pressed twice), or a card number it doesn't know: the
        // return below finds the payment as it is, and says declined if unpaid.
        if (!(err instanceof PaymentError && ['wrong_state', 'bad_card'].includes(err.code))) throw err;
      }
    }
    redirect(res, `/api/online-payments/test-payment/return?state=${encodeURIComponent(query.get('state') || '')}`);
  });

  route('GET', '/api/online-payments/test-payment/return', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const provider = payments();
    const trip = provider && endTrip(query.get('state'), shopId, 'test');
    if (!trip) return badRequest(res, 'That link has expired. Make the test payment again.');
    const { status } = await provider.status(trip.ref);
    if (!['held', 'taken', 'refunded'].includes(status)) {
      // Declined, or not paid: nothing taken, nothing changed; it can be tried again.
      return redirect(res, `${SETTINGS_PAGE}&payments=declined`);
    }
    try {
      if (status === 'held') await provider.take(trip.ref);
      if (status !== 'refunded') await provider.refund(trip.ref, TEST_PENCE);
    } catch (err) {
      // Two returns at once: the other one took and refunded it.
      if (!(err instanceof PaymentError) || (await provider.status(trip.ref)).status !== 'refunded') throw err;
    }
    // Counts only for the connection it was started for; a newer one asks for its own.
    const marked = await prepare(
      `UPDATE online_payment_account SET test_paid_at = COALESCE(test_paid_at, now()), updated_at = now()
        WHERE floor(extract(epoch FROM connected_at) * 1000) = ? RETURNING shop_id`
    ).get(trip.connectedMs);
    redirect(res, marked ? `${SETTINGS_PAGE}&payments=tested` : SETTINGS_PAGE);
  });
}
