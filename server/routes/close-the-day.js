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
//
// A day nobody closed (openspec/changes/unclosed-day; op-close-yesterday;
// Jack's 29 Oct answer 5): the next morning's float check counts it
// (float_checks.for_day, migration 106), and "Close it" closes it later from
// that count, with the sales made up to it.
import { prepare, dbExec } from '../db.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { closeEntryNow, entryFor } from '../lib/close-entry.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { ONLINE_TENDERS } from '../accounts/online-tenders.js';
import { C2W_TENDER } from '../c2w/hand-over.js';
import { isPence, MAX_PENCE } from './float-check.js';
import { afterClose } from '../accounts/send.js';

export { entryFor };

const iso = (v) => new Date(v).toISOString();

// This morning's float check: what the drawer started with (what was counted,
// or the float when it looked right), by whom and when (walk-through 2 M2).
//
// Every time read here only to be compared again (`checkedAt`, a count's,
// a close's) is kept as the database's own text, to the microsecond: a
// JavaScript date keeps only milliseconds, so a row compared with its own
// time read back looked to be after itself (money review of #584, 1).
async function floatStartOn(day) {
  const row = await prepare(`SELECT f.*, f.checked_at::text AS checked_at_exact, COALESCE(e.name, l.name) AS by_name FROM float_checks f JOIN logins l ON l.id = f.login_id LEFT JOIN employees e ON e.id = f.employee_id WHERE f.day = ?`).get(day);
  if (!row) return null;
  return {
    id: row.id,
    checkedAt: row.checked_at_exact,
    // The Owner's look at closing (Jack's answer 8): no count, nobody checked
    // in at a till. On a day nobody then closed, it doesn't start the day's
    // cash (money review 2, 29 Oct).
    closingLook: row.counted_pence === null && row.employee_id === null && row.till_id === null,
    start: {
      pence: row.counted_pence ?? row.expected_pence, how: row.counted_pence === null ? 'looked' : 'counted',
      expectedPence: row.expected_pence, byName: row.by_name, at: iso(row.checked_at),
    },
  };
}

// A Cycle to Work hand-over's provider share ("Cycle to Work · Cyclescheme", server/c2w/hand-over.js):
// owed by the provider, not in the drawer, so a figure of its own, not Other (UX walk-through 5 H3),
// beside the takings and not in them, like the online money (Jack, 14 Nov, merge-c2w Q1 option 2).
// Matched without case, like moneyBucket (decided-while-building 2026-11-jack, hand-over item 11).
const C2W_LIKE = `${C2W_TENDER}%`;

// Which sales a figure is worked from. A close counts every sale no close
// has counted yet (Jack's answer 6): `open` is those, before the close marks
// them; `closedBy(id)` is exactly the ones a close marked. A sale is never
// placed in a day by its time, so a till's clock can't move it, and one still
// being saved at the close is left for the next (second review, 27 Oct). The
// one bound by time is where counting began: the start of the shop's first
// close's day (or today's), by the server's own clock, so the history from
// before Close the day isn't swept into the first close.
//
// `upTo`, for a day nobody closed, keeps only the sales made up to the
// morning count that counted it (unclosed-day design 4): its cash was in
// that count; later sales are the next day's.
async function openSales(day, upTo = null) {
  const timeZone = await currentShopTimeZone();
  const { first } = await prepare(`SELECT to_char(COALESCE(min(day), ?::date), 'YYYY-MM-DD') AS first FROM day_closes`).get(day);
  const since = (column) => `${column} >= (?::date)::timestamp AT TIME ZONE ?`;
  const until = (at) => (upTo ? { sql: ` AND ${at} <= ?`, args: [upTo] } : { sql: '', args: [] });
  const [o, t] = [until(OLD_AT), until(TILL_AT)];
  return {
    old: { sql: `s.day_close_id IS NULL AND ${since('s.created_at')}${o.sql}`, args: [first, timeZone, ...o.args] },
    till: { sql: `t.day_close_id IS NULL AND ${since('t.received_at')}${t.sql}`, args: [first, timeZone, ...t.args] },
  };
}
// When a sale was made, on the server's clock: the old record's saved time,
// and a till sale's time received, or its till's own clock only when it was
// made offline (third review, 27 Oct).
const OLD_AT = 's.created_at';
const TILL_AT = '(CASE WHEN t.made_offline THEN t.till_clock_at ELSE t.received_at END)';
// Online money taken so far today: what the next close would keep apart, from the
// sales no close has counted yet. A day nobody closed takes its own sales, up to the
// morning count that counted it, when it is closed later, so today's figure starts
// after the latest such count. Reports shows it as "[£] so far" (rp-takings).
export async function onlineSoFar(day) {
  const last = (await daysWaiting()).at(-1);
  const after = last ? (await countFor(last.for_day))?.checkedAt ?? null : null;
  return (await takingsIn(await openSales(day), after)).onlinePence;
}
// What a day nobody closed has taken so far: its sales up to the morning count that counted
// it, and after the count of the unclosed day before it, whose late close takes those (the
// same windows the late closes work from, unclosed-day design 4). Reports shows it on the
// day's "Not closed" row, beside a link to close it.
export async function takingsSoFarFor(day) {
  const count = await countFor(day);
  const earlier = (await daysWaiting()).filter((w) => w.for_day < day).at(-1);
  const after = earlier ? (await countFor(earlier.for_day))?.checkedAt ?? null : null;
  return (await takingsIn(await openSales(day, count?.checkedAt ?? null), after)).takingsPence;
}
const closedBy = (id) => ({ old: { sql: 's.day_close_id = ?', args: [id] }, till: { sql: 't.day_close_id = ?', args: [id] } });

