// Close the day (openspec/changes/close-the-day; eod-entry, eod-count,
// eod-count-result, eod-banking, eod-paidout, eod-finish, eod-z; cash-up
// decisions 2 to 6; walk-through 2 M2). What the drawer should hold, cash
// taken out, and one close a shop a day with its report, kept as it was at
// the close. Whole pence; the shop's own date. Staff routes for the Owner
// until roles (decision 5: owners and managers): they run with the shop's
// row-level security already bound.
//
// This touches the sales records: a close marks each sale it counts with
// its own id (sales.day_close_id, till_sales.day_close_id, migration 096).
import { prepare, dbExec } from '../db.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { closeEntryNow, entryFor } from '../lib/close-entry.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { DEPOSIT_TENDER } from '../workshop/counted-deposit.js';
import { isPence } from './float-check.js';

export { entryFor };

const iso = (v) => new Date(v).toISOString();

// This morning's float check: what the drawer started with (what was counted,
// or the float when it looked right), by whom and when (walk-through 2 M2).
async function floatStartOn(day) {
  const row = await prepare(`SELECT f.*, l.name AS by_name FROM float_checks f JOIN logins l ON l.id = f.login_id WHERE f.day = ?`).get(day);
  if (!row) return null;
  return {
    id: row.id,
    checkedAt: row.checked_at,
    start: {
      pence: row.counted_pence ?? row.expected_pence, how: row.counted_pence === null ? 'looked' : 'counted',
      expectedPence: row.expected_pence, byName: row.by_name, at: iso(row.checked_at),
    },
  };
}

// Online money, not the till's (Jack's answer 7, 27 Oct): the old record's
// tenders for a Shopify order (server.js) and a deposit paid online
// (workshop/counted-deposit.js). It has its own line on the report.
const ONLINE_TENDERS = ['Shopify', DEPOSIT_TENDER];

// Which sales a figure is worked from. A close counts every sale no close
// has counted yet (Jack's answer 6): `open` is those, before the close marks
// them; `closedBy(id)` is exactly the ones a close marked. A sale is never
// placed in a day by its time, so a till's clock can't move it, and one still
// being saved at the close is left for the next (second review, 27 Oct). The
// one bound by time is where counting began: the start of the shop's first
// close's day (or today's), by the server's own clock, so the history from
// before Close the day isn't swept into the first close.
async function openSales(day) {
  const timeZone = await currentShopTimeZone();
  const { first } = await prepare(`SELECT to_char(COALESCE(min(day), ?::date), 'YYYY-MM-DD') AS first FROM day_closes`).get(day);
  const since = (column) => `${column} >= (?::date)::timestamp AT TIME ZONE ?`;
  return {
    old: { sql: `s.day_close_id IS NULL AND ${since('s.created_at')}`, args: [first, timeZone] },
    till: { sql: `t.day_close_id IS NULL AND ${since('t.received_at')}`, args: [first, timeZone] },
  };
}
const closedBy = (id) => ({ old: { sql: 's.day_close_id = ?', args: [id] }, till: { sql: 't.day_close_id = ?', args: [id] } });

// Till money by how it was paid, from both sales records: the old record's
// cash and card columns and extra tenders (pounds, converted as the all_sales
// view does), and the till record's payments (pence). Takings is card + cash
// + other, so the report always adds up (review, 27 Oct). `after`, when
// given, keeps only sales made after that moment, on the server's clock: a
// till sale by when the server received it, or by the till's own clock only
// when it was made offline (third review, 27 Oct: an online till's clock
// running slow or fast mustn't move its cash in or out of the drawer).
async function takingsIn({ old, till }, after = null) {
  const o = after ? { sql: `${old.sql} AND s.created_at > ?`, args: [...old.args, after] } : old;
  const t = after ? { sql: `${till.sql} AND (CASE WHEN t.made_offline THEN t.till_clock_at ELSE t.received_at END) > ?`, args: [...till.args, after] } : till;
  const os = await prepare(
    `SELECT COALESCE(SUM(ROUND(s.cash_amount * 100)), 0)::int AS cash, COALESCE(SUM(ROUND(s.card_amount * 100)), 0)::int AS card,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${o.sql} AND p.tender_type <> ALL(?)), 0)::int AS other,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${o.sql} AND p.tender_type = ANY(?)), 0)::int AS online
       FROM sales s WHERE ${o.sql}`
  ).get(...o.args, ONLINE_TENDERS, ...o.args, ONLINE_TENDERS, ...o.args);
  const ts = await prepare(
    `SELECT COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'cash'), 0)::int AS cash,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'card'), 0)::int AS card,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method NOT IN ('cash', 'card')), 0)::int AS other
       FROM till_sale_payments p JOIN till_sales t ON t.id = p.till_sale_id WHERE ${t.sql}`
  ).get(...t.args);
  const cash = os.cash + ts.cash;
  const card = os.card + ts.card;
  const other = os.other + ts.other;
  return { takingsPence: card + cash + other, cashPence: cash, cardPence: card, otherPence: other, onlinePence: os.online };
}

