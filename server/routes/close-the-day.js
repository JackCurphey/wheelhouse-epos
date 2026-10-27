// Close the day (openspec/changes/close-the-day; eod-entry, eod-count,
// eod-count-result, eod-banking, eod-paidout, eod-finish, eod-z; cash-up
// decisions 2 to 6; walk-through 2 M2). What the drawer should hold, cash
// taken out, and one close a shop a day with its report, kept as it was at
// the close. Whole pence; the shop's own date. Staff routes for the Owner
// until roles (decision 5: owners and managers): they run with the shop's
// row-level security already bound.
import { prepare, dbExec } from '../db.js';
import { shopNow } from '../clock.js';
import { effectiveHours, toMinutes } from '../capacity.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { shopDayWindow } from '../lib/sales.js';
import { currentShopTimeZone, toCapacitySettings } from '../workshop/jobs.js';
import { isPence } from './float-check.js';

const iso = (v) => new Date(v).toISOString();

// "Close the day" shows from an hour before closing (cash-up decision 5;
// set-eod-close's drawn "1 hour before", until that setting is built), all
// day when the opening hours say the shop is shut today, and not once the
// day is closed. `hours` is today's { open, close } or null; `minutes` is
// the shop's time of day.
export function entryFor(hours, minutes, closed) {
  const closesAt = hours ? hours.close : null;
  if (closed) return { show: false, closesAt };
  return { show: hours ? minutes >= toMinutes(hours.close) - 60 : true, closesAt };
}

// This morning's float check: what the drawer started with (what was counted,
// or the float when it looked right), by whom and when (walk-through 2 M2).
async function floatStartOn(day) {
  const row = await prepare(`SELECT f.*, l.name AS by_name FROM float_checks f JOIN logins l ON l.id = f.login_id WHERE f.day = ?`).get(day);
  if (!row) return null;
  return {
    id: row.id,
    start: {
      pence: row.counted_pence ?? row.expected_pence, how: row.counted_pence === null ? 'looked' : 'counted',
      expectedPence: row.expected_pence, byName: row.by_name, at: iso(row.checked_at),
    },
  };
}

// The day's takings by how they were paid, from both sales records on the
// dashboard's day window: the old record's cash and card columns and extra
// tenders (pounds, converted as the all_sales view does), and the till
// record's payments (pence).
async function takingsOn(day) {
  const old = await shopDayWindow('s.created_at', day);
  const till = await shopDayWindow('t.till_clock_at', day);
  const all = await shopDayWindow('made_at', day);
  const { takings } = await prepare(`SELECT COALESCE(SUM(total_pence), 0)::int AS takings FROM all_sales WHERE ${all.sql}`).get(...all.args);
  const o = await prepare(
    `SELECT COALESCE(SUM(ROUND(s.cash_amount * 100)), 0)::int AS cash, COALESCE(SUM(ROUND(s.card_amount * 100)), 0)::int AS card,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${old.sql}), 0)::int AS other
       FROM sales s WHERE ${old.sql}`
  ).get(...old.args, ...old.args);
  const t = await prepare(
    `SELECT COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'cash'), 0)::int AS cash,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'card'), 0)::int AS card,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method NOT IN ('cash', 'card')), 0)::int AS other
       FROM till_sale_payments p JOIN till_sales t ON t.id = p.till_sale_id WHERE ${till.sql}`
  ).get(...till.args);
  return { takingsPence: takings, cashPence: o.cash + t.cash, cardPence: o.card + t.card, otherPence: o.other + t.other };
}

async function paidOutsOn(day) {
  const rows = await prepare(`SELECT p.*, l.name AS by_name FROM paid_outs p JOIN logins l ON l.id = p.login_id WHERE p.day = ? ORDER BY p.created_at, p.id`).all(day);
  return rows.map((r) => ({ id: r.id, amountPence: r.amount_pence, reason: r.reason, note: r.note, byName: r.by_name, at: iso(r.created_at) }));
}

async function closeOn(day) {
  const r = await prepare(`SELECT c.*, to_char(c.day, 'YYYY-MM-DD') AS day_text, l.name AS closed_by_name
    FROM day_closes c JOIN logins l ON l.id = c.login_id WHERE c.day = ?`).get(day);
  if (!r) return null;
  const start = await floatStartOn(day);
  return {
    id: r.id, day: r.day_text, closedByName: r.closed_by_name, closedAt: iso(r.closed_at),
    floatStart: { ...start.start, pence: r.float_start_pence },
    cashPence: r.cash_pence, paidOutsPence: r.paid_outs_pence, expectedPence: r.expected_pence,
    countedPence: r.counted_pence, differencePence: r.counted_pence - r.expected_pence, reason: r.reason,
    floatPence: r.float_pence, bankedPence: r.banked_pence, leftPence: r.counted_pence - r.banked_pence,
    takingsPence: r.takings_pence, cardPence: r.card_pence, otherPence: r.other_pence,
  };
}