// Till money by how it was paid, from both sales records: the old record's
// cash and card columns and extra tenders (pounds, converted as the all_sales
// view does), and the till record's payments (pence). Takings is card + cash
// + other, so the report always adds up (review, 27 Oct); Cycle to Work and
// online money are beside it, not in it (Jack, 14 Nov). `after`, when
// given, keeps only sales made after that moment, on the server's clock: a
// till sale by when the server received it, or by the till's own clock only
// when it was made offline (third review, 27 Oct: an online till's clock
// running slow or fast mustn't move its cash in or out of the drawer).
async function takingsIn({ old, till }, after = null) {
  const o = after ? { sql: `${old.sql} AND ${OLD_AT} > ?`, args: [...old.args, after] } : old;
  const t = after ? { sql: `${till.sql} AND ${TILL_AT} > ?`, args: [...till.args, after] } : till;
  const os = await prepare(
    `SELECT COALESCE(SUM(ROUND(s.cash_amount * 100)), 0)::int AS cash, COALESCE(SUM(ROUND(s.card_amount * 100)), 0)::int AS card,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${o.sql} AND p.tender_type <> ALL(?) AND p.tender_type NOT ILIKE ?), 0)::int AS other,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${o.sql} AND p.tender_type ILIKE ?), 0)::int AS c2w,
            COALESCE((SELECT SUM(ROUND(p.amount * 100)) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${o.sql} AND p.tender_type = ANY(?)), 0)::int AS online
       FROM sales s WHERE ${o.sql}`
  ).get(...o.args, ONLINE_TENDERS, C2W_LIKE, ...o.args, C2W_LIKE, ...o.args, ONLINE_TENDERS, ...o.args);
  const ts = await prepare(
    `SELECT COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'cash'), 0)::int AS cash,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method = 'card'), 0)::int AS card,
            COALESCE(SUM(p.amount_pence) FILTER (WHERE p.method NOT IN ('cash', 'card')), 0)::int AS other
       FROM till_sale_payments p JOIN till_sales t ON t.id = p.till_sale_id WHERE ${t.sql}`
  ).get(...t.args);
  const cash = os.cash + ts.cash;
  const card = os.card + ts.card;
  const other = os.other + ts.other;
  return { takingsPence: card + cash + other, cashPence: cash, cardPence: card, otherPence: other, c2wPence: os.c2w, onlinePence: os.online };
}

// Cash taken out since this morning's float check (Jack's answer 9: the
// morning check counted everything before it), or today's with no check yet.
// Only the day's own: cash taken out for a day nobody closed, added at its
// "Close it", is that day's (unclosed-day design 8).
async function paidOutsSince(day, start) {
  const where = start ? { sql: 'p.day = ? AND p.created_at > ?', args: [day, start.checkedAt] } : { sql: 'p.day = ?', args: [day] };
  return paidOutsWhere(where);
}
async function paidOutsWhere({ sql, args }) {
  const rows = await prepare(`SELECT p.*, l.name AS by_name FROM paid_outs p JOIN logins l ON l.id = p.login_id WHERE ${sql} ORDER BY p.created_at, p.id`).all(...args);
  return rows.map((r) => ({ id: r.id, amountPence: r.amount_pence, reason: r.reason, note: r.note, byName: r.by_name, at: iso(r.created_at) }));
}