// Cash taken out since this morning's float check (Jack's answer 9: the
// morning check counted everything before it), or today's with no check yet.
async function paidOutsSince(day, start) {
  const where = start ? { sql: 'p.created_at > ?', args: [start.checkedAt] } : { sql: 'p.day = ?', args: [day] };
  return paidOutsWhere(where);
}
async function paidOutsWhere({ sql, args }) {
  const rows = await prepare(`SELECT p.*, l.name AS by_name FROM paid_outs p JOIN logins l ON l.id = p.login_id WHERE ${sql} ORDER BY p.created_at, p.id`).all(...args);
  return rows.map((r) => ({ id: r.id, amountPence: r.amount_pence, reason: r.reason, note: r.note, byName: r.by_name, at: iso(r.created_at) }));
}

// What the drawer should hold (Jack's answer 9, "trust the morning check"):
// this morning's start, plus the cash sales since the check, minus the cash
// taken out since it. Cash from before the check was in the morning count,
// so leftover cash from a day nobody closed shows tonight as over.
async function drawer(day, start, sales) {
  const { cashPence } = await takingsIn(sales, start.checkedAt);
  const paidOuts = await paidOutsSince(day, start);
  const paidOutsPence = paidOuts.reduce((n, p) => n + p.amountPence, 0);
  return { cashPence, paidOuts, paidOutsPence, expectedPence: start.start.pence + cashPence - paidOutsPence };
}

async function closeOn(day) {
  const r = await prepare(`SELECT c.*, to_char(c.day, 'YYYY-MM-DD') AS day_text, l.name AS closed_by_name
    FROM day_closes c JOIN logins l ON l.id = c.login_id WHERE c.day = ?`).get(day);
  if (!r) return null;
  const start = await floatStartOn(day);
  return {
    id: r.id, day: r.day_text, closedByName: r.closed_by_name, closedAt: iso(r.closed_at),
    floatStart: { ...start.start, pence: r.float_start_pence },
    cashPence: r.cash_pence, drawerCashPence: r.drawer_cash_pence, paidOutsPence: r.paid_outs_pence, expectedPence: r.expected_pence,
    countedPence: r.counted_pence, differencePence: r.counted_pence - r.expected_pence, reason: r.reason,
    floatPence: r.float_pence, bankedPence: r.banked_pence, ...leftAndTopUp(r.counted_pence, r.float_pence),
    takingsPence: r.takings_pence, cardPence: r.card_pence, otherPence: r.other_pence, onlinePence: r.online_pence,
  };
}

// Leave the float, bank the rest (decision 4). A count under the float banks
// nothing, and the difference is put in to make the float up (Jack's answer
// 5, 27 Oct), so the drawer is left with the float either way.
const bankedFrom = (counted, float) => Math.max(0, counted - float);
function leftAndTopUp(counted, float) {
  const topUpPence = Math.max(0, float - counted);
  return { leftPence: counted - bankedFrom(counted, float) + topUpPence, topUpPence };
}

const OWNER_ONLY = "Only the shop's owner can close the day";

