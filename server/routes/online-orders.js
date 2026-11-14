// screens: on-orders, on-orders-ready, on-orders-sold-at-till, on-order-staff, on-not-ready, on-hand-over
// The staff's online orders on the server (openspec/changes/website-buy-online,
// design 5, 7 and 10; tasks 6.1–6.7). Anyone signed in sees the list, marks an
// order ready, moves it back and hands it over (design 10). A step needs
// someone checked in at a till, as the other steps that say who (whoIsBooking).
// No money is taken and no stock moves here: paying did both.
// Staff routes: a handler gets (req, res, params, query, afterRelease, shopId)
// with the shop's row-level security already bound.
import { dbExec } from '../db.js';
import { badRequest, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { queueOrderMessage, READY_WAIT_SECONDS, undoOrderReady } from '../online-orders/messages.js';
import { groupedOrders, oneOrder, Refused, takeStep, toGetReadyCount } from '../online-orders/orders.js';
import { CHECK_IN_FIRST, siteHere, whoIsBooking } from './purchase-orders.js';

// BEGIN, the change, COMMIT; a refusal rolls back.
async function save(res, change) {
  let reply;
  await dbExec('BEGIN');
  try {
    reply = await change();
    await dbExec('COMMIT');
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    if (err instanceof ValidationError) return badRequest(res, err.message);
    if (err instanceof Refused) return sendJson(res, err.status, err.body);
    throw err;
  }
  sendJson(res, 200, reply);
}

export function register(route) {
  // The list (on-orders): To get ready, Ready to collect and Collected (the
  // last 7 days). On a till or workshop computer, only its own shop's orders.
  route('GET', '/api/online-orders', async (req, res) => {
    const groups = await groupedOrders({ siteId: (await siteHere(req)) ?? null });
    sendJson(res, 200, { groups });
  });

  // The sidebar's count: orders to get ready.
  route('GET', '/api/online-order-count', async (req, res) => {
    sendJson(res, 200, { count: await toGetReadyCount({ siteId: (await siteHere(req)) ?? null }) });
  });

  route('GET', '/api/online-orders/:id', async (req, res, params) => {
    const order = await oneOrder(Number(params.id));
    if (!order) return sendJson(res, 404, { error: 'Not found' });
    sendJson(res, 200, { order });
  });

  // Mark ready (on-orders-ready): the ready email waits a few seconds for Undo.
  route('POST', '/api/online-orders/:id/ready', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, async () => {
      await takeStep(id, 'ready', who);
      await queueOrderMessage(id, 'order_ready', { req, loginId: who.loginId });
      return { order: await oneOrder(id), waitSeconds: READY_WAIT_SECONDS };
    });
  });

  // Undo of Mark ready: back to To get ready, and the email stopped while it waits.
  route('POST', '/api/online-orders/:id/ready/undo', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, async () => {
      await takeStep(id, 'ready_undone', who);
      await undoOrderReady(id);
      return { order: await oneOrder(id) };
    });
  });

  // Not ready after all (on-not-ready): back to To get ready; the sorry email only when ticked.
  route('POST', '/api/online-orders/:id/not-ready', async (req, res, params) => {
    const body = await readJsonBody(req);
    if (typeof body?.tell !== 'boolean') return badRequest(res, 'Say whether to send the customer “Sorry, not ready yet”');
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, async () => {
      await takeStep(id, 'not_ready', who, { told: body.tell });
      // A ready email still in its seconds doesn't go either.
      await undoOrderReady(id);
      if (body.tell) await queueOrderMessage(id, 'order_not_ready', { req, loginId: who.loginId });
      return { order: await oneOrder(id) };
    });
  });

  // Hand over (on-hand-over): collected, with who and when. Already paid
  // online, so nothing is taken; the stock came off at payment. Sent again,
  // it answers with the collected order and collects it once.
  route('POST', '/api/online-orders/:id/hand-over', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, async () => {
      await takeStep(id, 'collected', who);
      return { order: await oneOrder(id) };
    });
  });
}