// What the drawer should hold (Jack's answer 9, "trust the morning check"):
// this morning's start, plus the cash sales since the check, minus the cash
// taken out since it. Cash from before the check was in the morning count.
// Minus, too, the cash banked since the check for an earlier day nobody
// closed (unclosed-day design 6): it was in the count. `until`, for a day
// closed late, is the morning count that counted it.
//
// `missed`, for a day nobody closed (money review, 29 Oct): its window runs
// from its float check up to the count, so cash taken out in it counts
// whatever date it carries (one dated the next day but taken out before the
// count was in the count), as does what is added at its Close it; and the
// Owner's look at closing never starts the window: then it runs from the
// previous close, since the day's cash before the look was in the drawer.
// From the previous close, cash taken out is counted from the day after that
// close's day, so an earlier unclosed day's is counted (re-review, 29 Oct);
// that close's own, made before it, is never counted again.
//
// On a normal day too, the Owner's look at closing never starts the window:
// with no morning check the day starts from the last close, the float left
// in (Jack's 29 Oct answer 7, "Start from last close").
//
// `startPence` is what the window starts from: the check's figure, or, from
// a late close, the count that close banked from (see `windowFor`).
async function drawer(day, start, sales, until = null, { missed = false } = {}) {
  const window = await windowFor(day, start);
  const from = window.at;
  const { cashPence } = await takingsIn(sales, from);
  const paidOuts = missed || start.closingLook
    ? await paidOutsWhere({ sql: 'p.day >= ?::date AND p.created_at > ? AND (?::timestamptz IS NULL OR p.created_at <= ? OR p.day = ?)', args: [window.fromDay, from, until, until, day] })
    : await paidOutsSince(day, start);
  const paidOutsPence = paidOuts.reduce((n, p) => n + p.amountPence, 0);
  const earlierBankedPence = await bankedForEarlier(day, from, until);
  return { startPence: window.pence, cashPence, paidOuts, paidOutsPence, earlierBankedPence, expectedPence: window.pence + cashPence - paidOutsPence - earlierBankedPence };
}
// Where a day's drawer figure starts: its check, unless that is the Owner's
// look at closing. Then the last close, with the float left in; but if that
// close was a late one (made after a later day's count, money review of
// #584, 2), the drawer held that count's cash too, so the window starts at
// that count instead, and the banking since comes off (`bankedForEarlier`),
// as for a day nobody closed. Every time stays the database's own text.
async function windowFor(day, start) {
  if (!start.closingLook) return { pence: start.start.pence, at: start.checkedAt, fromDay: day };
  const prev = await previousClose(day);
  if (!prev) {
    // A shop's first close: from the start of today by the shop's clock,
    // where Close the day starts counting sales (close-the-day design 6).
    const { at } = await prepare('SELECT ((?::date)::timestamp AT TIME ZONE ?)::text AS at').get(day, await currentShopTimeZone());
    return { pence: start.start.pence, at, fromDay: day };
  }
  const next = await prepare(`SELECT f.counted_pence, f.expected_pence, f.checked_at::text AS at, to_char(f.day, 'YYYY-MM-DD') AS day,
      f.checked_at < (SELECT closed_at FROM day_closes WHERE id = ?) AS before_it
    FROM float_checks f WHERE f.day > ?::date AND f.day < ? ORDER BY f.day, f.checked_at LIMIT 1`).get(prev.id, prev.day, day);
  if (next?.before_it) return { pence: next.counted_pence ?? next.expected_pence, at: next.at, fromDay: next.day };
  return { pence: start.start.pence, at: prev.at, fromDay: prev.fromDay };
}
// The last close before `day`: which, its day, when it was made (exactly),
// and the day after its day.
async function previousClose(day) {
  const r = await prepare(`SELECT id, to_char(day, 'YYYY-MM-DD') AS day, closed_at::text AS at, to_char(day + 1, 'YYYY-MM-DD') AS from_day
    FROM day_closes WHERE day < ? ORDER BY closed_at DESC, id DESC LIMIT 1`).get(day);
  return r ? { id: r.id, day: r.day, at: r.at, fromDay: r.from_day } : null;
}
// What a day nobody closed should have held at its count, from its own
// window: kept on the count, so Today's short or over float for it follows
// cash taken out for it later (money review 3, 29 Oct; the close recomputes
// its expected figure the same way).
async function missedDrawer(day, count) {
  const late = await lateDay(day, count);
  const d = await drawer(day, late.start, await openSales(day, count.checkedAt), count.checkedAt, { missed: true });
  return { late, d };
}
const refreshCount = (count, expectedPence) => prepare('UPDATE float_checks SET expected_pence = ? WHERE id = ?')
  .run(Math.min(MAX_PENCE, Math.max(0, expectedPence)), count.id);

// Cash that closes of days before `day` took out of the drawer after
// `from` (and up to `until`): what each banked, less what it said to put in
// to make the float up. Only a day closed late can fall there; a normal
// close is made before the next morning's check.
const TAKEN_OUT = 'c.banked_pence - GREATEST(0, c.float_pence - (c.counted_pence - c.carried_pence))';
async function bankedForEarlier(day, from, until = null) {
  const { n } = await prepare(`SELECT COALESCE(SUM(${TAKEN_OUT}), 0)::int AS n FROM day_closes c
    WHERE c.day < ? AND c.closed_at > ? AND (?::timestamptz IS NULL OR c.closed_at <= ?)`).get(day, from, until, until);
  return n;
}

