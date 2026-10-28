// Today's Needs attention (openspec/changes/today-page; op-today; Jack, 30 Sep,
// opening the shop decisions 3 and 4): one list of what's waiting on the
// shop, for the Owner. Each item has a `kind` and what its line shows; later
// packages add kinds here (a short float, stock below zero, online orders…),
// so Today grows a line per kind and nothing else changes.
import { prepare } from '../db.js';
import { currentSession } from '../lib/session.js';
import { sendJson } from '../lib/http.js';
import { WORKSHOP_JOB_SELECT } from '../workshop/jobs.js';
import { customerConversations } from '../workshop/job-notes.js';
import { floatsToSee } from './float-check.js';
import { loadCapacity, currentShopTimeZone } from '../workshop/jobs.js';
import { shopToday } from '../clock.js';
import { toHHMM } from '../capacity.js';
import { TILL_ORDER } from '../till/this-till.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);

// Quotes sent and reminded with no answer: the job page's own rule (the
// reminder time is only there while the current quote is sent and
// unanswered, server/workshop/jobs.js), on a booking that hasn't ended
// (fresh review: a cancelled job's line could never be cleared). Waiting
// longest first; the customer's phone in the same query.
async function quotesWithNoAnswer() {
  const rows = await prepare(`SELECT j.*, cp.phone FROM (${WORKSHOP_JOB_SELECT}
    WHERE qr.at IS NOT NULL AND w.booking_state NOT IN ('cancelled', 'declined', 'expired')) j
    LEFT JOIN customers cp ON cp.id = j.customer_id
    ORDER BY j.quote_reminder_sent_at, j.id`).all();
  return rows.map((r) => ({
    kind: 'quote_no_answer', jobId: r.id, reference: r.reference, customerName: r.customer_name ?? null,
    phone: r.phone || null, sentAt: iso(r.quote_sent_at), reminderSentAt: iso(r.quote_reminder_sent_at),
  }));
}

// Customers' messages waiting for a reply: one line, how many and the oldest
// (ac-today), as Front desk › Messages counts them: one per customer from 26
// Oct (day answers 8.2; ask-the-shop-server design 4).
async function replies() {
  const { items, count } = await customerConversations('needs-reply');
  if (!count) return [];
  const oldest = items.reduce((a, b) => (a.lastAt <= b.lastAt ? a : b));
  return [{ kind: 'replies', count, oldestName: oldest.customerName, oldestAt: oldest.lastAt }];
}

// Bikes ready and still in the shop for longer than the shop's Today days,
// not contacted since they were marked ready (WP-4.3, cp-today-uncollected;
// collect and pay review item 4, H4, M5). Waiting longest first; each with
// when its Bike still waiting went, if it has.
const UNCOLLECTED = `w.custody_state = 'in_shop' AND w.work_state = 'complete' AND w.signed_off_at IS NOT NULL
        AND w.signed_off_at <= now() - make_interval(days => COALESCE((SELECT collection_today_days FROM workshop_settings LIMIT 1), 7))
        AND (w.uncollected_contacted_at IS NULL OR w.uncollected_contacted_at < w.signed_off_at)`;
async function uncollectedBikes() {
  const rows = await prepare(
    `SELECT w.id, w.reference, w.signed_off_at, c.name AS customer_name, c.phone,
            NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') AS bike_label,
            (SELECT max(m.sent_at) FROM customer_messages m
              WHERE m.job_id = w.id AND m.template_key = 'bike_still_waiting' AND m.sent_at >= w.signed_off_at) AS reminder_sent_at
       FROM workshop_jobs w
       LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
      WHERE ${UNCOLLECTED}
      ORDER BY w.signed_off_at, w.id`
  ).all();
  return rows.map((r) => ({
    kind: 'uncollected', jobId: r.id, reference: r.reference, customerName: r.customer_name ?? null, bikeLabel: r.bike_label ?? null,
    phone: r.phone || null, readySince: iso(r.signed_off_at), reminderSentAt: iso(r.reminder_sent_at),
  }));
}

// Who's in (op-today, op-today-late; opening the shop decisions 5 and 6;
// whos-in-and-first-pin): everyone who checked in by PIN today, ended or not
// (no check-out), by their first check-in; then each mechanic with free time
// today in the diary's capacity who hasn't, due from its start. On every
// till: Who's in is who is at work (till-setup design 3). No PIN, hash or token.
const ROLE = `CASE WHEN EXISTS (SELECT 1 FROM logins o WHERE o.employee_id = e.id AND o.is_owner) THEN 'Owner'
  WHEN e.is_mechanic = 1 THEN 'Mechanic' ELSE 'Staff' END`;
