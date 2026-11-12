// Online payments set up by the Owner, and the Online orders settings
// (openspec/changes/website-management design 6; drawings ws-pay-*). The shop
// connects its own account through the payments adapter: Wheelhouse sends the
// Owner to the provider's page and takes them back. Owner only, until roles
// are built (server/lib/owner-only.js).
import { randomBytes } from 'node:crypto';
import { prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';
import { payments, PaymentError } from '../payments/index.js';
import { isConnected, paymentAccount, paymentsState } from '../payments/provider.js';

const SETTINGS_PAGE = '/workshop/settings?room=front-desk&fold=online-orders';
const NOT_CONNECTED = { error: 'Connect online payments first.', code: 'payments_not_connected' };
const TEST_PENCE = 100;

// A trip to the provider's page and back: single use, for the shop and Owner
// who started it, for 30 minutes. Held in memory, so a restart means pressing
// Connect again (logged in decided-while-building).
const trips = new Map();
const TRIP_MS = 30 * 60 * 1000;
function startTrip(trip) {
  const now = Date.now();
  for (const [key, t] of trips) if (t.expires < now) trips.delete(key);
  const state = randomBytes(24).toString('hex');
  trips.set(state, { ...trip, expires: now + TRIP_MS });
  return state;
}
function endTrip(state, shopId, kind) {
  const trip = typeof state === 'string' ? trips.get(state) : null;
  if (!trip || trip.shopId !== shopId || trip.kind !== kind || trip.expires < Date.now()) return null;
  trips.delete(state);
  return trip;
}
function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function settingsBody() {
  const provider = payments();
  const account = await paymentAccount();
  const stored = await prepare('SELECT buying_online FROM online_order_settings').get();
  const by = account?.connected_by ? await prepare('SELECT name FROM logins WHERE id = ?').get(account.connected_by) : null;
  return {
    buyingOnline: !!stored?.buying_online && isConnected(account),
    payments: {
      state: paymentsState(account),
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
    const answer = await provider.connectFinish(query);
    if (!answer.connected) {
      // Cancelling "Add the details" leaves a connected shop as it was: nothing has changed.
      if (!isConnected(before)) {
        await prepare(
          `INSERT INTO online_payment_account (provider, status) VALUES (?, 'failed')
           ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = 'failed', updated_at = now()
   RETURNING shop_id`
        ).run(provider.name);
      }
      return redirect(res, `${SETTINGS_PAGE}&payments=failed`);
    }
    await prepare(
      `INSERT INTO online_payment_account (provider, status, connected_by, connected_at, payout_last4, payout_timing)
       VALUES (?, 'connected', ?, now(), ?, ?)
       ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = 'connected',
         connected_by = EXCLUDED.connected_by, connected_at = EXCLUDED.connected_at,
         needs_details_by = NULL, needs_what = NULL,
         payout_last4 = EXCLUDED.payout_last4, payout_timing = EXCLUDED.payout_timing, updated_at = now()
   RETURNING shop_id`
    ).run(provider.name, trip.loginId, answer.payoutLast4, answer.payoutTiming);
    // Connecting switches Buying online on (ws-pay-connected); adding details later leaves the Owner's choice.
    if (!isConnected(before)) await setBuyingOnline(true);
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
    const { ref } = await provider.hold({ amountPence: TEST_PENCE, key: `test-payment:${shopId}` });
    sendJson(res, 200, { address: provider.payAddress(startTrip({ shopId, kind: 'test', ref })) });
  });

  // The pretend card page's answer, then back through the return below.
  route('GET', '/api/online-payments/pretend-card/pay', async (req, res, params, query) => {
    const provider = payments();
    if (provider?.name !== 'pretend') return notFound(res);
    const trip = trips.get(query.get('state'));
    if (trip?.kind === 'test') {
      try {
        await provider.card(trip.ref, query.get('card'));
      } catch (err) {
        // Already paid (pressed twice): the return below finds it as it is.
        if (!(err instanceof PaymentError && err.code === 'wrong_state')) throw err;
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
    await prepare('UPDATE online_payment_account SET test_paid_at = COALESCE(test_paid_at, now()), updated_at = now()').run();
    redirect(res, `${SETTINGS_PAGE}&payments=tested`);
  });
}