// The morning counts made for days nobody closed, still waiting for Close it
// (unclosed-day): oldest first, each with who counted it, when and where.
export async function daysWaiting() {
  return prepare(`SELECT f.id, to_char(f.for_day, 'YYYY-MM-DD') AS for_day, to_char(f.day, 'YYYY-MM-DD') AS day, f.counted_pence, f.reason, f.checked_at,
      COALESCE(e.name, l.name) AS by_name, t.code AS till_code
    FROM float_checks f JOIN logins l ON l.id = f.login_id LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN tills t ON t.id = f.till_id
    WHERE f.for_day IS NOT NULL AND NOT EXISTS (SELECT 1 FROM day_closes c WHERE c.day = f.for_day) ORDER BY f.for_day`).all();
}
// The morning count made for a day, closed or not.
async function countFor(day) {
  const r = await prepare(`SELECT f.id, f.counted_pence, f.reason, f.checked_at, f.checked_at::text AS checked_at_exact, to_char(f.day, 'YYYY-MM-DD') AS day, COALESCE(e.name, l.name) AS by_name
    FROM float_checks f JOIN logins l ON l.id = f.login_id LEFT JOIN employees e ON e.id = f.employee_id WHERE f.for_day = ?`).get(day);
  return r ? { id: r.id, checkedAt: r.checked_at_exact, reason: r.reason, by: { pence: r.counted_pence, byName: r.by_name, at: iso(r.checked_at), day: r.day } } : null;
}

/**
 * The morning after a day nobody closed (op-float-check-unclosed; unclosed-day
 * designs 1 and 2): the last day the till opened before `today`, when it
 * isn't closed and the shop closed a day before it, with what its drawer
 * started with and its cash since. Null on a normal morning.
 */
export async function unclosedBefore(today) {
  const prev = await prepare(`SELECT to_char(max(day), 'YYYY-MM-DD') AS day FROM float_checks WHERE day < ?`).get(today);
  if (!prev?.day) return null;
  const { open, before } = await prepare('SELECT EXISTS (SELECT 1 FROM day_closes WHERE day = ?) AS open, EXISTS (SELECT 1 FROM day_closes WHERE day < ?) AS before').get(prev.day, prev.day);
  if (open || !before) return null;
  const start = await floatStartOn(prev.day);
  const d = await drawer(prev.day, start, await openSales(prev.day), null, { missed: true });
  return { day: prev.day, startPence: d.startPence, cashPence: d.expectedPence - d.startPence, expectedPence: d.expectedPence };
}

// A day closed late: the morning count that counted it, the cash banked for
// still-earlier days since that count (it was in the count), and the
// figures of its drawer up to the count.
async function lateDay(day, count) {
  const start = await floatStartOn(day);
  const carriedPence = await bankedForEarlier(day, count.checkedAt);
  return { start, carriedPence, base: count.by.pence - carriedPence };
}

// The saved close for a day, as the end-of-day report shows it (Reports reads it too).
// `reopened: true` is for Reports, which still shows a reopened day's first close as it was saved (Jack, 12 Nov:
// its row keeps its figures and its report can be opened), with `reopened` saying who reopened it and why.
export async function closeOn(day, { reopened = false } = {}) {
  const r = await prepare(`SELECT c.*, to_char(c.day, 'YYYY-MM-DD') AS day_text, l.name AS closed_by_name, rl.name AS reopened_by_name
    FROM day_closes c JOIN logins l ON l.id = c.login_id LEFT JOIN logins rl ON rl.id = c.reopened_by
    WHERE c.day = ?${reopened ? '' : ' AND c.reopened_at IS NULL'}`).get(day);
  if (!r) return null;
  const start = await floatStartOn(day);
  const count = await countFor(day);
  return {
    id: r.id, day: r.day_text, closedByName: r.closed_by_name, closedAt: iso(r.closed_at),
    floatStart: { ...start.start, pence: r.float_start_pence },
    cashPence: r.cash_pence, drawerCashPence: r.drawer_cash_pence, paidOutsPence: r.paid_outs_pence, expectedPence: r.expected_pence,
    // What the expected figure took off for cash banked for an earlier day (unclosed-day design 6).
    earlierBankedPence: r.float_start_pence + r.drawer_cash_pence - r.paid_outs_pence - r.expected_pence,
    countedPence: r.counted_pence, differencePence: r.counted_pence - r.expected_pence, reason: r.reason,
    floatPence: r.float_pence, bankedPence: r.banked_pence, carriedPence: r.carried_pence, ...leftAndTopUp(r.counted_pence - r.carried_pence, r.float_pence),
    takingsPence: r.takings_pence, cardPence: r.card_pence, otherPence: r.other_pence, c2wPence: r.c2w_pence, onlinePence: r.online_pence,
    // A day closed late: the morning count that counted it (op-close-yesterday).
    countedBy: count?.by ?? null,
    // Only Reports asks (the shape Close the day returns is unchanged).
    ...(reopened ? { reopened: r.reopened_at ? { reason: r.reopen_reason, byName: r.reopened_by_name, at: iso(r.reopened_at) } : null } : {}),
  };
}