async function whosIn() {
  const day = shopToday(await currentShopTimeZone());
  const inToday = await prepare(
    `SELECT e.id, e.name, ${ROLE} AS role, min(c.checked_in_at) AS at FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
      WHERE c.day = ? AND e.active = 1 GROUP BY e.id ORDER BY at, e.id`
  ).all(day);
  const here = new Set(inToday.map((p) => p.id));
  const working = (await loadCapacity(day, day)).days[0].mechanics.filter((m) => m.working && !here.has(m.mechanicId));
  const names = new Map((await prepare('SELECT id, name FROM employees WHERE is_mechanic = 1 AND active = 1').all()).map((e) => [e.id, e.name]));
  const due = working.map((m) => ({ id: m.mechanicId, name: names.get(m.mechanicId), role: 'Mechanic', dueAt: toHHMM(m.availableWindows[0][0]) }))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.name.localeCompare(b.name));
  return [...inToday.map((p) => ({ id: p.id, name: p.name, role: p.role, checkedInAt: iso(p.at) })), ...due];
}

// Tills (op-today, op-today-short, op-today-seen; openspec/changes/till-setup):
// a line per till, in number order: every active one, and one switched off
// that was used today (review, 28 Oct); and one with no number for a browser
// that isn't a set-up till, when no till is set up or one was used today
// (design 2). Each line: who opened it with its own earliest check-in today;
// and the day's float check, one a shop, on the line it was checked at
// (design 4). A deleted till's check-ins have no till, so they join that line.
async function tillsToday() {
  const day = shopToday(await currentShopTimeZone());
  const firsts = await prepare(
    `SELECT DISTINCT ON (c.till_id) c.till_id, c.checked_in_at AS at, e.name FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
      WHERE c.day = ? ORDER BY c.till_id, c.checked_in_at, c.id`
  ).all(day);
  const f = await prepare(
    `SELECT f.till_id, f.employee_id, f.checked_at, f.counted_pence < f.expected_pence AS short, COALESCE(e.name, l.name) AS by_name, s.name AS seen_by
       FROM float_checks f JOIN logins l ON l.id = f.login_id LEFT JOIN employees e ON e.id = f.employee_id
       LEFT JOIN logins s ON s.id = f.seen_by_login_id WHERE f.day = ?`
  ).get(day);
  // The Owner's look at closing (no person checked in, no till) adds no line
  // of its own (second review, 28 Oct); a check made at a till does.
  const used = [...firsts.map((c) => c.till_id), ...(f && f.employee_id !== null ? [f.till_id] : [])];
  const usedTills = used.filter((id) => id !== null);
  const lines = await prepare(`SELECT id, code FROM tills WHERE active = true OR id = ANY(?::int[]) ORDER BY ${TILL_ORDER}`).all(usedTills);
  if (!lines.length || used.includes(null)) lines.push({ id: null, code: null });
  return lines.map(({ id, code }) => {
    const opened = firsts.find((c) => c.till_id === id);
    const float = f && f.till_id === id ? f : null;
    return {
      code, openedAt: iso(opened?.at), openedBy: opened?.name ?? null,
      floatCheck: float ? { byName: float.by_name, at: iso(float.checked_at), short: Boolean(float.short), seenByName: float.seen_by ?? null } : null,
    };
  });
}

export function register(route) {
  // Anyone who can open Today (decision 4: Staff see Who's in).
  // screens: op-today, op-today-staff, op-today-late
  route('GET', '/api/today/whos-in', async (req, res) => {
    if (!(await currentSession(req))) return sendJson(res, 401, { error: 'Not signed in' });
    sendJson(res, 200, { people: await whosIn() });
  });

  // The Owner only, as Needs attention, until roles (decision 4).
  // screens: op-today, op-today-short, op-today-seen
  route('GET', '/api/today/tills', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner sees the tills", code: 'owner_only' });
    sendJson(res, 200, { tills: await tillsToday() });
  });

  // Owner only until roles (decision 4: Tills and Needs attention are for
  // owners, managers and anyone who can close the day; WP-1.1 opens it to them).
  route('GET', '/api/needs-attention', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner sees what needs attention", code: 'owner_only' });
    sendJson(res, 200, { items: [...(await floatsToSee()), ...(await quotesWithNoAnswer()), ...(await uncollectedBikes()), ...(await replies())] });
  });

  // Contacted on an uncollected bike's line (cp-today-uncollected; H4): who and
  // when, which takes it off Today until it's marked ready again. Owner only,
  // as the list; refused for a bike that isn't on it.
  // screens: collection
  route('POST', '/api/workshop-jobs/:id/contacted', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner can record that a customer was contacted", code: 'owner_only' });
    const id = Number(params.id);
    if (!Number.isInteger(id)) return sendJson(res, 404, { error: 'Job not found' });
    // The check and the record in one statement, so a bike handed over or
    // reopened meanwhile isn't marked (review).
    const marked = await prepare(
      `UPDATE workshop_jobs w SET uncollected_contacted_at = now(), uncollected_contacted_by_login_id = ?
        WHERE w.id = ? AND ${UNCOLLECTED} RETURNING w.id`
    ).get(ctx.login.id, id);
    if (!marked) return sendJson(res, 409, { error: 'That bike isn’t waiting to be collected any more.', code: 'not_uncollected' });
    sendJson(res, 200, { ok: true });
  });
}