// The close and a paid-out each lock the shop's row first, so a paid-out at
// the moment of closing is in the close or refused, and two closes queue
// (the settings-saves-dont-clash pattern). NO KEY UPDATE, so a sale being
// saved (its foreign key takes KEY SHARE on the shop) isn't held up
// (review, 27 Oct). `fn` returns the reply to send after COMMIT, or a
// refusal after ROLLBACK.
async function lockedOnShop(shopId, fn) {
  await dbExec('BEGIN');
  let reply;
  try {
    await prepare('SELECT id FROM shops WHERE id = ? FOR NO KEY UPDATE').get(shopId);
    reply = await fn();
    await dbExec(reply.ok ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
  return reply;
}

export function register(route) {
  route('GET', '/api/close-the-day', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const { day, entry } = await closeEntryNow();
    const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    const start = await floatStartOn(day);
    const d = start ? await drawer(day, start, await openSales(day)) : { cashPence: 0, paidOuts: await paidOutsSince(day, null), expectedPence: null };
    sendJson(res, 200, {
      day, floatPence, floatStart: start?.start ?? null, cashPence: d.cashPence,
      paidOutsPence: d.paidOuts.reduce((n, p) => n + p.amountPence, 0), expectedPence: d.expectedPence,
      paidOuts: d.paidOuts, entry, close: await closeOn(day),
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
    const { day } = await closeEntryNow();
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ?').get(day)) return { status: 409, body: { error: 'Today is already closed', code: 'day_closed' } };
      const { id } = await prepare('INSERT INTO paid_outs (day, login_id, amount_pence, reason, note) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .get(day, ctx.login.id, body.amountPence, body.reason.trim(), note);
      return { ok: true, status: 201, id };
    });
    if (!reply.ok) return sendJson(res, reply.status, reply.body);
    const [paidOut] = await paidOutsWhere({ sql: 'p.id = ?', args: [reply.id] });
    sendJson(res, 201, { paidOut });
  });

  // Close the day (eod-finish): the count and an optional reason. Under the
  // shop's lock the close is saved, marks every sale no close has counted,
  // and works its figures out from exactly the sales it marked; a refusal
  // after that rolls the marking back with it.
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
    // The expected figure the screen showed, if sent: a sale or cash taken out
    // since then changes it, and the owner sees the new difference first.
    const shown = body.expectedPence;
    if (shown !== undefined && !Number.isSafeInteger(shown)) return badRequest(res, 'The expected figure must be whole pence');
    const { day } = await closeEntryNow();
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ?').get(day)) return { status: 409, body: { error: 'Today is already closed', code: 'already_closed' } };
      const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
      if (floatPence === null) return { status: 409, body: { error: 'The shop has no float set', code: 'no_float' } };
      const start = await floatStartOn(day);
      if (!start) return { status: 409, body: { error: 'Check the float before closing the day', code: 'float_not_checked' } };
      const open = await openSales(day);
      // Saved first, so the sales can be marked with its id; the figures follow.
      const made = await prepare(
        `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
           reason, float_pence, banked_pence, takings_pence, card_pence, other_pence)
         VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, 0, 0, 0) ON CONFLICT (shop_id, day) DO NOTHING RETURNING id`
      ).get(day, ctx.login.id, start.id, start.start.pence, counted, reason, floatPence, bankedFrom(counted, floatPence));
      if (!made) return { status: 409, body: { error: 'Today is already closed', code: 'already_closed' } };
      await prepare(`UPDATE sales s SET day_close_id = ? WHERE ${open.old.sql}`).run(made.id, ...open.old.args);
      await prepare(`UPDATE till_sales t SET day_close_id = ? WHERE ${open.till.sql}`).run(made.id, ...open.till.args);
      const counts = closedBy(made.id);
      const t = await takingsIn(counts);
      const d = await drawer(day, start, counts);
      if (shown !== undefined && shown !== d.expectedPence) {
        return { status: 409, body: { error: 'The till’s figures changed while you were counting. Check the difference again.', code: 'expected_changed', expectedPence: d.expectedPence } };
      }
      await prepare(
        `UPDATE day_closes SET cash_pence = ?, drawer_cash_pence = ?, paid_outs_pence = ?, expected_pence = ?,
           takings_pence = ?, card_pence = ?, other_pence = ?, online_pence = ? WHERE id = ?`
      ).run(t.cashPence, d.cashPence, d.paidOutsPence, d.expectedPence, t.takingsPence, t.cardPence, t.otherPence, t.onlinePence, made.id);
      return { ok: true };
    });
    if (!reply.ok) {
      if (reply.body.code === 'already_closed') reply.body.close = await closeOn(day);
      return sendJson(res, reply.status, reply.body);
    }
    sendJson(res, 201, { close: await closeOn(day) });
  });
}