// Leave the float, bank the rest (decision 4). A count under the float banks
// nothing, and the difference is put in to make the float up (Jack's answer
// 5, 27 Oct), so the drawer is left with the float either way. A day closed
// late banks from its count less what was carried (unclosed-day design 5).
const bankedFrom = (counted, float) => Math.max(0, counted - float);
function leftAndTopUp(counted, float) {
  const topUpPence = Math.max(0, float - counted);
  return { leftPence: counted - bankedFrom(counted, float) + topUpPence, topUpPence };
}
// A real calendar date, "2026-08-31".
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const NOT_WAITING = { error: 'That day isn’t waiting to be closed', code: 'not_waiting' };
const earlierOpen = (d) => ({ error: 'Close the earlier day first', code: 'earlier_day_open', day: d });

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

// "Close it" (op-close-yesterday; unclosed-day designs 4 to 9): an earlier
// day nobody closed, closed from the morning count made for it. Under the
// shop's lock: refused if it is closed, has no count waiting, or an older
// day still waits; then saved, every sale no close has counted made up to
// the count marked as its own, and its figures worked out from exactly
// those. The reply goes after COMMIT.
async function closeLate(res, ctx, shopId, day, today) {
  const reply = await lockedOnShop(shopId, async () => {
    if (await prepare('SELECT 1 FROM day_closes WHERE day = ? AND reopened_at IS NULL').get(day)) return { status: 409, body: { error: 'That day is already closed', code: 'already_closed' } };
    const count = day < today ? await countFor(day) : null;
    if (!count) return { status: 404, body: NOT_WAITING };
    const older = (await daysWaiting()).find((w) => w.for_day < day);
    if (older) return { status: 409, body: earlierOpen(older.for_day) };
    const reopenedBefore = await reopenedOn();
    if (reopenedBefore && reopenedBefore.day < day) return { status: 409, body: earlierOpen(reopenedBefore.day) };
    const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    if (floatPence === null) return { status: 409, body: { error: 'The shop has no float set', code: 'no_float' } };
    const late = await lateDay(day, count);
    const open = await openSales(day, count.checkedAt);
    const counted = count.by.pence;
    const made = await prepare(
      `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
         reason, float_pence, banked_pence, takings_pence, card_pence, other_pence, carried_pence)
       VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, 0, 0, 0, ?) ON CONFLICT (shop_id, day) DO NOTHING RETURNING id`
    ).get(day, ctx.login.id, late.start.id, late.start.start.pence, counted, count.reason, floatPence, Math.min(counted, bankedFrom(late.base, floatPence)), late.carriedPence);
    if (!made) return { status: 409, body: { error: 'That day is already closed', code: 'already_closed' } };
    await prepare(`UPDATE sales s SET day_close_id = ? WHERE ${open.old.sql}`).run(made.id, ...open.old.args);
    await prepare(`UPDATE till_sales t SET day_close_id = ? WHERE ${open.till.sql}`).run(made.id, ...open.till.args);
    const counts = closedBy(made.id);
    const t = await takingsIn(counts);
    const d = await drawer(day, late.start, counts, count.checkedAt, { missed: true });
    await prepare(
      `UPDATE day_closes SET float_start_pence = ?, cash_pence = ?, drawer_cash_pence = ?, paid_outs_pence = ?, expected_pence = ?,
         takings_pence = ?, card_pence = ?, other_pence = ?, c2w_pence = ?, online_pence = ? WHERE id = ?`
    ).run(d.startPence, t.cashPence, d.cashPence, d.paidOutsPence, d.expectedPence, t.takingsPence, t.cardPence, t.otherPence, t.c2wPence, t.onlinePence, made.id);
    await refreshCount(count, d.expectedPence);
    return { ok: true };
  });
  if (!reply.ok) {
    if (reply.body.code === 'already_closed') reply.body.close = await closeOn(day);
    return sendJson(res, reply.status, reply.body);
  }
  const made = await closeOn(day);
  await afterClose(made.id); // a day that can't be sent is still closed, and says so
  sendJson(res, 201, { close: made });
}