const OWNER_ONLY = "Only the shop's owner can close the day";

// The close and a paid-out each lock the shop's row first, so a paid-out at
// the moment of closing is in the close or refused, and two closes queue
// (the settings-saves-dont-clash pattern). `fn` returns the reply to send
// after COMMIT, or a refusal after ROLLBACK.
async function lockedOnShop(shopId, fn) {
  await dbExec('BEGIN');
  let reply;
  try {
    await prepare('SELECT id FROM shops WHERE id = ? FOR UPDATE').get(shopId);
    reply = await fn();
    await dbExec(reply.ok ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
  return reply;
}

const today = async () => shopNow(await currentShopTimeZone());

export function register(route) {
  route('GET', '/api/close-the-day', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const now = await today();
    const day = now.date;
    const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    const start = await floatStartOn(day);
    const { cashPence } = await takingsOn(day);
    const paidOuts = await paidOutsOn(day);
    const paidOutsPence = paidOuts.reduce((n, p) => n + p.amountPence, 0);
    const close = await closeOn(day);
    const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    sendJson(res, 200, {
      day, floatPence, floatStart: start?.start ?? null, cashPence, paidOutsPence,
      expectedPence: start ? start.start.pence + cashPence - paidOutsPence : null,
      paidOuts, entry: entryFor(effectiveHours(toCapacitySettings(settings), weekday), now.minutes, !!close), close,
    });
  });

  // Cash taken out of the drawer (eod-paidout): how much, what it was for, a
  // note; who and when. Not once the day is closed.
  route('POST', '/api/paid-outs', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Send the cash taken out');
    if (!isPence(body.amountPence) || body.amountPence < 1) return badRequest(res, 'The amount must be pounds and pence, more than nothing');
    if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 100) return badRequest(res, 'Say what it was for, in up to 100 characters');
    if (body.note !== undefined && typeof body.note !== 'string') return badRequest(res, 'The note must be text');
    const note = (body.note ?? '').trim();
    if (note.length > 500) return badRequest(res, 'The note can be up to 500 characters');
    const day = (await today()).date;
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ?').get(day)) return { status: 409, body: { error: 'Today is already closed', code: 'day_closed' } };
      const { id } = await prepare('INSERT INTO paid_outs (day, login_id, amount_pence, reason, note) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .get(day, ctx.login.id, body.amountPence, body.reason.trim(), note);
      return { ok: true, status: 201, id };
    });
    if (!reply.ok) return sendJson(res, reply.status, reply.body);
    const paidOut = (await paidOutsOn(day)).find((p) => p.id === reply.id);
    sendJson(res, 201, { paidOut });
  });

  // Close the day (eod-finish): the count and an optional reason; the server
  // works out what was expected, the banking and the takings, and keeps them.
  route('POST', '/api/close-the-day', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Send the count');
    const counted = body.countedPence;
    if (!isPence(counted)) return badRequest(res, 'The count must be pounds and pence');
    if (body.reason !== undefined && typeof body.reason !== 'string') return badRequest(res, 'The reason must be text');
    const reason = (body.reason ?? '').trim();
    if (reason.length > 500) return badRequest(res, 'The reason can be up to 500 characters');
    const day = (await today()).date;
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ?').get(day)) return { status: 409, body: { error: 'Today is already closed', code: 'already_closed' } };
      const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
      if (floatPence === null) return { status: 409, body: { error: 'The shop has no float set', code: 'no_float' } };
      const start = await floatStartOn(day);
      if (!start) return { status: 409, body: { error: 'Check the float before closing the day', code: 'float_not_checked' } };
      const t = await takingsOn(day);
      const { n: paidOutsPence } = await prepare('SELECT COALESCE(SUM(amount_pence), 0)::int AS n FROM paid_outs WHERE day = ?').get(day);
      const expected = start.start.pence + t.cashPence - paidOutsPence;
      // Leave the float, bank the rest (decision 4); a count under the float banks nothing.
      const banked = Math.max(0, counted - floatPence);
      const made = await prepare(
        `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
           reason, float_pence, banked_pence, takings_pence, card_pence, other_pence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shop_id, day) DO NOTHING RETURNING id`
      ).get(day, ctx.login.id, start.id, start.start.pence, t.cashPence, paidOutsPence, expected, counted, reason, floatPence, banked, t.takingsPence, t.cardPence, t.otherPence);
      if (!made) return { status: 409, body: { error: 'Today is already closed', code: 'already_closed' } };
      return { ok: true };
    });
    if (!reply.ok) {
      if (reply.body.code === 'already_closed') reply.body.close = await closeOn(day);
      return sendJson(res, reply.status, reply.body);
    }
    sendJson(res, 201, { close: await closeOn(day) });
  });
}
