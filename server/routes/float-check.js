// Opening the shop with a float check (openspec/changes/opening-float-check;
// op-float-check, op-float-short, op-today-short; opening the shop decisions
// 2, 4 and 8). The first person to open the till each day who takes payments
// checks the drawer holds the shop's float: a look, or a count. One check a
// shop a day, the shop's own date; amounts in whole pence. Staff routes:
// they run with the shop's row-level security already bound.
import { prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { currentSession } from '../lib/session.js';
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { closeEntryNow } from '../lib/close-entry.js';
import { currentCheckin } from './till-pins.js';

export const MAX_PENCE = 10_000_000; // £100,000, as migration 095
export const isPence = (v) => Number.isSafeInteger(v) && v >= 0 && v <= MAX_PENCE;

// Who checked: the person checked in at the till (pins-and-checkin), or the
// sign-in's own name for a look at closing.
const BY_NAME = 'COALESCE(e.name, l.name)';
// Where: the till it was checked at, if a set-up one (till-setup).
const CHECK_SELECT = `SELECT f.*, ${BY_NAME} AS checked_by_name, t.code AS till_code FROM float_checks f JOIN logins l ON l.id = f.login_id
  LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN tills t ON t.id = f.till_id`;

function serializeCheck(row) {
  return {
    id: row.id,
    how: row.counted_pence === null ? 'looked' : 'counted',
    expectedPence: row.expected_pence,
    countedPence: row.counted_pence,
    reason: row.reason,
    checkedByName: row.checked_by_name,
    checkedAt: new Date(row.checked_at).toISOString(),
    tillCode: row.till_code ?? null,
  };
}

const today = async () => shopToday(await currentShopTimeZone());
const checkOn = async (day) => {
  const row = await prepare(`${CHECK_SELECT} WHERE f.day = ?`).get(day);
  return row ? serializeCheck(row) : null;
};

// "A role that takes payments" (UX walk-through 2 M1) until roles (WP-1.1):
// the Owner, or a team member marked as a cashier.
async function takesPayments(login) {
  if (login.is_owner) return true;
  if (!login.employee_id) return false;
  const row = await prepare('SELECT is_cashier FROM employees WHERE id = ?').get(login.employee_id);
  return !!row?.is_cashier;
}
// The same for the person checked in: a cashier, or the Owner's own team member.
async function checkedInTakesPayments(checkin) {
  if (checkin.is_cashier) return true;
  return Boolean(await prepare('SELECT 1 FROM logins WHERE employee_id = ? AND is_owner = true').get(checkin.employee_id));
}

// A float counted short and not yet Seen, for Today's Needs attention
// (op-today-short): it stays until the Owner's one click clears it, whatever
// day it was counted (decision 8 H3; review, 27 Oct), oldest first, with its
// day so an earlier one can say which. An over float goes there too, but
// only when yesterday was closed (decision 8 H1; otherwise "wasn't closed"
// explains it): "yesterday" is the last day before it that the till opened,
// so a shop shut on Sundays looks back to Saturday, and a first day has none
// (openspec/changes/close-the-day, design 6).
const SHORT = 'f.counted_pence < f.expected_pence';
const OVER_AFTER_CLOSED = `f.counted_pence > f.expected_pence AND EXISTS (SELECT 1 FROM day_closes c
  WHERE c.day = (SELECT max(p.day) FROM float_checks p WHERE p.day < f.day))`;
const WAITING_TO_BE_SEEN = `f.seen_at IS NULL AND (${SHORT} OR (${OVER_AFTER_CLOSED}))`;

export async function floatsToSee() {
  const rows = await prepare(`SELECT f.*, to_char(f.day, 'YYYY-MM-DD') AS day_text, ${BY_NAME} AS checked_by_name, t.code AS till_code
    FROM float_checks f JOIN logins l ON l.id = f.login_id LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN tills t ON t.id = f.till_id
    WHERE ${WAITING_TO_BE_SEEN} ORDER BY f.day, f.id`).all();
  return rows.map((r) => {
    const short = r.counted_pence < r.expected_pence;
    return {
      kind: short ? 'float_short' : 'float_over', checkId: r.id, day: r.day_text,
      ...(short ? { shortPence: r.expected_pence - r.counted_pence } : { overPence: r.counted_pence - r.expected_pence }),
      tillCode: r.till_code ?? null, countedByName: r.checked_by_name, checkedAt: new Date(r.checked_at).toISOString(), reason: r.reason,
    };
  });
}

// The Owner closing a day whose float nobody checked: a look only, on any
// day, the first included (Jack's answer 8, 27 Oct; close-the-day).
// Only while "Close the day" is showing (second review, 27 Oct), so the
// first day's count can't be skipped at any other time.
const lookAtClose = async (login, body) => body.atClose === true && login.is_owner === true && (await closeEntryNow()).entry.show;

export function register(route) {
  route('GET', '/api/float-check', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const day = await today();
    const { float_pence: floatPence } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    const any = await prepare('SELECT 1 FROM float_checks LIMIT 1').get();
    // At the till, the person checked in is asked (Jack's answer 3, 27 Oct: the check moves to the check-in).
    const checkin = await currentCheckin(req);
    const takes = checkin ? await checkedInTakesPayments(checkin) : await takesPayments(ctx.login);
    sendJson(res, 200, { day, floatPence, takesPayments: takes, firstDay: !any, check: await checkOn(day) });
  });

  // Looks right (countedPence null) or a count, with an optional reason.
  // One statement keeps one a day: a second, even at the same moment, is
  // told the float was already checked and given the first.
  route('POST', '/api/float-check', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Send the float check');
    // The morning check is made by whoever checked in with their PIN; only
    // the Owner's look at closing needs no check-in (pins-and-checkin design 5).
    const checkin = await currentCheckin(req);
    const closing = await lookAtClose(ctx.login, body);
    if (!checkin && !closing) return sendJson(res, 409, { error: 'Check in at the till with your PIN first', code: 'check_in_first' });
    if (!(checkin ? await checkedInTakesPayments(checkin) : await takesPayments(ctx.login))) return sendJson(res, 403, { error: 'Only someone who takes payments checks the float', code: 'not_taking_payments' });
    const counted = body.countedPence;
    if (counted !== null && !isPence(counted)) return badRequest(res, 'The count must be pounds and pence');
    if (body.reason !== undefined && typeof body.reason !== 'string') return badRequest(res, 'The reason must be text');
    const reason = (body.reason ?? '').trim();
    if (reason.length > 500) return badRequest(res, 'The reason can be up to 500 characters');
    const { float_pence: expected } = await prepare('SELECT float_pence FROM shops WHERE id = ?').get(shopId);
    if (expected === null) return sendJson(res, 409, { error: 'The shop has no float set', code: 'no_float' });
    // The first day on Wheelhouse is counted, never looked at (UX walk-through 4 M4),
    // except when the Owner closes a day nobody checked: then it's only looked
    // at (Jack's answer 8, 27 Oct; openspec/changes/close-the-day).
    if (counted === null && !closing && !(await prepare('SELECT 1 FROM float_checks LIMIT 1').get())) {
      return sendJson(res, 400, { error: 'Count the float on the first day', code: 'count_needed' });
    }
    const day = await today();
    const made = await prepare(
      `INSERT INTO float_checks (day, login_id, employee_id, expected_pence, counted_pence, reason, till_id) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (shop_id, day) DO NOTHING RETURNING id`
    ).get(day, ctx.login.id, checkin?.employee_id ?? null, expected, counted, reason, checkin?.till_id ?? null);
    if (!made) return sendJson(res, 409, { error: 'The float was already checked today', code: 'already_checked', check: await checkOn(day) });
    sendJson(res, 201, { check: await checkOn(day) });
  });

  // Seen on a short float (op-today-seen; H3), or an over one Today lists:
  // one click, who and when.
  // Owner only, as Needs attention, until roles; the check and the record in
  // one statement.
  route('POST', '/api/float-check/:id/seen', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner can mark a short float seen", code: 'owner_only' });
    const id = Number(params.id);
    if (!Number.isInteger(id)) return sendJson(res, 404, { error: 'Float check not found' });
    const marked = await prepare(
      `UPDATE float_checks f SET seen_at = now(), seen_by_login_id = ?
        WHERE f.id = ? AND ${WAITING_TO_BE_SEEN} RETURNING f.id`
    ).get(ctx.login.id, id);
    if (!marked) return sendJson(res, 409, { error: 'That float isn’t waiting to be seen.', code: 'not_short' });
    sendJson(res, 200, { ok: true });
  });
}