// A reopened day (reports-accounts-and-reopen design 1): the close is still the one row for its day, marked
// reopened with who, when and why. It counts as not closed for its own report, Today, paid-outs and closing it
// again; for every other day's carry-over (the previous close, cash banked since a morning's check, whether
// a morning needs a count) it stays the close it was, with its figures, until it is closed again, so a night
// spent reopened changes nothing about the next morning (money review of the reopen change). At most
// one is reopened at a time, the latest closed day.
export async function reopenedOn(day = null) {
  const r = await prepare(`SELECT c.id, to_char(c.day, 'YYYY-MM-DD') AS day, c.reopened_at, c.closed_at::text AS closed_exact, c.reopen_reason, l.name AS by_name
    FROM day_closes c JOIN logins l ON l.id = c.reopened_by WHERE c.reopened_at IS NOT NULL${day ? ' AND c.day = ?' : ''} ORDER BY c.day LIMIT 1`).get(...(day ? [day] : []));
  return r ? { id: r.id, day: r.day, reason: r.reopen_reason, reopenedByName: r.by_name, reopenedAt: iso(r.reopened_at), closedExact: r.closed_exact } : null;
}

// Whether a close can be reopened now (the rules `reopenClose` refuses on): it is the latest close, was made the
// ordinary way, isn't reopened already, and no later day waits to be closed.
export async function canReopen(id) {
  const row = await prepare("SELECT reopened_at, to_char(day, 'YYYY-MM-DD') AS day FROM day_closes WHERE id = ?").get(id);
  if (!row || row.reopened_at) return false;
  if (await prepare('SELECT 1 FROM day_closes WHERE day > ?::date').get(row.day)) return false;
  if (await countFor(row.day)) return false;
  return !(await daysWaiting()).some((w) => w.for_day > row.day);
}

const REASON_WORDS = 'Say why you are reopening it (up to 500 characters)';

// Reopen the latest closed day (rp-reopen; Jack's answers 1 and 4 of 12 Nov). Under the shop's lock: refused if
// it isn't there, is already reopened, isn't the latest close (later days' cash starts from what it banked and
// left), or was closed late from a morning count; then the first close's figures are copied to
// day_close_history and the close is marked reopened. Its sales stay marked with it, so what it counted is
// exactly what it counted, and nothing else counts them. Returns { status, body }.
export async function reopenClose(shopId, ctx, id, rawReason) {
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (!reason || reason.length > 500) return { status: 400, body: { error: REASON_WORDS } };
  const reply = await lockedOnShop(shopId, async () => {
    const row = await prepare("SELECT c.*, to_char(c.day, 'YYYY-MM-DD') AS day_text FROM day_closes c WHERE c.id = ?").get(id);
    if (!row) return { status: 404, body: { error: 'That day isn’t closed', code: 'not_closed' } };
    if (row.reopened_at) return { status: 409, body: { error: 'That day is already reopened', code: 'already_reopened' } };
    if (await prepare('SELECT 1 FROM day_closes WHERE day > ?::date').get(row.day_text)) {
      return { status: 409, body: { error: 'Only the latest closed day can be reopened', code: 'not_latest' } };
    }
    if (await countFor(row.day_text)) return { status: 409, body: { error: 'A day closed late can’t be reopened', code: 'closed_late' } };
    // A later day still waiting for Close it would be closed after it, and it could then never be closed again.
    if ((await daysWaiting()).some((w) => w.for_day > row.day_text)) return { status: 409, body: { error: 'Close the later day first', code: 'later_day_waiting' } };
    await prepare(
      `INSERT INTO day_close_history (day_close_id, day, closed_by, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence,
         paid_outs_pence, expected_pence, counted_pence, reason, float_pence, banked_pence, carried_pence, takings_pence, card_pence, other_pence,
         c2w_pence, online_pence, reopened_by, reopened_at, reopen_reason)
       SELECT id, day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence,
         counted_pence, reason, float_pence, banked_pence, carried_pence, takings_pence, card_pence, other_pence, c2w_pence, online_pence, ?, now(), ?
       FROM day_closes WHERE id = ?`
    ).run(ctx.login.id, reason, id);
    await prepare('UPDATE day_closes SET reopened_at = now(), reopened_by = ?, reopen_reason = ? WHERE id = ?').run(ctx.login.id, reason, id);
    return { ok: true, status: 200, day: row.day_text };
  });
  if (!reply.ok) return reply;
  return { status: 200, body: { reopened: await reopenedOn(reply.day) } };
}

// A reopened day closed again (design decision 1): the same row, worked out from the sales it already counted
// (they stay marked with it; a sale saved after the first close is left for the next close, Jack's answer 1)
// with the new count and banking, the reopening cleared and the first close kept in the history.
async function closeAgain(res, ctx, shopId, day, { counted, reason, shown }) {
  const reply = await lockedOnShop(shopId, async () => {
    const row = await prepare('SELECT id, closed_at::text AS closed_exact FROM day_closes WHERE day = ? AND reopened_at IS NOT NULL').get(day);
    if (!row) return { status: 409, body: { error: 'That day isn’t reopened', code: 'not_reopened' } };
    if (await prepare('SELECT 1 FROM day_closes WHERE day > ?::date').get(day)) return { status: 409, body: { error: 'Only the latest closed day can be closed again', code: 'not_latest' } };
    const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    if (floatPence === null) return { status: 409, body: { error: 'The shop has no float set', code: 'no_float' } };
    const start = await floatStartOn(day);
    if (!start) return { status: 409, body: { error: 'Check the float before closing the day', code: 'float_not_checked' } };
    if (!isPence(counted)) return { status: 400, body: { error: 'The count must be pounds and pence' } };
    const counts = closedBy(row.id);
    const t = await takingsIn(counts);
    // Cash taken out up to the close's own time, and the day's own after it: a later day's is not this day's.
    const d = await drawer(day, start, counts, row.closed_exact);
    if (shown !== undefined && shown !== d.expectedPence) {
      return { status: 409, body: { error: 'The till’s figures changed while you were counting. Check the difference again.', code: 'expected_changed', expectedPence: d.expectedPence } };
    }
    // closed_at stays the first close's time: the next days' carry-over is ordered by it, and a close made
    // after a later morning's float check would be taken for cash banked since that check.
    await prepare(
      `UPDATE day_closes SET login_id = ?, float_check_id = ?, float_start_pence = ?, cash_pence = ?, drawer_cash_pence = ?,
         paid_outs_pence = ?, expected_pence = ?, counted_pence = ?, reason = ?, float_pence = ?, banked_pence = ?,
         takings_pence = ?, card_pence = ?, other_pence = ?, c2w_pence = ?, online_pence = ?, reopened_at = NULL, reopened_by = NULL, reopen_reason = NULL
       WHERE id = ?`
    ).run(ctx.login.id, start.id, d.startPence, t.cashPence, d.cashPence, d.paidOutsPence, d.expectedPence, counted, reason, floatPence, bankedFrom(counted, floatPence),
      t.takingsPence, t.cardPence, t.otherPence, t.c2wPence, t.onlinePence, row.id);
    return { ok: true };
  });
  if (!reply.ok) return sendJson(res, reply.status, reply.body);
  const made = await closeOn(day);
  await afterClose(made.id, { replace: true }); // a reopened day's earlier summary is replaced, once
  sendJson(res, 201, { close: made });
}

export function register(route) {
  route('GET', '/api/close-the-day', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const { day, entry } = await closeEntryNow();
    // Count first (Settings › End of day): off shows what the till expects while counting.
    const { float_pence: floatPence, count_first: countFirst } = await prepare('SELECT float_pence, count_first FROM shops WHERE id = ?').get(shopId);
    // An earlier day nobody closed, by "Close it" (op-close-yesterday).
    const asked = query.get('day');
    if (asked !== null && asked !== day) {
      if (!isDay(asked)) return badRequest(res, 'The day must be a date');
      const count = asked < day ? await countFor(asked) : null;
      const close = count ? await closeOn(asked) : null;
      // A reopened day with no later morning count: counted again by the Owner, from the sales it already counted.
      const reopened = asked < day ? await reopenedOn(asked) : null;
      if (reopened) {
        const start = await floatStartOn(asked);
        if (!start) return sendJson(res, 409, { error: 'Check the float before closing the day', code: 'float_not_checked' });
        const d = await drawer(asked, start, closedBy(reopened.id), reopened.closedExact);
        return sendJson(res, 200, {
          day: asked, floatPence, floatStart: { ...start.start, pence: d.startPence }, cashPence: d.cashPence, paidOutsPence: d.paidOutsPence,
          expectedPence: d.expectedPence, earlierBankedPence: d.earlierBankedPence, paidOuts: d.paidOuts, countFirst, reopened, close: null,
        });
      }
      if (!count) return sendJson(res, 404, NOT_WAITING);
      if (close) return sendJson(res, 200, { day: asked, floatPence, countedBy: count.by, close });
      const { late, d } = await missedDrawer(asked, count);
      const banked = floatPence === null ? 0 : Math.min(count.by.pence, bankedFrom(late.base, floatPence));
      return sendJson(res, 200, {
        day: asked, floatPence, floatStart: { ...late.start.start, pence: d.startPence }, cashPence: d.cashPence, paidOutsPence: d.paidOutsPence,
        expectedPence: d.expectedPence, earlierBankedPence: d.earlierBankedPence, paidOuts: d.paidOuts, countedBy: count.by,
        carriedPence: late.carriedPence, bankPence: banked, topUpPence: floatPence === null ? 0 : Math.max(0, floatPence - late.base), close: null,
      });
    }
    const start = await floatStartOn(day);
    // A reopened today works from the sales its own close already counted, which stay marked with it.
    const reopenedToday = await reopenedOn(day);
    const d = start ? await drawer(day, start, reopenedToday ? closedBy(reopenedToday.id) : await openSales(day), reopenedToday?.closedExact ?? null) : { cashPence: 0, paidOuts: await paidOutsSince(day, null), expectedPence: null, earlierBankedPence: 0 };
    const [waiting] = await daysWaiting();
    sendJson(res, 200, {
      day, floatPence, floatStart: start ? { ...start.start, pence: d.startPence } : null, cashPence: d.cashPence,
      paidOutsPence: d.paidOuts.reduce((n, p) => n + p.amountPence, 0), expectedPence: d.expectedPence, earlierBankedPence: d.earlierBankedPence,
      paidOuts: d.paidOuts, entry, countFirst, close: await closeOn(day), reopened: await reopenedOn(),
      // A day nobody closed with a count waiting, shown first (unclosed-day design 7).
      earlierDay: waiting?.for_day ?? null,
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
    const { day: today } = await closeEntryNow();
    // Cash taken out for an earlier day nobody closed, at its Close it
    // ("Cash taken out on Wednesday"; unclosed-day design 8).
    if (body.day !== undefined && !isDay(body.day)) return badRequest(res, 'The day must be a date');
    const day = body.day ?? today;
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ? AND reopened_at IS NULL').get(day)) return { status: 409, body: { error: day === today ? 'Today is already closed' : 'That day is already closed', code: 'day_closed' } };
      const count = day < today ? await countFor(day) : null;
      if (day !== today && !count) return { status: 404, body: NOT_WAITING };
      const { id } = await prepare('INSERT INTO paid_outs (day, login_id, amount_pence, reason, note) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .get(day, ctx.login.id, body.amountPence, body.reason.trim(), note);
      // The morning count's expected figure follows (money review 3).
      if (count) await refreshCount(count, (await missedDrawer(day, count)).d.expectedPence);
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
    if (body.day !== undefined && !isDay(body.day)) return badRequest(res, 'The day must be a date');
    const { day: todayNow } = await closeEntryNow();
    // A reopened day is closed again (the same close, from a new count), today's or an earlier one's.
    const again = await reopenedOn(body.day ?? todayNow);
    if (again && body.day !== undefined && body.day !== todayNow) {
      if (body.reason !== undefined && typeof body.reason !== 'string') return badRequest(res, 'The reason must be text');
      const pastReason = (body.reason ?? '').trim();
      if (pastReason.length > 500) return badRequest(res, 'The reason can be up to 500 characters');
      if (body.expectedPence !== undefined && !Number.isSafeInteger(body.expectedPence)) return badRequest(res, 'The expected figure must be whole pence');
      return closeAgain(res, ctx, shopId, body.day, { counted: body.countedPence, reason: pastReason, shown: body.expectedPence });
    }
    if (body.day !== undefined && body.day !== todayNow) return closeLate(res, ctx, shopId, body.day, todayNow);
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
    if (again) return closeAgain(res, ctx, shopId, day, { counted, reason, shown });
    const reply = await lockedOnShop(shopId, async () => {
      if (await prepare('SELECT 1 FROM day_closes WHERE day = ? AND reopened_at IS NULL').get(day)) return { status: 409, body: { error: 'Today is already closed', code: 'already_closed' } };
      // An earlier day that was reopened is closed again first, so it stays the latest close (the reopen rule).
      const earlierReopened = await reopenedOn();
      if (earlierReopened && earlierReopened.day < day) return { status: 409, body: earlierOpen(earlierReopened.day) };
      // A day nobody closed is closed first, so its sales aren't swept into today's (unclosed-day design 7).
      const [waiting] = await daysWaiting();
      if (waiting) return { status: 409, body: earlierOpen(waiting.for_day) };
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
        `UPDATE day_closes SET float_start_pence = ?, cash_pence = ?, drawer_cash_pence = ?, paid_outs_pence = ?, expected_pence = ?,
           takings_pence = ?, card_pence = ?, other_pence = ?, c2w_pence = ?, online_pence = ? WHERE id = ?`
      ).run(d.startPence, t.cashPence, d.cashPence, d.paidOutsPence, d.expectedPence, t.takingsPence, t.cardPence, t.otherPence, t.c2wPence, t.onlinePence, made.id);
      return { ok: true };
    });
    if (!reply.ok) {
      if (reply.body.code === 'already_closed') reply.body.close = await closeOn(day);
      return sendJson(res, reply.status, reply.body);
    }
    const made = await closeOn(day);
    await afterClose(made.id);
    sendJson(res, 201, { close: made });
  });
}
